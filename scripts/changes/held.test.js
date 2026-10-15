import { describe, expect, it } from 'vitest';
import { validateRiseCurrent } from '../../src/core/rise-current.js';
import { EYE_SCENE, endHeldPictures, shownRuns } from './held.js';

const current = (beats, scenes) => ({
  schema: 'rise.current.v2', id: 'week', title: 'What changed in RISE', theme: 'cobalt',
  origin: { kind: 'model', name: 'm', provider: 'p' }, scenes, beats
});
const figure = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><circle cx="5" cy="5" r="2"/></svg>';
const scenes = () => [{ id: 'open', engine: 'attractor' }, { id: 'picture-1', svg: figure }, { id: 'picture-2', svg: figure }];
const say = (text, extra = {}) => ({ say: text, ...extra });

describe('endHeldPictures', () => {
  it('returns to RISE’s eye at the first beat that shares nothing with the picture on screen', () => {
    const beats = [say('Open.', { scene: 'open' }), say('Frames.', { scene: 'picture-1' }), say('More frames.'), say('Memory.'), say('More memory.')];
    const sources = { 1: [653], 2: [653], 3: [655], 4: [655] };
    const { current: shown, ended } = endHeldPictures(current(beats, scenes()), { sources, pictureRefs: { 'picture-1': [653] } });
    expect(ended).toEqual([3]);
    expect(shown.beats[2].scene).toBeUndefined();
    expect(shown.beats[3].scene).toBe(EYE_SCENE.id);
    expect(shown.beats[4].scene).toBeUndefined();
    expect(shown.scenes).toContainEqual(EYE_SCENE);
    expect(() => validateRiseCurrent(shown)).not.toThrow();
  });

  it('keeps a picture under beats that share one of its changes, and under beats with no refs', () => {
    const beats = [say('Open.', { scene: 'open' }), say('Frames and fit.', { scene: 'picture-1' }), say('Fit.'), say('A pause.'), say('Frames again.')];
    const sources = { 1: [653, 661], 2: [661], 4: [653] };
    const { current: shown, ended } = endHeldPictures(current(beats, scenes()), { sources, pictureRefs: { 'picture-1': [653, 661] } });
    expect(ended).toEqual([]);
    expect(shown.scenes.some(scene => scene.id === EYE_SCENE.id)).toBe(false);
    expect(shown.beats.filter(beat => beat.scene !== undefined)).toHaveLength(2);
  });

  it('leaves RISE’s engines at the opening and the close as they are', () => {
    const beats = [say('Open.', { scene: 'open' }), say('Frames.'), say('Memory.'), say('Close.', { scene: 'open' })];
    const sources = { 1: [653], 2: [655] };
    const { current: shown, ended } = endHeldPictures(current(beats, scenes()), { sources, pictureRefs: {} });
    expect(ended).toEqual([]);
    expect(shown.beats.map(beat => beat.scene)).toEqual(['open', undefined, undefined, 'open']);
  });

  it('returns to a still the Current already declares, and lets go of a cue meant for the picture', () => {
    const declared = [...scenes(), { id: 'close', engine: 'still' }];
    const beats = [say('Open.', { scene: 'open' }), say('Frames.', { scene: 'picture-1' }), say('Memory.', { cue: 'draw' }), say('Close.', { scene: 'close' })];
    const { current: shown, ended } = endHeldPictures(current(beats, declared), { sources: { 1: [653], 2: [655] }, pictureRefs: { 'picture-1': [653] } });
    expect(ended).toEqual([2]);
    expect(shown.beats[2]).toEqual({ say: 'Memory.', scene: 'close' });
    expect(shown.scenes).toHaveLength(4);
  });

  it('ends a picture again after the eye, at the next unrelated beat, and starts the next picture as written', () => {
    const beats = [say('Frames.', { scene: 'picture-1' }), say('Memory.'), say('Swarm.', { scene: 'picture-2' }), say('Room.')];
    const { current: shown, ended } = endHeldPictures(current(beats, scenes()), { sources: { 0: [653], 1: [655], 2: [652], 3: [665] }, pictureRefs: { 'picture-1': [653], 'picture-2': [652] } });
    expect(ended).toEqual([1, 3]);
    expect(shown.beats.map(beat => beat.scene)).toEqual(['picture-1', EYE_SCENE.id, 'picture-2', EYE_SCENE.id]);
  });
});

describe('shownRuns', () => {
  it('counts the beats each scene is actually shown under, the eye included', () => {
    const beats = [{ scene: 'open' }, {}, {}, {}, {}, {}, {}];
    const starts = new Map([[0, { refs: null }], [1, { refs: [653] }]]);
    const refsAt = { 1: [653], 2: [653], 3: [655], 4: [655], 5: [655], 6: [655] };
    expect(shownRuns(beats.length, starts, refsAt)).toEqual({ runs: [[0, 1], [1, 2], [3, 4]], eye: true });
  });
});
