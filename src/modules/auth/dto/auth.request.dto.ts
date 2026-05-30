import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsJWT,
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  IsUUID,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';
import {
  AuthClient,
  ICreateWebUser,
  IGoogleLogin,
  IRefreshToken,
  IRegisterGoogle,
  IRegisterVerifyEmailOtp,
  ISendEmailOtp,
  IVerifyEmailOtp,
  IWebLogin,
  MOBILE_AUTH_CLIENTS,
  MobileAuthClient,
} from 'types/auth.types';

export {
  AuthClient,
  CLIENT_TO_ROLE_NAME,
  MOBILE_AUTH_CLIENTS,
  type MobileAuthClient,
} from 'types/auth.types';

/** POST /auth/login — existing web users (admin-created staff). */
export class LoginDto implements IWebLogin {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

/** POST /auth/email/send-otp — returning mobile user. */
export class SendEmailOtpDto implements ISendEmailOtp {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(AuthClient)
  @IsIn(MOBILE_AUTH_CLIENTS)
  client: MobileAuthClient;
}

/** POST /auth/email/verify-otp — returning mobile user. */
export class VerifyEmailOtpDto implements IVerifyEmailOtp {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Type(() => Number)
  @Min(100000, { message: 'OTP must be a 6-digit number' })
  @Max(999999, { message: 'OTP must be a 6-digit number' })
  otp: number;

  @IsEnum(AuthClient)
  @IsIn(MOBILE_AUTH_CLIENTS)
  client: MobileAuthClient;
}

/** POST /auth/google — returning mobile user. */
export class GoogleLoginDto implements IGoogleLogin {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsEnum(AuthClient)
  @IsIn(MOBILE_AUTH_CLIENTS)
  client: MobileAuthClient;
}

/** POST /auth/register/email/send-otp */
export class RegisterSendEmailOtpDto implements ISendEmailOtp {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(AuthClient)
  @IsIn(MOBILE_AUTH_CLIENTS)
  client: MobileAuthClient;
}

/** POST /auth/register/email/verify-otp — creates User with roleId from client. */
export class RegisterVerifyEmailOtpDto implements IRegisterVerifyEmailOtp {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Type(() => Number)
  @Min(100000, { message: 'OTP must be a 6-digit number' })
  @Max(999999, { message: 'OTP must be a 6-digit number' })
  otp: number;

  @IsEnum(AuthClient)
  @IsIn(MOBILE_AUTH_CLIENTS)
  client: MobileAuthClient;

  @IsString()
  @IsNotEmpty()
  name: string;

  @ValidateIf(
    (dto: RegisterVerifyEmailOtpDto) =>
      dto.client === AuthClient.BANK_MANAGER_APP,
  )
  @IsUUID()
  @IsNotEmpty()
  bankId?: string;

  @IsOptional()
  @IsMobilePhone('en-IN')
  mobile?: string;
}

/** POST /auth/register/google — creates User on first Google sign-in. */
export class RegisterGoogleDto implements IRegisterGoogle {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsEnum(AuthClient)
  @IsIn(MOBILE_AUTH_CLIENTS)
  client: MobileAuthClient;

  @IsString()
  @IsNotEmpty()
  name: string;

  @ValidateIf(
    (dto: RegisterGoogleDto) => dto.client === AuthClient.BANK_MANAGER_APP,
  )
  @IsUUID()
  @IsNotEmpty()
  bankId?: string;

  @IsOptional()
  @IsMobilePhone('en-IN')
  mobile?: string;
}

/** POST /auth/refresh */
export class RefreshTokenDto implements IRefreshToken {
  @IsString()
  @IsNotEmpty()
  @IsJWT({ message: 'Invalid refresh token' })
  refreshToken: string;
}

/**
 * Admin web portal — create staff users (WEB loginChannel roles only).
 * BANK_MANAGER / SITE_ENGINEER self-register on mobile.
 */
export class CreateWebUserDto implements ICreateWebUser {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsUUID()
  @IsNotEmpty()
  roleId: string;

  @IsString()
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
    minLowercase: 1,
  })
  password: string;

  @IsOptional()
  @IsMobilePhone('en-IN')
  mobile?: string;
}
