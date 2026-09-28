import assert from 'node:assert/strict';
import { test } from 'node:test';
import { setTimeout as delay } from 'node:timers/promises';
import { captureCase, compareRuns, stagingOrigin } from './staging-eval.mjs';

const sha = '139fdd94f1b6a6ad80cc15e08fcb99cac885a101';
const cases = [
  { id: 'quiet', intent: 'Quiet reading.', expect: { audio: ['silent'] } },
  { id: 'music', intent: 'Piano reading.', expect: { audio: ['piano'] } },
];
const options = { audio: ['silent', 'piano'] };
const row = (id, audio) => ({ id, decision: { audio }, httpStatus: 200,
  schemaVersion: 2, decisionCacheStatus: 'miss', wallMs: 100 });
const baseline = { origin: 'https://rise-jev-preview.example.workers.dev',
  casesHash: 'cases', optionsHash: 'options',
  identity: { provider: 'jev', model: 'typesafe/jev-1.13', revision: 'typesafe/jev-1.13' },
  rows: [row('quiet', 'silent'), row('music', 'piano')] };
const candidate = { origin: 'https://rise-jev-preview.example.workers.dev',
  casesHash: 'cases', optionsHash: 'options',
  identity: { provider: 'kev', model: 'kev-latest', revision: sha },
  rows: [row('quiet', 'silent'), row('music', 'piano')] };

test('allows explicit staging origins and refuses production', () => {
  assert.equal(stagingOrigin('https://rise-jev-preview.example.workers.dev'),
    'https://rise-jev-preview.example.workers.dev');
  assert.throws(() => stagingOrigin('https://rise.syberlabs.io'));
  assert.throws(() => stagingOrigin('http://rise-jev-preview.example.workers.dev'));
  assert.throws(() => stagingOrigin('https://rise-jev-preview.example.workers.dev/api'));
});

test('requires measured identity for both runs and compares existing scorer gates', () => {
  assert.equal(compareRuns(cases, options, baseline, candidate, 'cases', 'options').passed, true);
  assert.throws(() => compareRuns(cases, options, { ...baseline, identity: null },
    candidate, 'cases', 'options'), /identity/u);
  assert.equal(compareRuns(cases, options, baseline,
    { ...candidate, rows: [row('quiet', 'piano'), row('music', 'piano')] },
    'cases', 'options').gates.explicitAtLeastBaseline, false);
  assert.equal(compareRuns(cases, options, baseline,
    { ...candidate, rows: [row('quiet', 'silent'), { ...row('music', 'piano'), wallMs: 8001 }] },
    'cases', 'options').gates.withinWorkerDeadline, false);
  assert.equal(compareRuns(cases, options, baseline,
    { ...candidate, rows: [row('quiet', 'silent'), row('music', 'unoffered')] },
    'cases', 'options').gates.zeroInvalidAcceptedChoices, false);
  assert.throws(() => compareRuns(cases, options, baseline,
    { ...candidate, rows: [row('quiet', 'silent'), { ...row('music', 'piano'), decisionCacheStatus: 'hit' }] },
    'cases', 'options'), /uncached timing/u);
});

test('capture rejects redirects and times the parsed response body', async () => {
  let fetchOptions;
  const fakeFetch = async (_url, options) => {
    fetchOptions = options;
    return { status: 200, json: async () => {
      await delay(35);
      return { model: 'kev-latest', provider: 'Kev', revision: sha,
        schemaVersion: 2, decisionCacheStatus: 'miss', config: { audio: 'piano' } };
    } };
  };
  const { row, identity } = await captureCase(
    'https://rise-jev-preview.example.workers.dev', 'kev',
    cases[1], options, null, fakeFetch
  );
  assert.equal(fetchOptions.redirect, 'error');
  assert.ok(row.wallMs >= 30);
  assert.equal(row.decision.audio, 'piano');
  assert.equal(identity.revision, sha);
});
