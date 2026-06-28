import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  LoginDto,
  RefreshTokenDto,
  RegisterSendEmailOtpDto,
  RegisterVerifyEmailOtpDto,
  SendEmailOtpDto,
  VerifyEmailOtpDto,
} from './dto/auth.request.dto';
import { AuthService } from './services/auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(@Body() data: LoginDto) {
    return this.authService.login(data);
  }

  @Post('register/email/send-otp')
  registerSendEmailOtp(@Body() data: RegisterSendEmailOtpDto) {
    return this.authService.registerSendEmailOtp(data);
  }

  @Post('register/email/verify-otp')
  registerVerifyEmailOtp(@Body() data: RegisterVerifyEmailOtpDto) {
    return this.authService.registerVerifyEmailOtp(data);
  }

  @Post('email/send-otp')
  sendEmailOtp(@Body() data: SendEmailOtpDto) {
    return this.authService.sendEmailOtp(data);
  }

  @Post('email/verify-otp')
  verifyEmailOtp(@Body() data: VerifyEmailOtpDto) {
    return this.authService.verifyEmailOtp(data);
  }

  @Post('refresh')
  refreshTokens(@Body() data: RefreshTokenDto) {
    return this.authService.refreshTokens(data);
  }

  @Post('logout')
  logout() {
    return this.authService.logout();
  }
}
