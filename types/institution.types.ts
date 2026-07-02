import { FilterRecord, IBaseFilterQuery } from 'types/common.types';

export interface InstitutionFilter extends FilterRecord {
  institutionTypeId?: string;
  isActive?: boolean;
}

export interface IListInstitutionsQuery extends IBaseFilterQuery {
  institutionTypeId?: string;
  isActive?: boolean;
}
