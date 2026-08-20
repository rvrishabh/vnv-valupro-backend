import { ValuationInput } from 'types/valuation.types';
import { ValuationCalculator } from './valuation.calculator';

/**
 * Golden fixture: the Canara/Etah case (Mukta Agarwal). Every expected number
 * below is the value Excel itself cached in the workbook, read straight out of
 * `II SH FOR ALL` and `M-Rate`, so this asserts parity with the sheet rather
 * than with our own reading of it.
 */
const MUKTA_AGARWAL: ValuationInput = {
  method: 'LAND_AND_BUILDING',
  reportYear: 2026,
  tehsil: 'Etah',
  plotAreaSqM: 306.9,
  land: {
    prevailingMarketRate: 86000,
    circleRate: 23000,
    adoptedRate: 80000,
    plotPosition: 'Intermittent Plot',
    superAreaPercent: 0,
  },
  building: {
    yearOfConstruction: 2010,
    expectedLifeYears: 80,
    floors: [
      {
        name: 'Ground Floor',
        coveredAreaSqM: 242.8,
        replacementRate: 9500,
        roofType: 'RCC',
        constructionCategory: 1,
      },
      {
        name: 'I Floor',
        coveredAreaSqM: 70.05,
        replacementRate: 9000,
        roofType: 'RCC',
        constructionCategory: 1,
      },
    ],
  },
};

// 'Construction Rates'!A2:G56 for Etah, category 1.
const ETAH_RATES = new Map<string, number>([
  ['RCC', 10000],
  ['RBC', 9000],
  ['Girder Stone', 8000],
  ['Tin Shed', 7200],
]);

describe('ValuationCalculator — Mukta Agarwal golden fixture', () => {
  const result = ValuationCalculator.calculate(MUKTA_AGARWAL, ETAH_RATES);

  it('depreciates each floor as the sheet does', () => {
    const [ground, first] = result.floors;

    expect(ground.age).toBe(16);
    expect(ground.depreciationPercent).toBeCloseTo(0.18, 10);
    expect(ground.residualAge).toBe(64);
    expect(ground.replacementValue).toBe(2306600);
    expect(ground.depreciation).toBe(415200);
    expect(ground.depreciatedValue).toBe(1891400);

    expect(first.replacementValue).toBe(630500);
    expect(first.depreciation).toBe(113500);
    expect(first.depreciatedValue).toBe(517000);
  });

  it('composes the adopted rate into land and building components', () => {
    expect(result.landComponentRate).toBe(70500);
    expect(result.depreciatedBuildingRate).toBe(7800);
    expect(result.compositeRate).toBe(78300);
    expect(result.fairMarketValue).toBe(24030270);
  });

  it('totals Parts A-E and derives realizable and distress values', () => {
    expect(result.partA).toBe(24552000);
    expect(result.partBtoE).toBe(2408400);
    expect(result.totalValue).toBe(26960400);
    expect(result.roundedValue).toBe(26960000);
    expect(result.realizableValue).toBe(24264000);
    expect(result.distressValue).toBe(21568000);
    expect(result.insurableValue).toBe(2394000);
  });

  it('values the property at govt. guideline rates', () => {
    expect(result.guideline.circleRateAdjusted).toBe(23000);
    expect(result.guideline.landValue).toBe(7058700);
    expect(result.guideline.floors[0].value).toBe(2428000);
    expect(result.guideline.floors[1].value).toBe(701000);
    expect(result.guideline.constructionValue).toBe(3129000);
    expect(result.guideline.totalValue).toBe(10188000);
  });

  it('reports coverage and FAR', () => {
    expect(result.coverage.permissibleCoveragePercent).toBe(55);
    expect(result.coverage.permissibleFAR).toBe(1.5);
    expect(result.coverage.achievedCoveragePercent).toBeCloseTo(79.11, 2);
    expect(result.coverage.totalCoveredAreaSqM).toBeCloseTo(312.85, 10);
    expect(result.coverage.achievedFAR).toBe(1.02);
    expect(result.rateVariationPercent).toBeCloseTo(247.83, 2);
  });
});

describe('ValuationCalculator — branches', () => {
  it('does not depreciate govt. rates at or below age 19', () => {
    const young = ValuationCalculator.calculate(
      { ...MUKTA_AGARWAL, reportYear: 2029 },
      ETAH_RATES,
    );
    expect(young.floors[0].age).toBe(19);
    expect(young.guideline.floors[0].depreciatedRate).toBe(10000);
  });

  it('depreciates govt. rates past age 19', () => {
    const old = ValuationCalculator.calculate(
      { ...MUKTA_AGARWAL, reportYear: 2030 },
      ETAH_RATES,
    );
    expect(old.floors[0].age).toBe(20);
    // 10000 x (1 - 20/80 x 0.9) = 7750
    expect(old.guideline.floors[0].depreciatedRate).toBe(7750);
  });

  it('applies the positional uplift to the circle rate', () => {
    const corner = ValuationCalculator.calculate(
      {
        ...MUKTA_AGARWAL,
        land: { ...MUKTA_AGARWAL.land, plotPosition: '2 Side Road Facing Plot' },
      },
      ETAH_RATES,
    );
    expect(corner.guideline.circleRateAdjusted).toBeCloseTo(25300, 10);

    const both = ValuationCalculator.calculate(
      {
        ...MUKTA_AGARWAL,
        land: { ...MUKTA_AGARWAL.land, plotPosition: 'Park & 2 Side Road Facing Plot' },
      },
      ETAH_RATES,
    );
    expect(both.guideline.circleRateAdjusted).toBeCloseTo(27600, 10);
  });

  it('treats a vacant plot as land only', () => {
    const plot = ValuationCalculator.calculate(
      { ...MUKTA_AGARWAL, method: 'PLOT' },
      ETAH_RATES,
    );
    expect(plot.floors).toHaveLength(0);
    expect(plot.partBtoE).toBe(0);
    expect(plot.guideline.constructionValue).toBe(0);
    expect(plot.totalValue).toBe(24552000);
  });
});
