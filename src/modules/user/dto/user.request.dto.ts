import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
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
import { BaseFilterQueryDto } from 'src/common/dto';
import {
  ICreateWebUser,
  IListUsersQuery,
  IUpdateUserBranchId,
  LoginChannel,
} from 'types/user.types';

export { LoginChannel } from 'types/user.types';

/** POST /users — admin creates web staff (WEB loginChannel roles only). */
export class CreateUserDto implements ICreateWebUser {
  @ApiProperty({ type: String, example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ type: String, example: 'john.doe@example.com' })
  @IsEmail()
  @IsNotEmpty()
  email: string;

  @ApiProperty({
    type: String,
    example: '123e4567-e89b-12d3-a456-426614174000',
  })
  @IsUUID()
  @IsNotEmpty()
  roleId: string;

  @ApiProperty({ type: String, example: 'Password123!' })
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

  @ApiProperty({ type: String, example: '+919876543210', required: false })
  @IsOptional()
  @IsMobilePhone('en-IN')
  mobile?: string;
}

export class UpdateUserDto extends PartialType(
  OmitType(CreateUserDto, ['email'] as const),
) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** GET /users — pagination, search, sort, and user filters. */
export class ListUsersQueryDto
  extends BaseFilterQueryDto
  implements IListUsersQuery
{
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  isApproved?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ enum: LoginChannel })
  @IsOptional()
  @IsEnum(LoginChannel)
  loginChannel?: LoginChannel;
}

/** PATCH /users/:id/branch — admin fixes branch assignment for mobile users. */
export class UpdateUserBranchIdDto implements IUpdateUserBranchId {
  @IsUUID()
  @IsNotEmpty()
  branchId: string;
}
