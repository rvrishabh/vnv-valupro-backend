import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { LoginChannel } from 'generated/prisma/client';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { BaseFilterQueryDto } from 'src/common/dto';
import { IListRolesQuery } from 'types/role.types';

export class CreateRoleDto {
  @ApiProperty({ example: 'BRANCH_MANAGER' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Manages branch-level operations' })
  @IsOptional()
  @IsString()
  description?: string;

  @ApiProperty({ enum: LoginChannel, example: LoginChannel.WEB })
  @IsEnum(LoginChannel)
  loginChannel: LoginChannel;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isSystem?: boolean;
}

export class UpdateRoleDto extends PartialType(CreateRoleDto) {}

export class AssignPermissionsDto {
  @ApiProperty({ example: ['b3f1c8b0-...'], type: [String] })
  @IsArray()
  @IsUUID('4', { each: true })
  permissionIds: string[];
}

export class FilterRoleDto
  extends BaseFilterQueryDto
  implements IListRolesQuery
{
  @ApiPropertyOptional({ enum: LoginChannel })
  @IsOptional()
  @IsEnum(LoginChannel)
  loginChannel?: LoginChannel;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : value === 'true' || value === true,
  )
  @IsBoolean()
  isSystem?: boolean;
}
