import { excelRound, plotAreaFromDimensions } from './excel.util';

export type DimensionUnit = 'ft' | 'm';

export interface SideDimensions {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface AreaOfSite {
  /** Area of property as typed in the deed (M-Doc!C103). */
  asPerDeed: number | null;
  /** Area of property as measured on site (M-Doc!C104). */
  asPerSite: number | null;
  /** Area actually valued (M-Doc!C105). */
  underConsideration: number | null;
  /** Which of the two the consideration came from, for display and the report. */
  source: 'deed' | 'site' | 'none';
  /** True when deed and site disagree, i.e. a discrepancy worth noting. */
  hasVariation: boolean;
}

/**
 * Decides the area a valuation is computed on.
 *
 * The site area mirrors the deed until someone measures something different.
 * When the two disagree the smaller governs — valuing land the owner cannot
 * actually produce would overstate the security — and when they agree the deed
 * is the stated source, matching M-Doc!C105 defaulting to C103.
 */
export function resolveAreaOfSite(
  asPerDeed: number | null | undefined,
  asPerSite: number | null | undefined,
): AreaOfSite {
  const deed = isUsable(asPerDeed) ? asPerDeed : null;
  const site = isUsable(asPerSite) ? asPerSite : null;

  if (deed === null && site === null) {
    return {
      asPerDeed: null,
      asPerSite: null,
      underConsideration: null,
      source: 'none',
      hasVariation: false,
    };
  }

  // Only one side known: it is both the mirror and the basis.
  if (deed === null || site === null) {
    const only = deed ?? site;
    return {
      asPerDeed: deed,
      asPerSite: site,
      underConsideration: only,
      source: deed === null ? 'site' : 'deed',
      hasVariation: false,
    };
  }

  const hasVariation = deed !== site;

  return {
    asPerDeed: deed,
    asPerSite: site,
    underConsideration: Math.min(deed, site),
    // Ties resolve to the deed, which is the documented figure.
    source: !hasVariation || deed <= site ? 'deed' : 'site',
    hasVariation,
  };
}

/**
 * Area implied by the four side measurements (M-Doc!B100 / C100). Opposite
 * sides are averaged, so an irregular plot still yields a usable rectangle.
 */
export function areaFromDimensions(
  dimensions: Partial<SideDimensions> | null | undefined,
  unit: DimensionUnit,
): number | null {
  if (!dimensions) return null;

  const sides = {
    north: Number(dimensions.north) || 0,
    south: Number(dimensions.south) || 0,
    east: Number(dimensions.east) || 0,
    west: Number(dimensions.west) || 0,
  };

  // A missing side would silently halve the average and produce a plausible
  // but wrong area, so require all four before computing anything.
  if (Object.values(sides).some((v) => v <= 0)) return null;

  return plotAreaFromDimensions(sides, unit);
}

/** Converts a stored area between the units the form offers. */
export function toSqm(value: number, unit: DimensionUnit): number {
  return unit === 'ft' ? excelRound(value / 10.765, 2) : value;
}

function isUsable(value: number | null | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}
