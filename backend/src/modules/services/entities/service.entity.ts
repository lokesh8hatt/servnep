import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  OneToMany,
  CreateDateColumn,
} from 'typeorm';
import { ServiceCategory } from './service-category.entity';

@Entity('services')
export class Service {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  name: string;

  @Column({ type: 'varchar', length: 100, unique: true })
  slug: string;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'varchar', length: 50 })
  icon: string;

  @Column({ type: 'boolean', default: true })
  isActive: boolean;

  @OneToMany(() => ServiceCategory, (category) => category.service)
  categories: ServiceCategory[];

  @CreateDateColumn()
  createdAt: Date;
}
