import { Injectable, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BookingsService } from '../bookings/bookings.service';
import * as crypto from 'crypto';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly configService: ConfigService,
  ) {}

  async initiateEsewaPayment(bookingId: string) {
    const booking = this.bookingsService.findById(bookingId);
    
    const merchantCode = this.configService.get<string>('esewa.merchantCode') || 'EPAYTEST';
    const secretKey = this.configService.get<string>('esewa.secretKey') || '8g8D8h8H8a8s8d8';
    const esewaUrl = this.configService.get<string>('esewa.url');
    
    const transactionUuid = `tx-${bookingId}-${Date.now()}`;
    const productCode = merchantCode;
    
    const message = `total_amount=${booking.totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
    
    const hmac = crypto.createHmac('sha256', secretKey);
    hmac.update(message);
    const signature = hmac.digest('base64');

    return {
      url: esewaUrl,
      fields: {
        amount: booking.totalAmount.toString(),
        tax_amount: '0',
        total_amount: booking.totalAmount.toString(),
        product_code: productCode,
        transaction_uuid: transactionUuid,
        success_url: `http://localhost:3000/dashboard/customer?status=success&bookingId=${bookingId}`,
        failure_url: `http://localhost:3000/dashboard/customer?status=failed&bookingId=${bookingId}`,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature: signature,
      },
    };
  }

  async verifyEsewaCallback(encodedResponse: string) {
    try {
      const decoded = Buffer.from(encodedResponse, 'base64').toString('utf-8');
      const responseData = JSON.parse(decoded);
      
      const { transaction_uuid, status } = responseData;
      
      if (status !== 'COMPLETE') {
        throw new BadRequestException('eSewa payment transaction is not completed');
      }

      // Extract bookingId from transaction_uuid format: tx-{bookingId}-{timestamp}
      const parts = transaction_uuid.split('-');
      if (parts.length < 3) {
        throw new BadRequestException('Invalid transaction UUID format');
      }
      const bookingId = parts[1];

      this.bookingsService.updatePaymentStatus(bookingId, 'PAID');
      return { success: true, bookingId, status: 'PAID' };
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      throw new BadRequestException(`Verification failed: ${errorMessage}`);
    }
  }

  async initiateKhaltiPayment(bookingId: string) {
    const booking = this.bookingsService.findById(bookingId);
    
    return {
      payment_url: `http://localhost:3000/dashboard/customer?status=success&bookingId=${bookingId}&gateway=khalti`,
      pidx: `khalti-pidx-${Math.random().toString(36).substring(2, 9)}`,
    };
  }
}