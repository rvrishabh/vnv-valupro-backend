// types/common.types.ts
export interface IPaginationQuery {
  page?: number;
  limit?: number;
}

export interface ISortQuery {
  sort?: string | Record<string, 'asc' | 'desc'>;
  // examples: "createdAt:desc" or { createdAt: 'desc' }
}

export interface IDateRangeFilter {
  condition?: string; // column name, default createdAt
  startDate?: string;
  endDate?: string;
}

export type FilterValue =
  | string
  | number
  | boolean
  | string[]
  | number[]
  | IDateRangeFilter;

export type FilterRecord = Record<string, FilterValue | undefined>;

export type SortOrder = 'asc' | 'desc';

export interface FindQuery<TFilter extends FilterRecord = FilterRecord>
  extends IPaginationQuery, ISortQuery {
  search?: string;
  filter?: TFilter;
}

/** Flat query params shared by list endpoints — maps to FindQuery via toFindQuery(). */
export interface IBaseFilterQuery extends IPaginationQuery, ISortQuery {
  search?: string;
  startDate?: string;
  endDate?: string;
  /** Column for date range filter; defaults to createdAt in toFindQuery(). */
  dateCondition?: string;
}

export interface PaginatedResult<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}
