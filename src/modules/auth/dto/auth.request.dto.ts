import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  IsUUID,
  Matches,
  Max,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  AuthClient,
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

export class ManualBranchDto {
  @IsUUID()
  @IsNotEmpty()
  institutionId: string;

  @IsString()
  @IsNotEmpty()
  branchName: string;

  @IsString()
  @IsNotEmpty()
  city: string;

  @IsString()
  @IsNotEmpty()
  state: string;

  @IsOptional()
  @IsString()
  address?: string;
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
    (data: RegisterVerifyEmailOtpDto) =>
      data.client === AuthClient.BANK_MANAGER_APP,
  )
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'IFSC code must match format AAAA0XXXXXX',
  })
  ifscCode?: string;

  @ValidateIf(
    (data: RegisterVerifyEmailOtpDto) =>
      data.client === AuthClient.BANK_MANAGER_APP,
  )
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ValidateIf(
    (data: RegisterVerifyEmailOtpDto) =>
      data.client === AuthClient.BANK_MANAGER_APP,
  )
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ValidateIf(
    (data: RegisterVerifyEmailOtpDto) =>
      data.client === AuthClient.BANK_MANAGER_APP,
  )
  @IsOptional()
  @ValidateNested()
  @Type(() => ManualBranchDto)
  manualBranch?: ManualBranchDto;

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
    (data: RegisterGoogleDto) => data.client === AuthClient.BANK_MANAGER_APP,
  )
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'IFSC code must match format AAAA0XXXXXX',
  })
  ifscCode?: string;

  @ValidateIf(
    (data: RegisterGoogleDto) => data.client === AuthClient.BANK_MANAGER_APP,
  )
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ValidateIf(
    (data: RegisterGoogleDto) => data.client === AuthClient.BANK_MANAGER_APP,
  )
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ValidateIf(
    (data: RegisterGoogleDto) => data.client === AuthClient.BANK_MANAGER_APP,
  )
  @IsOptional()
  @ValidateNested()
  @Type(() => ManualBranchDto)
  manualBranch?: ManualBranchDto;

  @IsOptional()
  @IsMobilePhone('en-IN')
  mobile?: string;
}

/** POST /auth/refresh — refreshToken optional when sent via httpOnly cookie (web). */
export class RefreshTokenDto implements Partial<IRefreshToken> {
  @IsOptional()
  @IsString()
  @IsJWT({ message: 'Invalid refresh token' })
  refreshToken?: string;
}
