/**
 * Rules for ratings shared by the server-rendered pages and the explorer.
 */

export interface Rating {
  avg: number;
  count: number;
}

export type RatingMap = Record<string, Rating>;

/**
 * A bottle needs this many ratings before it is ranked or called "top rated".
 * One enthusiastic 10/10 shouldn't outrank a bottle with a hundred ratings.
 */
export const MIN_RATINGS_TO_RANK = 5;

export function isRanked(rating?: Rating | null): rating is Rating {
  return !!rating && rating.count >= MIN_RATINGS_TO_RANK;
}

/** Best first: average, then number of ratings. */
export function byRating(a: Rating, b: Rating): number {
  return b.avg - a.avg || b.count - a.count;
}

/** True when two rating maps hold the same numbers (avoids needless redraws). */
export function sameRatings(a: RatingMap, b: RatingMap): boolean {
  const keys = Object.keys(a);
  if (keys.length !== Object.keys(b).length) return false;
  for (const k of keys) {
    const x = a[k];
    const y = b[k];
    if (!y || x.avg !== y.avg || x.count !== y.count) return false;
  }
  return true;
}
