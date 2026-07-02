import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { FindQuery } from 'types/common.types';
import { InstitutionFilter } from 'types/institution.types';
import { InstitutionTypesRepository } from '../institution-types/repositories/institution-types.repository';
import {
  CreateInstitutionDto,
  UpdateInstitutionDto,
} from './dto';
import { InstitutionsRepository } from './repositories/institutions.repository';

@Injectable()
export class InstitutionsService {
  constructor(
    private readonly institutionsRepo: InstitutionsRepository,
    private readonly institutionTypesRepo: InstitutionTypesRepository,
  ) {}

  async create(data: CreateInstitutionDto) {
    await this.assertInstitutionTypeExists(data.institutionTypeId);

    const existing = await this.institutionsRepo.findByCode(data.code);
    if (existing) {
      throw new ConflictException(
        `Institution with code "${data.code}" already exists`,
      );
    }

    try {
      return await this.institutionsRepo.create({
        name: data.name,
        code: data.code,
        institutionType: { connect: { id: data.institutionTypeId } },
      });
    } catch (error) {
      this.handleUniqueCodeError(error, data.code);
      throw error;
    }
  }

  findAll(query: FindQuery<InstitutionFilter>) {
    return this.institutionsRepo.findAll(query, {
      institutionType: true,
    });
  }

  findAllPublic() {
    return this.institutionsRepo.findAllPublic();
  }

  async findOne(id: string) {
    const institution = await this.institutionsRepo.findByIdWithDetails(id);
    if (!institution) {
      throw new NotFoundException('Institution not found');
    }
    return institution;
  }

  async update(id: string, data: UpdateInstitutionDto) {
    await this.findOne(id);

    if (data.institutionTypeId) {
      await this.assertInstitutionTypeExists(data.institutionTypeId);
    }

    if (data.code) {
      const existing = await this.institutionsRepo.findByCode(data.code);
      if (existing && existing.id !== id) {
        throw new ConflictException(
          `Institution with code "${data.code}" already exists`,
        );
      }
    }

    const updatePayload: Prisma.InstitutionUpdateInput = {
      ...(data.name !== undefined && { name: data.name }),
      ...(data.code !== undefined && { code: data.code }),
      ...(data.isActive !== undefined && { isActive: data.isActive }),
      ...(data.institutionTypeId && {
        institutionType: { connect: { id: data.institutionTypeId } },
      }),
    };

    try {
      return await this.institutionsRepo.updateById(id, updatePayload);
    } catch (error) {
      if (data.code) {
        this.handleUniqueCodeError(error, data.code);
      }
      throw error;
    }
  }

  async remove(id: string) {
    await this.findOne(id);

    const [branches, users, cases] = await Promise.all([
      this.institutionsRepo.countBranches(id),
      this.institutionsRepo.countUsers(id),
      this.institutionsRepo.countCases(id),
    ]);

    if (branches > 0 || users > 0 || cases > 0) {
      throw new ConflictException(
        `Cannot delete institution: ${branches} branch(es), ${users} user(s), ${cases} case(s) still reference it`,
      );
    }

    await this.institutionsRepo.deleteById(id);
    return { message: 'Institution deleted' };
  }

  private async assertInstitutionTypeExists(institutionTypeId: string) {
    const type = await this.institutionTypesRepo.findById(institutionTypeId);
    if (!type) {
      throw new NotFoundException('Institution type not found');
    }
  }

  private handleUniqueCodeError(error: unknown, code: string): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        `Institution with code "${code}" already exists`,
      );
    }
  }
}
