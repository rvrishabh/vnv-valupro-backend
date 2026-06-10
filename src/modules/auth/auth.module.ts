import { Module } from '@nestjs/common';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { GoogleAuthService } from './services/google-auth.service';
import { OtpService } from './services/otp.service';

@Module({
  imports: [UserModule],
  controllers: [AuthController],
  providers: [AuthService, OtpService, GoogleAuthService],
})
export class AuthModule {}
