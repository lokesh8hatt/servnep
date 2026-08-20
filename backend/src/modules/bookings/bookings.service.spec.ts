import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ForbiddenException, BadRequestException } from '@nestjs/common';
import { BookingsService, COMMISSION_RATE } from './bookings.service';
import { ServicesService } from '../services/services.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../auth/email.service';
import { Booking, BookingStatus, PaymentMethod, PaymentStatus } from './entities/booking.entity';
import { PriceRevision, RevisionStatus } from './entities/price-revision.entity';
import { TechnicianPayout } from '../payments/entities/technician-payout.entity';
import { User } from '../users/entities/user.entity';
import { TechnicianProfile } from '../users/entities/technician-profile.entity';

describe('BookingsService', () => {
  let service: BookingsService;
  let bookingRepo: { findOne: jest.Mock; save: jest.Mock; find: jest.Mock; update: jest.Mock; manager: any };
  let priceRevisionRepo: { findOne: jest.Mock; save: jest.Mock; create: jest.Mock; find: jest.Mock; count: jest.Mock };
  let payoutRepo: { save: jest.Mock; create: jest.Mock; find: jest.Mock };

  const CUSTOMER_ID = 'customer-1';
  const TECHNICIAN_ID = 'technician-1';
  const OTHER_ID = 'someone-else';

  // What the locked-row query builder returns inside requestPriceRevision
  // (getOne) and createPayout (getMany) — set per-test.
  let qbGetOneResult: Booking | null = null;
  let qbGetManyResult: Booking[] = [];

  const makeBooking = (overrides: Partial<Booking> = {}): Booking =>
    ({
      id: 'booking-1',
      bookingNumber: 'SN-0001',
      customerId: CUSTOMER_ID,
      technicianId: TECHNICIAN_ID,
      status: BookingStatus.ASSIGNED,
      baseAmount: 1000,
      serviceFee: 50,
      emergencySurcharge: 0,
      totalAmount: 1050,
      paymentMethod: PaymentMethod.CASH,
      paymentStatus: PaymentStatus.PENDING,
      commissionAmount: null,
      technicianPayoutAmount: null,
      commissionSettled: false,
      commissionReference: null,
      payoutId: null,
      imagesBefore: [],
      imagesAfter: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      ...overrides,
    }) as Booking;

  const makeQueryBuilder = () => {
    const qb: any = {};
    ['setLock', 'where', 'andWhere'].forEach((m) => (qb[m] = jest.fn(() => qb)));
    qb.getOne = jest.fn(() => Promise.resolve(qbGetOneResult));
    qb.getMany = jest.fn(() => Promise.resolve(qbGetManyResult));
    return qb;
  };

  beforeEach(async () => {
    qbGetOneResult = null;
    qbGetManyResult = [];

    bookingRepo = {
      findOne: jest.fn(),
      save: jest.fn((b) => Promise.resolve(b)),
      find: jest.fn().mockResolvedValue([]),
      update: jest.fn().mockResolvedValue(undefined),
      manager: null, // set below, after priceRevisionRepo/payoutRepo exist
    };
    priceRevisionRepo = {
      findOne: jest.fn(),
      save: jest.fn((r) => Promise.resolve({ ...r, id: r.id ?? 'revision-1', createdAt: r.createdAt ?? new Date() })),
      create: jest.fn((r) => r),
      find: jest.fn().mockResolvedValue([]),
      count: jest.fn().mockResolvedValue(0),
    };
    payoutRepo = {
      save: jest.fn((p) => Promise.resolve({ ...p, id: 'payout-1' })),
      create: jest.fn((p) => p),
      find: jest.fn().mockResolvedValue([]),
    };

    // requestPriceRevision/createPayout run inside
    // bookingRepository.manager.transaction(async (manager) => {...}) and use
    // manager.createQueryBuilder(...)/manager.getRepository(...) — this mock
    // manager makes both resolve to the same jest mocks the tests assert on.
    const manager: any = {
      transaction: jest.fn((cb: any) => cb(manager)),
      createQueryBuilder: jest.fn(() => makeQueryBuilder()),
      getRepository: jest.fn((entity: any) => {
        if (entity === PriceRevision) return priceRevisionRepo;
        if (entity === TechnicianPayout) return payoutRepo;
        return bookingRepo;
      }),
      query: jest.fn().mockResolvedValue(undefined),
    };
    bookingRepo.manager = manager;

    const module = await Test.createTestingModule({
      providers: [
        BookingsService,
        { provide: ServicesService, useValue: {} },
        { provide: UsersService, useValue: {} },
        { provide: EmailService, useValue: { isConfigured: () => false } },
        { provide: getRepositoryToken(Booking), useValue: bookingRepo },
        { provide: getRepositoryToken(PriceRevision), useValue: priceRevisionRepo },
        { provide: getRepositoryToken(TechnicianPayout), useValue: payoutRepo },
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
    it('lets the assigned technician move ASSIGNED to IN_PROGRESS', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking({ status: BookingStatus.ASSIGNED }));
      const dto = await service.updateStatus('booking-1', BookingStatus.IN_PROGRESS, undefined, { sub: TECHNICIAN_ID, role: 'TECHNICIAN' });
      expect(dto.status).toBe(BookingStatus.IN_PROGRESS);
    });

    it('blocks a technician not assigned to this booking', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking({ status: BookingStatus.ASSIGNED }));
      await expect(
        service.updateStatus('booking-1', BookingStatus.IN_PROGRESS, undefined, { sub: OTHER_ID, role: 'TECHNICIAN' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('blocks a customer from updating status even on their own booking', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking({ status: BookingStatus.ASSIGNED }));
      await expect(
        service.updateStatus('booking-1', BookingStatus.IN_PROGRESS, undefined, { sub: CUSTOMER_ID, role: 'CUSTOMER' }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('refuses to complete a job with a price revision still pending customer approval', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking({ status: BookingStatus.IN_PROGRESS }));
      priceRevisionRepo.findOne.mockResolvedValue({ id: 'rev-1', status: RevisionStatus.PENDING });
      await expect(
        service.updateStatus('booking-1', BookingStatus.COMPLETED, undefined, { sub: TECHNICIAN_ID, role: 'TECHNICIAN' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('locks in commission/payout amounts at 15% and marks cash jobs paid on completion', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking({ status: BookingStatus.IN_PROGRESS, baseAmount: 1000 }));
      priceRevisionRepo.findOne.mockResolvedValue(null);
      const dto = await service.updateStatus('booking-1', BookingStatus.COMPLETED, undefined, { sub: TECHNICIAN_ID, role: 'TECHNICIAN' });
      expect(dto.commissionAmount).toBe(1000 * COMMISSION_RATE);
      expect(dto.technicianPayoutAmount).toBe(1000 * (1 - COMMISSION_RATE));
      expect(dto.paymentStatus).toBe(PaymentStatus.PAID);
      expect(dto.commissionSettled).toBe(false); // cash still needs remittance
    });

    // This is the state-machine guard closing the "reopen a completed job,
    // re-price it, re-complete it" loophole.
    it('refuses to move a COMPLETED booking back to an earlier status', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking({ status: BookingStatus.COMPLETED }));
      await expect(
        service.updateStatus('booking-1', BookingStatus.ASSIGNED, undefined, { sub: TECHNICIAN_ID, role: 'ADMIN' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses to reopen a CANCELLED booking straight to COMPLETED', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking({ status: BookingStatus.CANCELLED }));
      await expect(
        service.updateStatus('booking-1', BookingStatus.COMPLETED, undefined, { sub: TECHNICIAN_ID, role: 'ADMIN' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('refuses a same-status no-op transition', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking({ status: BookingStatus.ASSIGNED }));
      await expect(
        service.updateStatus('booking-1', BookingStatus.ASSIGNED, undefined, { sub: TECHNICIAN_ID, role: 'TECHNICIAN' }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('price revisions', () => {
    it('rejects a revision request from a technician not on the booking', async () => {
      qbGetOneResult = makeBooking();
      await expect(service.requestPriceRevision('booking-1', OTHER_ID, 500, 'smaller fix than booked')).rejects.toThrow(ForbiddenException);
    });

    it('rejects a revision with no reason — the reason is the whole point', async () => {
      qbGetOneResult = makeBooking();
      await expect(service.requestPriceRevision('booking-1', TECHNICIAN_ID, 500, '')).rejects.toThrow(BadRequestException);
    });

    it('blocks a second revision while one is already pending', async () => {
      qbGetOneResult = makeBooking();
      priceRevisionRepo.findOne.mockResolvedValue({ id: 'rev-1', status: RevisionStatus.PENDING });
      await expect(service.requestPriceRevision('booking-1', TECHNICIAN_ID, 500, 'actually smaller job')).rejects.toThrow(BadRequestException);
    });

    it('rejects a revised amount far outside a sane range of the original price', async () => {
      qbGetOneResult = makeBooking({ baseAmount: 1000 });
      await expect(service.requestPriceRevision('booking-1', TECHNICIAN_ID, 999999, 'wildly inflated amount')).rejects.toThrow(BadRequestException);
    });

    it('caps the number of revisions allowed on a single booking', async () => {
      qbGetOneResult = makeBooking({ baseAmount: 1000 });
      priceRevisionRepo.count.mockResolvedValue(3);
      await expect(service.requestPriceRevision('booking-1', TECHNICIAN_ID, 900, 'another revision attempt')).rejects.toThrow(BadRequestException);
    });

    it('creates a PENDING revision for a valid, in-range request', async () => {
      qbGetOneResult = makeBooking({ baseAmount: 1000 });
      const dto = await service.requestPriceRevision('booking-1', TECHNICIAN_ID, 800, 'smaller fix than expected');
      expect(dto.requestedAmount).toBe(800);
      expect(dto.status).toBe(RevisionStatus.PENDING);
    });

    it('updates baseAmount/totalAmount only when the customer approves', async () => {
      const booking = makeBooking({ baseAmount: 1000, totalAmount: 1050 });
      bookingRepo.findOne.mockResolvedValue(booking);
      priceRevisionRepo.findOne.mockResolvedValue({ id: 'rev-1', bookingId: 'booking-1', status: RevisionStatus.PENDING, requestedAmount: 500 });

      const dto = await service.respondToPriceRevision('booking-1', 'rev-1', CUSTOMER_ID, true);
      expect(dto.baseAmount).toBe(500);
      expect(dto.totalAmount).toBe(550); // 500 + serviceFee(50) + surcharge(0)
    });

    it('leaves baseAmount untouched when the customer rejects', async () => {
      const booking = makeBooking({ baseAmount: 1000, totalAmount: 1050 });
      bookingRepo.findOne.mockResolvedValue(booking);
      priceRevisionRepo.findOne.mockResolvedValue({ id: 'rev-1', bookingId: 'booking-1', status: RevisionStatus.PENDING, requestedAmount: 500 });

      const dto = await service.respondToPriceRevision('booking-1', 'rev-1', CUSTOMER_ID, false);
      expect(dto.baseAmount).toBe(1000);
    });

    it('blocks a non-owner from responding to a revision', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking());
      await expect(service.respondToPriceRevision('booking-1', 'rev-1', OTHER_ID, true)).rejects.toThrow(ForbiddenException);
    });
  });

  describe('commission remittance (cash jobs)', () => {
    it('rejects a remittance claim on a digital-payment booking — those settle automatically', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking({ paymentMethod: PaymentMethod.ESEWA, status: BookingStatus.COMPLETED }));
      await expect(service.claimCommissionRemittance('booking-1', TECHNICIAN_ID, 'REF1234')).rejects.toThrow(BadRequestException);
    });

    it('rejects a remittance claim before the job is marked complete', async () => {
      bookingRepo.findOne.mockResolvedValue(makeBooking({ paymentMethod: PaymentMethod.CASH, status: BookingStatus.IN_PROGRESS }));
      await expect(service.claimCommissionRemittance('booking-1', TECHNICIAN_ID, 'REF1234')).rejects.toThrow(BadRequestException);
    });

    it('records the reference on a valid claim, leaving commissionSettled false until admin verifies', async () => {
      const booking = makeBooking({ paymentMethod: PaymentMethod.CASH, status: BookingStatus.COMPLETED });
      bookingRepo.findOne.mockResolvedValueOnce(booking); // claimCommissionRemittance's own lookup
      bookingRepo.findOne.mockResolvedValueOnce(null); // reused-reference check finds nothing
      await service.claimCommissionRemittance('booking-1', TECHNICIAN_ID, 'REF1234');
      expect(bookingRepo.save).toHaveBeenCalledWith(expect.objectContaining({ commissionReference: 'REF1234', commissionSettled: false }));
    });

    it('rejects a commission reference already used as proof on a different booking', async () => {
      const booking = makeBooking({ paymentMethod: PaymentMethod.CASH, status: BookingStatus.COMPLETED });
      bookingRepo.findOne.mockResolvedValueOnce(booking);
      bookingRepo.findOne.mockResolvedValueOnce(makeBooking({ id: 'booking-2', commissionReference: 'REF1234' }));
      await expect(service.claimCommissionRemittance('booking-1', TECHNICIAN_ID, 'REF1234')).rejects.toThrow(BadRequestException);
    });

    it('admin approval sets commissionSettled true', async () => {
      const booking = makeBooking({ commissionReference: 'REF1234', commissionSettled: false });
      bookingRepo.findOne.mockResolvedValue(booking);
      await service.verifyCommissionRemittance('booking-1', true);
      expect(bookingRepo.save).toHaveBeenCalledWith(expect.objectContaining({ commissionSettled: true }));
    });

    it('refuses to re-verify a booking whose commission is already settled', async () => {
      const booking = makeBooking({ commissionReference: 'REF1234', commissionSettled: true });
      bookingRepo.findOne.mockResolvedValue(booking);
      await expect(service.verifyCommissionRemittance('booking-1', true)).rejects.toThrow(BadRequestException);
    });
  });

  describe('payouts', () => {
    it("computes a technician's pending balance from settled, unpaid bookings", async () => {
      bookingRepo.find.mockResolvedValue([
        makeBooking({ id: 'b1', technicianPayoutAmount: 850, commissionSettled: true, payoutId: null }),
        makeBooking({ id: 'b2', technicianPayoutAmount: 425, commissionSettled: true, payoutId: null }),
      ]);
      const earnings = await service.getTechnicianEarnings(TECHNICIAN_ID);
      expect(earnings.pendingBalance).toBe(1275);
      expect(earnings.pendingBookingCount).toBe(2);
    });

    it('sums paidTotal from real TechnicianPayout rows', async () => {
      bookingRepo.find.mockResolvedValue([]);
      payoutRepo.find.mockResolvedValue([{ totalAmount: 500 }, { totalAmount: 250 }]);
      const earnings = await service.getTechnicianEarnings(TECHNICIAN_ID);
      expect(earnings.paidTotal).toBe(750);
    });

    it('creates a payout summing eligible bookings and links them so they cannot be double-paid', async () => {
      qbGetManyResult = [makeBooking({ id: 'b1', technicianPayoutAmount: 850, commissionSettled: true, payoutId: null })];
      const payout = await service.createPayout(TECHNICIAN_ID, 'Paid via eSewa');
      expect(payout.totalAmount).toBe(850);
      expect(bookingRepo.update).toHaveBeenCalledWith({ id: expect.anything() }, { payoutId: 'payout-1' });
    });

    it('refuses to create a payout when nothing is owed', async () => {
      qbGetManyResult = [];
      await expect(service.createPayout(TECHNICIAN_ID)).rejects.toThrow(BadRequestException);
    });
  });
});
