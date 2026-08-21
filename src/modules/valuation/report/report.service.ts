import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValuationMethod, ValuationResult } from 'types/valuation.types';
import { ValuationRepository } from '../repositories/valuation.repository';
import { rupeesInWords } from './number-to-words.util';
import { PdfService } from './pdf.service';

const DEFAULT_TEMPLATE = 'canara';

const METHOD_LABELS: Record<ValuationMethod, string> = {
  LAND_AND_BUILDING: 'Land & Building method',
  CRM: 'Composite rate method',
  PLOT: 'Land & Building method',
};

const DIRECTIONS = ['north', 'south', 'east', 'west'] as const;

@Injectable()
export class ReportService {
  constructor(
    private readonly valuationRepo: ValuationRepository,
    private readonly pdfService: PdfService,
    private readonly prisma: PrismaService,
  ) {}

  async generatePdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.valuationRepo.findDetailed(id);
    if (!report) throw new NotFoundException('Valuation not found');

    const templateKey = await this.resolveTemplate(report.case?.institutionId);
    const buffer = await this.pdfService.render(templateKey, this.toViewModel(report));

    const owner = String(
      (report.titleDeed as Record<string, unknown>)?.ownerName ?? 'valuation',
    );

    return {
      buffer,
      filename: `${this.slugify(owner)}-valuation-report.pdf`,
    };
  }

  /** Falls back to the Canara layout until an institution has its own template. */
  private async resolveTemplate(institutionId?: string): Promise<string> {
    if (!institutionId) return DEFAULT_TEMPLATE;

    const template = await this.prisma.bankReportTemplate.findUnique({
      where: { institutionId },
    });

    return template?.isActive ? template.templateKey : DEFAULT_TEMPLATE;
  }

  /**
   * Flattens the report into what the template expects. The computed block is
   * read back verbatim from the engine's persisted output rather than
   * recalculated, so a rendered PDF always matches what was approved.
   */
  private toViewModel(report: Record<string, any>): Record<string, unknown> {
    const computed = (report.computed ?? {}) as Partial<ValuationResult>;
    const method = (report.method ?? 'LAND_AND_BUILDING') as ValuationMethod;

    return {
      institution: report.case?.institution ?? { name: 'Bank' },
      branch: report.case?.branch ?? {},
      engineer: report.engineer ?? {},
      reportNo: report.case?.caseNumber,
      methodLabel: METHOD_LABELS[method],
      siteVisitDate: report.visitStartedAt ?? report.createdAt,
      valuationDate: report.computedAt ?? report.updatedAt,
      gpsCoordinates: this.formatGps(report),
      documentsReceived: (report.siteVisit as Record<string, unknown>)?.documentsReceived,
      place: report.tehsil,

      plotAreaSqM: Number(report.plotAreaSqM ?? 0),
      propertyType: report.propertyType,
      advanceReceived: Number(report.advanceReceived ?? 0),
      assetsSoldAsPerDeed: report.assetsSoldAsPerDeed,
      tenure: report.tenure,
      // Only a leasehold property carries lease terms; the template omits the
      // block entirely otherwise, as the sheet does.
      leaseDetails: report.tenure === 'Leasehold' ? (report.leaseDetails ?? {}) : null,
      siteAddress: report.siteAddress ?? {},
      consolidatedSiteAddress: this.consolidateAddress(report.siteAddress),
      discrepancy: report.discrepancy ?? {},
      titleDeed: report.titleDeed ?? {},
      boundaries: report.boundaries ?? {},
      buildingSpecs: report.buildingSpecs ?? {},
      generalDetails: report.generalDetails ?? {},
      boundaryRows: this.toBoundaryRows(report),
      floorSpecRows: this.toFloorSpecRows(report),

      land: {
        prevailingMarketRate: Number(report.prevailingMarketRate ?? 0),
        circleRate: Number(report.circleRate ?? 0),
        adoptedRate: Number(report.adoptedRate ?? 0),
        plotPosition: report.plotPosition,
      },
      building: {
        yearOfConstruction: report.yearOfConstruction,
        expectedLifeYears: report.expectedLifeYears,
      },

      computed,
      marketValueInWords: rupeesInWords(computed.roundedValue ?? 0),
    };
  }

  private toBoundaryRows(report: Record<string, any>) {
    const boundaries = (report.boundaries ?? {}) as Record<string, any>;
    const dimensions = (report.dimensions ?? {}) as Record<string, any>;

    return DIRECTIONS.map((direction) => ({
      direction: direction.charAt(0).toUpperCase() + direction.slice(1),
      asPerDocs: boundaries[direction]?.asPerDocs,
      asPerSite: boundaries[direction]?.asPerSite,
      dimDocs: dimensions[direction]?.asPerDocs,
      dimSite: dimensions[direction]?.asPerSite,
    }));
  }

  /** M-Doc!C52 — the printed address, assembled from the site address parts. */
  private consolidateAddress(siteAddress: unknown): string {
    const parts = (siteAddress ?? {}) as Record<string, string>;
    return [
      parts.propertyNumber,
      parts.subStreet,
      parts.colony,
      parts.landmark,
      parts.mainConnectingRoad,
      parts.cityVillageTown,
    ]
      .map((p) => (p ?? '').trim())
      .filter(Boolean)
      .join(', ');
  }

  /**
   * Pivots the per-floor specs into rows, since the report prints one row per
   * specification with a column per floor (M-Rate 65-79).
   */
  private toFloorSpecRows(report: Record<string, any>) {
    const floors = ((report.floors as any[]) ?? []).filter((f) => f?.coveredAreaSqM > 0);
    if (!floors.length) return [];

    const labels: [string, string][] = [
      ['walls', 'Walls'],
      ['partitions', 'Partitions'],
      ['doors', 'Doors'],
      ['windows', 'Windows'],
      ['flooring', 'Flooring'],
      ['finishing', 'Finishing'],
      ['ceiling', 'Ceiling'],
      ['roofingTerracing', 'Roofing / terracing'],
      ['roofType', 'Roof Type'],
      ['wiring', 'Wiring'],
      ['electricalFittings', 'Class of electrical fittings'],
      ['sanitaryInstallations', 'Class of sanitary installations'],
      ['heightOfFloor', 'Height of floor'],
    ];

    return [
      { label: 'Floor', values: floors.map((f) => f.name), header: true },
      ...labels.map(([key, label]) => ({
        label,
        values: floors.map((f) => f.specs?.[key] ?? 'N.A.'),
        header: false,
      })),
    ];
  }

  private formatGps(report: Record<string, any>): string | undefined {
    if (report.visitLat == null || report.visitLng == null) return undefined;
    return `${report.visitLat}, ${report.visitLng}`;
  }

  private slugify(value: string): string {
    return (
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 60) || 'valuation'
    );
  }
}
