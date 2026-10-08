import assert from 'node:assert/strict';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join, relative } from 'node:path';
import { after, before, test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { committedCatalog } from '../../local/catalog.mjs';
import { buildRecommendRequest } from '../../src/core/decision/recommend.js';
import { fixtures } from '../decision-eval.mjs';
import { jevDecider } from './adapters/jev.mjs';
import { kevDecider } from './adapters/kev.mjs';
import { openaiDecider, toOpenAI } from './adapters/openai.mjs';
import { rulesAnswers } from './adapters/rules.mjs';
import { readArenaRun, sha256Hex } from './arena-file.mjs';
import { ARENA_DIR, capture, captureRun, decidersFor, guard, mockFetch, report, writeRun } from './arena.mjs';
import { calibration, calibrationRows, expectedChoices, scoreRun } from './report.mjs';

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

test('all 28 questions go in one call; a rejection is recorded as its HTTP status', async () => {
  const sizes = [];
  const fetchImpl = async (url, init) => {
    sizes.push(JSON.parse(init.body).questions.length);
    return new Response('{}', { status: 400 });
  };
  const deciders = [openaiDecider({ env: { OPENAI_API_KEY: OPENAI_KEY }, fetchImpl })];
  const { run } = await captureRun({ ...oneCase(), catalog, deciders, runs: 1, maxUsd: 1, harness });
  assert.deepEqual(sizes, [28, 28]);
  assert.ok(run.results.every(row => row.rejectCode === 'HTTP_400' && row.rawAnswers === null));
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

test('the budget is checked before any call; at the cap the paid results are kept and marked partial', async () => {
  const deciders = [openaiDecider({ env: { OPENAI_API_KEY: OPENAI_KEY }, fetchImpl: mockFetch })];
  await assert.rejects(captureRun({ ...fixture, catalog, deciders, runs: 3, maxUsd: 0.0001, harness }), /exceeds --max-usd/u);
  let calls = 0;
  const pricey = { id: 'pricey', requestedModel: 'x', revision: null, pricing: {}, estimateUsd: () => 0.001,
    decide: async () => { calls++; return { answers: {}, probabilities: null, servedModel: 'x', usage: null, costUsd: 0.6, costSource: 'billed' }; } };
  const { run, spent } = await captureRun({ ...oneCase(), catalog, deciders: [pricey], runs: 1, maxUsd: 1, harness });
  assert.equal(calls, 1);
  assert.equal(spent, 0.6);
  assert.equal(run.partial, true);
  assert.equal(run.results.length, 1);
  assert.ok(run.notes.includes('partial: stopped at cost cap $1'));
  const path = await writeRun(run, join(dir, 'partial'));
  assert.equal(readArenaRun(await readFile(path, 'utf8'), basename(path)).partial, true);
  const index = JSON.parse(await readFile(join(dir, 'partial/index.json'), 'utf8'));
  assert.equal(index.runs[0].partial, true);
});

test('stability compares the choices made, not the confidence or probabilities around them', async () => {
  let call = 0;
  const fetchImpl = async (url, init) => {
    const value = await (await mockFetch(url, init)).json();
    call++;
    for (const answer of value.answers) answer.confidence = 0.5 + call / 1000;
    return Response.json(value);
  };
  const deciders = [openaiDecider({ env: { OPENAI_API_KEY: OPENAI_KEY }, fetchImpl })];
  const { run } = await captureRun({ ...oneCase(), catalog, deciders, runs: 2, maxUsd: 1, harness });
  assert.deepEqual(run.scores.openai.stability, { cases: 2, identicalRaw: 2, identicalAdmitted: 2 });
  const changed = structuredClone(run);
  const row = changed.results.find(item => item.run === 2);
  row.rawAnswers.pace.choice = '500';
  const scores = scoreRun(changed, { ...oneCase(), catalog });
  assert.equal(scores.openai.stability.identicalRaw, 1);
});

test('calibration rows: one per expected question, with the raw choice, probabilities and confidence', () => {
  const item = fixture.cases.find(entry => entry.expect?.visualMode);
  const expected = expectedChoices(item);
  assert.deepEqual(expected.visual, item.expect.visualMode);
  assert.equal(expected.visualMode, undefined);
  const result = { caseId: item.id, providerId: 'openai', run: 1,
    rawAnswers: { visual: { type: 'choice', choice: item.expect.visualMode[0], confidence: 0.8 }, visualStyle: { type: 'refusal' } },
    probabilities: { visual: [{ value: item.expect.visualMode[0], probability: 0.8 }] } };
  const rows = calibrationRows([result, { ...result, run: 2, rawAnswers: null }], id => id === item.id ? expected : null);
  assert.equal(rows.length, Object.keys(expected).length);
  assert.deepEqual(rows.find(row => row.question === 'visual'), { caseId: item.id, providerId: 'openai', run: 1,
    question: 'visual', probabilities: result.probabilities.visual, confidence: 0.8,
    choice: item.expect.visualMode[0], acceptable: item.expect.visualMode });
  assert.equal(rows.find(row => row.question === 'visualStyle').choice, null);
});

test('a run without calibrationVersion is scored without calibration, so older runs still match', async () => {
  const deciders = [openaiDecider({ env: { OPENAI_API_KEY: OPENAI_KEY }, fetchImpl: mockFetch })];
  const { run } = await captureRun({ ...oneCase(), catalog, deciders, runs: 1, maxUsd: 1, harness });
  const old = { ...run, calibrationVersion: undefined };
  assert.equal(scoreRun(old, { ...oneCase(), catalog }).openai.calibration, undefined);
  if (calibration) {
    assert.match(run.calibrationVersion, /^[0-9a-f]{12}$/u);
    const questions = fixture.cases.slice(0, 2).reduce((sum, item) => sum + Object.keys(expectedChoices(item)).length, 0);
    assert.equal(run.scores.openai.calibration.secondary.confidence.n, questions);
  }
});

const CONTROL = { id: 'odds-70-test', group: 'control', field: 'audio', odds: { 'soft-rain': 0.7, silent: 0.3 },
  intent: "Ten slips are in a hat: seven say 'soft-rain', three say 'silent'. One slip will be drawn after you answer. Which sound?" };

test('controls are asked with the cases, sealed in the report until the seed is revealed', async t => {
  const controlsDir = join(dir, 'controls');
  const seed = 'test-seed-not-a-secret';
  const controlsFile = { kind: 'rise.decision-arena.controls.v1', seedCommitment: sha256Hex(seed), cases: [CONTROL] };
  const controlsText = `${JSON.stringify(controlsFile)}\n`;
  await mkdir(controlsDir, { recursive: true });
  await writeFile(join(controlsDir, 'controls.json'), controlsText);
  await writeFile(join(controlsDir, 'seed'), seed);
  const deciders = decidersFor(['openai', 'rules'], { env: { OPENAI_API_KEY: OPENAI_KEY }, fetchImpl: mockFetch });
  const { run } = await captureRun({ ...fixture, controls: [CONTROL], controlsHash: sha256Hex(controlsText),
    catalog, deciders, runs: 1, maxUsd: 1, harness });
  assert.deepEqual(run.inputs.controls, { sha256: sha256Hex(controlsText), count: 1 });
  assert.equal(run.results.filter(row => row.caseId === CONTROL.id).length, 2);
  const path = await writeRun(run, controlsDir);
  const args = ['--run', path, '--controls', join(controlsDir, 'controls.json')];
  const sealed = JSON.parse(await report(args));
  assert.equal(sealed.controls, 'sealed');
  assert.equal(sealed.matchesRecorded, true);
  if (!calibration || !existsSync(join(ROOT, 'scripts/arena/controls.mjs'))) {
    t.skip('calibration.mjs and controls.mjs arrive with #531');
    return;
  }
  const revealed = JSON.parse(await report([...args, '--reveal-seed-file', join(controlsDir, 'seed')]));
  assert.equal(revealed.matchesRecorded, true);
  assert.equal(revealed.controls.openai.secondary.confidence.n, 1);
  assert.equal(revealed.controls.rules.skipped.noProbabilities, 1);
  await writeFile(join(controlsDir, 'seed'), 'wrong-seed');
  await assert.rejects(report([...args, '--reveal-seed-file', join(controlsDir, 'seed')]), /seedCommitment/u);
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
  const accepted = readArenaRun(await readFile(path, 'utf8'), basename(path));
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
    const run = readArenaRun(readFileSync(file, 'utf8'), basename(file));
    assert.equal(run.harness.mock, false, `${relative(ROOT, file)} is a mock run`);
  }
});
