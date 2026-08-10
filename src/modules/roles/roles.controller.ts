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
import { RoleFilter } from 'types/role.types';
import {
  AssignPermissionsDto,
  CreateRoleDto,
  FilterRoleDto,
  UpdateRoleDto,
} from './dto';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesService } from './roles.service';

@ApiTags('roles')
@Controller('roles')
export class RolesController {
  constructor(private readonly rolesService: RolesService) {}

  @Post()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  create(@Body() data: CreateRoleDto) {
    return this.rolesService.create(data);
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAll(@Query() query: FilterRoleDto) {
    const filter: RoleFilter = {
      loginChannel: query.loginChannel,
      isSystem: query.isSystem,
    };
    return this.rolesService.findAll(toFindQuery(query, filter));
  }

  @Get(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.findOne(id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(@Param('id', ParseUUIDPipe) id: string, @Body() data: UpdateRoleDto) {
    return this.rolesService.update(id, data);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.rolesService.remove(id);
  }

  @Post(':id/permissions')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  assignPermissions(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: AssignPermissionsDto,
  ) {
    return this.rolesService.assignPermissions(id, data);
  }

  @Delete(':id/permissions/:permissionId')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  unassignPermission(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('permissionId', ParseUUIDPipe) permissionId: string,
  ) {
    return this.rolesService.unassignPermission(id, permissionId);
  }
}
