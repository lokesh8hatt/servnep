import { Controller, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, Length } from 'class-validator';
import { UserRole } from '../users/entities/user.entity';

class RequestOtpDto {
  @ApiProperty({ example: '9841234567', description: 'Nepalese phone number' })
  @IsNotEmpty()
  @IsString()
  @Length(10, 15)
  phoneNumber: string;
}

class VerifyOtpDto {
  @ApiProperty({ example: '9841234567', description: 'Phone number' })
  @IsNotEmpty()
  @IsString()
  phoneNumber: string;

  @ApiProperty({ example: '123456', description: '6-digit OTP code' })
  @IsNotEmpty()
  @IsString()
  @Length(6, 6)
  otpCode: string;
}

class DevLoginDto {
  @ApiProperty({ example: 'CUSTOMER', enum: ['CUSTOMER', 'TECHNICIAN', 'ADMIN', 'DISPATCHER'] })
  @IsNotEmpty()
  @IsString()
  @IsIn(['CUSTOMER', 'TECHNICIAN', 'ADMIN', 'DISPATCHER'])
  role: UserRole;
}

@ApiTags('Authentication')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('request-otp')
  @ApiOperation({ summary: 'Request a one-time password (OTP) via SMS' })
  requestOtp(@Body() dto: RequestOtpDto) {
    return this.authService.requestOtp(dto.phoneNumber);
  }

  @Public()
  @Post('verify-otp')
  @ApiOperation({ summary: 'Verify OTP and return JWT session tokens' })
  verifyOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyOtp(dto.phoneNumber, dto.otpCode);
  }

  @Public()
  @Post('dev-login')
  @ApiOperation({ summary: 'Instant one-click login with no OTP, for local demo/testing only (403 in production)' })
  devLogin(@Body() dto: DevLoginDto) {
    return this.authService.devLogin(dto.role);
  }

  @Post('logout')
  @HttpCode(200)
  @ApiOperation({ summary: 'Invalidate current session token' })
  logout(@Headers('authorization') authHeader: string) {
    const token = authHeader?.replace('Bearer ', '');
    if (!token) {
      return { message: 'No active session to invalidate' };
    }
    return this.authService.logout(token);
  }
}
