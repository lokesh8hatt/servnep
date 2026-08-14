import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersService } from './users.service';
import { UsersController } from './users.controller';
import { User } from './entities/user.entity';
import { TechnicianProfile } from './entities/technician-profile.entity';
import { Address } from './entities/address.entity';
import { AuthModule } from '../auth/auth.module';

@Module({
  // AuthModule is imported so JwtAuthGuard (used via @UseGuards in UsersController)
  // can resolve JwtService, which only AuthModule exports.
  imports: [TypeOrmModule.forFeature([User, TechnicianProfile, Address]), AuthModule],
  controllers: [UsersController],
  providers: [UsersService],
  exports: [UsersService],
})
export class UsersModule {}
