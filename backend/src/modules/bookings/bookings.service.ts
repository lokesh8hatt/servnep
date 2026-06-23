import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { ServicesService } from '../services/services.service';
import { UsersService } from '../users/users.service';
import { AuthService } from '../auth/auth.service';

export interface Booking {
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
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
  scheduledDate: string;
  scheduledTimeSlot: string;
  baseAmount: number;
  serviceFee: number;
  emergencySurcharge: number;
  totalAmount: number;
  imagesBefore: string[];
  imagesAfter: string[];
  paymentStatus: 'PENDING' | 'PAID' | 'FAILED' | 'REFUNDED';
  paymentMethod: 'ESEWA' | 'KHALTI' | 'CASH';
  createdAt: string;
}

@Injectable()
export class BookingsService {
  constructor(
    private readonly servicesService: ServicesService,
    private readonly usersService: UsersService,
    private readonly authService: AuthService,
  ) {
    this.bookings.push({
      id: 'b-1',
      bookingNumber: 'SN-2026-0001',
      customerId: 'cust-uuid-1',
      customerName: 'Sabin Shrestha',
      customerPhone: '9841234567',
      technicianId: 'tech-uuid-1',
      technicianName: 'Ramesh Mali (Plumber)',
      addressText: 'Lazimpat Rd, Ward 2, Kathmandu',
      city: 'Kathmandu',
      itemId: 'i1',
      itemName: 'Tap Repair/Replacement',
      status: 'ASSIGNED',
      scheduledDate: '2026-06-23',
      scheduledTimeSlot: '11:00 AM - 01:00 PM',
      baseAmount: 350,
      serviceFee: 50,
      emergencySurcharge: 0,
      totalAmount: 400,
      imagesBefore: [],
      imagesAfter: [],
      paymentStatus: 'PENDING',
      paymentMethod: 'CASH',
      createdAt: new Date().toISOString(),
    });

    this.bookings.push({
      id: 'b-2',
      bookingNumber: 'SN-2026-0002',
      customerId: 'cust-uuid-1',
      customerName: 'Sabin Shrestha',
      customerPhone: '9841234567',
      technicianId: null,
      technicianName: null,
      addressText: 'Lazimpat Rd, Ward 2, Kathmandu',
      city: 'Kathmandu',
      itemId: 'i4',
      itemName: 'Underground Tank Cleaning (up to 5000L)',
      status: 'PENDING',
      scheduledDate: '2026-06-25',
      scheduledTimeSlot: '09:00 AM - 11:00 AM',
      baseAmount: 2500,
      serviceFee: 100,
      emergencySurcharge: 0,
      totalAmount: 2600,
      imagesBefore: [],
      imagesAfter: [],
      paymentStatus: 'PENDING',
      paymentMethod: 'ESEWA',
      createdAt: new Date().toISOString(),
    });
  }

  private bookings: Booking[] = [];

  createBooking(
    userId: string,
    data: {
      itemId: string;
      addressId: string;
      scheduledDate: string;
      scheduledTimeSlot: string;
      isEmergency: boolean;
      paymentMethod: 'ESEWA' | 'KHALTI' | 'CASH';
      images?: string[];
    },
  ): Booking {
    const item = this.servicesService.findItemById(data.itemId);
    if (!item) throw new NotFoundException('Service item not found');

    const addressList = this.usersService.getAddresses(userId);
    const address = addressList.find(a => a.id === data.addressId);
    if (!address) throw new BadRequestException('Invalid address ID selected');

    const userProfile = this.getUserProfile(userId);

    const baseAmount = item.basePrice;
    const serviceFee = 50;
    const emergencySurcharge = data.isEmergency ? 300 : 0;
    const totalAmount = baseAmount + serviceFee + emergencySurcharge;

    const bookingNum = `SN-2026-${Math.floor(1000 + Math.random() * 9000)}`;

    const newBooking: Booking = {
      id: `b-${Math.random().toString(36).substring(2, 11)}`,
      bookingNumber: bookingNum,
      customerId: userId,
      customerName: userProfile?.fullName || 'Anonymous Customer',
      customerPhone: userProfile?.phone || '9840000000',
      technicianId: null,
      technicianName: null,
      addressText: `${address.street}, ${address.city}`,
      city: address.city,
      itemId: item.id,
      itemName: item.name,
      status: 'PENDING',
      scheduledDate: data.scheduledDate,
      scheduledTimeSlot: data.scheduledTimeSlot,
      baseAmount,
      serviceFee,
      emergencySurcharge,
      totalAmount,
      imagesBefore: data.images || [],
      imagesAfter: [],
      paymentStatus: 'PENDING',
      paymentMethod: data.paymentMethod,
      createdAt: new Date().toISOString(),
    };

    // Auto-assign plumbing items to the plumber
    if (item.id === 'i1' || item.id === 'i2' || item.id === 'i3') {
      newBooking.status = 'ASSIGNED';
      newBooking.technicianId = 'tech-uuid-1';
      newBooking.technicianName = 'Ramesh Mali (Plumber)';
    }

    this.bookings.push(newBooking);
    return newBooking;
  }

  private getUserProfile(userId: string): { fullName: string; phone: string } | null {
    const registry = this.authService.getUserRegistry();
    const user = registry.find(u => u.id === userId);
    if (!user) return null;
    return { fullName: user.fullName, phone: user.phone };
  }

  findAll(userId: string, role: string): Booking[] {
    if (role === 'ADMIN' || role === 'DISPATCHER') {
      return this.bookings;
    }
    if (role === 'TECHNICIAN') {
      return this.bookings.filter(b => b.technicianId === userId);
    }
    return this.bookings.filter(b => b.customerId === userId);
  }

  findById(id: string): Booking {
    const booking = this.bookings.find(b => b.id === id);
    if (!booking) throw new NotFoundException('Booking not found');
    return booking;
  }

  updateStatus(
    id: string,
    status: Booking['status'],
    imagesAfter?: string[],
  ): Booking {
    const booking = this.findById(id);
    booking.status = status;
    if (status === 'COMPLETED' && imagesAfter) {
      booking.imagesAfter = imagesAfter;
    }
    return booking;
  }

  updatePaymentStatus(id: string, paymentStatus: Booking['paymentStatus']): Booking {
    const booking = this.findById(id);
    booking.paymentStatus = paymentStatus;
    return booking;
  }

  assignTechnician(id: string, technicianId: string, technicianName: string): Booking {
    const booking = this.findById(id);
    booking.status = 'ASSIGNED';
    booking.technicianId = technicianId;
    booking.technicianName = technicianName;
    return booking;
  }
}