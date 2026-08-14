import { Controller, Get, Param, NotFoundException } from '@nestjs/common';
import { ServicesService } from './services.service';
import { Public } from '../../common/decorators/public.decorator';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('Services & Catalog')
@Public()
@Controller('services')
export class ServicesController {
  constructor(private readonly servicesService: ServicesService) {}

  @Get()
  @ApiOperation({ summary: 'Get all service listings and categories' })
  findAll() {
    return this.servicesService.findAll();
  }

  @Get(':slug')
  @ApiOperation({ summary: 'Get a specific service by slug' })
  async findBySlug(@Param('slug') slug: string) {
    const service = await this.servicesService.findBySlug(slug);
    if (!service) {
      throw new NotFoundException(`Service with slug ${slug} not found`);
    }
    return service;
  }

  @Get(':serviceSlug/:categorySlug')
  @ApiOperation({ summary: 'Get specific service category detail' })
  async findCategory(
    @Param('serviceSlug') serviceSlug: string,
    @Param('categorySlug') categorySlug: string,
  ) {
    const category = await this.servicesService.findCategoryBySlug(serviceSlug, categorySlug);
    if (!category) {
      throw new NotFoundException(
        `Category ${categorySlug} under service ${serviceSlug} not found`,
      );
    }
    return category;
  }
}
