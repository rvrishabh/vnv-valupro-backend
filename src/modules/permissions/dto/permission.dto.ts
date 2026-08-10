import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreatePermissionDto {
  @ApiProperty({ example: 'CASE_CREATE' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'case' })
  @IsString()
  @IsNotEmpty()
  resource: string;

  @ApiProperty({ example: 'create' })
  @IsString()
  @IsNotEmpty()
  action: string;

  @ApiPropertyOptional({ example: 'Allows creating a new case' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdatePermissionDto extends PartialType(CreatePermissionDto) {}
