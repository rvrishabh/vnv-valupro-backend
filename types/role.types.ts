import { FilterRecord, IBaseFilterQuery } from 'types/common.types';

export type RoleFilter = FilterRecord;

export interface IListRolesQuery extends IBaseFilterQuery {
  loginChannel?: string;
  isSystem?: boolean;
}
