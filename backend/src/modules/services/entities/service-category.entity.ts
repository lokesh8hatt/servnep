import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  OneToMany,
  Index,
  CreateDateColumn,
} from 'typeorm';
import { Service } from './service.entity';
import { ServiceItem } from './service-item.entity';

@Entity('service_categories')
export class ServiceCategory {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @ManyToOne(() => Service, (service) => service.categories, { onDelete: 'CASCADE' })
  @JoinColumn()
  service: Service;

  @Index()
  @Column({ type: 'uuid' })
  serviceId: string;

  @Column({ type: 'varchar', length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'text' })
  imageUrl: string;

  @Column({ type: 'text' })
  imageAlt: string;

  @OneToMany(() => ServiceItem, (item) => item.category)
  items: ServiceItem[];

  @CreateDateColumn()
  createdAt: Date;
}
