import { Injectable, UnauthorizedException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class AuthService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private otpStorage = new Map<string, { code: string; expiresAt: Date }>();
  private userRegistry = new Map<string, { id: string; phone: string; role: string; fullName: string }>();
  
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

  async requestOtp(phoneNumber: string): Promise<{ message: string }> {
    if (!phoneNumber || phoneNumber.length < 10) {
      throw new BadRequestException('Invalid Nepalese phone number');
    }

    // Check rate limit before generating OTP
    this.checkRateLimit(phoneNumber);

    // Generate a real 6-digit OTP
    const otpCode = crypto.randomInt(100000, 999999).toString();
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes expiry
    this.otpStorage.set(phoneNumber, { code: otpCode, expiresAt });
    
    // In production, this would call an SMS gateway API
    // OTP is only logged in development for testing
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV] OTP for ${phoneNumber}: ${otpCode}`);
    }
    
    return {
      message: 'OTP sent successfully via SMS',
    };
  }

  async verifyOtp(phoneNumber: string, otpCode: string): Promise<{ accessToken: string; refreshToken: string; user: any }> {
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
    let user = this.userRegistry.get(phoneNumber);
    if (!user) {
      const newId = `user-uuid-${crypto.randomUUID().substring(0, 8)}`;
      user = {
        id: newId,
        phone: phoneNumber,
        role: 'CUSTOMER',
        fullName: 'New Customer',
      };
      this.userRegistry.set(phoneNumber, user);
    }

    const payload = { sub: user.id, phone: user.phone, role: user.role, name: user.fullName };
    const accessToken = this.jwtService.sign(payload, { expiresIn: '1h' });
    const refreshToken = this.jwtService.sign(payload, { expiresIn: '7d' });

    return {
      accessToken,
      refreshToken,
      user,
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

  getUserRegistry() {
    return Array.from(this.userRegistry.values());
  }

  updateProfile(userId: string, data: { fullName: string }) {
    // Sanitize input - strip HTML tags to prevent XSS
    const sanitizedName = data.fullName.replace(/<[^>]*>/g, '').trim();
    if (!sanitizedName || sanitizedName.length < 2) {
      throw new BadRequestException('Full name must be at least 2 characters');
    }
    if (sanitizedName.length > 100) {
      throw new BadRequestException('Full name must not exceed 100 characters');
    }

    for (const [phone, user] of this.userRegistry.entries()) {
      if (user.id === userId) {
        user.fullName = sanitizedName;
        this.userRegistry.set(phone, user);
        return user;
      }
    }
    return null;
  }
}