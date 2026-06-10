import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsDateString,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { IBaseFilterQuery } from 'types/common.types';

/**
 * Shared list query params for PrismaBaseRepository.findAll().
 * Module DTOs extend this and add entity-specific filters.
 */
export class BaseFilterQueryDto implements IBaseFilterQuery {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({
    description: 'Sort field and direction',
    example: 'createdAt:desc',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-zA-Z0-9_]+(\.(asc|desc)|:(asc|desc))?$/i, {
    message: 'sort must be field:asc, field:desc, field.asc, or field.desc',
  })
  sort?: string;

  @ApiPropertyOptional({
    description: 'Case-insensitive search across entity searchFields',
    example: 'rahul',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  search?: string;

  @ApiPropertyOptional({
    description: 'Filter column for date range; defaults to createdAt',
    example: 'createdAt',
  })
  @IsOptional()
  @IsString()
  dateCondition?: string;

  @ApiPropertyOptional({
    description: 'Inclusive range start (ISO date)',
    example: '2026-01-01',
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: 'Inclusive range end (ISO date)',
    example: '2026-06-30',
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;
}
