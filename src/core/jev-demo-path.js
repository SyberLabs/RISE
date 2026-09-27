export const JEV_SCENE_DEMO_PATH = '/jev-scene-demo';

export function isJevSceneDemoPath(pathname) {
  return String(pathname || '').replace(/\/+$/u, '') === JEV_SCENE_DEMO_PATH;
}
