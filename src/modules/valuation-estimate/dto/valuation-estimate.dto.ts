import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { BaseFilterQueryDto } from 'src/common/dto';
import { IListValuationEstimatesQuery } from 'types/valuation-estimate.types';

export class CreateValuationEstimateDto {
  @ApiProperty({ example: 'Ramesh Kumar' })
  @IsString()
  @IsNotEmpty()
  ownerName: string;

  @ApiProperty({ example: '12 MG Road, Indore' })
  @IsString()
  @IsNotEmpty()
  address: string;

  @ApiProperty({ example: 360, minimum: 1 })
  @IsNumber()
  @Min(1)
  plotAreaSqFt: number;

  @ApiProperty({ example: 700000, minimum: 1 })
  @IsNumber()
  @Min(1)
  estimatedAmount: number;

  @ApiProperty({ example: 1500, minimum: 1200, maximum: 1650 })
  @IsNumber()
  @Min(1200)
  @Max(1650)
  rate: number;
}

export class FilterValuationEstimateDto
  extends BaseFilterQueryDto
  implements IListValuationEstimatesQuery
{
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  createdBy?: string;
}
