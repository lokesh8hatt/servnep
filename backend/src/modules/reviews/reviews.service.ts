import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { BookingsService } from '../bookings/bookings.service';
import { Review } from './entities/review.entity';

@Injectable()
export class ReviewsService {
  constructor(
    private readonly bookingsService: BookingsService,
    @InjectRepository(Review)
    private readonly reviewRepository: Repository<Review>,
  ) {}

  async createReview(
    userId: string,
    data: {
      bookingId: string;
      rating: number;
      comment: string;
    },
  ): Promise<Review> {
    const booking = await this.bookingsService.findById(data.bookingId);
    if (booking.customerId !== userId) {
      throw new NotFoundException('You can only review your own bookings');
    }

    try {
      return await this.reviewRepository.save(
        this.reviewRepository.create({
          bookingId: booking.id,
          customerId: userId,
          rating: data.rating,
          comment: data.comment,
        }),
      );
    } catch (err: any) {
      if (err?.code === '23505') {
        throw new ConflictException('You have already submitted a review for this booking.');
      }
      throw err;
    }
  }

  findAll(): Promise<Review[]> {
    return this.reviewRepository.find({ order: { createdAt: 'DESC' } });
  }

  async findByTechnician(technicianId: string): Promise<Review[]> {
    const bookingIds = await this.bookingsService.findIdsByTechnician(technicianId);
    if (bookingIds.length === 0) return [];
    return this.reviewRepository.find({
      where: { bookingId: In(bookingIds) },
      order: { createdAt: 'DESC' },
    });
  }
}
