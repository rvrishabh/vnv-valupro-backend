import { Injectable } from '@nestjs/common';
import { SendOtpDto } from 'src/modules/auth/dto';

@Injectable()
export class AuthService {
  sendOtp(dto: SendOtpDto) {
    const { mobile } = dto;
    const otp = Math.floor(100000 + Math.random() * 900000);
    // await this.redisService.set(mobile, otp, { EX: 60 * 5 });
    return {
      message: 'OTP sent to mobile',
      data: {
        otp,
      },
    };
  }
}
