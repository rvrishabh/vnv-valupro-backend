import { Injectable } from '@nestjs/common';
import { Prisma, Role } from 'generated/prisma/client';
import { SortOrder } from 'generated/prisma/internal/prismaNamespace';
import { PrismaBaseRepository } from 'src/core/base/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { RoleFilter } from 'types/role.types';

@Injectable()
export class RolesRepository extends PrismaBaseRepository<
  Role,
  Prisma.RoleCreateInput,
  Prisma.RoleUpdateInput,
  Prisma.RoleWhereInput,
  Prisma.RoleOrderByWithRelationInput,
  RoleFilter
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.role;
  }

  protected searchFields = ['name', 'description'];

  protected filterableFields = ['loginChannel', 'isSystem', 'createdAt'];

  protected sortableFields = ['createdAt', 'name'];

  protected defaultOrderBy = { createdAt: SortOrder.desc };

  findByName(name: string) {
    return this.prisma.role.findUnique({ where: { name } });
  }

  findByIdWithPermissions(id: string) {
    return this.prisma.role.findUnique({
      where: { id },
      include: { rolePermissions: { include: { permission: true } } },
    });
  }

  countUsers(roleId: string) {
    return this.prisma.user.count({ where: { roleId } });
  }

  async assignPermissions(roleId: string, permissionIds: string[]) {
    await this.prisma.rolePermission.createMany({
      data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
      skipDuplicates: true,
    });
    return this.findByIdWithPermissions(roleId);
  }

  async unassignPermission(roleId: string, permissionId: string) {
    await this.prisma.rolePermission.deleteMany({
      where: { roleId, permissionId },
    });
    return this.findByIdWithPermissions(roleId);
  }
}
