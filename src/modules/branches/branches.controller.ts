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
  Req,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { toFindQuery } from 'src/common/utils/to-find-query.util';
import { AdminGuard } from '../auth/guards/admin.guard';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  CreateManualBranchDto,
  FilterBranchDto,
  LookupIfscDto,
  UpdateBranchDto,
} from './dto';
import { BranchesService } from './branches.service';

interface AuthenticatedRequest {
  user: { id: string; roleName: string };
}

@ApiTags('branches')
@Controller('branches')
export class BranchesController {
  constructor(private readonly branchesService: BranchesService) {}

  @Post('lookup-ifsc')
  lookupIfsc(@Body() data: LookupIfscDto) {
    return this.branchesService.lookupOrCreateByIfsc(data.ifscCode);
  }

  @Post('manual')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  createManual(@Body() data: CreateManualBranchDto) {
    return this.branchesService.createManualBranch(data, true);
  }

  @Get('public')
  findPublic(@Query('institutionId', ParseUUIDPipe) institutionId: string) {
    return this.branchesService.findPublicByInstitution(institutionId);
  }

  @Get('verification-queue')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  getVerificationQueue() {
    return this.branchesService.getVerificationQueue();
  }

  @Get()
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  findAll(@Query() query: FilterBranchDto) {
    const filter = {
      institutionId: query.institutionId,
      city: query.city,
      needsVerification: query.needsVerification,
      isManuallyEntered: query.isManuallyEntered,
    };
    return this.branchesService.findAll(toFindQuery(query, filter));
  }

  @Patch(':id/verify')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  verify(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.branchesService.verifyBranch(id, req.user.id);
  }

  @Patch(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() data: UpdateBranchDto,
  ) {
    return this.branchesService.update(id, data);
  }

  @Delete(':id')
  @ApiBearerAuth('access-token')
  @UseGuards(JwtAuthGuard, AdminGuard)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.branchesService.rejectBranch(id);
  }
}
