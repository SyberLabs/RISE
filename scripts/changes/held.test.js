import { describe, expect, it } from 'vitest';
import { validateRiseCurrent } from '../../src/core/rise-current.js';
import { EYE_SCENE, endHeldPictures, pictureCoverage, shownRuns } from './held.js';

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
  it('counts the beats each scene is actually shown under, and marks the eye’s runs as rest', () => {
    const beats = [{ scene: 'open' }, {}, {}, {}, {}, {}, {}];
    const starts = new Map([[0, { refs: null }], [1, { refs: [653] }]]);
    const refsAt = { 1: [653], 2: [653], 3: [655], 4: [655], 5: [655], 6: [655] };
    expect(shownRuns(beats.length, starts, refsAt)).toEqual({
      runs: [
        { start: 0, length: 1, rest: false, picture: false, cited: false },
        { start: 1, length: 2, rest: false, picture: true, cited: true },
        { start: 3, length: 4, rest: true, picture: false, cited: false }
      ],
      eye: true
    });
  });

  it('marks a run started by a declared still as rest', () => {
    const starts = new Map([[0, { refs: [653] }], [2, { refs: null, rest: true }]]);
    expect(shownRuns(8, starts, { 0: [653], 1: [653] }).runs.map(run => [run.start, run.length, run.rest])).toEqual([[0, 2, false], [2, 6, true]]);
  });

  it('counts a picture as cited only while every beat under it cites one of its changes', () => {
    const starts = new Map([[0, { refs: [653] }], [4, { refs: [655] }]]);
    const runs = shownRuns(8, starts, { 0: [653], 1: [653, 655], 2: [653], 3: [653], 4: [655], 6: [655], 7: [655] }).runs;
    expect(runs.map(run => [run.start, run.length, run.cited])).toEqual([[0, 4, true], [4, 4, false]]);
  });
});

describe('pictureCoverage', () => {
  it('counts the speaking beats a picture of what they speak of is shown under, and the longest run without one', () => {
    // An engine opens; a picture of #653 holds beats 1 to 2; #655 and #656 go to the eye; a picture of #656 holds 6 and 7.
    const starts = new Map([[0, { refs: null }], [1, { refs: [653] }], [6, { refs: [656] }]]);
    const refsAt = { 1: [653], 2: [653], 3: [655], 4: [655], 5: [656], 6: [656], 7: [656] };
    expect(pictureCoverage(8, starts, refsAt)).toEqual({ speaking: 7, pictured: 4, longest: 3, unpictured: [[3, 4, 5]] });
  });

  it('lets the eye rest on beats with no refs: they neither count nor break a run', () => {
    const starts = new Map([[0, { refs: [653] }]]);
    const refsAt = { 0: [653], 1: [655], 3: [655], 5: [653] };
    expect(pictureCoverage(6, starts, refsAt)).toEqual({ speaking: 4, pictured: 1, longest: 3, unpictured: [[1, 3, 5]] });
  });

  it('counts a speaking beat under an engine as unpictured, and a beat that shares one change with the picture as pictured', () => {
    const starts = new Map([[0, { refs: null }], [1, { refs: [653] }], [3, { refs: null }]]);
    const refsAt = { 0: [652], 1: [653], 2: [653, 655], 3: [655] };
    expect(pictureCoverage(4, starts, refsAt)).toEqual({ speaking: 4, pictured: 2, longest: 1, unpictured: [[0], [3]] });
  });
});
