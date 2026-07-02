import { AUTH_METHOD } from 'types/auth.types';
import {
  IUser,
  IUserBranch,
  IUserInstitution,
  IUserInstitutionType,
  IUserRole,
  LoginChannel,
} from 'types/user.types';

export class UserRoleDto implements IUserRole {
  id: string;
  name: string;
  loginChannel: LoginChannel;
  isSystem: boolean;
}

export class UserInstitutionTypeDto implements IUserInstitutionType {
  id: string;
  name: string;
}

export class UserInstitutionDto implements IUserInstitution {
  id: string;
  name: string;
  code: string;
  institutionType?: UserInstitutionTypeDto;
}

export class UserBranchDto implements IUserBranch {
  id: string;
  branchName: string;
  city: string;
  state: string;
  needsVerification: boolean;
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
  institutionId?: string | null;
  institution?: UserInstitutionDto | null;
  branchId?: string | null;
  branch?: UserBranchDto | null;
  authMethod?: AUTH_METHOD | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}
