import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma, ValuationEstimate } from 'generated/prisma/client';
import { PrismaService } from 'src/prisma/prisma.service';
import { FindQuery, PaginatedResult } from 'types/common.types';
import {
  CalculatedEstimate,
  FloorBreakdown,
  ValuationEstimateFilter,
} from 'types/valuation-estimate.types';
import { CreateValuationEstimateDto } from './dto';
import { ValuationEstimateRepository } from './repositories/valuation-estimate.repository';
import { ValuationEstimateCalculator } from './services/valuation-estimate.calculator';

const DEFAULT_MUMTY_THRESHOLD = 162;
const ADMIN_ROLES = new Set(['SUPER_ADMIN', 'ADMIN']);
const OWNER_SCOPED_ROLES = new Set(['SITE_ENGINEER', 'BANK_MANAGER']);

export type ValuationEstimateResponse = Omit<
  ValuationEstimate,
  'floorBreakdown'
> & {
  floorBreakdown: FloorBreakdown[];
};

@Injectable()
export class ValuationEstimateService {
  constructor(
    private readonly valuationEstimateRepo: ValuationEstimateRepository,
    private readonly prisma: PrismaService,
  ) {}

  async calculate(
    dto: CreateValuationEstimateDto,
    userId: string,
  ): Promise<ValuationEstimateResponse> {
    const mumtyThreshold = await this.resolveMumtyThreshold();

    let calculated: CalculatedEstimate;
    try {
      calculated = ValuationEstimateCalculator.calculate(
        dto.plotAreaSqFt,
        dto.estimatedAmount,
        dto.rate,
        mumtyThreshold,
      );
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Invalid valuation estimate';
      throw new BadRequestException(message);
    }

    const saved = await this.valuationEstimateRepo.create({
      ownerName: dto.ownerName,
      address: dto.address,
      plotAreaSqFt: calculated.plotAreaSqFt,
      plotAreaSqM: calculated.plotAreaSqM,
      estimatedAmount: calculated.estimatedAmount,
      rate: calculated.rate,
      coveragePercent: calculated.coveragePercent,
      totalPermissibleAreaSqFt: calculated.totalPermissibleAreaSqFt,
      groundFloorAreaSqFt: calculated.groundFloorAreaSqFt,
      floorBreakdown: calculated.floors as unknown as Prisma.InputJsonValue,
      creator: { connect: { id: userId } },
    });

    return this.mapEstimate(saved);
  }

  async findAll(
    userId: string,
    userRole: string,
    query: FindQuery<ValuationEstimateFilter>,
  ): Promise<PaginatedResult<ValuationEstimateResponse>> {
    if (userRole === 'CHECKER') {
      throw new ForbiddenException(
        'Checkers do not have access to valuation estimates',
      );
    }

    if (ADMIN_ROLES.has(userRole)) {
      const result = await this.valuationEstimateRepo.findAll(query);
      return {
        ...result,
        data: result.data.map((estimate) => this.mapEstimate(estimate)),
      };
    }

    if (OWNER_SCOPED_ROLES.has(userRole)) {
      const result = await this.valuationEstimateRepo.findAll({
        ...query,
        filter: {
          ...query.filter,
          createdBy: userId,
        },
      });
      return {
        ...result,
        data: result.data.map((estimate) => this.mapEstimate(estimate)),
      };
    }

    throw new ForbiddenException('Insufficient role permissions');
  }

  private async resolveMumtyThreshold(): Promise<number> {
    const config = await this.prisma.valuationConfig.findUnique({
      where: { key: 'MUMTY_THRESHOLD_SQFT' },
    });

    if (!config) {
      return DEFAULT_MUMTY_THRESHOLD;
    }

    const parsed = Number.parseFloat(config.value);
    return Number.isFinite(parsed) ? parsed : DEFAULT_MUMTY_THRESHOLD;
  }

  private mapEstimate(estimate: ValuationEstimate): ValuationEstimateResponse {
    return {
      ...estimate,
      floorBreakdown: estimate.floorBreakdown as unknown as FloorBreakdown[],
    };
  }
}
