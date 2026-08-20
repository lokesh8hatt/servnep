import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { User, UserRole } from '../users/entities/user.entity';
import { OtpCode, OtpPurpose } from './entities/otp-code.entity';
import { BlacklistedToken } from './entities/blacklisted-token.entity';
import { RateLimitCounter } from './entities/rate-limit-counter.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; createQueryBuilder: jest.Mock };
  let otpRepo: { findOne: jest.Mock; upsert: jest.Mock; delete: jest.Mock };
  let blacklistRepo: { save: jest.Mock; create: jest.Mock; findOne: jest.Mock; delete: jest.Mock };
  let rateLimitRepo: { findOne: jest.Mock; update: jest.Mock; upsert: jest.Mock };
  let emailService: { isConfigured: jest.Mock; sendOtpEmail: jest.Mock };
  let jwtService: { sign: jest.Mock; verifyAsync: jest.Mock };

  const makeUser = (overrides: Partial<User> = {}): User =>
    ({
      id: 'user-1',
      email: 'test@example.com',
      phoneNumber: null,
      passwordHash: null,
      role: UserRole.CUSTOMER,
      fullName: 'Test User',
      ...overrides,
    }) as User;

  beforeEach(async () => {
    userRepo = {
      findOne: jest.fn(),
      save: jest.fn((u) => Promise.resolve(u)),
      create: jest.fn((u) => u),
      createQueryBuilder: jest.fn(),
    };
    otpRepo = {
      findOne: jest.fn(),
      upsert: jest.fn().mockResolvedValue(undefined),
      delete: jest.fn(),
    };
    blacklistRepo = {
      save: jest.fn((t) => Promise.resolve(t)),
      create: jest.fn((t) => t),
      findOne: jest.fn().mockResolvedValue(null),
      delete: jest.fn().mockResolvedValue(undefined),
    };
    rateLimitRepo = {
      findOne: jest.fn().mockResolvedValue(null),
      update: jest.fn().mockResolvedValue(undefined),
      upsert: jest.fn().mockResolvedValue(undefined),
    };
    emailService = {
      isConfigured: jest.fn().mockReturnValue(false),
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
    };
    jwtService = {
      sign: jest.fn().mockReturnValue('token'),
      verifyAsync: jest.fn(),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: jwtService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: EmailService, useValue: emailService },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(OtpCode), useValue: otpRepo },
        { provide: getRepositoryToken(BlacklistedToken), useValue: blacklistRepo },
        { provide: getRepositoryToken(RateLimitCounter), useValue: rateLimitRepo },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('register', () => {
    it('rejects a duplicate email', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      await expect(service.register('test@example.com', 'password123', 'Test')).rejects.toThrow(ConflictException);
    });

    it('rejects a short password', async () => {
      userRepo.findOne.mockResolvedValue(null);
      await expect(service.register('new@example.com', 'short', 'Test')).rejects.toThrow(BadRequestException);
    });

    it('creates a user and issues a session on success', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.register('new@example.com', 'password123', 'Test');
      expect(userRepo.save).toHaveBeenCalled();
      expect(result.accessToken).toBe('token');
      expect(result.user.email).toBe('new@example.com');
    });
  });

  describe('loginWithEmail', () => {
    const chain = (returnUser: User | null) => ({
      addSelect: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      getOne: jest.fn().mockResolvedValue(returnUser),
    });

    it('rejects when no account exists for the email', async () => {
      userRepo.createQueryBuilder.mockReturnValue(chain(null));
      await expect(service.loginWithEmail('nobody@example.com', 'password123')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a wrong password', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('correct-password', 10);
      userRepo.createQueryBuilder.mockReturnValue(chain(makeUser({ passwordHash: hash })));
      await expect(service.loginWithEmail('test@example.com', 'wrong-password')).rejects.toThrow(UnauthorizedException);
    });

    it('issues a session on a correct password', async () => {
      const bcrypt = require('bcrypt');
      const hash = await bcrypt.hash('correct-password', 10);
      userRepo.createQueryBuilder.mockReturnValue(chain(makeUser({ passwordHash: hash })));
      const result = await service.loginWithEmail('test@example.com', 'correct-password');
      expect(result.accessToken).toBe('token');
    });
  });

  describe('forgotPassword / resetPassword', () => {
    it('returns the generic message without a devOtp for a non-existent account (no user-enumeration leak)', async () => {
      userRepo.findOne.mockResolvedValue(null);
      const result = await service.forgotPassword('nobody@example.com');
      expect(result.devOtp).toBeUndefined();
      expect(otpRepo.upsert).not.toHaveBeenCalled();
    });

    it('stores a code via upsert and surfaces devOtp for an existing account outside production', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      const result = await service.forgotPassword('test@example.com');
      expect(otpRepo.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ identifier: 'test@example.com', purpose: OtpPurpose.PASSWORD_RESET }),
        ['identifier', 'purpose'],
      );
      expect(result.devOtp).toBeDefined();
    });

    it('rejects an invalid code', async () => {
      otpRepo.findOne.mockResolvedValue({ id: 'otp-1', code: '111111', expiresAt: new Date(Date.now() + 60000) });
      await expect(service.resetPassword('test@example.com', '000000', 'newpassword123')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects an expired code and deletes it', async () => {
      otpRepo.findOne.mockResolvedValue({ id: 'otp-1', code: '111111', expiresAt: new Date(Date.now() - 60000) });
      await expect(service.resetPassword('test@example.com', '111111', 'newpassword123')).rejects.toThrow(UnauthorizedException);
      expect(otpRepo.delete).toHaveBeenCalledWith({ id: 'otp-1' });
    });

    it('updates the password and consumes the code on a valid match', async () => {
      otpRepo.findOne.mockResolvedValue({ id: 'otp-1', code: '111111', expiresAt: new Date(Date.now() + 60000) });
      userRepo.findOne.mockResolvedValue(makeUser());
      const result = await service.resetPassword('test@example.com', '111111', 'newpassword123');
      expect(otpRepo.delete).toHaveBeenCalledWith({ id: 'otp-1' });
      expect(userRepo.save).toHaveBeenCalled();
      expect(result.message).toContain('updated');
    });

    it('blocks OTP verification after too many wrong attempts', async () => {
      otpRepo.findOne.mockResolvedValue({ id: 'otp-1', code: '111111', expiresAt: new Date(Date.now() + 60000) });
      // Simulate the rate limiter already at its cap for this identifier+action.
      rateLimitRepo.findOne.mockResolvedValue({ id: 'rl-1', key: 'otp-verify:PASSWORD_RESET:test@example.com', count: 5, windowStart: new Date() });
      await expect(service.resetPassword('test@example.com', '000000', 'newpassword123')).rejects.toThrow('Too many attempts');
    });
  });

  describe('devLogin', () => {
    it('blocks ADMIN even in a demo-mode environment — the actual loophole this closes', async () => {
      const original = process.env.DEMO_MODE;
      process.env.DEMO_MODE = 'true';
      try {
        await expect(service.devLogin(UserRole.ADMIN)).rejects.toThrow(ForbiddenException);
      } finally {
        process.env.DEMO_MODE = original;
      }
    });

    it('blocks DISPATCHER the same way', async () => {
      await expect(service.devLogin(UserRole.DISPATCHER)).rejects.toThrow(ForbiddenException);
    });

    it('still allows CUSTOMER demo login outside production', async () => {
      const original = process.env.NODE_ENV;
      process.env.NODE_ENV = 'development';
      try {
        userRepo.findOne.mockResolvedValue(makeUser({ role: UserRole.CUSTOMER }));
        const result = await service.devLogin(UserRole.CUSTOMER);
        expect(result.accessToken).toBe('token');
      } finally {
        process.env.NODE_ENV = original;
      }
    });
  });

  describe('logout / isTokenBlacklisted', () => {
    it('persists the token to the blacklist table on logout', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', exp: Math.floor(Date.now() / 1000) + 3600 });
      await service.logout('some-token');
      expect(blacklistRepo.save).toHaveBeenCalledWith(expect.objectContaining({ token: 'some-token' }));
    });

    it('rejects logout for an unverifiable token', async () => {
      jwtService.verifyAsync.mockRejectedValue(new Error('bad token'));
      await expect(service.logout('garbage')).rejects.toThrow(UnauthorizedException);
    });

    it('isTokenBlacklisted reflects a real DB row, not an in-memory set', async () => {
      blacklistRepo.findOne.mockResolvedValue({ id: 'bl-1', token: 'some-token' });
      expect(await service.isTokenBlacklisted('some-token')).toBe(true);
    });
  });

  describe('refreshSession', () => {
    it('rejects a token that is not actually type: refresh', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'access' });
      await expect(service.refreshSession('an-access-token')).rejects.toThrow(UnauthorizedException);
    });

    it('rejects a blacklisted (logged-out) refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'refresh' });
      blacklistRepo.findOne.mockResolvedValue({ id: 'bl-1', token: 'refresh-token' });
      await expect(service.refreshSession('refresh-token')).rejects.toThrow(UnauthorizedException);
    });

    it('issues a fresh access token for a valid refresh token', async () => {
      jwtService.verifyAsync.mockResolvedValue({ sub: 'user-1', type: 'refresh' });
      userRepo.findOne.mockResolvedValue(makeUser());
      const result = await service.refreshSession('refresh-token');
      expect(result.accessToken).toBe('token');
    });
  });
});
