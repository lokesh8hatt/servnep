import { Controller, Post, Patch, Body, Param, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Public } from '../../common/decorators/public.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser, UserPayload } from '../../common/decorators/user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsBoolean } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';

class InitiatePaymentDto {
  @ApiProperty({ example: 'b-1' })
  @IsNotEmpty()
  @IsString()
  bookingId: string;
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

@ApiTags('Payment Gateways')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  // ─── Manual pay-to-number flow (real money) ──────────────────────────
  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('manual/claim')
  @ApiOperation({ summary: 'Customer confirms they sent a manual eSewa/Khalti transfer' })
  claimManualPayment(@CurrentUser() user: UserPayload, @Body() dto: InitiatePaymentDto) {
    return this.paymentsService.claimManualPayment(dto.bookingId, user.sub);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles('ADMIN', 'DISPATCHER')
  @Patch('manual/:bookingId/verify')
  @ApiOperation({ summary: 'Admin confirms (or rejects) a manual payment claim' })
  verifyManualPayment(@Param('bookingId') bookingId: string, @Body() dto: VerifyManualPaymentDto) {
    return this.paymentsService.verifyManualPayment(bookingId, dto.approved);
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