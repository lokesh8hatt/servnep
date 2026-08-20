import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentStatus } from '../bookings/entities/booking.entity';
import { Payment, PaymentRecordStatus } from './entities/payment.entity';

describe('PaymentsService — manual pay-to-number flow', () => {
  let service: PaymentsService;
  let paymentRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock };
  let bookingsService: { findById: jest.Mock; updatePaymentStatus: jest.Mock };

  const OWNER_ID = 'customer-1';

  const makeBookingDto = (overrides: Record<string, unknown> = {}) => ({
    id: 'booking-1',
    customerId: OWNER_ID,
    paymentStatus: PaymentStatus.PENDING,
    paymentMethod: 'ESEWA',
    totalAmount: 500,
    ...overrides,
  });

  beforeEach(async () => {
    paymentRepo = {
      findOne: jest.fn(),
      save: jest.fn((p) => Promise.resolve(p)),
      create: jest.fn((p) => p),
    };
    bookingsService = {
      findById: jest.fn(),
      updatePaymentStatus: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: BookingsService, useValue: bookingsService },
        { provide: ConfigService, useValue: { get: jest.fn() } },
        { provide: getRepositoryToken(Payment), useValue: paymentRepo },
      ],
    }).compile();

    service = module.get(PaymentsService);
  });

  describe('claimManualPayment', () => {
    it('rejects a claim from someone other than the booking owner', async () => {
      bookingsService.findById.mockResolvedValue(makeBookingDto());
      await expect(service.claimManualPayment('booking-1', 'someone-else', 'REF12345')).rejects.toThrow(ForbiddenException);
    });

    it('rejects a claim on an already-paid booking', async () => {
      bookingsService.findById.mockResolvedValue(makeBookingDto({ paymentStatus: PaymentStatus.PAID }));
      await expect(service.claimManualPayment('booking-1', OWNER_ID, 'REF12345')).rejects.toThrow(BadRequestException);
    });

    it('rejects a reference shorter than 4 characters — this is the "prove you paid" guard', async () => {
      bookingsService.findById.mockResolvedValue(makeBookingDto());
      await expect(service.claimManualPayment('booking-1', OWNER_ID, 'abc')).rejects.toThrow(BadRequestException);
    });

    it('records the reference and moves the booking to PENDING_VERIFICATION on a valid claim', async () => {
      bookingsService.findById.mockResolvedValue(makeBookingDto());
      paymentRepo.findOne.mockResolvedValue(null);
      const result = await service.claimManualPayment('booking-1', OWNER_ID, 'REF-000123');
      expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ customerReference: 'REF-000123' }));
      expect(bookingsService.updatePaymentStatus).toHaveBeenCalledWith('booking-1', PaymentStatus.PENDING_VERIFICATION);
      expect(result.status).toBe(PaymentStatus.PENDING_VERIFICATION);
    });
  });

  describe('verifyManualPayment', () => {
    it('throws if no payment claim exists for the booking', async () => {
      paymentRepo.findOne.mockResolvedValue(null);
      await expect(service.verifyManualPayment('booking-1', true)).rejects.toThrow(NotFoundException);
    });

    it('marks the payment COMPLETED and the booking PAID on approval', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', status: PaymentRecordStatus.INITIATED });
      const result = await service.verifyManualPayment('booking-1', true);
      expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentRecordStatus.COMPLETED }));
      expect(bookingsService.updatePaymentStatus).toHaveBeenCalledWith('booking-1', PaymentStatus.PAID);
      expect(result.status).toBe(PaymentStatus.PAID);
    });

    it('marks the payment FAILED and the booking FAILED on rejection', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', status: PaymentRecordStatus.INITIATED });
      const result = await service.verifyManualPayment('booking-1', false);
      expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentRecordStatus.FAILED }));
      expect(result.status).toBe(PaymentStatus.FAILED);
    });
  });
});
