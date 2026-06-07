// src/common/repositories/prisma-base.repository.ts
import { PrismaService } from 'src/prisma/prisma.service';
import {
  FilterRecord,
  FindQuery,
  PaginatedResult,
  SortOrder,
} from 'types/common.types';

export abstract class PrismaBaseRepository<
  TEntity,
  TCreate,
  TUpdate,
  TWhere extends Record<string, unknown>,
  TOrderBy,
  TFilter extends FilterRecord = FilterRecord,
> {
  constructor(protected readonly prisma: PrismaService) {}

  /** Each child repo points to prisma.user, prisma.case, etc. */
  protected abstract get delegate(): {
    findMany(args: unknown): Promise<TEntity[]>;
    findFirst(args: unknown): Promise<TEntity | null>;
    count(args: unknown): Promise<number>;
    create(args: unknown): Promise<TEntity>;
    update(args: unknown): Promise<TEntity>;
    delete(args: unknown): Promise<TEntity>;
  };

  protected abstract searchFields: string[];
  protected abstract filterableFields: string[];
  protected abstract sortableFields: string[];
  protected abstract defaultOrderBy: TOrderBy;

  /** Optional: relation/nested filters (loginChannel on role, etc.) */
  protected applyCustomFilters(filter: TFilter, where: TWhere): TWhere {
    return where;
  }

  protected buildWhere(query: FindQuery<TFilter>): TWhere {
    const where = {} as TWhere;
    const filter = query.filter ?? ({} as TFilter);

    for (const [key, rawValue] of Object.entries(filter)) {
      if (rawValue === undefined || rawValue === null || rawValue === '')
        continue;

      if (
        key === 'date' &&
        typeof rawValue === 'object' &&
        !Array.isArray(rawValue)
      ) {
        const dateFilter = rawValue;
        const column = dateFilter.condition;
        if (!this.filterableFields.includes(column)) continue;

        (where as Record<string, unknown>)[column] = {
          ...(dateFilter.startDate && { gte: new Date(dateFilter.startDate) }),
          ...(dateFilter.endDate && { lte: new Date(dateFilter.endDate) }),
        };
        continue;
      }

      if (!this.filterableFields.includes(key)) continue;

      if (Array.isArray(rawValue)) {
        (where as Record<string, unknown>)[key] = { in: rawValue };
      } else if (rawValue === 'true' || rawValue === true) {
        (where as Record<string, unknown>)[key] = true;
      } else if (rawValue === 'false' || rawValue === false) {
        (where as Record<string, unknown>)[key] = false;
      } else {
        (where as Record<string, unknown>)[key] = rawValue;
      }
    }

    if (query.search?.trim() && this.searchFields.length > 0) {
      const searchTerm = query.search.trim();
      (where as Record<string, unknown>).OR = this.searchFields.map(
        (field) => ({
          [field]: { contains: searchTerm, mode: 'insensitive' },
        }),
      );
    }

    return this.applyCustomFilters(filter, where);
  }

  protected buildOrderBy(query: FindQuery<TFilter>): TOrderBy {
    const sort = query.sort;

    let field: string | undefined;
    let direction: SortOrder = 'desc';

    if (typeof sort === 'string' && sort.length > 0) {
      const [f, d] = sort.split(/[.:]/);
      field = f;
      if (d?.toLowerCase() === 'asc' || d?.toLowerCase() === 'desc') {
        direction = d.toLowerCase() as SortOrder;
      }
    } else if (sort && typeof sort === 'object') {
      const [f, d] = Object.entries(sort)[0] ?? [];
      field = f;
      if (d === 'asc' || d === 'desc') direction = d;
    }

    if (!field || !this.sortableFields.includes(field)) {
      return this.defaultOrderBy;
    }

    return { [field]: direction } as TOrderBy;
  }

  protected getPagination(query: FindQuery<TFilter>) {
    const page = query.page ?? 1;
    const limit = Math.min(query.limit ?? 20, 100);
    return {
      page,
      limit,
      skip: (page - 1) * limit,
      take: limit,
    };
  }

  async findAll(
    query: FindQuery<TFilter>,
    include?: unknown,
  ): Promise<PaginatedResult<TEntity>> {
    const where = this.buildWhere(query);
    const orderBy = this.buildOrderBy(query);
    const { page, limit, skip, take } = this.getPagination(query);

    const [data, total] = await Promise.all([
      this.delegate.findMany({ where, orderBy, skip, take, include }),
      this.delegate.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit) || 0,
    };
  }

  async findById(id: string, include?: unknown): Promise<TEntity | null> {
    return this.delegate.findFirst({
      where: { id },
      include,
    });
  }

  async findOneBy(
    conditions: Partial<TFilter>,
    include?: unknown,
  ): Promise<TEntity | null> {
    return this.delegate.findFirst({
      where: this.buildWhere({ filter: conditions as TFilter }),
      include,
    });
  }

  async create(data: TCreate, include?: unknown): Promise<TEntity> {
    return this.delegate.create({ data, include });
  }

  async updateById(
    id: string,
    data: TUpdate,
    include?: unknown,
  ): Promise<TEntity> {
    return this.delegate.update({
      where: { id },
      data,
      include,
    });
  }

  async deleteById(id: string): Promise<void> {
    await this.delegate.delete({ where: { id } });
  }

  async count(query?: FindQuery<TFilter>): Promise<number> {
    const where = query ? this.buildWhere(query) : undefined;
    return this.delegate.count({ where });
  }
}
