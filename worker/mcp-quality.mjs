/**
 * The connector's quality count (docs/plans/RISE-CHANGES.md, Quality gates): for a Current the door has admitted,
 * one structured log line of what RISE Changes' figure checks would find in it and how often its picture changes,
 * `{ "event": "rise.quality", "rules": { <rule>: <count> }, "beats", "scenes", "longestHold" }`. It counts and
 * changes nothing: the tool's answer is built without it, and it never throws.
 *
 * The line holds rule ids and counts only, never text, SVG or anything a host wrote; Workers Logs keeps it
 * (wrangler.production.jsonc, observability). `rules` counts at most ten problems a figure, and as `unchecked` each
 * figure left out once the Current's figures pass QUALITY_BYTES of text read or QUALITY_WORK comparisons: reading
 * is linear in a figure's length and comparing its labels is not, and the two bounds keep the count to a few
 * milliseconds whatever a host sends.
 */
import { svgLayoutProblems } from '../src/core/quality/svg-layout.js';
import { pictureCadence } from '../src/core/quality/cadence.js';

/** Figure text one Current may read; a published digest's six figures are about 9,000. */
export const QUALITY_BYTES = 16_384;
/** Comparisons one Current may spend; a published digest's six figures take about 1,300. */
export const QUALITY_WORK = 50_000;

export function qualityRecord(current) {
  const rules = {};
  let bytes = QUALITY_BYTES;
  let work = QUALITY_WORK;
  for (const scene of Array.isArray(current?.scenes) ? current.scenes : []) {
    if (typeof scene?.svg !== 'string') continue;
    if (scene.svg.length > bytes) {
      rules.unchecked = (rules.unchecked ?? 0) + 1;
      continue;
    }
    // Reading is spent whether or not the comparisons fit.
    bytes -= scene.svg.length;
    const verdict = svgLayoutProblems(scene.svg, { maxWork: work });
    if (verdict.work > work) {
      rules.unchecked = (rules.unchecked ?? 0) + 1;
      continue;
    }
    work -= verdict.work;
    for (const { rule } of verdict.problems) rules[rule] = (rules[rule] ?? 0) + 1;
  }
  return { event: 'rise.quality', rules, ...pictureCadence(current) };
}

/** The count, logged; whatever goes wrong in it is let go, because a count is never worth an answer. */
export function logQuality(current, log = console.log) {
  try {
    log(JSON.stringify(qualityRecord(current)));
  } catch {
    // Nothing: the answer has already been built.
  }
}
