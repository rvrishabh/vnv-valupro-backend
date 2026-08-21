import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { toFindQuery } from 'src/common/utils/to-find-query.util';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CasesService } from './cases.service';
import { AssignCaseDto, CaseNoteDto, CreateCaseDto, FilterCaseDto } from './dto';
import { CaseWorkflowService } from './services/case-workflow.service';

interface AuthenticatedRequest {
  user: { id: string; roleName: string };
}

@ApiTags('cases')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cases')
export class CasesController {
  constructor(
    private readonly casesService: CasesService,
    private readonly workflow: CaseWorkflowService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @Roles('SUPER_ADMIN', 'ADMIN', 'BANK_MANAGER')
  create(@Body() dto: CreateCaseDto, @Req() req: AuthenticatedRequest) {
    return this.casesService.create(dto, req.user.id);
  }

  @Get()
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'CHECKER', 'BANK_MANAGER')
  findAll(@Query() query: FilterCaseDto, @Req() req: AuthenticatedRequest) {
    const filter = { status: query.status, institutionId: query.institutionId };
    return this.casesService.findAll(
      req.user.id,
      req.user.roleName,
      toFindQuery(query, filter),
    );
  }

  @Get(':id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'CHECKER', 'BANK_MANAGER')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.casesService.findOne(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete a case and its valuation, documents, fees and audit trail',
  })
  @Roles('SUPER_ADMIN', 'ADMIN')
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.casesService.remove(id);
  }

  @Get(':id/timeline')
  @ApiOperation({ summary: 'Participants, milestones and the full audit trail' })
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'CHECKER', 'BANK_MANAGER')
  timeline(@Param('id', ParseUUIDPipe) id: string) {
    return this.workflow.timeline(id);
  }

  @Post(':id/assign')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign the site visit to an engineer' })
  @Roles('SUPER_ADMIN', 'ADMIN')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AssignCaseDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workflow.assign(id, dto.engineerId, req.user.id, dto.notes);
  }

  @Post(':id/survey/start')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Engineer opens the site visit (mobile app)' })
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER')
  startSurvey(@Param('id', ParseUUIDPipe) id: string, @Req() req: AuthenticatedRequest) {
    return this.workflow.startSurvey(id, req.user.id);
  }

  @Post(':id/survey/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Engineer finishes the site visit' })
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER')
  completeSurvey(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CaseNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workflow.completeSurvey(id, req.user.id, dto.notes);
  }

  @Post(':id/query')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Raise a query back to the engineer or bank' })
  @Roles('SUPER_ADMIN', 'ADMIN', 'CHECKER')
  raiseQuery(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CaseNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.workflow.raiseQuery(id, req.user.id, dto.notes);
  }
}
