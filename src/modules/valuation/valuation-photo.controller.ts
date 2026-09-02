import {
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
  Res,
  UseGuards,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { FastifyReply, FastifyRequest } from 'fastify';
import { Roles } from '../auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { PhotoSectionQueryDto } from './dto';
import { ReportService } from './report/report.service';
import {
  UploadedFile,
  ValuationPhotoService,
} from './services/valuation-photo.service';
import { ValuationService } from './valuation.service';

interface AuthenticatedRequest extends FastifyRequest {
  user: { id: string; roleName: string };
}

/**
 * Separate from ValuationController to keep the multipart upload plumbing —
 * which needs the raw Fastify request rather than a DTO body — out of the
 * mostly-JSON valuation endpoints.
 */
@ApiTags('valuation-photos')
@ApiBearerAuth('access-token')
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('valuations/:id/photos')
export class ValuationPhotoController {
  constructor(
    private readonly valuationService: ValuationService,
    private readonly photoService: ValuationPhotoService,
    private readonly reportService: ReportService,
  ) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Upload one or more site-visit or Google Earth photos',
  })
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER')
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PhotoSectionQueryDto,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.valuationService.assertEditable(
      id,
      req.user.id,
      req.user.roleName,
    );

    const files: UploadedFile[] = [];
    for await (const part of req.parts()) {
      if (part.type === 'file') {
        files.push({ buffer: await part.toBuffer(), mimetype: part.mimetype });
      }
    }

    return this.photoService.upload(id, query.section, files);
  }

  @Get()
  @ApiOperation({
    summary: 'List photo metadata for this valuation (no image bytes)',
  })
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'CHECKER', 'BANK_MANAGER')
  async list(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.valuationService.assertAccess(
      id,
      req.user.id,
      req.user.roleName,
    );
    return this.photoService.list(id);
  }

  @Get('annexure/pdf')
  @ApiOperation({
    summary: 'Render the Photograph & Location Annexure as a PDF',
  })
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER', 'CHECKER', 'BANK_MANAGER')
  async downloadAnnexure(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: AuthenticatedRequest,
    @Res() reply: FastifyReply,
  ) {
    await this.valuationService.assertAccess(
      id,
      req.user.id,
      req.user.roleName,
    );
    const { buffer, filename } =
      await this.reportService.generatePhotoAnnexurePdf(id);
    return reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${filename}"`)
      .send(buffer);
  }

  @Delete(':photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove one photo' })
  @Roles('SUPER_ADMIN', 'ADMIN', 'SITE_ENGINEER')
  async remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('photoId') photoId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    await this.valuationService.assertEditable(
      id,
      req.user.id,
      req.user.roleName,
    );
    await this.photoService.remove(id, photoId);
  }
}
