import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from 'generated/prisma/client';
import { FindQuery } from 'types/common.types';
import { BranchFilter } from 'types/branch.types';
import { InstitutionTypesRepository } from '../institution-types/repositories/institution-types.repository';
import { InstitutionsRepository } from '../institutions/repositories/institutions.repository';
import {
  CreateManualBranchDto,
  UpdateBranchDto,
} from './dto';
import {
  BRANCH_WITH_INSTITUTION,
  BranchesRepository,
  BranchWithInstitution,
} from './repositories/branches.repository';
import { IfscLookupService } from './services/ifsc-lookup.service';

export type LookupOrCreateByIfscResult =
  | { found: true; branch: BranchWithInstitution }
  | { found: false; ifscCode: string; reason: 'not_found' };

@Injectable()
export class BranchesService {
  constructor(
    private readonly branchesRepo: BranchesRepository,
    private readonly institutionsRepo: InstitutionsRepository,
    private readonly institutionTypesRepo: InstitutionTypesRepository,
    private readonly ifscLookupService: IfscLookupService,
  ) {}

  async lookupOrCreateByIfsc(
    ifscCode: string,
  ): Promise<LookupOrCreateByIfscResult> {
    const normalized = ifscCode.trim().toUpperCase();

    const existing = await this.branchesRepo.findByIfscCode(normalized);
    if (existing) {
      return { found: true, branch: existing };
    }

    const lookup = await this.ifscLookupService.lookup(normalized);
    if (lookup.found === false) {
      return {
        found: false,
        ifscCode: lookup.ifscCode,
        reason: lookup.reason,
      };
    }

    const { data } = lookup;
    const institution = await this.resolveInstitutionFromIfsc(
      data.bankName,
      data.bankCode,
    );

    const branch = (await this.branchesRepo.create(
      {
        branchName: data.branchName,
        ifscCode: data.ifscCode,
        city: data.city,
        state: data.state,
        district: data.district,
        address: data.address,
        isManuallyEntered: false,
        needsVerification: false,
        institution: { connect: { id: institution.id } },
      },
      BRANCH_WITH_INSTITUTION,
    )) as BranchWithInstitution;

    return { found: true, branch };
  }

  async createManualBranch(
    dto: CreateManualBranchDto,
    createdByAdmin: boolean,
  ) {
    const institution = await this.institutionsRepo.findActiveById(
      dto.institutionId,
    );
    if (!institution) {
      throw new NotFoundException('Active institution not found');
    }

    try {
      return await this.branchesRepo.create(
        {
          branchName: dto.branchName,
          city: dto.city,
          state: dto.state,
          district: dto.district,
          address: dto.address,
          isManuallyEntered: true,
          needsVerification: !createdByAdmin,
          institution: { connect: { id: dto.institutionId } },
        },
        BRANCH_WITH_INSTITUTION,
      );
    } catch (error) {
      this.handleDuplicateBranchError(error);
      throw error;
    }
  }

  findAll(query: FindQuery<BranchFilter>) {
    return this.branchesRepo.findAll(query, BRANCH_WITH_INSTITUTION);
  }

  findPublicByInstitution(institutionId: string) {
    return this.branchesRepo.findPublicByInstitution(institutionId);
  }

  getVerificationQueue() {
    return this.branchesRepo.findVerificationQueue();
  }

  async verifyBranch(branchId: string, adminId: string) {
    const branch = await this.branchesRepo.findById(branchId);
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }
    if (!branch.needsVerification) {
      throw new BadRequestException('Branch does not need verification');
    }

    return this.branchesRepo.updateById(
      branchId,
      {
        needsVerification: false,
        verifiedAt: new Date(),
        verifiedBy: { connect: { id: adminId } },
      },
      BRANCH_WITH_INSTITUTION,
    );
  }

  async rejectBranch(branchId: string) {
    const branch = await this.branchesRepo.findById(branchId);
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    const [users, cases] = await Promise.all([
      this.branchesRepo.countUsers(branchId),
      this.branchesRepo.countCases(branchId),
    ]);

    if (users > 0 || cases > 0) {
      throw new ConflictException(
        `Cannot delete branch: ${users} user(s) and ${cases} case(s) reference it. Reassign those records first.`,
      );
    }

    await this.branchesRepo.deleteById(branchId);
    return { message: 'Branch deleted' };
  }

  async update(branchId: string, data: UpdateBranchDto) {
    const branch = await this.branchesRepo.findById(branchId);
    if (!branch) {
      throw new NotFoundException('Branch not found');
    }

    if (data.institutionId) {
      const institution = await this.institutionsRepo.findActiveById(
        data.institutionId,
      );
      if (!institution) {
        throw new NotFoundException('Active institution not found');
      }
    }

    const updatePayload: Prisma.BranchUpdateInput = {
      ...(data.branchName !== undefined && { branchName: data.branchName }),
      ...(data.city !== undefined && { city: data.city }),
      ...(data.state !== undefined && { state: data.state }),
      ...(data.district !== undefined && { district: data.district }),
      ...(data.address !== undefined && { address: data.address }),
      ...(data.ifscCode !== undefined && { ifscCode: data.ifscCode }),
      ...(data.institutionId && {
        institution: { connect: { id: data.institutionId } },
      }),
    };

    try {
      return await this.branchesRepo.updateById(
        branchId,
        updatePayload,
        BRANCH_WITH_INSTITUTION,
      );
    } catch (error) {
      this.handleDuplicateBranchError(error);
      throw error;
    }
  }

  async assertActiveVerifiedBranch(branchId: string, institutionId: string) {
    const branch = await this.branchesRepo.findActiveVerifiedById(branchId);
    if (!branch || branch.institutionId !== institutionId) {
      throw new BadRequestException('Invalid branch for selected institution');
    }
    if (!branch.institution.isActive) {
      throw new BadRequestException('Institution is not active');
    }
    return branch;
  }

  private async resolveInstitutionFromIfsc(bankName: string, bankCode: string) {
    const existing = await this.institutionsRepo.findByNameCaseInsensitive(
      bankName,
      'Bank',
    );
    if (existing) {
      return existing;
    }

    const bankType = await this.institutionTypesRepo.findByName('Bank');
    if (!bankType) {
      throw new NotFoundException('Bank institution type not configured');
    }

    return this.institutionsRepo.create({
      name: bankName.trim(),
      code: bankCode.trim().toUpperCase(),
      isActive: true,
      institutionType: { connect: { id: bankType.id } },
    });
  }

  private handleDuplicateBranchError(error: unknown): void {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new ConflictException(
        'A branch with this name already exists in the selected city for this institution',
      );
    }
  }
}
