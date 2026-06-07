import { AUTH_METHOD } from 'types/auth.types';
import { IUser, IUserBank, IUserRole, LoginChannel } from 'types/user.types';

export class UserRoleDto implements IUserRole {
  id: string;
  name: string;
  loginChannel: LoginChannel;
  isSystem: boolean;
}

export class UserBankDto implements IUserBank {
  id: string;
  name: string;
  code: string;
}

export class UserResponseDto implements IUser {
  id: string;
  name: string;
  email: string;
  mobile?: string | null;
  roleId: string;
  role?: UserRoleDto;
  isActive: boolean;
  isApproved: boolean;
  bankId?: string | null;
  bank?: UserBankDto | null;
  authMethod?: AUTH_METHOD | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}
