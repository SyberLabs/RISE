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

/** A team's slug in a changes address: it starts with a letter, so it never reads as a digest id, which starts with a date. */
export const TEAM_SLUG = /^[a-z][a-z0-9-]{0,38}$/u;

/**
 * A RISE Changes address as { team, digestId }, either null when absent: `/changes` (RISE's list),
 * `/changes/<id>` (src/app/changes.js judges the id), `/changes/<slug>` (a team's list) or
 * `/changes/<slug>/<id>`; a slug starts with a letter and an id with a date (src/core/changes/listed.js
 * says which slugs are listed). Null for anything else.
 */
export function changesFromPath(pathname) {
  const found = /^\/changes(?:\/([^/]+)(?:\/([^/]+))?)?$/u.exec(String(pathname || '').replace(/\/+$/u, ''));
  if (!found) return null;
  const [, first, second] = found;
  const team = first !== undefined && TEAM_SLUG.test(first) ? first : null;
  if (second !== undefined && team === null) return null;
  try {
    const id = team === null ? first : second;
    return { team, digestId: id === undefined ? null : decodeURIComponent(id) };
  } catch {
    return null;
  }
}

/** Which fixed sample a public path names, or null. A frozen arena replay is one, and so is a changes digest. */
export function sceneSampleFromPath(pathname) {
  const path = String(pathname || '').replace(/\/+$/u, '');
  if (arenaFromPath(path)) return 'arena';
  if (changesFromPath(path)) return 'changes';
  return Object.hasOwn(SAMPLE_PATHS, path) ? SAMPLE_PATHS[path] : null;
}

/** True for every fixed-sample path (they share Home's sample view). */
export function isJevSceneDemoPath(pathname) {
  return sceneSampleFromPath(pathname) !== null;
}
