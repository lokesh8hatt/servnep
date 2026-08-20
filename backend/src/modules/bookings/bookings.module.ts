import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { ServicesModule } from '../services/services.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { Booking } from './entities/booking.entity';
import { PriceRevision } from './entities/price-revision.entity';
import { JobOffer } from './entities/job-offer.entity';
import { User } from '../users/entities/user.entity';
import { TechnicianProfile } from '../users/entities/technician-profile.entity';
import { TechnicianPayout } from '../payments/entities/technician-payout.entity';

@Module({
  // AuthModule is imported so JwtAuthGuard/RolesGuard (used via @UseGuards in
  // BookingsController) can resolve JwtService, which only AuthModule exports;
  // it also exports EmailService, used here for booking-assigned notifications.
  imports: [
    TypeOrmModule.forFeature([Booking, PriceRevision, JobOffer, User, TechnicianProfile, TechnicianPayout]),
    ServicesModule,
    UsersModule,
    AuthModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
