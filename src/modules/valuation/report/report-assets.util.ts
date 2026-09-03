import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Static artwork the report templates embed.
 *
 * Everything is inlined as a data URI rather than referenced by path or URL:
 * the HTML is handed to Chrome via `page.setContent`, which gives the document
 * no base URL to resolve a relative `src` against, and a network fetch inside
 * the renderer would be one more thing that can fail while a valuer waits on a
 * download.
 */

/** Files are read once — they are static and the process is long-lived. */
const cache = new Map<string, string>();

/**
 * `__dirname` is `dist/src/modules/valuation/report` once built and the source
 * directory under `nest start --watch`; the nest-cli asset rule copies the
 * folder to the former. The cwd-relative fallbacks match how
 * common/services/zavu.service.ts locates its own logo, and keep a
 * differently-rooted process (a script, a test) from failing to find the art.
 */
function resolveAsset(fileName: string): string {
  const candidates = [
    join(__dirname, 'assets', fileName),
    join(process.cwd(), 'src/modules/valuation/report/assets', fileName),
    join(process.cwd(), 'dist/src/modules/valuation/report/assets', fileName),
  ];

  const found = candidates.find((path) => existsSync(path));
  if (!found) {
    throw new Error(
      `Report asset "${fileName}" was not found — looked in: ${candidates.join(', ')}`,
    );
  }
  return found;
}

function dataUri(fileName: string, mimeType: string): string {
  const cached = cache.get(fileName);
  if (cached) return cached;

  const base64 = readFileSync(resolveAsset(fileName)).toString('base64');
  const uri = `data:${mimeType};base64,${base64}`;
  cache.set(fileName, uri);
  return uri;
}

/**
 * The full A4 letterhead — swoosh artwork, logo, credentials strip and the
 * office/QR footer — as one page-sized image for the cover sheet's background.
 * Kept as SVG (fonts already converted to outlines by the export, so nothing
 * external is needed) so it stays sharp at print resolution.
 */
export function letterheadDataUri(): string {
  return dataUri('letterhead-a4.svg', 'image/svg+xml');
}
