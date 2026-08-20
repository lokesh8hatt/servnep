import { Entity, PrimaryGeneratedColumn, Column, ManyToOne, JoinColumn, Index, CreateDateColumn } from 'typeorm';
import { Booking } from './booking.entity';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum JobOfferStatus {
  PENDING = 'PENDING',
  ACCEPTED = 'ACCEPTED',
  DECLINED = 'DECLINED',
  // Set on every other technician's offer the moment one of them accepts,
  // and on a technician's own offer if they try to accept a job someone
  // else just took — this is the audit trail for "why didn't I get it".
  EXPIRED = 'EXPIRED',
}

// A single broadcast: one row per (booking, technician) a job was actually
// offered to. Ride-share style dispatch — a new booking goes out to several
// nearby, available, specialty-matched technicians at once; whichever one
// accepts first gets the job, and every other pending offer for that
// booking flips to EXPIRED.
@Entity('job_offers')
export class JobOffer {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Booking, { onDelete: 'CASCADE' })
  @JoinColumn()
  booking: Booking;

  @Index()
  @Column({ type: 'uuid' })
  bookingId: string;

  @Index()
  @Column({ type: 'uuid' })
  technicianId: string;

  @Column({ type: 'enum', enum: JobOfferStatus, default: JobOfferStatus.PENDING })
  status: JobOfferStatus;

  // Snapshot at offer time — the technician's live location moves, this is
  // what they were shown when deciding whether to accept.
  @Column({ type: 'decimal', precision: 6, scale: 2, transformer: DecimalTransformer })
  distanceKm: number;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  respondedAt: Date | null;
}
