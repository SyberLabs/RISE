/**
 * A small frozen Decision Arena run for tests, in the shape scripts/arena
 * writes (`syberlabs.decision-arena/v1`). Never shipped: only tests import it.
 * OpenAI and Jev each have an admitted decision for the case (different
 * sections of Middlemarch), Kev was not run, and the rules row was rejected.
 */
import { sampleJevSceneDecision } from '../app/jev-scene-demo.js';

export const ARENA_CASE = 'quiet-evening';
export const ARENA_RUN_FILE = 'run-0123456789ab.json';

function admitted(model, section) {
  const sample = sampleJevSceneDecision();
  return { ...sample, requestId: `arena-${model}`, model, config: { ...sample.config, section } };
}

export function arenaIndexFixture() {
  return { schema: 'syberlabs.decision-arena/v1', latest: ARENA_RUN_FILE };
}

export function arenaRunFixture() {
  return {
    schema: 'syberlabs.decision-arena/v1',
    capturedAt: '2026-10-07T12:00:00.000Z',
    results: [
      { caseId: ARENA_CASE, providerId: 'openai', run: 1, admitted: admitted('gpt-6-luna', 'last') },
      { caseId: ARENA_CASE, providerId: 'openai', run: 2, admitted: null, error: { code: 'TIMEOUT' } },
      { caseId: ARENA_CASE, providerId: 'jev', run: 1, admitted: admitted('typesafe/jev-1.13', 'first') },
      { caseId: ARENA_CASE, providerId: 'rules', run: 1, admitted: null, error: { code: 'NO_BOOK' } }
    ]
  };
}
