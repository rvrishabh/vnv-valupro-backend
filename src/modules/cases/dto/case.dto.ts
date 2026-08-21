import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { BaseFilterQueryDto } from 'src/common/dto';

const PROPERTY_TYPES = {
  RESIDENTIAL: 'RESIDENTIAL',
  COMMERCIAL: 'COMMERCIAL',
  LAND: 'LAND',
  INDUSTRIAL: 'INDUSTRIAL',
};

export class CreateCaseDto {
  @ApiProperty({ example: 'Smt. Mukta Agarwal' })
  @IsString()
  @IsNotEmpty()
  customerName: string;

  @ApiProperty({ example: '9412734044' })
  @Matches(/^[0-9]{10}$/, { message: 'customerMobile must be a 10 digit number' })
  customerMobile: string;

  @ApiProperty()
  @IsUUID()
  institutionId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiProperty({ enum: Object.keys(PROPERTY_TYPES) })
  @IsEnum(PROPERTY_TYPES)
  propertyType: keyof typeof PROPERTY_TYPES;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  propertyLocation?: string;

  @ApiPropertyOptional({ description: "Bank's own loan/case number" })
  @IsOptional()
  @IsString()
  bankReference?: string;

  @ApiPropertyOptional({ description: 'Engineer to assign the site visit to' })
  @IsOptional()
  @IsUUID()
  assignedToId?: string;
}

export class FilterCaseDto extends BaseFilterQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  status?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  institutionId?: string;
}

export class AssignCaseDto {
  @ApiProperty({ description: 'Site engineer to carry out the visit' })
  @IsUUID()
  engineerId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class CaseNoteDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  notes: string;
}
