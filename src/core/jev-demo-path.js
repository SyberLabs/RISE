export const JEV_SCENE_DEMO_PATH = '/jev-scene-demo';
export const NIGHT_DRIVE_PATH = '/night-drive';

const SAMPLE_PATHS = Object.freeze({
  [JEV_SCENE_DEMO_PATH]: 'jev-scene',
  [NIGHT_DRIVE_PATH]: 'night-drive'
});

/** The four deciders a frozen Decision Arena result can be replayed from. */
export const ARENA_DECIDERS = Object.freeze(['openai', 'jev', 'kev', 'rules']);

/**
 * An arena address as { caseId, decider }, either null when absent:
 * `/arena` (the case list), `/arena/<caseId>`, `/arena/<caseId>/<decider>`.
 * Null for anything else.
 */
export function arenaFromPath(pathname) {
  const found = /^\/arena(?:\/([^/]+)(?:\/([^/]+))?)?$/u.exec(String(pathname || '').replace(/\/+$/u, ''));
  if (!found || (found[2] !== undefined && !ARENA_DECIDERS.includes(found[2]))) return null;
  try {
    return { caseId: found[1] === undefined ? null : decodeURIComponent(found[1]), decider: found[2] ?? null };
  } catch {
    return null;
  }
}

/** Which fixed sample a public path names, or null. A frozen arena replay is one. */
export function sceneSampleFromPath(pathname) {
  const path = String(pathname || '').replace(/\/+$/u, '');
  if (arenaFromPath(path)) return 'arena';
  return Object.hasOwn(SAMPLE_PATHS, path) ? SAMPLE_PATHS[path] : null;
}

/** True for every fixed-sample path (they share Home's sample view). */
export function isJevSceneDemoPath(pathname) {
  return sceneSampleFromPath(pathname) !== null;
}
