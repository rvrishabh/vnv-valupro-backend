import { Body, Controller, Post } from '@nestjs/common';
import { SendOtpDto } from 'src/modules/auth/dto/auth.request.dto';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('mobile/send-otp')
  sendOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendOtp(dto);
  }
}
