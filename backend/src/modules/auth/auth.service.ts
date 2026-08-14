import { Injectable, UnauthorizedException, BadRequestException, ForbiddenException, ConflictException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '../users/entities/user.entity';
import { EmailService } from './email.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly emailService: EmailService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
  ) {}

  private otpStorage = new Map<string, { code: string; expiresAt: Date }>();
  private passwordResetOtpStorage = new Map<string, { code: string; expiresAt: Date }>();

  // Rate limiting: Track OTP requests per phone number
  private otpRateLimit = new Map<string, { count: number; windowStart: number }>();
  private readonly OTP_MAX_REQUESTS = 3;
  private readonly OTP_WINDOW_MS = 5 * 60 * 1000; // 5 minute window

  private checkRateLimit(phoneNumber: string): void {
    const now = Date.now();
    const record = this.otpRateLimit.get(phoneNumber);

    if (record && now - record.windowStart < this.OTP_WINDOW_MS) {
      if (record.count >= this.OTP_MAX_REQUESTS) {
        const retryAfter = Math.ceil((this.OTP_WINDOW_MS - (now - record.windowStart)) / 1000 / 60);
        throw new HttpException(
          `Too many OTP requests. Please try again in ${retryAfter} minutes.`,
          HttpStatus.TOO_MANY_REQUESTS,
        );
      }
      record.count++;
    } else {
      this.otpRateLimit.set(phoneNumber, { count: 1, windowStart: now });
    }
  }

  async requestOtp(phoneNumber: string): Promise<{ message: string; devOtp?: string }> {
    if (!phoneNumber || phoneNumber.length < 10) {
      throw new BadRequestException('Invalid Nepalese phone number');
    }

    // Check rate limit before generating OTP
    this.checkRateLimit(phoneNumber);

    // Generate a real 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
    this.otpStorage.set(phoneNumber, { code: otpCode, expiresAt });

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
    const record = this.otpStorage.get(phoneNumber);
    if (!record) {
      throw new UnauthorizedException('No OTP request found for this phone number. Please request a new OTP.');
    }
    if (new Date() > record.expiresAt) {
      this.otpStorage.delete(phoneNumber);
      throw new UnauthorizedException('OTP has expired. Please request a new OTP.');
    }
    if (record.code !== otpCode) {
      throw new UnauthorizedException('Invalid OTP code');
    }

    // OTP verified - clean up
    this.otpStorage.delete(phoneNumber);

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

    // Don't leak whether the email exists — always return the same message,
    // but only actually send (and rate-limit) when there's a real account.
    if (!user) return genericMessage;

    this.checkRateLimit(`reset:${email}`);

    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
    this.passwordResetOtpStorage.set(email, { code: otpCode, expiresAt });

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
    const record = this.passwordResetOtpStorage.get(email);
    if (!record) {
      throw new UnauthorizedException('No password reset was requested for this email. Please request a new code.');
    }
    if (new Date() > record.expiresAt) {
      this.passwordResetOtpStorage.delete(email);
      throw new UnauthorizedException('This code has expired. Please request a new one.');
    }
    if (record.code !== otpCode) {
      throw new UnauthorizedException('Invalid verification code');
    }
    if (newPassword.length < 8) {
      throw new BadRequestException('Password must be at least 8 characters');
    }

    const user = await this.userRepository.findOne({ where: { email } });
    if (!user) {
      throw new UnauthorizedException('Account no longer exists');
    }

    user.passwordHash = await bcrypt.hash(newPassword, 10);
    await this.userRepository.save(user);
    this.passwordResetOtpStorage.delete(email);

    return { message: 'Password updated. You can now log in with your new password.' };
  }

  /**
   * One-click login with no phone number or OTP at all, for demo/testing.
   * Blocked in production unless DEMO_MODE=true is explicitly set — that
   * flag exists for deployments that are themselves just a public demo
   * (no real user data, no real SMS gateway to bypass); a real production
   * deployment should never set it.
   */
  async devLogin(role: UserRole): Promise<ReturnType<AuthService['issueSession']>> {
    if (process.env.NODE_ENV === 'production' && process.env.DEMO_MODE !== 'true') {
      throw new ForbiddenException('Instant demo login is not available in production');
    }

    let user = await this.userRepository.findOne({ where: { role } });
    if (!user) {
      const namesByRole: Record<UserRole, string> = {
        [UserRole.CUSTOMER]: 'Demo Customer',
        [UserRole.TECHNICIAN]: 'Demo Technician',
        [UserRole.ADMIN]: 'Demo Admin',
        [UserRole.DISPATCHER]: 'Demo Dispatcher',
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
    const payload = { sub: user.id, phone: user.phoneNumber, role: user.role, name: user.fullName };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      user: { id: user.id, phone: user.phoneNumber, email: user.email, role: user.role, fullName: user.fullName },
    };
  }

  // Token blacklist for server-side session invalidation
  private tokenBlacklist = new Set<string>();

  async logout(token: string): Promise<{ message: string }> {
    try {
      // Verify the token to ensure it's valid before blacklisting
      const payload = await this.jwtService.verifyAsync(token, {
        secret: this.configService.get<string>('jwt.secret'),
      });

      // Add token to blacklist until it would have expired naturally
      const expiresIn = payload.exp ? payload.exp * 1000 - Date.now() : 3600000;
      this.tokenBlacklist.add(token);

      // Schedule removal from blacklist after token expiration
      setTimeout(() => {
        this.tokenBlacklist.delete(token);
      }, Math.max(expiresIn, 60000)); // minimum 1 minute cleanup

      return { message: 'Successfully logged out. Token invalidated.' };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  isTokenBlacklisted(token: string): boolean {
    return this.tokenBlacklist.has(token);
  }
}
