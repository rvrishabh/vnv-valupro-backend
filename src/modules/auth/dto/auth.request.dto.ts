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
  IRegisterVerifyMobileOtp,
  ISendMobileLoginOtp,
  ISendMobileRegisterOtp,
  IVerifyMobileLoginOtp,
  IWebLogin,
  MOBILE_AUTH_CLIENTS,
  MobileAuthClient,
  OtpChannel,
} from 'types/auth.types';

export {
  AuthClient,
  CLIENT_TO_ROLE_NAME,
  MOBILE_AUTH_CLIENTS,
  type MobileAuthClient,
} from 'types/auth.types';

const isBankManagerClient = (data: { client?: MobileAuthClient }) =>
  data.client === AuthClient.BANK_MANAGER_APP;

/** POST /auth/login — existing web users (admin-created staff). */
export class LoginDto implements IWebLogin {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  password: string;
}

/** POST /auth/mobile/login/send-otp — returning mobile user. */
export class SendMobileLoginOtpDto implements ISendMobileLoginOtp {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(AuthClient)
  @IsIn(MOBILE_AUTH_CLIENTS)
  client: MobileAuthClient;

  @IsOptional()
  @IsIn(['email', 'whatsapp'])
  channel?: OtpChannel;

  @ValidateIf((data: { channel?: OtpChannel }) => data.channel === 'whatsapp')
  @IsMobilePhone('en-IN')
  @IsNotEmpty()
  mobile?: string;
}

/** POST /auth/mobile/login/verify-otp — returning mobile user. */
export class VerifyMobileLoginOtpDto implements IVerifyMobileLoginOtp {
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

/** POST /auth/mobile/register/send-otp */
export class SendMobileRegisterOtpDto implements ISendMobileRegisterOtp {
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsEnum(AuthClient)
  @IsIn(MOBILE_AUTH_CLIENTS)
  client: MobileAuthClient;

  @IsOptional()
  @IsIn(['email', 'whatsapp'])
  channel?: OtpChannel;

  @ValidateIf((data: { channel?: OtpChannel }) => data.channel === 'whatsapp')
  @IsMobilePhone('en-IN')
  @IsNotEmpty()
  mobile?: string;
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

/** POST /auth/mobile/register/verify-otp — creates User; profile via user update. */
export class VerifyMobileRegisterOtpDto implements IRegisterVerifyMobileOtp {
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

  @ValidateIf(isBankManagerClient)
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'IFSC code must match format AAAA0XXXXXX',
  })
  ifscCode?: string;

  @ValidateIf(isBankManagerClient)
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ValidateIf(isBankManagerClient)
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ValidateIf(isBankManagerClient)
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
