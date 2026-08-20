import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { EmailService } from './email.service';
import { User, UserRole } from '../users/entities/user.entity';
import { OtpCode, OtpPurpose } from './entities/otp-code.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; createQueryBuilder: jest.Mock };
  let otpRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; delete: jest.Mock };
  let emailService: { isConfigured: jest.Mock; sendOtpEmail: jest.Mock };

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
      save: jest.fn((o) => Promise.resolve(o)),
      create: jest.fn((o) => o),
      delete: jest.fn(),
    };
    emailService = {
      isConfigured: jest.fn().mockReturnValue(false),
      sendOtpEmail: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: JwtService, useValue: { sign: jest.fn().mockReturnValue('token') } },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: EmailService, useValue: emailService },
        { provide: getRepositoryToken(User), useValue: userRepo },
        { provide: getRepositoryToken(OtpCode), useValue: otpRepo },
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
      expect(otpRepo.save).not.toHaveBeenCalled();
    });

    it('stores a code and surfaces devOtp for an existing account outside production', async () => {
      userRepo.findOne.mockResolvedValue(makeUser());
      const result = await service.forgotPassword('test@example.com');
      expect(otpRepo.delete).toHaveBeenCalledWith({ identifier: 'test@example.com', purpose: OtpPurpose.PASSWORD_RESET });
      expect(otpRepo.save).toHaveBeenCalled();
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
  });
});
