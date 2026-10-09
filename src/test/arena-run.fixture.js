/**
 * A small frozen Decision Arena replay for tests, in the shape scripts/arena
 * writes beside each full run (`syberlabs.decision-arena-replay/v1`, run 1
 * only, no raw answers), listed by `syberlabs.decision-arena-index/v1`. This
 * fixture is the contract the replay reads: if the harness renames a field,
 * change it here first. Never shipped: only tests import it. OpenAI and Jev
 * each have an admitted decision for the case (different sections of
 * Middlemarch), Kev was not run (its status says why), and the rules answer was out of the menu.
 */
import { sampleJevSceneDecision } from '../app/jev-scene-demo.js';

export const ARENA_CASE = 'rest-slow';
const HASH = '0123456789ab';
export const ARENA_REPLAY_FILE = `replay-${HASH}.json`;
const CREATED_AT = '2026-10-07T12:00:00.000Z';

/** What the harness keeps of an admitted decision: the book and the choices, no envelope. */
function admitted(section) {
  const { workId, editionId, sourceRevision, reason, config } = sampleJevSceneDecision();
  return { workId, editionId, sourceRevision, reason, config: { ...config, section } };
}

export function arenaIndexFixture() {
  return {
    schema: 'syberlabs.decision-arena-index/v1',
    runs: [
      { file: `run-${HASH}.json`, replay: ARENA_REPLAY_FILE, sha256: `${HASH}${'0'.repeat(52)}`,
        runId: 'arena-20261007T120000-0123456', createdAt: CREATED_AT, mock: false },
      // A later pipeline check: never replayed, it says nothing about any model.
      { file: 'run-ffffffffffff.json', replay: 'replay-ffffffffffff.json', sha256: 'f'.repeat(64),
        runId: 'arena-20261008T120000-0123456', createdAt: '2026-10-08T12:00:00.000Z', mock: true }
    ]
  };
}

export function arenaReplayFixture() {
  return {
    schema: 'syberlabs.decision-arena-replay/v1',
    runFile: `run-${HASH}.json`,
    createdAt: CREATED_AT,
    providers: [
      { id: 'openai', servedModels: ['gpt-6-luna-2026-09-01'], requestedModel: 'gpt-6-luna', status: 'ran' },
      { id: 'jev', servedModels: ['typesafe/jev-1.13'], requestedModel: 'typesafe/jev-1.13', status: 'ran' },
      { id: 'kev', servedModels: [], requestedModel: null, status: 'not run: hardware/setup' },
      { id: 'rules', servedModels: [], requestedModel: null, status: 'ran' }
    ],
    decisions: {
      [ARENA_CASE]: {
        openai: admitted('last'),
        jev: admitted('first'),
        rules: { rejectCode: 'OUT_OF_MENU' }
      }
    }
  };
}
