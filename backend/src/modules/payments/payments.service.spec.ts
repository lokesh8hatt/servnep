import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import * as crypto from 'crypto';
import { PaymentsService } from './payments.service';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentStatus } from '../bookings/entities/booking.entity';
import { Payment, PaymentRecordStatus } from './entities/payment.entity';

const ESEWA_TEST_SECRET = 'test-secret-key';

function signEsewaPayload(fields: Record<string, string>, fieldOrder: string[], secret = ESEWA_TEST_SECRET): string {
  const message = fieldOrder.map((f) => `${f}=${fields[f]}`).join(',');
  const signature = crypto.createHmac('sha256', secret).update(message).digest('base64');
  return Buffer.from(JSON.stringify({ ...fields, signed_field_names: fieldOrder.join(','), signature })).toString('base64');
}

describe('PaymentsService — manual pay-to-number flow', () => {
  let service: PaymentsService;
  let paymentRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; manager: any };
  let bookingsService: { findById: jest.Mock; updatePaymentStatus: jest.Mock; markCommissionSettled: jest.Mock };

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
      manager: null,
    };
    // claimManualPayment runs its find-or-create inside
    // paymentRepository.manager.transaction(async (manager) => {...}) — this
    // mock manager routes back to the same paymentRepo jest mocks.
    paymentRepo.manager = {
      transaction: jest.fn((cb: any) => cb(paymentRepo.manager)),
      getRepository: jest.fn(() => paymentRepo),
      query: jest.fn().mockResolvedValue(undefined),
    };

    bookingsService = {
      findById: jest.fn(),
      updatePaymentStatus: jest.fn().mockResolvedValue(undefined),
      markCommissionSettled: jest.fn().mockResolvedValue(undefined),
    };

    const module = await Test.createTestingModule({
      providers: [
        PaymentsService,
        { provide: BookingsService, useValue: bookingsService },
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => {
              if (key === 'esewa.secretKey') return ESEWA_TEST_SECRET;
              if (key === 'khalti.secretKey') return 'khalti-test-key';
              if (key === 'khalti.baseUrl') return 'https://dev.khalti.com/api/v2';
              return undefined;
            }),
          },
        },
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

    it('rejects a claim on a cash booking — nothing to claim digitally', async () => {
      bookingsService.findById.mockResolvedValue(makeBookingDto({ paymentMethod: 'CASH' }));
      await expect(service.claimManualPayment('booking-1', OWNER_ID, 'REF12345')).rejects.toThrow(BadRequestException);
    });

    it('rejects a claim on an already-paid booking', async () => {
      bookingsService.findById.mockResolvedValue(makeBookingDto({ paymentStatus: PaymentStatus.PAID }));
      await expect(service.claimManualPayment('booking-1', OWNER_ID, 'REF12345')).rejects.toThrow(BadRequestException);
    });

    it('rejects a reference shorter than 4 characters — this is the "prove you paid" guard', async () => {
      bookingsService.findById.mockResolvedValue(makeBookingDto());
      await expect(service.claimManualPayment('booking-1', OWNER_ID, 'abc')).rejects.toThrow(BadRequestException);
    });

    it('rejects a reference already used as proof on a different booking', async () => {
      bookingsService.findById.mockResolvedValue(makeBookingDto());
      paymentRepo.findOne.mockResolvedValueOnce({ id: 'payment-2', bookingId: 'booking-2', customerReference: 'REF-000123' });
      await expect(service.claimManualPayment('booking-1', OWNER_ID, 'REF-000123')).rejects.toThrow(BadRequestException);
    });

    it('records the reference and moves the booking to PENDING_VERIFICATION on a valid claim', async () => {
      bookingsService.findById.mockResolvedValue(makeBookingDto());
      paymentRepo.findOne.mockResolvedValueOnce(null); // reused-reference check
      paymentRepo.findOne.mockResolvedValueOnce(null); // find-or-create inside the transaction
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

    it('refuses to re-process an already-processed claim', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', status: PaymentRecordStatus.COMPLETED });
      await expect(service.verifyManualPayment('booking-1', true)).rejects.toThrow(ConflictException);
    });

    it('refuses to verify a claim against a cash booking (defense in depth)', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', status: PaymentRecordStatus.INITIATED });
      bookingsService.findById.mockResolvedValue(makeBookingDto({ paymentMethod: 'CASH' }));
      await expect(service.verifyManualPayment('booking-1', true)).rejects.toThrow(BadRequestException);
    });

    it('marks the payment COMPLETED, the booking PAID, and the commission settled on approval', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', status: PaymentRecordStatus.INITIATED });
      bookingsService.findById.mockResolvedValue(makeBookingDto());
      const result = await service.verifyManualPayment('booking-1', true);
      expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentRecordStatus.COMPLETED }));
      expect(bookingsService.updatePaymentStatus).toHaveBeenCalledWith('booking-1', PaymentStatus.PAID);
      // The whole manual transfer (job value + commission) lands on the
      // company's number in one go — no separate remittance step needed,
      // unlike cash jobs.
      expect(bookingsService.markCommissionSettled).toHaveBeenCalledWith('booking-1');
      expect(result.status).toBe(PaymentStatus.PAID);
    });

    it('marks the payment FAILED and the booking FAILED on rejection, without settling commission', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', status: PaymentRecordStatus.INITIATED });
      bookingsService.findById.mockResolvedValue(makeBookingDto());
      const result = await service.verifyManualPayment('booking-1', false);
      expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentRecordStatus.FAILED }));
      expect(bookingsService.markCommissionSettled).not.toHaveBeenCalled();
      expect(result.status).toBe(PaymentStatus.FAILED);
    });
  });

  // This is the code that actually stops someone from POSTing a forged
  // "payment complete" callback — it deserves direct coverage, not just
  // trust that the HMAC comparison is correct by inspection.
  describe('verifyEsewaCallback', () => {
    const fieldOrder = ['total_amount', 'transaction_uuid', 'product_code'];
    const baseFields = { total_amount: '500', transaction_uuid: 'tx123', product_code: 'EPAYTEST', status: 'COMPLETE' };

    it('accepts a correctly-signed payload with a matching amount and marks the booking PAID', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', bookingId: 'booking-1', amount: 500, status: PaymentRecordStatus.INITIATED });
      const payload = signEsewaPayload(baseFields, fieldOrder);
      const result = await service.verifyEsewaCallback(payload);
      expect(result.status).toBe('PAID');
      expect(bookingsService.updatePaymentStatus).toHaveBeenCalledWith('booking-1', PaymentStatus.PAID);
    });

    it('rejects a tampered/incorrectly-signed payload', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', bookingId: 'booking-1', amount: 500, status: PaymentRecordStatus.INITIATED });
      const payload = signEsewaPayload(baseFields, fieldOrder, 'wrong-secret');
      await expect(service.verifyEsewaCallback(payload)).rejects.toThrow(BadRequestException);
      expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentRecordStatus.FAILED }));
    });

    it('rejects a validly-signed payload whose amount does not match the stored payment', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', bookingId: 'booking-1', amount: 999, status: PaymentRecordStatus.INITIATED });
      const payload = signEsewaPayload(baseFields, fieldOrder); // signs total_amount=500, but stored amount is 999
      await expect(service.verifyEsewaCallback(payload)).rejects.toThrow(BadRequestException);
      expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentRecordStatus.FAILED }));
    });

    it('rejects a validly-signed, correctly-amounted payload whose status is not COMPLETE', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', bookingId: 'booking-1', amount: 500, status: PaymentRecordStatus.INITIATED });
      const payload = signEsewaPayload({ ...baseFields, status: 'PENDING' }, fieldOrder);
      await expect(service.verifyEsewaCallback(payload)).rejects.toThrow(BadRequestException);
    });

    it('refuses to re-process a payment that was already resolved', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', bookingId: 'booking-1', amount: 500, status: PaymentRecordStatus.COMPLETED });
      const payload = signEsewaPayload(baseFields, fieldOrder);
      await expect(service.verifyEsewaCallback(payload)).rejects.toThrow(ConflictException);
    });

    it('rejects a malformed base64 payload', async () => {
      await expect(service.verifyEsewaCallback('not-valid-base64-json')).rejects.toThrow(BadRequestException);
    });
  });

  describe('verifyKhaltiPayment', () => {
    const originalFetch = global.fetch;
    afterEach(() => {
      global.fetch = originalFetch;
    });

    it('marks the booking PAID only when Khalti reports status Completed', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', bookingId: 'booking-1' });
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'Completed' }) }) as any;
      const result = await service.verifyKhaltiPayment('pidx-123');
      expect(result.status).toBe('PAID');
      expect(bookingsService.updatePaymentStatus).toHaveBeenCalledWith('booking-1', PaymentStatus.PAID);
    });

    it('rejects any status other than Completed, even a 200 OK lookup response', async () => {
      paymentRepo.findOne.mockResolvedValue({ id: 'payment-1', bookingId: 'booking-1' });
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ status: 'Pending' }) }) as any;
      await expect(service.verifyKhaltiPayment('pidx-123')).rejects.toThrow(BadRequestException);
      expect(paymentRepo.save).toHaveBeenCalledWith(expect.objectContaining({ status: PaymentRecordStatus.FAILED }));
    });
  });
});
