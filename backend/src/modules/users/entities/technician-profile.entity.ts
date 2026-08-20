import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToOne,
  JoinColumn,
  CreateDateColumn,
  UpdateDateColumn,
} from 'typeorm';
import { User } from './user.entity';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

export enum KycStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED',
}

@Entity('technician_profiles')
export class TechnicianProfile {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Column({ type: 'uuid', unique: true })
  userId: string;

  @Column({ type: 'enum', enum: KycStatus, default: KycStatus.PENDING })
  kycStatus: KycStatus;

  @Column({ type: 'boolean', default: false })
  isAvailable: boolean;

  @Column({ type: 'decimal', precision: 3, scale: 2, default: 5.0, transformer: DecimalTransformer })
  rating: number;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 10.0, transformer: DecimalTransformer })
  serviceRadiusKm: number;

  // Which top-level services (e.g. "Plumbing", "Electrical") this technician
  // is offered jobs for — a job's service dispatches only to technicians
  // whose specialties include it, so a plumber never gets offered wiring
  // work just because they're nearby and available.
  @Column({ type: 'text', array: true, default: () => "'{}'" })
  specialties: string[];

  // Last-known GPS position, pushed by the technician's own browser while an
  // ASSIGNED/IN_PROGRESS job is active — powers the customer's live map.
  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true, transformer: DecimalTransformer })
  latitude: number | null;

  @Column({ type: 'decimal', precision: 9, scale: 6, nullable: true, transformer: DecimalTransformer })
  longitude: number | null;

  @Column({ type: 'timestamp', nullable: true })
  locationUpdatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
