import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ARENA_SCHEMA, readArenaReplay, readArenaRun, REPLAY_SCHEMA, replayName, replayText, sha256Hex } from './arena-file.mjs';

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

test('the replay holds run 1 of the cases only: admitted decisions or reject codes, no controls, no raw answers', () => {
  const base = run();
  const providers = [...base.providers, { id: 'openai', requestedModel: 'm', servedModels: ['m-1'], revision: null,
    pricing: { source: 'list' } }];
  const results = [...base.results,
    { ...base.results[1], providerId: 'openai', run: 1, rejectCode: 'REFUSAL', rawAnswers: { book: { type: 'refusal' } } },
    { ...base.results[0], caseId: 'odds-50-1' }];
  const { text, name } = file(run({ providers, results }));
  const replay = JSON.parse(replayText(readArenaRun(text, name), name));
  assert.deepEqual(replay, { schema: REPLAY_SCHEMA, runFile: name, createdAt: '2026-10-08T00:00:00.000Z',
    providers: [{ id: 'rules', requestedModel: null, servedModels: [] }, { id: 'openai', requestedModel: 'm', servedModels: ['m-1'] }],
    decisions: { c: { rules: { workId: 'w', config: {} }, openai: { rejectCode: 'REFUSAL' } } } });
});

test('a replay is accepted only under its run file\'s name and only as the bytes the run derives', () => {
  const { text, name } = file(run());
  const replay = replayText(readArenaRun(text, name), name);
  assert.equal(replayName(name), name.replace('run-', 'replay-'));
  assert.equal(readArenaReplay(replay, replayName(name), text, name).runFile, name);
  assert.throws(() => readArenaReplay(replay, 'replay-000000000000.json', text, name), /named replay-<sha12>/u);
  assert.throws(() => readArenaReplay(replay.replace('"w"', '"x"'), replayName(name), text, name), /not the one/u);
  assert.throws(() => readArenaReplay(`${JSON.stringify(JSON.parse(replay), null, 2)}\n`, replayName(name), text, name), /not the one/u);
});
