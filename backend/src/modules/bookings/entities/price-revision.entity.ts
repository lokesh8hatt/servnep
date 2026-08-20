import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { Booking } from './booking.entity';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum RevisionStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

// A technician's on-site price change request, requiring explicit customer
// approval before it takes effect — this is what stops a technician from
// unilaterally under- or over-reporting the real job value (whether to
// shortchange the company's commission, or to overcharge the customer).
@Entity('price_revisions')
export class PriceRevision {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn()
  booking: Booking;

  @Index()
  @Column({ type: 'uuid' })
  bookingId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  previousAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  requestedAmount: number;

  @Column({ type: 'text' })
  reason: string;

  @Column({ type: 'enum', enum: RevisionStatus, default: RevisionStatus.PENDING })
  status: RevisionStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null;
}
