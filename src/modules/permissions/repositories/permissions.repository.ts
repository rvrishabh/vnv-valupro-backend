import { Injectable } from '@nestjs/common';
import { Permission, Prisma } from 'generated/prisma/client';
import { SortOrder } from 'generated/prisma/internal/prismaNamespace';
import { PrismaBaseRepository } from 'src/core/base/base.repository';
import { PrismaService } from 'src/prisma/prisma.service';
import { PermissionFilter } from 'types/permission.types';

@Injectable()
export class PermissionsRepository extends PrismaBaseRepository<
  Permission,
  Prisma.PermissionCreateInput,
  Prisma.PermissionUpdateInput,
  Prisma.PermissionWhereInput,
  Prisma.PermissionOrderByWithRelationInput,
  PermissionFilter
> {
  constructor(prisma: PrismaService) {
    super(prisma);
  }

  protected get delegate() {
    return this.prisma.permission;
  }

  protected searchFields = ['name', 'resource', 'action', 'description'];

  protected filterableFields = ['resource', 'action', 'createdAt'];

  protected sortableFields = ['createdAt', 'name', 'resource', 'action'];

  protected defaultOrderBy = { createdAt: SortOrder.desc };

  findByName(name: string) {
    return this.prisma.permission.findUnique({ where: { name } });
  }

  findByResourceAction(resource: string, action: string) {
    return this.prisma.permission.findUnique({
      where: { resource_action: { resource, action } },
    });
  }

  countRolePermissions(permissionId: string) {
    return this.prisma.rolePermission.count({ where: { permissionId } });
  }
}
