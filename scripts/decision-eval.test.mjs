import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { captureCase, compareRuns, connectionFor, localOrigin } from './decision-eval.mjs';
import { scoreDecisions } from './jev-eval.mjs';
import { seedCatalog } from '../local/catalog.mjs';

const sha = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101';
const cases = [
  { id: 'quiet', intent: 'Quiet reading.', expect: { audio: ['silent'] } },
  { id: 'music', intent: 'Piano reading.', expect: { audio: ['piano'] } }
];
const options = { audio: ['silent', 'piano'] };
const row = (id, audio, wallMs = 100) => ({ id, status: 'ok', decision: { audio }, wallMs });
const run = (mode, identity, rows) => ({ kind: 'rise.decision-eval.capture.v1', mode, identity,
  casesHash: 'cases', optionsHash: 'options', catalogHash: 'catalog', rows });
const baseline = run('live', { provider: 'jev', model: 'typesafe/jev-1.13', revision: 'typesafe/jev-1.13' },
  [row('quiet', 'silent'), row('music', 'piano')]);
const candidate = run('local', { provider: 'kev', model: 'kev-latest', revision: sha },
  [row('quiet', 'silent'), row('music', 'piano')]);

test('local mode accepts only a loopback local RISE origin', () => {
  assert.equal(localOrigin('http://127.0.0.1:5780'), 'http://127.0.0.1:5780');
  for (const bad of ['https://rise.syberlabs.io', 'http://192.168.1.4:5780', 'http://127.0.0.1:5780/api', 'file:///x']) {
    assert.throws(() => localOrigin(bad), undefined, bad);
  }
});

test('live mode refuses to run without the operator’s own key', () => {
  assert.throws(() => connectionFor('live', { env: {} }), /READER_OPENROUTER_KEY/u);
  assert.throws(() => connectionFor('staging'), /Unknown mode/u);
});

test('compare keeps the scorer gates and never counts mocked captures', () => {
  const result = compareRuns(cases, options, baseline, candidate, 'cases', 'options');
  assert.equal(result.passed, true);
  assert.deepEqual([result.candidate.p50WallMs, result.candidate.p95WallMs, result.candidate.maxWallMs], [100, 100, 100]);
  assert.deepEqual(result.candidate.notAccepted, []);
  assert.throws(() => compareRuns(cases, options, { ...baseline, mode: 'mock' }, candidate, 'cases', 'options'), /mocked/u);
  assert.throws(() => compareRuns(cases, options, baseline, { ...candidate, mode: 'mock' }, 'cases', 'options'), /local capture/u);
  assert.throws(() => compareRuns(cases, options, baseline,
    { ...candidate, identity: { ...candidate.identity, revision: 'a'.repeat(40) } }, 'cases', 'options'), /pinned Kev/u);
  assert.throws(() => compareRuns(cases, options, baseline, { ...candidate, catalogHash: 'other' }, 'cases', 'options'), /catalog/u);
  assert.equal(compareRuns(cases, options, baseline, { ...candidate, rows: [row('quiet', 'piano'), row('music', 'piano')] },
    'cases', 'options').gates.explicitAtLeastBaseline, false);
  assert.equal(compareRuns(cases, options, baseline, { ...candidate, rows: [row('quiet', 'silent'), row('music', 'piano', 8001)] },
    'cases', 'options').gates.withinBrowserDeadline, false);
  assert.equal(compareRuns(cases, options, baseline, { ...candidate, rows: [row('quiet', 'silent'), row('music', 'unoffered')] },
    'cases', 'options').gates.zeroInvalidAcceptedChoices, false);
});

test('the full 39-case fixture runs through the browser contract (mocked, pipeline only)', async () => {
  const fixture = JSON.parse(readFileSync(new URL('./jev-eval-cases.json', import.meta.url), 'utf8'));
  const offered = JSON.parse(readFileSync(new URL('./jev-eval-options-candidate.json', import.meta.url), 'utf8'));
  assert.equal(fixture.length, 39);
  const catalog = seedCatalog();
  const connection = connectionFor('mock');
  const rows = [];
  for (const item of fixture) rows.push((await captureCase(connection, catalog, item, offered)).row);
  assert.equal(rows.filter(r => r.status === 'ok').length, 39);
  const score = scoreDecisions(fixture, rows, offered);
  assert.equal(score.invalid, 0);
  assert.equal(score.returned, 39);
});

test('local mode sends the browser request to the bridge as the local page would', async () => {
  const calls = [];
  const fetchImpl = async (url, init) => {
    calls.push({ url, init });
    const body = JSON.parse(init.body);
    const answers = Object.fromEntries(Object.entries(body.questions).map(([id, q]) =>
      [id, { type: 'choice', choice: Object.keys(q.criteria)[0] }]));
    return Response.json({ model: 'kev-latest', answers }, { headers: { 'x-kev-revision': sha } });
  };
  const connection = connectionFor('local', { origin: 'http://127.0.0.1:5780', fetchImpl });
  const { row, identity } = await captureCase(connection, seedCatalog(), cases[0], options);
  assert.equal(row.status, 'ok');
  assert.deepEqual(identity, { provider: 'kev', model: 'kev-latest', revision: sha });
  assert.equal(calls[0].url, 'http://127.0.0.1:5780/api/local/kev/systemone');
  assert.equal(calls[0].init.headers.Origin, 'http://127.0.0.1:5780');
  assert.equal(calls[0].init.headers.Authorization, undefined);
});
