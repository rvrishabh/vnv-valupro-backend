/**
 * Dev tool: turn the workbook's hidden reference sheets into committed seed
 * JSON, so the runtime seed never needs the .xlsm on disk.
 *
 *   pnpm tsx scripts/generate-valuation-seed.ts "/path/to/Master Format.xlsm"
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { byRow, readWorkbook, type Cell, type Sheet } from './xlsm/workbook';
import { keyFor } from './xlsm/field-keys';
import { readEntry } from './xlsm/zip';

const ROOF_COLUMNS: Record<string, string> = {
  C: 'RCC',
  D: 'RBC',
  E: 'Girder Stone',
  F: 'Tin Shed',
  G: 'Kachcha',
};

const text = (cell?: Cell): string =>
  cell?.value === undefined ? '' : String(cell.value).trim();

const num = (cell?: Cell): number | undefined =>
  typeof cell?.value === 'number' ? cell.value : undefined;

function constructionRates(sheetCells: Cell[]) {
  const out: { tehsil: string; roofType: string; category: number; rate: number }[] = [];

  for (const [, row] of byRow(sheetCells)) {
    const tehsil = text(row.A);
    const category = num(row.B);
    // Section headers ("Category 1") and notes have no numeric category.
    if (!tehsil || !category) continue;

    for (const [col, roofType] of Object.entries(ROOF_COLUMNS)) {
      const rate = num(row[col]);
      if (rate === undefined || rate <= 0) continue;
      out.push({ tehsil, roofType, category, rate });
    }
  }

  return out;
}

/**
 * Every dropdown in the three input sheets, resolved to its actual options.
 *
 * The sheets declare dropdowns as x14 data validations pointing at ranges in
 * `Lists` / `Construction Rates`. Reading those gives an exact per-field option
 * list, which is far better than guessing from the `Lists` column headers:
 * those columns are shared and reordered between unrelated fields.
 */
function options(archive: string, sheets: Sheet[]) {
  const cellsBySheet = new Map(sheets.map((s) => [s.name, s.cells]));
  const entries = sheetEntryMap(archive);
  const out: { group: string; value: string; sortOrder: number }[] = [];
  const seen = new Set<string>();

  for (const sheetName of ['M-Doc', 'M-Rate', 'M-Gen']) {
    const entry = entries.get(sheetName);
    if (!entry) continue;
    const xml = readEntry(archive, entry);

    for (const block of xml.matchAll(
      /<x14:dataValidation\b([\s\S]*?)<\/x14:dataValidation>/g,
    )) {
      const body = block[1];
      const source = /<xm:f>([\s\S]*?)<\/xm:f>/.exec(body)?.[1];
      const sqref = /<xm:sqref>([\s\S]*?)<\/xm:sqref>/.exec(body)?.[1];
      if (!source || !sqref) continue;

      // One rule often covers several cells that are different fields sharing an
      // option list ("C80 C82 C84" = boundaries matching / plot demarcated /
      // ..., "C23:C25" = maintenance / exterior / interior), so every cell the
      // rule spans has to be keyed, not just the first.
      const keys = [...new Set(expandSqref(sqref).map((ref) => keyFor(sheetName, ref)))].filter(
        (k): k is string => Boolean(k),
      );
      if (!keys.length) continue;

      const resolved = resolveRange(source.replace(/&amp;/g, '&'), cellsBySheet);
      if (!resolved?.options.length) continue;

      for (const key of keys) {
        let sortOrder = 0;
        for (const value of resolved.options) {
          const dedupe = `${key}::${value}`;
          // The book carries near-duplicate rules for some cells (a range that
          // was extended over time); keep the union, first occurrence wins.
          if (seen.has(dedupe)) continue;
          seen.add(dedupe);
          out.push({ group: key, value, sortOrder: sortOrder++ });
        }
      }
    }
  }

  return out;
}

/** "C80 C82 C84" / "C23:C25" / "C68:E68" -> the individual cell references. */
function expandSqref(sqref: string): string[] {
  const refs: string[] = [];

  for (const token of sqref.trim().split(/\s+/)) {
    const range = /^([A-Z]+)(\d+):([A-Z]+)(\d+)$/.exec(token);
    if (!range) {
      refs.push(token);
      continue;
    }

    const [, c1, r1, c2, r2] = range;
    const fromRow = Math.min(Number(r1), Number(r2));
    const toRow = Math.max(Number(r1), Number(r2));
    const fromCol = colToIndex(c1) < colToIndex(c2) ? c1 : c2;
    const span = Math.abs(colToIndex(c1) - colToIndex(c2));

    for (let row = fromRow; row <= toRow; row += 1) {
      for (let i = 0; i <= span; i += 1) {
        refs.push(`${indexToCol(colToIndex(fromCol) + i)}${row}`);
      }
    }
  }

  return refs;
}

function colToIndex(col: string): number {
  return [...col].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0);
}

function indexToCol(index: number): string {
  let n = index;
  let out = '';
  while (n > 0) {
    const rem = (n - 1) % 26;
    out = String.fromCharCode(65 + rem) + out;
    n = Math.floor((n - 1) / 26);
  }
  return out;
}

function sheetEntryMap(archive: string): Map<string, string> {
  const rels = new Map<string, string>();
  for (const m of readEntry(archive, 'xl/_rels/workbook.xml.rels').matchAll(
    /Id="([^"]+)"[^>]*Target="([^"]+)"/g,
  )) {
    rels.set(m[1], m[2].replace(/^\/?xl\//, ''));
  }

  const map = new Map<string, string>();
  for (const m of readEntry(archive, 'xl/workbook.xml').matchAll(/<sheet ([^>]*)\/>/g)) {
    const name = /name="([^"]*)"/.exec(m[1])?.[1] ?? '';
    const target = rels.get(/r:id="([^"]+)"/.exec(m[1])?.[1] ?? '');
    if (name && target) map.set(name.replace(/&amp;/g, '&'), `xl/${target}`);
  }
  return map;
}

function resolveRange(
  source: string,
  cellsBySheet: Map<string, Cell[]>,
): { options: string[] } | null {
  const m = /^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(source.trim());
  if (!m) return null;

  const [, sheetName, startCol, startRow, endCol, endRow] = m;
  const cells = cellsBySheet.get(sheetName);
  if (!cells) return null;

  const from = Math.min(Number(startRow), Number(endRow));
  const to = Math.max(Number(startRow), Number(endRow));
  const cols = startCol === endCol ? [startCol] : [startCol, endCol];

  const values: string[] = [];
  for (const cell of cells) {
    if (!cols.includes(cell.col) || cell.row < from || cell.row > to) continue;
    const value = cell.value === undefined ? '' : String(cell.value).trim();
    if (value) values.push(value);
  }

  return { options: [...new Set(values)] };
}

function main(): void {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: generate-valuation-seed.ts <Master Format.xlsm>');
    process.exit(1);
  }

  const sheets = readWorkbook(file);
  const rates = constructionRates(sheets.find((s) => s.name === 'Construction Rates')!.cells);
  const opts = options(file, sheets);

  const dir = join(__dirname, '..', 'prisma', 'data');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'construction-rates.json'), JSON.stringify(rates, null, 2));
  writeFileSync(join(dir, 'valuation-options.json'), JSON.stringify(opts, null, 2));

  const groups = [...new Set(opts.map((o) => o.group))];
  console.log(`construction-rates.json — ${rates.length} rates`);
  console.log(`valuation-options.json  — ${opts.length} options across ${groups.length} groups`);
  console.log(groups.join(' | '));
}

main();
