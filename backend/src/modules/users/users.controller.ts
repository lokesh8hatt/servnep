import { Controller, Get, Put, Patch, Post, Body, UseGuards } from '@nestjs/common';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser, UserPayload } from '../../common/decorators/user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsNumber, IsOptional } from 'class-validator';

class UpdateProfileDto {
  @ApiProperty({ example: 'Sabin Shrestha' })
  @IsNotEmpty()
  @IsString()
  fullName: string;
}

class CreateAddressDto {
  @ApiProperty({ example: 'Home' })
  @IsNotEmpty()
  @IsString()
  label: string;

  @ApiProperty({ example: 'Lazimpat Rd, Ward 2' })
  @IsNotEmpty()
  @IsString()
  street: string;

  @ApiProperty({ example: 'Kathmandu' })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiProperty({ example: 27.7196, required: false })
  @IsOptional()
  @IsNumber()
  lat?: number;

  @ApiProperty({ example: 85.3240, required: false })
  @IsOptional()
  @IsNumber()
  lng?: number;
}

class UpdateLocationDto {
  @ApiProperty({ example: 27.7196 })
  @IsNotEmpty()
  @IsNumber()
  lat: number;

  @ApiProperty({ example: 85.3240 })
  @IsNotEmpty()
  @IsNumber()
  lng: number;
}

class UpdateAvailabilityDto {
  @ApiProperty({ example: true })
  @IsNotEmpty()
  isAvailable: boolean;
}

class UpdateTechnicianSettingsDto {
  @ApiProperty({ example: ['Plumbing', 'Electrical'], required: false })
  @IsOptional()
  @IsString({ each: true })
  specialties?: string[];

  @ApiProperty({ example: 15, required: false })
  @IsOptional()
  @IsNumber()
  serviceRadiusKm?: number;
}

@ApiTags('Users & Profiles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('profile')
  @ApiOperation({ summary: 'Get current logged in user details' })
  getProfile(@CurrentUser() user: UserPayload) {
    return this.usersService.getProfile(user.sub);
  }

  @Put('profile')
  @ApiOperation({ summary: 'Update customer personal profile' })
  updateProfile(@CurrentUser() user: UserPayload, @Body() dto: UpdateProfileDto) {
    return this.usersService.updateProfile(user.sub, dto);
  }

  @Get('addresses')
  @ApiOperation({ summary: 'Get saved delivery/service addresses' })
  getAddresses(@CurrentUser() user: UserPayload) {
    return this.usersService.getAddresses(user.sub);
  }

  @Post('addresses')
  @ApiOperation({ summary: 'Add a new service address' })
  addAddress(@CurrentUser() user: UserPayload, @Body() dto: CreateAddressDto) {
    return this.usersService.addAddress(user.sub, {
      label: dto.label,
      street: dto.street,
      city: dto.city,
      lat: dto.lat ?? 0,
      lng: dto.lng ?? 0,
    });
  }

  @Patch('me/location')
  @Roles('TECHNICIAN')
  @ApiOperation({ summary: "Push the technician's current GPS position, for the customer's live map" })
  updateMyLocation(@CurrentUser() user: UserPayload, @Body() dto: UpdateLocationDto) {
    return this.usersService.updateMyLocation(user.sub, dto.lat, dto.lng);
  }

  @Get('me/technician-profile')
  @Roles('TECHNICIAN')
  @ApiOperation({ summary: "Get the technician's own availability/specialties/service radius" })
  getMyTechnicianProfile(@CurrentUser() user: UserPayload) {
    return this.usersService.getMyTechnicianProfile(user.sub);
  }

  @Patch('me/availability')
  @Roles('TECHNICIAN')
  @ApiOperation({ summary: 'Go online/offline for new job broadcasts' })
  updateAvailability(@CurrentUser() user: UserPayload, @Body() dto: UpdateAvailabilityDto) {
    return this.usersService.updateAvailability(user.sub, dto.isAvailable);
  }

  @Patch('me/technician-settings')
  @Roles('TECHNICIAN')
  @ApiOperation({ summary: 'Set which services this technician handles and how far they travel' })
  updateTechnicianSettings(@CurrentUser() user: UserPayload, @Body() dto: UpdateTechnicianSettingsDto) {
    return this.usersService.updateTechnicianSettings(user.sub, dto);
  }
}
