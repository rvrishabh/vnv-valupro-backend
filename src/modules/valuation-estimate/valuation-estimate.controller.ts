import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { toFindQuery } from 'src/common/utils/to-find-query.util';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateValuationEstimateDto, FilterValuationEstimateDto } from './dto';
import { ValuationEstimateService } from './valuation-estimate.service';

interface AuthenticatedRequest {
  user: { id: string; roleName: string };
}

@ApiTags('valuation-estimate')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('valuation-estimate')
export class ValuationEstimateController {
  constructor(
    private readonly valuationEstimateService: ValuationEstimateService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'BANK_MANAGER')
  calculate(
    @Body() dto: CreateValuationEstimateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.valuationEstimateService.calculate(dto, req.user.id);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'BANK_MANAGER')
  findAll(
    @Query() query: FilterValuationEstimateDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const filter = {
      createdBy: query.createdBy,
    };
    return this.valuationEstimateService.findAll(
      req.user.id,
      req.user.roleName,
      toFindQuery(query, filter),
    );
  }
}
