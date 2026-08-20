import { Controller, Post, Body, Headers, HttpCode } from '@nestjs/common';
import { AuthService } from './auth.service';
import { Public } from '../../common/decorators/public.decorator';
import { ApiTags, ApiOperation, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsIn, IsEmail, Length, MinLength, MaxLength, Matches } from 'class-validator';
import { UserRole } from '../users/entities/user.entity';

// Digits only — phoneNumber ends up stored on User and later rendered as
// customerPhone in the booking invoice, so this also closes off one of the
// inputs an attacker could otherwise use to inject markup there.
const PHONE_PATTERN = /^[0-9]+$/;

class RegisterDto {
  @ApiProperty({ example: 'sabin@gmail.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'a-strong-password' })
  @IsNotEmpty()
  @MinLength(8)
  password: string;

  @ApiProperty({ example: 'Sabin Shrestha' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  fullName: string;
}

class RefreshDto {
  @ApiProperty({ example: 'eyJhbGciOi...' })
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}

class LoginEmailDto {
  @ApiProperty({ example: 'sabin@gmail.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'a-strong-password' })
  @IsNotEmpty()
  @IsString()
  password: string;
}

class ForgotPasswordDto {
  @ApiProperty({ example: 'sabin@gmail.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;
}

class ResetPasswordDto {
  @ApiProperty({ example: 'sabin@gmail.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: '123456' })
  @IsNotEmpty()
  @Length(6, 6)
  otpCode: string;

  @ApiProperty({ example: 'a-new-strong-password' })
  @IsNotEmpty()
  @MinLength(8)
  newPassword: string;
}

class RequestOtpDto {
  @ApiProperty({ example: '9841234567', description: 'Nepalese phone number' })
  @IsNotEmpty()
  @IsString()
  @Length(10, 15)
  @Matches(PHONE_PATTERN, { message: 'Phone number must contain digits only' })
  phoneNumber: string;
}

class VerifyOtpDto {
  @ApiProperty({ example: '9841234567', description: 'Phone number' })
  @IsNotEmpty()
  @IsString()
  @Length(10, 15)
  @Matches(PHONE_PATTERN, { message: 'Phone number must contain digits only' })
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
  @Post('register')
  @ApiOperation({ summary: 'Create an account with email + password' })
  register(@Body() dto: RegisterDto) {
    return this.authService.register(dto.email, dto.password, dto.fullName);
  }

  @Public()
  @Post('login')
  @ApiOperation({ summary: 'Log in with email + password' })
  loginEmail(@Body() dto: LoginEmailDto) {
    return this.authService.loginWithEmail(dto.email, dto.password);
  }

  @Public()
  @Post('forgot-password')
  @ApiOperation({ summary: 'Request a password reset code via email' })
  forgotPassword(@Body() dto: ForgotPasswordDto) {
    return this.authService.forgotPassword(dto.email);
  }

  @Public()
  @Post('reset-password')
  @ApiOperation({ summary: 'Reset password using the emailed code' })
  resetPassword(@Body() dto: ResetPasswordDto) {
    return this.authService.resetPassword(dto.email, dto.otpCode, dto.newPassword);
  }

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

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Exchange a refresh token for a fresh access token' })
  refresh(@Body() dto: RefreshDto) {
    return this.authService.refreshSession(dto.refreshToken);
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
