import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { ServiceCategory } from './service-category.entity';
import { DecimalTransformer } from '../../../common/transformers/decimal.transformer';

@Entity('service_items')
export class ServiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => ServiceCategory, (category) => category.items, { onDelete: 'CASCADE' })
  @JoinColumn()
  category: ServiceCategory;

  @Index()
  @Column({ type: 'uuid' })
  categoryId: string;

  @Column({ type: 'varchar', length: 150 })
  name: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'decimal', precision: 10, scale: 2, transformer: DecimalTransformer })
  basePrice: number;

  @Column({ type: 'int', default: 60 })
  durationMins: number;

  @CreateDateColumn()
  createdAt: Date;
}
