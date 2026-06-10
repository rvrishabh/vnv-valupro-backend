import {
  FilterRecord,
  FindQuery,
  IBaseFilterQuery,
  IDateRangeFilter,
} from 'types/common.types';

/**
 * Maps flat list query DTO params to FindQuery for PrismaBaseRepository.
 */
export function toFindQuery<TFilter extends FilterRecord>(
  query: IBaseFilterQuery,
  filter: TFilter = {} as TFilter,
): FindQuery<TFilter> {
  const dateRange = buildDateRangeFilter(query);

  return {
    page: query.page,
    limit: query.limit,
    search: query.search,
    sort: query.sort,
    filter: {
      ...filter,
      ...(dateRange && { date: dateRange }),
    },
  };
}

function buildDateRangeFilter(
  query: IBaseFilterQuery,
): IDateRangeFilter | undefined {
  if (!query.startDate && !query.endDate) {
    return undefined;
  }

  return {
    condition: query.dateCondition ?? 'createdAt',
    startDate: query.startDate,
    endDate: query.endDate,
  };
}
