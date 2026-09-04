export interface LayoutPhoto {
  url: string;
  aspect: number;
}

export interface LaidOutPhoto {
  url: string;
  widthMm: number;
}

export interface PhotoRow {
  heightMm: number;
  photos: LaidOutPhoto[];
}

export interface PhotoLayout {
  rows: PhotoRow[];
  /** Total height the two rows actually occupy, gap between them included — the aerial section gets whatever's left of the page budget. */
  heightMm: number;
}

const ROW_GAP_MM = 2;

/**
 * A "justified gallery" layout: every photo renders at its own aspect ratio
 * (never cropped, never letterboxed) and each row's height is *derived* —
 * chosen so that row's photos, side by side with a fixed gap, exactly fill
 * the container width. That's the only way to guarantee both "no crop" and
 * "no gaps" for an arbitrary mix of portrait/landscape photos at once; a
 * uniform grid can't do it because a cell's shape is fixed independently of
 * what's inside it.
 *
 * Photos split into exactly two rows, balanced by *summed aspect ratio*
 * (not count) — that's what makes the two rows come out close to the same
 * height, since row height is inversely proportional to that sum. Landscape
 * photos should sort to the front of `photos` before calling this, so they
 * land at the top-left, matching the reference layout.
 */
export function computePhotoLayout(
  photos: LayoutPhoto[],
  containerWidthMm: number,
  maxTotalHeightMm: number,
): PhotoLayout {
  if (!photos.length) return { rows: [], heightMm: 0 };

  const [firstRowPhotos, secondRowPhotos] = splitBalanced(photos);
  const row1 = layoutRow(firstRowPhotos, containerWidthMm);
  const row2 = layoutRow(secondRowPhotos, containerWidthMm);
  const rows = [row1, row2].filter((r) => r.photos.length > 0);

  const gapTotal = rows.length > 1 ? ROW_GAP_MM : 0;
  let heightMm = rows.reduce((sum, r) => sum + r.heightMm, 0) + gapTotal;

  // Only the rare case (many very-tall/narrow photos) hits this: shrinking
  // both rows by the same factor keeps them proportional to each other and
  // internally aspect-correct, at the cost of no longer quite filling the
  // container width — an even, centered margin beats forcing an overflow.
  if (heightMm > maxTotalHeightMm) {
    const scale = (maxTotalHeightMm - gapTotal) / (heightMm - gapTotal);
    for (const row of rows) {
      row.heightMm *= scale;
      for (const photo of row.photos) photo.widthMm *= scale;
    }
    heightMm = maxTotalHeightMm;
  }

  return { rows, heightMm };
}

/**
 * Splits photos into two groups whose aspect-ratio sums are as close to
 * equal as possible, preserving order within each group.
 *
 * Below 4 photos, a balanced-by-aspect-sum split can still land a single
 * narrow portrait alone in a row — with nothing beside it to share the
 * width, it has to become absurdly tall to fill the row on its own (e.g. one
 * 9:16 photo alone at 186mm wide would need to be 330mm tall). There just
 * isn't enough combinatorial freedom with this few photos to avoid it, so
 * below that count everything shares a single row instead.
 */
function splitBalanced(photos: LayoutPhoto[]): [LayoutPhoto[], LayoutPhoto[]] {
  if (photos.length <= 3) return [photos, []];

  const total = photos.reduce((sum, p) => sum + p.aspect, 0);
  const target = total / 2;

  let running = 0;
  let splitIndex = photos.length;
  for (let i = 0; i < photos.length; i++) {
    const withCurrent = running + photos[i].aspect;
    if (withCurrent >= target) {
      splitIndex =
        Math.abs(withCurrent - target) <= Math.abs(running - target)
          ? i + 1
          : i;
      break;
    }
    running = withCurrent;
  }
  splitIndex = Math.min(Math.max(splitIndex, 1), photos.length - 1);

  return [photos.slice(0, splitIndex), photos.slice(splitIndex)];
}

/** The row height that makes its photos, laid out at their own aspect ratio with a fixed gap between them, exactly span `widthMm`. */
function layoutRow(photos: LayoutPhoto[], widthMm: number): PhotoRow {
  if (!photos.length) return { heightMm: 0, photos: [] };

  const sumAspect = photos.reduce((sum, p) => sum + p.aspect, 0);
  const gapsTotal = (photos.length - 1) * ROW_GAP_MM;
  const heightMm = (widthMm - gapsTotal) / sumAspect;

  return {
    heightMm,
    photos: photos.map((p) => ({ url: p.url, widthMm: heightMm * p.aspect })),
  };
}
