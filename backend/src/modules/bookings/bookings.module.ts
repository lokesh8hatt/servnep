import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { ServicesModule } from '../services/services.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { Booking } from './entities/booking.entity';
import { User } from '../users/entities/user.entity';
import { TechnicianProfile } from '../users/entities/technician-profile.entity';

@Module({
  // AuthModule is imported so JwtAuthGuard/RolesGuard (used via @UseGuards in
  // BookingsController) can resolve JwtService, which only AuthModule exports;
  // it also exports EmailService, used here for booking-assigned notifications.
  imports: [TypeOrmModule.forFeature([Booking, User, TechnicianProfile]), ServicesModule, UsersModule, AuthModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
