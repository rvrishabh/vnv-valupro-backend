import { Injectable } from '@nestjs/common';
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
