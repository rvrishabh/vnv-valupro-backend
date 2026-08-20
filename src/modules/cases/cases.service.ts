import { Injectable, NotFoundException } from '@nestjs/common';
import { Case, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterRecord, FindQuery, PaginatedResult } from 'types/common.types';
import { CreateCaseDto } from './dto';
import { CasesRepository } from './repositories/cases.repository';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

@Injectable()
export class CasesService {
  constructor(
    private readonly casesRepo: CasesRepository,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateCaseDto, userId: string): Promise<Case> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: dto.institutionId },
    });
    if (!institution) throw new NotFoundException('Institution not found');

    return this.casesRepo.create({
      caseNumber: await this.nextCaseNumber(institution.code),
      customerName: dto.customerName,
      customerMobile: dto.customerMobile,
      propertyType: dto.propertyType,
      propertyLocation: dto.propertyLocation,
      bankReference: dto.bankReference,
      institution: { connect: { id: dto.institutionId } },
      createdBy: { connect: { id: userId } },
      ...(dto.branchId ? { branch: { connect: { id: dto.branchId } } } : {}),
      ...(dto.assignedToId
        ? {
            assignedTo: { connect: { id: dto.assignedToId } },
            status: 'ASSIGNED' as const,
            assignedAt: new Date(),
          }
        : {}),
    } as Prisma.CaseCreateInput);
  }

  findAll(
    userId: string,
    role: string,
    query: FindQuery<FilterRecord>,
  ): Promise<PaginatedResult<Case>> {
    if (ADMIN_ROLES.has(role) || role === 'CHECKER') {
      return this.casesRepo.findAll(query);
    }

    // Engineers only see what is assigned to them.
    return this.casesRepo.findAll({
      ...query,
      filter: { ...query.filter, assignedToId: userId },
    });
  }

  async findOne(id: string) {
    const record = await this.casesRepo.findWithRelations(id);
    if (!record) throw new NotFoundException('Case not found');
    return record;
  }

  /**
   * Sequential per bank and year, e.g. CANARA/2026/0007 — mirrors how cases are
   * referenced in the existing manual workflow.
   */
  private async nextCaseNumber(institutionCode: string): Promise<string> {
    const year = new Date().getFullYear();
    const prefix = `${institutionCode}/${year}/`;

    const last = await this.prisma.case.findFirst({
      where: { caseNumber: { startsWith: prefix } },
      orderBy: { caseNumber: 'desc' },
      select: { caseNumber: true },
    });

    const lastSeq = last ? Number(last.caseNumber.slice(prefix.length)) : 0;
    const next = (Number.isFinite(lastSeq) ? lastSeq : 0) + 1;

    return `${prefix}${String(next).padStart(4, '0')}`;
  }
}
