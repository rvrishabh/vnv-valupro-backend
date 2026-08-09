import { FilterRecord, IBaseFilterQuery } from 'types/common.types';

export interface FloorBreakdown {
  name: string;
  areaSqFt: number;
}

export interface EstimateResult {
  ownerName: string;
  address: string;
  plotAreaSqFt: number;
  plotAreaSqM: number;
  estimatedAmount: number;
  rate: number;
  coveragePercent: number;
  totalPermissibleAreaSqFt: number;
  groundFloorAreaSqFt: number;
  floors: FloorBreakdown[];
}

export type CalculatedEstimate = Omit<EstimateResult, 'ownerName' | 'address'>;

export interface ValuationEstimateFilter extends FilterRecord {
  createdBy?: string;
}

export interface IListValuationEstimatesQuery extends IBaseFilterQuery {
  createdBy?: string;
}
