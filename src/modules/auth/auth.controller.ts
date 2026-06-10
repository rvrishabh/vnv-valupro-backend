import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AuthService } from './auth.service';
import {
  RegisterGoogleDto,
  RegisterSendEmailOtpDto,
  RegisterVerifyEmailOtpDto,
  SendEmailOtpDto,
} from './dto/auth.request.dto';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/email/send-otp')
  registerSendEmailOtp(@Body() data: RegisterSendEmailOtpDto) {
    return this.authService.registerSendEmailOtp(data);
  }

  @Post('register/email/verify-otp')
  registerVerifyEmailOtp(@Body() data: RegisterVerifyEmailOtpDto) {
    return this.authService.registerVerifyEmailOtp(data);
  }

  @Post('register/google')
  registerGoogle(@Body() data: RegisterGoogleDto) {
    return this.authService.registerGoogle(data);
  }

  @Post('email/send-otp')
  sendEmailOtp(@Body() data: SendEmailOtpDto) {
    return this.authService.sendEmailOtp(data);
  }
}
