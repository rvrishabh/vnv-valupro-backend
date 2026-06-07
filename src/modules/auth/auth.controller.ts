import { Controller } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // @Post('register/email/send-otp')
  // registerSendEmailOtp(@Body() dto: RegisterSendEmailOtpDto) {
  //   return this.authService.registerSendEmailOtp(dto);
  // }

  // @Post('email/send-otp')
  // sendEmailOtp(@Body() dto: SendEmailOtpDto) {
  //   return this.authService.sendEmailOtp(dto);
  // }
}
