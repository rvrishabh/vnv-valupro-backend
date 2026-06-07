import { FilterRecord, FindQuery, PaginatedResult } from 'types/common.types';

export interface IBaseRepository<
  TEntity,
  TCreate,
  TUpdate,
  TFilter extends FilterRecord = FilterRecord,
> {
  findAll(query: FindQuery<TFilter>): Promise<PaginatedResult<TEntity>>;
  findById(id: string): Promise<TEntity | null>;
  findOneBy(conditions: Partial<TFilter>): Promise<TEntity | null>;
  create(data: TCreate): Promise<TEntity>;
  updateById(id: string, data: TUpdate): Promise<TEntity>;
  deleteById(id: string): Promise<void>;
  count(query?: FindQuery<TFilter>): Promise<number>;
}
