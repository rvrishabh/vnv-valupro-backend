import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { SendEmailOtpDto } from './dto/auth.request.dto';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('email/send-otp')
  sendEmailOtp(@Body() dto: SendEmailOtpDto) {
    return this.authService.sendEmailOtp(dto);
  }
}
