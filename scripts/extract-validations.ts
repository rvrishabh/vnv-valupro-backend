/**
 * Dev tool: recover every dropdown in the valuation workbook.
 *
 * The input sheets declare their dropdowns as x14 data validations (the
 * extension form Excel uses when the source range lives on another sheet), each
 * pointing at a range in `Lists` or `Construction Rates`. This resolves those
 * ranges to their actual values and pairs each dropdown with the row label
 * beside it, which is what tells us which UI fields must be selects.
 *
 *   pnpm tsx scripts/extract-validations.ts "Master Format.xlsm" [--json out.json]
 */
import { writeFileSync } from 'node:fs';
import { readEntry } from './xlsm/zip';
import { byRow, readWorkbook, type Cell } from './xlsm/workbook';

const INPUT_SHEETS = ['M-Doc', 'M-Rate', 'M-Gen'];

interface Validation {
  sheet: string;
  cells: string[];
  source: string;
  label: string;
  options: string[];
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

/** Expands "Lists!$A$20:$A$27" into the non-empty values in that column range. */
function resolveRange(
  source: string,
  cellsBySheet: Map<string, Cell[]>,
): { sheet: string; options: string[] } | null {
  const m = /^'?([^'!]+)'?!\$?([A-Z]+)\$?(\d+):\$?([A-Z]+)\$?(\d+)$/.exec(source.trim());
  if (!m) return null;

  const [, sheetName, startCol, startRow, endCol, endRow] = m;
  const cells = cellsBySheet.get(sheetName);
  if (!cells) return null;

  const from = Math.min(Number(startRow), Number(endRow));
  const to = Math.max(Number(startRow), Number(endRow));
  const cols = startCol === endCol ? [startCol] : [startCol, endCol];

  const options: string[] = [];
  for (const cell of cells) {
    if (!cols.includes(cell.col)) continue;
    if (cell.row < from || cell.row > to) continue;
    const value = cell.value === undefined ? '' : String(cell.value).trim();
    if (value) options.push(value);
  }

  return { sheet: sheetName, options: [...new Set(options)] };
}

function main(): void {
  const archive = process.argv[2];
  if (!archive) {
    console.error('usage: extract-validations.ts <Master Format.xlsm> [--json out]');
    process.exit(1);
  }

  const entries = sheetEntryMap(archive);
  const all = readWorkbook(archive);
  const cellsBySheet = new Map(all.map((s) => [s.name, s.cells]));
  const rowsBySheet = new Map(all.map((s) => [s.name, byRow(s.cells)]));

  const results: Validation[] = [];

  for (const sheetName of INPUT_SHEETS) {
    const entry = entries.get(sheetName);
    if (!entry) continue;
    const xml = readEntry(archive, entry);
    const rows = rowsBySheet.get(sheetName)!;

    for (const block of xml.matchAll(/<x14:dataValidation\b([\s\S]*?)<\/x14:dataValidation>/g)) {
      const body = block[1];
      const source = /<xm:f>([\s\S]*?)<\/xm:f>/.exec(body)?.[1];
      const sqref = /<xm:sqref>([\s\S]*?)<\/xm:sqref>/.exec(body)?.[1];
      if (!source || !sqref) continue;

      const resolved = resolveRange(source.replace(/&amp;/g, '&'), cellsBySheet);
      if (!resolved || !resolved.options.length) continue;

      // sqref may list several ranges: "C68:E68 C95:D95"
      const cells = sqref.trim().split(/\s+/);
      const firstRow = Number(/(\d+)/.exec(cells[0])?.[1] ?? 0);

      // Labels sit in column B (M-Doc/M-Rate) or A, immediately left of the input.
      const row = rows.get(firstRow) ?? {};
      const label = String(row.B?.value ?? row.A?.value ?? '').trim();

      results.push({
        sheet: sheetName,
        cells,
        source: source.replace(/&amp;/g, '&'),
        label,
        options: resolved.options,
      });
    }
  }

  const jsonFlag = process.argv.indexOf('--json');
  if (jsonFlag !== -1 && process.argv[jsonFlag + 1]) {
    writeFileSync(process.argv[jsonFlag + 1], JSON.stringify(results, null, 2));
    console.log(`wrote ${process.argv[jsonFlag + 1]} — ${results.length} dropdowns`);
    return;
  }

  for (const v of results) {
    const preview = v.options.slice(0, 6).join(' | ');
    const more = v.options.length > 6 ? ` …(+${v.options.length - 6})` : '';
    console.log(`\n[${v.sheet}] ${v.cells[0]}  ${v.label || '(no label)'}`);
    console.log(`   src ${v.source}  →  ${preview}${more}`);
  }
  console.log(`\ntotal dropdowns: ${results.length}`);
}

main();
