import { ATRIUM_POINT_LAUNCHES } from './launches.js';
import { evaluateJourneyReadiness } from './readiness.js';

/**
 * The Atrium doorway's daily invitation.
 *
 * The portal's Atrium entry surfaces one sequence a day so the door
 * itself is alive — the same sequence all day, a new one tomorrow.
 * Only LAUNCHABLE points are ever featured: a doorway must never
 * invite the reader to a sequence still gated behind editorial or
 * specialist review. Readiness evaluation here is metadata-only;
 * payload bytes stay behind the launch seam.
 */

// Knuth multiplicative hash so consecutive days hop around the corpus
// instead of walking it wing by wing
const DAY_MS = 86_400_000;
const HASH = 2_654_435_761;

export function featuredAtriumPoint(date = new Date()) {
  const launchable = ATRIUM_POINT_LAUNCHES.filter(
    point => evaluateJourneyReadiness(point).ready
  );
  if (launchable.length === 0) return null;

  const day = Math.floor(date.getTime() / DAY_MS);
  const index = Math.abs((day * HASH) % launchable.length);
  const point = launchable[index];
  return {
    title: point.title,
    domain: point.domain,
    launchableCount: launchable.length
  };
}
