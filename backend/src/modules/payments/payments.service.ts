import { Injectable, BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as crypto from 'crypto';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentStatus } from '../bookings/entities/booking.entity';
import { Payment, PaymentGateway, PaymentRecordStatus } from './entities/payment.entity';

// Real money, no merchant API — customers send eSewa/Khalti transfers to
// this personal number directly, then claim the payment in-app; an admin
// confirms it manually against the actual wallet before it's marked PAID.
export const MANUAL_PAYMENT_NUMBER = '9868918609';

@Injectable()
export class PaymentsService {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly configService: ConfigService,
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
  ) {}

  // ─── Manual pay-to-number flow (the real, working default) ──────────────

  async claimManualPayment(bookingId: string, customerId: string): Promise<{ status: PaymentStatus }> {
    const booking = await this.bookingsService.findById(bookingId);
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only submit payment for your own booking');
    }
    if (booking.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('This booking is already paid');
    }

    let payment = await this.paymentRepository.findOne({ where: { bookingId } });
    if (!payment) {
      payment = this.paymentRepository.create({
        bookingId,
        gateway: booking.paymentMethod === 'KHALTI' ? PaymentGateway.KHALTI : PaymentGateway.ESEWA,
        transactionUuid: null,
        status: PaymentRecordStatus.INITIATED,
        amount: booking.totalAmount,
      });
    }
    await this.paymentRepository.save(payment);

    await this.bookingsService.updatePaymentStatus(bookingId, PaymentStatus.PENDING_VERIFICATION);
    return { status: PaymentStatus.PENDING_VERIFICATION };
  }

  async verifyManualPayment(bookingId: string, approved: boolean): Promise<{ status: PaymentStatus }> {
    const payment = await this.paymentRepository.findOne({ where: { bookingId } });
    if (!payment) {
      throw new NotFoundException('No payment claim found for this booking');
    }

    payment.status = approved ? PaymentRecordStatus.COMPLETED : PaymentRecordStatus.FAILED;
    await this.paymentRepository.save(payment);

    const nextStatus = approved ? PaymentStatus.PAID : PaymentStatus.FAILED;
    await this.bookingsService.updatePaymentStatus(bookingId, nextStatus);
    return { status: nextStatus };
  }

  // ─── eSewa sandbox integration (technical demo — test money only) ───────

  async initiateEsewaPayment(bookingId: string) {
    const booking = await this.bookingsService.findById(bookingId);

    const merchantCode = this.configService.get<string>('esewa.merchantCode') || 'EPAYTEST';
    const secretKey = this.configService.get<string>('esewa.secretKey') || '8g8D8h8H8a8s8d8';
    const esewaUrl = this.configService.get<string>('esewa.url');
    const frontendUrl = this.configService.get<string>('frontendUrl');

    const transactionUuid = `tx-${bookingId}-${Date.now()}`;
    const productCode = merchantCode;

    // eSewa's mandated field order for the signature — must match
    // signed_field_names exactly, in this order.
    const message = `total_amount=${booking.totalAmount},transaction_uuid=${transactionUuid},product_code=${productCode}`;
    const signature = crypto.createHmac('sha256', secretKey).update(message).digest('base64');

    await this.paymentRepository.save(
      this.paymentRepository.create({
        bookingId,
        gateway: PaymentGateway.ESEWA,
        transactionUuid,
        status: PaymentRecordStatus.INITIATED,
        amount: booking.totalAmount,
      }),
    );

    return {
      url: esewaUrl,
      fields: {
        amount: booking.totalAmount.toString(),
        tax_amount: '0',
        total_amount: booking.totalAmount.toString(),
        product_code: productCode,
        product_service_charge: '0',
        product_delivery_charge: '0',
        transaction_uuid: transactionUuid,
        success_url: `${frontendUrl}/payment/esewa/return?bookingId=${bookingId}`,
        failure_url: `${frontendUrl}/payment/esewa/return?bookingId=${bookingId}&failed=true`,
        signed_field_names: 'total_amount,transaction_uuid,product_code',
        signature,
      },
    };
  }

  async verifyEsewaCallback(encodedResponse: string) {
    let responseData: Record<string, any>;
    try {
      responseData = JSON.parse(Buffer.from(encodedResponse, 'base64').toString('utf-8'));
    } catch {
      throw new BadRequestException('Malformed eSewa response payload');
    }

    const { transaction_uuid, status, signature, signed_field_names } = responseData;
    if (!transaction_uuid || !signature || !signed_field_names) {
      throw new BadRequestException('Incomplete eSewa response payload');
    }

    const payment = await this.paymentRepository.findOne({ where: { transactionUuid: transaction_uuid } });
    if (!payment) {
      throw new NotFoundException('No matching payment record for this transaction');
    }

    // Recompute the signature ourselves from the fields eSewa says it signed,
    // in the order it says it signed them — this is what actually proves the
    // response came from eSewa and wasn't fabricated by the client. Without
    // this check, anyone could POST a fake "COMPLETE" status here for free.
    const secretKey = this.configService.get<string>('esewa.secretKey') || '8g8D8h8H8a8s8d8';
    const fieldNames: string[] = signed_field_names.split(',');
    const message = fieldNames.map((field) => `${field}=${responseData[field]}`).join(',');
    const expectedSignature = crypto.createHmac('sha256', secretKey).update(message).digest('base64');

    if (expectedSignature !== signature) {
      payment.status = PaymentRecordStatus.FAILED;
      payment.rawResponse = responseData;
      await this.paymentRepository.save(payment);
      throw new BadRequestException('eSewa signature verification failed — response may have been tampered with');
    }

    if (status !== 'COMPLETE') {
      payment.status = PaymentRecordStatus.FAILED;
      payment.rawResponse = responseData;
      await this.paymentRepository.save(payment);
      throw new BadRequestException('eSewa payment was not completed');
    }

    payment.status = PaymentRecordStatus.COMPLETED;
    payment.rawResponse = responseData;
    await this.paymentRepository.save(payment);

    await this.bookingsService.updatePaymentStatus(payment.bookingId, PaymentStatus.PAID);
    return { success: true, bookingId: payment.bookingId, status: 'PAID' };
  }

  // ─── Khalti sandbox integration (technical demo — test money only) ──────

  async initiateKhaltiPayment(bookingId: string) {
    const booking = await this.bookingsService.findById(bookingId);

    const secretKey = this.configService.get<string>('khalti.secretKey');
    if (!secretKey) {
      throw new BadRequestException(
        'Khalti sandbox is not configured — set KHALTI_SECRET_KEY (get a free test key at https://test-admin.khalti.com)',
      );
    }
    const baseUrl = this.configService.get<string>('khalti.baseUrl');
    const frontendUrl = this.configService.get<string>('frontendUrl');

    const res = await fetch(`${baseUrl}/epayment/initiate/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        return_url: `${frontendUrl}/payment/khalti/return?bookingId=${bookingId}`,
        website_url: frontendUrl,
        amount: Math.round(booking.totalAmount * 100), // paisa, not rupees
        purchase_order_id: booking.bookingNumber,
        purchase_order_name: booking.itemName || 'ServeNep booking',
        customer_info: {
          name: booking.customerName,
          phone: booking.customerPhone,
        },
      }),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new BadRequestException(`Khalti initiate failed: ${data?.detail || JSON.stringify(data)}`);
    }

    await this.paymentRepository.save(
      this.paymentRepository.create({
        bookingId,
        gateway: PaymentGateway.KHALTI,
        transactionUuid: data.pidx,
        status: PaymentRecordStatus.INITIATED,
        amount: booking.totalAmount,
      }),
    );

    return { payment_url: data.payment_url, pidx: data.pidx };
  }

  async verifyKhaltiPayment(pidx: string) {
    const secretKey = this.configService.get<string>('khalti.secretKey');
    if (!secretKey) {
      throw new BadRequestException('Khalti sandbox is not configured');
    }
    const baseUrl = this.configService.get<string>('khalti.baseUrl');

    const payment = await this.paymentRepository.findOne({ where: { transactionUuid: pidx } });
    if (!payment) {
      throw new NotFoundException('No matching payment record for this transaction');
    }

    // Look up the real status from Khalti's own server rather than trusting
    // whatever the browser redirect query params claim.
    const res = await fetch(`${baseUrl}/epayment/lookup/`, {
      method: 'POST',
      headers: {
        Authorization: `Key ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ pidx }),
    });
    const data = await res.json();
    if (!res.ok) {
      throw new BadRequestException(`Khalti lookup failed: ${data?.detail || JSON.stringify(data)}`);
    }

    payment.rawResponse = data;
    // Per Khalti's docs, only "Completed" counts as a successful payment.
    if (data.status !== 'Completed') {
      payment.status = PaymentRecordStatus.FAILED;
      await this.paymentRepository.save(payment);
      throw new BadRequestException(`Khalti payment status: ${data.status}`);
    }

    payment.status = PaymentRecordStatus.COMPLETED;
    await this.paymentRepository.save(payment);

    await this.bookingsService.updatePaymentStatus(payment.bookingId, PaymentStatus.PAID);
    return { success: true, bookingId: payment.bookingId, status: 'PAID' };
  }
}
