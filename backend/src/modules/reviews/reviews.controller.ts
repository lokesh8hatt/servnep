import { Controller, Get, Post, Body, Param, UseGuards } from '@nestjs/common';
import { ReviewsService } from './reviews.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../../common/decorators/user.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, Min, Max } from 'class-validator';

class CreateReviewDto {
  @ApiProperty({ example: 'b-1' })
  @IsNotEmpty()
  @IsString()
  bookingId: string;

  @ApiProperty({ example: 5 })
  @IsNumber()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty({ example: 'Excellent quick service.' })
  @IsNotEmpty()
  @IsString()
  comment: string;
}

@ApiTags('Reviews & Ratings')
@Controller('reviews')
export class ReviewsController {
  constructor(private readonly reviewsService: ReviewsService) {}

  @ApiBearerAuth()
  @UseGuards(JwtAuthGuard)
  @Post()
  @ApiOperation({ summary: 'Write a review for a completed service' })
  createReview(@CurrentUser() user: UserPayload, @Body() dto: CreateReviewDto) {
    return this.reviewsService.createReview(user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all reviews across the platform' })
  findAll() {
    return this.reviewsService.findAll();
  }

  @Get('technician/:id')
  @ApiOperation({ summary: 'Get all reviews for a specific technician' })
  findByTechnician(@Param('id') id: string) {
    return this.reviewsService.findByTechnician(id);
  }
}
