import { Injectable, NotFoundException } from '@nestjs/common';
import { Case, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FilterRecord, FindQuery, PaginatedResult } from 'types/common.types';
import { CreateCaseDto } from './dto';
import { CasesRepository } from './repositories/cases.repository';
import { CaseWorkflowService } from './services/case-workflow.service';

const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);

/**
 * The list view is where a case's valuation becomes visible, so the relation is
 * loaded here rather than requiring a second call per row. Only the few report
 * fields the list actually shows are selected.
 */
const CASE_LIST_INCLUDE = {
  institution: { select: { id: true, name: true, code: true } },
  branch: { select: { id: true, branchName: true } },
  createdBy: { select: { id: true, name: true, email: true } },
  assignedTo: { select: { id: true, name: true, email: true } },
  checkedBy: { select: { id: true, name: true, email: true } },
  report: {
    select: {
      id: true,
      status: true,
      roundedMarketValue: true,
      realizableValue: true,
      submittedAt: true,
    },
  },
} as const;

@Injectable()
export class CasesService {
  constructor(
    private readonly casesRepo: CasesRepository,
    private readonly workflow: CaseWorkflowService,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateCaseDto, userId: string): Promise<Case> {
    const institution = await this.prisma.institution.findUnique({
      where: { id: dto.institutionId },
    });
    if (!institution) throw new NotFoundException('Institution not found');

    const created = await this.casesRepo.create({
      caseNumber: await this.nextCaseNumber(institution.code),
      customerName: dto.customerName,
      customerMobile: dto.customerMobile,
      propertyType: dto.propertyType,
      propertyLocation: dto.propertyLocation,
      bankReference: dto.bankReference,
      institution: { connect: { id: dto.institutionId } },
      createdBy: { connect: { id: userId } },
      ...(dto.branchId ? { branch: { connect: { id: dto.branchId } } } : {}),
    } as Prisma.CaseCreateInput);

    await this.workflow.recordCreation(created.id, userId);

    // Assigning at creation is a real transition, so it goes through the
    // workflow rather than being written inline — otherwise the trail would
    // show the case as never having been assigned.
    if (dto.assignedToId) {
      return this.workflow.assign(created.id, dto.assignedToId, userId);
    }

    return created;
  }

  findAll(
    userId: string,
    role: string,
    query: FindQuery<FilterRecord>,
  ): Promise<PaginatedResult<Case>> {
    if (ADMIN_ROLES.has(role) || role === 'CHECKER') {
      return this.casesRepo.findAll(query, CASE_LIST_INCLUDE);
    }

    // Engineers only see what is assigned to them.
    return this.casesRepo.findAll(
      { ...query, filter: { ...query.filter, assignedToId: userId } },
      CASE_LIST_INCLUDE,
    );
  }

  /**
   * Hard-deletes a case and everything hanging off it — valuation, documents,
   * fees, queries and the audit trail all cascade at the database level.
   * Irreversible, which is why it is restricted to admins at the controller.
   */
  async remove(id: string): Promise<{ id: string; caseNumber: string }> {
    const record = await this.prisma.case.findUnique({
      where: { id },
      select: { id: true, caseNumber: true },
    });
    if (!record) throw new NotFoundException('Case not found');

    await this.prisma.case.delete({ where: { id } });
    return record;
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
