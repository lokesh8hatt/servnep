import { Injectable, NotFoundException } from '@nestjs/common';
import { BookingsService } from '../bookings/bookings.service';

export interface Review {
  id: string;
  bookingId: string;
  customerId: string;
  customerName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

@Injectable()
export class ReviewsService {
  constructor(private readonly bookingsService: BookingsService) {
    this.reviews.push({
      id: 'rev-1',
      bookingId: 'b-1',
      customerId: 'cust-uuid-1',
      customerName: 'Sabin Shrestha',
      rating: 5,
      comment: 'Excellent plumbing fix. Ramesh arrived within 20 minutes and solved our tap leak perfectly!',
      createdAt: new Date().toISOString(),
    });
  }

  private reviews: Review[] = [];

  createReview(
    userId: string,
    data: {
      bookingId: string;
      rating: number;
      comment: string;
    },
  ) {
    const booking = this.bookingsService.findById(data.bookingId);
    if (booking.customerId !== userId) {
      throw new NotFoundException('You can only review your own bookings');
    }

    const newReview: Review = {
      id: `rev-${Math.random().toString(36).substring(2, 11)}`,
      bookingId: booking.id,
      customerId: userId,
      customerName: booking.customerName,
      rating: data.rating,
      comment: data.comment,
      createdAt: new Date().toISOString(),
    };

    this.reviews.push(newReview);
    return newReview;
  }

  findAll() {
    return this.reviews;
  }

  findByTechnician(technicianId: string) {
    return this.reviews.filter(r => {
      try {
        const b = this.bookingsService.findById(r.bookingId);
        return b.technicianId === technicianId;
      } catch {
        return false;
      }
    });
  }
}
