import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import type { Sharp } from 'sharp';
// sharp 0.35's dual ESM/CJS package.json confuses this project's legacy
// module resolution into typing the CJS require as a non-callable
// namespace; asserting the require'd value's type sidesteps that entirely.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const sharp = require('sharp') as (input?: Buffer) => Sharp;
import { PrismaService } from 'src/prisma/prisma.service';

export type PhotoSection = 'SITE_VISIT' | 'GOOGLE_EARTH';

/**
 * The annexure always resolves to exactly two rows (columns = ceil(count/2)),
 * so the cap is what keeps a cell a sane shape rather than a sliver — at 10
 * photos a row is 5 columns, giving each cell a roughly 37mm x 70mm portrait
 * cell; go higher and cells get proportionally thinner regardless of whether
 * the source photo was portrait or landscape (object-fit: cover crops either
 * to fit, but a very narrow cell stops looking like a photo at all).
 */
const MAX_SITE_VISIT_PHOTOS = 10;

/**
 * HEIC/HEIF (the default on iPhone) is deliberately not in this list: sharp's
 * prebuilt binary has no HEIF decoder, so accepting it would mean silently
 * storing a file the annexure can never render. Rejecting it up front, with a
 * message telling the valuer to export as JPEG, is better than a blank photo
 * discovered only when the PDF is generated.
 */
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

export interface UploadedFile {
  buffer: Buffer;
  mimetype: string;
}

export interface ReportPhoto {
  url: string;
  /** width / height — drives the justified-row layout, so its precision (not just a landscape/portrait flag) matters. */
  aspect: number;
}

/**
 * Site-visit and Google Earth photos for the photograph annexure.
 *
 * No S3/R2 credentials are configured for this deployment, so images are
 * compressed and stored as bytes in Postgres rather than object storage —
 * fine at the volumes here (a few dozen photos per valuation). Every read
 * path goes through this service, so moving the bytes to R2 later only means
 * changing what is inside these methods, not their callers.
 */
@Injectable()
export class ValuationPhotoService {
  constructor(private readonly prisma: PrismaService) {}

  async upload(valuationId: string, section: PhotoSection, files: UploadedFile[]) {
    if (!files.length) {
      throw new BadRequestException('No files were uploaded');
    }

    for (const file of files) {
      if (!ALLOWED_MIME_TYPES.has(file.mimetype)) {
        throw new BadRequestException(
          `Unsupported file type "${file.mimetype}" — upload JPEG, PNG or WEBP ` +
            '(export HEIC/iPhone photos as JPEG before uploading)',
        );
      }
    }

    if (section === 'GOOGLE_EARTH') {
      if (files.length > 1) {
        throw new BadRequestException(
          'Only one Google Earth image is shown — upload a single screenshot',
        );
      }
      // The annexure has one aerial-plan slot; a new upload replaces it.
      await this.prisma.valuationPhoto.deleteMany({
        where: { valuationId, section: 'GOOGLE_EARTH' },
      });
    } else {
      const existing = await this.prisma.valuationPhoto.count({
        where: { valuationId, section: 'SITE_VISIT' },
      });
      if (existing + files.length > MAX_SITE_VISIT_PHOTOS) {
        throw new BadRequestException(
          `Site-visit photos are capped at ${MAX_SITE_VISIT_PHOTOS} so the two rows stay ` +
            `legible — this valuation already has ${existing}`,
        );
      }
    }

    const startOrder = section === 'GOOGLE_EARTH' ? 0 : await this.nextSortOrder(valuationId);

    const created = [];
    for (const [index, file] of files.entries()) {
      // Re-encoded to a bounded JPEG regardless of source format, so storage
      // and the eventual PDF's HTML payload stay small no matter what a
      // phone camera hands us. `.rotate()` with no args applies the EXIF
      // orientation tag — otherwise a portrait phone photo can land sideways.
      const { data: compressed, info } = await sharp(file.buffer)
        .rotate()
        .resize({ width: 2000, height: 2000, fit: 'inside', withoutEnlargement: true })
        .jpeg({ quality: 80 })
        .toBuffer({ resolveWithObject: true });

      created.push(
        await this.prisma.valuationPhoto.create({
          data: {
            valuationId,
            section,
            sortOrder: startOrder + index,
            data: compressed,
            mimeType: 'image/jpeg',
            fileSize: compressed.length,
            width: info.width,
            height: info.height,
          },
          select: {
            id: true,
            section: true,
            sortOrder: true,
            mimeType: true,
            fileSize: true,
            createdAt: true,
          },
        }),
      );
    }

    return created;
  }

  list(valuationId: string) {
    return this.prisma.valuationPhoto.findMany({
      where: { valuationId },
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        section: true,
        sortOrder: true,
        mimeType: true,
        fileSize: true,
        createdAt: true,
      },
    });
  }

  async getFile(valuationId: string, photoId: string) {
    const photo = await this.prisma.valuationPhoto.findFirst({
      where: { id: photoId, valuationId },
    });
    if (!photo) throw new NotFoundException('Photo not found');
    return photo;
  }

  async remove(valuationId: string, photoId: string): Promise<void> {
    const photo = await this.prisma.valuationPhoto.findFirst({
      where: { id: photoId, valuationId },
    });
    if (!photo) throw new NotFoundException('Photo not found');
    await this.prisma.valuationPhoto.delete({ where: { id: photoId } });
  }

  /** Data URIs for embedding straight into the annexure's HTML — no separate asset requests for Puppeteer to make. */
  async getPhotosForReport(
    valuationId: string,
  ): Promise<{ siteVisit: ReportPhoto[]; googleEarth: string | null }> {
    const rows = await this.prisma.valuationPhoto.findMany({
      where: { valuationId },
      orderBy: [{ section: 'asc' }, { sortOrder: 'asc' }],
    });

    // The Neon driver adapter returns Bytes columns as Uint8Array rather than
    // a Node Buffer, which has no `toString('base64')` overload — wrap it.
    const toDataUri = (row: (typeof rows)[number]) =>
      `data:${row.mimeType};base64,${Buffer.from(row.data).toString('base64')}`;

    const googleEarth = rows.find((r) => r.section === 'GOOGLE_EARTH');

    return {
      siteVisit: rows
        .filter((r) => r.section === 'SITE_VISIT')
        .map((row) => ({
          url: toDataUri(row),
          // Missing only for photos uploaded before dimensions were captured;
          // 0.75 (a typical portrait phone photo) is a safe fallback since it
          // just affects that one photo's row width, not whether it renders.
          aspect: row.width != null && row.height != null ? row.width / row.height : 0.75,
        })),
      googleEarth: googleEarth ? toDataUri(googleEarth) : null,
    };
  }

  private async nextSortOrder(valuationId: string): Promise<number> {
    const max = await this.prisma.valuationPhoto.aggregate({
      where: { valuationId, section: 'SITE_VISIT' },
      _max: { sortOrder: true },
    });
    return (max._max.sortOrder ?? -1) + 1;
  }
}
