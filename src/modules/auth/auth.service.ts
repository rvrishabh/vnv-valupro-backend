import { Injectable } from '@nestjs/common';
import {
  RegisterSendEmailOtpDto,
  SendEmailOtpDto,
} from './dto/auth.request.dto';

@Injectable()
export class AuthService {
  registerSendEmailOtp(dto: RegisterSendEmailOtpDto) {
    const { email } = dto;
    // TODO: reject if user already exists; map dto.client → Role.name → roleId on verify
    return this.dispatchEmailOtp(email, 'registration');
  }

  sendEmailOtp(dto: SendEmailOtpDto) {
    const { email } = dto;
    // TODO: require existing user; validate user.role.name matches dto.client
    return this.dispatchEmailOtp(email, 'login');
  }

  private dispatchEmailOtp(email: string, purpose: 'registration' | 'login') {
    const otp = Math.floor(100000 + Math.random() * 900000);
    // await this.redisService.set(`otp:email:${email}`, otp, { EX: 300 });
    if (process.env.NODE_ENV !== 'production') {
      console.log(`[DEV OTP ${purpose}] ${email} => ${otp}`);
    }
    return { message: 'OTP sent to email' };
  }
}
