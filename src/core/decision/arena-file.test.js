import { describe, expect, it } from 'vitest';
import { ARENA_SCHEMA, readArenaRun, sha256Hex } from './arena-file.js';

const H = 'a'.repeat(64);
const run = (patch = {}) => ({
  schema: ARENA_SCHEMA, runId: 'arena-test', createdAt: '2026-10-08T00:00:00.000Z',
  harness: { repo: 'SyberLabs/RISE', commit: 'b'.repeat(40), dirty: false, node: 'v20.19.0', mock: true },
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
async function file(value) {
  const text = `${JSON.stringify(value, null, 2)}\n`;
  return { text, name: `run-${(await sha256Hex(text)).slice(0, 12)}.json` };
}

describe('arena run file', () => {
  it('accepts a committed run whose bytes match its name', async () => {
    const { text, name } = await file(run());
    expect((await readArenaRun(text, name)).runId).toBe('arena-test');
  });

  it('refuses a run edited after capture, or misnamed', async () => {
    const { text, name } = await file(run());
    await expect(readArenaRun(text.replace('"c"', '"d"'), name)).rejects.toThrow(/hash in its name/u);
    await expect(readArenaRun(text, 'run-latest.json')).rejects.toThrow(/run-<sha12>/u);
  });

  it('refuses an unknown schema and an uncommitted harness', async () => {
    for (const [patch, reason] of [
      [{ schema: 'syberlabs.decision-arena/v2' }, /Unknown arena schema/u],
      [{ harness: { ...run().harness, dirty: true } }, /uncommitted/u],
      [{ harness: { ...run().harness, dirty: undefined } }, /uncommitted/u],
      [{ harness: { ...run().harness, commit: 'HEAD' } }, /harness commit/u]
    ]) {
      const { text, name } = await file(run(patch));
      await expect(readArenaRun(text, name)).rejects.toThrow(reason);
    }
  });

  it('refuses rows from unlisted providers or with an inconsistent verdict', async () => {
    const [row] = run().results;
    for (const results of [[{ ...row, providerId: 'openai' }], [{ ...row, rejectCode: 'REFUSAL' }],
      [{ ...row, costSource: 'guessed' }], [{ ...row, run: 0 }]]) {
      const { text, name } = await file(run({ results }));
      await expect(readArenaRun(text, name)).rejects.toThrow(/malformed result row/u);
    }
  });
});
