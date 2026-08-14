import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Service } from './entities/service.entity';
import { ServiceCategory } from './entities/service-category.entity';
import { ServiceItem } from './entities/service-item.entity';

@Injectable()
export class ServicesService {
  constructor(
    @InjectRepository(Service)
    private readonly serviceRepository: Repository<Service>,
    @InjectRepository(ServiceItem)
    private readonly serviceItemRepository: Repository<ServiceItem>,
  ) {}

  findAll(): Promise<Service[]> {
    return this.serviceRepository.find({
      where: { isActive: true },
      relations: { categories: { items: true } },
      order: { name: 'ASC' },
    });
  }

  findBySlug(slug: string): Promise<Service | null> {
    return this.serviceRepository.findOne({
      where: { slug },
      relations: { categories: { items: true } },
    });
  }

  async findCategoryBySlug(serviceSlug: string, categorySlug: string): Promise<ServiceCategory | null> {
    const service = await this.findBySlug(serviceSlug);
    if (!service) return null;
    return service.categories.find((c) => c.slug === categorySlug) || null;
  }

  findItemById(itemId: string): Promise<ServiceItem | null> {
    return this.serviceItemRepository.findOne({
      where: { id: itemId },
      relations: { category: { service: true } },
    });
  }
}
