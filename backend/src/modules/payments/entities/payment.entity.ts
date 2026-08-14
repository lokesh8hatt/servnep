import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Booking } from '../../bookings/entities/booking.entity';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum PaymentGateway {
  ESEWA = 'ESEWA',
  KHALTI = 'KHALTI',
  CASH = 'CASH',
}

export enum PaymentRecordStatus {
  INITIATED = 'INITIATED',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn()
  booking: Booking;

  @Index()
  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'enum', enum: PaymentGateway })
  gateway: PaymentGateway;

  @Column({ type: 'varchar', length: 100, unique: true, nullable: true })
  transactionUuid: string | null;

  // Customer-supplied proof for the manual pay-to-number flow (the eSewa/
  // Khalti transaction ID from their sent transfer) — gives the admin
  // something concrete to check against their own wallet history instead
  // of just trusting a bare "I paid" claim.
  @Column({ type: 'varchar', length: 100, nullable: true })
  customerReference: string | null;

  @Column({ type: 'enum', enum: PaymentRecordStatus, default: PaymentRecordStatus.INITIATED })
  status: PaymentRecordStatus;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  amount: number;

  @Column({ type: 'jsonb', nullable: true })
  rawResponse: Record<string, unknown> | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
