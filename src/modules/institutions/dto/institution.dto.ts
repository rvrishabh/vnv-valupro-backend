import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { BaseFilterQueryDto } from 'src/common/dto';
import { IListInstitutionsQuery } from 'types/institution.types';

export class CreateInstitutionDto {
  @ApiProperty({ example: 'Bajaj Finance' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 'BAJAJ' })
  @IsString()
  @IsNotEmpty()
  code: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  institutionTypeId: string;
}

export class UpdateInstitutionDto extends PartialType(CreateInstitutionDto) {
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class FilterInstitutionDto
  extends BaseFilterQueryDto
  implements IListInstitutionsQuery
{
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  institutionTypeId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(
    ({ value }: { value: unknown }) => value === 'true' || value === true,
  )
  @IsBoolean()
  isActive?: boolean;
}
