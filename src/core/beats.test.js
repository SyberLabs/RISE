/**
 * Beats: the time a model composes (docs/superpowers/specs/2026-10-08-creative-control-design.md §5–6).
 *
 * A beat says and shows, holds while the scene plays, or shows without
 * saying. Validation refuses with a path and a code, as the Current does;
 * lowering turns beats into the synthetic passages the score and the Player
 * already understand, with the holds and sounds beside them.
 */
import { describe, expect, it } from 'vitest';
import { BEAT_LIMITS, lowerBeats, validateBeats, validateScenes } from './beats.js';

const SCENES = [{ id: 'field', engine: 'attractor' }, { id: 'calm', engine: 'still' }];
const sceneIds = new Set(SCENES.map(scene => scene.id));
const beats = (list, options = {}) => validateBeats(list, '$.beats', { sceneIds, ...options });
const refuses = (list, code, options) => {
  let caught = null;
  try { beats(list, options); } catch (error) { caught = error; }
  expect(caught, `expected ${code}`).not.toBeNull();
  expect(caught.code).toBe(code);
  return caught;
};

describe('the three kinds of beat', () => {
  it('reads a say beat, with what is shown defaulting to what is said', () => {
    const [said, shown] = beats([{ say: 'Here is a vector.' }, { say: 'x squared', show: 'x²', place: 'caption' }]);
    expect(said).toEqual({ kind: 'say', say: 'Here is a vector.', show: 'Here is a vector.' });
    expect(shown).toEqual({ kind: 'say', say: 'x squared', show: 'x²', place: 'caption' });
  });

  it('reads a hold, with its duration and the most it may stretch to', () => {
    const [hold] = beats([{ hold: { ms: 3000, maxMs: 8000 }, cue: 'rotate' }]);
    expect(hold).toEqual({ kind: 'hold', hold: { ms: 3000, maxMs: 8000 }, cue: 'rotate' });
    expect(beats([{ hold: { ms: 500 } }])[0].hold).toEqual({ ms: 500 });
  });

  it('reads a show beat: shown for a while, said by no one', () => {
    const [shown] = beats([{ show: 'The Pythagorean theorem.', hold: { ms: 2500 }, place: 'top', size: 'smaller' }]);
    expect(shown).toEqual({ kind: 'show', show: 'The Pythagorean theorem.', hold: { ms: 2500 }, place: 'top', size: 'smaller' });
  });

  it('refuses a beat that is none of the three, or two at once', () => {
    refuses([{}], 'BEAT_KIND');
    refuses([{ place: 'caption' }], 'BEAT_KIND');
    refuses([{ show: 'Alone, with no hold.' }], 'BEAT_KIND');
    refuses([{ say: 'Said', hold: { ms: 1000 } }], 'BEAT_KIND');
    refuses([{ hold: { ms: 1000 }, show: 'x', say: 'y' }], 'BEAT_KIND');
  });
});

describe('what a beat may carry', () => {
  it('admits a scene it knows, a cue, a transition, a place, a size, a face, emphasis and a sound', () => {
    const [beat] = beats([{
      say: 'Here.', scene: 'field', cue: 'draw', transition: { ms: 400 }, place: 'left', size: 'display',
      type: 'book-serif', emphasis: ['Here'], sound: 'starlight'
    }]);
    expect(beat.scene).toBe('field');
    expect(beat.cue).toBe('draw');
    expect(beat.transition).toEqual({ ms: 400 });
    expect(beat.type).toBe('book-serif');
    expect(beat.emphasis).toEqual(['Here']);
    expect(beat.sound).toBe('starlight');
  });

  it('refuses what it does not know', () => {
    refuses([{ say: 'x', scene: 'nope' }], 'BEAT_SCENE');
    refuses([{ say: 'x', place: 'margin' }], 'BEAT_PLACE');
    refuses([{ say: 'x', size: 'huge' }], 'BEAT_SIZE');
    refuses([{ say: 'x', type: 'comic-sans' }], 'BEAT_TYPE');
    refuses([{ say: 'x', sound: 'airhorn' }], 'BEAT_SOUND');
    refuses([{ say: 'x', cue: 'has space' }], 'BEAT_CUE');
    refuses([{ say: 'x', extra: true }], 'CURRENT_UNKNOWN_FIELD');
  });

  it('bounds every field', () => {
    refuses([{ hold: { ms: BEAT_LIMITS.holdMinMs - 1 } }], 'BEAT_HOLD');
    refuses([{ hold: { ms: BEAT_LIMITS.holdMaxMs + 1 } }], 'BEAT_HOLD');
    refuses([{ hold: { ms: 2000, maxMs: 1000 } }], 'BEAT_HOLD');
    refuses([{ hold: { ms: 2000, maxMs: BEAT_LIMITS.holdMaxMs + 1 } }], 'BEAT_HOLD');
    refuses([{ say: 'x', cue: 'c'.repeat(BEAT_LIMITS.cue + 1) }], 'BEAT_CUE');
    refuses([{ say: 'x', emphasis: Array.from({ length: BEAT_LIMITS.emphasis + 1 }, () => 'w') }], 'BEAT_EMPHASIS');
    refuses([{ say: 'x', emphasis: ['w'.repeat(BEAT_LIMITS.emphasisLength + 1)] }], 'BEAT_EMPHASIS');
    refuses([{ say: 'x', transition: { ms: BEAT_LIMITS.transitionMaxMs + 1 } }], 'BEAT_TRANSITION');
    refuses([{ say: 'x'.repeat(4_001) }], 'CURRENT_TEXT');
    refuses(Array.from({ length: BEAT_LIMITS.beats + 1 }, () => ({ say: 'x' })), 'BEAT_COUNT');
    refuses([], 'BEAT_COUNT');
  });

  it('refuses a reserved playback marker in what is said or shown, as a passage does', () => {
    refuses([{ say: 'Wait [PAUSE] here' }], 'CURRENT_RESERVED_TEXT');
    refuses([{ say: 'x', show: 'a | b' }], 'CURRENT_RESERVED_TEXT');
  });

  it('counts all the text of a Current together', () => {
    const long = 'x'.repeat(4_000);
    refuses(Array.from({ length: 6 }, () => ({ say: long })), 'CURRENT_TOTAL_TEXT');
  });
});

describe('scenes, in this release', () => {
  it('admits a native scene by engine, with no parameters yet', () => {
    expect(validateScenes(SCENES, '$.scenes')).toEqual(SCENES.map(scene => ({ ...scene })));
    expect(validateScenes([{ id: 'f', engine: 'genesis', params: {} }], '$.scenes')).toEqual([{ id: 'f', engine: 'genesis' }]);
  });

  it('refuses an unknown engine, parameters, generated code, a duplicate id, and too many', () => {
    const refusesScene = (list, code) => {
      let caught = null;
      try { validateScenes(list, '$.scenes'); } catch (error) { caught = error; }
      expect(caught?.code).toBe(code);
    };
    refusesScene([{ id: 'f', engine: 'fractal' }], 'SCENE_ENGINE');
    refusesScene([{ id: 'f', engine: 'attractor', params: { energy: 1 } }], 'SCENE_PARAMS');
    refusesScene([{ id: 'f', code: 'export default () => ({})' }], 'SCENE_CODE');
    refusesScene([{ id: 'f', engine: 'attractor' }, { id: 'f', engine: 'still' }], 'CURRENT_DUPLICATE_ID');
    refusesScene(Array.from({ length: BEAT_LIMITS.scenes + 1 }, (_, i) => ({ id: `s${i}`, engine: 'still' })), 'SCENE_COUNT');
  });
});

describe('lowering beats to the passages the score understands', () => {
  const current = {
    scenes: SCENES,
    beats: beats([
      { say: 'One.', scene: 'field', sound: 'starlight' },
      { hold: { ms: 3000, maxMs: 8000 }, cue: 'rotate' },
      { say: 'Two squared.', show: 'Two²', place: 'caption' },
      { show: 'A title.', hold: { ms: 2500 }, scene: 'calm' },
      { say: 'Three.', sound: 'none' }
    ])
  };

  it('makes one passage per beat, in order, with stable ids', () => {
    const { segments } = lowerBeats(current);
    expect(segments.map(segment => segment.id)).toEqual(['beat-0', 'beat-1', 'beat-2', 'beat-3', 'beat-4']);
  });

  it('shows what is shown, says what is said, and holds with the one marker the chunker times', () => {
    const { segments } = lowerBeats(current);
    expect(segments[0]).toMatchObject({ text: 'One.', spoken: 'One.' });
    expect(segments[1]).toMatchObject({ text: '[HOLD]', spoken: null, hold: { ms: 3000, maxMs: 8000, sceneId: 'field' } });
    expect(segments[2]).toMatchObject({ text: 'Two²', spoken: 'Two squared.' });
    expect(segments[3]).toMatchObject({ text: 'A title.', spoken: null, shownMs: 2500 });
  });

  it('keeps a scene running across beats until another starts: the passage draws the scene’s engine', () => {
    const { segments } = lowerBeats(current);
    expect(segments.map(segment => segment.visual)).toEqual(['attractor', 'attractor', 'attractor', 'still', 'still']);
  });

  it('draws nothing of its own before any scene has started, so a look may', () => {
    const { segments } = lowerBeats({ scenes: [], beats: beats([{ say: 'A' }, { say: 'B' }], { sceneIds: new Set() }) });
    expect(segments.map(segment => segment.visual)).toEqual([undefined, undefined]);
  });

  it('turns a sound into an audio cue on its passage: a bed, a tone, or silence', () => {
    const { audio } = lowerBeats(current);
    expect(audio).toEqual([
      { segmentId: 'beat-0', cue: { kind: 'soundscape', soundscapeId: 'starlight' } },
      { segmentId: 'beat-4', cue: { kind: 'silence' } }
    ]);
    const tone = lowerBeats({ scenes: [], beats: beats([{ say: 'A', sound: 'focus' }], { sceneIds: new Set() }) });
    expect(tone.audio).toEqual([{ segmentId: 'beat-0', cue: { kind: 'tone', presetId: 'focus' } }]);
  });

  it('carries each beat’s typography and cue on its passage for the layers that render them', () => {
    const { segments } = lowerBeats(current);
    expect(segments[2].beat).toEqual({ place: 'caption' });
    expect(segments[1].beat).toEqual({ cue: 'rotate' });
    expect(segments[0].beat).toEqual({ scene: 'field' });
  });

  it('names what is spoken and what is not, for the voice', () => {
    const { spokenIds, unspokenIds } = lowerBeats(current);
    expect([...spokenIds]).toEqual(['beat-0', 'beat-2', 'beat-4']);
    expect([...unspokenIds]).toEqual(['beat-1', 'beat-3']);
  });
});
