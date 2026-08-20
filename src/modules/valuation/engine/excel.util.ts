/**
 * Excel-faithful numeric primitives.
 *
 * The valuation workbook rounds at intermediate steps, so the engine has to
 * round in the same places with the same semantics — rounding only at the end
 * produces different rupee totals. Excel evaluates in IEEE-754 doubles, which
 * is why these operate on `number` rather than an arbitrary-precision decimal:
 * matching Excel means reproducing Excel's arithmetic, not improving on it.
 */

/** Sq.ft -> Sq.m divisor used throughout the workbook (M-Doc!C100, M-Rate!C51). */
export const SQFT_PER_SQM = 10.765;

/**
 * Excel ROUND(value, digits): half away from zero, unlike JS Math.round which
 * is half-up and therefore disagrees on negatives (-0.5 -> -1 vs 0).
 *
 * Negative `digits` rounds left of the decimal point: ROUND(x, -2) to hundreds.
 * The scaled value is nudged by a relative epsilon first so that a product like
 * 2306599.9999999995 — a binary artefact of an exact .5 boundary — rounds the
 * way the sheet shows it.
 */
export function excelRound(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return value;
  const factor = Math.pow(10, digits);
  const scaled = value * factor;
  const nudged =
    scaled + Math.sign(scaled) * Math.abs(scaled) * Number.EPSILON * 4;
  return (Math.sign(nudged) * Math.round(Math.abs(nudged))) / factor;
}

/** Excel ROUNDDOWN(value, digits): truncate toward zero. */
export function excelRoundDown(value: number, digits = 0): number {
  if (!Number.isFinite(value)) return value;
  const factor = Math.pow(10, digits);
  const scaled = value * factor;
  return (Math.sign(scaled) * Math.floor(Math.abs(scaled))) / factor;
}

export function sqftToSqm(sqft: number): number {
  return sqft / SQFT_PER_SQM;
}

/** M-Doc!C100 — plot area from side dimensions, averaging opposite sides. */
export function plotAreaFromDimensions(
  dims: { north: number; south: number; east: number; west: number },
  unit: 'ft' | 'm',
): number {
  const width = (dims.north + dims.south) / 2;
  const depth = (dims.east + dims.west) / 2;
  const area = unit === 'ft' ? sqftToSqm(depth * width) : width * depth;
  return excelRound(area, 2);
}
