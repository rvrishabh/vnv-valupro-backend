import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches } from 'class-validator';
import { ISortQuery } from 'types/common.types';

export class SortQueryDto implements ISortQuery {
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
}
