// Bounded synthetic RISE Worker replay. Captures decisions only; no intents, keys or request IDs in output.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { scoreDecisions } from '../../scripts/jev-eval.mjs';

const DEADLINE_MS = 8000;
const MAX_BATCH = 16;
const KEV_SHA = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101';

function fail(message) { throw new Error(message); }
function argument(args, flag) {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}
function digest(value) { return createHash('sha256').update(value).digest('hex'); }

export function stagingOrigin(value) {
  let url;
  try { url = new URL(value); } catch { fail('Set an explicit HTTPS staging Worker origin.'); }
  const host = url.hostname.toLowerCase();
  if (url.protocol !== 'https:' || url.origin !== value || url.username || url.password
    || host === 'rise.syberlabs.io' || host.endsWith('.syberlabs.io')
    || !/(?:staging|preview|\.workers\.dev$|\.pages\.dev$)/u.test(host)) {
    fail('Origin must be a non-production HTTPS staging Worker origin with no path.');
  }
  return url.origin;
}

async function fixtures(casesPath, optionsPath) {
  if (!casesPath || !optionsPath) fail('Both --cases and --options are required.');
  const [casesText, optionsText] = await Promise.all([
    readFile(casesPath, 'utf8'), readFile(optionsPath, 'utf8')
  ]);
  const cases = JSON.parse(casesText);
  const options = JSON.parse(optionsText);
  if (!Array.isArray(cases) || !cases.length || cases.length > 64
    || cases.some(item => typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/u.test(item.id)
      || typeof item.intent !== 'string'
      || item.intent.length < 3 || item.intent.length > 240)
    || new Set(cases.map(item => item.id)).size !== cases.length
    || !options || Array.isArray(options) || typeof options !== 'object'
    || Object.values(options).some(value => !Array.isArray(value) || !value.length)) {
    fail('Invalid bounded RISE cases or offered-choice snapshot.');
  }
  return { cases, options, casesHash: digest(casesText), optionsHash: digest(optionsText) };
}

function identity(result, selected) {
  const model = result?.model;
  if (selected === 'kev') {
    if (result?.provider !== 'Kev' || model !== 'kev-latest' || result.revision !== KEV_SHA) {
      fail('Staging Worker did not return the pinned Kev identity.');
    }
    return { provider: 'kev', model, revision: result.revision };
  }
  if (!/^typesafe\/jev-1\.13(?:-\d{8})?$/u.test(model || '') || result?.provider === 'Kev') {
    fail('Staging Worker did not return a Jev baseline identity.');
  }
  // Jev exposes a served model label, not an immutable checkpoint SHA.
  return { provider: 'jev', model, revision: model };
}

export function compareRuns(cases, options, baseline, candidate, casesHash, optionsHash) {
  if (stagingOrigin(baseline?.origin) !== stagingOrigin(candidate?.origin)) {
    fail('Baseline and candidate must use the same staging Worker origin.');
  }
  for (const [name, run] of [['baseline', baseline], ['candidate', candidate]]) {
    if (run?.casesHash !== casesHash || run?.optionsHash !== optionsHash
      || !run.identity?.provider || !run.identity?.model || !run.identity?.revision
      || !Array.isArray(run.rows) || run.rows.length !== cases.length
      || new Set(run.rows.map(row => row.id)).size !== cases.length
      || run.rows.some(row => !Number.isFinite(row.wallMs) || row.wallMs < 0
        || row.httpStatus !== 200 || row.schemaVersion !== 2
        || row.decisionCacheStatus !== 'miss')) {
      fail(`${name} lacks matching complete measured decisions, identity, or uncached timing.`);
    }
  }
  if (baseline.identity.provider !== 'jev'
    || !/^typesafe\/jev-1\.13(?:-\d{8})?$/u.test(baseline.identity.model)
    || baseline.identity.revision !== baseline.identity.model) {
    fail('Baseline must identify the measured Jev model.');
  }
  if (candidate.identity.provider !== 'kev' || candidate.identity.model !== 'kev-latest'
    || candidate.identity.revision !== KEV_SHA) fail('Candidate must identify the pinned Kev revision.');
  const baseScore = scoreDecisions(cases, baseline.rows, options);
  const kevScore = scoreDecisions(cases, candidate.rows, options);
  const maxMs = Math.max(...candidate.rows.map(row => row.wallMs));
  const gates = {
    allCasesReturned: kevScore.returned === cases.length,
    zeroInvalidAcceptedChoices: kevScore.invalid === 0,
    explicitAtLeastBaseline: kevScore.explicit.total === baseScore.explicit.total
      && kevScore.explicit.passed >= baseScore.explicit.passed,
    contrastAtLeastBaseline: kevScore.contrast.total === baseScore.contrast.total
      && kevScore.contrast.passed >= baseScore.contrast.passed,
    withinWorkerDeadline: maxMs <= DEADLINE_MS,
  };
  return {
    baselineIdentity: baseline.identity, candidateIdentity: candidate.identity,
    baseline: { returned: baseScore.returned, invalid: baseScore.invalid,
      explicit: baseScore.explicit, contrast: baseScore.contrast },
    candidate: { returned: kevScore.returned, invalid: kevScore.invalid,
      explicit: kevScore.explicit, contrast: kevScore.contrast, maxWallMs: maxMs },
    gates, passed: Object.values(gates).every(Boolean),
  };
}

export async function captureCase(origin, selected, item, options, observedIdentity, fetchImpl = fetch) {
  const started = performance.now();
  try {
    const response = await fetchImpl(`${origin}/api/jev-recommend`, {
      method: 'POST',
      headers: { Origin: origin, 'Content-Type': 'application/json' },
      body: JSON.stringify({ intent: item.intent, schemaVersion: 2 }),
      redirect: 'error',
      signal: AbortSignal.timeout(15000),
    });
    if (response.status !== 200) {
      return { row: { id: item.id, httpStatus: response.status,
        wallMs: Math.round(performance.now() - started) }, identity: observedIdentity };
    }
    const result = await response.json();
    const wallMs = Math.round(performance.now() - started); // includes complete response body
    const nextIdentity = identity(result, selected);
    if (observedIdentity && JSON.stringify(observedIdentity) !== JSON.stringify(nextIdentity)) {
      fail('Provider identity changed within the capture.');
    }
    const config = result.config;
    const decision = config && Object.fromEntries(Object.entries(options).map(([field, allowed]) => {
      const selectedValue = field === 'pace' ? String(config.wpm) : config[field];
      return [field, allowed.includes(selectedValue) ? selectedValue : null];
    }));
    return { identity: nextIdentity, row: {
      id: item.id, httpStatus: 200, wallMs,
      schemaVersion: result.schemaVersion === 2 ? 2 : null,
      decisionCacheStatus: ['miss', 'hit'].includes(result.decisionCacheStatus)
        ? result.decisionCacheStatus : null,
      decision,
    } };
  } catch (error) {
    return { identity: observedIdentity, row: { id: item.id, httpStatus: 0,
      wallMs: Math.round(performance.now() - started),
      error: error?.name === 'TimeoutError' ? 'timeout' : 'request failure' } };
  }
}

async function capture(args) {
  const origin = stagingOrigin(argument(args, '--origin'));
  const selected = argument(args, '--provider');
  const outputPath = argument(args, '--output');
  const start = Number(argument(args, '--start'));
  const count = Number(argument(args, '--count'));
  if (!['jev', 'kev'].includes(selected) || !outputPath
    || !Number.isInteger(start) || start < 0 || !Number.isInteger(count)
    || count < 1 || count > MAX_BATCH) fail('Set --provider jev|kev, --output, --start and --count (1..16).');
  const { cases, options, casesHash, optionsHash } = await fixtures(
    argument(args, '--cases'), argument(args, '--options')
  );
  if (start + count > cases.length) fail('Batch exceeds the fixed case list.');
  let saved;
  try { saved = JSON.parse(await readFile(outputPath, 'utf8')); }
  catch (error) { if (error.code !== 'ENOENT') throw error; }
  if (saved && (saved.origin !== origin || saved.casesHash !== casesHash
    || saved.optionsHash !== optionsHash || saved.identity?.provider !== selected)) {
    fail('Existing output has a different origin, fixture, or provider. Use a new output path.');
  }
  const rows = saved?.rows || [];
  if (cases.slice(start, start + count).some(item => rows.some(row => row.id === item.id))) {
    fail('Batch has already been recorded. Use a new output path for a repeat.');
  }
  let observedIdentity = saved?.identity;
  for (const item of cases.slice(start, start + count)) {
    const { row, identity: nextIdentity } = await captureCase(origin, selected, item, options, observedIdentity);
    observedIdentity = nextIdentity;
    rows.push(row);
  }
  if (!observedIdentity) fail('No provider identity was observed; capture is unusable.');
  await writeFile(outputPath, `${JSON.stringify({ origin, identity: observedIdentity || null,
    casesHash, optionsHash, rows }, null, 2)}\n`, { flag: saved ? 'w' : 'wx' });
  console.log(`Captured ${count} ${selected} staging cases; ${rows.length}/${cases.length} total. No raw intents recorded.`);
}

async function compare(args) {
  const { cases, options, casesHash, optionsHash } = await fixtures(
    argument(args, '--cases'), argument(args, '--options')
  );
  const baselinePath = argument(args, '--baseline');
  const candidatePath = argument(args, '--candidate');
  if (!baselinePath || !candidatePath) fail('Set --baseline and --candidate measured staging captures.');
  const [baseline, candidate] = await Promise.all([
    readFile(baselinePath, 'utf8').then(JSON.parse),
    readFile(candidatePath, 'utf8').then(JSON.parse),
  ]);
  const result = compareRuns(cases, options, baseline, candidate, casesHash, optionsHash);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [mode, ...args] = process.argv.slice(2);
  try {
    if (mode === 'capture') await capture(args);
    else if (mode === 'compare') await compare(args);
    else fail('Usage: staging-eval.mjs capture|compare [flags]; see docs/KEV-DEPLOYMENT.md');
  } catch (error) {
    console.error(`Staging evaluation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
