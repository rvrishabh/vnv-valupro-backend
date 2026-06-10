import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SearchQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive search across entity searchFields',
    example: 'rahul',
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  search?: string;
}
