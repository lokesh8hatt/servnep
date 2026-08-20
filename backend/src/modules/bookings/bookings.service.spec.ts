import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { ServicesService } from '../services/services.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../auth/email.service';
import { Booking, BookingStatus } from './entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { TechnicianProfile } from '../users/entities/technician-profile.entity';

describe('BookingsService — access control', () => {
  let service: BookingsService;
  let bookingRepo: { findOne: jest.Mock; save: jest.Mock };

  const CUSTOMER_ID = 'customer-1';
  const TECHNICIAN_ID = 'technician-1';
  const OTHER_ID = 'someone-else';

  const makeBooking = (overrides: Partial<Booking> = {}): Booking =>
    ({
      id: 'booking-1',
      bookingNumber: 'SN-0001',
      customerId: CUSTOMER_ID,
      technicianId: TECHNICIAN_ID,
      status: BookingStatus.ASSIGNED,
      imagesBefore: [],
      imagesAfter: [],
      createdAt: new Date(),
      ...overrides,
    }) as Booking;

  beforeEach(async () => {
    bookingRepo = {
      findOne: jest.fn(),
      save: jest.fn((b) => Promise.resolve(b)),
    };

    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: ServicesService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: EmailService, useValue: { isConfigured: () => false } },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(User), useValue: { findOne: jest.fn() } },
        { provide: getRepositoryToken(TechnicianProfile), useValue: { findOne: jest.fn() } },
      ],
    }).compile();

    service = module.get(BookingsService);
  });

  describe('findByIdForUser', () => {
    it('lets the owning customer view their own booking', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking());
      const dto = await service.findByIdForUser('booking-1', { sub: CUSTOMER_ID, role: 'CUSTOMER' });
      expect(dto.id).toBe('booking-1');
    });

    it('lets the assigned technician view the booking', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking());
      const dto = await service.findByIdForUser('booking-1', { sub: TECHNICIAN_ID, role: 'TECHNICIAN' });
      expect(dto.id).toBe('booking-1');
    });

    it('lets admin/dispatcher staff view any booking', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking());
      const dto = await service.findByIdForUser('booking-1', { sub: OTHER_ID, role: 'ADMIN' });
      expect(dto.id).toBe('booking-1');
    });

    it('blocks a stranger — this is the IDOR guard', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking());
      await expect(service.findByIdForUser('booking-1', { sub: OTHER_ID, role: 'CUSTOMER' })).rejects.toThrow(ForbiddenException);
    });
  });

  describe('updateStatus', () => {
    it('lets the assigned technician update status', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking());
      const dto = await service.updateStatus('booking-1', BookingStatus.IN_PROGRESS, undefined, { sub: TECHNICIAN_ID, role: 'TECHNICIAN' });
      expect(dto.status).toBe(BookingStatus.IN_PROGRESS);
    });

    it('blocks a technician not assigned to this booking', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking());
      await expect(
        service.updateStatus('booking-1', BookingStatus.IN_PROGRESS, undefined, { sub: OTHER_ID, role: 'TECHNICIAN' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks a customer from updating status even on their own booking', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking());
      await expect(
        service.updateStatus('booking-1', BookingStatus.IN_PROGRESS, undefined, { sub: CUSTOMER_ID, role: 'CUSTOMER' }),
      ).rejects.toThrow(ForbiddenException);
    });
  });
});
