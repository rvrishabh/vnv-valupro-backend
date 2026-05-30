export enum AUTH_METHOD {
  PASSWORD = 'PASSWORD',
  EMAIL_OTP = 'EMAIL_OTP',
  GOOGLE = 'GOOGLE',
}

export enum AuthClient {
  WEB = 'web',
  BANK_MANAGER_APP = 'bank_manager_app',
  SITE_ENGINEER_APP = 'site_engineer_app',
}

export interface IUser {
  id?: string;
  name: string;
  email: string;
  roleId: string;
  password?: string;
  mobile?: string;
  bankId?: string;
  isActive?: boolean;
  isApproved?: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

export type IWebLogin = Pick<IUser, 'email' | 'password'>;
export type ISendEmailOtp = Pick<IUser, 'email'>;
export type IVerifyEmailOtp = Pick<IUser, 'email'> & { otp: number };

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}
