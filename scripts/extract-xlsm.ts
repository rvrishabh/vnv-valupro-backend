/**
 * Dev tool: dump an .xlsm valuation workbook to JSON.
 *
 * The workbook is a zip of OOXML; every sheet carries both its formulas and the
 * values Excel last computed. Those cached values are what make completed cases
 * usable as regression fixtures for the calculation engine.
 *
 *   pnpm tsx scripts/extract-xlsm.ts <file.xlsm> --list
 *   pnpm tsx scripts/extract-xlsm.ts <file.xlsm> --sheets "M-Doc,M-Rate" --out dump.json
 *   pnpm tsx scripts/extract-xlsm.ts <file.xlsm> --sheets "M-Doc" --labels
 */
import { writeFileSync } from 'node:fs';
import { byRow, readWorkbook, type Cell } from './xlsm/workbook';

function arg(name: string): string | undefined {
  const i = process.argv.indexOf(`--${name}`);
  return i === -1 ? undefined : process.argv[i + 1];
}

function has(name: string): boolean {
  return process.argv.includes(`--${name}`);
}

function render(cell: Cell | undefined): string {
  if (!cell) return '';
  const value = cell.value === undefined ? '' : String(cell.value);
  return cell.formula ? `${value}  [=${cell.formula}]` : value;
}

function main(): void {
  const file = process.argv[2];
  if (!file || file.startsWith('--')) {
    console.error('usage: extract-xlsm.ts <file.xlsm> [--list] [--sheets a,b] [--labels] [--out f]');
    process.exit(1);
  }

  const only = arg('sheets')?.split(',').map((s) => s.trim());
  const sheets = readWorkbook(file, only);

  if (has('list')) {
    for (const s of sheets) {
      console.log(`${s.hidden ? '  (hidden) ' : '           '}${s.name.padEnd(28)} ${s.entry}`);
    }
    return;
  }

  if (has('labels')) {
    const labelCol = arg('label-col') ?? 'B';
    const valueCol = arg('value-col') ?? 'C';
    for (const sheet of sheets) {
      console.log(`\n===== ${sheet.name} =====`);
      for (const [row, cells] of byRow(sheet.cells)) {
        const label = render(cells[labelCol]);
        const value = render(cells[valueCol]);
        if (label || value) console.log(`${String(row).padStart(4)}  ${label.padEnd(52)} ${value}`);
      }
    }
    return;
  }

  const payload = {
    source: file,
    extractedAt: new Date().toISOString(),
    sheets: sheets.map((s) => ({ name: s.name, hidden: s.hidden, cells: s.cells })),
  };

  const out = arg('out');
  if (out) {
    writeFileSync(out, JSON.stringify(payload, null, 2));
    const total = sheets.reduce((n, s) => n + s.cells.length, 0);
    console.log(`wrote ${out} — ${sheets.length} sheet(s), ${total} cells`);
  } else {
    console.log(JSON.stringify(payload, null, 2));
  }
}

main();
