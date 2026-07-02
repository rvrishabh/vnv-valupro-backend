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
import { toFindQuery } from 'src/common/utils/to-find-query.util';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateInstitutionDto,
  FilterInstitutionDto,
  UpdateInstitutionDto,
} from './dto';
import { InstitutionsService } from './institutions.service';

@ApiTags('institutions')
@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() data: CreateInstitutionDto) {
    return this.institutionsService.create(data);
  }

  @Get('public')
  findAllPublic() {
    return this.institutionsService.findAllPublic();
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAll(@Query() query: FilterInstitutionDto) {
    const filter = {
      institutionTypeId: query.institutionTypeId,
      isActive: query.isActive,
    };
    return this.institutionsService.findAll(toFindQuery(query, filter));
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.institutionsService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateInstitutionDto,
  ) {
    return this.institutionsService.update(id, data);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.institutionsService.remove(id);
  }
}
