import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsOptional, IsString } from 'class-validator';

export class DateRangeQueryDto {
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
