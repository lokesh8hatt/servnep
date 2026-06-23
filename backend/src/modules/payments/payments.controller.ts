import { Controller, Post, Body, Get, Query, UseGuards } from '@nestjs/common';
import { PaymentsService } from './payments.service';
import { Public } from '../../common/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';

class InitiatePaymentDto {
  @ApiProperty({ example: 'b-1' })
  @IsNotEmpty()
  @IsString()
  bookingId: string;
}

@ApiTags('Payment Gateways')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('esewa/initiate')
  @ApiOperation({ summary: 'Initiate eSewa payment signature parameter fields' })
  initiateEsewa(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiateEsewaPayment(dto.bookingId);
  }

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post('khalti/initiate')
  @ApiOperation({ summary: 'Initiate Khalti payment redirection' })
  initiateKhalti(@Body() dto: InitiatePaymentDto) {
    return this.paymentsService.initiateKhaltiPayment(dto.bookingId);
  }

  @Public()
  @Post('esewa/callback')
  @ApiOperation({ summary: 'eSewa payment callback endpoint' })
  verifyEsewa(@Body('data') data: string) {
    return this.paymentsService.verifyEsewaCallback(data);
  }
}