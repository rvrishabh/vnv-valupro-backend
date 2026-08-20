import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import * as Handlebars from 'handlebars';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import puppeteer, { Browser } from 'puppeteer-core';

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
  }

  async render(
    templateKey: string,
    data: Record<string, unknown>,
  ): Promise<Buffer> {
    const html = this.compile(templateKey)(data);

    let browser: Browser | undefined;
    try {
      browser = await puppeteer.launch({
        executablePath: this.resolveExecutablePath(),
        headless: true,
        args: ['--no-sandbox', '--disable-dev-shm-usage'],
      });

      const page = await browser.newPage();
      await page.setContent(html, { waitUntil: 'domcontentloaded' });

      return Buffer.from(
        await page.pdf({
          format: 'A4',
          printBackground: true,
          margin: { top: '14mm', bottom: '16mm', left: '12mm', right: '12mm' },
          displayHeaderFooter: true,
          headerTemplate: '<div></div>',
          footerTemplate: `
            <div style="width:100%;font-size:8px;color:#555;padding:0 12mm;
                        display:flex;justify-content:space-between;">
              <span>V.N.V. Engineers — Valuation Report</span>
              <span>Page <span class="pageNumber"></span> of <span class="totalPages"></span></span>
            </div>`,
        }),
      );
    } catch (error) {
      this.logger.error(
        `PDF render failed for template "${templateKey}"`,
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

  private registerHelpers(): void {
    const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

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
      (a: unknown, b: unknown) => a ?? b ?? 'N.A.',
    );

    Handlebars.registerHelper('date', (value: unknown) =>
      value ? new Date(value as string).toLocaleDateString('en-IN') : 'N.A.',
    );
  }
}
