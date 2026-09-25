import { describe, expect, it } from 'vitest';
import {
  SceneError,
  cueForPick,
  leafToEditorAssetId,
  moveScene,
  rewriteWrittenScene,
  scenesFromSession,
  sessionForScene,
  setSceneSound,
  setSceneVisual,
  writtenSource
} from './workshop-scenes.js';
import { assignVisualSpan } from './visual-score-lane.js';
import { compileWorkshopScoreProgram } from './audio-score-lane.js';
import { WORKSHOP_AUDIO_ASSETS, workshopAudioEditorAsset } from './workshop-audio.js';
import { buildWorkshopVisualAssetRegistry } from '../components/workshop/workshop-visual-assets.js';
import { editorAssetSupports } from './editor-asset.js';

const WORDS = 'Waste no more time arguing what a good man should be. Be one.';
const OTHER = 'Begin the morning by saying to thyself, I shall meet with the busy-body.';
const audioAssets = WORKSHOP_AUDIO_ASSETS.map(workshopAudioEditorAsset).filter(Boolean);

const session = (overrides = {}) => ({
  sources: [
    { id: 'written-a', name: 'One', providerId: 'local', data: WORDS, words: 12, metadata: { source: 'written' } },
    { id: 'library-b', name: 'Two', providerId: 'library-archive', data: OTHER, words: 13, metadata: {} }
  ],
  visualScoreAssignments: [],
  audioScoreAssignments: [],
  ...overrides
});

const passage = (data, sourceId, from, to, id) => assignVisualSpan({
  assignments: data.visualScoreAssignments,
  source: { id: sourceId, text: data.sources.find(s => s.id === sourceId).data },
  assetId: 'procedural:fractal', assignmentId: id, fromCharacter: from, toCharacter: to
});

describe('a scene is a source', () => {
  it('lists every source as a scene, in order, with its first words', () => {
    const scenes = scenesFromSession(session());
    expect(scenes.map(s => s.id)).toEqual(['written-a', 'library-b']);
    expect(scenes[0].excerpt.startsWith('Waste no more time')).toBe(true);
    expect(scenes[0].written).toBe(true);
    expect(scenes[0].editable).toBe(true);
    expect(scenes[1].written).toBe(false);
    expect(scenes[1].editable).toBe(false);
    expect(scenes[0].visual).toBeNull();
    expect(scenes[0].sound).toBeNull();
  });

  it('a scene visual is one clip spanning the whole scene', () => {
    const data = session();
    const next = setSceneVisual(data, 'written-a', { assetId: 'procedural:fractal', id: 'v1' });
    expect(next.visualScoreAssignments).toHaveLength(1);
    const clip = next.visualScoreAssignments[0];
    expect([clip.sourceId, clip.fromCharacter, clip.toCharacter]).toEqual(['written-a', 0, WORDS.length]);
    const scene = scenesFromSession({ ...data, ...next }, { visualName: id => `name:${id}` })[0];
    expect(scene.visual).toMatchObject({ assetId: 'procedural:fractal', name: 'name:procedural:fractal', whole: true, passages: 0 });
  });

  it('replaces passage visuals in that scene and leaves other scenes alone', () => {
    let data = session();
    data = { ...data, visualScoreAssignments: passage(data, 'written-a', 0, 10, 'p1') };
    data = { ...data, visualScoreAssignments: passage(data, 'written-a', 20, 30, 'p2') };
    data = { ...data, visualScoreAssignments: passage(data, 'library-b', 0, 10, 'p3') };
    expect(scenesFromSession(data)[0].visual).toMatchObject({ whole: false, passages: 2 });
    const next = setSceneVisual(data, 'written-a', { assetId: 'surface:attractor', id: 'v1' });
    expect(next.visualScoreAssignments.map(a => a.id).sort()).toEqual(['p3', 'v1']);
  });

  it('a scene sound spans the scene and keeps time with its visual', () => {
    let data = session();
    data = { ...data, ...setSceneVisual(data, 'written-a', { assetId: 'procedural:fractal', id: 'v1' }) };
    data = { ...data, ...setSceneSound(data, 'written-a', { assetId: 'soundscape:aurora', assets: audioAssets, id: 'a1' }) };
    const [clip] = data.audioScoreAssignments;
    expect([clip.fromCharacter, clip.toCharacter, clip.syncGroup]).toEqual([0, WORDS.length, 'sync-v1']);
    expect(scenesFromSession(data, { audioName: () => 'Aurora' })[0].sound)
      .toMatchObject({ assetId: 'soundscape:aurora', name: 'Aurora', whole: true });
  });

  it('a new visual carries the sound with it', () => {
    let data = session();
    data = { ...data, ...setSceneVisual(data, 'written-a', { assetId: 'procedural:fractal', id: 'v1' }) };
    data = { ...data, ...setSceneSound(data, 'written-a', { assetId: 'soundscape:aurora', assets: audioAssets, id: 'a1' }) };
    data = { ...data, ...setSceneVisual(data, 'written-a', { assetId: 'procedural:turrell', id: 'v2' }) };
    expect(data.audioScoreAssignments[0].syncGroup).toBe('sync-v2');
  });

  it('no sound returns the scene to the sequence, and only that scene', () => {
    let data = session();
    data = { ...data, ...setSceneSound(data, 'written-a', { assetId: 'soundscape:aurora', assets: audioAssets, id: 'a1' }) };
    data = { ...data, ...setSceneSound(data, 'library-b', { assetId: 'tone:deep', assets: audioAssets, id: 'a2' }) };
    const next = setSceneSound(data, 'written-a', null);
    expect(next.audioScoreAssignments.map(a => a.id)).toEqual(['a2']);
  });
});

describe('written scenes', () => {
  it('are local sources that say they were written here', () => {
    const source = writtenSource('  Light enters form.\r\nAnd stays. ', { id: 'written-x', name: 'Light' });
    expect(source).toMatchObject({ id: 'written-x', name: 'Light', providerId: 'local', type: 'text/plain', metadata: { source: 'written' } });
    expect(source.data).toBe('Light enters form.\nAnd stays.');
    expect(source.words).toBe(5);
  });

  it('refuse to be empty', () => {
    expect(() => writtenSource('   ', { id: 'written-x' })).toThrow(SceneError);
  });

  it('rewriting keeps whole-scene clips whole', () => {
    let data = session();
    data = { ...data, ...setSceneVisual(data, 'written-a', { assetId: 'procedural:fractal', id: 'v1' }) };
    data = { ...data, ...setSceneSound(data, 'written-a', { assetId: 'soundscape:aurora', assets: audioAssets, id: 'a1' }) };
    const text = 'A shorter scene now.';
    const next = rewriteWrittenScene(data, 'written-a', text, { audioAssets });
    expect(next.sources[0].data).toBe(text);
    expect(next.sources[0].words).toBe(4);
    expect(next.visualScoreAssignments[0]).toMatchObject({ id: 'v1', fromCharacter: 0, toCharacter: text.length });
    expect(next.audioScoreAssignments[0]).toMatchObject({ id: 'a1', toCharacter: text.length, syncGroup: 'sync-v1' });
    expect(next.sources[1]).toBe(data.sources[1]);
  });

  it('refuses a scene from the Library, and one with passage clips', () => {
    let data = session();
    expect(() => rewriteWrittenScene(data, 'library-b', 'x y z')).toThrow(/written/i);
    data = { ...data, visualScoreAssignments: passage(data, 'written-a', 0, 10, 'p1') };
    try {
      rewriteWrittenScene(data, 'written-a', 'Other words entirely.');
      throw new Error('expected a refusal');
    } catch (error) {
      expect(error).toBeInstanceOf(SceneError);
      expect(error.code).toBe('SCENE_HAS_PASSAGES');
    }
  });
});

describe('order and preview', () => {
  it('moves a scene and ignores a move off either end', () => {
    const three = ['a', 'b', 'c'].map(id => ({ id }));
    expect(moveScene(three, 0, 2).map(s => s.id)).toEqual(['b', 'c', 'a']);
    expect(moveScene(three, 2, 1).map(s => s.id)).toEqual(['a', 'c', 'b']);
    expect(moveScene(three, 0, -1)).toBe(three);
    expect(moveScene(three, 1, 1)).toBe(three);
  });

  it('a one-scene preview carries that scene and only its clips', () => {
    let data = session();
    data = { ...data, ...setSceneVisual(data, 'written-a', { assetId: 'procedural:fractal', id: 'v1' }) };
    data = { ...data, ...setSceneVisual(data, 'library-b', { assetId: 'procedural:turrell', id: 'v2' }) };
    const one = sessionForScene(data, 'library-b');
    expect(one.sources.map(s => s.id)).toEqual(['library-b']);
    expect(one.visualScoreAssignments.map(a => a.id)).toEqual(['v2']);
    expect(data.sources).toHaveLength(2);
  });
});

describe('from the navigator to the Workshop registry', () => {
  it('names the Workshop asset for each pickable visual', () => {
    expect(leafToEditorAssetId('off')).toBe('surface:off');
    expect(leafToEditorAssetId('focal')).toBe('surface:focal');
    expect(leafToEditorAssetId('attractor')).toBe('surface:attractor');
    expect(leafToEditorAssetId('klee')).toBe('surface:genesis');
    expect(leafToEditorAssetId('fractal')).toBe('procedural:fractal');
    expect(leafToEditorAssetId('by-manner', 'aic-impressionism')).toBe('collection:aic-impressionism');
    expect(leafToEditorAssetId('personal', 'global-pool')).toBe('collection:global-pool');
    expect(leafToEditorAssetId('personal', 'custom')).toBeNull();
    expect(leafToEditorAssetId('science', 'sci-astronomy')).toBeNull();
  });

  it('every id it names exists in the Workshop registry', () => {
    const ids = new Set(buildWorkshopVisualAssetRegistry({}).map(entry => entry.asset.id));
    for (const leaf of ['off', 'focal', 'attractor', 'klee', 'harmonograph', 'ostensoria', 'apparitio',
      'fractal', 'turrell', 'neural', 'rockgarden']) {
      expect(ids.has(leafToEditorAssetId(leaf)), leaf).toBe(true);
    }
  });

  it('carries a chosen preset or glyph into the cue', () => {
    expect(cueForPick('klee', { preset: 'chaotic' }, { kind: 'field', renderer: 'genesis', config: {} }).config.preset)
      .toBe('chaotic');
    expect(cueForPick('focal', { type: 'standard', glyph: 'lotus' }, { kind: 'field', renderer: 'focal', config: {} })
      .config.standardGlyph).toBe('lotus');
    expect(cueForPick('fractal', {}, { kind: 'procedural', collections: ['fractal'] })).toBeNull();
    expect(cueForPick('harmonograph', { climate: 'nope' }, { kind: 'procedural', collections: ['harmonograph'] })
      .config.climate).toBe('auto');
  });

  it('what the scenes write, the Workshop compiles', () => {
    let data = session();
    data = { ...data, ...setSceneVisual(data, 'written-a', {
      assetId: 'surface:genesis', id: 'v1',
      cue: cueForPick('klee', { preset: 'chaotic' }, { kind: 'field', renderer: 'genesis', config: {} })
    }) };
    data = { ...data, ...setSceneSound(data, 'written-a', { assetId: 'soundscape:aurora', assets: audioAssets, id: 'a1' }) };
    data = { ...data, ...setSceneVisual(data, 'library-b', { assetId: 'procedural:fractal', id: 'v2' }) };
    const visualAssets = buildWorkshopVisualAssetRegistry({})
      .filter(entry => editorAssetSupports(entry.asset, 'span') && entry.asset.kind !== 'sequence-image')
      .map(entry => entry.asset);
    const program = compileWorkshopScoreProgram({
      programId: 'workshop-scenes-test',
      sources: data.sources.map(s => ({ id: s.id, name: s.name, text: s.data })),
      visualAssets,
      visualAssignments: data.visualScoreAssignments,
      audioAssets: audioAssets.filter(asset => asset.id === 'soundscape:aurora'),
      audioAssignments: data.audioScoreAssignments
    });
    const visual = program.tracks.find(track => track.kind === 'visual');
    expect(visual.clips).toHaveLength(2);
    expect(program.tracks.some(track => track.kind === 'audio')).toBe(true);
  });
});
