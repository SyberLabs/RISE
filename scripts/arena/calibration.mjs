/**
 * Calibration scoring for the Decision Arena. Pure functions: no I/O, no
 * dependencies, and every random draw comes from a seeded generator, so the
 * same rows and seed always give the same report.
 *
 * Two row shapes:
 * - Arena rows (the contract with scripts/arena/arena.mjs), one per
 *   case × decider × run × question:
 *     { caseId, providerId, run, question,
 *       probabilities: {[option]: p} | [{ value, probability }] | null,
 *       confidence: number | null, choice, correct: boolean | acceptable: string[],
 *       explicit?: boolean }
 *   Every probability and confidence must lie in [0, 1]; a row with one
 *   outside it (percent scale, say) is counted in `skipped`, never scored.
 * - Forecast rows, which the metric functions take: { p, y, caseId }, where
 *   p is the stated probability that the decider's choice is right and y is
 *   1 when it was. `calibration()` turns arena rows into forecast rows twice:
 *   once from `probabilities[choice]`, once from `confidence`. The two are
 *   never mixed.
 */

const Z95 = 1.959963984540054;

/** Seeded 32-bit generator. */
export function mulberry32(seed = 0) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const mean = (xs) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Linear-interpolated quantile of an unsorted array. */
function quantile(xs, q) {
  const s = [...xs].sort((a, b) => a - b);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  return s[lo] + (s[Math.ceil(i)] - s[lo]) * (i - lo);
}

/** Mean squared error of p against the 0/1 outcome y. */
export function brierBinary(rows) {
  return rows.length ? mean(rows.map(r => (r.p - r.y) ** 2)) : NaN;
}

/**
 * Multi-class Brier over rows { probabilities, label }: the sum over offered
 * options of (p − [option is the label])². Ranges 0 to 2.
 */
export function brierMulticlass(rows) {
  if (!rows.length) return NaN;
  return mean(rows.map(({ probabilities, label }) => {
    let sum = Object.hasOwn(probabilities, label) ? 0 : 1;
    for (const [option, p] of Object.entries(probabilities)) sum += (p - (option === label ? 1 : 0)) ** 2;
    return sum;
  }));
}

/** Brier of always forecasting the observed rate: the no-skill baseline. */
export function climatologyBrier(rows) {
  const rate = mean(rows.map(r => r.y));
  return rate * (1 - rate);
}

/**
 * Sort by p and cut into at most `bins` groups of near-equal size. Equal
 * forecasts never straddle a cut: otherwise row order alone would split
 * them and change the ECE.
 */
function equalMassBins(rows, bins) {
  const sorted = [...rows].sort((a, b) => a.p - b.p);
  const groups = [];
  let start = 0;
  for (let b = 1; b <= bins && start < sorted.length; b++) {
    let end = Math.max(start + 1, Math.floor(b * sorted.length / bins));
    while (end < sorted.length && sorted[end].p === sorted[end - 1].p) end++;
    groups.push(sorted.slice(start, end));
    start = end;
  }
  return groups;
}

/** Expected calibration error with equal-mass bins. */
export function eceEqualMass(rows, bins = 10) {
  if (!rows.length) return NaN;
  return equalMassBins(rows, bins).reduce((sum, bin) =>
    sum + bin.length / rows.length * Math.abs(mean(bin.map(r => r.p)) - mean(bin.map(r => r.y))), 0);
}

/**
 * The ECE a perfectly calibrated decider would still show on these exact
 * forecasts, from finite samples alone: draw y ~ Bernoulli(p) for every row,
 * `sims` times, and return the 95th percentile. An observed ECE below it is
 * indistinguishable from noise.
 */
export function noiseFloorECE(rows, { sims = 2000, seed = 1, bins = 10 } = {}) {
  const rand = mulberry32(seed);
  const eces = [];
  for (let s = 0; s < sims; s++) eces.push(eceEqualMass(rows.map(r => ({ p: r.p, y: rand() < r.p ? 1 : 0 })), bins));
  return quantile(eces, 0.95);
}

/** 95% Wilson score interval for k successes in n trials. */
export function wilson(k, n) {
  const z = Z95;
  if (!n) return { lo: NaN, hi: NaN };
  const phat = k / n;
  const denom = 1 + z * z / n;
  const centre = (phat + z * z / (2 * n)) / denom;
  const half = z * Math.sqrt(phat * (1 - phat) / n + z * z / (4 * n * n)) / denom;
  return { lo: Math.max(0, centre - half), hi: Math.min(1, centre + half) };
}

/**
 * Equal-width reliability table for a diagram. Only non-empty bins are
 * listed; a bin with fewer than 15 rows is flagged `lowN`.
 */
export function reliabilityTable(rows, bins = 10) {
  const groups = Array.from({ length: bins }, () => []);
  for (const r of rows) groups[Math.min(bins - 1, Math.floor(r.p * bins))].push(r);
  return groups.flatMap((bin, b) => {
    if (!bin.length) return [];
    const k = bin.reduce((s, r) => s + r.y, 0);
    return [{ lower: b / bins, upper: (b + 1) / bins, n: bin.length, meanP: mean(bin.map(r => r.p)),
      rate: k / bin.length, ...wilson(k, bin.length), lowN: bin.length < 15 }];
  });
}

/** Agreement among rows whose forecast is at or above each threshold. */
export function selectiveAgreement(rows) {
  return [0.5, 0.7, 0.9, 0.95].map(threshold => {
    const kept = rows.filter(r => r.p >= threshold);
    return { threshold, n: kept.length, coverage: rows.length ? kept.length / rows.length : NaN,
      agreement: kept.length ? mean(kept.map(r => r.y)) : NaN };
  });
}

function groupBy(rows, key) {
  const groups = new Map();
  for (const r of rows) {
    if (!groups.has(r[key])) groups.set(r[key], []);
    groups.get(r[key]).push(r);
  }
  return groups;
}

function interval(estimate, stats) {
  const finite = stats.filter(Number.isFinite);
  return { estimate, lo: quantile(finite, 0.025), hi: quantile(finite, 0.975), reps: finite.length };
}

/**
 * Percentile bootstrap that resamples whole clusters (cases), because runs
 * and questions of one case are not independent.
 */
export function clusterBootstrap(rows, statFn, { reps = 2000, seed = 1 } = {}) {
  const clusters = [...groupBy(rows, 'caseId').values()];
  const rand = mulberry32(seed);
  const stats = [];
  for (let i = 0; i < reps; i++) {
    stats.push(statFn(clusters.flatMap(() => clusters[Math.floor(rand() * clusters.length)])));
  }
  return interval(statFn(rows), stats);
}

/**
 * Bootstrap of stat(A) − stat(B), resampling the clusters both share, so
 * the two deciders are always compared on the same cases. `withinNoise` is
 * true, and no ranking may then be stated, when the 95% interval includes 0,
 * when it is undefined (NaN), or when fewer than 5 cases are shared.
 */
export function pairedBootstrapDiff(rowsA, rowsB, statFn, { reps = 2000, seed = 1 } = {}) {
  const a = groupBy(rowsA, 'caseId');
  const b = groupBy(rowsB, 'caseId');
  const ids = [...a.keys()].filter(id => b.has(id));
  const pick = (groups, chosen) => chosen.flatMap(id => groups.get(id));
  const rand = mulberry32(seed);
  const stats = [];
  for (let i = 0; i < reps; i++) {
    const chosen = ids.map(() => ids[Math.floor(rand() * ids.length)]);
    stats.push(statFn(pick(a, chosen)) - statFn(pick(b, chosen)));
  }
  const result = interval(statFn(pick(a, ids)) - statFn(pick(b, ids)), stats);
  return { ...result, clusters: ids.length, withinNoise: !(result.lo > 0 || result.hi < 0) || ids.length < 5 };
}

/** 1 when the arena row's choice is right, from `correct` or `acceptable`. */
function outcome(row) {
  return (typeof row.correct === 'boolean' ? row.correct : row.acceptable.includes(row.choice)) ? 1 : 0;
}

const inUnit = (p) => Number.isFinite(p) && p >= 0 && p <= 1;

/** A row's probabilities as an {option: p} map, from either accepted form. */
const probabilityMap = (probabilities) => Array.isArray(probabilities)
  ? Object.fromEntries(probabilities.map(({ value, probability }) => [value, probability]))
  : probabilities;

/** Every metric for one set of forecast rows. */
function summarize(rows, { seed, reps, sims, bins }) {
  if (!rows.length) return { n: 0 };
  const baseline = climatologyBrier(rows);
  return {
    n: rows.length,
    cases: groupBy(rows, 'caseId').size,
    brier: clusterBootstrap(rows, brierBinary, { reps, seed }),
    // 1 − Brier/baseline; undefined when every outcome is the same.
    brierSkill: baseline === 0 ? NaN : 1 - brierBinary(rows) / baseline,
    ece: eceEqualMass(rows, bins),
    eceNoiseFloor: noiseFloorECE(rows, { sims, seed, bins }),
    reliability: reliabilityTable(rows, bins),
    selective: selectiveAgreement(rows)
  };
}

/**
 * The calibration report, per decider (providerId).
 *
 * primary — fixed in advance: binary Brier of probabilities[choice] on the
 * explicit-constraint rows (every row unless it says `explicit: false`).
 * secondary.probabilities — every metric from the per-option probabilities,
 * plus multi-class Brier on rows whose answer is a single known option.
 * secondary.confidence — the same metrics from the separate `confidence`.
 * skipped — rows with no outcome (no choice, or neither `correct` nor
 * `acceptable`), and rows whose probabilities or confidence were missing or
 * outside [0, 1].
 */
export function calibration(rows, { seed = 1, reps = 2000, sims = 2000, bins = 10 } = {}) {
  const opts = { seed, reps, sims, bins };
  const report = {};
  for (const [providerId, mine] of groupBy(rows, 'providerId')) {
    const scorable = mine.filter(r => r.choice != null && (typeof r.correct === 'boolean' || Array.isArray(r.acceptable)))
      .map(r => ({ ...r, probabilities: probabilityMap(r.probabilities) }));
    const withP = scorable.filter(r => r.probabilities && Object.values(r.probabilities).every(inUnit));
    const fromP = withP.map(r => ({ caseId: r.caseId, p: r.probabilities[r.choice] ?? 0, y: outcome(r), explicit: r.explicit !== false }));
    const withConfidence = scorable.filter(r => inUnit(r.confidence));
    const fromConfidence = withConfidence.map(r => ({ caseId: r.caseId, p: r.confidence, y: outcome(r) }));
    const single = withP.filter(r => typeof r.correct !== 'boolean' && r.acceptable.length === 1)
      .map(r => ({ probabilities: r.probabilities, label: r.acceptable[0] }));
    const noP = scorable.filter(r => !r.probabilities).length;
    const noConfidence = scorable.filter(r => r.confidence == null).length;
    const primary = fromP.filter(r => r.explicit);
    report[providerId] = {
      primary: primary.length
        ? { metric: 'binary Brier, explicit-constraint fields', n: primary.length, ...clusterBootstrap(primary, brierBinary, { reps, seed }) }
        : { metric: 'binary Brier, explicit-constraint fields', n: 0 },
      secondary: {
        probabilities: { ...summarize(fromP, opts), multiclassBrier: { n: single.length, value: brierMulticlass(single) } },
        confidence: summarize(fromConfidence, opts)
      },
      skipped: { noOutcome: mine.length - scorable.length,
        noProbabilities: noP, outOfRangeProbabilities: scorable.length - noP - withP.length,
        noConfidence, outOfRangeConfidence: scorable.length - noConfidence - withConfidence.length }
    };
  }
  return report;
}
