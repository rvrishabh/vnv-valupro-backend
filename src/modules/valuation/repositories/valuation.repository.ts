import { Injectable } from '@nestjs/common';
import { Prisma, ValuationReport } from 'generated/prisma/client';
import { SortOrder } from 'generated/prisma/internal/prismaNamespace';
import { PrismaBaseRepository } from 'src/core/base/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValuationFilter } from 'types/valuation.types';

@Injectable()
export class ValuationRepository extends PrismaBaseRepository<
  ValuationReport,
  Prisma.ValuationReportCreateInput,
  Prisma.ValuationReportUpdateInput,
  Prisma.ValuationReportWhereInput,
  Prisma.ValuationReportOrderByWithRelationInput,
  ValuationFilter
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.valuationReport;
  }

  protected searchFields = ['tehsil'];

  protected filterableFields = ['caseId', 'engineerId', 'status', 'createdAt'];

  protected sortableFields = [
    'createdAt',
    'submittedAt',
    'totalMarketValue',
    'roundedMarketValue',
    'realizableValue',
  ];

  protected defaultOrderBy = { createdAt: SortOrder.desc };

  /** The PDF and detail view need the case, institution and engineer alongside the report. */
  findDetailed(id: string) {
    return this.prisma.valuationReport.findUnique({
      where: { id },
      include: {
        engineer: { select: { id: true, name: true, email: true } },
        case: {
          include: {
            institution: true,
            branch: true,
          },
        },
      },
    });
  }

  findByCaseId(caseId: string): Promise<ValuationReport | null> {
    return this.prisma.valuationReport.findUnique({ where: { caseId } });
  }
}
