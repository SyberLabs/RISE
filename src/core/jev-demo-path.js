export const JEV_SCENE_DEMO_PATH = '/jev-scene-demo';
export const NIGHT_DRIVE_PATH = '/night-drive';

const SAMPLE_PATHS = Object.freeze({
  [JEV_SCENE_DEMO_PATH]: 'jev-scene',
  [NIGHT_DRIVE_PATH]: 'night-drive'
});

/** Which fixed sample a public path names, or null. */
export function sceneSampleFromPath(pathname) {
  const path = String(pathname || '').replace(/\/+$/u, '');
  return Object.hasOwn(SAMPLE_PATHS, path) ? SAMPLE_PATHS[path] : null;
}

/** True for every fixed-sample path (they share Home's sample view). */
export function isJevSceneDemoPath(pathname) {
  return sceneSampleFromPath(pathname) !== null;
}
