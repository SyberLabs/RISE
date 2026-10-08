// The Decision Arena: RISE's 39 fixed cases asked of several deciders, frozen
// into one content-addressed file. Operator-paid offline research, run by a
// person; a reader's live recommendations never come from here.
//
//   capture  asks every decider every case --runs times and writes
//            public/content/arena/run-<sha12>.json plus index.json.
//            Billed deciders need --bill-operator, refuse under CI, and stop
//            before cumulative cost would pass --max-usd (default 20).
//            --mock answers every network decider from a local stand-in.
//   report   re-derives the scores of one run file, deterministically.
//
// Deciders: openai (OPENAI_API_KEY), jev (READER_OPENROUTER_KEY), kev (local
// RISE at --origin), rules, rules-floor. Keys are read from the environment and
// never written or printed.
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { basename, join, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { committedCatalog } from '../../local/catalog.mjs';
import { admitAnswers, buildRecommendRequest } from '../../src/core/decision/recommend.js';
import { ARENA_SCHEMA, readArenaRun } from '../../src/core/decision/arena-file.js';
import { KEV } from '../../src/core/decision/providers.js';
import { fixtures } from '../decision-eval.mjs';
import { jevDecider } from './adapters/jev.mjs';
import { kevDecider } from './adapters/kev.mjs';
import { OPENAI_MODEL, openaiDecider } from './adapters/openai.mjs';
import { rulesDecider, rulesFloorDecider } from './adapters/rules.mjs';
import { scoreRun } from './report.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
export const ARENA_DIR = 'public/content/arena';
export const DECIDERS = Object.freeze(['openai', 'jev', 'kev', 'rules', 'rules-floor']);
const DEFAULT_CASES = 'scripts/jev-eval-cases.json';
const DEFAULT_OPTIONS = 'scripts/jev-eval-options-candidate.json';

function fail(message) { throw new Error(message); }
function argument(args, flag, fallback) {
  const index = args.indexOf(flag);
  return index < 0 ? fallback : args[index + 1];
}
const digest = value => createHash('sha256').update(value).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: ROOT, encoding: 'utf8' }).trim();

/** Billing guard: a billed capture is a person's deliberate act, never CI's. */
export function guard(args, env) {
  if (args.includes('--mock')) return;
  if (env.CI) fail('The arena never bills from CI. Run it by hand, or use --mock.');
  if (!args.includes('--bill-operator')) {
    fail('A capture bills the operator’s own OpenAI and OpenRouter accounts. Add --bill-operator to proceed, or use --mock.');
  }
}

/** Local stand-ins for the three network deciders: first offered option, flat probabilities. */
export async function mockFetch(url, init) {
  const body = JSON.parse(init.body);
  if (String(url).startsWith('https://api.openai.com/')) {
    return Response.json({ model: OPENAI_MODEL, usage: { input_tokens: Math.ceil(init.body.length / 4) },
      answers: body.questions.map(question => ({ type: 'choice', name: question.name,
        choice: question.choices[0].value, confidence: 1 / question.choices.length,
        probabilities: question.choices.map(choice => ({ value: choice.value, probability: 1 / question.choices.length })) })) });
  }
  const answers = Object.fromEntries(Object.entries(body.questions).map(([name, question]) =>
    [name, { type: 'choice', choice: Object.keys(question.criteria)[0] }]));
  if (String(url).startsWith('https://openrouter.ai/')) {
    return Response.json({ id: 'mock', provider: 'TypeSafe', model: 'typesafe/jev-1.13', answers, usage: { cost: 0 } });
  }
  return Response.json({ model: KEV.model, answers }, { headers: { 'x-kev-revision': KEV.revision } });
}
const MOCK_ENV = Object.freeze({ OPENAI_API_KEY: 'mock-openai-key-not-a-secret', READER_OPENROUTER_KEY: 'mock-openrouter-key-not-a-secret' });

export function decidersFor(names, { env, fetchImpl, origin }) {
  const make = { openai: () => openaiDecider({ env, fetchImpl }), jev: () => jevDecider({ env, fetchImpl }),
    kev: () => kevDecider({ origin, fetchImpl }), rules: rulesDecider, 'rules-floor': rulesFloorDecider };
  return names.map(name => (make[name] || (() => fail(`Unknown decider ${name}; use ${DECIDERS.join(', ')}.`)))());
}

function harnessState(mock) {
  // The run's own output directory does not make the harness dirty.
  const dirty = git('status', '--porcelain', '--', '.', `:(exclude)${ARENA_DIR}`) !== '';
  return { repo: 'SyberLabs/RISE', commit: git('rev-parse', 'HEAD'), dirty, node: process.version, mock };
}

/** The admitted decision, as validDecision builds it, without the provider envelope. */
function admittedFrom(answers, hints, intent, choices) {
  const admitted = admitAnswers(answers, hints.eligibleBooks, intent, choices);
  return admitted && { workId: admitted.book.work_id, editionId: admitted.book.edition_id,
    sourceRevision: admitted.book.source_revision, reason: admitted.book.fit_description, config: admitted.config };
}

/** Why answers were not admitted: a refusal, an unoffered or missing choice, or RISE's own checks. */
function rejectCodeOf(answers, questions) {
  if (Object.values(answers).some(answer => answer.type === 'refusal')) return 'REFUSAL';
  return Object.entries(questions).some(([name, question]) => answers[name]?.type !== 'choice'
    || !Object.hasOwn(question.criteria, answers[name].choice)) ? 'OUT_OF_MENU' : 'NOT_ADMITTED';
}

/** Asks every decider every case, in memory. Returns the run object (unwritten). */
export async function captureRun({ cases, options, casesHash, optionsHash, catalog, deciders, runs,
  maxUsd, harness, now = () => new Date() }) {
  const requests = cases.map(item => ({ item,
    ...buildRecommendRequest({ intent: item.intent, catalog, turn: 0, nightDrive: false }) }));
  const estimate = deciders.reduce((sum, decider) => sum
    + requests.reduce((total, { body }) => total + decider.estimateUsd(body), 0) * runs, 0);
  if (estimate > maxUsd) fail(`Estimated cost $${estimate.toFixed(2)} exceeds --max-usd ${maxUsd}.`);
  const state = new Map(deciders.map(decider => [decider.id, { reached: false, notRun: null,
    served: new Set(), from: null, to: null, maxCost: 0 }]));
  const results = [];
  let spent = 0;
  for (let run = 1; run <= runs; run++) {
    for (const { item, body, hints, choices } of requests) {
      for (const decider of deciders) {
        const status = state.get(decider.id);
        if (status.notRun) continue;
        const reserve = Math.max(decider.estimateUsd(body), status.maxCost);
        if (spent + reserve > maxUsd) fail(`Stopped: the next ${decider.id} call could pass --max-usd ${maxUsd} (spent $${spent.toFixed(4)}).`);
        status.from ??= now().toISOString();
        const started = performance.now();
        let row;
        try {
          const answer = await decider.decide({ body, intent: item.intent, hints });
          const admitted = admittedFrom(answer.answers, hints, item.intent, choices);
          row = { rawAnswers: answer.answers, probabilities: answer.probabilities, admitted,
            rejectCode: admitted ? null : rejectCodeOf(answer.answers, body.questions),
            usage: answer.usage, costUsd: answer.costUsd, costSource: answer.costSource };
          status.reached = true;
          if (answer.servedModel) status.served.add(answer.servedModel);
        } catch (error) {
          if (error?.code === 'UNREACHABLE' && !status.reached) {
            status.notRun = 'not run: unreachable';
            continue;
          }
          row = { rawAnswers: null, probabilities: null, admitted: null,
            rejectCode: typeof error?.code === 'string' ? error.code : 'FAILURE', usage: null, costUsd: null, costSource: null };
        }
        status.to = now().toISOString();
        const cost = Number.isFinite(row.costUsd) ? row.costUsd : reserve;
        spent += cost;
        status.maxCost = Math.max(status.maxCost, cost);
        results.push({ caseId: item.id, providerId: decider.id, run,
          latencyMs: Math.round(performance.now() - started), ...row });
      }
    }
  }
  const caseOrder = new Map(cases.map((item, index) => [item.id, index]));
  const providerOrder = new Map(deciders.map((decider, index) => [decider.id, index]));
  results.sort((a, b) => caseOrder.get(a.caseId) - caseOrder.get(b.caseId)
    || providerOrder.get(a.providerId) - providerOrder.get(b.providerId) || a.run - b.run);
  const notes = [];
  if (harness.mock) notes.push('MOCK: network deciders answered by a local stand-in. Pipeline check only; says nothing about any model.');
  const providers = deciders.map(decider => {
    const status = state.get(decider.id);
    if (status.notRun) notes.push(`${decider.id}: ${status.notRun}.`);
    const split = decider.questionsPerCall;
    if (split && split < 28) notes.push(`${decider.id}: 28 questions in one call were refused; each case was split into calls of ${split}.`);
    return { id: decider.id, requestedModel: decider.requestedModel, servedModels: [...status.served].sort(),
      revision: decider.revision, ranFrom: status.from, ranTo: status.to, pricing: decider.pricing,
      status: status.notRun || 'ran', ...(split !== undefined ? { questionsPerCall: split } : {}) };
  });
  const createdAt = now().toISOString();
  const run = { schema: ARENA_SCHEMA, runId: `arena-${createdAt.replace(/[-:.]/gu, '').slice(0, 15)}-${harness.commit.slice(0, 7)}`,
    createdAt, harness,
    inputs: { cases: { sha256: casesHash, count: cases.length }, options: { sha256: optionsHash },
      catalog: { sha256: digest(JSON.stringify(catalog)) } },
    providers, results, scores: null, notes };
  run.scores = await scoreRun(run, { cases, options, catalog });
  return { run, spent };
}

/** Writes the run under its own hash (never overwriting) and adds it to the index. */
export async function writeRun(run, dir) {
  // Compact: a run is read by code, and pretty-printing nearly doubles it.
  const text = `${JSON.stringify(run)}\n`;
  const sha256 = digest(text);
  const file = `run-${sha256.slice(0, 12)}.json`;
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, file), text, { flag: 'wx' });
  const indexPath = join(dir, 'index.json');
  let index = { schema: 'syberlabs.decision-arena-index/v1', runs: [] };
  try { index = JSON.parse(await readFile(indexPath, 'utf8')); } catch (error) { if (error.code !== 'ENOENT') throw error; }
  index.runs = [...index.runs.filter(entry => entry.file !== file),
    { file, sha256, runId: run.runId, createdAt: run.createdAt, mock: run.harness.mock }]
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  await writeFile(indexPath, `${JSON.stringify(index, null, 2)}\n`);
  return join(dir, file);
}

export async function capture(args, { env = process.env, fetchImpl = fetch, log = console.log } = {}) {
  guard(args, env);
  const mock = args.includes('--mock');
  const runs = Number(argument(args, '--runs', '3'));
  const maxUsd = Number(argument(args, '--max-usd', '20'));
  if (!Number.isInteger(runs) || runs < 1 || runs > 5) fail('Set --runs to 1–5.');
  if (!(maxUsd >= 0 && maxUsd <= 20)) fail('Set --max-usd to at most 20.');
  const harness = harnessState(mock);
  if (!mock && harness.dirty) fail('Commit the harness first: a run from uncommitted code cannot be published.');
  const { cases, options, casesHash, optionsHash } = await fixtures(
    resolve(ROOT, argument(args, '--cases', DEFAULT_CASES)), resolve(ROOT, argument(args, '--options', DEFAULT_OPTIONS)));
  const deciders = decidersFor(argument(args, '--deciders', DECIDERS.join(',')).split(','), {
    env: mock ? MOCK_ENV : env, fetchImpl: mock ? mockFetch : fetchImpl,
    origin: argument(args, '--origin', 'http://127.0.0.1:5780') });
  const catalog = await committedCatalog();
  const { run, spent } = await captureRun({ cases, options, casesHash, optionsHash, catalog, deciders, runs, maxUsd, harness });
  const path = await writeRun(run, resolve(ROOT, argument(args, '--out-dir', ARENA_DIR)));
  log(`Wrote ${path}: ${run.results.length} results, $${spent.toFixed(4)} estimated spend.${mock ? ' MOCK: pipeline check only.' : ''}`);
  return path;
}

/** The scores of one run file, recomputed from its results; the bytes depend only on the file and fixtures. */
export async function report(args) {
  const path = argument(args, '--run');
  if (!path) fail('Set --run public/content/arena/run-<sha12>.json.');
  const run = await readArenaRun(await readFile(path, 'utf8'), basename(path));
  const { cases, options, casesHash, optionsHash } = await fixtures(
    resolve(ROOT, argument(args, '--cases', DEFAULT_CASES)), resolve(ROOT, argument(args, '--options', DEFAULT_OPTIONS)));
  const catalog = await committedCatalog();
  if (run.inputs.cases.sha256 !== casesHash || run.inputs.options.sha256 !== optionsHash
    || run.inputs.catalog.sha256 !== digest(JSON.stringify(catalog))) {
    fail('The run was captured against different cases, options or catalog; check out its harness commit.');
  }
  const scores = await scoreRun(run, { cases, options, catalog });
  return `${JSON.stringify({ schema: 'syberlabs.decision-arena-report/v1', runId: run.runId,
    file: basename(path), matchesRecorded: JSON.stringify(scores) === JSON.stringify(run.scores), scores }, null, 2)}\n`;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  const [command, ...args] = process.argv.slice(2);
  try {
    if (command === 'capture') await capture(args);
    else if (command === 'report') process.stdout.write(await report(args));
    else fail('Usage: arena.mjs capture (--bill-operator | --mock) [--deciders a,b] [--runs 3] [--max-usd 20] | report --run FILE');
  } catch (error) {
    console.error(`Arena failed: ${error.message}`);
    process.exitCode = 1;
  }
}
