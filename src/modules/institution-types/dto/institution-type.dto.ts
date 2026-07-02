import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class CreateInstitutionTypeDto {
  @ApiProperty({ example: 'NBFC' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiPropertyOptional({ example: 'Non-banking financial companies' })
  @IsOptional()
  @IsString()
  description?: string;
}

export class UpdateInstitutionTypeDto extends PartialType(
  CreateInstitutionTypeDto,
) {}
