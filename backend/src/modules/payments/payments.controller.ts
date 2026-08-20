import { Controller, Get, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, UserPayload } from '../../common/decorators/user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBoolean, IsOptional } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

class InitiatePaymentDto {
  @ApiProperty({ example: 'b-1' })
  @IsNotEmpty()
  @IsString()
  bookingId: string;
}

class ClaimManualPaymentDto {
  @ApiProperty({ example: 'b-1' })
  @IsNotEmpty()
  @IsString()
  bookingId: string;

  @ApiProperty({ example: '000AB12CD3', description: 'The eSewa/Khalti transaction ID from the sent payment' })
  @IsNotEmpty()
  @IsString()
  reference: string;
}

class KhaltiVerifyDto {
  @ApiProperty({ example: 'khalti-pidx-abc123' })
  @IsNotEmpty()
  @IsString()
  pidx: string;
}

class VerifyManualPaymentDto {
  @ApiProperty({ example: true })
  @IsBoolean()
  approved: boolean;
}

class ClaimCommissionDto {
  @ApiProperty({ example: 'b-1' })
  @IsNotEmpty()
  @IsString()
  bookingId: string;

  @ApiProperty({ example: '000AB12CD3', description: "The eSewa/Khalti transaction ID from the technician's commission payment" })
  @IsNotEmpty()
  @IsString()
  reference: string;
}

class CreatePayoutDto {
  @ApiProperty({ example: 'tech-uuid-1' })
  @IsNotEmpty()
  @IsString()
  technicianId: string;

  @ApiProperty({ example: 'Paid via eSewa transfer, ref XYZ', required: false })
  @IsOptional()
  @IsString()
  notes?: string;
}

@ApiTags('Payment Gateways')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── Manual pay-to-number flow (real money) ──────────────────────────
  @Public()
  @Get('config')
  @ApiOperation({ summary: 'Which payment gateways are actually configured' })
  getConfig() {
    return this.paymentsService.getGatewayAvailability();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('manual/claim')
  @ApiOperation({ summary: 'Customer confirms they sent a manual eSewa/Khalti transfer, with proof' })
  claimManualPayment(@CurrentUser() user: UserPayload, @Body() dto: ClaimManualPaymentDto) {
    return this.paymentsService.claimManualPayment(dto.bookingId, user.sub, dto.reference);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  @Get('manual/:bookingId')
  @ApiOperation({ summary: 'Get the payment claim (with customer-supplied reference) for a booking' })
  getPaymentClaim(@Param('bookingId') bookingId: string) {
    return this.paymentsService.getPaymentByBooking(bookingId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  @Patch('manual/:bookingId/verify')
  @ApiOperation({ summary: 'Admin confirms (or rejects) a manual payment claim' })
  verifyManualPayment(@Param('bookingId') bookingId: string, @Body() dto: VerifyManualPaymentDto) {
    return this.paymentsService.verifyManualPayment(bookingId, dto.approved);
  }

  // ─── Commission settlement (cash jobs) & technician payouts ──────────
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TECHNICIAN')
  @Post('commission/claim')
  @ApiOperation({ summary: 'Technician confirms they sent the company its commission on a completed cash job, with proof' })
  claimCommission(@CurrentUser() user: UserPayload, @Body() dto: ClaimCommissionDto) {
    return this.paymentsService.claimCommissionRemittance(dto.bookingId, user.sub, dto.reference);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  @Patch('commission/:bookingId/verify')
  @ApiOperation({ summary: "Admin confirms (or rejects) a technician's commission remittance claim" })
  verifyCommission(@Param('bookingId') bookingId: string, @Body() dto: VerifyManualPaymentDto) {
    return this.paymentsService.verifyCommissionRemittance(bookingId, dto.approved);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('TECHNICIAN')
  @Get('technician/earnings')
  @ApiOperation({ summary: "Current technician's pending balance and payout history" })
  getMyEarnings(@CurrentUser() user: UserPayload) {
    return this.paymentsService.getTechnicianEarnings(user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  @Get('admin/payouts')
  @ApiOperation({ summary: 'List every technician with a pending payout balance' })
  listPendingPayouts() {
    return this.paymentsService.listPendingPayouts();
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  @Post('admin/payouts')
  @ApiOperation({ summary: 'Record that a technician has been paid their pending balance, closing out those bookings' })
  createPayout(@Body() dto: CreatePayoutDto) {
    return this.paymentsService.createPayout(dto.technicianId, dto.notes);
  }

  // ─── eSewa sandbox integration (technical demo) ──────────────────────
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('esewa/initiate')
  @ApiOperation({ summary: '[Sandbox demo] Initiate eSewa payment signature parameter fields' })
  initiateEsewa(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiateEsewaPayment(dto.bookingId);
  }

  @Public()
  @Post('esewa/callback')
  @ApiOperation({ summary: '[Sandbox demo] eSewa payment callback endpoint' })
  verifyEsewa(@Body('data') data: string) {
    return this.paymentsService.verifyEsewaCallback(data);
  }

  // ─── Khalti sandbox integration (technical demo) ─────────────────────
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('khalti/initiate')
  @ApiOperation({ summary: '[Sandbox demo] Initiate Khalti payment redirection' })
  initiateKhalti(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiateKhaltiPayment(dto.bookingId);
  }

  @Public()
  @Post('khalti/verify')
  @ApiOperation({ summary: '[Sandbox demo] Verify Khalti payment status via lookup API' })
  verifyKhalti(@Body() dto: KhaltiVerifyDto) {
    return this.paymentsService.verifyKhaltiPayment(dto.pidx);
  }
}