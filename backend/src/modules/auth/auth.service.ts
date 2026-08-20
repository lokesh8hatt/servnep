import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, LessThan } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/entities/user.entity';
import { EmailService } from './email.service';
import { OtpCode, OtpPurpose } from './entities/otp-code.entity';
import { BlacklistedToken } from './entities/blacklisted-token.entity';
import { RateLimitCounter } from './entities/rate-limit-counter.entity';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(OtpCode)
    private readonly otpRepository: Repository<OtpCode>,
    @InjectRepository(BlacklistedToken)
    private readonly blacklistRepository: Repository<BlacklistedToken>,
    @InjectRepository(RateLimitCounter)
    private readonly rateLimitRepository: Repository<RateLimitCounter>,
  ) {}

  // Real atomic upsert on the (identifier, purpose) unique index — replaces
  // a delete-then-insert pair that had a race window where two concurrent
  // requests could both insert a row.
  private async storeOtp(identifier: string, purpose: OtpPurpose, code: string, ttlMs: number): Promise<void> {
    await this.otpRepository.upsert(
      { identifier, purpose, code, expiresAt: new Date(Date.now() + ttlMs) },
      ['identifier', 'purpose'],
    );
  }

  // Throws on a missing/expired/mismatched code; deletes it on success so it
  // can't be replayed. Shared by phone-login and password-reset verification.
  // Rate-limited separately from the request side — a code being valid for
  // 5-10 minutes is pointless protection if it can be brute-forced in that
  // window, which a request-side-only limit does nothing to stop.
  private async consumeOtp(identifier: string, purpose: OtpPurpose, code: string): Promise<void> {
    await this.checkRateLimit(`otp-verify:${purpose}`, identifier);

    const record = await this.otpRepository.findOne({ where: { identifier, purpose } });
    if (!record) {
      throw new UnauthorizedException('No verification code was requested for this. Please request a new one.');
    }
    if (new Date() > record.expiresAt) {
      await this.otpRepository.delete({ id: record.id });
      throw new UnauthorizedException('This code has expired. Please request a new one.');
    }
    if (record.code !== code) {
      throw new UnauthorizedException('Invalid verification code');
    }
    await this.otpRepository.delete({ id: record.id });
  }

  // Rate limiting: persisted so a redeploy (deliberate, or Render's free-tier
  // idle-restart) can't hand an attacker a fresh budget. Buckets are keyed by
  // action so OTP requests and OTP verification attempts are throttled
  // independently — a 6-digit code needs its *verify* attempts limited, not
  // just how often a new one can be requested.
  private readonly RATE_LIMITS: Record<string, { max: number; windowMs: number }> = {
    'otp-request': { max: 3, windowMs: 5 * 60 * 1000 },
    'reset-request': { max: 3, windowMs: 5 * 60 * 1000 },
    'otp-verify:PHONE_LOGIN': { max: 5, windowMs: 5 * 60 * 1000 },
    'otp-verify:PASSWORD_RESET': { max: 5, windowMs: 5 * 60 * 1000 },
    login: { max: 10, windowMs: 5 * 60 * 1000 },
  };

  private async checkRateLimit(action: string, identifier: string): Promise<void> {
    const limit = this.RATE_LIMITS[action];
    if (!limit) return;

    const key = `${action}:${identifier}`;
    const now = new Date();
    const existing = await this.rateLimitRepository.findOne({ where: { key } });

    if (existing && now.getTime() - existing.windowStart.getTime() < limit.windowMs) {
      if (existing.count >= limit.max) {
        const retryAfter = Math.ceil((limit.windowMs - (now.getTime() - existing.windowStart.getTime())) / 1000 / 60);
        throw new HttpException(`Too many attempts. Please try again in ${retryAfter} minutes.`, HttpStatus.TOO_MANY_REQUESTS);
      }
      await this.rateLimitRepository.update({ id: existing.id }, { count: existing.count + 1 });
    } else {
      await this.rateLimitRepository.upsert({ key, count: 1, windowStart: now }, ['key']);
    }
  }

  async requestOtp(phoneNumber: string): Promise<{ message: string; devOtp?: string }> {
    if (!phoneNumber || phoneNumber.length < 10) {
      throw new BadRequestException('Invalid Nepalese phone number');
    }

    await this.checkRateLimit('otp-request', phoneNumber);

    // Generate a real 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    await this.storeOtp(phoneNumber, OtpPurpose.PHONE_LOGIN, otpCode, 5 * 60 * 1000);

    // In production, this would call an SMS gateway API instead. Outside
    // production — or in a production deploy explicitly flagged as a public
    // demo via DEMO_MODE — there's no real SMS gateway wired up, so the OTP
    // is both logged and returned in the response (devOtp) so the login page
    // can surface it directly with no server console access needed.
    const isLiveProduction = process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true';
    if (!isLiveProduction) {
      console.log(`[DEV] OTP for ${phoneNumber}: ${otpCode}`);
    }

    return {
      message: 'OTP sent successfully via SMS',
      ...(isLiveProduction ? {} : { devOtp: otpCode }),
    };
  }

  async verifyOtp(
    phoneNumber: string,
    otpCode: string,
  ): Promise<ReturnType<AuthService['issueSession']>> {
    await this.consumeOtp(phoneNumber, OtpPurpose.PHONE_LOGIN, otpCode);

    // Find or create user
    let user = await this.userRepository.findOne({ where: { phoneNumber } });
    if (!user) {
      user = await this.userRepository.save(
        this.userRepository.create({
          phoneNumber,
          role: UserRole.CUSTOMER,
          fullName: 'New Customer',
        }),
      );
    }

    return this.issueSession(user);
  }

  async register(email: string, password: string, fullName: string): Promise<ReturnType<AuthService['issueSession']>> {
    const existing = await this.userRepository.findOne({ where: { email } });
    if (existing) {
      throw new ConflictException('An account with this email already exists');
    }
    if (password.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await this.userRepository.save(
      this.userRepository.create({
        email,
        passwordHash,
        fullName,
        role: UserRole.CUSTOMER,
      }),
    );

    return this.issueSession(user);
  }

  async loginWithEmail(email: string, password: string): Promise<ReturnType<AuthService['issueSession']>> {
    await this.checkRateLimit('login', email);

    // passwordHash has select:false on the entity, so it must be explicitly
    // requested — otherwise it's silently excluded from the query result.
    const user = await this.userRepository
      .createQueryBuilder('user')
      .addSelect('user.passwordHash')
      .where('user.email = :email', { email })
      .getOne();

    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Invalid email or password');
    }
    const matches = await bcrypt.compare(password, user.passwordHash);
    if (!matches) {
      throw new UnauthorizedException('Invalid email or password');
    }

    return this.issueSession(user);
  }

  async forgotPassword(email: string): Promise<{ message: string; devOtp?: string }> {
    const user = await this.userRepository.findOne({ where: { email } });
    const genericMessage = { message: 'If an account exists for that email, a verification code has been sent.' };

    // Don't leak whether the email exists — always return the same message.
    // The real work below (rate-limit write, OTP upsert, an outbound HTTPS
    // call to Brevo) takes measurably longer than this single indexed
    // SELECT, so a fixed dummy delay on the "no such user" path closes that
    // timing side-channel rather than just matching the response body.
    if (!user) {
      await new Promise((resolve) => setTimeout(resolve, 300));
      return genericMessage;
    }

    await this.checkRateLimit('reset-request', email);

    const otpCode = crypto.randomInt(100000, 999999).toString();
    await this.storeOtp(email, OtpPurpose.PASSWORD_RESET, otpCode, 10 * 60 * 1000);

    // Mirrors requestOtp's exact shape: isLiveProduction gates whether the
    // code is ever exposed in the response, independent of whether Gmail
    // happens to be configured — a real production deploy without Gmail set
    // up is a no-op here, same as phone OTP is without a real SMS gateway.
    const isLiveProduction = process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true';

    if (this.emailService.isConfigured()) {
      try {
        await this.emailService.sendOtpEmail(email, otpCode);
      } catch (err: any) {
        // A send failure (bad credentials, Gmail rejecting the request) must
        // not change the response shape in production — otherwise it becomes
        // a side channel for checking which emails have accounts. Surface it
        // in dev only, where it's a real config bug worth seeing immediately.
        if (isLiveProduction) {
          console.error(`Password reset email failed for ${email}: ${err.message}`);
        } else {
          throw err;
        }
      }
    }

    if (!isLiveProduction) {
      console.log(`[DEV] Password reset OTP for ${email}: ${otpCode}`);
    }

    return { ...genericMessage, ...(isLiveProduction ? {} : { devOtp: otpCode }) };
  }

  async resetPassword(email: string, otpCode: string, newPassword: string): Promise<{ message: string }> {
    // Consumes (deletes) the code as a side effect, before touching the
    // user — a caught exception here must not leave the code replayable.
    await this.consumeOtp(email, OtpPurpose.PASSWORD_RESET, otpCode);
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);

    return { message: 'Password updated. You can now log in with your new password.' };
  }

  /**
   * One-click login with no phone number or OTP at all, for demo/testing.
   * ADMIN/DISPATCHER are blocked unconditionally, even under DEMO_MODE —
   * granting staff-level control over payment verification and payouts to
   * anyone on the internet with no credentials is a real risk regardless of
   * "it's just a demo" framing. CUSTOMER/TECHNICIAN demo access stays
   * available under DEMO_MODE, gated by the same production check as before.
   */
  async devLogin(role: UserRole): Promise<ReturnType<AuthService['issueSession']>> {
    if (role === UserRole.ADMIN || role === UserRole.DISPATCHER) {
      throw new ForbiddenException('Instant demo login is not available for staff roles');
    }
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
      throw new ForbiddenException('Instant demo login is not available in production');
    }

    let user = await this.userRepository.findOne({ where: { role } });
    if (!user) {
      const namesByRole: Partial<Record<UserRole, string>> = {
        [UserRole.CUSTOMER]: 'Demo Customer',
        [UserRole.TECHNICIAN]: 'Demo Technician',
      };
      user = await this.userRepository.save(
        this.userRepository.create({
          phoneNumber: `9${crypto.randomInt(100000000, 999999999)}`,
          role,
          fullName: namesByRole[role],
        }),
      );
    }

    return this.issueSession(user);
  }

  private issueSession(user: User) {
    // type: 'access' vs 'refresh' distinguishes the two so a refresh token
    // (long-lived, minimal payload) can't be used directly against
    // resource endpoints the way it could before — JwtAuthGuard rejects
    // anything that isn't type: 'access'.
    const accessPayload = { sub: user.id, phone: user.phoneNumber, role: user.role, name: user.fullName, type: 'access' };
    const refreshPayload = { sub: user.id, type: 'refresh' };
    const accessToken = this.jwtService.sign(accessPayload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(refreshPayload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, phone: user.phoneNumber, email: user.email, role: user.role, fullName: user.fullName },
    };
  }

  // Exchanges a valid, non-blacklisted refresh token for a fresh access
  // token — the only legitimate use of a refresh token; JwtAuthGuard refuses
  // to accept type: 'refresh' tokens anywhere else.
  async refreshSession(refreshToken: string): Promise<{ accessToken: string }> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(refreshToken, { secret: this.configService.get<string>('jwt.secret') });
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
    if (payload.type !== 'refresh') {
      throw new UnauthorizedException('Not a refresh token');
    }
    if (await this.isTokenBlacklisted(refreshToken)) {
      throw new UnauthorizedException('This session has been logged out');
    }

    const user = await this.userRepository.findOne({ where: { id: payload.sub } });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    const accessPayload = { sub: user.id, phone: user.phoneNumber, role: user.role, name: user.fullName, type: 'access' };
    return { accessToken: this.jwtService.sign(accessPayload, { expiresIn: '1h' }) };
  }

  async logout(token: string): Promise<{ message: string }> {
    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });
    } catch {
      throw new UnauthorizedException('Invalid token');
    }

    const expiresAt = payload.exp ? new Date(payload.exp * 1000) : new Date(Date.now() + 3600000);
    await this.blacklistRepository.save(this.blacklistRepository.create({ token, expiresAt }));

    // Opportunistic cleanup of long-expired rows — piggybacking on logout
    // traffic rather than running a separate scheduled job.
    this.blacklistRepository.delete({ expiresAt: LessThan(new Date()) }).catch(() => {});

    return { message: 'Successfully logged out. Token invalidated.' };
  }

  // Checked by JwtAuthGuard on every request — a DB read, not the
  // in-memory Set lookup this used to be, so "logged out" now actually
  // survives a redeploy and applies across every server instance.
  async isTokenBlacklisted(token: string): Promise<boolean> {
    const found = await this.blacklistRepository.findOne({ where: { token } });
    return !!found;
  }
}
