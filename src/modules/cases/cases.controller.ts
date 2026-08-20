import {
  Body,
  Controller,
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
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { toFindQuery } from 'src/common/utils/to-find-query.util';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CasesService } from './cases.service';
import { CreateCaseDto, FilterCaseDto } from './dto';

interface AuthenticatedRequest {
  user: { id: string; roleName: string };
}

@ApiTags('cases')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('cases')
export class CasesController {
  constructor(private readonly casesService: CasesService) {}

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
}
