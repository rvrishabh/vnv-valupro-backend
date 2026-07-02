import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { BaseFilterQueryDto } from 'src/common/dto';
import { toFindQuery } from 'src/common/utils/to-find-query.util';
import { CreateInstitutionTypeDto, UpdateInstitutionTypeDto } from './dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { InstitutionTypesService } from './institution-types.service';

@ApiTags('institution-types')
@Controller('institution-types')
export class InstitutionTypesController {
  constructor(
    private readonly institutionTypesService: InstitutionTypesService,
  ) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() data: CreateInstitutionTypeDto) {
    return this.institutionTypesService.create(data);
  }

  @Get()
  findAll(@Query() query: BaseFilterQueryDto) {
    return this.institutionTypesService.findAll(toFindQuery(query));
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.institutionTypesService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateInstitutionTypeDto,
  ) {
    return this.institutionTypesService.update(id, data);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.institutionTypesService.remove(id);
  }
}
