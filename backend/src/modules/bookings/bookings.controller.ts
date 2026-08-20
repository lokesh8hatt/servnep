import { Controller, Get, Post, Patch, Body, Param, UseGuards, Header } from '@nestjs/common';
import { BookingsService } from './bookings.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { CurrentUser, UserPayload } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBoolean, IsOptional, IsArray, IsIn, IsNumber, Min } from 'class-validator';
import { BookingStatus, PaymentMethod } from './entities/booking.entity';

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
  paymentMethod: PaymentMethod;

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
  status: BookingStatus;

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
}

class RequestPriceRevisionDto {
  @ApiProperty({ example: 500 })
  @IsNumber()
  @Min(1)
  requestedAmount: number;

  @ApiProperty({ example: 'Actual issue was a loose connection, not a full gas leak — smaller fix than booked.' })
  @IsNotEmpty()
  @IsString()
  reason: string;
}

class RespondPriceRevisionDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  approved: boolean;
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

  // Registered ahead of the :id routes below so "offers" is never matched
  // as a booking ID.
  @Get('offers')
  @Roles('TECHNICIAN')
  @ApiOperation({ summary: 'List job offers currently awaiting this technician — broadcast dispatch, ride-share style' })
  getMyOffers(@CurrentUser() user: UserPayload) {
    return this.bookingsService.getMyOffers(user.sub);
  }

  @Post('offers/:offerId/accept')
  @Roles('TECHNICIAN')
  @ApiOperation({ summary: 'Accept a job offer — first technician to accept wins the job' })
  acceptOffer(@Param('offerId') offerId: string, @CurrentUser() user: UserPayload) {
    return this.bookingsService.acceptOffer(offerId, user.sub);
  }

  @Post('offers/:offerId/decline')
  @Roles('TECHNICIAN')
  @ApiOperation({ summary: 'Decline a job offer' })
  declineOffer(@Param('offerId') offerId: string, @CurrentUser() user: UserPayload) {
    return this.bookingsService.declineOffer(offerId, user.sub);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get booking details by ID' })
  findById(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.bookingsService.findByIdForUser(id, user);
  }

  @Get(':id/invoice')
  @ApiOperation({ summary: 'Get a printable HTML invoice for a booking' })
  @Header('Content-Type', 'text/html; charset=utf-8')
  getInvoice(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.bookingsService.getInvoiceHtml(id, user);
  }

  @Get(':id/technician-location')
  @ApiOperation({ summary: "Get the assigned technician's last-known live location for a booking" })
  getTechnicianLocation(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.bookingsService.getTechnicianLocation(id, user);
  }

  @Patch(':id/status')
  @Roles('ADMIN', 'DISPATCHER', 'TECHNICIAN')
  @ApiOperation({ summary: 'Update the progress status of a job' })
  updateStatus(@Param('id') id: string, @Body() dto: UpdateStatusDto, @CurrentUser() user: UserPayload) {
    return this.bookingsService.updateStatus(id, dto.status, dto.imagesAfter, user);
  }

  @Post(':id/assign')
  @Roles('ADMIN', 'DISPATCHER')
  @ApiOperation({ summary: 'Manually dispatch/assign a technician' })
  assignTechnician(@Param('id') id: string, @Body() dto: ManualAssignDto) {
    return this.bookingsService.assignTechnician(id, dto.technicianId);
  }

  @Post(':id/price-revision')
  @Roles('TECHNICIAN')
  @ApiOperation({ summary: 'Technician proposes a revised job price after on-site diagnosis, pending customer approval' })
  requestPriceRevision(@Param('id') id: string, @Body() dto: RequestPriceRevisionDto, @CurrentUser() user: UserPayload) {
    return this.bookingsService.requestPriceRevision(id, user.sub, dto.requestedAmount, dto.reason);
  }

  @Get(':id/price-revision')
  @ApiOperation({ summary: 'List price revision history for a booking' })
  getPriceRevisions(@Param('id') id: string, @CurrentUser() user: UserPayload) {
    return this.bookingsService.getPriceRevisions(id, user);
  }

  @Patch(':id/price-revision/:revisionId')
  @Roles('CUSTOMER')
  @ApiOperation({ summary: 'Customer approves or rejects a proposed price revision' })
  respondToPriceRevision(
    @Param('id') id: string,
    @Param('revisionId') revisionId: string,
    @Body() dto: RespondPriceRevisionDto,
    @CurrentUser() user: UserPayload,
  ) {
    return this.bookingsService.respondToPriceRevision(id, revisionId, user.sub, dto.approved);
  }
}
