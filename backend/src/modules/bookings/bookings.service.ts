import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, IsNull, Not } from 'typeorm';
import { ServicesService } from '../services/services.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../auth/email.service';
import { Booking, BookingStatus, PaymentMethod, PaymentStatus } from './entities/booking.entity';
import { PriceRevision, RevisionStatus } from './entities/price-revision.entity';
import { JobOffer, JobOfferStatus } from './entities/job-offer.entity';
import { TechnicianPayout } from '../payments/entities/technician-payout.entity';
import { User, UserRole } from '../users/entities/user.entity';
import { TechnicianProfile } from '../users/entities/technician-profile.entity';
import { UserPayload } from '../../common/decorators/user.decorator';

export interface BookingDto {
  id: string;
  bookingNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  technicianId: string | null;
  technicianName: string | null;
  addressText: string;
  city: string;
  itemId: string;
  itemName: string;
  status: BookingStatus;
  scheduledDate: string;
  scheduledTimeSlot: string;
  baseAmount: number;
  serviceFee: number;
  emergencySurcharge: number;
  totalAmount: number;
  imagesBefore: string[];
  imagesAfter: string[];
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethod;
  commissionAmount: number | null;
  technicianPayoutAmount: number | null;
  commissionSettled: boolean;
  commissionReference: string | null;
  payoutId: string | null;
  createdAt: string;
}

export interface PriceRevisionDto {
  id: string;
  bookingId: string;
  previousAmount: number;
  requestedAmount: number;
  reason: string;
  status: RevisionStatus;
  createdAt: string;
  respondedAt: string | null;
}

export interface JobOfferDto {
  id: string;
  bookingId: string;
  bookingNumber: string;
  itemName: string;
  city: string;
  addressText: string;
  scheduledDate: string;
  scheduledTimeSlot: string;
  totalAmount: number;
  distanceKm: number;
  isEmergency: boolean;
  createdAt: string;
}

// How many nearby, available, specialty-matched technicians a new booking
// is broadcast to at once — like requesting a ride, not like calling one
// specific plumber. Whoever accepts first gets it (see acceptOffer).
const DISPATCH_BROADCAST_COUNT = 5;

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 + Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// The company's cut of every completed job's base amount. Applied uniformly
// regardless of payment method — the service fee and emergency surcharge
// are already 100% the company's, this is the additional slice of the job
// value itself. See PaymentsService/BookingsService for how it's collected:
// automatically for ESEWA/KHALTI (money already lands on the company's
// number), only after admin-verified remittance for CASH.
export const COMMISSION_RATE = 0.15;

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Explicit state machine — without this, any assigned technician or staff
// member could move a booking to any status at all, including reverting a
// COMPLETED job back to ASSIGNED/IN_PROGRESS to request a new price
// revision and re-complete it, silently overwriting the commission/payout
// amounts that were already locked in (and possibly already paid out).
const ALLOWED_STATUS_TRANSITIONS: Record<BookingStatus, BookingStatus[]> = {
  [BookingStatus.PENDING]: [BookingStatus.ASSIGNED, BookingStatus.CANCELLED],
  [BookingStatus.ASSIGNED]: [BookingStatus.IN_PROGRESS, BookingStatus.CANCELLED],
  [BookingStatus.IN_PROGRESS]: [BookingStatus.COMPLETED, BookingStatus.CANCELLED],
  [BookingStatus.COMPLETED]: [],
  [BookingStatus.CANCELLED]: [],
};

// A technician can request at most this many revisions on a single
// booking — otherwise reject→resubmit could cycle indefinitely as a
// pressure tactic against the customer.
const MAX_PRICE_REVISIONS_PER_BOOKING = 3;

@Injectable()
export class BookingsService {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(PriceRevision)
    private readonly priceRevisionRepository: Repository<PriceRevision>,
    @InjectRepository(JobOffer)
    private readonly jobOfferRepository: Repository<JobOffer>,
    @InjectRepository(TechnicianPayout)
    private readonly technicianPayoutRepository: Repository<TechnicianPayout>,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(TechnicianProfile)
    private readonly technicianProfileRepository: Repository<TechnicianProfile>,
  ) {}

  private checkBookingAccess(booking: Booking, requester: { sub: string; role: string }): void {
    const isOwner = booking.customerId === requester.sub || booking.technicianId === requester.sub;
    const isStaff = requester.role === 'ADMIN' || requester.role === 'DISPATCHER';
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You do not have access to this booking');
    }
  }

  private async notifyTechnicianAssigned(booking: Booking, customer: User, technician: User): Promise<void> {
    if (!this.emailService.isConfigured() || !customer.email) return;
    await this.emailService.sendBookingAssignedEmail(customer.email, {
      customerName: customer.fullName,
      technicianName: technician.fullName,
      bookingNumber: booking.bookingNumber,
      scheduledDate: booking.scheduledDate,
      scheduledTimeSlot: booking.scheduledTimeSlot,
    });
  }

  private toDto(booking: Booking): BookingDto {
    return {
      id: booking.id,
      bookingNumber: booking.bookingNumber,
      customerId: booking.customerId,
      customerName: booking.customer?.fullName ?? 'Unknown Customer',
      customerPhone: booking.customer?.phoneNumber ?? '',
      technicianId: booking.technicianId,
      technicianName: booking.technician?.fullName ?? null,
      addressText: booking.address ? `${booking.address.street}, ${booking.address.city}` : '',
      city: booking.address?.city ?? '',
      itemId: booking.serviceItemId,
      itemName: booking.serviceItem?.name ?? '',
      status: booking.status,
      scheduledDate: booking.scheduledDate,
      scheduledTimeSlot: booking.scheduledTimeSlot,
      baseAmount: booking.baseAmount,
      serviceFee: booking.serviceFee,
      emergencySurcharge: booking.emergencySurcharge,
      totalAmount: booking.totalAmount,
      imagesBefore: booking.imagesBefore,
      imagesAfter: booking.imagesAfter,
      paymentStatus: booking.paymentStatus,
      paymentMethod: booking.paymentMethod,
      commissionAmount: booking.commissionAmount,
      technicianPayoutAmount: booking.technicianPayoutAmount,
      commissionSettled: booking.commissionSettled,
      commissionReference: booking.commissionReference,
      payoutId: booking.payoutId,
      createdAt: booking.createdAt.toISOString(),
    };
  }

  private toPriceRevisionDto(revision: PriceRevision): PriceRevisionDto {
    return {
      id: revision.id,
      bookingId: revision.bookingId,
      previousAmount: revision.previousAmount,
      requestedAmount: revision.requestedAmount,
      reason: revision.reason,
      status: revision.status,
      createdAt: revision.createdAt.toISOString(),
      respondedAt: revision.respondedAt ? revision.respondedAt.toISOString() : null,
    };
  }

  private async loadWithRelations(id: string): Promise<Booking> {
    const booking = await this.bookingRepository.findOne({
      where: { id },
      relations: { customer: true, technician: true, address: true, serviceItem: true },
    });
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  private generateBookingNumber(): string {
    const year = new Date().getFullYear();
    const suffix = Math.floor(1000 + Math.random() * 9000);
    return `SN-${year}-${suffix}`;
  }

  async createBooking(
    userId: string,
    data: {
      itemId: string;
      addressId: string;
      scheduledDate: string;
      scheduledTimeSlot: string;
      isEmergency: boolean;
      paymentMethod: PaymentMethod;
      images?: string[];
    },
  ): Promise<BookingDto> {
    const item = await this.servicesService.findItemById(data.itemId);
    if (!item) throw new NotFoundException('Service item not found');

    const address = await this.usersService.findAddressById(userId, data.addressId);
    if (!address) throw new BadRequestException('Invalid address ID selected');

    const customer = await this.userRepository.findOne({ where: { id: userId } });
    if (!customer) throw new NotFoundException('Customer profile not found');

    const baseAmount = item.basePrice;
    const serviceFee = 50;
    const emergencySurcharge = data.isEmergency ? 300 : 0;
    const totalAmount = baseAmount + serviceFee + emergencySurcharge;

    const booking = this.bookingRepository.create({
      bookingNumber: this.generateBookingNumber(),
      customerId: userId,
      technicianId: null,
      addressId: address.id,
      serviceItemId: item.id,
      status: BookingStatus.PENDING,
      scheduledDate: data.scheduledDate,
      scheduledTimeSlot: data.scheduledTimeSlot,
      baseAmount,
      serviceFee,
      emergencySurcharge,
      totalAmount,
      imagesBefore: data.images || [],
      imagesAfter: [],
      paymentStatus: PaymentStatus.PENDING,
      paymentMethod: data.paymentMethod,
    });

    let saved: Booking | undefined;
    for (let attempt = 0; attempt < 5 && !saved; attempt++) {
      try {
        saved = await this.bookingRepository.save(booking);
      } catch (err: any) {
        if (err?.code === '23505' && attempt < 4) {
          booking.bookingNumber = this.generateBookingNumber();
          continue;
        }
        if (err?.code === '23505') {
          throw new BadRequestException('Could not generate a unique booking number — please try again.');
        }
        throw err;
      }
    }

    const fullBooking = {
      ...saved!,
      customer,
      technician: null,
      address,
      serviceItem: item,
    } as Booking;

    // Broadcast to nearby, available, specialty-matched technicians — like
    // requesting a ride, not directly assigning one. Best-effort: if
    // nothing matches (no technician nearby covers this service, or none
    // are available), the booking just stays PENDING for admin's manual
    // dispatch fallback rather than failing the booking itself.
    await this.broadcastToNearbyTechnicians(fullBooking, item.category?.service?.name);

    return this.toDto(fullBooking);
  }

  // ─── Ride-share style dispatch: broadcast, accept, decline ──────────────

  private async broadcastToNearbyTechnicians(booking: Booking, serviceName: string | undefined): Promise<void> {
    if (!serviceName || booking.address.lat == null || booking.address.lng == null) return;

    const candidates = await this.technicianProfileRepository
      .createQueryBuilder('profile')
      .innerJoin(User, 'user', 'user.id = profile.userId')
      .where('user.role = :role', { role: UserRole.TECHNICIAN })
      .andWhere('profile.isAvailable = true')
      .andWhere(':serviceName = ANY(profile.specialties)', { serviceName })
      .andWhere('profile.latitude IS NOT NULL')
      .andWhere('profile.longitude IS NOT NULL')
      .getMany();

    const inRange = candidates
      .map((p) => ({
        profile: p,
        distanceKm: haversineKm(booking.address.lat, booking.address.lng, p.latitude!, p.longitude!),
      }))
      .filter((c) => c.distanceKm <= c.profile.serviceRadiusKm)
      .sort((a, b) => a.distanceKm - b.distanceKm)
      .slice(0, DISPATCH_BROADCAST_COUNT);

    if (inRange.length === 0) return;

    await this.jobOfferRepository.save(
      inRange.map((c) =>
        this.jobOfferRepository.create({
          bookingId: booking.id,
          technicianId: c.profile.userId,
          status: JobOfferStatus.PENDING,
          distanceKm: round2(c.distanceKm),
        }),
      ),
    );
  }

  async getMyOffers(technicianId: string): Promise<JobOfferDto[]> {
    const offers = await this.jobOfferRepository.find({
      where: { technicianId, status: JobOfferStatus.PENDING },
      order: { distanceKm: 'ASC' },
    });
    if (offers.length === 0) return [];

    const bookings = await this.bookingRepository.find({
      where: { id: In(offers.map((o) => o.bookingId)) },
      relations: { address: true, serviceItem: true },
    });
    const byId = new Map(bookings.map((b) => [b.id, b]));

    return offers
      .filter((o) => byId.has(o.bookingId) && byId.get(o.bookingId)!.status === BookingStatus.PENDING)
      .map((o) => {
        const b = byId.get(o.bookingId)!;
        return {
          id: o.id,
          bookingId: b.id,
          bookingNumber: b.bookingNumber,
          itemName: b.serviceItem?.name ?? '',
          city: b.address?.city ?? '',
          addressText: b.address ? `${b.address.street}, ${b.address.city}` : '',
          scheduledDate: b.scheduledDate,
          scheduledTimeSlot: b.scheduledTimeSlot,
          totalAmount: b.totalAmount,
          distanceKm: o.distanceKm,
          isEmergency: b.emergencySurcharge > 0,
          createdAt: o.createdAt.toISOString(),
        };
      });
  }

  // First technician to accept wins — everything here runs inside a
  // transaction with a row lock on the booking, so two technicians racing
  // to accept the same offer can never both succeed. The loser gets a
  // clear "already taken" error instead of silently overwriting the winner.
  async acceptOffer(offerId: string, technicianId: string): Promise<BookingDto> {
    const assignedBooking = await this.bookingRepository.manager.transaction(async (manager) => {
      const offerRepo = manager.getRepository(JobOffer);
      const offer = await offerRepo.findOne({ where: { id: offerId } });
      if (!offer || offer.technicianId !== technicianId) {
        throw new NotFoundException('Job offer not found');
      }
      if (offer.status !== JobOfferStatus.PENDING) {
        throw new BadRequestException('This offer is no longer available');
      }

      const booking = await manager
        .createQueryBuilder(Booking, 'booking')
        .setLock('pessimistic_write')
        .where('booking.id = :id', { id: offer.bookingId })
        .getOne();
      if (!booking) throw new NotFoundException('Booking not found');

      if (booking.technicianId) {
        offer.status = JobOfferStatus.EXPIRED;
        offer.respondedAt = new Date();
        await offerRepo.save(offer);
        throw new BadRequestException('This job was already taken by another technician');
      }
      if (booking.status !== BookingStatus.PENDING) {
        throw new BadRequestException('This booking is no longer available');
      }

      booking.technicianId = technicianId;
      booking.status = BookingStatus.ASSIGNED;
      await manager.getRepository(Booking).save(booking);

      offer.status = JobOfferStatus.ACCEPTED;
      offer.respondedAt = new Date();
      await offerRepo.save(offer);

      // Every other technician who was offered this job no longer has a
      // shot at it — reflect that immediately rather than leaving stale
      // PENDING offers they'd only discover were dead by trying to accept.
      await offerRepo.update(
        { bookingId: offer.bookingId, status: JobOfferStatus.PENDING },
        { status: JobOfferStatus.EXPIRED, respondedAt: new Date() },
      );

      // Reload with relations through the SAME transactional manager, not
      // this.loadWithRelations (which queries via the outer, non-transactional
      // repository) — reading through a different connection here would see
      // the pre-update row, since this transaction hasn't committed yet.
      return manager.getRepository(Booking).findOne({
        where: { id: booking.id },
        relations: { customer: true, technician: true, address: true, serviceItem: true },
      });
    });

    if (!assignedBooking) throw new NotFoundException('Booking not found');

    // Outside the transaction, now committed — no reason to hold the row
    // lock open for an external network call to Brevo.
    if (assignedBooking.customer && assignedBooking.technician) {
      await this.notifyTechnicianAssigned(assignedBooking, assignedBooking.customer, assignedBooking.technician);
    }
    return this.toDto(assignedBooking);
  }

  async declineOffer(offerId: string, technicianId: string): Promise<void> {
    const offer = await this.jobOfferRepository.findOne({ where: { id: offerId } });
    if (!offer || offer.technicianId !== technicianId) {
      throw new NotFoundException('Job offer not found');
    }
    if (offer.status !== JobOfferStatus.PENDING) {
      return; // already resolved one way or another — nothing to do
    }
    offer.status = JobOfferStatus.DECLINED;
    offer.respondedAt = new Date();
    await this.jobOfferRepository.save(offer);
  }

  async findAll(userId: string, role: string): Promise<BookingDto[]> {
    const where =
      role === 'ADMIN' || role === 'DISPATCHER'
        ? {}
        : role === 'TECHNICIAN'
          ? { technicianId: userId }
          : { customerId: userId };

    const bookings = await this.bookingRepository.find({
      where,
      relations: { customer: true, technician: true, address: true, serviceItem: true },
      order: { createdAt: 'DESC' },
    });
    return bookings.map((b) => this.toDto(b));
  }

  // Unauthenticated lookup for internal use by other services (payments,
  // reviews) that already enforce their own ownership checks against the
  // booking they fetch — see findByIdForUser for the customer-facing route.
  async findById(id: string): Promise<BookingDto> {
    return this.toDto(await this.loadWithRelations(id));
  }

  async findByIdForUser(id: string, requester: { sub: string; role: string }): Promise<BookingDto> {
    const booking = await this.loadWithRelations(id);
    this.checkBookingAccess(booking, requester);
    return this.toDto(booking);
  }

  async getTechnicianLocation(
    id: string,
    requester: { sub: string; role: string },
  ): Promise<{ lat: number; lng: number; updatedAt: string } | null> {
    const booking = await this.loadWithRelations(id);
    this.checkBookingAccess(booking, requester);

    const isTrackable =
      (booking.status === BookingStatus.ASSIGNED || booking.status === BookingStatus.IN_PROGRESS) &&
      !!booking.technicianId;
    if (!isTrackable) return null;

    const profile = await this.technicianProfileRepository.findOne({ where: { userId: booking.technicianId! } });
    if (!profile || profile.latitude == null || profile.longitude == null || !profile.locationUpdatedAt) {
      return null;
    }

    return {
      lat: profile.latitude,
      lng: profile.longitude,
      updatedAt: profile.locationUpdatedAt.toISOString(),
    };
  }

  async getInvoiceHtml(id: string, requester: { sub: string; role: string }): Promise<string> {
    const booking = await this.loadWithRelations(id);
    this.checkBookingAccess(booking, requester);

    const dto = this.toDto(booking);
    const issuedAt = new Date(dto.createdAt).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });

    return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>Invoice ${escapeHtml(dto.bookingNumber)} — ServeNep</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: 'Segoe UI', Arial, sans-serif; background: #f8fafc; color: #1e293b; margin: 0; padding: 40px 20px; }
  .sheet { max-width: 640px; margin: 0 auto; background: #fff; border-radius: 16px; padding: 40px; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
  .brand { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
  .brand-badge { background: #0B3C5D; color: #fff; font-weight: 900; font-size: 13px; padding: 8px 10px; border-radius: 8px; }
  .brand-name { font-weight: 800; font-size: 20px; color: #0B3C5D; }
  .subtitle { color: #64748b; font-size: 13px; margin-bottom: 28px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { display: flex; justify-content: space-between; font-size: 13px; color: #475569; margin-bottom: 28px; border-bottom: 1px solid #e2e8f0; padding-bottom: 20px; }
  .status { display: inline-block; padding: 3px 10px; border-radius: 999px; font-size: 11px; font-weight: 700; text-transform: uppercase; background: #ecfdf5; color: #059669; }
  table { width: 100%; border-collapse: collapse; font-size: 13px; margin-bottom: 24px; }
  td { padding: 10px 0; border-bottom: 1px solid #f1f5f9; }
  td.label { color: #64748b; }
  td.value { text-align: right; font-weight: 600; }
  .total-row td { border-top: 2px solid #1e293b; border-bottom: none; font-size: 16px; font-weight: 800; padding-top: 16px; color: #0B3C5D; }
  .actions { text-align: center; margin-top: 24px; }
  .print-btn { background: #328CC1; color: #fff; border: none; padding: 10px 22px; border-radius: 10px; font-size: 13px; font-weight: 700; cursor: pointer; }
  .footer { text-align: center; color: #94a3b8; font-size: 11px; margin-top: 24px; }
  @media print { body { background: #fff; padding: 0; } .sheet { box-shadow: none; border-radius: 0; } .actions { display: none; } }
</style>
</head>
<body>
  <div class="sheet">
    <div class="brand">
      <span class="brand-badge">SN</span>
      <span class="brand-name">ServeNep</span>
    </div>
    <p class="subtitle">On-demand home services marketplace — Kathmandu Valley</p>

    <h1>Invoice ${escapeHtml(dto.bookingNumber)}</h1>
    <div class="meta">
      <span>Issued ${escapeHtml(issuedAt)}</span>
      <span class="status">${escapeHtml(dto.status.replace('_', ' '))}</span>
    </div>

    <table>
      <tr><td class="label">Customer</td><td class="value">${escapeHtml(dto.customerName)}</td></tr>
      <tr><td class="label">Phone</td><td class="value">${escapeHtml(dto.customerPhone)}</td></tr>
      <tr><td class="label">Service</td><td class="value">${escapeHtml(dto.itemName)}</td></tr>
      <tr><td class="label">Technician</td><td class="value">${dto.technicianName ? escapeHtml(dto.technicianName) : 'Not yet assigned'}</td></tr>
      <tr><td class="label">Address</td><td class="value">${escapeHtml(dto.addressText)}</td></tr>
      <tr><td class="label">Scheduled</td><td class="value">${escapeHtml(dto.scheduledDate)}, ${escapeHtml(dto.scheduledTimeSlot)}</td></tr>
      <tr><td class="label">Payment Method</td><td class="value">${escapeHtml(dto.paymentMethod)}</td></tr>
      <tr><td class="label">Payment Status</td><td class="value">${escapeHtml(dto.paymentStatus)}</td></tr>
    </table>

    <table>
      <tr><td class="label">Base Charge</td><td class="value">Rs. ${dto.baseAmount.toFixed(2)}</td></tr>
      <tr><td class="label">Service Fee</td><td class="value">Rs. ${dto.serviceFee.toFixed(2)}</td></tr>
      ${dto.emergencySurcharge > 0 ? `<tr><td class="label">Emergency Surcharge</td><td class="value">Rs. ${dto.emergencySurcharge.toFixed(2)}</td></tr>` : ''}
      <tr class="total-row"><td>Total</td><td class="value">Rs. ${dto.totalAmount.toFixed(2)}</td></tr>
    </table>

    <div class="actions">
      <button class="print-btn" onclick="window.print()">Print / Save as PDF</button>
    </div>

    <p class="footer">Thank you for booking with ServeNep. This is a system-generated invoice.</p>
  </div>
</body>
</html>`;
  }

  async findIdsByTechnician(technicianId: string): Promise<string[]> {
    const bookings = await this.bookingRepository.find({
      where: { technicianId },
      select: { id: true },
    });
    return bookings.map((b) => b.id);
  }

  async updateStatus(
    id: string,
    status: BookingStatus,
    imagesAfter: string[] | undefined,
    requester: { sub: string; role: string },
  ): Promise<BookingDto> {
    const booking = await this.loadWithRelations(id);
    const isAssignedTechnician = requester.role === 'TECHNICIAN' && booking.technicianId === requester.sub;
    const isStaff = requester.role === 'ADMIN' || requester.role === 'DISPATCHER';
    if (!isAssignedTechnician && !isStaff) {
      throw new ForbiddenException('You are not assigned to this booking');
    }

    if (!ALLOWED_STATUS_TRANSITIONS[booking.status].includes(status)) {
      throw new BadRequestException(`Cannot move a ${booking.status} booking to ${status}`);
    }

    if (status === BookingStatus.COMPLETED) {
      const pendingRevision = await this.priceRevisionRepository.findOne({
        where: { bookingId: id, status: RevisionStatus.PENDING },
      });
      if (pendingRevision) {
        throw new BadRequestException('Resolve the pending price change before marking this job complete');
      }

      // Locked in now, from whatever baseAmount stands at this moment (i.e.
      // reflecting any approved PriceRevision) — this is what the technician
      // is owed and what the company's commission is calculated from.
      booking.commissionAmount = round2(booking.baseAmount * COMMISSION_RATE);
      booking.technicianPayoutAmount = round2(booking.baseAmount - booking.commissionAmount);

      // Cash is handed over in person at completion, so the customer's
      // payment is done — but that's separate from whether the company's
      // commission has actually been collected (commissionSettled), which
      // for cash requires a remittance the technician hasn't made yet.
      if (booking.paymentMethod === PaymentMethod.CASH) {
        booking.paymentStatus = PaymentStatus.PAID;
      }

      if (imagesAfter) {
        booking.imagesAfter = imagesAfter;
      }
    }

    booking.status = status;
    await this.bookingRepository.save(booking);
    return this.toDto(booking);
  }

  // ─── Price revisions — technician-proposed, customer-approved ───────────

  async requestPriceRevision(
    bookingId: string,
    technicianId: string,
    requestedAmount: number,
    reason: string,
  ): Promise<PriceRevisionDto> {
    if (!Number.isFinite(requestedAmount) || requestedAmount <= 0) {
      throw new BadRequestException('Enter a valid revised amount');
    }
    if (!reason || reason.trim().length < 4) {
      throw new BadRequestException('Explain why the price is changing — this is what the customer sees before approving');
    }

    // A row lock on the booking for the duration of this transaction is
    // what actually prevents two concurrent requests (e.g. two open tabs)
    // from both passing the "no pending revision" check and both inserting
    // a PENDING row — the second call blocks here until the first commits.
    return this.bookingRepository.manager.transaction(async (manager) => {
      const booking = await manager
        .createQueryBuilder(Booking, 'booking')
        .setLock('pessimistic_write')
        .where('booking.id = :bookingId', { bookingId })
        .getOne();
      if (!booking) throw new NotFoundException('Booking not found');
      if (booking.technicianId !== technicianId) {
        throw new ForbiddenException('You are not assigned to this booking');
      }
      if (booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.CANCELLED) {
        throw new BadRequestException('This booking is already finished');
      }

      // A generous but bounded range — real repair jobs can legitimately
      // turn out much cheaper or more expensive than first estimated, but
      // an unbounded revision is exactly the kind of number a customer
      // might approve without scrutiny (or a fat-fingered/malicious one).
      const minAllowed = booking.baseAmount * 0.1;
      const maxAllowed = Math.min(booking.baseAmount * 5, 500000);
      if (requestedAmount < minAllowed || requestedAmount > maxAllowed) {
        throw new BadRequestException(
          `Revised amount must be between Rs. ${round2(minAllowed)} and Rs. ${round2(maxAllowed)} for this booking`,
        );
      }

      const revisionRepo = manager.getRepository(PriceRevision);

      const existingPending = await revisionRepo.findOne({ where: { bookingId, status: RevisionStatus.PENDING } });
      if (existingPending) {
        throw new BadRequestException('A price change is already awaiting customer approval for this booking');
      }

      const totalRequested = await revisionRepo.count({ where: { bookingId } });
      if (totalRequested >= MAX_PRICE_REVISIONS_PER_BOOKING) {
        throw new BadRequestException('Too many price changes requested for this booking — contact support to proceed.');
      }

      const revision = await revisionRepo.save(
        revisionRepo.create({
          bookingId,
          previousAmount: booking.baseAmount,
          requestedAmount: round2(requestedAmount),
          reason: reason.trim(),
          status: RevisionStatus.PENDING,
        }),
      );
      return this.toPriceRevisionDto(revision);
    });
  }

  async getPriceRevisions(bookingId: string, requester: { sub: string; role: string }): Promise<PriceRevisionDto[]> {
    const booking = await this.loadWithRelations(bookingId);
    this.checkBookingAccess(booking, requester);
    const revisions = await this.priceRevisionRepository.find({ where: { bookingId }, order: { createdAt: 'DESC' } });
    return revisions.map((r) => this.toPriceRevisionDto(r));
  }

  async respondToPriceRevision(
    bookingId: string,
    revisionId: string,
    customerId: string,
    approved: boolean,
  ): Promise<BookingDto> {
    const booking = await this.loadWithRelations(bookingId);
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only respond to price changes on your own booking');
    }
    const revision = await this.priceRevisionRepository.findOne({ where: { id: revisionId, bookingId } });
    if (!revision) throw new NotFoundException('Price revision not found');
    if (revision.status !== RevisionStatus.PENDING) {
      throw new BadRequestException('This price change has already been responded to');
    }

    revision.status = approved ? RevisionStatus.APPROVED : RevisionStatus.REJECTED;
    revision.respondedAt = new Date();
    await this.priceRevisionRepository.save(revision);

    if (approved) {
      booking.baseAmount = revision.requestedAmount;
      booking.totalAmount = booking.baseAmount + booking.serviceFee + booking.emergencySurcharge;
      await this.bookingRepository.save(booking);
    }

    return this.toDto(booking);
  }

  // ─── Commission settlement (cash jobs) & technician payouts ─────────────

  // Called once the company is confirmed to have actually received a
  // booking's commission — for ESEWA/KHALTI this is when PaymentsService
  // verifies the customer's manual transfer arrived (the whole amount,
  // company cut included, lands on the company's number at once).
  async markCommissionSettled(bookingId: string): Promise<void> {
    await this.bookingRepository.update({ id: bookingId }, { commissionSettled: true });
  }

  async claimCommissionRemittance(bookingId: string, technicianId: string, reference: string): Promise<void> {
    const booking = await this.loadWithRelations(bookingId);
    if (booking.technicianId !== technicianId) {
      throw new ForbiddenException('You are not assigned to this booking');
    }
    if (booking.paymentMethod !== PaymentMethod.CASH) {
      throw new BadRequestException('Only cash jobs need a commission remittance — digital payments settle automatically');
    }
    if (booking.status !== BookingStatus.COMPLETED) {
      throw new BadRequestException('This job is not marked complete yet');
    }
    if (booking.commissionSettled) {
      throw new BadRequestException('Commission for this booking is already settled');
    }
    const trimmedReference = (reference || '').trim();
    if (trimmedReference.length < 4) {
      throw new BadRequestException('Enter the transaction ID from your commission payment so it can be verified');
    }

    // The same transaction ID can't back "proof" of commission payment on
    // more than one booking.
    const reusedElsewhere = await this.bookingRepository.findOne({
      where: { commissionReference: trimmedReference, id: Not(bookingId) },
    });
    if (reusedElsewhere) {
      throw new BadRequestException('This transaction ID has already been used as proof on a different booking');
    }

    booking.commissionReference = trimmedReference;
    await this.bookingRepository.save(booking);
  }

  async verifyCommissionRemittance(bookingId: string, approved: boolean): Promise<void> {
    const booking = await this.loadWithRelations(bookingId);
    if (booking.commissionSettled) {
      throw new BadRequestException('Commission for this booking is already settled');
    }
    if (!booking.commissionReference) {
      throw new BadRequestException('No commission remittance claim found for this booking');
    }
    if (approved) {
      booking.commissionSettled = true;
    } else {
      // Rejected — clear the claim so the technician can resubmit with a
      // correct reference, rather than leaving a dead claim in place.
      booking.commissionReference = null;
    }
    await this.bookingRepository.save(booking);
  }

  // Bookings that are done, whose commission is confirmed collected, and
  // that haven't been included in a payout yet — this is what a technician
  // is actually owed right now.
  private async findUnpaidEarnings(technicianId: string): Promise<Booking[]> {
    return this.bookingRepository.find({
      where: {
        technicianId,
        status: BookingStatus.COMPLETED,
        commissionSettled: true,
        payoutId: IsNull(),
      },
      order: { createdAt: 'ASC' },
    });
  }

  async getTechnicianEarnings(technicianId: string): Promise<{
    pendingBalance: number;
    pendingBookingCount: number;
    paidTotal: number;
    bookings: { id: string; bookingNumber: string; technicianPayoutAmount: number; completedAt: string }[];
  }> {
    const unpaid = await this.findUnpaidEarnings(technicianId);
    const paidOut = await this.technicianPayoutRepository.find({ where: { technicianId } });

    return {
      pendingBalance: round2(unpaid.reduce((sum, b) => sum + (b.technicianPayoutAmount ?? 0), 0)),
      pendingBookingCount: unpaid.length,
      paidTotal: round2(paidOut.reduce((sum, p) => sum + p.totalAmount, 0)),
      bookings: unpaid.map((b) => ({
        id: b.id,
        bookingNumber: b.bookingNumber,
        technicianPayoutAmount: b.technicianPayoutAmount ?? 0,
        completedAt: b.updatedAt.toISOString(),
      })),
    };
  }

  // Admin overview: every technician with money currently owed to them.
  async listPendingPayouts(): Promise<{ technicianId: string; technicianName: string; pendingBalance: number; bookingCount: number }[]> {
    const eligible = await this.bookingRepository.find({
      where: { status: BookingStatus.COMPLETED, commissionSettled: true, payoutId: IsNull() },
      relations: { technician: true },
    });

    const byTechnician = new Map<string, { technicianName: string; pendingBalance: number; bookingCount: number }>();
    for (const b of eligible) {
      if (!b.technicianId) continue;
      const entry = byTechnician.get(b.technicianId) ?? {
        technicianName: b.technician?.fullName ?? 'Unknown Technician',
        pendingBalance: 0,
        bookingCount: 0,
      };
      entry.pendingBalance = round2(entry.pendingBalance + (b.technicianPayoutAmount ?? 0));
      entry.bookingCount += 1;
      byTechnician.set(b.technicianId, entry);
    }

    return Array.from(byTechnician.entries()).map(([technicianId, v]) => ({ technicianId, ...v }));
  }

  // Records that a technician has actually been paid (outside the app) and
  // closes out every currently-eligible booking against that payout, so
  // they can never be double-counted in a future payout.
  //
  // Runs inside a transaction with a row lock on the eligible bookings —
  // without it, two concurrent payout requests (a double-click, or two
  // admins) can both read the same "unpaid" set before either writes
  // payoutId, and both create a TechnicianPayout record for the same
  // money. The lock makes the second call wait for the first to commit,
  // then see nothing left to pay out.
  async createPayout(technicianId: string, notes?: string): Promise<{ id: string; totalAmount: number; bookingCount: number }> {
    return this.bookingRepository.manager.transaction(async (manager) => {
      const unpaid = await manager
        .createQueryBuilder(Booking, 'booking')
        .setLock('pessimistic_write')
        .where('booking.technicianId = :technicianId', { technicianId })
        .andWhere('booking.status = :status', { status: BookingStatus.COMPLETED })
        .andWhere('booking.commissionSettled = true')
        .andWhere('booking.payoutId IS NULL')
        .getMany();

      if (unpaid.length === 0) {
        throw new BadRequestException('This technician has no pending earnings to pay out');
      }

      const totalAmount = round2(unpaid.reduce((sum, b) => sum + (b.technicianPayoutAmount ?? 0), 0));
      const payoutRepo = manager.getRepository(TechnicianPayout);
      const payout = await payoutRepo.save(
        payoutRepo.create({
          technicianId,
          totalAmount,
          bookingCount: unpaid.length,
          notes: notes?.trim() || null,
        }),
      );

      await manager.getRepository(Booking).update({ id: In(unpaid.map((b) => b.id)) }, { payoutId: payout.id });

      return { id: payout.id, totalAmount: payout.totalAmount, bookingCount: payout.bookingCount };
    });
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<BookingDto> {
    const booking = await this.loadWithRelations(id);
    booking.paymentStatus = paymentStatus;
    await this.bookingRepository.save(booking);
    return this.toDto(booking);
  }

  async assignTechnician(id: string, technicianId: string): Promise<BookingDto> {
    const booking = await this.loadWithRelations(id);
    if (booking.status === BookingStatus.COMPLETED || booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException(`Cannot assign a technician to a ${booking.status} booking`);
    }
    const technician = await this.userRepository.findOne({
      where: { id: technicianId, role: UserRole.TECHNICIAN },
    });
    if (!technician) throw new BadRequestException('Technician not found');

    booking.status = BookingStatus.ASSIGNED;
    booking.technicianId = technician.id;
    booking.technician = technician;
    await this.bookingRepository.save(booking);

    // A manual admin assignment takes priority over the broadcast — any
    // technician who was offered this job and hasn't responded yet would
    // otherwise be able to "accept" a booking someone else was already
    // manually given.
    await this.jobOfferRepository.update(
      { bookingId: booking.id, status: JobOfferStatus.PENDING },
      { status: JobOfferStatus.EXPIRED, respondedAt: new Date() },
    );

    if (booking.customer) {
      await this.notifyTechnicianAssigned(booking, booking.customer, technician);
    }

    return this.toDto(booking);
  }
}
