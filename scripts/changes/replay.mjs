#!/usr/bin/env node
/**
 * Replay (docs/plans/RISE-CHANGES.md, Claims): collect, fact cards, route and claims over given periods, with a local
 * cache directory, so the claims stage's exit test is one command.
 *
 *   node scripts/changes/replay.mjs --periods <file|builtin> --cache <dir> --out <dir>
 *
 * `builtin` is the seven published periods (src/core/changes/fixtures/replay-set.json); a file is JSON
 * `{ periods: [{ id, from, to }], hiddenCaveats?: [number] }`. Each period's included pull requests are claimed, and so
 * is each hidden-caveat pull request merged in it, included or not, so the caveat check never depends on a route.
 * Routes and claims are read from `<cache>/cache/{routes,claims}/` and each new one is written there, so a second
 * replay with the same cache makes no model call. Writes `report.json` to the out directory, which must be new or
 * empty: per pull request its claims, per period and per run the model calls by role, the input and output bytes, the
 * cache hits, and the caveat check of the hidden-caveat pull requests. Each pull request a stage asks the model about is
 * counted once a stage: in `cachedReCalls` when its cache file was there when the replay started (a cache that did not
 * hold), else in `uncachedRetries` (on a first pass over an empty cache, every pull request asked; on a second, those the
 * first could not cache, whose call failed or admitted nothing). Never commits, pushes or opens an issue.
 */
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseArgs } from 'node:util';
import { collectMergedPulls } from '../../src/core/changes/collect.js';
import { createAsk } from '../../src/core/changes/claude-cli.js';
import { CLAIMS_CACHE_BYTES, DIGEST_ID, FALLBACK_ROUTE, MODEL, REPOSITORY } from '../../src/core/changes/contract.js';
import { factCard } from '../../src/core/changes/facts.js';
import { prefilter } from '../../src/core/changes/prefilter.js';
import { requirePublicRepository } from '../../src/core/changes/repository.js';
import { serialize } from '../../src/core/changes/write.js';
import { claimCards } from './claims.js';
import { customerFor } from './customers.js';
import { outDirectory, runGh, runProcess } from './digest.mjs';
import { cacheReader, routeCandidates, selectChanges } from './route.js';

const BUILTIN = join(dirname(fileURLToPath(import.meta.url)), '..', '..', 'src', 'core', 'changes', 'fixtures', 'replay-set.json');
const ISO = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{1,3})?Z$/;
const ROLES = ['router', 'claims'];

const isPeriod = period => period !== null && typeof period === 'object' && Object.keys(period).length === 3
  && typeof period.id === 'string' && DIGEST_ID.test(period.id)
  && [period.from, period.to].every(at => typeof at === 'string' && ISO.test(at)) && Date.parse(period.from) < Date.parse(period.to);

/** The periods to replay and the hidden-caveat pull requests to check: built in, or a file's (its own list, else the built-in one). */
export async function readPeriods(source) {
  const builtin = JSON.parse(await readFile(BUILTIN, 'utf8'));
  const set = source === 'builtin' ? builtin : JSON.parse(await readFile(resolve(source), 'utf8'));
  if (!Array.isArray(set?.periods) || set.periods.length === 0 || !set.periods.every(isPeriod)) {
    throw new Error('--periods: each period is { id, from, to }, a digest id and two ISO times with from before to');
  }
  const hidden = set.hiddenCaveats ?? builtin.hiddenCaveats;
  if (!Array.isArray(hidden) || !hidden.every(number => Number.isInteger(number) && number > 0)) throw new Error('--periods: hiddenCaveats is a list of pull request numbers');
  return { periods: set.periods.map(({ id, from, to }) => ({ id, from, to })), hidden };
}

/** `ask` counted by role: calls, the request's bytes (system and prompt) and the answer's. */
function meter(ask) {
  const zero = () => Object.fromEntries(ROLES.map(role => [role, 0]));
  const counts = { calls: zero(), inputBytes: zero(), outputBytes: zero() };
  const as = role => async request => {
    counts.calls[role] += 1;
    counts.inputBytes[role] += Buffer.byteLength(request.system) + Buffer.byteLength(request.prompt);
    const answer = await ask(request);
    counts.outputBytes[role] += Buffer.byteLength(String(answer));
    return answer;
  };
  const snapshot = () => structuredClone(counts);
  return { as, snapshot };
}

async function writeCache(dir, files) {
  for (const [path, text] of Object.entries(files)) {
    await mkdir(dirname(join(dir, path)), { recursive: true });
    await writeFile(join(dir, path), text, 'utf8');
  }
}

/** The merge SHAs a cache directory holds a file for, read once when the replay starts. */
async function filed(cacheDir, directory) {
  try {
    return new Set((await readdir(join(cacheDir, 'cache', directory))).filter(name => /^[0-9a-f]{40}\.json$/.test(name)).map(name => name.slice(0, 40)));
  } catch {
    return new Set();
  }
}

const plural = (count, one, many = `${one}s`) => `${count} ${count === 1 ? one : many}`;
const minus = (after, before) => Object.fromEntries(ROLES.map(role => [role, after[role] - before[role]]));

/** One replay over `periods` with the cache under `cacheDir`; the report. */
export async function replay({ gh, ask, periods, hidden, cacheDir, model = MODEL, repo = REPOSITORY, now = new Date(), log }) {
  await requirePublicRepository(gh, repo);
  const metered = meter(ask);
  const readRoute = cacheReader(cacheDir);
  const readClaims = cacheReader(cacheDir, { directory: 'claims', bytes: CLAIMS_CACHE_BYTES });
  const hits = { routes: 0, claims: 0 };
  const started = { routes: await filed(cacheDir, 'routes'), claims: await filed(cacheDir, 'claims') };
  let cachedReCalls = 0;
  let uncachedRetries = 0;
  const asked = (directory, mergeShas) => {
    for (const mergeSha of mergeShas) {
      if (started[directory].has(mergeSha)) cachedReCalls += 1;
      else uncachedRetries += 1;
    }
  };
  const pulls = {};
  const report = { repo, model, periods: [] };
  for (const period of periods) {
    log(`Period ${period.id}: ${period.from} to ${period.to}`);
    const before = metered.snapshot();
    const merged = await collectMergedPulls(gh, { repo, from: period.from, to: period.to });
    const { records, candidates } = prefilter(merged);
    const cards = candidates.map(factCard);
    const { routes, cache: routeFiles, fromCache } = await routeCandidates({ cards, ask: metered.as('router'), model, product: customerFor(repo)?.product, readCached: readRoute, now, log });
    await writeCache(cacheDir, routeFiles);
    asked('routes', cards.filter(card => !fromCache.includes(card.number)).map(card => card.mergeSha));
    const unrouted = [...routes.values()].filter(route => route === FALLBACK_ROUTE).length;
    hits.routes += cards.length - Object.keys(routeFiles).length - unrouted;
    const { changes } = selectChanges({ candidates, records, routes });
    const included = changes.filter(change => change.included).map(change => change.number);
    const claimed = cards.filter(card => included.includes(card.number) || hidden.includes(card.number));
    const { results, cache: claimFiles } = await claimCards({ cards: claimed, ask: metered.as('claims'), model, repo, readCached: readClaims, now, log });
    await writeCache(cacheDir, claimFiles);
    hits.claims += results.filter(result => result.fromCache).length;
    asked('claims', results.filter(result => !result.fromCache).map(result => result.mergeSha));
    for (const result of results) {
      const { number, ...rest } = result;
      const seen = pulls[number];
      pulls[number] = seen
        ? { ...seen, periods: [...seen.periods, period.id], included: seen.included || included.includes(number) }
        : { periods: [period.id], included: included.includes(number), ...rest };
      log(`  #${number}${included.includes(number) ? '' : ' (not included; a hidden caveat)'}: ${plural(result.claims.length, 'claim')}${result.fromCache ? ' from the cache' : ''}${result.gap ? ', a caveat gap' : ''}`);
      for (const claim of result.claims) log(`    [${claim.status}/${claim.kind}] ${claim.text} (${claim.span.field}${claim.span.index === undefined ? '' : ` ${claim.span.index}`} ${claim.span.start}-${claim.span.end})`);
    }
    const after = metered.snapshot();
    report.periods.push({ ...period, merged: merged.length, candidates: candidates.length, included, claimed: claimed.map(card => card.number), calls: minus(after.calls, before.calls) });
  }
  const { calls, inputBytes, outputBytes } = metered.snapshot();
  const hiddenCaveats = hidden.map(number => {
    const pull = pulls[number];
    if (!pull) return { number, found: false };
    const caveat = pull.claims.filter(claim => claim.status === 'pending' || claim.status === 'flagged').length;
    return { number, found: true, included: pull.included, pendingOrFlagged: caveat, sections: pull.caveats.length, covered: pull.caveats.length > 0 && !pull.gap };
  });
  log(`Replay: ${plural(calls.router, 'router call')}, ${plural(calls.claims, 'claims call')}; ${hits.routes} routes and ${hits.claims} claims from the cache`);
  log(`Pull requests asked although their cache file was there: ${cachedReCalls}; asked with none there: ${uncachedRetries}`);
  log(`Bytes: router ${inputBytes.router} in, ${outputBytes.router} out; claims ${inputBytes.claims} in, ${outputBytes.claims} out`);
  for (const entry of hiddenCaveats) {
    log(`Hidden caveat #${entry.number}: ${entry.found ? `${entry.covered ? 'quoted' : 'NOT quoted'} by ${plural(entry.pendingOrFlagged, 'pending or flagged claim')}${entry.included ? '' : ' (not included)'}` : 'not merged in any period replayed'}`);
  }
  return { ...report, calls: { ...calls, total: calls.router + calls.claims }, cachedReCalls, uncachedRetries, inputBytes, outputBytes, cacheHits: hits, hiddenCaveats, pulls };
}

export async function main(argv, { env = process.env, log = line => console.log(line), gh = runGh, ask } = {}) {
  const { values } = parseArgs({ args: argv, options: { periods: { type: 'string' }, cache: { type: 'string' }, out: { type: 'string' } }, strict: true, allowPositionals: false });
  if (!values.periods || !values.cache || !values.out) throw new Error('replay needs --periods <file|builtin>, --cache <dir> and --out <dir>');
  const { periods, hidden } = await readPeriods(values.periods);
  const out = await outDirectory(values.out);
  const cacheDir = resolve(values.cache);
  await mkdir(cacheDir, { recursive: true });
  const report = await replay({ gh, ask: ask ?? createAsk({ run: runProcess, env, log }), periods, hidden, cacheDir, log });
  await writeFile(join(out, 'report.json'), serialize(report), 'utf8');
  log(`Wrote report.json to ${out}: ${report.calls.total} model calls.`);
  return report;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`RISE Changes replay failed: ${error.message}`);
    process.exitCode = 1;
  });
}
