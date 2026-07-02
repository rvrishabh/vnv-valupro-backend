import { Injectable } from '@nestjs/common';
import { Prisma, User } from 'generated/prisma/client';
import { SortOrder } from 'generated/prisma/internal/prismaNamespace';
import { PrismaBaseRepository } from 'src/core/base/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { UserFilter } from 'types/user.types';

export const USER_INCLUDE = {
  role: true,
  institution: { include: { institutionType: true } },
  branch: true,
} as const;

export type UserWithRelations = Prisma.UserGetPayload<{
  include: typeof USER_INCLUDE;
}>;

@Injectable()
export class UserRepository extends PrismaBaseRepository<
  User,
  Prisma.UserCreateInput,
  Prisma.UserUpdateInput,
  Prisma.UserWhereInput,
  Prisma.UserOrderByWithRelationInput,
  UserFilter
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.user;
  }

  protected searchFields = ['name', 'email', 'mobile'];

  protected filterableFields = [
    'isApproved',
    'isActive',
    'roleId',
    'institutionId',
    'branchId',
    'createdAt',
    'updatedAt',
  ];

  protected sortableFields = ['createdAt', 'updatedAt', 'name', 'email'];

  protected defaultOrderBy = { createdAt: SortOrder.desc };

  protected applyCustomFilters(
    filter: UserFilter,
    where: Prisma.UserWhereInput,
  ): Prisma.UserWhereInput {
    if (filter.loginChannel) {
      where.role = { loginChannel: filter.loginChannel };
    }
    return where;
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      include: USER_INCLUDE,
    });
  }

  findByMobile(mobile: string) {
    return this.prisma.user.findUnique({
      where: { mobile },
      include: USER_INCLUDE,
    });
  }

  findByIdWithRelations(id: string): Promise<UserWithRelations | null> {
    return this.findById(id, USER_INCLUDE) as Promise<UserWithRelations | null>;
  }

  findRoleById(roleId: string) {
    return this.prisma.role.findUnique({ where: { id: roleId } });
  }

  findRoleByName(name: string) {
    return this.prisma.role.findFirst({ where: { name } });
  }

  findActiveBranchWithInstitution(branchId: string) {
    return this.prisma.branch.findFirst({
      where: { id: branchId, needsVerification: false },
      include: { institution: true },
    });
  }
}
