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

export type OtpChannel = 'email' | 'whatsapp';

export type ISendMobileLoginOtp = Pick<IAuth, 'email'> & {
  client: MobileAuthClient;
  /** Delivery channel. Defaults to email. WhatsApp requires mobile. */
  channel?: OtpChannel;
  /** Required when channel is whatsapp (or used as WhatsApp destination). */
  mobile?: string;
};

export type IVerifyMobileLoginOtp = Pick<IAuth, 'email'> & {
  otp: number;
  client: MobileAuthClient;
};

export interface IManualBranchInput {
  institutionId: string;
  branchName: string;
  city: string;
  state: string;
  address?: string;
}

/** Mobile register verify — OTP only; profile completed via user update API. */
export type IRegisterVerifyMobileOtp = Pick<IAuth, 'email' | 'mobile'> & {
  otp: number;
  client: MobileAuthClient;
};

/** Alias used by register send-otp (same payload shape as login send). */
export type ISendMobileRegisterOtp = ISendMobileLoginOtp;

export interface IGoogleLogin {
  idToken: string;
  client: MobileAuthClient;
}

export interface IRegisterGoogle {
  idToken: string;
  client: MobileAuthClient;
  name: string;
  ifscCode?: string;
  institutionId?: string;
  branchId?: string;
  manualBranch?: IManualBranchInput;
  mobile?: string;
}

export interface IRefreshToken {
  refreshToken: string;
}

export interface IAuthTokens {
  accessToken: string;
  refreshToken: string;
}
