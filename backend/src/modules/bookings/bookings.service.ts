import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ServicesService } from '../services/services.service';
import { UsersService } from '../users/users.service';
import { EmailService } from '../auth/email.service';
import { Booking, BookingStatus, PaymentMethod, PaymentStatus } from './entities/booking.entity';
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
  createdAt: string;
}

const PLUMBING_SERVICE_NAME = 'Plumbing';

@Injectable()
export class BookingsService {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly usersService: UsersService,
    private readonly emailService: EmailService,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
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
      createdAt: booking.createdAt.toISOString(),
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

    // Auto-assign plumbing jobs to an available technician (demo dispatch rule)
    let technician: User | null = null;
    if (item.category?.service?.name === PLUMBING_SERVICE_NAME) {
      technician = await this.userRepository.findOne({ where: { role: UserRole.TECHNICIAN } });
    }

    const booking = this.bookingRepository.create({
      bookingNumber: this.generateBookingNumber(),
      customerId: userId,
      technicianId: technician?.id ?? null,
      addressId: address.id,
      serviceItemId: item.id,
      status: technician ? BookingStatus.ASSIGNED : BookingStatus.PENDING,
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
        throw err;
      }
    }

    const fullBooking = {
      ...saved!,
      customer,
      technician,
      address,
      serviceItem: item,
    } as Booking;

    if (technician) {
      await this.notifyTechnicianAssigned(fullBooking, customer, technician);
    }

    return this.toDto(fullBooking);
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
<title>Invoice ${dto.bookingNumber} — ServeNep</title>
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

    <h1>Invoice ${dto.bookingNumber}</h1>
    <div class="meta">
      <span>Issued ${issuedAt}</span>
      <span class="status">${dto.status.replace('_', ' ')}</span>
    </div>

    <table>
      <tr><td class="label">Customer</td><td class="value">${dto.customerName}</td></tr>
      <tr><td class="label">Phone</td><td class="value">${dto.customerPhone}</td></tr>
      <tr><td class="label">Service</td><td class="value">${dto.itemName}</td></tr>
      <tr><td class="label">Technician</td><td class="value">${dto.technicianName ?? 'Not yet assigned'}</td></tr>
      <tr><td class="label">Address</td><td class="value">${dto.addressText}</td></tr>
      <tr><td class="label">Scheduled</td><td class="value">${dto.scheduledDate}, ${dto.scheduledTimeSlot}</td></tr>
      <tr><td class="label">Payment Method</td><td class="value">${dto.paymentMethod}</td></tr>
      <tr><td class="label">Payment Status</td><td class="value">${dto.paymentStatus}</td></tr>
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
    booking.status = status;
    if (status === BookingStatus.COMPLETED && imagesAfter) {
      booking.imagesAfter = imagesAfter;
    }
    await this.bookingRepository.save(booking);
    return this.toDto(booking);
  }

  async updatePaymentStatus(id: string, paymentStatus: PaymentStatus): Promise<BookingDto> {
    const booking = await this.loadWithRelations(id);
    booking.paymentStatus = paymentStatus;
    await this.bookingRepository.save(booking);
    return this.toDto(booking);
  }

  async assignTechnician(id: string, technicianId: string): Promise<BookingDto> {
    const booking = await this.loadWithRelations(id);
    const technician = await this.userRepository.findOne({
      where: { id: technicianId, role: UserRole.TECHNICIAN },
    });
    if (!technician) throw new BadRequestException('Technician not found');

    booking.status = BookingStatus.ASSIGNED;
    booking.technicianId = technician.id;
    booking.technician = technician;
    await this.bookingRepository.save(booking);

    if (booking.customer) {
      await this.notifyTechnicianAssigned(booking, booking.customer, technician);
    }

    return this.toDto(booking);
  }
}
