import { Injectable } from '@nestjs/common';
import { InstitutionType, Prisma } from 'generated/prisma/client';
import { SortOrder } from 'generated/prisma/internal/prismaNamespace';
import { PrismaBaseRepository } from 'src/core/base/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { InstitutionTypeFilter } from 'types/institution-type.types';

@Injectable()
export class InstitutionTypesRepository extends PrismaBaseRepository<
  InstitutionType,
  Prisma.InstitutionTypeCreateInput,
  Prisma.InstitutionTypeUpdateInput,
  Prisma.InstitutionTypeWhereInput,
  Prisma.InstitutionTypeOrderByWithRelationInput,
  InstitutionTypeFilter
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.institutionType;
  }

  protected searchFields = ['name', 'description'];

  protected filterableFields = ['createdAt'];

  protected sortableFields = ['createdAt', 'name'];

  protected defaultOrderBy = { createdAt: SortOrder.desc };

  findByName(name: string) {
    return this.prisma.institutionType.findUnique({ where: { name } });
  }

  findByIdWithInstitutionCount(id: string) {
    return this.prisma.institutionType.findUnique({
      where: { id },
      include: { _count: { select: { institutions: true } } },
    });
  }

  countInstitutions(institutionTypeId: string) {
    return this.prisma.institution.count({
      where: { institutionTypeId },
    });
  }
}
