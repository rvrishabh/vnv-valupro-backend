import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyReply } from 'fastify';
import { toFindQuery } from 'src/common/utils/to-find-query.util';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import {
  CreateValuationDto,
  FilterValuationDto,
  ReviewValuationDto,
  UpsertValuationDto,
} from './dto';
import { ReportService } from './report/report.service';
import { ValuationRatesService } from './services/valuation-rates.service';
import { ValuationService } from './valuation.service';

interface AuthenticatedRequest {
  user: { id: string; roleName: string };
}

@ApiTags('valuations')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('valuations')
export class ValuationController {
  constructor(
    private readonly valuationService: ValuationService,
    private readonly reportService: ReportService,
    private readonly ratesService: ValuationRatesService,
  ) {}

  @Get('options')
  @ApiOperation({ summary: 'Dropdown master data for the valuation form' })
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'CHECKER', 'BANK_MANAGER')
  getOptions() {
    return this.ratesService.getOptions();
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER')
  create(@Body() dto: CreateValuationDto, @Req() req: AuthenticatedRequest) {
    return this.valuationService.create(dto, req.user.id);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'CHECKER')
  findAll(@Query() query: FilterValuationDto, @Req() req: AuthenticatedRequest) {
    const filter = { caseId: query.caseId, status: query.status };
    return this.valuationService.findAll(
      req.user.id,
      req.user.roleName,
      toFindQuery(query, filter),
    );
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'CHECKER')
  findOne(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.valuationService.findOne(id, req.user.id, req.user.roleName);
  }

  @Get(':id/preview')
  @ApiOperation({ summary: 'Recompute a draft without persisting' })
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'CHECKER')
  preview(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.valuationService.preview(id, req.user.id, req.user.roleName);
  }

  @Patch(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertValuationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.valuationService.update(id, dto, req.user.id, req.user.roleName);
  }

  @Post(':id/recalculate')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER')
  recalculate(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.valuationService.recalculate(id, req.user.id, req.user.roleName);
  }

  @Post(':id/submit')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER')
  submit(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.valuationService.submit(id, req.user.id, req.user.roleName);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @Roles('SUPER_ADMIN', 'ADMIN', 'CHECKER')
  review(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewValuationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.valuationService.review(id, dto, req.user.id, req.user.roleName);
  }

  @Get(':id/pdf')
  @ApiOperation({ summary: 'Render and download the bank-format report' })
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'CHECKER', 'BANK_MANAGER')
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ) {
    // Reuses the read-scoping check before spending time in Chromium.
    await this.valuationService.findOne(id, req.user.id, req.user.roleName);
    const { buffer, filename } = await this.reportService.generatePdf(id);

    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  }
}
