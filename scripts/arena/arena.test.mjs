import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { committedCatalog } from '../../local/catalog.mjs';
import { readArenaRun } from '../../src/core/decision/arena-file.js';
import { buildRecommendRequest } from '../../src/core/decision/recommend.js';
import { fixtures } from '../decision-eval.mjs';
import { jevDecider } from './adapters/jev.mjs';
import { kevDecider } from './adapters/kev.mjs';
import { openaiDecider, toOpenAI } from './adapters/openai.mjs';
import { rulesAnswers } from './adapters/rules.mjs';
import { ARENA_DIR, capture, captureRun, decidersFor, guard, mockFetch, report, writeRun } from './arena.mjs';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const OPENAI_KEY = 'sk-SENTINEL-openai-0123456789abcdef';
const OPENROUTER_KEY = 'sk-or-SENTINEL-openrouter-0123456789';
const harness = { repo: 'SyberLabs/RISE', commit: 'c'.repeat(40), dirty: false, node: process.version, mock: true };
let catalog;
let fixture;
let dir;

before(async () => {
  catalog = await committedCatalog();
  fixture = await fixtures(join(ROOT, 'scripts/jev-eval-cases.json'), join(ROOT, 'scripts/jev-eval-options-candidate.json'));
  dir = await mkdtemp(join(tmpdir(), 'rise-arena-'));
});
after(() => rm(dir, { recursive: true, force: true }));

const request = intent => buildRecommendRequest({ intent, catalog, turn: 0, nightDrive: false });
const oneCase = cases => ({ ...fixture, cases: cases ?? fixture.cases.slice(0, 2) });

test('billing guard: never from CI, never without --bill-operator, mock always allowed', async () => {
  assert.throws(() => guard(['--bill-operator'], { CI: 'true' }), /never bills from CI/u);
  assert.throws(() => guard([], {}), /--bill-operator/u);
  assert.doesNotThrow(() => guard(['--bill-operator'], {}));
  assert.doesNotThrow(() => guard(['--mock'], { CI: 'true' }));
  let called = false;
  const fetchImpl = async () => { called = true; };
  await assert.rejects(capture(['--bill-operator'], { env: { CI: '1', OPENAI_API_KEY: OPENAI_KEY }, fetchImpl }), /CI/u);
  await assert.rejects(capture([], { env: { OPENAI_API_KEY: OPENAI_KEY }, fetchImpl }), /--bill-operator/u);
  assert.equal(called, false);
});

test('the OpenAI request carries every RISE question as a choice with its offered values', () => {
  const { body } = request('A slow, quiet reading.');
  const mapped = toOpenAI(body);
  assert.equal(mapped.questions.length, 28);
  assert.match(mapped.input, /^Reader intent: A slow, quiet reading\.\nExperience hint: /u);
  const pace = mapped.questions.find(question => question.name === 'pace');
  assert.deepEqual(pace.choices.map(choice => choice.value), Object.keys(body.questions.pace.criteria));
  assert.equal(pace.choices[0].description, body.questions.pace.criteria[pace.choices[0].value]);
});

test('a rejected 28-question call is split, deterministically, and the split is recorded', async () => {
  for (const limit of [14, 7]) {
    const sizes = [];
    const fetchImpl = async (url, init) => {
      const { questions } = JSON.parse(init.body);
      sizes.push(questions.length);
      return questions.length > limit ? new Response('{}', { status: 400 }) : mockFetch(url, init);
    };
    const deciders = [openaiDecider({ env: { OPENAI_API_KEY: OPENAI_KEY }, fetchImpl })];
    const { run } = await captureRun({ ...oneCase(), catalog, deciders, runs: 1, maxUsd: 1, harness });
    assert.deepEqual(sizes, limit === 14 ? [28, 14, 14, 14, 14] : [28, 14, 7, 7, 7, 7, 7, 7, 7, 7]);
    assert.equal(run.providers[0].questionsPerCall, limit);
    assert.ok(run.notes.some(note => note.includes(`calls of ${limit}`)));
    assert.ok(run.results.every(row => row.admitted && row.probabilities.pace.length === 7));
  }
});

test('a refusal is recorded raw and never admitted', async () => {
  const fetchImpl = async (url, init) => {
    const value = await (await mockFetch(url, init)).json();
    value.answers[3] = { type: 'refusal', name: value.answers[3].name };
    return Response.json(value);
  };
  const deciders = [openaiDecider({ env: { OPENAI_API_KEY: OPENAI_KEY }, fetchImpl })];
  const { run } = await captureRun({ ...oneCase(), catalog, deciders, runs: 1, maxUsd: 1, harness });
  assert.ok(run.results.every(row => row.admitted === null && row.rejectCode === 'REFUSAL'));
  assert.equal(run.scores.openai.refusals, 2);
  assert.equal(run.scores.openai.valid.admitted, 0);
});

test('keys are sent only as the Authorization header and never logged, stored or thrown', async () => {
  const seen = [];
  const fetchImpl = async (url, init) => {
    seen.push(init.headers.Authorization);
    return String(url).includes('openrouter') ? new Response('{}', { status: 401 }) : mockFetch(url, init);
  };
  const lines = [];
  const original = { log: console.log, error: console.error, warn: console.warn };
  for (const name of Object.keys(original)) console[name] = (...args) => lines.push(args.join(' '));
  try {
    const env = { OPENAI_API_KEY: OPENAI_KEY, READER_OPENROUTER_KEY: OPENROUTER_KEY };
    const deciders = decidersFor(['openai', 'jev'], { env, fetchImpl });
    const { run } = await captureRun({ ...oneCase(), catalog, deciders, runs: 1, maxUsd: 1, harness });
    const path = await writeRun(run, join(dir, 'keys'));
    const text = await readFile(path, 'utf8');
    assert.deepEqual([...new Set(seen)].sort(), [`Bearer ${OPENAI_KEY}`, `Bearer ${OPENROUTER_KEY}`].sort());
    assert.ok(run.results.filter(row => row.providerId === 'jev').every(row => row.rejectCode === 'AUTH'));
    for (const key of [OPENAI_KEY, OPENROUTER_KEY]) {
      assert.ok(!text.includes(key), 'key in run file');
      assert.ok(!lines.join('\n').includes(key), 'key in console');
    }
    assert.throws(() => openaiDecider({ env: {} }), error => !String(error.message).includes('sk-'));
  } finally {
    Object.assign(console, original);
  }
});

test('the budget is checked before any call and before each call', async () => {
  const deciders = [openaiDecider({ env: { OPENAI_API_KEY: OPENAI_KEY }, fetchImpl: mockFetch })];
  await assert.rejects(captureRun({ ...fixture, catalog, deciders, runs: 3, maxUsd: 0.0001, harness }), /exceeds --max-usd/u);
  let calls = 0;
  const pricey = { id: 'pricey', requestedModel: 'x', revision: null, pricing: {}, estimateUsd: () => 0.001,
    decide: async () => { calls++; return { answers: {}, probabilities: null, servedModel: 'x', usage: null, costUsd: 0.6, costSource: 'billed' }; } };
  await assert.rejects(captureRun({ ...oneCase(), catalog, deciders: [pricey], runs: 1, maxUsd: 1, harness }), /could pass --max-usd 1/u);
  assert.equal(calls, 1);
});

test('an unreachable Kev is recorded as not run', async () => {
  const fetchImpl = async () => { throw new TypeError('fetch failed'); };
  const { run } = await captureRun({ ...oneCase(), catalog, deciders: [kevDecider({ fetchImpl })], runs: 2, maxUsd: 1, harness });
  assert.equal(run.results.length, 0);
  assert.equal(run.providers[0].status, 'not run: unreachable');
  assert.equal(run.providers[0].revision, '139fdd94f1b6a6ad80cc15e08fcb99cac885a101');
});

test('Jev usage.cost and the served model are recorded', async () => {
  const fetchImpl = async (url, init) => {
    const value = await (await mockFetch(url, init)).json();
    return Response.json({ ...value, model: 'typesafe/jev-1.13-20261001', usage: { cost: 0.0021, prompt_tokens: 900, note: 'x' } });
  };
  const deciders = [jevDecider({ env: { READER_OPENROUTER_KEY: OPENROUTER_KEY }, fetchImpl })];
  const { run } = await captureRun({ ...oneCase(), catalog, deciders, runs: 1, maxUsd: 1, harness });
  assert.deepEqual(run.providers[0].servedModels, ['typesafe/jev-1.13-20261001']);
  assert.deepEqual(run.results[0].usage, { cost: 0.0021, prompt_tokens: 900 });
  assert.equal(run.results[0].costSource, 'billed');
});

test('rules: a named book wins, and words in the intent pick the option', () => {
  const book = catalog.books[catalog.books.length - 1];
  const intent = `A very slow reading of ${book.title}.`;
  const { body, hints } = request(intent);
  const answers = rulesAnswers(body, intent, hints);
  assert.equal(answers.book.choice, book.work_id);
  assert.equal(answers.pace.choice, '100');
});

test('a mock capture is a valid run file, never overwritten, and its report is byte-identical', async () => {
  const deciders = decidersFor(['openai', 'jev', 'kev', 'rules', 'rules-floor'], {
    env: { OPENAI_API_KEY: OPENAI_KEY, READER_OPENROUTER_KEY: OPENROUTER_KEY }, fetchImpl: mockFetch });
  const { run } = await captureRun({ ...fixture, catalog, deciders, runs: 2, maxUsd: 20, harness });
  const path = await writeRun(run, join(dir, 'mock'));
  const accepted = await readArenaRun(await readFile(path, 'utf8'), basename(path));
  assert.equal(accepted.results.length, 39 * 5 * 2);
  assert.ok(accepted.results.every(row => row.admitted));
  await assert.rejects(writeRun(run, join(dir, 'mock')), { code: 'EEXIST' });
  const index = JSON.parse(await readFile(join(dir, 'mock/index.json'), 'utf8'));
  assert.deepEqual(index.runs.map(entry => entry.file), [basename(path)]);
  const first = await report(['--run', path]);
  assert.equal(await report(['--run', path]), first);
  assert.equal(JSON.parse(first).matchesRecorded, true);
});

const walk = (path, skip = () => false) => !existsSync(path) ? [] : readdirSync(path, { withFileTypes: true })
  .flatMap(entry => {
    const full = join(path, entry.name);
    if (skip(full)) return [];
    return entry.isDirectory() ? walk(full, skip) : [full];
  });

test('nothing under src/ imports the arena harness', () => {
  const offenders = walk(join(ROOT, 'src')).filter(file => /\.m?js$/u.test(file)
    && /scripts\/arena/u.test(readFileSync(file, 'utf8')));
  assert.deepEqual(offenders, []);
});

test('the reader app never names the OpenAI Decisions endpoint or model', () => {
  const frozen = full => /[/\\]content[/\\]arena$/u.test(full);
  const files = [...walk(join(ROOT, 'src')), ...walk(join(ROOT, 'public'), frozen), ...walk(join(ROOT, 'dist'), frozen)]
    .filter(file => /\.(?:m?js|html|json|css|txt)$/u.test(file) || basename(file) === '_headers');
  assert.ok(files.length > 100, 'no app files were read');
  const offenders = files.filter(file => /api\.openai\.com|gpt-6-luna/u.test(readFileSync(file, 'utf8')))
    .map(file => relative(ROOT, file));
  assert.deepEqual(offenders, []);
});

test('every committed arena run is valid and not a mock', async () => {
  for (const file of walk(join(ROOT, ARENA_DIR)).filter(path => /run-[0-9a-f]{12}\.json$/u.test(path))) {
    const run = await readArenaRun(readFileSync(file, 'utf8'), basename(file));
    assert.equal(run.harness.mock, false, `${relative(ROOT, file)} is a mock run`);
  }
});
