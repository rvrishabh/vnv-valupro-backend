import {
  Body,
  Controller,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import {
  LoginDto,
  RefreshTokenDto,
  RegisterSendEmailOtpDto,
  RegisterVerifyEmailOtpDto,
  SendEmailOtpDto,
  VerifyEmailOtpDto,
} from './dto/auth.request.dto';
import {
  AuthCookieReply,
  AuthCookieRequest,
  AuthCookieService,
} from './services/auth-cookie.service';
import { AuthService } from './services/auth.service';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly authCookieService: AuthCookieService,
  ) {}

  /** Web portal — sets JWTs in httpOnly cookies; returns user only. */
  @Post('login')
  async login(
    @Body() data: LoginDto,
    @Res({ passthrough: true }) reply: AuthCookieReply,
  ) {
    const { accessToken, refreshToken, user } =
      await this.authService.login(data);
    this.authCookieService.setAuthCookies(reply, accessToken, refreshToken);
    return { user };
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

  /** Web: reads refresh token from cookie. Mobile: reads from body. */
  @Post('refresh')
  async refreshTokens(
    @Req() request: AuthCookieRequest,
    @Body() data: RefreshTokenDto,
    @Res({ passthrough: true }) reply: AuthCookieReply,
  ) {
    const cookieRefresh = this.authCookieService.getRefreshToken(request);
    const refreshToken = cookieRefresh ?? data.refreshToken;

    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is required');
    }

    const result = await this.authService.refreshTokens(refreshToken);

    if (cookieRefresh) {
      this.authCookieService.setAuthCookies(
        reply,
        result.accessToken,
        result.refreshToken,
      );
      return { user: result.user };
    }

    return result;
  }

  /** Clears httpOnly auth cookies (web logout). */
  @Post('logout')
  logout(@Res({ passthrough: true }) reply: AuthCookieReply) {
    this.authCookieService.clearAuthCookies(reply);
    return this.authService.logout();
  }
}
