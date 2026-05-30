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

export const MOBILE_AUTH_CLIENTS = [
  AuthClient.BANK_MANAGER_APP,
  AuthClient.SITE_ENGINEER_APP,
] as const;

export type MobileAuthClient = (typeof MOBILE_AUTH_CLIENTS)[number];

/** Server-side map: mobile app client → seeded Role.name */
export const CLIENT_TO_ROLE_NAME: Record<MobileAuthClient, string> = {
  [AuthClient.BANK_MANAGER_APP]: 'BANK_MANAGER',
  [AuthClient.SITE_ENGINEER_APP]: 'SITE_ENGINEER',
};

export interface IAuth {
  id?: string;
  name: string;
  email: string;
  mobile?: string;
}

export type IWebLogin = Required<Pick<IAuth, 'email'>> & {
  password: string;
};

export type ISendEmailOtp = Pick<IAuth, 'email'> & {
  client: MobileAuthClient;
};

export type IVerifyEmailOtp = Pick<IAuth, 'email'> & {
  otp: number;
  client: MobileAuthClient;
};

export interface IMobileRegister {
  email: string;
  client: MobileAuthClient;
  name: string;
  bankId?: string;
  mobile?: string;
}

export type IRegisterVerifyEmailOtp = IMobileRegister & {
  otp: number;
};

export interface IGoogleLogin {
  idToken: string;
  client: MobileAuthClient;
}

export interface IRegisterGoogle {
  idToken: string;
  client: MobileAuthClient;
  name: string;
  bankId?: string;
  mobile?: string;
}

export interface IRefreshToken {
  refreshToken: string;
}

export interface ICreateWebUser {
  name: string;
  email: string;
  roleId: string;
  password: string;
  mobile?: string;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}
