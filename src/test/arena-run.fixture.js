/**
 * A small frozen Decision Arena run for tests, in the shape scripts/arena
 * writes (`syberlabs.decision-arena/v1`, indexed by
 * `syberlabs.decision-arena-index/v1`). This fixture is the contract the
 * replay reads: if the harness renames a field, change it here first.
 * Never shipped: only tests import it. OpenAI and Jev each have an admitted
 * decision for the case (different sections of Middlemarch), Kev was not run,
 * and the rules answer was out of the menu.
 */
import { sampleJevSceneDecision } from '../app/jev-scene-demo.js';

export const ARENA_CASE = 'quiet-evening';
export const ARENA_RUN_FILE = 'run-0123456789ab.json';
const CREATED_AT = '2026-10-07T12:00:00.000Z';

/** What the harness keeps of an admitted decision: the book and the choices, no envelope. */
function admitted(section) {
  const { workId, editionId, sourceRevision, reason, config } = sampleJevSceneDecision();
  return { workId, editionId, sourceRevision, reason, config: { ...config, section } };
}

function provider(id, requestedModel, servedModels, status = 'ran') {
  return { id, requestedModel, servedModels, revision: null, ranFrom: CREATED_AT, ranTo: CREATED_AT,
    pricing: {}, status };
}

function result(providerId, run, admittedDecision, rejectCode = null) {
  return { caseId: ARENA_CASE, providerId, run, latencyMs: 900, rawAnswers: {}, probabilities: null,
    admitted: admittedDecision, rejectCode, usage: null, costUsd: 0, costSource: 'zero' };
}

export function arenaIndexFixture() {
  return {
    schema: 'syberlabs.decision-arena-index/v1',
    runs: [
      { file: ARENA_RUN_FILE, sha256: `0123456789ab${'0'.repeat(52)}`, runId: 'arena-20261007T120000-0123456', createdAt: CREATED_AT, mock: false },
      // A later pipeline check: never replayed, it says nothing about any model.
      { file: 'run-ffffffffffff.json', sha256: 'f'.repeat(64), runId: 'arena-20261008T120000-0123456', createdAt: '2026-10-08T12:00:00.000Z', mock: true }
    ]
  };
}

export function arenaRunFixture() {
  return {
    schema: 'syberlabs.decision-arena/v1',
    runId: 'arena-20261007T120000-0123456',
    createdAt: CREATED_AT,
    harness: { repo: 'RISE', commit: '0123456'.padEnd(40, '0'), dirty: false, node: 'v20.19.0', mock: false },
    inputs: {},
    providers: [
      provider('openai', 'gpt-6-luna', ['gpt-6-luna-2026-09-01']),
      provider('jev', 'typesafe/jev-1.13', ['typesafe/jev-1.13']),
      provider('kev', 'kev-latest', [], 'not run: unreachable'),
      provider('rules', null, [])
    ],
    results: [
      result('openai', 1, admitted('last')),
      result('openai', 2, null, 'TIMEOUT'),
      result('jev', 1, admitted('first')),
      result('rules', 1, null, 'OUT_OF_MENU')
    ],
    scores: {},
    notes: ['kev: not run: unreachable.']
  };
}
