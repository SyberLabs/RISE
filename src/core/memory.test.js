import { afterEach, describe, expect, it } from 'vitest';
import { MemoryCore } from './memory.js';

const GLOBAL_KEY = 'rise_global_images_v1';
const WORKSHOP_KEY = 'rise_workshop_v1';
const IMAGE_A = 'data:image/png;base64,AAAA';
const IMAGE_B = 'data:image/png;base64,BBBB';

describe('MemoryCore Global Image Pool assets', () => {
  afterEach(() => localStorage.removeItem(GLOBAL_KEY));

  it('migrates legacy URI arrays to stable addressable asset records', () => {
    localStorage.setItem(GLOBAL_KEY, JSON.stringify([IMAGE_A, IMAGE_B]));

    const first = MemoryCore.getGlobalImageAssets();
    const second = MemoryCore.getGlobalImageAssets();
    const stored = JSON.parse(localStorage.getItem(GLOBAL_KEY));

    expect(first).toHaveLength(2);
    expect(first.map(asset => asset.id)).toEqual(second.map(asset => asset.id));
    expect(first[0]).toMatchObject({ uri: IMAGE_A, name: 'Global image 1' });
    expect(stored[0]).toMatchObject({ id: first[0].id, uri: IMAGE_A });
    expect(MemoryCore.getGlobalImages()).toEqual([IMAGE_A, IMAGE_B]);
  });

  it('resolves all or an exact pinned subset without falling back on empty selection', () => {
    expect(MemoryCore.saveGlobalImage(IMAGE_A, { name: 'Alpha' })).toBe(true);
    expect(MemoryCore.saveGlobalImage(IMAGE_B, { name: 'Beta' })).toBe(true);
    const assets = MemoryCore.getGlobalImageAssets();
    const alpha = assets.find(asset => asset.name === 'Alpha');

    expect(MemoryCore.resolveGlobalImageUris({ mode: 'all' })).toEqual([IMAGE_B, IMAGE_A]);
    expect(MemoryCore.resolveGlobalImageUris({ mode: 'selected', assetIds: [alpha.id] })).toEqual([IMAGE_A]);
    expect(MemoryCore.resolveGlobalImageUris({ mode: 'selected', assetIds: [] })).toEqual([]);
    expect(MemoryCore.resolveGlobalImageUris({ mode: 'selected', assetIds: ['missing'] })).toEqual([]);
  });

  it('removes assets by stable ID', () => {
    MemoryCore.saveGlobalImage(IMAGE_A, { name: 'Alpha' });
    const [asset] = MemoryCore.getGlobalImageAssets();

    expect(MemoryCore.removeGlobalImage(asset.id)).toBe(true);
    expect(MemoryCore.getGlobalImageAssets()).toEqual([]);
  });

  it('keeps the stable ID when the same image is imported again', () => {
    MemoryCore.saveGlobalImage(IMAGE_A, { name: 'First name' });
    const first = MemoryCore.getGlobalImageAssets()[0];

    MemoryCore.saveGlobalImage(IMAGE_A, { name: 'Renamed' });
    const [renamed] = MemoryCore.getGlobalImageAssets();

    expect(renamed.id).toBe(first.id);
    expect(renamed.name).toBe('Renamed');
    expect(MemoryCore.getGlobalImageAssets()).toHaveLength(1);
  });
});

describe('MemoryCore Workshop Project boundary', () => {
  afterEach(() => localStorage.removeItem(WORKSHOP_KEY));

  it('migrates legacy storage to formal projects while returning a flat read model', () => {
    localStorage.setItem(WORKSHOP_KEY, JSON.stringify([{
      id: 'legacy-project',
      title: 'Legacy',
      sources: [{ id: 'source-1', name: 'Source', data: 'A source text.' }],
      wpm: 200,
      curve: 'wave',
      chunkMode: 'phrase',
      visualConfig: { visualMode: 'off' }
    }]));

    const [view] = MemoryCore.getWorkshopBlueprints();
    const [stored] = JSON.parse(localStorage.getItem(WORKSHOP_KEY));

    expect(view).toMatchObject({
      schema: 'rise.workshop-project.v1',
      id: 'legacy-project',
      wpm: 290,
      curve: 'wave'
    });
    expect(stored.schema).toBe('rise.workshop-project.v1');
    expect(stored.defaults.reading).toMatchObject({ wpm: 290, chunkMode: 'phrase' });
    expect(stored).not.toHaveProperty('wpm');
  });

  it('stores new editor data formally and preserves the compatibility view', () => {
    const saved = MemoryCore.saveWorkshopBlueprint({
      title: 'New project',
      intent: 'custom',
      sources: [{ id: 'source-1', name: 'Source', data: 'A source text.' }],
      wpm: 220,
      paceV2: true,
      curve: 'flat',
      chunkMode: 'word',
      visualConfig: { visualMode: 'off' },
      soundscape: 'aurora',
      audioPreset: 'silent'
    });
    const [stored] = JSON.parse(localStorage.getItem(WORKSHOP_KEY));

    expect(saved).toMatchObject({ wpm: 220, soundscape: 'aurora' });
    expect(stored.schema).toBe('rise.workshop-project.v1');
    expect(stored.defaults.audio.soundscape).toBe('aurora');
  });
});
