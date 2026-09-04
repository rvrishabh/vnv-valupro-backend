import { ValuationMethod } from 'types/valuation.types';

/**
 * Road-width bands the printed circle-rate registers price non-agricultural
 * land by (e.g. "अकृषक भूमि की दरें" — <=9m / 9-18m / >18m road frontage).
 */
export type RoadWidthBand = 'UPTO_9M' | 'FROM_9_TO_18M' | 'ABOVE_18M';

/**
 * Which section of the printed register a valuation's circle rate belongs to.
 * "CRM" is a single bucket standing in for the register's composite/built-unit
 * columns — those aren't split into the printed register's six standalone vs.
 * in-building sub-categories yet, since that split isn't modelled elsewhere in
 * the app either.
 */
export type CircleRatePropertyCategory = 'LAND' | 'CRM';

/** M-Doc road-width bands: <=9m / 9-18m / >18m. */
export function resolveRoadWidthBand(meters: number): RoadWidthBand {
  if (meters <= 9) return 'UPTO_9M';
  if (meters <= 18) return 'FROM_9_TO_18M';
  return 'ABOVE_18M';
}

/**
 * A composite-rate valuation prices a built unit (the register's commercial
 * columns); land-and-building and vacant-plot valuations price the land
 * itself (the register's road-width-banded columns).
 */
export function resolveCircleRateCategory(
  method: ValuationMethod,
): CircleRatePropertyCategory {
  return method === 'CRM' ? 'CRM' : 'LAND';
}

/** Sentinel stored on a CRM entry, which has no road-width band. */
export const NO_ROAD_WIDTH_BAND = 'NONE';

/** Midnight of the given date, in UTC — one register entry per area per day. */
export function truncateToDay(date: Date): Date {
  return new Date(
    Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
  );
}
