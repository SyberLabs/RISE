import { beforeEach, describe, expect, it } from 'vitest';
import { FLAME_SCENES_KEY, findFlameScene, loadFlameScenes, resetFlameScenesForTest, saveFlameScene } from './flame-scenes.js';
import { flamePreset } from '../visuals/living-flame/flame-presets.js';

describe('saved Living Flame scenes', () => {
  beforeEach(() => {
    localStorage.clear();
    resetFlameScenesForTest();
  });

  it('stores the whole recipe and reads it back after a reload', () => {
    const recipe = { ...flamePreset('solar-bloom'), id: 'my-bloom', name: 'My bloom' };
    saveFlameScene(recipe);
    resetFlameScenesForTest();
    const found = findFlameScene('my-bloom');
    expect(found.transforms).toEqual(flamePreset('solar-bloom').transforms);
    expect(found.name).toBe('My bloom');
  });

  it('replaces by id and refuses an invalid recipe', () => {
    saveFlameScene({ ...flamePreset('glacial-silk'), id: 'a' });
    saveFlameScene({ ...flamePreset('glacial-silk'), id: 'a', name: 'Renamed' });
    expect(loadFlameScenes().map(item => item.name)).toEqual(['Renamed']);
    expect(() => saveFlameScene({ id: 'broken' })).toThrow(TypeError);
  });

  it('drops tampered entries from storage rather than failing', () => {
    localStorage.setItem(FLAME_SCENES_KEY, JSON.stringify([{ id: 'x', transforms: 'no' }, flamePreset('violet-nebula')]));
    expect(loadFlameScenes().map(item => item.id)).toEqual(['violet-nebula']);
  });
});
