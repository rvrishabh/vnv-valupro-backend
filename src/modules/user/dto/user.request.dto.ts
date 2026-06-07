import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsEnum,
  IsMobilePhone,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  IsUUID,
} from 'class-validator';
import {
  ICreateWebUser,
  IListUsersQuery,
  IUpdateUserBankId,
  IUpdateWebUser,
  LoginChannel,
} from 'types/user.types';

export { LoginChannel } from 'types/user.types';

/** POST /users — admin creates web staff (WEB loginChannel roles only). */
export class CreateUserDto implements ICreateWebUser {
  @IsString()
  @IsNotEmpty()
  name: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsUUID()
  @IsNotEmpty()
  roleId: string;

  @IsString()
  @IsNotEmpty()
  @IsStrongPassword({
    minLength: 8,
    minNumbers: 1,
    minSymbols: 1,
    minUppercase: 1,
    minLowercase: 1,
  })
  password: string;

  @IsOptional()
  @IsMobilePhone('en-IN')
  mobile?: string;
}

/** PATCH /users/:id — update web staff. */
export class UpdateUserDto implements IUpdateWebUser {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  name?: string;

  @IsMobilePhone('en-IN')
  mobile?: string;

  @IsOptional()
  @IsUUID()
  @IsNotEmpty()
  roleId?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** GET /users — filter and search. */
export class ListUsersQueryDto implements IListUsersQuery {
  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isApproved?: boolean;

  @IsOptional()
  @Type(() => Boolean)
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsUUID()
  roleId?: string;

  @IsOptional()
  @IsEnum(LoginChannel)
  loginChannel?: LoginChannel;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  search?: string;
}

/** PATCH /users/:id/bank — admin fixes bank assignment for mobile users. */
export class UpdateUserBankIdDto implements IUpdateUserBankId {
  @IsUUID()
  @IsNotEmpty()
  bankId: string;
}
