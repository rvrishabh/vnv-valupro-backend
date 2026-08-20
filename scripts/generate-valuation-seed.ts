/**
 * Dev tool: turn the workbook's hidden reference sheets into committed seed
 * JSON, so the runtime seed never needs the .xlsm on disk.
 *
 *   pnpm tsx scripts/generate-valuation-seed.ts "/path/to/Master Format.xlsm"
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { byRow, readWorkbook, type Cell } from './xlsm/workbook';

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
 * The Lists sheet is column-per-dropdown, but the header is not on a fixed row:
 * some columns start at row 1, others at row 2 or 3. The first text cell in a
 * column is therefore taken as its group name, and everything below it as the
 * options. Purely numeric cells are helper/lookup columns and are skipped.
 */
function options(sheetCells: Cell[]) {
  const rows = byRow(sheetCells);
  const out: { group: string; value: string; sortOrder: number }[] = [];
  const columns = new Set(sheetCells.map((c) => c.col));
  const seenGroups = new Map<string, string>();

  const isNumeric = (v: string) => /^\d+(\.\d+)?$/.test(v);

  for (const col of columns) {
    let group = '';
    let sortOrder = 0;

    for (const [, row] of rows) {
      const value = text(row[col]);
      if (!value || isNumeric(value)) continue;

      if (!group) {
        // Two columns both label themselves "Type of Property"; keep them
        // distinct so neither silently overwrites the other.
        const taken = seenGroups.get(value);
        group = taken && taken !== col ? `${value} (${col})` : value;
        seenGroups.set(value, col);
        continue;
      }

      out.push({ group, value, sortOrder: sortOrder++ });
    }
  }

  return out;
}

function main(): void {
  const file = process.argv[2];
  if (!file) {
    console.error('usage: generate-valuation-seed.ts <Master Format.xlsm>');
    process.exit(1);
  }

  const sheets = readWorkbook(file, ['Construction Rates', 'Lists']);
  const rates = constructionRates(sheets.find((s) => s.name === 'Construction Rates')!.cells);
  const opts = options(sheets.find((s) => s.name === 'Lists')!.cells);

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
