import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { BookingsService } from './bookings.service';
import { BookingsController } from './bookings.controller';
import { ServicesModule } from '../services/services.module';
import { UsersModule } from '../users/users.module';
import { AuthModule } from '../auth/auth.module';
import { Booking } from './entities/booking.entity';
import { User } from '../users/entities/user.entity';

@Module({
  // AuthModule is imported so JwtAuthGuard/RolesGuard (used via @UseGuards in
  // BookingsController) can resolve JwtService, which only AuthModule exports.
  imports: [TypeOrmModule.forFeature([Booking, User]), ServicesModule, UsersModule, AuthModule],
  controllers: [BookingsController],
  providers: [BookingsService],
  exports: [BookingsService],
})
export class BookingsModule {}
