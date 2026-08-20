import { Entity, PrimaryGeneratedColumn, Column, Index, CreateDateColumn } from 'typeorm';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

// A record of an admin having actually paid a technician their accumulated
// net earnings (outside the app — bank transfer, eSewa, cash in hand). This
// is the "close the loop" record, not a payment gateway transaction: it
// exists so a technician's paid-out bookings can never be counted twice.
@Entity('technician_payouts')
export class TechnicianPayout {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index()
  @Column({ type: 'uuid' })
  technicianId: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  totalAmount: number;

  @Column({ type: 'int' })
  bookingCount: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @CreateDateColumn()
  createdAt: Date;
}
