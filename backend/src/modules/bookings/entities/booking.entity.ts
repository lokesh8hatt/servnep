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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
