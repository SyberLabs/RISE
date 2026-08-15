/**
 * Ostensoria void-coverage probe.
 *
 * Generates a large seeded sample of Iris Plates (Chamber draft quality,
 * same form/palette seed as live flashes) and reports how much of the
 * field is empty. Sparse plates (void ≥ 95%) are generated twice more
 * from the same seed to see whether emptiness is a stable property of
 * the seed or a one-off.
 *
 * Does not preload or reject plates. Read the report before deciding
 * whether a fractal-style queue filter is the right next step.
 *
 *   node scripts/probe-ostensoria-coverage.mjs
 *   node scripts/probe-ostensoria-coverage.mjs --count 160 --out out/ostensoria-coverage
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Ostensoria } from '../src/visuals/ostensoria.js';
import {
  VOID_FRACTION_LIMIT,
  histogram,
  measureFieldVoid
} from '../src/visuals/ostensoria-coverage.js';

const ROOT = dirname(fileURLToPath(import.meta.url));
const SEED_WORDS = [
  'CRISTO', 'REX', 'LUX', 'VERBUM', 'ROSA', 'STELLA', 'AVE', 'SPES', 'VIA',
  'CORPUS', 'IGNIS', 'AURORA', 'NOX', 'EIDOLON', 'SIGNUM', 'VELUM', 'ARCA', 'SOL'
];

function arg(name, fallback = null) {
  const index = process.argv.indexOf(name);
  if (index === -1) return fallback;
  if (process.argv[index + 1] == null || process.argv[index + 1].startsWith('--')) return true;
  return process.argv[index + 1];
}

function xmur3(str) {
  let h = 1779033703 ^ str.length;
  for (let i = 0; i < str.length; i++) {
    h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
    h = h << 13 | h >>> 19;
  }
  return function () {
    h = Math.imul(h ^ h >>> 16, 2246822507);
    h = Math.imul(h ^ h >>> 13, 3266489909);
    h ^= h >>> 16;
    return h >>> 0;
  };
}

function mulberry32(a) {
  return function () {
    a |= 0;
    a = a + 0x6D2B79F5 | 0;
    let t = Math.imul(a ^ a >>> 15, 1 | a);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function makeSeeds(count, master) {
  const sr = mulberry32(xmur3(master)());
  const seeds = [];
  for (let i = 0; i < count; i++) {
    seeds.push(`${SEED_WORDS[(sr() * SEED_WORDS.length) | 0]}-${Math.floor(sr() * 9000 + 1000)}`);
  }
  return seeds;
}

function plateRecord(engine, coverage) {
  const cur = engine.cur || {};
  return {
    seed: cur.seed,
    family: cur.family,
    kind: cur.kind,
    order: cur.order,
    mirror: cur.mirror,
    palette: cur.palette,
    coeff: cur.coeff,
    fMax: engine.fMax,
    ...coverage
  };
}

function generate(seed) {
  const engine = new Ostensoria();
  // Keep blanks: this probe measures the raw attractor, not the retry filter.
  engine.generate(null, seed, { acceptSparse: true });
  const coverage = measureFieldVoid(engine.fieldDev, engine.fMax);
  return { engine, record: plateRecord(engine, coverage) };
}

function samePlate(a, b) {
  return a.family === b.family
    && a.kind === b.kind
    && a.order === b.order
    && a.mirror === b.mirror
    && a.palette === b.palette
    && JSON.stringify(a.coeff) === JSON.stringify(b.coeff)
    && a.voidFraction === b.voidFraction
    && a.inked === b.inked;
}

const count = Math.max(1, Number(arg('--count', '120')) || 120);
const threshold = Number(arg('--threshold', String(VOID_FRACTION_LIMIT))) || VOID_FRACTION_LIMIT;
const master = String(arg('--master', 'coverage-v1'));
const outRoot = resolve(arg('--out', join(ROOT, '..', 'out', 'ostensoria-coverage')));

const seeds = makeSeeds(count, master);
const rows = [];
console.log(`Ostensoria coverage probe · ${count} seeds · master ${master}`);
console.log(`sparse if void ≥ ${(threshold * 100).toFixed(0)}% of the field\n`);

for (let i = 0; i < seeds.length; i++) {
  const { record } = generate(seeds[i]);
  rows.push(record);
  const mark = record.voidFraction >= threshold ? ' SPARSE' : '';
  console.log(
    `[${String(i + 1).padStart(3)}/${count}] ${record.seed.padEnd(14)} `
    + `void ${(record.voidFraction * 100).toFixed(2)}%  `
    + `D${record.order}${record.mirror ? '·m' : '   '}  `
    + `${String(record.kind).padEnd(8)}  ${record.palette}${mark}`
  );
}

const voids = rows.map(row => row.voidFraction);
const hist = histogram(voids);
const sparse = rows.filter(row => row.voidFraction >= threshold)
  .sort((a, b) => b.voidFraction - a.voidFraction);
const mean = voids.reduce((s, v) => s + v, 0) / voids.length;
const sorted = [...voids].sort((a, b) => a - b);
const median = sorted[(sorted.length / 2) | 0];

console.log('\nVoid-fraction distribution');
for (let i = 0; i < hist.labels.length; i++) {
  const n = hist.counts[i];
  if (!n) continue;
  const bar = '█'.repeat(Math.max(1, Math.round((n / count) * 40)));
  console.log(`  ${hist.labels[i].padEnd(10)} ${String(n).padStart(3)}  ${bar}`);
}
console.log(`\nmean ${(mean * 100).toFixed(2)}%   median ${(median * 100).toFixed(2)}%   `
  + `sparse ${sparse.length}/${count} (${((sparse.length / count) * 100).toFixed(1)}%)`);

const reproductions = [];
if (sparse.length) {
  console.log(`\nReproducing ${sparse.length} sparse seed(s) twice…`);
  for (const row of sparse) {
    const again = generate(row.seed).record;
    const third = generate(row.seed).record;
    const match = samePlate(row, again) && samePlate(row, third);
    reproductions.push({
      seed: row.seed,
      voidFraction: row.voidFraction,
      kind: row.kind,
      order: row.order,
      mirror: row.mirror,
      palette: row.palette,
      match,
      second: { voidFraction: again.voidFraction, kind: again.kind, order: again.order },
      third: { voidFraction: third.voidFraction, kind: third.kind, order: third.order }
    });
    console.log(
      `  ${row.seed.padEnd(14)} ${(row.voidFraction * 100).toFixed(2)}%  `
      + `${match ? 'exact match' : 'DRIFT'}`
    );
  }
} else {
  console.log('\nNo sparse plates in this sample.');
}

const byKind = {};
for (const row of rows) {
  const key = row.kind;
  if (!byKind[key]) byKind[key] = { n: 0, sparse: 0, voidSum: 0 };
  byKind[key].n++;
  byKind[key].voidSum += row.voidFraction;
  if (row.voidFraction >= threshold) byKind[key].sparse++;
}

console.log('\nBy attractor family');
for (const [kind, stats] of Object.entries(byKind)) {
  console.log(
    `  ${kind.padEnd(8)} n=${stats.n}  mean void ${((stats.voidSum / stats.n) * 100).toFixed(1)}%  `
    + `sparse ${stats.sparse}`
  );
}

mkdirSync(outRoot, { recursive: true });
const report = {
  master,
  count,
  threshold,
  mean,
  median,
  sparseCount: sparse.length,
  histogram: hist,
  byKind,
  sparse,
  reproductions,
  rows
};
const reportPath = join(outRoot, 'report.json');
writeFileSync(reportPath, JSON.stringify(report, null, 2));
console.log(`\nWrote ${reportPath}`);
