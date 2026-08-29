import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValuationMethod } from 'types/valuation.types';
import {
  NO_ROAD_WIDTH_BAND,
  resolveCircleRateCategory,
  resolveRoadWidthBand,
  truncateToDay,
} from '../engine/circle-rate.util';

export interface CircleRateSuggestion {
  rate: number;
  effectiveFrom: Date;
  caseNumber: string | null;
}

/**
 * Learns circle rates from what valuers actually enter, area by area, rather
 * than from a bulk import of the printed register — those registers arrive as
 * scanned, unstructured tables that would need OCR to key in, and OCR on a
 * photocopied Devanagari table is not something to trust for a figure that
 * drives a valuation. Submitting a valuation with a circle rate filled in
 * writes one entry here; the next valuation in the same area is then offered
 * it as a starting point.
 */
@Injectable()
export class CircleRateService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * The most recent rate recorded for this exact area, category and
   * road-width band, if any valuer has entered one before.
   */
  async suggest(
    tehsil: string,
    mohalla: string,
    roadWidthMeters: number,
    method: ValuationMethod,
  ): Promise<CircleRateSuggestion | null> {
    if (!tehsil || !mohalla) return null;

    const category = resolveCircleRateCategory(method);
    const roadWidthBand =
      category === 'LAND' ? resolveRoadWidthBand(roadWidthMeters) : NO_ROAD_WIDTH_BAND;

    const entry = await this.prisma.circleRateEntry.findFirst({
      where: {
        propertyCategory: category,
        roadWidthBand,
        area: { subRegistrarOffice: tehsil, mohalla },
      },
      orderBy: { effectiveFrom: 'desc' },
      include: { sourceValuation: { include: { case: true } } },
    });

    if (!entry) return null;

    return {
      rate: Number(entry.rate),
      effectiveFrom: entry.effectiveFrom,
      caseNumber: entry.sourceValuation?.case?.caseNumber ?? null,
    };
  }

  /**
   * Records the circle rate a valuer used, keyed on the area it applies to.
   * Idempotent per area/category/band/day — resubmitting the same report, or
   * another one in the same area on the same day, updates the entry rather
   * than duplicating it.
   */
  async recordFromValuation(report: {
    id: string;
    tehsil: string | null;
    circleRateMohalla: string | null;
    roadWidthMeters: unknown;
    circleRate: unknown;
    method: ValuationMethod;
  }): Promise<void> {
    const tehsil = report.tehsil?.trim();
    const mohalla = report.circleRateMohalla?.trim();
    const rate = report.circleRate === null ? null : Number(report.circleRate);
    const roadWidthMeters =
      report.roadWidthMeters === null ? null : Number(report.roadWidthMeters);

    // Nothing to learn from a report that never had these filled in — older
    // records predate these fields, and recording a rate against no locality
    // would be meaningless.
    if (!tehsil || !mohalla || !rate || !roadWidthMeters) return;

    const area = await this.prisma.circleRateArea.upsert({
      where: { subRegistrarOffice_mohalla: { subRegistrarOffice: tehsil, mohalla } },
      update: {},
      create: { subRegistrarOffice: tehsil, mohalla },
    });

    const category = resolveCircleRateCategory(report.method);
    const roadWidthBand =
      category === 'LAND' ? resolveRoadWidthBand(roadWidthMeters) : NO_ROAD_WIDTH_BAND;
    const effectiveFrom = truncateToDay(new Date());

    await this.prisma.circleRateEntry.upsert({
      where: {
        areaId_propertyCategory_roadWidthBand_effectiveFrom: {
          areaId: area.id,
          propertyCategory: category,
          roadWidthBand,
          effectiveFrom,
        },
      },
      update: { rate, sourceValuationId: report.id },
      create: {
        areaId: area.id,
        propertyCategory: category,
        roadWidthBand,
        effectiveFrom,
        rate,
        sourceValuationId: report.id,
      },
    });
  }
}
