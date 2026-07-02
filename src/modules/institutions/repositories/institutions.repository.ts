import { Injectable } from '@nestjs/common';
import { Institution, Prisma } from 'generated/prisma/client';
import { SortOrder } from 'generated/prisma/internal/prismaNamespace';
import { PrismaBaseRepository } from 'src/core/base/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { InstitutionFilter } from 'types/institution.types';

export const INSTITUTION_PUBLIC_SELECT = {
  id: true,
  name: true,
  code: true,
  institutionType: { select: { id: true, name: true } },
} as const;

export const INSTITUTION_DETAIL_INCLUDE = {
  institutionType: true,
  _count: { select: { branches: true } },
} as const;

@Injectable()
export class InstitutionsRepository extends PrismaBaseRepository<
  Institution,
  Prisma.InstitutionCreateInput,
  Prisma.InstitutionUpdateInput,
  Prisma.InstitutionWhereInput,
  Prisma.InstitutionOrderByWithRelationInput,
  InstitutionFilter
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.institution;
  }

  protected searchFields = ['name', 'code'];

  protected filterableFields = ['institutionTypeId', 'isActive', 'createdAt'];

  protected sortableFields = ['createdAt', 'name', 'code'];

  protected defaultOrderBy = { createdAt: SortOrder.desc };

  findByCode(code: string) {
    return this.prisma.institution.findUnique({ where: { code } });
  }

  findActiveById(id: string) {
    return this.prisma.institution.findFirst({
      where: { id, isActive: true },
    });
  }

  findByNameCaseInsensitive(name: string, institutionTypeName: string) {
    return this.prisma.institution.findFirst({
      where: {
        name: { equals: name.trim(), mode: 'insensitive' },
        institutionType: { name: institutionTypeName },
      },
    });
  }

  findByIdWithDetails(id: string) {
    return this.prisma.institution.findUnique({
      where: { id },
      include: INSTITUTION_DETAIL_INCLUDE,
    });
  }

  findAllPublic() {
    return this.prisma.institution.findMany({
      where: { isActive: true },
      select: INSTITUTION_PUBLIC_SELECT,
      orderBy: { name: 'asc' },
    });
  }

  countBranches(institutionId: string) {
    return this.prisma.branch.count({ where: { institutionId } });
  }

  countUsers(institutionId: string) {
    return this.prisma.user.count({ where: { institutionId } });
  }

  countCases(institutionId: string) {
    return this.prisma.case.count({ where: { institutionId } });
  }
}
