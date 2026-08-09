import { Injectable } from '@nestjs/common';
import { Prisma, ValuationEstimate } from 'generated/prisma/client';
import { SortOrder } from 'generated/prisma/internal/prismaNamespace';
import { PrismaBaseRepository } from 'src/core/base/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValuationEstimateFilter } from 'types/valuation-estimate.types';

@Injectable()
export class ValuationEstimateRepository extends PrismaBaseRepository<
  ValuationEstimate,
  Prisma.ValuationEstimateCreateInput,
  Prisma.ValuationEstimateUpdateInput,
  Prisma.ValuationEstimateWhereInput,
  Prisma.ValuationEstimateOrderByWithRelationInput,
  ValuationEstimateFilter
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.valuationEstimate;
  }

  protected searchFields = ['ownerName', 'address'];

  protected filterableFields = ['createdBy', 'createdAt'];

  protected sortableFields = ['createdAt', 'ownerName', 'estimatedAmount'];

  protected defaultOrderBy = { createdAt: SortOrder.desc };

  findByUserId(userId: string): Promise<ValuationEstimate[]> {
    return this.prisma.valuationEstimate.findMany({
      where: { createdBy: userId },
      orderBy: { createdAt: 'desc' },
    });
  }
}
