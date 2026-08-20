import { readEntry } from './zip';

export interface Cell {
  ref: string;
  col: string;
  row: number;
  formula?: string;
  value?: string | number;
}

export interface Sheet {
  name: string;
  entry: string;
  hidden: boolean;
  cells: Cell[];
}

const ENTITIES: Record<string, string> = {
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&apos;': "'",
};

function unescapeXml(s: string): string {
  return s
    .replace(/&(?:amp|lt|gt|quot|apos);/g, (m) => ENTITIES[m])
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

function parseSharedStrings(archive: string): string[] {
  let xml: string;
  try {
    xml = readEntry(archive, 'xl/sharedStrings.xml');
  } catch {
    return [];
  }
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>/g)].map((m) => unescapeXml(stripTags(m[1])));
}

// Excel stores rich text as separate <t> runs; a shared string may also be an
// inline <is> on the cell itself, which is why cells are checked for both.
function parseSheet(archive: string, entry: string, shared: string[]): Cell[] {
  const xml = readEntry(archive, entry);
  const cells: Cell[] = [];
  // A cell may be self-closing (`<c r="A1" s="5"/>`, style only). Matching those
  // with the same greedy pattern as a value cell makes the match run on to the
  // NEXT cell's `</c>`, silently reattributing that cell's value to this ref.
  const cellRe = /<c r="([A-Z]+)(\d+)"([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g;

  for (const m of xml.matchAll(cellRe)) {
    const [, col, row, attrs, rawBody] = m;
    const body = rawBody ?? '';
    const type = /t="(\w+)"/.exec(attrs)?.[1];
    const formula = /<f[^>]*>([\s\S]*?)<\/f>/.exec(body)?.[1];
    const rawValue = /<v>([\s\S]*?)<\/v>/.exec(body)?.[1];
    const inline = /<is>([\s\S]*?)<\/is>/.exec(body)?.[1];

    let value: string | number | undefined;
    if (inline !== undefined) {
      value = unescapeXml(stripTags(inline));
    } else if (rawValue !== undefined) {
      if (type === 's') {
        value = shared[Number(rawValue)] ?? '';
      } else if (type === 'str' || type === 'e') {
        value = unescapeXml(rawValue);
      } else {
        const n = Number(rawValue);
        value = Number.isNaN(n) ? unescapeXml(rawValue) : n;
      }
    }

    if (formula === undefined && value === undefined) continue;

    cells.push({
      ref: `${col}${row}`,
      col,
      row: Number(row),
      ...(formula !== undefined ? { formula: unescapeXml(formula) } : {}),
      ...(value !== undefined ? { value } : {}),
    });
  }

  return cells;
}

export function readWorkbook(archive: string, only?: string[]): Sheet[] {
  const shared = parseSharedStrings(archive);
  const rels = new Map<string, string>();

  for (const m of readEntry(archive, 'xl/_rels/workbook.xml.rels').matchAll(
    /Id="([^"]+)"[^>]*Target="([^"]+)"/g,
  )) {
    rels.set(m[1], m[2].replace(/^\/?xl\//, ''));
  }

  const sheets: Sheet[] = [];
  for (const m of readEntry(archive, 'xl/workbook.xml').matchAll(/<sheet ([^>]*)\/>/g)) {
    const attrs = m[1];
    const name = unescapeXml(/name="([^"]*)"/.exec(attrs)?.[1] ?? '');
    const rid = /r:id="([^"]+)"/.exec(attrs)?.[1];
    const target = rid ? rels.get(rid) : undefined;
    if (!target) continue;
    if (only && !only.includes(name)) continue;

    sheets.push({
      name,
      entry: `xl/${target}`,
      hidden: /state="(hidden|veryHidden)"/.test(attrs),
      cells: parseSheet(archive, `xl/${target}`, shared),
    });
  }

  return sheets;
}

export function byRow(cells: Cell[]): Map<number, Record<string, Cell>> {
  const rows = new Map<number, Record<string, Cell>>();
  for (const c of cells) {
    const row = rows.get(c.row) ?? {};
    row[c.col] = c;
    rows.set(c.row, row);
  }
  return new Map([...rows].sort((a, b) => a[0] - b[0]));
}
