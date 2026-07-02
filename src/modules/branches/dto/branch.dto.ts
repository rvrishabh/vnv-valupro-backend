import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { BaseFilterQueryDto } from 'src/common/dto';
import { IListBranchesQuery } from 'types/branch.types';

export class LookupIfscDto {
  @ApiProperty({ example: 'HDFC0001234' })
  @IsString()
  @IsNotEmpty()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, {
    message: 'IFSC code must match format AAAA0XXXXXX',
  })
  ifscCode: string;
}

export class CreateManualBranchDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  institutionId: string;

  @ApiProperty({ example: 'MG Road Branch' })
  @IsString()
  @IsNotEmpty()
  branchName: string;

  @ApiProperty({ example: 'Mumbai' })
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty({ example: 'Maharashtra' })
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiPropertyOptional({ example: 'Mumbai' })
  @IsOptional()
  @IsString()
  district?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  address?: string;
}

export class FilterBranchDto
  extends BaseFilterQueryDto
  implements IListBranchesQuery
{
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  institutionId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  needsVerification?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  isManuallyEntered?: boolean;
}

export class UpdateBranchDto extends PartialType(CreateManualBranchDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ifscCode?: string;
}
