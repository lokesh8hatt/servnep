import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, UserPayload } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBoolean, IsOptional, IsArray, IsIn } from 'class-validator';

class CreateBookingDto {
  @ApiProperty({ example: 'i1' })
  @IsNotEmpty()
  @IsString()
  itemId: string;

  @ApiProperty({ example: 'addr-1' })
  @IsNotEmpty()
  @IsString()
  addressId: string;

  @ApiProperty({ example: '2026-06-23' })
  @IsNotEmpty()
  @IsString()
  scheduledDate: string;

  @ApiProperty({ example: '11:00 AM - 01:00 PM' })
  @IsNotEmpty()
  @IsString()
  scheduledTimeSlot: string;

  @ApiProperty({ example: false })
  @IsBoolean()
  isEmergency: boolean;

  @ApiProperty({ example: 'CASH', enum: ['ESEWA', 'KHALTI', 'CASH'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['ESEWA', 'KHALTI', 'CASH'])
  paymentMethod: 'ESEWA' | 'KHALTI' | 'CASH';

  @ApiProperty({ example: [], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  images?: string[];
}

class UpdateStatusDto {
  @ApiProperty({ example: 'IN_PROGRESS', enum: ['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['ASSIGNED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'])
  status: 'PENDING' | 'ASSIGNED' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';

  @ApiProperty({ example: [], required: false })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  imagesAfter?: string[];
}

class ManualAssignDto {
  @ApiProperty({ example: 'tech-uuid-1' })
  @IsNotEmpty()
  @IsString()
  technicianId: string;

  @ApiProperty({ example: 'Ramesh Mali (Plumber)' })
  @IsNotEmpty()
  @IsString()
  technicianName: string;
}

@ApiTags('Bookings & Jobs')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('bookings')
export class BookingsController {
  constructor(private readonly bookingsService: BookingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new service booking request' })
  createBooking(@CurrentUser() user: UserPayload, @Body() dto: CreateBookingDto) {
    return this.bookingsService.createBooking(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List user bookings matching permissions' })
  findAll(@CurrentUser() user: UserPayload) {
    return this.bookingsService.findAll(user.sub, user.role);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking details by ID' })
  findById(@Param('id') id: string) {
    return this.bookingsService.findById(id);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'DISPATCHER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Update the progress status of a job' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto) {
    return this.bookingsService.updateStatus(id, dto.status, dto.imagesAfter);
  }

  @Post(':id/assign')
  @Roles('ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Manually dispatch/assign a technician' })
  assignTechnician(@Param('id') id: string, @Body() dto: ManualAssignDto) {
    return this.bookingsService.assignTechnician(id, dto.technicianId, dto.technicianName);
  }
}
