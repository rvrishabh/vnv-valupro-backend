import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma, ValuationReport } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FindQuery, PaginatedResult } from 'types/common.types';
import {
  FloorInput,
  ValuationInput,
  ValuationMethod,
  ValuationResult,
  ValuationFilter,
} from 'types/valuation.types';
import { CreateValuationDto, ReviewValuationDto, UpsertValuationDto } from './dto';
import { ValuationCalculator } from './engine/valuation.calculator';
import { ValuationRepository } from './repositories/valuation.repository';
import { CaseWorkflowService } from '../cases/services/case-workflow.service';
import { ValuationRatesService } from './services/valuation-rates.service';

const ENGINE_VERSION = '1.0.0';
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
const CHECKER_ROLES = new Set(['SUPER_ADMIN', 'ADMIN', 'CHECKER']);
const DEFAULT_EXPECTED_LIFE = 80;

/** A valuation is always read in the context of its case, so carry it along. */
const VALUATION_LIST_INCLUDE = {
  engineer: { select: { id: true, name: true, email: true } },
  case: {
    select: {
      id: true,
      caseNumber: true,
      status: true,
      customerName: true,
      institution: { select: { id: true, name: true, code: true } },
    },
  },
} as const;

@Injectable()
export class ValuationService {
  constructor(
    private readonly valuationRepo: ValuationRepository,
    private readonly ratesService: ValuationRatesService,
    private readonly caseWorkflow: CaseWorkflowService,
    private readonly prisma: PrismaService,
  ) {}

  async create(dto: CreateValuationDto, userId: string): Promise<ValuationReport> {
    const existing = await this.valuationRepo.findByCaseId(dto.caseId);
    if (existing) {
      throw new BadRequestException('A valuation already exists for this case');
    }

    const caseRecord = await this.prisma.case.findUnique({ where: { id: dto.caseId } });
    if (!caseRecord) throw new NotFoundException('Case not found');

    const { caseId, ...rest } = dto;
    return this.valuationRepo.create({
      case: { connect: { id: caseId } },
      engineer: { connect: { id: userId } },
      ...this.toPersistablePayload(rest),
    } as Prisma.ValuationReportCreateInput);
  }

  async update(
    id: string,
    dto: UpsertValuationDto,
    userId: string,
    role: string,
  ): Promise<ValuationReport> {
    const report = await this.getOwned(id, userId, role);

    if (report.status === 'APPROVED') {
      throw new BadRequestException('An approved valuation can no longer be edited');
    }

    return this.valuationRepo.updateById(id, this.toPersistablePayload(dto));
  }

  /**
   * Runs the engine and persists both the summary columns and the full result.
   * Called on submit and on an explicit recalculate, so a rate-table correction
   * can be replayed without re-entering the case.
   */
  async recalculate(id: string, userId: string, role: string): Promise<ValuationReport> {
    const report = await this.getOwned(id, userId, role);
    const input = this.toEngineInput(report);
    const rates = await this.ratesService.getConstructionRates(input.tehsil);
    const result = ValuationCalculator.calculate(input, rates);

    return this.valuationRepo.updateById(id, this.toComputedPayload(result));
  }

  async submit(id: string, userId: string, role: string): Promise<ValuationReport> {
    const report = await this.getOwned(id, userId, role);
    this.assertComplete(report);

    await this.recalculate(id, userId, role);

    const updated = await this.valuationRepo.updateById(id, {
      status: 'SUBMITTED',
      checkerStatus: 'pending',
      submittedAt: new Date(),
    });

    await this.caseWorkflow.sendToChecking(report.caseId, userId);

    return updated;
  }

  async review(
    id: string,
    dto: ReviewValuationDto,
    actorId: string,
    role: string,
  ): Promise<ValuationReport> {
    if (!CHECKER_ROLES.has(role)) {
      throw new ForbiddenException('Only checkers can review a valuation');
    }

    const report = await this.valuationRepo.findById(id);
    if (!report) throw new NotFoundException('Valuation not found');
    if (report.status !== 'SUBMITTED') {
      throw new BadRequestException('Only a submitted valuation can be reviewed');
    }

    const approved = dto.decision === 'approved';
    const updated = await this.valuationRepo.updateById(id, {
      status: approved ? 'APPROVED' : 'REJECTED',
      checkerStatus: dto.decision,
      checkerNotes: dto.notes,
    });

    await this.caseWorkflow.recordReview(report.caseId, actorId, approved, dto.notes);

    return updated;
  }

  async findAll(
    userId: string,
    role: string,
    query: FindQuery<ValuationFilter>,
  ): Promise<PaginatedResult<ValuationReport>> {
    if (ADMIN_ROLES.has(role) || role === 'CHECKER') {
      return this.valuationRepo.findAll(query, VALUATION_LIST_INCLUDE);
    }

    return this.valuationRepo.findAll(
      { ...query, filter: { ...query.filter, engineerId: userId } },
      VALUATION_LIST_INCLUDE,
    );
  }

  async findOne(id: string, userId: string, role: string) {
    const report = await this.valuationRepo.findDetailed(id);
    if (!report) throw new NotFoundException('Valuation not found');
    this.assertVisible(report.engineerId, userId, role);
    return report;
  }

  /** Recomputes on the fly so a draft can be previewed before it is submitted. */
  async preview(id: string, userId: string, role: string): Promise<ValuationResult> {
    const report = await this.getOwned(id, userId, role);
    const input = this.toEngineInput(report);
    const rates = await this.ratesService.getConstructionRates(input.tehsil);
    return ValuationCalculator.calculate(input, rates);
  }

  private async getOwned(
    id: string,
    userId: string,
    role: string,
  ): Promise<ValuationReport> {
    const report = await this.valuationRepo.findById(id);
    if (!report) throw new NotFoundException('Valuation not found');
    this.assertVisible(report.engineerId, userId, role);
    return report;
  }

  private assertVisible(engineerId: string, userId: string, role: string): void {
    if (ADMIN_ROLES.has(role) || role === 'CHECKER') return;
    if (engineerId !== userId) {
      throw new ForbiddenException('You do not have access to this valuation');
    }
  }

  private assertComplete(report: ValuationReport): void {
    const missing: string[] = [];
    if (!report.plotAreaSqM) missing.push('plotAreaSqM');
    if (!report.adoptedRate) missing.push('land.adoptedRate');
    if (!report.tehsil) missing.push('tehsil');
    if (report.method !== 'PLOT' && !report.yearOfConstruction) {
      missing.push('building.yearOfConstruction');
    }
    if (missing.length) {
      throw new BadRequestException(
        `Valuation is incomplete — missing: ${missing.join(', ')}`,
      );
    }
  }

  /** Flattens the nested DTO onto the report's columns and JSON sections. */
  private toPersistablePayload(
    dto: UpsertValuationDto,
  ): Prisma.ValuationReportUpdateInput {
    const { land, building, ...rest } = dto;

    // A Freehold property has no lease terms; drop any previously entered block
    // so it cannot resurface in the report after the tenure is corrected.
    const leaseDetails =
      rest.tenure === 'Freehold' ? Prisma.DbNull : (rest.leaseDetails as Prisma.InputJsonValue);

    return {
      ...(rest as Prisma.ValuationReportUpdateInput),
      ...(rest.tenure !== undefined ? { leaseDetails } : {}),
      ...(land
        ? {
            prevailingMarketRate: land.prevailingMarketRate,
            circleRate: land.circleRate,
            adoptedRate: land.adoptedRate,
            plotPosition: land.plotPosition,
            superAreaPercent: land.superAreaPercent ?? 0,
          }
        : {}),
      ...(building
        ? {
            yearOfConstruction: building.yearOfConstruction,
            expectedLifeYears: building.expectedLifeYears ?? DEFAULT_EXPECTED_LIFE,
            floors: building.floors as unknown as Prisma.InputJsonValue,
          }
        : {}),
    };
  }

  private toEngineInput(report: ValuationReport): ValuationInput {
    return {
      method: report.method as ValuationMethod,
      reportYear: report.reportYear ?? new Date().getFullYear(),
      tehsil: report.tehsil ?? '',
      plotAreaSqM: Number(report.plotAreaSqM ?? 0),
      land: {
        prevailingMarketRate: Number(report.prevailingMarketRate ?? 0),
        circleRate: Number(report.circleRate ?? 0),
        adoptedRate: Number(report.adoptedRate ?? 0),
        plotPosition: (report.plotPosition ?? 'Intermittent Plot') as ValuationInput['land']['plotPosition'],
        superAreaPercent: Number(report.superAreaPercent ?? 0),
      },
      building: {
        yearOfConstruction: report.yearOfConstruction ?? 0,
        expectedLifeYears: report.expectedLifeYears ?? DEFAULT_EXPECTED_LIFE,
        floors: ((report.floors as unknown as FloorInput[]) ?? []).map((f) => ({
          ...f,
          constructionCategory: f.constructionCategory ?? 1,
        })),
      },
      extraItems: (report.extraItems as Record<string, number | string>) ?? undefined,
      services: (report.services as Record<string, number | string>) ?? undefined,
    };
  }

  private toComputedPayload(
    result: ValuationResult,
  ): Prisma.ValuationReportUpdateInput {
    return {
      landValue: result.landValue,
      buildingValueDepreciated: result.partBtoE,
      extraItemsValue: result.extraItemsValue,
      totalMarketValue: result.totalValue,
      roundedMarketValue: result.roundedValue,
      realizableValue: result.realizableValue,
      distressValue: result.distressValue,
      insurableValue: result.insurableValue,
      compositeRate: result.compositeRate,
      landComponentRate: result.landComponentRate,
      depreciatedBuildingRate: result.depreciatedBuildingRate,
      fairMarketValue: result.fairMarketValue,
      guidelineLandValue: result.guideline.landValue,
      guidelineConstructionValue: result.guideline.constructionValue,
      guidelineTotalValue: result.guideline.totalValue,
      groundCoveragePercent: result.coverage.achievedCoveragePercent,
      farAchieved: result.coverage.achievedFAR,
      // Kept verbatim so the PDF renders exactly what was computed.
      computed: result as unknown as Prisma.InputJsonValue,
      computedAt: new Date(),
      engineVersion: ENGINE_VERSION,
      marketValue: result.roundedValue,
    };
  }
}
