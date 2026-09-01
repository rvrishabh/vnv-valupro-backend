import { FilterRecord, IBaseFilterQuery } from 'types/common.types';

/** M-Doc!C7 — drives which parts of the report and engine apply. */
export type ValuationMethod = 'LAND_AND_BUILDING' | 'CRM' | 'PLOT';

/** M-Rate!C39 — attracts a circle-rate uplift. */
export type PlotPosition =
  | 'Intermittent Plot'
  | '2 Side Road Facing Plot'
  | 'Park Facing'
  | 'Park & 2 Side Road Facing Plot'
  | 'Flat';

export type RoofType = 'RCC' | 'RBC' | 'Girder Stone' | 'Tin Shed' | 'Kachcha';

export interface FloorSpecs {
  walls?: string;
  partitions?: string;
  doors?: string;
  windows?: string;
  flooring?: string;
  finishing?: string;
  ceiling?: string;
  roofingTerracing?: string;
  wiring?: string;
  electricalFittings?: string;
  sanitaryInstallations?: string;
  heightOfFloor?: string;
}

export interface FloorInput {
  /** "Ground Floor", "I Floor", ... — order matters, index 0 is the ground floor. */
  name: string;
  coveredAreaSqM: number;
  /** M-Rate!D49 — the area measured on site, before any considered-basis adjustment. Reference only; not used in any calculation. */
  actualAreaSqM?: number;
  /**
   * M-Rate!C82:E82 — floors are often built years apart, so each carries its
   * own year and depreciates on its own age. Falls back to the building-level
   * year when not set, which is how the sheet seeds D82 from C82.
   */
  yearOfConstruction?: number;
  /** M-Rate!C84:E84 — expected life can differ per floor for the same reason. */
  expectedLifeYears?: number;
  /** M-Rate!C86 — replacement rate of construction, per Sq.m. */
  replacementRate: number;
  roofType: RoofType;
  /** M-Rate!C79 — 1 = Good/Normal, 2 = Average/Ordinary. Selects the govt. rate column. */
  constructionCategory: 1 | 2;
  specs?: FloorSpecs;
}

export interface ValuationInput {
  method: ValuationMethod;
  /** M-Doc!G1 — the year the valuation is made in; ages are measured against it. */
  reportYear: number;
  /** M-Doc!C48 — keys the govt. construction-rate lookup. */
  tehsil: string;
  /** M-Doc!C105 — area under consideration, Sq.m. */
  plotAreaSqM: number;

  land: {
    /** M-Rate!C35 — valuer's opinion of the market rate, per Sq.m. */
    prevailingMarketRate: number;
    /** M-Rate!C36 — govt. guideline rate before any positional uplift. */
    circleRate: number;
    /** M-Rate!C37 — the rate actually adopted, per Sq.m. */
    adoptedRate: number;
    plotPosition: PlotPosition;
    /** M-Rate!C41 — extra for super-area component, as a fraction (0.15 = 15%). */
    superAreaPercent: number;
  };

  building: {
    /** M-Rate!C61 */
    yearOfConstruction: number;
    /** M-Rate!C84 — total estimated life. */
    expectedLifeYears: number;
    floors: FloorInput[];
  };

  /** Rupee values already assessed by the valuer; non-numeric entries ("Nil") are ignored. */
  extraItems?: Record<string, number | string>;
  services?: Record<string, number | string>;
}

export interface FloorValuation {
  name: string;
  coveredAreaSqM: number;
  yearOfConstruction: number;
  age: number;
  residualAge: number;
  expectedLifeYears: number;
  depreciationPercent: number;
  replacementRate: number;
  /** ROUND(rate x area, -2) */
  replacementValue: number;
  /** ROUND(replacementValue x depreciationPercent, -2) */
  depreciation: number;
  depreciatedValue: number;
}

export interface GuidelineFloorValuation {
  name: string;
  roofType: RoofType;
  /** VLOOKUP against the govt. construction-rate table. */
  constructionRate: number;
  /** Depreciated only when age > 19. */
  depreciatedRate: number;
  value: number;
}

export interface GuidelineValuation {
  circleRateAdjusted: number;
  landValue: number;
  floors: GuidelineFloorValuation[];
  constructionValue: number;
  totalValue: number;
}

export interface CoverageResult {
  plotAreaSqM: number;
  groundCoverageSqM: number;
  permissibleCoveragePercent: number;
  permissibleFAR: number;
  achievedCoveragePercent: number;
  totalCoveredAreaSqM: number;
  achievedFAR: number;
}

export interface ValuationResult {
  method: ValuationMethod;
  /** Land component. */
  landValue: number;
  partA: number;
  floors: FloorValuation[];
  /** Parts B–E: building + amenities + extra items, after depreciation. */
  partBtoE: number;
  extraItemsValue: number;
  totalValue: number;
  roundedValue: number;
  realizableValue: number;
  distressValue: number;
  insurableValue: number;
  /** Rate composition used by the CRM/composite branch and the rate summary. */
  depreciatedBuildingRate: number;
  landComponentRate: number;
  compositeRate: number;
  fairMarketValue: number;
  rateVariationPercent: number;
  guideline: GuidelineValuation;
  coverage: CoverageResult;
}

export interface ValuationFilter extends FilterRecord {
  caseId?: string;
  engineerId?: string;
  checkerStatus?: string;
}

export interface IListValuationsQuery extends IBaseFilterQuery {
  caseId?: string;
  checkerStatus?: string;
}
