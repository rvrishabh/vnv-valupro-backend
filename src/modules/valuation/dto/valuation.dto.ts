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

  @ApiPropertyOptional({
    example: 2020,
    description: 'M-Rate!C82:E82 — defaults to the building year when omitted',
  })
  @IsOptional()
  @IsInt()
  @Min(1800)
  yearOfConstruction?: number;

  @ApiPropertyOptional({ example: 80, description: 'M-Rate!C84:E84 — per-floor expected life' })
  @IsOptional()
  @IsInt()
  @Min(1)
  expectedLifeYears?: number;

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

  @ApiPropertyOptional({
    example: 306.9,
    description:
      'Derived from areaAsPerDeed/areaAsPerSite (the lesser governs); sent only as a fallback.',
  })
  @IsOptional()
  @IsNumber()
  @Min(0)
  plotAreaSqM?: number;

  @ApiPropertyOptional({ example: 306.9, description: 'M-Doc!C103 — area as typed in the deed' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  areaAsPerDeed?: number;

  @ApiPropertyOptional({ example: 306.9, description: 'M-Doc!C104 — area measured on site' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  areaAsPerSite?: number;

  @ApiPropertyOptional({ enum: ['ft', 'm'], description: 'M-Doc!C91 — unit of the side dimensions' })
  @IsOptional()
  @IsEnum({ ft: 'ft', m: 'm' })
  dimensionUnit?: 'ft' | 'm';

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

  @ApiPropertyOptional({ description: 'M-Doc!C8 — House / Flat / Shop / ...' })
  @IsOptional()
  @IsString()
  propertyType?: string;

  @ApiPropertyOptional({ description: 'M-Doc!C10' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  advanceReceived?: number;

  @ApiPropertyOptional({ description: 'M-Doc!C55', example: 'Land & Building' })
  @IsOptional()
  @IsString()
  assetsSoldAsPerDeed?: string;

  @ApiPropertyOptional({ enum: ['Freehold', 'Leasehold'], description: 'M-Doc!C62' })
  @IsOptional()
  @IsString()
  tenure?: string;

  @ApiPropertyOptional({
    description: 'M-Doc!C63:C69 — lessor, lessee, dates, premium, ground rent, easements',
  })
  @IsOptional()
  @IsObject()
  leaseDetails?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'M-Doc!C41:C52 — address as observed on site' })
  @IsOptional()
  @IsObject()
  siteAddress?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'M-Doc!C80:C87 — discrepancy checks' })
  @IsOptional()
  @IsObject()
  discrepancy?: Record<string, unknown>;

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
