import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Not } from 'typeorm';
import * as crypto from 'crypto';
import { BookingsService } from '../bookings/bookings.service';
import { PaymentStatus, PaymentMethod } from '../bookings/entities/booking.entity';
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

  async claimManualPayment(bookingId: string, customerId: string, reference: string): Promise<{ status: PaymentStatus }> {
    const booking = await this.bookingsService.findById(bookingId);
    if (booking.customerId !== customerId) {
      throw new ForbiddenException('You can only submit payment for your own booking');
    }
    // A CASH booking is paid in person — there is nothing to claim through
    // this digital flow. Without this check, a CASH booking's "payment"
    // could be verified through the eSewa/Khalti manual-claim path, which
    // also auto-settles commission — completely bypassing the separate
    // commission-remittance flow CASH jobs are actually supposed to go
    // through (see BookingsService.claimCommissionRemittance).
    if (booking.paymentMethod === PaymentMethod.CASH) {
      throw new BadRequestException('This is a cash booking — pay the technician directly, there is nothing to claim here');
    }
    if (booking.paymentStatus === PaymentStatus.PAID) {
      throw new BadRequestException('This booking is already paid');
    }
    const trimmedReference = (reference || '').trim();
    if (trimmedReference.length < 4) {
      throw new BadRequestException('Enter the eSewa/Khalti transaction ID from your payment so it can be verified');
    }

    // The same transaction ID can't be reused as "proof" across different
    // bookings — otherwise one real transfer could be claimed as payment
    // for many bookings.
    const reusedElsewhere = await this.paymentRepository.findOne({
      where: { customerReference: trimmedReference, bookingId: Not(bookingId) },
    });
    if (reusedElsewhere) {
      throw new BadRequestException('This transaction ID has already been used as proof on a different booking');
    }

    return this.paymentRepository.manager.transaction(async (manager) => {
      // Advisory lock scoped to this booking for the transaction's
      // duration — without it, two concurrent claims (double-click, retry
      // after a slow network) can both pass the find-then-create check
      // above and both insert a Payment row for the same booking.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [bookingId]);

      const paymentRepo = manager.getRepository(Payment);
      let payment = await paymentRepo.findOne({ where: { bookingId } });
      if (!payment) {
        payment = paymentRepo.create({
          bookingId,
          gateway: booking.paymentMethod === 'KHALTI' ? PaymentGateway.KHALTI : PaymentGateway.ESEWA,
          transactionUuid: null,
          status: PaymentRecordStatus.INITIATED,
          amount: booking.totalAmount,
        });
      }
      payment.customerReference = trimmedReference;
      await paymentRepo.save(payment);

      await this.bookingsService.updatePaymentStatus(bookingId, PaymentStatus.PENDING_VERIFICATION);
      return { status: PaymentStatus.PENDING_VERIFICATION };
    });
  }

  async getPaymentByBooking(bookingId: string): Promise<Payment | null> {
    return this.paymentRepository.findOne({ where: { bookingId } });
  }

  getGatewayAvailability(): { esewaConfigured: boolean; khaltiConfigured: boolean } {
    return {
      esewaConfigured: true, // eSewa's shared UAT test credentials always work
      khaltiConfigured: !!this.configService.get<string>('khalti.secretKey'),
    };
  }

  async verifyManualPayment(bookingId: string, approved: boolean): Promise<{ status: PaymentStatus }> {
    const payment = await this.paymentRepository.findOne({ where: { bookingId } });
    if (!payment) {
      throw new NotFoundException('No payment claim found for this booking');
    }
    if (payment.status !== PaymentRecordStatus.INITIATED) {
      throw new ConflictException('This payment claim has already been processed');
    }

    // Defense in depth — claimManualPayment already refuses to create a
    // claim for a CASH booking, but this guards any pre-existing/legacy
    // claim from ever auto-settling commission for a job that was never
    // actually paid digitally.
    const booking = await this.bookingsService.findById(bookingId);
    if (booking.paymentMethod === PaymentMethod.CASH) {
      throw new BadRequestException('This is a cash booking — use the commission remittance flow instead');
    }

    payment.status = approved ? PaymentRecordStatus.COMPLETED : PaymentRecordStatus.FAILED;
    await this.paymentRepository.save(payment);

    const nextStatus = approved ? PaymentStatus.PAID : PaymentStatus.FAILED;
    await this.bookingsService.updatePaymentStatus(bookingId, nextStatus);

    // The whole manual transfer — job value and commission both — just
    // landed on the company's own number in one lump sum, so the company's
    // cut is inherently already collected the moment this is verified.
    // Cash jobs don't get this for free; see claimCommissionRemittance.
    if (approved) {
      await this.bookingsService.markCommissionSettled(bookingId);
    }

    return { status: nextStatus };
  }

  // ─── Commission settlement (cash jobs) & technician payouts ─────────────

  async claimCommissionRemittance(bookingId: string, technicianId: string, reference: string) {
    await this.bookingsService.claimCommissionRemittance(bookingId, technicianId, reference);
    return { message: 'Commission remittance submitted — awaiting admin verification.' };
  }

  async verifyCommissionRemittance(bookingId: string, approved: boolean) {
    await this.bookingsService.verifyCommissionRemittance(bookingId, approved);
    return { message: approved ? 'Commission remittance verified.' : 'Commission remittance rejected.' };
  }

  getTechnicianEarnings(technicianId: string) {
    return this.bookingsService.getTechnicianEarnings(technicianId);
  }

  listPendingPayouts() {
    return this.bookingsService.listPendingPayouts();
  }

  createPayout(technicianId: string, notes?: string) {
    return this.bookingsService.createPayout(technicianId, notes);
  }

  // ─── eSewa sandbox integration (technical demo — test money only) ───────

  async initiateEsewaPayment(bookingId: string, requester: { sub: string; role: string }) {
    const booking = await this.bookingsService.findById(bookingId);
    // Without this, any authenticated user could initiate — and, since the
    // signing key is eSewa's own published sandbox secret, self-sign — a
    // "paid" callback for someone else's booking.
    const isOwner = booking.customerId === requester.sub;
    const isStaff = requester.role === 'ADMIN' || requester.role === 'DISPATCHER';
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You can only pay for your own booking');
    }

    // No local fallback here on purpose — configuration.ts is the one place
    // this default lives. A second hardcoded copy here previously drifted
    // out of sync with it silently, and the stale one kept winning.
    const merchantCode = this.configService.get<string>('esewa.merchantCode');
    const secretKey = this.configService.get<string>('esewa.secretKey');
    const esewaUrl = this.configService.get<string>('esewa.url');
    const frontendUrl = this.configService.get<string>('frontendUrl');

    // Hyphens are valid per eSewa's spec, but keeping the ID plain
    // alphanumeric removes any ambiguity while their sandbox is this flaky.
    const transactionUuid = `tx${bookingId.replace(/-/g, '')}${Date.now()}`;
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

    const { transaction_uuid, status, signature, signed_field_names, total_amount } = responseData;
    if (!transaction_uuid || !signature || !signed_field_names) {
      throw new BadRequestException('Incomplete eSewa response payload');
    }

    const payment = await this.paymentRepository.findOne({ where: { transactionUuid: transaction_uuid } });
    if (!payment) {
      throw new NotFoundException('No matching payment record for this transaction');
    }
    if (payment.status !== PaymentRecordStatus.INITIATED) {
      throw new ConflictException('This payment has already been processed');
    }

    // The signature only proves the payload wasn't tampered with in
    // transit — it says nothing about whether the amount inside it matches
    // what this booking actually costs. Without this check, a validly
    // self-signed callback (the eSewa sandbox key is public) for the
    // correct transaction_uuid could still claim any total_amount at all.
    const callbackAmount = parseFloat(total_amount);
    if (!Number.isFinite(callbackAmount) || Math.abs(callbackAmount - payment.amount) > 0.01) {
      payment.status = PaymentRecordStatus.FAILED;
      payment.rawResponse = responseData;
      await this.paymentRepository.save(payment);
      throw new BadRequestException('Callback amount does not match the expected payment amount');
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

  async initiateKhaltiPayment(bookingId: string, requester: { sub: string; role: string }) {
    const booking = await this.bookingsService.findById(bookingId);
    const isOwner = booking.customerId === requester.sub;
    const isStaff = requester.role === 'ADMIN' || requester.role === 'DISPATCHER';
    if (!isOwner && !isStaff) {
      throw new ForbiddenException('You can only pay for your own booking');
    }

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
