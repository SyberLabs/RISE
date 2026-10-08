import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import {
  brierBinary, brierMulticlass, calibration, climatologyBrier, clusterBootstrap,
  eceEqualMass, mulberry32, noiseFloorECE, pairedBootstrapDiff, reliabilityTable, selectiveAgreement, wilson
} from './calibration.mjs';
import { commitment, drawLabels, revealLabels } from './controls.mjs';
import { CHOICES } from '../../src/core/decision/recommend.js';

const close = (actual, expected, tolerance = 1e-9) =>
  assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} is not within ${tolerance} of ${expected}`);

/** n forecasts p ~ U(0,1) with outcomes drawn from p itself: calibrated by construction. */
function calibrated(n, seed) {
  const rand = mulberry32(seed);
  return Array.from({ length: n }, (_, i) => {
    const p = rand();
    return { caseId: `c${i % 50}`, p, y: rand() < p ? 1 : 0 };
  });
}

/** Always 0.98, right 70 times in 100. */
const overconfident = Array.from({ length: 100 }, (_, i) => ({ caseId: `c${i % 20}`, p: 0.98, y: i < 70 ? 1 : 0 }));

test('a calibrated decider shows an ECE inside its own noise floor', () => {
  const rows = calibrated(2000, 7);
  const ece = eceEqualMass(rows);
  const floor = noiseFloorECE(rows, { sims: 500, seed: 3 });
  assert.ok(ece <= floor, `ECE ${ece} exceeds noise floor ${floor}`);
});

test('always 0.98 on a 70% event: known Brier, large ECE far above the floor, negative skill', () => {
  const brier = 0.98 ** 2 * 0.3 + 0.02 ** 2 * 0.7;
  close(brierBinary(overconfident), brier);
  close(eceEqualMass(overconfident), 0.28);
  assert.ok(noiseFloorECE(overconfident, { sims: 500, seed: 1 }) < 0.05);
  close(climatologyBrier(overconfident), 0.21);
  const rows = overconfident.map((r, i) => ({ ...r, providerId: 'x', question: 'audio', choice: 'a',
    probabilities: { a: r.p, b: 1 - r.p }, confidence: r.p, correct: i < 70 }));
  const skill = calibration(rows, { reps: 20, sims: 20 }).x.secondary.probabilities.brierSkill;
  close(skill, 1 - brier / 0.21);
  assert.ok(skill < 0);
});

test('Brier skill is NaN, not infinite, when every outcome is the same', () => {
  const rows = overconfident.map(r => ({ ...r, providerId: 'x', choice: 'a', probabilities: { a: 0.98, b: 0.02 }, correct: true }));
  assert.ok(Number.isNaN(calibration(rows, { reps: 20, sims: 20 }).x.secondary.probabilities.brierSkill));
});

test('multi-class Brier sums over every offered option', () => {
  close(brierMulticlass([{ probabilities: { a: 0.7, b: 0.3 }, label: 'a' }]), 0.18);
  close(brierMulticlass([{ probabilities: { a: 0.5, b: 0.3, c: 0.2 }, label: 'c' }]), 0.25 + 0.09 + 0.64);
  close(brierMulticlass([{ probabilities: { a: 1 }, label: 'z' }]), 2);
});

test('Wilson intervals match published values', () => {
  const at = (k, n) => Object.values(wilson(k, n)).map(x => +x.toFixed(4));
  assert.deepEqual(at(7, 10), [0.3968, 0.8922]);
  assert.deepEqual(at(50, 100), [0.4038, 0.5962]);
  assert.deepEqual(at(0, 10), [0, 0.2775]);
});

test('reliability table bins by stated probability and flags thin bins', () => {
  const table = reliabilityTable(overconfident);
  assert.equal(table.length, 1);
  assert.deepEqual([table[0].lower, table[0].n, table[0].rate, table[0].lowN], [0.9, 100, 0.7, false]);
  assert.equal(reliabilityTable([{ p: 0.15, y: 1 }])[0].lowN, true);
});

test('selective agreement keeps only forecasts at or above each threshold', () => {
  const rows = [{ p: 0.4, y: 0 }, { p: 0.75, y: 1 }, { p: 0.92, y: 1 }, { p: 0.96, y: 0 }];
  assert.deepEqual(selectiveAgreement(rows).map(s => [s.threshold, s.n, s.agreement]),
    [[0.5, 3, 2 / 3], [0.7, 3, 2 / 3], [0.9, 2, 0.5], [0.95, 1, 0]]);
});

test('everything random is deterministic under its seed', () => {
  const rows = calibrated(300, 11);
  assert.deepEqual(calibrated(300, 11), rows);
  assert.equal(noiseFloorECE(rows, { sims: 200, seed: 5 }), noiseFloorECE(rows, { sims: 200, seed: 5 }));
  assert.deepEqual(clusterBootstrap(rows, brierBinary, { reps: 200, seed: 5 }), clusterBootstrap(rows, brierBinary, { reps: 200, seed: 5 }));
  assert.notDeepEqual(clusterBootstrap(rows, brierBinary, { reps: 200, seed: 5 }), clusterBootstrap(rows, brierBinary, { reps: 200, seed: 6 }));
  assert.equal(mulberry32(9)(), mulberry32(9)());
});

test('cluster bootstrap brackets the estimate and is degenerate on constant data', () => {
  const rows = calibrated(500, 2);
  const ci = clusterBootstrap(rows, brierBinary, { reps: 500, seed: 1 });
  assert.ok(ci.lo < ci.estimate && ci.estimate < ci.hi);
  assert.ok(ci.hi - ci.lo < 0.1);
  const flat = clusterBootstrap(overconfident.map(r => ({ ...r, y: 1 })), brierBinary, { reps: 100, seed: 1 });
  close(flat.lo, flat.hi);
});

test('paired difference: identical deciders are within noise, very different ones are not', () => {
  const rows = calibrated(500, 4);
  const same = pairedBootstrapDiff(rows, rows, brierBinary, { reps: 300, seed: 1 });
  assert.equal(same.estimate, 0);
  assert.equal(same.withinNoise, true);
  const worse = rows.map(r => ({ ...r, p: 1 - r.p }));
  const apart = pairedBootstrapDiff(worse, rows, brierBinary, { reps: 300, seed: 1 });
  assert.ok(apart.lo > 0);
  assert.equal(apart.withinNoise, false);
});

test('paired difference fails closed: an undefined interval or fewer than 5 shared cases is within noise', () => {
  const rows = calibrated(500, 4);
  const undefinedStat = pairedBootstrapDiff(rows, rows, () => NaN, { reps: 50, seed: 1 });
  assert.ok(Number.isNaN(undefinedStat.lo));
  assert.equal(undefinedStat.withinNoise, true);
  const few = rows.filter(r => ['c0', 'c1', 'c2', 'c3'].includes(r.caseId));
  const apart = pairedBootstrapDiff(few.map(r => ({ ...r, p: 1 - r.p })), few, brierBinary, { reps: 300, seed: 1 });
  assert.equal(apart.clusters, 4);
  assert.ok(apart.lo > 0);
  assert.equal(apart.withinNoise, true);
});

test('calibration() reports per decider, keeps confidence apart, and counts skipped rows', () => {
  const rows = [
    { caseId: 'a', providerId: 'x', run: 1, question: 'audio', probabilities: { piano: 0.8, silent: 0.2 }, confidence: 0.6, choice: 'piano', correct: true },
    { caseId: 'b', providerId: 'x', run: 1, question: 'audio', probabilities: { piano: 0.9, silent: 0.1 }, confidence: null, choice: 'piano', acceptable: ['silent'] },
    { caseId: 'c', providerId: 'x', run: 1, question: 'pace', probabilities: { '100': 0.5, '150': 0.5 }, confidence: 0.5, choice: '100', acceptable: ['100', '150'], explicit: false },
    { caseId: 'a', providerId: 'y', run: 1, question: 'audio', probabilities: null, confidence: 0.9, choice: 'silent', correct: false }
  ];
  const report = calibration(rows, { reps: 50, sims: 50 });
  close(report.x.primary.estimate, (0.2 ** 2 + 0.9 ** 2) / 2);
  assert.equal(report.x.primary.n, 2);
  assert.equal(report.x.secondary.probabilities.n, 3);
  close(report.x.secondary.probabilities.multiclassBrier.value, 0.81 + 0.81);
  close(report.x.secondary.confidence.brier.estimate, (0.4 ** 2 + 0.5 ** 2) / 2);
  assert.deepEqual(report.x.skipped, { noOutcome: 0, noProbabilities: 0, outOfRangeProbabilities: 0, noConfidence: 1, outOfRangeConfidence: 0 });
  assert.deepEqual(report.y.skipped, { noOutcome: 0, noProbabilities: 1, outOfRangeProbabilities: 0, noConfidence: 0, outOfRangeConfidence: 0 });
  assert.equal(report.y.primary.n, 0);
  close(report.y.secondary.confidence.brier.estimate, 0.81);
});

test('calibration() takes probabilities as an array of {value, probability}', () => {
  const row = { caseId: 'a', providerId: 'x', choice: 'piano', correct: true,
    probabilities: [{ value: 'piano', probability: 0.8 }, { value: 'silent', probability: 0.2 }] };
  close(calibration([row], { reps: 20, sims: 20 }).x.primary.estimate, 0.04);
});

test('calibration() skips, never scores, forecasts outside [0, 1] and rows with no outcome', () => {
  const base = { caseId: 'a', providerId: 'x', choice: 'piano', correct: true };
  const report = calibration([
    { ...base, probabilities: { piano: 0.8, silent: 0.2 }, confidence: 85 },
    { ...base, probabilities: { piano: 80, silent: 20 }, confidence: Infinity },
    { ...base, probabilities: [{ value: 'piano', probability: NaN }], confidence: -0.1 },
    { caseId: 'a', providerId: 'x', probabilities: { piano: 1 }, confidence: 1 }
  ], { reps: 20, sims: 20 });
  assert.deepEqual(report.x.skipped, { noOutcome: 1, noProbabilities: 0, outOfRangeProbabilities: 2, noConfidence: 0, outOfRangeConfidence: 3 });
  assert.equal(report.x.primary.n, 1);
  assert.equal(report.x.secondary.confidence.n, 0);
});

const controls = JSON.parse(readFileSync(new URL('./controls.json', import.meta.url), 'utf8'));

test('controls: about fifty cases over real RISE options, with odds that sum to one', () => {
  assert.equal(controls.cases.length, 50);
  assert.equal(new Set(controls.cases.map(c => c.id)).size, 50);
  for (const c of controls.cases) {
    close(Object.values(c.odds).reduce((s, p) => s + p, 0), 1, 1e-9);
    for (const option of Object.keys(c.odds)) {
      assert.ok(Object.hasOwn(CHOICES[c.field], option), `${c.id}: ${option} is not a ${c.field} choice`);
      assert.ok(c.intent.includes(`'${option}'`), `${c.id} does not state ${option}`);
    }
  }
  for (const pct of [50, 60, 70, 80, 90]) {
    assert.equal(controls.cases.filter(c => Math.max(...Object.values(c.odds)) === pct / 100 && Object.keys(c.odds).length === 2).length, 8);
  }
  assert.equal(controls.cases.filter(c => Object.keys(c.odds).length === 3).length, 10);
});

test('commit-reveal: the commitment is sha256, labels follow the odds and the run file, and a wrong seed is refused', () => {
  const seed = 'f'.repeat(64);
  const runFile = '{"results":[]}\n';
  const digest = createHash('sha256').update(runFile).digest('hex');
  assert.equal(commitment(seed), createHash('sha256').update(seed).digest('hex'));
  const labels = drawLabels(controls.cases, seed, digest);
  assert.deepEqual(drawLabels(controls.cases, seed, digest), labels);
  for (const c of controls.cases) assert.ok(Object.hasOwn(c.odds, labels[c.id]));
  const committed = { ...controls, seedCommitment: commitment(seed) };
  assert.deepEqual(revealLabels(committed, seed, runFile), labels);
  assert.notDeepEqual(revealLabels(committed, seed, runFile + ' '), labels);
  assert.throws(() => revealLabels(committed, 'e'.repeat(64), runFile), /does not match/u);
  assert.throws(() => revealLabels({ ...controls, seedCommitment: null }, seed, runFile), /no seedCommitment/u);
  // Over many cases the draw lands at the stated rate.
  const many = Array.from({ length: 4000 }, (_, i) => ({ id: `k${i}`, odds: { a: 0.7, b: 0.3 } }));
  const rate = Object.values(drawLabels(many, seed, digest)).filter(l => l === 'a').length / many.length;
  assert.ok(Math.abs(rate - 0.7) < 0.03, `draw rate ${rate}`);
});
