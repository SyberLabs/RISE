/**
 * Saved Living Flame scenes: full recipes kept on this device.
 *
 * A scene is stored whole, never as a preset id, so a later preset edit can
 * never alter a saved creation. Every stored recipe passes the shared
 * validator on the way in and on the way out; a storage failure keeps the
 * in-memory list for this session.
 */

import { normalizeFlameRecipe } from './flame-recipe.js';

export const FLAME_SCENES_KEY = 'rise:flame-scenes:v1';
export const FLAME_SCENES_LIMIT = 50;

let memory = null;

function storage() {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
}

export function loadFlameScenes() {
  if (memory) return [...memory];
  let list = [];
  try {
    const parsed = JSON.parse(storage()?.getItem(FLAME_SCENES_KEY) || '[]');
    list = (Array.isArray(parsed) ? parsed : []).map(normalizeFlameRecipe).filter(Boolean);
  } catch {
    list = [];
  }
  memory = list.slice(-FLAME_SCENES_LIMIT);
  return [...memory];
}

/** Save (or replace by id) a validated recipe; returns the stored list. */
export function saveFlameScene(recipe) {
  const valid = normalizeFlameRecipe(recipe);
  if (!valid) throw new TypeError('Only a valid Living Flame recipe can be saved.');
  const list = loadFlameScenes().filter(item => item.id !== valid.id);
  list.push(valid);
  memory = list.slice(-FLAME_SCENES_LIMIT);
  try {
    storage()?.setItem(FLAME_SCENES_KEY, JSON.stringify(memory));
  } catch {
    // The scene stays available for this session.
  }
  return [...memory];
}

export function findFlameScene(id) {
  return loadFlameScenes().find(item => item.id === id) || null;
}

/** For tests: forget the in-memory mirror. */
export function resetFlameScenesForTest() {
  memory = null;
}
