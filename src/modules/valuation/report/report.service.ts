import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { ValuationMethod, ValuationResult } from 'types/valuation.types';
import { resolveUndividedShare } from '../engine/area-basis.util';
import { areaFromDimensions, type SideDimensions } from '../engine/area.util';
import { ValuationRepository } from '../repositories/valuation.repository';
import { ValuationPhotoService } from '../services/valuation-photo.service';
import { rupeesInWords } from './number-to-words.util';
import { PdfService } from './pdf.service';
import { computePhotoLayout } from './photo-layout.util';
import { letterheadDataUri } from './report-assets.util';

const DEFAULT_TEMPLATE = 'canara';

// A4 content box (297mm tall, 210mm wide) minus the photo page's own margins —
// see PHOTO_PAGE_MARGIN below.
const PHOTO_ANNEXURE_CONTENT_WIDTH_MM = 186;
// Of the vertical content room, ~36mm always goes to the owner/address strip
// and heading above the photos (measured empirically); this is what's left for
// the photo rows, the gap below them, and the aerial image.
const PHOTO_ANNEXURE_PHOTO_AERIAL_BUDGET_MM = 218;
const PHOTO_ANNEXURE_SECTION_GAP_MM = 3;
// Held back from the photo rows before they are laid out. A map cropped to a
// 50mm strip loses the streets that place the property, which is the whole
// point of the plan — the photos give up the height instead.
const PHOTO_ANNEXURE_MIN_AERIAL_HEIGHT_MM = 70;
// The aerial image is a map screenshot — inherently wide, not tall. Its box is
// sized to the image's own aspect ratio so nothing is cropped (a location plan
// missing its edge labels is worth less than the blank space saved), bounded
// by this cap and by whatever height the photo rows left behind.
const PHOTO_ANNEXURE_MAX_AERIAL_HEIGHT_MM = 100;

// The circle-rate extract gets a page of its own: the full content height less
// the heading and the four-row rate summary above it.
const CIRCLE_RATE_CONTENT_WIDTH_MM = 186;
const CIRCLE_RATE_MAX_HEIGHT_MM = 196;

/** The cover sheet bleeds its letterhead artwork to the paper's edge. */
const COVER_MARGIN = { top: '0', bottom: '0', left: '0', right: '0' };
/** Room for the slim running header and the signature/page-number footer. */
const BODY_MARGIN = {
  top: '22mm',
  bottom: '20mm',
  left: '12mm',
  right: '12mm',
};
const PHOTO_PAGE_MARGIN = {
  top: '22mm',
  bottom: '18mm',
  left: '12mm',
  right: '12mm',
};

const METHOD_LABELS: Record<ValuationMethod, string> = {
  LAND_AND_BUILDING: 'Land & Building method',
  CRM: 'Composite rate method',
  PLOT: 'Land & Building method',
};

const DIRECTIONS = ['north', 'south', 'east', 'west'] as const;

/**
 * Who the report is issued and signed by.
 *
 * This is firm identity, not the logged-in user: every V.N.V. report is signed
 * by the firm's registered valuer under his own IBBI registration, whoever
 * captured the site data in the app. Taking the name from `report.engineer`
 * put whatever the account happened to be called ("Admin") on the signature
 * line and against the registration number, which is wrong on a document a
 * bank relies on. The registration number lived in the template before; it is
 * here now so the name and the number it belongs to cannot drift apart.
 */
const SIGNING_VALUER = {
  name: 'Er. Shivam Verma',
  registrationNo: 'IBBI/RV/02/2023/15442',
  credentials: 'B.Tech (Civil), A.M.I.E · Chartered Engineer & Approved Valuer',
} as const;

/**
 * Labels for the Part F services block, in the order the report prints them.
 * A service the valuer left blank falls back to the phrase the reference
 * report uses, which is what "no separate figure" actually means here.
 */
const SERVICE_LABELS: [string, string][] = [
  ['waterSupply', 'Water supply arrangement'],
  ['drainage', 'Drainage arrangement'],
  ['electricSupply', 'Electric supply fittings'],
  ['compoundWall', 'Compound wall'],
  ['gate', 'Gate'],
];

interface ReportPhoto {
  url: string;
  aspect: number;
}

interface ReportPhotos {
  siteVisit: ReportPhoto[];
  googleEarth: ReportPhoto | null;
  circleRate: ReportPhoto | null;
}

@Injectable()
export class ReportService {
  constructor(
    private readonly valuationRepo: ValuationRepository,
    private readonly pdfService: PdfService,
    private readonly prisma: PrismaService,
    private readonly photoService: ValuationPhotoService,
  ) {}

  /**
   * The complete report: a full-letterhead covering letter, the photograph and
   * location annexure, then the report body ending on the circle-rate extract.
   *
   * These are printed as three documents and concatenated rather than as one,
   * because Chrome applies a single header/footer to a whole print job — and
   * the cover needs none at all (its artwork bleeds off the page edge) while
   * the body needs a running header and page numbers. Printing them apart is
   * also what puts the page numbering where the reference report has it:
   * starting at the body, with the cover and photo page unnumbered.
   */
  async generatePdf(id: string): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.valuationRepo.findDetailed(id);
    if (!report) throw new NotFoundException('Valuation not found');

    const templateKey = await this.resolveTemplate(report.case?.institutionId);
    const photos = await this.photoService.getPhotosForReport(id);
    const view = this.toViewModel(report, photos);
    const owner = String(view.ownerName ?? 'valuation');

    const buffer = await this.pdfService.renderAndMerge([
      {
        templateKey: 'cover',
        data: { ...view, letterhead: letterheadDataUri() },
        options: { margin: COVER_MARGIN, displayHeaderFooter: false },
      },
      {
        templateKey: 'photo-annexure',
        data: this.toPhotoAnnexureViewModel(view, photos),
        options: {
          margin: PHOTO_PAGE_MARGIN,
          displayHeaderFooter: true,
          headerTemplate: this.runningHeader(view),
          footerTemplate: this.runningFooter(view, { numbered: false }),
        },
      },
      {
        templateKey,
        data: view,
        options: {
          margin: BODY_MARGIN,
          displayHeaderFooter: true,
          headerTemplate: this.runningHeader(view),
          footerTemplate: this.runningFooter(view, { numbered: true }),
        },
      },
    ]);

    return {
      buffer,
      filename: `${this.slugify(owner)}-valuation-report.pdf`,
    };
  }

  /**
   * The photograph annexure on its own — the editor's preview button, so a
   * valuer can check the photo layout without generating the whole report.
   * Identical to page 2 of the full report.
   */
  async generatePhotoAnnexurePdf(
    id: string,
  ): Promise<{ buffer: Buffer; filename: string }> {
    const report = await this.valuationRepo.findDetailed(id);
    if (!report) throw new NotFoundException('Valuation not found');

    const photos = await this.photoService.getPhotosForReport(id);
    const view = this.toViewModel(report, photos);
    const owner = String(view.ownerName ?? '');

    const buffer = await this.pdfService.render(
      'photo-annexure',
      this.toPhotoAnnexureViewModel(view, photos),
      {
        margin: PHOTO_PAGE_MARGIN,
        displayHeaderFooter: true,
        headerTemplate: this.runningHeader(view),
        footerTemplate: this.runningFooter(view, { numbered: false }),
      },
    );

    return {
      buffer,
      filename: `${this.slugify(owner || 'valuation')}-photo-annexure.pdf`,
    };
  }

  /**
   * Packs the site-visit photos into justified rows and gives the aerial plan
   * whatever page height they didn't need. Landscape photo(s) move to the
   * front so they land at the top-left, then a justified-row layout gives
   * every photo its own natural width at a shared row height — nothing is ever
   * cropped or letterboxed. See photo-layout.util.ts for why the row height
   * has to be derived rather than fixed.
   */
  private toPhotoAnnexureViewModel(
    view: Record<string, unknown>,
    photos: ReportPhotos,
  ): Record<string, unknown> {
    const ordered = [...photos.siteVisit].sort(
      (a, b) => (b.aspect > 1 ? 1 : 0) - (a.aspect > 1 ? 1 : 0),
    );
    const maxPhotoHeightMm =
      PHOTO_ANNEXURE_PHOTO_AERIAL_BUDGET_MM -
      PHOTO_ANNEXURE_SECTION_GAP_MM -
      PHOTO_ANNEXURE_MIN_AERIAL_HEIGHT_MM;
    const layout = computePhotoLayout(
      ordered,
      PHOTO_ANNEXURE_CONTENT_WIDTH_MM,
      maxPhotoHeightMm,
    );
    const aerialHeightMm = Math.min(
      PHOTO_ANNEXURE_PHOTO_AERIAL_BUDGET_MM -
        PHOTO_ANNEXURE_SECTION_GAP_MM -
        layout.heightMm,
      PHOTO_ANNEXURE_MAX_AERIAL_HEIGHT_MM,
      // Its own natural height at full content width, so the map is shown
      // whole rather than cropped to fill a taller box.
      photos.googleEarth
        ? PHOTO_ANNEXURE_CONTENT_WIDTH_MM / photos.googleEarth.aspect
        : Infinity,
    );

    return {
      ownerName: view.ownerName,
      consolidatedSiteAddress: view.consolidatedSiteAddress,
      photoRows: layout.rows.map((row) => ({
        heightMm: row.heightMm.toFixed(2),
        photos: row.photos.map((p) => ({
          url: p.url,
          widthMm: p.widthMm.toFixed(2),
        })),
      })),
      googleEarthPhoto: photos.googleEarth?.url ?? null,
      aerialHeightMm: aerialHeightMm.toFixed(2),
    };
  }

  /**
   * The slim navy/gold band that stands in for the full letterhead on every
   * page after the cover. Chrome renders header and footer templates in an
   * isolated context with no access to the page's own stylesheet, and with a
   * default font-size of zero — hence the fully inline, explicitly sized
   * markup, and the horizontal padding that lines the band up with the
   * content box's own margins.
   */
  private runningHeader(view: Record<string, unknown>): string {
    const institution = this.escapeHtml(
      String((view.institution as { name?: string })?.name ?? ''),
    );
    return `
      <div style="width:100%;padding:6mm 12mm 0;font-family:'Segoe UI',Arial,sans-serif;
                  font-size:7.5pt;color:#0a1f44;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;
                    padding-bottom:1.5mm;border-bottom:1pt solid #c9a84c;">
          <span style="font-weight:700;letter-spacing:1px;">V.N.V. ENGINEERS</span>
          <span style="color:#63718b;">Valuation Report${
            institution ? ` &middot; ${institution}` : ''
          }</span>
        </div>
      </div>`;
  }

  private runningFooter(
    view: Record<string, unknown>,
    { numbered }: { numbered: boolean },
  ): string {
    const owner = this.escapeHtml(String(view.ownerName ?? ''));
    const valuer = this.escapeHtml(SIGNING_VALUER.name);
    const pageNumber = numbered
      ? '<span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>'
      : '<span></span>';

    return `
      <div style="width:100%;padding:0 12mm 5mm;font-family:'Segoe UI',Arial,sans-serif;
                  font-size:7pt;color:#63718b;">
        <div style="display:flex;justify-content:space-between;align-items:baseline;
                    padding-top:1.5mm;border-top:.5pt solid #b9c6dd;">
          <span>${owner ? `${owner} &middot; ` : ''}Valuation Report</span>
          <span style="color:#0a1f44;font-weight:600;">${valuer}</span>
          ${pageNumber}
        </div>
      </div>`;
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
   * Flattens the report into what the templates expect. The computed block is
   * read back verbatim from the engine's persisted output rather than
   * recalculated, so a rendered PDF always matches what was approved.
   */
  private toViewModel(
    report: Record<string, any>,
    photos: ReportPhotos,
  ): Record<string, unknown> {
    const computed = (report.computed ?? {}) as Partial<ValuationResult>;
    const method = (report.method ?? 'LAND_AND_BUILDING') as ValuationMethod;
    const titleDeed = (report.titleDeed ?? {}) as Record<string, unknown>;
    const floors = (report.floors as Record<string, any>[]) ?? [];
    // The ground floor sets the building's own age wherever the report prints
    // a single figure — later floors are additions to it, so the oldest floor
    // is the one that describes the structure.
    const oldestFloor = (computed.floors ?? []).reduce<
      NonNullable<ValuationResult['floors']>[number] | undefined
    >(
      (oldest, floor) => (!oldest || floor.age > oldest.age ? floor : oldest),
      undefined,
    );

    return {
      institution: report.case?.institution ?? { name: 'Bank' },
      branch: report.case?.branch ?? {},
      // Kept for anything that needs the person who actually did the site
      // visit; the signature blocks use `valuer` instead.
      engineer: report.engineer ?? {},
      valuer: SIGNING_VALUER,
      reportNo: report.case?.caseNumber,
      methodLabel: METHOD_LABELS[method],
      siteVisitDate: report.visitStartedAt ?? report.createdAt,
      valuationDate: report.computedAt ?? report.updatedAt,
      gpsCoordinates: this.formatGps(report),
      place: report.tehsil,
      // Hoisted out of titleDeed so the cover, the footer and the filename can
      // all reach for the same thing.
      ownerName: titleDeed.ownerName ?? null,

      plotAreaSqM: Number(report.plotAreaSqM ?? 0),
      areaAsPerDeed: report.areaAsPerDeed ? Number(report.areaAsPerDeed) : null,
      areaAsPerSite: report.areaAsPerSite ? Number(report.areaAsPerSite) : null,
      areaFromDimensions: areaFromDimensions(
        this.toSideDimensions(report.dimensions, 'asPerSite') ??
          this.toSideDimensions(report.dimensions, 'asPerDocs'),
        (report.dimensionUnit as 'ft' | 'm') ?? 'ft',
      ),
      dimensionUnit: report.dimensionUnit ?? 'ft',
      areaUnit: report.areaUnit ?? 'Sq.m',
      propertyType: report.propertyType,
      advanceReceived: Number(report.advanceReceived ?? 0),
      assetsSoldAsPerDeed: report.assetsSoldAsPerDeed,
      tenure: report.tenure,
      roadWidthMeters: report.roadWidthMeters
        ? Number(report.roadWidthMeters)
        : null,
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
      titleDeed,
      boundaries: report.boundaries ?? {},
      buildingSpecs: report.buildingSpecs ?? {},
      // Named `general` in the templates: it is the whole M-Gen sheet, not just
      // the handful of fields "generalDetails" suggests.
      general: report.generalDetails ?? {},
      boundaryRows: this.toBoundaryRows(report),
      floorSpecRows: this.toFloorSpecRows(report),
      floorHeights: floors
        .filter((f) => Number(f?.coveredAreaSqM) > 0)
        .map((f) => f.specs?.heightOfFloor ?? null),

      // Part B's area block: what was measured on site against what the
      // valuation actually took, which differ whenever the approved plan
      // covers less than what was built.
      actualCoveredAreaSqM: this.sumFloors(floors, 'actualAreaSqM'),
      consideredCoveredAreaSqM:
        this.sumFloors(floors, 'coveredAreaSqM') ??
        (computed.floors ?? []).reduce((sum, f) => sum + f.coveredAreaSqM, 0),

      extraItemRows: this.toValueRows(report.extraItems),
      serviceRows: this.toLabelledRows(report.services, SERVICE_LABELS),
      amenitiesNote: this.summariseNote(report.extraItems, 'amenities'),
      miscellaneousNote: this.summariseNote(report.extraItems, 'miscellaneous'),

      spentLifeYears: oldestFloor?.age ?? null,
      residualAgeYears: oldestFloor?.residualAge ?? null,

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

      circleRatePhoto: photos.circleRate?.url ?? null,
      // Sized to the scan's own proportions: a register page is a document, and
      // a cropped one loses the very row the valuation rests on.
      circleRateHeightMm: (photos.circleRate
        ? Math.min(
            CIRCLE_RATE_MAX_HEIGHT_MM,
            CIRCLE_RATE_CONTENT_WIDTH_MM / photos.circleRate.aspect,
          )
        : 120
      ).toFixed(2),

      computed,
      marketValueInWords: rupeesInWords(computed.roundedValue ?? 0),
      realizableValueInWords: rupeesInWords(computed.realizableValue ?? 0),
      distressValueInWords: rupeesInWords(computed.distressValue ?? 0),
    };
  }

  /** Null rather than 0 when no floor carries the figure, so the template can omit the row. */
  private sumFloors(
    floors: Record<string, any>[],
    key: 'coveredAreaSqM' | 'actualAreaSqM',
  ): number | null {
    const values = floors
      .map((floor) => Number(floor?.[key]))
      .filter((value) => Number.isFinite(value) && value > 0);
    return values.length ? values.reduce((sum, v) => sum + v, 0) : null;
  }

  /**
   * The extra-items / amenities blobs are free-form `{ label: value }` maps —
   * a rupee figure for some entries and a phrase like "Nil" for others, which
   * is how the workbook itself records them. Both are printed as given.
   */
  private toValueRows(source: unknown): { label: string; value: string }[] {
    const entries = Object.entries((source ?? {}) as Record<string, unknown>);
    return entries
      .filter(
        ([, value]) => value !== null && value !== undefined && value !== '',
      )
      .map(([label, value]) => ({
        label: this.humanise(label),
        value:
          typeof value === 'number'
            ? `₹ ${new Intl.NumberFormat('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value)}`
            : String(value),
      }));
  }

  /** Part F prints a fixed set of services in a fixed order, blank or not. */
  private toLabelledRows(
    source: unknown,
    labels: [string, string][],
  ): { label: string; value: string }[] {
    const data = (source ?? {}) as Record<string, unknown>;
    if (!Object.keys(data).length) return [];

    return labels.map(([key, label]) => ({
      label,
      value:
        data[key] === null || data[key] === undefined || data[key] === ''
          ? 'Considered in the covered area rates'
          : String(data[key]),
    }));
  }

  private summariseNote(source: unknown, key: string): string | null {
    const value = (source as Record<string, unknown>)?.[key];
    return value === null || value === undefined || value === ''
      ? null
      : String(value);
  }

  /** "waterSupply" -> "Water supply", for the free-form extra-item keys. */
  private humanise(key: string): string {
    const spaced = key
      .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
      .replace(/[_-]+/g, ' ');
    return spaced.charAt(0).toUpperCase() + spaced.slice(1).toLowerCase();
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
      ['superstructure', 'Superstructure'],
      ['walls', 'Walls'],
      ['partitions', 'Partitions'],
      ['doors', 'Doors'],
      ['windows', 'Windows'],
      ['roofType', 'RCC works (roof type)'],
      ['finishing', 'Plastering / finishing'],
      ['flooring', 'Flooring'],
      ['specialFinish', 'Special finish — marble, granite, wood panel etc.'],
      ['roofingTerracing', 'Roofing / terracing'],
      ['drainage', 'Drainage'],
      ['wiring', 'Wiring — surface or conduit'],
      ['electricalFittings', 'Class of electrical fittings'],
      [
        'sanitaryInstallations',
        'Class of sanitary installations, water meter, taps',
      ],
      ['ceiling', 'Ceiling'],
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

  /**
   * The header/footer templates are assembled as raw HTML strings rather than
   * rendered through Handlebars (Chrome takes them as markup, not as a
   * template), so interpolated values have to be escaped here.
   */
  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
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
