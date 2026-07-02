import { FilterRecord, IBaseFilterQuery } from 'types/common.types';

export interface BranchFilter extends FilterRecord {
  institutionId?: string;
  city?: string;
  needsVerification?: boolean;
  isManuallyEntered?: boolean;
}

export interface IListBranchesQuery extends IBaseFilterQuery {
  institutionId?: string;
  city?: string;
  needsVerification?: boolean;
  isManuallyEntered?: boolean;
}
