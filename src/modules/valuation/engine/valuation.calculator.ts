import {
  CoverageResult,
  FloorInput,
  FloorValuation,
  GuidelineValuation,
  PlotPosition,
  ValuationInput,
  ValuationResult,
} from 'types/valuation.types';
import { excelRound, excelRoundDown } from './excel.util';

/**
 * Port of the valuation workbook's calculation chain (M-Rate + `II SH FOR ALL`).
 *
 * Static and DI-free so it can be exercised directly against golden fixtures
 * extracted from completed .xlsm cases — see valuation.calculator.spec.ts.
 * Mirrors the shape of ValuationEstimateCalculator.
 */
export class ValuationCalculator {
  /** Salvage value is taken as 10%, so only 90% of the asset depreciates. */
  private static readonly DEPRECIABLE_FRACTION = 0.9;

  /** Govt. rates are only depreciated once the building is past this age. */
  private static readonly GUIDELINE_DEPRECIATION_MIN_AGE = 19;

  private static readonly REALIZABLE_FACTOR = 0.9;
  private static readonly DISTRESS_FACTOR = 0.8;

  static calculate(
    input: ValuationInput,
    guidelineRates: Map<string, number>,
  ): ValuationResult {
    const isPlot = input.method === 'PLOT';
    const floors = isPlot ? [] : this.calculateFloors(input);

    const groundFloor = input.building.floors[0];
    const depreciatedBuildingRate = isPlot
      ? 0
      : this.depreciatedRate(groundFloor, input);

    // M-Rate!C88 / 'II SH FOR ALL'!D28 — the part of the adopted rate that is
    // not construction is treated as the land component.
    const landComponentRate = isPlot
      ? input.land.adoptedRate
      : input.land.adoptedRate - (groundFloor?.replacementRate ?? 0);

    const compositeRate = excelRound(
      (landComponentRate + depreciatedBuildingRate) *
        (1 + input.land.superAreaPercent),
      -2,
    );

    const landValue = input.land.adoptedRate * input.plotAreaSqM;
    const partA = excelRound(landValue, -3);

    const extraItemsValue =
      this.sumNumeric(input.extraItems) + this.sumNumeric(input.services);
    const partBtoE = excelRound(
      floors.reduce((sum, f) => sum + f.depreciatedValue, 0) + extraItemsValue,
      -2,
    );

    const totalValue = partA + partBtoE;
    const roundedValue = excelRoundDown(totalValue, -4);

    const totalCoveredAreaSqM = floors.reduce(
      (sum, f) => sum + f.coveredAreaSqM,
      0,
    );

    return {
      method: input.method,
      landValue,
      partA,
      floors,
      partBtoE,
      extraItemsValue,
      totalValue,
      roundedValue,
      realizableValue: roundedValue * this.REALIZABLE_FACTOR,
      distressValue: roundedValue * this.DISTRESS_FACTOR,
      // 'II SH FOR ALL'!D219 bases the insurable value on the plot area, not
      // the covered area.
      insurableValue: excelRound(
        depreciatedBuildingRate * input.plotAreaSqM,
        -3,
      ),
      depreciatedBuildingRate,
      landComponentRate,
      compositeRate,
      fairMarketValue: compositeRate * input.plotAreaSqM,
      rateVariationPercent: input.land.circleRate
        ? ((input.land.adoptedRate - input.land.circleRate) /
            input.land.circleRate) *
          100
        : 0,
      guideline: this.calculateGuideline(input, guidelineRates),
      coverage: this.calculateCoverage(input, totalCoveredAreaSqM),
    };
  }

  /**
   * M-Rate!C83:C85 — age and depreciation are per floor, since floors may
   * differ in age. A floor's own year when set, otherwise the building's
   * (M-Rate!D82 = C82).
   */
  static yearOf(input: ValuationInput, floor?: FloorInput): number {
    return floor?.yearOfConstruction ?? input.building.yearOfConstruction;
  }

  /** Likewise for expected life, which the sheet also repeats per floor. */
  static expectedLifeOf(input: ValuationInput, floor?: FloorInput): number {
    return floor?.expectedLifeYears ?? input.building.expectedLifeYears;
  }

  static ageOf(input: ValuationInput, floor?: FloorInput): number {
    return Math.max(0, input.reportYear - this.yearOf(input, floor));
  }

  static depreciationPercent(
    input: ValuationInput,
    floor?: FloorInput,
  ): number {
    const life = this.expectedLifeOf(input, floor);
    if (!life) return 0;
    return (this.ageOf(input, floor) / life) * this.DEPRECIABLE_FRACTION;
  }

  /** 'II SH FOR ALL'!D36 — ROUND(rate - rate x dep%, -2). */
  private static depreciatedRate(
    floor: FloorInput | undefined,
    input: ValuationInput,
  ): number {
    if (!floor) return 0;
    const rate = floor.replacementRate;
    return excelRound(rate - rate * this.depreciationPercent(input, floor), -2);
  }

  private static calculateFloors(input: ValuationInput): FloorValuation[] {
    return input.building.floors
      .filter((f) => f.coveredAreaSqM > 0)
      .map((floor) => {
        const age = this.ageOf(input, floor);
        const depreciationPercent = this.depreciationPercent(input, floor);
        const replacementValue = excelRound(
          floor.replacementRate * floor.coveredAreaSqM,
          -2,
        );
        const depreciation = excelRound(
          replacementValue * depreciationPercent,
          -2,
        );

        const expectedLifeYears = this.expectedLifeOf(input, floor);

        return {
          name: floor.name,
          coveredAreaSqM: floor.coveredAreaSqM,
          yearOfConstruction: this.yearOf(input, floor),
          age,
          residualAge: expectedLifeYears - age,
          expectedLifeYears,
          depreciationPercent,
          replacementRate: floor.replacementRate,
          replacementValue,
          depreciation,
          depreciatedValue: replacementValue - depreciation,
        };
      });
  }

  /** M-Rate!C42 — positional uplift on the circle rate. */
  static circleRateUplift(position: PlotPosition): number {
    switch (position) {
      case '2 Side Road Facing Plot':
      case 'Park Facing':
        return 1.1;
      case 'Park & 2 Side Road Facing Plot':
        return 1.2;
      default:
        return 1;
    }
  }

  /**
   * M-Rate!162:175 — valuation at govt. guideline rates, which is a separate
   * chain from the market valuation: rates come from the govt. construction
   * table rather than the valuer, and depreciation only applies past age 19.
   */
  private static calculateGuideline(
    input: ValuationInput,
    guidelineRates: Map<string, number>,
  ): GuidelineValuation {
    const circleRateAdjusted =
      input.land.circleRate * this.circleRateUplift(input.land.plotPosition);
    const landValue = excelRound(circleRateAdjusted * input.plotAreaSqM, -2);

    const floors = (input.method === 'PLOT' ? [] : input.building.floors)
      .filter((f) => f.coveredAreaSqM > 0)
      .map((floor) => {
        const constructionRate = guidelineRates.get(floor.roofType) ?? 0;
        const age = this.ageOf(input, floor);
        const depreciatedRate = excelRound(
          age > this.GUIDELINE_DEPRECIATION_MIN_AGE
            ? constructionRate * (1 - this.depreciationPercent(input, floor))
            : constructionRate,
          0,
        );

        return {
          name: floor.name,
          roofType: floor.roofType,
          constructionRate,
          depreciatedRate,
          value: excelRound(depreciatedRate * floor.coveredAreaSqM, -3),
        };
      });

    const constructionValue = floors.reduce((sum, f) => sum + f.value, 0);

    return {
      circleRateAdjusted,
      landValue,
      floors,
      constructionValue,
      totalValue: excelRound(constructionValue + landValue, -3),
    };
  }

  /** M-Rate!179:185 — permissible vs achieved ground coverage and FAR. */
  private static calculateCoverage(
    input: ValuationInput,
    totalCoveredAreaSqM: number,
  ): CoverageResult {
    const plot = input.plotAreaSqM;
    const groundCoverageSqM = input.building.floors[0]?.coveredAreaSqM ?? 0;

    return {
      plotAreaSqM: plot,
      groundCoverageSqM,
      permissibleCoveragePercent: this.permissibleCoverage(plot),
      permissibleFAR: this.permissibleFAR(plot),
      achievedCoveragePercent: plot ? (groundCoverageSqM / plot) * 100 : 0,
      totalCoveredAreaSqM,
      achievedFAR: plot ? excelRound(totalCoveredAreaSqM / plot, 2) : 0,
    };
  }

  static permissibleCoverage(plotAreaSqM: number): number {
    if (plotAreaSqM < 100) return 75;
    if (plotAreaSqM < 300) return 65;
    if (plotAreaSqM < 500) return 55;
    return 45;
  }

  static permissibleFAR(plotAreaSqM: number): number {
    if (plotAreaSqM < 100) return 2.0;
    if (plotAreaSqM < 300) return 1.75;
    if (plotAreaSqM < 500) return 1.5;
    return 1.25;
  }

  /** Extra items and services are often literals like "Nil" — only sum the numbers. */
  private static sumNumeric(entries?: Record<string, number | string>): number {
    if (!entries) return 0;
    return Object.values(entries).reduce<number>(
      (sum, v) => sum + (typeof v === 'number' && Number.isFinite(v) ? v : 0),
      0,
    );
  }
}
