// The fixed RISE decision comparison, run on the shared browser contract.
//
// It used to replay a staging Worker that owned the provider key. Decisions
// now run on the reader's own connection, so this runner builds the exact
// request the browser builds (src/core/decision/recommend.js) and sends it to
// one explicitly chosen connection:
//
//   mock   a deterministic stand-in. Proves the pipeline end to end; its
//          scores say nothing about model quality and compare refuses it.
//   local  pinned Kev through a running local RISE (npm run local).
//   live   Jev through the operator's own OpenRouter key (READER_OPENROUTER_KEY).
//          Every case is one billed request on that account.
//
// Fixtures and scoring are unchanged: the 39 cases, the offered-choice
// snapshot, and scoreDecisions. Captures record case IDs, choices, identity,
// and timing only; no intents, keys, or request IDs.
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { scoreDecisions } from './jev-eval.mjs';
import { committedCatalog } from '../local/catalog.mjs';
import { buildRecommendRequest, validDecision } from '../src/core/decision/recommend.js';
import { callDecision, DecisionError } from '../src/core/decision/call.js';
import { JEV, KEV } from '../src/core/decision/providers.js';

export const DEADLINE_MS = 8000;
const MAX_BATCH = 39;
const MODES = ['mock', 'local', 'live'];

function fail(message) { throw new Error(message); }
function argument(args, flag) {
  const index = args.indexOf(flag);
  return index < 0 ? undefined : args[index + 1];
}
function digest(value) { return createHash('sha256').update(value).digest('hex'); }

/** Local RISE only ever answers on loopback. */
export function localOrigin(value) {
  let url;
  try { url = new URL(value); } catch { fail('Set --origin to the local RISE address, for example http://127.0.0.1:5780.'); }
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost'].includes(url.hostname)
    || url.origin !== value || url.username || url.password) {
    fail('Local mode accepts only a loopback local RISE origin with no path.');
  }
  return url.origin;
}

/** A stand-in that picks the first offered value for every question. Pipeline only. */
function mockConnection() {
  return {
    provider: JEV,
    request: async init => {
      const body = JSON.parse(init.body);
      const answers = Object.fromEntries(Object.entries(body.questions).map(([id, question]) =>
        [id, { type: 'choice', choice: Object.keys(question.criteria)[0] }]));
      return Response.json({ id: 'mock', provider: 'TypeSafe', model: 'typesafe/jev-1.13', answers });
    }
  };
}

export function connectionFor(mode, { origin, env = process.env, fetchImpl = fetch } = {}) {
  if (mode === 'mock') return mockConnection();
  if (mode === 'local') {
    const base = localOrigin(origin);
    return { provider: KEV, request: init => fetchImpl(`${base}${KEV.url}`,
      { ...init, headers: { ...init.headers, Origin: base, 'Sec-Fetch-Site': 'same-origin' } }) };
  }
  if (mode === 'live') {
    const key = env.READER_OPENROUTER_KEY || '';
    if (key.length < 20) fail('Live mode needs READER_OPENROUTER_KEY: your own OpenRouter key. Each case is billed to that account.');
    return { provider: JEV, request: init => fetchImpl(JEV.url,
      { ...init, headers: { ...init.headers, Authorization: `Bearer ${key}` } }) };
  }
  fail(`Unknown mode ${mode}; use ${MODES.join(', ')}.`);
}

export async function fixtures(casesPath, optionsPath) {
  if (!casesPath || !optionsPath) fail('Both --cases and --options are required.');
  const [casesText, optionsText] = await Promise.all([readFile(casesPath, 'utf8'), readFile(optionsPath, 'utf8')]);
  const cases = JSON.parse(casesText);
  const options = JSON.parse(optionsText);
  if (!Array.isArray(cases) || !cases.length || cases.length > 64
    || cases.some(item => typeof item.id !== 'string' || !/^[A-Za-z0-9_-]{1,64}$/u.test(item.id)
      || typeof item.intent !== 'string' || item.intent.length < 3 || item.intent.length > 240)
    || new Set(cases.map(item => item.id)).size !== cases.length
    || !options || Array.isArray(options) || typeof options !== 'object'
    || Object.values(options).some(value => !Array.isArray(value) || !value.length)) {
    fail('Invalid bounded RISE cases or offered-choice snapshot.');
  }
  return { cases, options, casesHash: digest(casesText), optionsHash: digest(optionsText) };
}

function identityOf(value, provider) {
  return provider.name === 'Kev'
    ? { provider: 'kev', model: value.model, revision: provider.revision }
    // Jev exposes a served model label, not an immutable checkpoint SHA.
    : { provider: 'jev', model: value.model, revision: value.model };
}

/** One case, exactly as the browser would ask it (turn 0, uncached). */
export async function captureCase(connection, catalog, item, options) {
  const started = performance.now();
  const { body, hints, choices } = buildRecommendRequest({ intent: item.intent, catalog, turn: 0, nightDrive: false });
  try {
    const value = await callDecision(connection, body, { deadlineMs: DEADLINE_MS });
    const wallMs = Math.round(performance.now() - started);
    const decision = validDecision(value, hints.eligibleBooks, item.intent, choices, connection.provider);
    if (!decision) return { row: { id: item.id, status: 'invalid', wallMs } };
    const config = decision.config;
    return { identity: identityOf(value, connection.provider), row: { id: item.id, status: 'ok', wallMs,
      decision: Object.fromEntries(Object.entries(options).map(([field, allowed]) => {
        const selected = field === 'pace' ? String(config.wpm) : config[field];
        return [field, allowed.includes(selected) ? selected : null];
      })) } };
  } catch (error) {
    return { row: { id: item.id, status: 'error', wallMs: Math.round(performance.now() - started),
      error: error instanceof DecisionError ? error.code : 'FAILURE' } };
  }
}

export function compareRuns(cases, options, baseline, candidate, casesHash, optionsHash) {
  for (const [name, run] of [['baseline', baseline], ['candidate', candidate]]) {
    if (run?.kind !== 'rise.decision-eval.capture.v1' || run.casesHash !== casesHash || run.optionsHash !== optionsHash
      || run.catalogHash !== baseline?.catalogHash
      || !run.identity?.provider || !run.identity?.model || !run.identity?.revision
      || !Array.isArray(run.rows) || run.rows.length !== cases.length
      || new Set(run.rows.map(row => row.id)).size !== cases.length
      || run.rows.some(row => !Number.isFinite(row.wallMs) || row.wallMs < 0)) {
      fail(`${name} lacks matching complete measured decisions, catalog, or identity.`);
    }
  }
  if (baseline.mode !== 'live' || baseline.identity.provider !== 'jev'
    || !/^typesafe\/jev-1\.13(?:-\d{8})?$/u.test(baseline.identity.model)) {
    fail('Baseline must be a live Jev capture (mocked results never count).');
  }
  if (candidate.mode !== 'local' || candidate.identity.provider !== 'kev' || candidate.identity.model !== 'kev-latest'
    || candidate.identity.revision !== KEV.revision) fail('Candidate must be a local capture of the pinned Kev revision.');
  const baseScore = scoreDecisions(cases, baseline.rows, options);
  const kevScore = scoreDecisions(cases, candidate.rows, options);
  const times = candidate.rows.map(row => row.wallMs).sort((a, b) => a - b);
  const percentile = p => times[Math.min(times.length - 1, Math.ceil(p * times.length) - 1)];
  const maxMs = times.at(-1);
  const gates = {
    allCasesReturned: candidate.rows.every(row => row.status === 'ok'),
    zeroInvalidAcceptedChoices: kevScore.invalid === 0,
    explicitAtLeastBaseline: kevScore.explicit.total === baseScore.explicit.total
      && kevScore.explicit.passed >= baseScore.explicit.passed,
    contrastAtLeastBaseline: kevScore.contrast.total === baseScore.contrast.total
      && kevScore.contrast.passed >= baseScore.contrast.passed,
    withinBrowserDeadline: maxMs <= DEADLINE_MS
  };
  return {
    baselineIdentity: baseline.identity, candidateIdentity: candidate.identity,
    baseline: { mode: baseline.mode, returned: baseScore.returned, invalid: baseScore.invalid,
      explicit: baseScore.explicit, contrast: baseScore.contrast },
    candidate: { mode: candidate.mode, returned: kevScore.returned, invalid: kevScore.invalid,
      explicit: kevScore.explicit, contrast: kevScore.contrast,
      p50WallMs: percentile(0.5), p95WallMs: percentile(0.95), maxWallMs: maxMs,
      notAccepted: candidate.rows.filter(row => row.status !== 'ok').map(row => ({ id: row.id, status: row.status, error: row.error })) },
    gates, passed: Object.values(gates).every(Boolean)
  };
}

async function capture(args) {
  const mode = argument(args, '--mode');
  const outputPath = argument(args, '--output');
  if (!MODES.includes(mode) || !outputPath) fail('Set --mode mock|local|live and --output.');
  if (mode === 'live' && !args.includes('--bill-my-openrouter-account')) {
    fail('Live mode sends one billed request per case to your OpenRouter account. Add --bill-my-openrouter-account to proceed.');
  }
  const { cases, options, casesHash, optionsHash } = await fixtures(argument(args, '--cases'), argument(args, '--options'));
  if (cases.length > MAX_BATCH) fail(`At most ${MAX_BATCH} cases per capture.`);
  const catalog = await committedCatalog();
  const connection = connectionFor(mode, { origin: argument(args, '--origin') });
  const rows = [];
  let identity = null;
  for (const item of cases) {
    const result = await captureCase(connection, catalog, item, options);
    if (result.identity) {
      if (identity && JSON.stringify(identity) !== JSON.stringify(result.identity)) fail('Provider identity changed within the capture.');
      identity = result.identity;
    }
    rows.push(result.row);
  }
  if (!identity) fail('No valid decision was observed; the capture is unusable.');
  await writeFile(outputPath, `${JSON.stringify({ kind: 'rise.decision-eval.capture.v1', mode, identity,
    casesHash, optionsHash, catalogHash: digest(JSON.stringify(catalog)), rows }, null, 2)}\n`, { flag: 'wx' });
  const ok = rows.filter(row => row.status === 'ok').length;
  console.log(`Captured ${rows.length} ${mode} cases (${ok} valid). ${mode === 'mock' ? 'MOCKED: pipeline check only, not model quality.' : ''} No raw intents recorded.`);
}

async function compare(args) {
  const { cases, options, casesHash, optionsHash } = await fixtures(argument(args, '--cases'), argument(args, '--options'));
  const [baseline, candidate] = await Promise.all([argument(args, '--baseline'), argument(args, '--candidate')]
    .map(path => { if (!path) fail('Set --baseline and --candidate captures.'); return readFile(path, 'utf8').then(JSON.parse); }));
  const result = compareRuns(cases, options, baseline, candidate, casesHash, optionsHash);
  console.log(JSON.stringify(result, null, 2));
  if (!result.passed) process.exitCode = 1;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [mode, ...args] = process.argv.slice(2);
  try {
    if (mode === 'capture') await capture(args);
    else if (mode === 'compare') await compare(args);
    else fail('Usage: decision-eval.mjs capture|compare [flags]; see docs/USER-OWNED-AI.md');
  } catch (error) {
    console.error(`Decision evaluation failed: ${error.message}`);
    process.exitCode = 1;
  }
}
