import { Injectable } from '@nestjs/common';
import { Case, Prisma } from 'generated/prisma/client';
import { SortOrder } from 'generated/prisma/internal/prismaNamespace';
import { PrismaBaseRepository } from 'src/core/base/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterRecord } from 'types/common.types';

@Injectable()
export class CasesRepository extends PrismaBaseRepository<
  Case,
  Prisma.CaseCreateInput,
  Prisma.CaseUpdateInput,
  Prisma.CaseWhereInput,
  Prisma.CaseOrderByWithRelationInput,
  FilterRecord
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.case;
  }

  protected searchFields = ['caseNumber', 'customerName', 'customerMobile'];

  protected filterableFields = [
    'status',
    'institutionId',
    'assignedToId',
    'createdAt',
  ];

  protected sortableFields = ['createdAt', 'caseNumber', 'customerName'];

  protected defaultOrderBy = { createdAt: SortOrder.desc };

  findWithRelations(id: string) {
    return this.prisma.case.findUnique({
      where: { id },
      include: {
        institution: true,
        branch: true,
        report: true,
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        checkedBy: { select: { id: true, name: true, email: true } },
      },
    });
  }
}
