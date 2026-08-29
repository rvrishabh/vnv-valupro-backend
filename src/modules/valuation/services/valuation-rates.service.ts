import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Resolves the govt. construction rates the guideline valuation looks up.
 * Replaces the workbook's VLOOKUP into the hidden 'Construction Rates' sheet.
 */
@Injectable()
export class ValuationRatesService {
  constructor(private readonly prisma: PrismaService) {}

  /** roofType -> rate for one tehsil and construction category. */
  async getConstructionRates(
    tehsil: string,
    category = 1,
  ): Promise<Map<string, number>> {
    if (!tehsil) return new Map();

    const rows = await this.prisma.constructionRate.findMany({
      where: { tehsil, category },
    });

    return new Map(rows.map((r) => [r.roofType, Number(r.rate)]));
  }

  async getCircleRate(
    tehsil: string,
    locality: string,
  ): Promise<number | null> {
    const row = await this.prisma.circleRate.findFirst({
      where: { tehsil, locality },
    });
    return row ? Number(row.rate) : null;
  }

  /**
   * Groups a valuer may extend from the form.
   *
   * Deliberately a whitelist: these are open-ended registers of places that no
   * workbook can enumerate for the whole country. Groups that encode a
   * calculation rule — roof types, plot positions, construction categories —
   * stay closed, because an unrecognised value there would silently fall
   * through the rate lookups rather than fail.
   */
  private static readonly EXTENDABLE_GROUPS = new Set([
    'tehsil',
    'wardTehsilRegistration',
    'city',
    'cityTownVillage',
    'bank',
    'approvingAuthority',
    'circleRateMohalla',
  ]);

  /**
   * Records a value a valuer typed into a dropdown so it is offered next time.
   *
   * Idempotent: entering the same locality on a second report reactivates the
   * existing row rather than duplicating it.
   */
  async addOption(
    group: string,
    rawValue: string,
  ): Promise<{ group: string; value: string }> {
    const value = rawValue.trim();

    if (!ValuationRatesService.EXTENDABLE_GROUPS.has(group)) {
      throw new BadRequestException(`"${group}" does not accept new values`);
    }
    if (!value) {
      throw new BadRequestException('A value is required');
    }

    // Existing entries sort first so the workbook's own list stays on top and
    // additions collect underneath it.
    const highest = await this.prisma.valuationOption.aggregate({
      where: { group },
      _max: { sortOrder: true },
    });

    await this.prisma.valuationOption.upsert({
      where: { group_value: { group, value } },
      update: { isActive: true },
      create: {
        group,
        value,
        isCustom: true,
        sortOrder: (highest._max.sortOrder ?? 0) + 1,
      },
    });

    return { group, value };
  }

  /** Dropdown master data, grouped for the admin UI. */
  async getOptions(): Promise<Record<string, string[]>> {
    const rows = await this.prisma.valuationOption.findMany({
      where: { isActive: true },
      orderBy: [{ group: 'asc' }, { sortOrder: 'asc' }],
    });

    return rows.reduce<Record<string, string[]>>((acc, row) => {
      (acc[row.group] ??= []).push(row.value);
      return acc;
    }, {});
  }
}
