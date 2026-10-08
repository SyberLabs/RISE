import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARENA_SCHEMA, readArenaRun, sha256Hex } from './arena-file.mjs';

const H = 'a'.repeat(64);
const run = (patch = {}) => ({
  schema: ARENA_SCHEMA, runId: 'arena-test', createdAt: '2026-10-08T00:00:00.000Z',
  harness: { repo: 'SyberLabs/RISE', commit: 'b'.repeat(40), dirty: false, node: 'v20.19.0', mock: false },
  inputs: { cases: { sha256: H, count: 1 }, options: { sha256: H }, catalog: { sha256: H } },
  providers: [{ id: 'rules', requestedModel: null, servedModels: [], revision: null, pricing: { source: 'none', asOf: null } }],
  results: [
    { caseId: 'c', providerId: 'rules', run: 1, rawAnswers: {}, probabilities: null,
      admitted: { workId: 'w', config: {} }, rejectCode: null, latencyMs: 0, usage: null, costUsd: 0, costSource: 'zero' },
    { caseId: 'c', providerId: 'rules', run: 2, rawAnswers: null, probabilities: null,
      admitted: null, rejectCode: 'TIMEOUT', latencyMs: 9, usage: null, costUsd: null, costSource: null }
  ],
  scores: {}, notes: [], ...patch
});
function file(value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  return { text, name: `run-${sha256Hex(text).slice(0, 12)}.json` };
}

test('accepts a committed run whose bytes match its name, and a partial one', () => {
  for (const patch of [{}, { partial: true }]) {
    const { text, name } = file(run(patch));
    assert.equal(readArenaRun(text, name).runId, 'arena-test');
  }
});

test('refuses a run edited after capture, or misnamed', () => {
  const { text, name } = file(run());
  assert.throws(() => readArenaRun(text.replace('"c"', '"d"'), name), /hash in its name/u);
  assert.throws(() => readArenaRun(text, 'run-latest.json'), /run-<sha12>/u);
});

test('refuses an unknown schema, an uncommitted harness unless mock, and a non-boolean partial', () => {
  const harness = run().harness;
  for (const [patch, reason] of [
    [{ schema: 'syberlabs.decision-arena/v2' }, /Unknown arena schema/u],
    [{ harness: { ...harness, dirty: true } }, /uncommitted/u],
    [{ harness: { ...harness, dirty: undefined } }, /uncommitted/u],
    [{ harness: { ...harness, dirty: undefined, mock: true } }, /uncommitted/u],
    [{ harness: { ...harness, commit: 'HEAD' } }, /harness commit/u],
    [{ partial: false }, /identity/u]
  ]) {
    const { text, name } = file(run(patch));
    assert.throws(() => readArenaRun(text, name), reason);
  }
  const { text, name } = file(run({ harness: { ...harness, dirty: true, mock: true } }));
  assert.equal(readArenaRun(text, name).harness.dirty, true);
});

test('refuses rows from unlisted providers or with an inconsistent verdict', () => {
  const [row] = run().results;
  for (const results of [[{ ...row, providerId: 'openai' }], [{ ...row, rejectCode: 'REFUSAL' }],
    [{ ...row, costSource: 'guessed' }], [{ ...row, run: 0 }]]) {
    const { text, name } = file(run({ results }));
    assert.throws(() => readArenaRun(text, name), /malformed result row/u);
  }
});
