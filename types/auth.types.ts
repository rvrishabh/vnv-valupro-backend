export interface IAuth {
  id?: string;
  email: string;
  password?: string;
  mobile?: string;
  otp?: number;
  name?: string;
  authMethod: AUTH_METHOD;
  tokens?: IAuthTokens;
  refreshToken?: string;
  role: ROLE;
  isVerified: boolean;
  status?: USER_STATUS;
  failedLoginAttempts?: number;
  lockedUntil?: Date;
  otpExpiresAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export enum AUTH_METHOD {
  EMAIL = 'email',
  MOBILE = 'mobile',
}

export enum ROLE {
  ADMIN = 'admin',
  CHECKER = 'checker',
  BANK_MANAGER = 'bank_manager',
  SITE_ENGINEER = 'site_engineer',
}

export enum USER_STATUS {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}

export type IAuthLogin = Pick<IAuth, 'email' | 'password' | 'authMethod'>;

export type IAuthLoginMobile = Pick<IAuth, 'mobile' | 'authMethod'>;
export type IVerifyOtp = Pick<IAuth, 'mobile' | 'otp'>;
