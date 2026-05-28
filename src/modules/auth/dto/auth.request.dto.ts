import {
  IsEnum,
  IsJWT,
  IsMobilePhone,
  IsNotEmpty,
  IsNumber,
  IsString,
  Max,
  Min,
} from 'class-validator';
import { AUTH_METHOD, IAuthLoginMobile } from 'types/auth.types';

export class SendOtpDto implements IAuthLoginMobile {
  @IsString()
  @IsNotEmpty()
  @IsMobilePhone('en-IN')
  mobile: string;

  @IsEnum(AUTH_METHOD)
  @IsNotEmpty()
  authMethod: AUTH_METHOD;
}

export class VerifyOtpDto {
  @IsNotEmpty()
  @IsNumber()
  @Min(100000, { message: 'OTP must be a 6-digit number' })
  @Max(999999, { message: 'OTP must be a 6-digit number' })
  otp: number;

  @IsString()
  @IsNotEmpty()
  @IsMobilePhone('en-IN')
  mobile: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  @IsJWT({ message: 'Invalid refresh token' })
  refreshToken: string;
}
