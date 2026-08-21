import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Case, CaseStatus, Prisma } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';

/**
 * Owns every status change a case can undergo, so the lifecycle lives in one
 * place and each transition is recorded in CaseAuditLog. Nothing else should
 * write `Case.status` directly — the audit trail is only trustworthy if every
 * move goes through here.
 */
@Injectable()
export class CaseWorkflowService {
  /** Which statuses a case may move to from its current one. */
  private static readonly TRANSITIONS: Record<CaseStatus, CaseStatus[]> = {
    PENDING: ['ASSIGNED', 'REJECTED'],
    ASSIGNED: ['IN_PROGRESS', 'PENDING', 'REJECTED'],
    IN_PROGRESS: ['CHECKING', 'QUERY_RAISED', 'REJECTED'],
    CHECKING: ['APPROVED', 'REJECTED', 'QUERY_RAISED'],
    QUERY_RAISED: ['IN_PROGRESS', 'CHECKING', 'REJECTED'],
    APPROVED: [],
    REJECTED: ['PENDING'],
  };

  constructor(private readonly prisma: PrismaService) {}

  async assign(caseId: string, engineerId: string, actorId: string, notes?: string) {
    const engineer = await this.prisma.user.findUnique({ where: { id: engineerId } });
    if (!engineer) throw new NotFoundException('Engineer not found');

    return this.transition(caseId, 'ASSIGNED', actorId, {
      notes: notes ?? `Assigned to ${engineer.name}`,
      action: 'CASE_ASSIGNED',
      data: { assignedTo: { connect: { id: engineerId } }, assignedAt: new Date() },
    });
  }

  /** Site engineer opens the visit on the mobile app. */
  startSurvey(caseId: string, actorId: string) {
    return this.transition(caseId, 'IN_PROGRESS', actorId, {
      action: 'SURVEY_STARTED',
      data: { surveyStartedAt: new Date() },
    });
  }

  /** Site engineer finishes the visit; the report is then prepared. */
  completeSurvey(caseId: string, actorId: string, notes?: string) {
    return this.transition(caseId, 'IN_PROGRESS', actorId, {
      notes,
      action: 'SURVEY_COMPLETED',
      data: { surveyCompletedAt: new Date() },
      allowSameStatus: true,
    });
  }

  raiseQuery(caseId: string, actorId: string, notes: string) {
    return this.transition(caseId, 'QUERY_RAISED', actorId, {
      notes,
      action: 'QUERY_RAISED',
    });
  }

  /** Called by the valuation module when a report is submitted for checking. */
  sendToChecking(caseId: string, actorId: string) {
    return this.transition(caseId, 'CHECKING', actorId, {
      action: 'REPORT_SUBMITTED',
      data: { submittedAt: new Date() },
    });
  }

  /** Called by the valuation module once a checker has decided. */
  recordReview(caseId: string, actorId: string, approved: boolean, notes?: string) {
    return this.transition(caseId, approved ? 'APPROVED' : 'REJECTED', actorId, {
      notes,
      action: approved ? 'REPORT_APPROVED' : 'REPORT_REJECTED',
      data: approved
        ? { approvedAt: new Date(), checkedBy: { connect: { id: actorId } } }
        : { rejectedAt: new Date(), checkedBy: { connect: { id: actorId } } },
    });
  }

  /** Ordered lifecycle for the case detail view. */
  async timeline(caseId: string) {
    const record = await this.prisma.case.findUnique({
      where: { id: caseId },
      include: {
        createdBy: { select: { id: true, name: true, email: true } },
        assignedTo: { select: { id: true, name: true, email: true } },
        checkedBy: { select: { id: true, name: true, email: true } },
      },
    });
    if (!record) throw new NotFoundException('Case not found');

    const events = await this.prisma.caseAuditLog.findMany({
      where: { caseId },
      orderBy: { createdAt: 'asc' },
      include: { actor: { select: { id: true, name: true, email: true } } },
    });

    return {
      participants: {
        createdBy: record.createdBy,
        assignedTo: record.assignedTo,
        checkedBy: record.checkedBy,
      },
      milestones: {
        createdAt: record.createdAt,
        assignedAt: record.assignedAt,
        surveyStartedAt: record.surveyStartedAt,
        surveyCompletedAt: record.surveyCompletedAt,
        submittedAt: record.submittedAt,
        approvedAt: record.approvedAt,
        rejectedAt: record.rejectedAt,
      },
      events,
    };
  }

  /** Records case creation so the trail starts at the beginning. */
  async recordCreation(caseId: string, actorId: string): Promise<void> {
    await this.prisma.caseAuditLog.create({
      data: { caseId, actorId, action: 'CASE_CREATED', newStatus: 'PENDING' },
    });
  }

  /**
   * Applies a status change and writes the audit entry in one transaction, so a
   * case can never end up in a new status with no record of who moved it.
   */
  private async transition(
    caseId: string,
    next: CaseStatus,
    actorId: string,
    options: {
      action: string;
      notes?: string;
      data?: Prisma.CaseUpdateInput;
      allowSameStatus?: boolean;
    },
  ): Promise<Case> {
    const current = await this.prisma.case.findUnique({ where: { id: caseId } });
    if (!current) throw new NotFoundException('Case not found');

    const isSame = current.status === next;
    if (!isSame || !options.allowSameStatus) {
      const allowed = CaseWorkflowService.TRANSITIONS[current.status] ?? [];
      if (!allowed.includes(next)) {
        throw new BadRequestException(
          `A case cannot move from ${current.status} to ${next}`,
        );
      }
    }

    const [updated] = await this.prisma.$transaction([
      this.prisma.case.update({
        where: { id: caseId },
        data: { ...options.data, status: next },
      }),
      this.prisma.caseAuditLog.create({
        data: {
          caseId,
          actorId,
          action: options.action,
          oldStatus: current.status,
          newStatus: next,
          notes: options.notes,
        },
      }),
    ]);

    return updated;
  }
}
