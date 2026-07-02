import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateUserDto,
  ListUsersQueryDto,
  UpdateUserBranchIdDto,
  UpdateUserDto,
} from './dto/user.request.dto';
import { UserService } from './user.service';

@ApiTags('users')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('users')
export class UserController {
  constructor(private readonly userService: UserService) {}

  /** Admin-only: create web portal staff (WEB roles). Mobile users register via /auth. */
  @Post()
  create(@Body() data: CreateUserDto) {
    return this.userService.create(data);
  }

  @Get()
  findAll(@Query() query: ListUsersQueryDto) {
    return this.userService.findAll(query);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.findOne(id);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() data: UpdateUserDto) {
    return this.userService.update(id, data);
  }

  @Patch(':id/approve')
  approve(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.approve(id);
  }

  @Patch(':id/deactivate')
  deactivate(@Param('id', ParseUUIDPipe) id: string) {
    return this.userService.deactivate(id);
  }

  @Patch(':id/branch')
  updateBranch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateUserBranchIdDto,
  ) {
    return this.userService.updateBranch(id, data);
  }
}
