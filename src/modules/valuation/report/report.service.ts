import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValuationMethod, ValuationResult } from 'types/valuation.types';
import { resolveUndividedShare } from '../engine/area-basis.util';
import { areaFromDimensions, type SideDimensions } from '../engine/area.util';
import { ValuationRepository } from '../repositories/valuation.repository';
import { rupeesInWords } from './number-to-words.util';
import { PdfService } from './pdf.service';
import { ValuationPhotoService } from '../services/valuation-photo.service';
import { computePhotoLayout } from './photo-layout.util';

const DEFAULT_TEMPLATE = 'canara';

// A4 content box (297mm tall, 210mm wide) minus the PDF's shared 14mm/16mm
// top/bottom and 12mm/12mm left/right margins — see pdf.service.ts.
const PHOTO_ANNEXURE_CONTENT_WIDTH_MM = 186;
// Of the 267mm of vertical content room, ~36mm always goes to the owner/
// address table above the photos (measured empirically — see the page-fit
// note in photo-annexure.hbs); this is what's left for the photo rows, the
// gap below them, and the aerial image.
const PHOTO_ANNEXURE_PHOTO_AERIAL_BUDGET_MM = 231;
const PHOTO_ANNEXURE_SECTION_GAP_MM = 3;
const PHOTO_ANNEXURE_MIN_AERIAL_HEIGHT_MM = 50;
// The aerial image is a map screenshot — inherently wide, not tall. Letting
// it claim *all* the height the photo rows didn't need would stretch its box
// well past its own aspect ratio, and object-fit: cover crops more aggressively
// the further the box drifts from that shape (labels near the map's edges are
// the first casualty). Capping it leaves any further leftover space as plain
// margin instead — a bit of blank space beats a map missing its labels.
const PHOTO_ANNEXURE_MAX_AERIAL_HEIGHT_MM = 95;

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
    private readonly photoService: ValuationPhotoService,
  ) {}

  async generatePdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.valuationRepo.findDetailed(id);
    if (!report) throw new NotFoundException('Valuation not found');

    const templateKey = await this.resolveTemplate(report.case?.institutionId);
    const buffer = await this.pdfService.render(
      templateKey,
      this.toViewModel(report),
    );

    const owner = String(
      (report.titleDeed as Record<string, unknown>)?.ownerName ?? 'valuation',
    );

    return {
      buffer,
      filename: `${this.slugify(owner)}-valuation-report.pdf`,
    };
  }

  /**
   * The one-page "Photograph & Location Annexure" — site-visit photos packed
   * into two justified rows (any count, any mix of portrait/landscape, never
   * cropped) with the Google Earth aerial plan filling whatever page space
   * the photos didn't need, matching the layout banks expect on this page
   * regardless of how many photos were taken.
   */
  async generatePhotoAnnexurePdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.valuationRepo.findDetailed(id);
    if (!report) throw new NotFoundException('Valuation not found');

    const photos = await this.photoService.getPhotosForReport(id);
    const owner = String((report.titleDeed as Record<string, unknown>)?.ownerName ?? '');
    // Landscape photo(s) move to the front so they land at the top-left, then
    // a justified-row layout gives every photo its own natural width at a
    // shared row height — nothing is ever cropped or letterboxed. See
    // photo-layout.util.ts for why row height has to be derived, not fixed.
    const ordered = [...photos.siteVisit].sort((a, b) => (b.aspect > 1 ? 1 : 0) - (a.aspect > 1 ? 1 : 0));
    const maxPhotoHeightMm =
      PHOTO_ANNEXURE_PHOTO_AERIAL_BUDGET_MM -
      PHOTO_ANNEXURE_SECTION_GAP_MM -
      PHOTO_ANNEXURE_MIN_AERIAL_HEIGHT_MM;
    const layout = computePhotoLayout(ordered, PHOTO_ANNEXURE_CONTENT_WIDTH_MM, maxPhotoHeightMm);
    const aerialHeightMm = Math.min(
      PHOTO_ANNEXURE_PHOTO_AERIAL_BUDGET_MM - PHOTO_ANNEXURE_SECTION_GAP_MM - layout.heightMm,
      PHOTO_ANNEXURE_MAX_AERIAL_HEIGHT_MM,
    );

    const buffer = await this.pdfService.render('photo-annexure', {
      ownerName: owner || 'N.A.',
      consolidatedSiteAddress: this.consolidateAddress(report.siteAddress),
      photoRows: layout.rows.map((row) => ({
        heightMm: row.heightMm.toFixed(2),
        photos: row.photos.map((p) => ({ url: p.url, widthMm: p.widthMm.toFixed(2) })),
      })),
      googleEarthPhoto: photos.googleEarth,
      aerialHeightMm: aerialHeightMm.toFixed(2),
    });

    return {
      buffer,
      filename: `${this.slugify(owner || 'valuation')}-photo-annexure.pdf`,
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
      documentsReceived: (report.siteVisit as Record<string, unknown>)
        ?.documentsReceived,
      place: report.tehsil,

      plotAreaSqM: Number(report.plotAreaSqM ?? 0),
      areaAsPerDeed: report.areaAsPerDeed ? Number(report.areaAsPerDeed) : null,
      areaAsPerSite: report.areaAsPerSite ? Number(report.areaAsPerSite) : null,
      areaFromDimensions: areaFromDimensions(
        this.toSideDimensions(report.dimensions, 'asPerSite') ??
          this.toSideDimensions(report.dimensions, 'asPerDocs'),
        (report.dimensionUnit as 'ft' | 'm') ?? 'ft',
      ),
      dimensionUnit: report.dimensionUnit ?? 'ft',
      propertyType: report.propertyType,
      advanceReceived: Number(report.advanceReceived ?? 0),
      assetsSoldAsPerDeed: report.assetsSoldAsPerDeed,
      tenure: report.tenure,
      // Only a leasehold property carries lease terms; the template omits the
      // block entirely otherwise, as the sheet does.
      leaseDetails:
        report.tenure === 'Leasehold' ? (report.leaseDetails ?? {}) : null,
      siteAddress: report.siteAddress ?? {},
      documentsReceivedText: report.documentsReceived,
      rooms: report.rooms ?? {},
      roomsSummary: this.summariseRooms(report),
      floorDetails: report.floorDetails ?? {},
      briefDescription: report.briefDescription,
      // Labelled "Remarks" on the form and in the report; the column keeps its
      // original name so existing records are untouched.
      remarks: report.engineerNotes,
      areaBasis: report.areaBasis,
      undividedShare: resolveUndividedShare(
        method,
        report.propertyType,
        Number(report.undividedShareOfLand ?? 0),
      ),
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
    const floors = ((report.floors as any[]) ?? []).filter(
      (f) => f?.coveredAreaSqM > 0,
    );
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

  /** Pulls one column (docs or site) out of the per-direction dimensions blob. */
  private toSideDimensions(
    dimensions: unknown,
    column: 'asPerDocs' | 'asPerSite',
  ): SideDimensions | null {
    const source = (dimensions ?? {}) as Record<
      string,
      Record<string, unknown>
    >;
    const sides = DIRECTIONS.map((d) => Number(source[d]?.[column]) || 0);
    if (sides.some((v) => v <= 0)) return null;

    const [north, south, east, west] = sides;
    return { north, south, east, west };
  }

  /**
   * M-Doc!C120 — "House has total of 2 Living Rooms, 9 Bed rooms, ...".
   * Built from the counts so the sentence always agrees with the numbers.
   */
  private summariseRooms(report: Record<string, any>): string | null {
    const rooms = (report.rooms ?? {}) as Record<string, unknown>;
    const parts = [
      ['Living Rooms', rooms.livingRooms],
      ['Bed rooms', rooms.bedRooms],
      ['Water Closets', rooms.waterClosets],
      ['Kitchen', rooms.kitchen],
    ]
      .filter(([, count]) => Number(count) > 0)
      .map(([label, count]) => `${count} ${label}`);

    if (!parts.length) return null;

    const subject = report.propertyType || 'Property';
    const last = parts.pop();
    return parts.length
      ? `${subject} has total of ${parts.join(', ')} & ${last}`
      : `${subject} has total of ${last}`;
  }

  private formatGps(report: Record<string, any>): string | undefined {
    if (report.gpsCoordinates) return report.gpsCoordinates as string;
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
