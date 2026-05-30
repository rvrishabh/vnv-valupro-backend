import { Type } from 'class-transformer';
import {
  IsEmail,
  IsEnum,
  IsIn,
  IsJWT,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  Min,
} from 'class-validator';

/** Identifies which client is calling auth (server validates role against this). */
export enum AuthClient {
  WEB = 'web',
  BANK_MANAGER_APP = 'bank_manager_app',
  SITE_ENGINEER_APP = 'site_engineer_app',
}

const MOBILE_AUTH_CLIENTS = [
  AuthClient.BANK_MANAGER_APP,
  AuthClient.SITE_ENGINEER_APP,
] as const;

/** POST /auth/login — web portal (email + password). */
export class LoginDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

/** POST /auth/email/send-otp — bank manager & site engineer mobile apps. */
export class SendEmailOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @IsEnum(AuthClient)
  @IsIn(MOBILE_AUTH_CLIENTS)
  client?: (typeof MOBILE_AUTH_CLIENTS)[number];
}

/** POST /auth/email/verify-otp — bank manager & site engineer mobile apps. */
export class VerifyEmailOtpDto {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @Type(() => Number)
  @Min(100000, { message: 'OTP must be a 6-digit number' })
  @Max(999999, { message: 'OTP must be a 6-digit number' })
  otp: number;

  @IsOptional()
  @IsEnum(AuthClient)
  @IsIn(MOBILE_AUTH_CLIENTS)
  client?: (typeof MOBILE_AUTH_CLIENTS)[number];
}

/** POST /auth/google — mobile apps (Google ID token). */
export class GoogleLoginDto {
  @IsString()
  @IsNotEmpty()
  idToken: string;

  @IsEnum(AuthClient)
  @IsIn(MOBILE_AUTH_CLIENTS)
  client: (typeof MOBILE_AUTH_CLIENTS)[number];
}

/** POST /auth/refresh */
export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @IsJWT({ message: 'Invalid refresh token' })
  refreshToken: string;
}
