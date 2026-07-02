import { Module, forwardRef } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { BranchesModule } from '../branches/branches.module';
import { InstitutionsModule } from '../institutions/institutions.module';
import { UserModule } from '../user/user.module';
import { AuthController } from './auth.controller';
import { AdminGuard } from './guards/admin.guard';
import { JwtAuthGuard } from './guards/jwt-auth.guard';
import { AuthService } from './services/auth.service';
import { AuthCookieService } from './services/auth-cookie.service';
import { OtpService } from './services/otp.service';
import { TokenService } from './services/token.service';
import { JwtStrategy } from './strategies/jwt.strategy';

@Module({
  imports: [
    UserModule,
    forwardRef(() => InstitutionsModule),
    forwardRef(() => BranchesModule),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AuthCookieService,
    OtpService,
    TokenService,
    JwtStrategy,
    JwtAuthGuard,
    AdminGuard,
  ],
  exports: [
    AuthService,
    AuthCookieService,
    JwtAuthGuard,
    AdminGuard,
    TokenService,
  ],
})
export class AuthModule {}
