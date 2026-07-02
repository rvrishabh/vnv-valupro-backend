import { ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { FindQuery } from 'types/common.types';
import { InstitutionTypeFilter } from 'types/institution-type.types';

import {
  CreateInstitutionTypeDto,
  UpdateInstitutionTypeDto,
} from 'src/modules/institution-types/dto/institution-type.dto';
import { InstitutionTypesRepository } from './repositories/institution-types.repository';

export class InstitutionTypesService {
  constructor(
    private readonly institutionTypesRepo: InstitutionTypesRepository,
  ) {}

  async create(data: CreateInstitutionTypeDto) {
    const existing = await this.institutionTypesRepo.findByName(data.name);
    if (existing) {
      throw new ConflictException(
        `Institution type "${data.name}" already exists`,
      );
    }

    try {
      return await this.institutionTypesRepo.create(data);
    } catch (error) {
      this.handleUniqueError(error, data.name);
      throw error;
    }
  }

  findAll(query: FindQuery<InstitutionTypeFilter>) {
    return this.institutionTypesRepo.findAll(query);
  }

  async findOne(id: string) {
    const type =
      await this.institutionTypesRepo.findByIdWithInstitutionCount(id);
    if (!type) {
      throw new NotFoundException('Institution type not found');
    }
    return type;
  }

  async update(id: string, data: UpdateInstitutionTypeDto) {
    await this.findOne(id);

    if (data.name) {
      const existing = await this.institutionTypesRepo.findByName(data.name);
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Institution type "${data.name}" already exists`,
        );
      }
    }

    try {
      return await this.institutionTypesRepo.updateById(id, data);
    } catch (error) {
      if (data.name) {
        this.handleUniqueError(error, data.name);
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);

    const count = await this.institutionTypesRepo.countInstitutions(id);
    if (count > 0) {
      throw new ConflictException(
        `Cannot delete institution type: ${count} institution(s) still reference it`,
      );
    }

    await this.institutionTypesRepo.deleteById(id);
    return { message: 'Institution type deleted' };
  }

  private handleUniqueError(error: unknown, name: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(`Institution type "${name}" already exists`);
    }
  }
}
