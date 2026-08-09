import {
  CalculatedEstimate,
  FloorBreakdown,
} from 'types/valuation-estimate.types';

const SQ_FT_PER_SQ_M = 10.7639;
const MAX_PLOT_SQ_M = 2000;

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function getCoveragePercent(plotAreaSqM: number): number {
  if (plotAreaSqM > MAX_PLOT_SQ_M) {
    throw new Error(
      `Plot area exceeds maximum supported size of ${MAX_PLOT_SQ_M} sq m`,
    );
  }
  if (plotAreaSqM <= 100) return 0.75;
  if (plotAreaSqM <= 300) return 0.65;
  if (plotAreaSqM <= 500) return 0.55;
  return 0.45;
}

function ordinalFloorName(floorNumber: number): string {
  const mod100 = floorNumber % 100;
  if (mod100 >= 11 && mod100 <= 13) {
    return `${floorNumber}th Floor`;
  }
  switch (floorNumber % 10) {
    case 1:
      return `${floorNumber}st Floor`;
    case 2:
      return `${floorNumber}nd Floor`;
    case 3:
      return `${floorNumber}rd Floor`;
    default:
      return `${floorNumber}th Floor`;
  }
}

export class ValuationEstimateCalculator {
  static calculate(
    plotAreaSqFt: number,
    estimatedAmount: number,
    rate: number,
    mumtyThreshold: number,
  ): CalculatedEstimate {
    const totalPermissibleAreaSqFt = round2(estimatedAmount / rate);
    const plotAreaSqM = round2(plotAreaSqFt / SQ_FT_PER_SQ_M);
    const coveragePercent = getCoveragePercent(plotAreaSqM);
    const groundFloorAreaSqFt = round2(plotAreaSqFt * coveragePercent);

    const floors: FloorBreakdown[] = [
      { name: 'Ground Floor', areaSqFt: groundFloorAreaSqFt },
    ];

    let remaining = round2(totalPermissibleAreaSqFt - groundFloorAreaSqFt);
    const maxFloorArea = groundFloorAreaSqFt;
    let floorNumber = 1;

    while (remaining > 0) {
      if (remaining <= mumtyThreshold) {
        floors.push({ name: 'Mumty', areaSqFt: round2(remaining) });
        break;
      }

      if (remaining <= maxFloorArea) {
        floors.push({
          name: ordinalFloorName(floorNumber),
          areaSqFt: round2(remaining),
        });
        break;
      }

      floors.push({
        name: ordinalFloorName(floorNumber),
        areaSqFt: round2(maxFloorArea),
      });
      remaining = round2(remaining - maxFloorArea);
      floorNumber += 1;
    }

    return {
      plotAreaSqFt,
      plotAreaSqM,
      estimatedAmount,
      rate,
      coveragePercent,
      totalPermissibleAreaSqFt,
      groundFloorAreaSqFt,
      floors,
    };
  }
}
