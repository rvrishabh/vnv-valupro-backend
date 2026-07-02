import { Injectable } from '@nestjs/common';
import { Branch, Prisma } from 'generated/prisma/client';
import { SortOrder } from 'generated/prisma/internal/prismaNamespace';
import { PrismaBaseRepository } from 'src/core/base/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { BranchFilter } from 'types/branch.types';

export const BRANCH_WITH_INSTITUTION = {
  institution: { include: { institutionType: true } },
} as const;

export const BRANCH_PUBLIC_SELECT = {
  id: true,
  branchName: true,
  city: true,
  state: true,
} as const;

export type BranchWithInstitution = Prisma.BranchGetPayload<{
  include: typeof BRANCH_WITH_INSTITUTION;
}>;

@Injectable()
export class BranchesRepository extends PrismaBaseRepository<
  Branch,
  Prisma.BranchCreateInput,
  Prisma.BranchUpdateInput,
  Prisma.BranchWhereInput,
  Prisma.BranchOrderByWithRelationInput,
  BranchFilter
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.branch;
  }

  protected searchFields = ['branchName', 'city', 'ifscCode'];

  protected filterableFields = [
    'institutionId',
    'city',
    'needsVerification',
    'isManuallyEntered',
    'createdAt',
  ];

  protected sortableFields = ['createdAt', 'branchName', 'city'];

  protected defaultOrderBy = { createdAt: SortOrder.desc };

  findByIfscCode(ifscCode: string): Promise<BranchWithInstitution | null> {
    return this.prisma.branch.findUnique({
      where: { ifscCode },
      include: BRANCH_WITH_INSTITUTION,
    });
  }

  findByIdWithInstitution(id: string) {
    return this.prisma.branch.findUnique({
      where: { id },
      include: BRANCH_WITH_INSTITUTION,
    });
  }

  findActiveVerifiedById(id: string) {
    return this.prisma.branch.findFirst({
      where: { id, needsVerification: false },
      include: BRANCH_WITH_INSTITUTION,
    });
  }

  findPublicByInstitution(institutionId: string) {
    return this.prisma.branch.findMany({
      where: { institutionId, needsVerification: false },
      select: BRANCH_PUBLIC_SELECT,
      orderBy: { branchName: 'asc' },
    });
  }

  findVerificationQueue() {
    return this.prisma.branch.findMany({
      where: { needsVerification: true },
      include: BRANCH_WITH_INSTITUTION,
      orderBy: { createdAt: 'asc' },
    });
  }

  countUsers(branchId: string) {
    return this.prisma.user.count({ where: { branchId } });
  }

  countCases(branchId: string) {
    return this.prisma.case.count({ where: { branchId } });
  }
}
