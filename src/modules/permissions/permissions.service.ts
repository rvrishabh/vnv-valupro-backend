import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { FindQuery } from 'types/common.types';
import { PermissionFilter } from 'types/permission.types';

import {
  CreatePermissionDto,
  UpdatePermissionDto,
} from 'src/modules/permissions/dto/permission.dto';
import { PermissionsRepository } from './repositories/permissions.repository';

@Injectable()
export class PermissionsService {
  constructor(private readonly permissionsRepo: PermissionsRepository) {}

  async create(data: CreatePermissionDto) {
    const existingByName = await this.permissionsRepo.findByName(data.name);
    if (existingByName) {
      throw new ConflictException(`Permission "${data.name}" already exists`);
    }

    const existingByResourceAction =
      await this.permissionsRepo.findByResourceAction(
        data.resource,
        data.action,
      );
    if (existingByResourceAction) {
      throw new ConflictException(
        `Permission for resource "${data.resource}" and action "${data.action}" already exists`,
      );
    }

    try {
      return await this.permissionsRepo.create(data);
    } catch (error) {
      this.handleUniqueError(error, data.name);
      throw error;
    }
  }

  async findAll(query: FindQuery<PermissionFilter>) {
    return this.permissionsRepo.findAll(query);
  }

  async findOne(id: string) {
    const permission = await this.permissionsRepo.findById(id);
    if (!permission) {
      throw new NotFoundException('Permission not found');
    }
    return permission;
  }

  async update(id: string, data: UpdatePermissionDto) {
    await this.findOne(id);

    if (data.name) {
      const existing = await this.permissionsRepo.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Permission "${data.name}" already exists`,
        );
      }
    }

    if (data.resource && data.action) {
      const existing = await this.permissionsRepo.findByResourceAction(
        data.resource,
        data.action,
      );
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Permission for resource "${data.resource}" and action "${data.action}" already exists`,
        );
      }
    }

    try {
      return await this.permissionsRepo.updateById(id, data);
    } catch (error) {
      if (data.name) {
        this.handleUniqueError(error, data.name);
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);

    const count = await this.permissionsRepo.countRolePermissions(id);
    if (count > 0) {
      throw new ConflictException(
        `Cannot delete permission: ${count} role(s) still reference it`,
      );
    }

    await this.permissionsRepo.deleteById(id);
    return { message: 'Permission deleted' };
  }

  private handleUniqueError(error: unknown, name: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(`Permission "${name}" already exists`);
    }
  }
}
