import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { User } from './user.entity';

@Entity('addresses')
export class Address {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn()
  user: User;

  @Index()
  @Column({ type: 'uuid' })
  userId: string;

  @Column({ type: 'varchar', length: 50 })
  label: string;

  @Column({ type: 'text' })
  street: string;

  @Column({ type: 'varchar', length: 50 })
  city: string;

  @Column({ type: 'double precision', default: 0 })
  lat: number;

  @Column({ type: 'double precision', default: 0 })
  lng: number;

  @CreateDateColumn()
  createdAt: Date;
}
