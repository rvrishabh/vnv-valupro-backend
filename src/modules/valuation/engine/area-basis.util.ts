import { ValuationMethod } from 'types/valuation.types';

export type AreaBasis =
  | 'Plot Area'
  | 'Super Area'
  | 'Builtup Area'
  | 'Carpet Area';

export const AREA_BASES: AreaBasis[] = [
  'Plot Area',
  'Super Area',
  'Builtup Area',
  'Carpet Area',
];

/**
 * M-Doc!C108 — what the area under consideration actually measures.
 *
 * A composite-rate valuation prices a built unit, so its area is the super
 * area; land-and-building and vacant-plot valuations price the plot itself.
 * The sheet holds this as a formula on the method and so does this: it is
 * derived, not chosen, which keeps the basis and the method from disagreeing.
 */
export function areaBasisFor(method: ValuationMethod): AreaBasis {
  return method === 'CRM' ? 'Super Area' : 'Plot Area';
}

export type UndividedShareMode = 'entered' | 'not-applicable';

export interface UndividedShare {
  mode: UndividedShareMode;
  /** Sq.m, or null when the documents do not state a share. */
  value: number | null;
  /** What the report prints for this row. */
  label: string;
}

/**
 * M-Doc!C110 — the share of land attaching to a unit in a larger building.
 *
 * A shop occupies its whole footprint, so its share is simply the area under
 * consideration. A flat sits in a multi-storey block where the share has to be
 * read off the deed and typed in. Anything else owns its land outright, and
 * the sheet prints "Undivided Share not mentioned in documents" (CANARA!D105).
 */
export function resolveUndividedShare(
  method: ValuationMethod | null | undefined,
  propertyType: string | null | undefined,
  entered: number | null | undefined,
): UndividedShare {
  const isFlat = (propertyType ?? '').trim().toLowerCase() === 'flat';

  // A share of common land only arises where a unit sits in a larger building
  // priced on a composite rate. Outside that the property owns its land
  // outright, and the sheet prints the "not mentioned" line (CANARA!D105).
  if (method !== 'CRM' || !isFlat) {
    return {
      mode: 'not-applicable',
      value: null,
      label: 'Undivided Share not mentioned in documents',
    };
  }

  const value = isUsable(entered) ? entered : null;
  return {
    mode: 'entered',
    value,
    label:
      value === null
        ? 'Undivided Share not mentioned in documents'
        : `${value} Sq.m`,
  };
}

function isUsable(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
