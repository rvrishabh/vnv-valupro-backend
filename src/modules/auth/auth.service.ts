import { Injectable } from '@nestjs/common';
import { SendEmailOtpDto } from './dto/auth.request.dto';

@Injectable()
export class AuthService {
  sendEmailOtp(dto: SendEmailOtpDto) {
    const { email } = dto;
    const otp = Math.floor(100000 + Math.random() * 900000);
    // await this.redisService.set(`otp:email:${email}`, otp, { EX: 60 * 5 });
    // await this.emailService.sendOtp(email, otp);
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV OTP] ${email} => ${otp}`);
    }
    return {
      message: 'OTP sent to email',
    };
  }
}
