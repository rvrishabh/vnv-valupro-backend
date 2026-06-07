import { AUTH_METHOD } from './auth.types';

export enum LoginChannel {
  WEB = 'WEB',
  MOBILE = 'MOBILE',
}

export interface IUserRole {
  id: string;
  name: string;
  loginChannel: LoginChannel;
  isSystem: boolean;
}

export interface IUserBank {
  id: string;
  name: string;
  code: string;
}

/** Safe user shape for API responses (no passwordHash, googleId, fcmToken). */
export interface IUser {
  id: string;
  name: string;
  email: string;
  mobile?: string | null;
  roleId: string;
  role?: IUserRole;
  isActive: boolean;
  isApproved: boolean;
  bankId?: string | null;
  bank?: IUserBank | null;
  authMethod?: AUTH_METHOD | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}

/** POST /users — admin creates web staff (WEB loginChannel roles only). */
export interface ICreateWebUser {
  name: string;
  email: string;
  roleId: string;
  password: string;
  mobile?: string;
}

/** PATCH /users/:id — update web staff fields. */
export interface IUpdateWebUser {
  name?: string;
  email?: string;
  mobile?: string;
  roleId?: string;
  password?: string;
  isActive?: boolean;
}

/** GET /users query filters. */
export interface IListUsersQuery {
  isApproved?: boolean;
  isActive?: boolean;
  roleId?: string;
  loginChannel?: LoginChannel;
  search?: string;
}

/** PATCH /users/:id/bank — admin fixes bank assignment for mobile users. */
export interface IUpdateUserBankId {
  bankId: string;
}
