import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as Handlebars from 'handlebars';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { PDFDocument } from 'pdf-lib';
import puppeteer, { Browser, PDFOptions } from 'puppeteer-core';

/** The shared A4 page geometry every part of the report is laid out against. */
export const A4_WIDTH_MM = 210;
export const A4_HEIGHT_MM = 297;

/**
 * One HTML document to be printed. A report is several of these — a cover
 * sheet, the photograph annexure, the report body — because each needs its own
 * page furniture: the cover is full-bleed letterhead art with no margins at
 * all, while the body carries a repeating header/footer and page numbers.
 * Chrome prints one header/footer per document, so these are separate prints
 * that are merged afterwards.
 */
export interface PdfDocumentSpec {
  templateKey: string;
  data: Record<string, unknown>;
  /** Merged over the A4 defaults; a missing key keeps the default. */
  options?: Pick<
    PDFOptions,
    'margin' | 'displayHeaderFooter' | 'headerTemplate' | 'footerTemplate'
  >;
}

const DEFAULT_PDF_OPTIONS: PDFOptions = {
  format: 'A4',
  printBackground: true,
  margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
  displayHeaderFooter: false,
};

/**
 * Renders a report template to PDF with headless Chrome.
 *
 * `puppeteer-core` ships no browser binary, so a Chromium executable must be
 * provided via CHROMIUM_PATH (or PUPPETEER_EXECUTABLE_PATH). On macOS this is
 * typically the installed Chrome; on the deploy target it is the image's
 * chromium package.
 */
@Injectable()
export class PdfService {
  private readonly logger = new Logger(PdfService.name);
  private readonly templates = new Map<string, HandlebarsTemplateDelegate>();

  constructor() {
    this.registerHelpers();
    this.registerPartials();
  }

  async render(
    templateKey: string,
    data: Record<string, unknown>,
    options?: PdfDocumentSpec['options'],
  ): Promise<Buffer> {
    const [buffer] = await this.renderAll([{ templateKey, data, options }]);
    return buffer;
  }

  /**
   * Prints several documents and concatenates them into one PDF, in order.
   *
   * The whole set shares a single browser launch — starting Chrome is by far
   * the most expensive part of generating a report, and doing it once per
   * section would triple the wait for no benefit.
   */
  async renderAndMerge(docs: PdfDocumentSpec[]): Promise<Buffer> {
    const parts = await this.renderAll(docs);
    if (parts.length === 1) return parts[0];

    const merged = await PDFDocument.create();
    for (const part of parts) {
      const source = await PDFDocument.load(part);
      const pages = await merged.copyPages(source, source.getPageIndices());
      for (const page of pages) merged.addPage(page);
    }

    return Buffer.from(await merged.save());
  }

  private async renderAll(docs: PdfDocumentSpec[]): Promise<Buffer[]> {
    const pages = docs.map((doc) => ({
      html: this.compile(doc.templateKey)(doc.data),
      options: { ...DEFAULT_PDF_OPTIONS, ...doc.options },
      templateKey: doc.templateKey,
    }));

    let browser: Browser | undefined;
    try {
      browser = await puppeteer.launch({
        executablePath: this.resolveExecutablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });

      const buffers: Buffer[] = [];
      for (const { html, options } of pages) {
        const page = await browser.newPage();
        await page.setContent(html, { waitUntil: 'domcontentloaded' });
        // `domcontentloaded` fires before an <img> — including a base64 data
        // URI, which triggers no network request but still decodes
        // asynchronously — has actually rendered a pixel. A template that
        // sizes anything off image content (the photo annexure's computed-height
        // rows, the cover's full-bleed letterhead) would otherwise get PDF'd
        // against a layout computed before the images had dimensions.
        await page.evaluate(async () => {
          await Promise.all(
            Array.from(document.images).map((img) =>
              img.decode().catch(() => undefined),
            ),
          );
        });

        buffers.push(Buffer.from(await page.pdf(options)));
        await page.close();
      }

      return buffers;
    } catch (error) {
      this.logger.error(
        `PDF render failed for templates "${pages.map((p) => p.templateKey).join(', ')}"`,
        error as Error,
      );
      throw new InternalServerErrorException(
        error instanceof Error && error.message.includes('executablePath')
          ? 'Chromium not available — set CHROMIUM_PATH'
          : 'Failed to render the valuation report',
      );
    } finally {
      await browser?.close();
    }
  }

  private resolveExecutablePath(): string {
    // Env is read directly here, matching how the rest of the codebase does it
    // (see common/services/zavu.service.ts) — there is no ConfigModule.
    const path =
      process.env.CHROMIUM_PATH ?? process.env.PUPPETEER_EXECUTABLE_PATH;

    if (!path) {
      throw new InternalServerErrorException(
        'CHROMIUM_PATH is not configured — PDF rendering needs a Chromium binary',
      );
    }
    return path;
  }

  /** Templates are compiled once and cached; they are static files on disk. */
  private compile(templateKey: string): HandlebarsTemplateDelegate {
    const cached = this.templates.get(templateKey);
    if (cached) return cached;

    const file = join(__dirname, 'templates', `${templateKey}.hbs`);
    const compiled = Handlebars.compile(readFileSync(file, 'utf8'));
    this.templates.set(templateKey, compiled);
    return compiled;
  }

  /**
   * Every `templates/partials/*.hbs` becomes a partial named after its file,
   * so a template pulls the shared stylesheet in with `{{> report-styles}}`.
   * Registering the whole directory means adding a partial is one new file
   * rather than a file plus a registration line here.
   */
  private registerPartials(): void {
    const dir = join(__dirname, 'templates', 'partials');
    // A build that has not copied the assets yet (or a template set with no
    // partials at all) is not an error — the templates that need one will fail
    // loudly at compile time instead.
    if (!existsSync(dir)) return;

    for (const file of readdirSync(dir)) {
      if (!file.endsWith('.hbs')) continue;
      Handlebars.registerPartial(
        basename(file, '.hbs'),
        readFileSync(join(dir, file), 'utf8'),
      );
    }
  }

  private registerHelpers(): void {
    const inr = new Intl.NumberFormat('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    Handlebars.registerHelper('inr', (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value)
        ? inr.format(value)
        : 'N.A.',
    );

    Handlebars.registerHelper('num', (value: unknown, digits = 2) =>
      typeof value === 'number' && Number.isFinite(value)
        ? value.toFixed(typeof digits === 'number' ? digits : 2)
        : 'N.A.',
    );

    Handlebars.registerHelper('pct', (value: unknown) =>
      typeof value === 'number' && Number.isFinite(value)
        ? `${(value * 100).toFixed(2)}%`
        : 'N.A.',
    );

    Handlebars.registerHelper(
      'or',
      (a: unknown, b: unknown) =>
        (typeof a === 'string' ? a.trim() : a) || b || 'N.A.',
    );

    Handlebars.registerHelper('date', (value: unknown) =>
      value ? new Date(value as string).toLocaleDateString('en-IN') : 'N.A.',
    );

    // "11 August 2026" — how the reference report prints inspection and
    // valuation dates, as against the numeric form used inside tables.
    Handlebars.registerHelper('dateLong', (value: unknown) =>
      value
        ? new Date(value as string).toLocaleDateString('en-IN', {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })
        : 'N.A.',
    );

    Handlebars.registerHelper('eq', (a: unknown, b: unknown) => a === b);

    /** 0-based {{@index}} into the 1-based serial numbers the report prints. */
    Handlebars.registerHelper('inc', (value: unknown) => Number(value) + 1);
  }
}
