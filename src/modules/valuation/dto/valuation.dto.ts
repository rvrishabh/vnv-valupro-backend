import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { BaseFilterQueryDto } from 'src/common/dto';
import { IListValuationsQuery, RoofType } from 'types/valuation.types';

const ROOF_TYPES: RoofType[] = ['RCC', 'RBC', 'Girder Stone', 'Tin Shed', 'Kachcha'];

export class FloorDto {
  @ApiProperty({ example: 'Ground Floor' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: 242.8, minimum: 0 })
  @IsNumber()
  @Min(0)
  coveredAreaSqM: number;

  @ApiProperty({ example: 9500, minimum: 0 })
  @IsNumber()
  @Min(0)
  replacementRate: number;

  @ApiProperty({ enum: ROOF_TYPES, example: 'RCC' })
  @IsEnum(ROOF_TYPES.reduce((acc, r) => ({ ...acc, [r]: r }), {}))
  roofType: RoofType;

  @ApiPropertyOptional({ example: 1, enum: [1, 2] })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(2)
  constructionCategory?: 1 | 2;

  @ApiPropertyOptional({ description: 'Floorwise specifications (walls, doors, flooring, ...)' })
  @IsOptional()
  @IsObject()
  specs?: Record<string, string>;
}

export class LandDto {
  @ApiProperty({ example: 86000 })
  @IsNumber()
  @Min(0)
  prevailingMarketRate: number;

  @ApiProperty({ example: 23000 })
  @IsNumber()
  @Min(0)
  circleRate: number;

  @ApiProperty({ example: 80000 })
  @IsNumber()
  @Min(0)
  adoptedRate: number;

  @ApiProperty({ example: 'Intermittent Plot' })
  @IsString()
  @IsNotEmpty()
  plotPosition: string;

  @ApiPropertyOptional({ example: 0, description: 'Fraction, e.g. 0.15 for 15%' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  superAreaPercent?: number;
}

export class BuildingDto {
  @ApiProperty({ example: 2010 })
  @IsInt()
  @Min(1800)
  yearOfConstruction: number;

  @ApiPropertyOptional({ example: 80 })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedLifeYears?: number;

  @ApiProperty({ type: [FloorDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FloorDto)
  floors: FloorDto[];
}

/** Every section is optional so the engineer can save a draft as they go. */
export class UpsertValuationDto {
  @ApiPropertyOptional({ enum: ['LAND_AND_BUILDING', 'CRM', 'PLOT'] })
  @IsOptional()
  @IsEnum({ LAND_AND_BUILDING: 'LAND_AND_BUILDING', CRM: 'CRM', PLOT: 'PLOT' })
  method?: 'LAND_AND_BUILDING' | 'CRM' | 'PLOT';

  @ApiPropertyOptional({ example: 2026 })
  @IsOptional()
  @IsInt()
  reportYear?: number;

  @ApiPropertyOptional({ example: 'Etah' })
  @IsOptional()
  @IsString()
  tehsil?: string;

  @ApiPropertyOptional({ example: 306.9 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plotAreaSqM?: number;

  @ApiPropertyOptional({ type: LandDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => LandDto)
  land?: LandDto;

  @ApiPropertyOptional({ type: BuildingDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => BuildingDto)
  building?: BuildingDto;

  @ApiPropertyOptional() @IsOptional() @IsObject() titleDeed?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() boundaries?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() dimensions?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() buildingSpecs?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() generalDetails?: Record<string, unknown>;
  @ApiPropertyOptional() @IsOptional() @IsObject() extraItems?: Record<string, number | string>;
  @ApiPropertyOptional() @IsOptional() @IsObject() services?: Record<string, number | string>;
  @ApiPropertyOptional() @IsOptional() @IsObject() siteVisit?: Record<string, unknown>;

  @ApiPropertyOptional() @IsOptional() @IsString() engineerNotes?: string;
}

export class CreateValuationDto extends UpsertValuationDto {
  @ApiProperty({ description: 'Case this valuation belongs to' })
  @IsUUID()
  caseId: string;
}

export class ReviewValuationDto {
  @ApiProperty({ enum: ['approved', 'rejected'] })
  @IsEnum({ approved: 'approved', rejected: 'rejected' })
  decision: 'approved' | 'rejected';

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  notes?: string;
}

export class FilterValuationDto
  extends BaseFilterQueryDto
  implements IListValuationsQuery
{
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  caseId?: string;

  @ApiPropertyOptional({ enum: ['DRAFT', 'SUBMITTED', 'APPROVED', 'REJECTED'] })
  @IsOptional()
  @IsString()
  status?: string;
}
