import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { FindQuery } from 'types/common.types';
import { RoleFilter } from 'types/role.types';

import { PermissionsRepository } from 'src/modules/permissions/repositories/permissions.repository';
import {
  AssignPermissionsDto,
  CreateRoleDto,
  UpdateRoleDto,
} from 'src/modules/roles/dto/role.dto';
import { RolesRepository } from './repositories/roles.repository';

@Injectable()
export class RolesService {
  constructor(
    private readonly rolesRepo: RolesRepository,
    private readonly permissionsRepo: PermissionsRepository,
  ) {}

  async create(data: CreateRoleDto) {
    const existing = await this.rolesRepo.findByName(data.name);
    if (existing) {
      throw new ConflictException(`Role "${data.name}" already exists`);
    }

    try {
      return await this.rolesRepo.create(data);
    } catch (error) {
      this.handleUniqueError(error, data.name);
      throw error;
    }
  }

  async findAll(query: FindQuery<RoleFilter>) {
    return this.rolesRepo.findAll(query);
  }

  async findOne(id: string) {
    const role = await this.rolesRepo.findByIdWithPermissions(id);
    if (!role) {
      throw new NotFoundException('Role not found');
    }
    return role;
  }

  async update(id: string, data: UpdateRoleDto) {
    await this.findOne(id);

    if (data.name) {
      const existing = await this.rolesRepo.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictException(`Role "${data.name}" already exists`);
      }
    }

    try {
      return await this.rolesRepo.updateById(id, data);
    } catch (error) {
      if (data.name) {
        this.handleUniqueError(error, data.name);
      }
      throw error;
    }
  }

  async remove(id: string) {
    const role = await this.findOne(id);

    if (role.isSystem) {
      throw new ConflictException('Cannot delete a system role');
    }

    const userCount = await this.rolesRepo.countUsers(id);
    if (userCount > 0) {
      throw new ConflictException(
        `Cannot delete role: ${userCount} user(s) still reference it`,
      );
    }

    await this.rolesRepo.deleteById(id);
    return { message: 'Role deleted' };
  }

  async assignPermissions(id: string, data: AssignPermissionsDto) {
    await this.findOne(id);

    const permissions = await Promise.all(
      data.permissionIds.map((permissionId) =>
        this.permissionsRepo.findById(permissionId),
      ),
    );
    const missing = data.permissionIds.filter((_, i) => !permissions[i]);
    if (missing.length > 0) {
      throw new BadRequestException(
        `Permission(s) not found: ${missing.join(', ')}`,
      );
    }

    return this.rolesRepo.assignPermissions(id, data.permissionIds);
  }

  async unassignPermission(id: string, permissionId: string) {
    await this.findOne(id);
    return this.rolesRepo.unassignPermission(id, permissionId);
  }

  private handleUniqueError(error: unknown, name: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(`Role "${name}" already exists`);
    }
  }
}
