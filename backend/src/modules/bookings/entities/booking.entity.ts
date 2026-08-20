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
import { User } from '../../users/entities/user.entity';
import { Address } from '../../users/entities/address.entity';
import { ServiceItem } from '../../services/entities/service-item.entity';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum BookingStatus {
  PENDING = 'PENDING',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  // Customer claims they sent a manual eSewa/Khalti transfer; awaiting an
  // admin to confirm the money actually arrived before marking PAID.
  PENDING_VERIFICATION = 'PENDING_VERIFICATION',
  PAID = 'PAID',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

export enum PaymentMethod {
  ESEWA = 'ESEWA',
  KHALTI = 'KHALTI',
  CASH = 'CASH',
}

@Entity('bookings')
export class Booking {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 20, unique: true })
  bookingNumber: string;

  @ManyToOne(() => User, { onDelete: 'RESTRICT' })
  @JoinColumn()
  customer: User;

  @Index()
  @Column({ type: 'uuid' })
  customerId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn()
  technician: User | null;

  @Index()
  @Column({ type: 'uuid', nullable: true })
  technicianId: string | null;

  @ManyToOne(() => Address, { onDelete: 'RESTRICT' })
  @JoinColumn()
  address: Address;

  @Column({ type: 'uuid' })
  addressId: string;

  @ManyToOne(() => ServiceItem, { onDelete: 'RESTRICT' })
  @JoinColumn()
  serviceItem: ServiceItem;

  @Column({ type: 'uuid' })
  serviceItemId: string;

  @Index()
  @Column({ type: 'enum', enum: BookingStatus, default: BookingStatus.PENDING })
  status: BookingStatus;

  @Index()
  @Column({ type: 'date' })
  scheduledDate: string;

  @Column({ type: 'varchar', length: 50 })
  scheduledTimeSlot: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  baseAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  serviceFee: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0, transformer: DecimalTransformer })
  emergencySurcharge: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  totalAmount: number;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  imagesBefore: string[];

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  imagesAfter: string[];

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  paymentStatus: PaymentStatus;

  @Column({ type: 'enum', enum: PaymentMethod })
  paymentMethod: PaymentMethod;

  // The next four fields exist to close a real gap: without them, a
  // technician's word is the only record of what a cash job was actually
  // worth, and there's no way to tell whether the company's cut of it was
  // ever collected. commission/payout amounts are locked in at job
  // completion (see BookingsService.updateStatus), from whatever baseAmount
  // stands at that moment — i.e. after any approved PriceRevision.
  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: DecimalTransformer })
  commissionAmount: number | null;

  @Column({ type: 'decimal', precision: 10, scale: 2, nullable: true, transformer: DecimalTransformer })
  technicianPayoutAmount: number | null;

  // True once the company has actually received its commission: immediately
  // for ESEWA/KHALTI (the full manual transfer already lands on the
  // company's number), only after admin-verified remittance for CASH jobs
  // (see commissionReference). A booking only counts toward a technician's
  // payable balance once this is true.
  @Column({ type: 'boolean', default: false })
  commissionSettled: boolean;

  // Cash-job technician's proof that they sent the company its commission —
  // same "customer reference" pattern as Payment.customerReference, mirrored
  // for the technician-to-company leg of the money.
  @Column({ type: 'varchar', length: 100, nullable: true })
  commissionReference: string | null;

  // Set once this booking's net payout has been included in a
  // TechnicianPayout batch — null means "earned but not yet paid out".
  @Column({ type: 'uuid', nullable: true })
  payoutId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
