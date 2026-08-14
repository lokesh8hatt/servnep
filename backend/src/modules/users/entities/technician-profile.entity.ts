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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
