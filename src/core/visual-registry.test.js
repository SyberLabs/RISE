/**
 * The engine catalog's flags say what each surface offers: `listed`, an
 * engine choice in Reader setup; `composer`, a visual the ChatGPT Composer
 * may present. The catalog follows the Composer's sealed contract
 * (RISE_CURRENT_VISUALS); this file never derives that contract from it.
 */
import { describe, expect, it } from 'vitest';
import { RISE_CURRENT_VISUALS } from './rise-current.js';
import { ENGINE_CATALOG, LISTED_PROCEDURAL_PATTERNS } from './visual-registry.js';
import { DEDICATED_MODE, FIELD, taxonomyLeaves } from './visual-taxonomy.js';

const entry = id => ENGINE_CATALOG.find(item => item.id === id);

describe('the engine catalog', () => {
  it('holds Living Flame and night streaks, offered by neither Reader setup nor the Composer', () => {
    expect(entry('living-flame')).toMatchObject({ name: 'Living Flame', listed: false, composer: false });
    expect(entry('night-streaks')).toMatchObject({ name: 'Night Streaks', listed: false, composer: false });
  });

  it('gives every entry a listed and a composer flag', () => {
    for (const item of ENGINE_CATALOG) {
      expect(typeof item.listed, item.id).toBe('boolean');
      expect(typeof item.composer, item.id).toBe('boolean');
    }
  });

  it('lists exactly the engines Reader setup offers', () => {
    const listed = ENGINE_CATALOG.filter(item => item.listed);
    const offered = taxonomyLeaves().map(leaf => leaf.engineId).filter(Boolean);
    expect(listed.map(item => item.id).sort()).toEqual([...offered].sort());
    expect(LISTED_PROCEDURAL_PATTERNS).toEqual(listed);
  });

  it('gives the navigator its engine leaves: each listed entry, in catalog order within its category', () => {
    const listed = ENGINE_CATALOG.filter(item => item.listed);
    const expected = [FIELD.GALLERY, FIELD.DYNAMIC]
      .flatMap(category => listed.filter(item => item.category === category))
      .map(item => [item.id, item.category, item.label ?? item.name]);
    const leaves = taxonomyLeaves()
      .filter(leaf => leaf.engineId)
      .map(leaf => [leaf.engineId, leaf.category, leaf.label]);
    expect(leaves).toEqual(expected);
    expect(expected).toHaveLength(listed.length);
  });

  it('presents in the Composer exactly the visuals a Current may name', () => {
    // `still` is the floor: a Current passage with no field, drawn by no engine.
    const STILL = 'still';
    // Klee reaches the room as Genesis, the name a Current uses for it.
    const CURRENT_NAME = { klee: 'genesis' };
    expect(DEDICATED_MODE.klee).toBe(CURRENT_NAME.klee);

    const composerView = [
      STILL,
      ...ENGINE_CATALOG.filter(item => item.composer).map(item => CURRENT_NAME[item.id] ?? item.id)
    ];
    expect(composerView.sort()).toEqual([...RISE_CURRENT_VISUALS].sort());
  });
});
