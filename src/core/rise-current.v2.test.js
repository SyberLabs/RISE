/**
 * rise.current.v2: beats and scenes through the Current's validator, score and
 * compiler (docs/superpowers/specs/2026-10-08-creative-control-design.md §5–6).
 */
import { describe, expect, it } from 'vitest';
import {
  RISE_CURRENT_SCHEMA, RISE_CURRENT_SCHEMA_V2, compileRiseCurrent, materializeRiseCurrent, validateRiseCurrent
} from './rise-current.js';

const V2 = Object.freeze({
  schema: 'rise.current.v2',
  id: 'vectors-length',
  title: 'How long is a vector?',
  theme: 'cobalt',
  style: 'premium-educational',
  type: { text: 'book-serif', caption: 'humanist-sans' },
  origin: { kind: 'model', name: 'Claude', provider: 'Anthropic' },
  scenes: [{ id: 'field', engine: 'attractor' }, { id: 'calm', engine: 'still' }],
  beats: [
    { say: 'Here is a vector.', scene: 'field', sound: 'starlight' },
    { hold: { ms: 3000, maxMs: 8000 }, cue: 'bright' },
    { say: 'Its length is root x squared plus y squared.', show: 'Its length is √(x² + y²).', place: 'caption' },
    { show: 'The Pythagorean theorem, in two dimensions. It holds in every right triangle.', hold: { ms: 2500 }, scene: 'calm', size: 'smaller' },
    { say: 'So the whole story is one idea.' }
  ]
});

const refuses = (input, code) => {
  let caught = null;
  try { validateRiseCurrent(input); } catch (error) { caught = error; }
  expect(caught?.code, `expected ${code}`).toBe(code);
};

describe('validating a v2 Current', () => {
  it('accepts beats and scenes, and keeps its style and type', () => {
    const current = validateRiseCurrent(V2);
    expect(current.schema).toBe(RISE_CURRENT_SCHEMA_V2);
    expect(current.beats).toHaveLength(5);
    expect(current.scenes).toEqual(V2.scenes);
    expect(current.style).toBe('premium-educational');
    expect(current.type).toEqual({ text: 'book-serif', caption: 'humanist-sans' });
    expect(Object.isFrozen(current)).toBe(true);
  });

  it('lowers beats to one passage each, with what is shown as the passage text', () => {
    const { segments } = validateRiseCurrent(V2);
    expect(segments.map(segment => segment.id)).toEqual(['beat-0', 'beat-1', 'beat-2', 'beat-3', 'beat-4']);
    expect(segments[2].text).toBe('Its length is √(x² + y²).');
    expect(segments[1].text).toBe('[HOLD]');
    expect(segments.map(segment => segment.visual)).toEqual(['attractor', 'attractor', 'attractor', 'still', 'still']);
  });

  it('refuses v1 fields on a v2 Current and v2 fields on a v1 Current, and an unknown style or type', () => {
    refuses({ ...V2, segments: [{ id: 'a', text: 'x' }] }, 'CURRENT_UNKNOWN_FIELD');
    const { beats: _b, scenes: _s, style: _st, type: _t, ...v1 } = V2;
    refuses({ ...v1, schema: RISE_CURRENT_SCHEMA, segments: [{ id: 'a', text: 'x' }], beats: [{ say: 'x' }] }, 'CURRENT_UNKNOWN_FIELD');
    refuses({ ...V2, beats: undefined }, 'BEAT_COUNT');
    refuses({ ...V2, style: 'baroque' }, 'CURRENT_STYLE');
    refuses({ ...V2, type: { text: 'comic-sans' } }, 'BEAT_TYPE');
    refuses({ ...V2, type: { margin: 'inter' } }, 'CURRENT_UNKNOWN_FIELD');
  });

  it('refuses a beat the way beats.js does, with the beat’s path', () => {
    let caught = null;
    try { validateRiseCurrent({ ...V2, beats: [{ say: 'x', scene: 'nope' }] }); } catch (error) { caught = error; }
    expect(caught.code).toBe('BEAT_SCENE');
    expect(caught.path).toBe('$.beats[0].scene');
  });
});

describe('the score of a v2 Current', () => {
  it('has a visual clip per passage following the running scene, and an audio cue where a beat has a sound', () => {
    const { program } = materializeRiseCurrent(V2);
    const track = kind => program.tracks.find(item => item.kind === kind);
    expect(track('visual').clips.map(clip => clip.cue.kind)).toEqual(['field', 'field', 'field', 'still', 'still']);
    expect(track('visual').clips[0].cue.renderer).toBe('attractor');
    expect(track('audio').clips).toHaveLength(1);
    expect(track('audio').clips[0]).toMatchObject({ anchor: { sourceIds: ['beat-0'] }, cue: { kind: 'soundscape', soundscapeId: 'starlight' } });
    expect(track('thread').clips).toEqual([]);
  });
});

describe('compiling a v2 Current', () => {
  it('gives a hold one silent atom with the hold’s own duration and its scene', () => {
    const session = compileRiseCurrent(V2);
    const holds = session.atoms.filter(atom => atom.sourceId === 'beat-1');
    expect(holds).toHaveLength(1);
    expect(holds[0].content).toBe('');
    expect(holds[0].duration).toBe(3000);
    expect(holds[0].hold).toEqual({ ms: 3000, maxMs: 8000, sceneId: 'field' });
  });

  it('gives a shown beat’s atoms the hold’s duration between them, in proportion to their words', () => {
    const session = compileRiseCurrent(V2);
    const shown = session.atoms.filter(atom => atom.sourceId === 'beat-3' && atom.content);
    expect(shown.length).toBeGreaterThan(1);
    expect(shown.reduce((sum, atom) => sum + atom.duration, 0)).toBe(2500);
    for (const atom of shown) expect(atom.beatTimed).toBe(true);
  });

  it('says which passages the voice speaks and which it does not', () => {
    const session = compileRiseCurrent(V2);
    expect([...session.spokenIds]).toEqual(['beat-0', 'beat-2', 'beat-4']);
    expect([...session.unspokenIds]).toEqual(['beat-1', 'beat-3']);
    expect(session.spokenText.get('beat-2')).toBe('Its length is root x squared plus y squared.');
  });

  it('times the seam into a passage no voice says with that passage, and names the spoken passages that come after one', () => {
    const session = compileRiseCurrent(V2);
    const seamInto = id => session.atoms[session.atoms.findIndex(atom => atom.sourceId === id) - 1];
    for (const id of ['beat-1', 'beat-3']) {
      expect(seamInto(id).seam).toBeDefined();
      expect(seamInto(id).beatTimed).toBe(true);
    }
    for (const id of ['beat-2', 'beat-4']) expect(seamInto(id).beatTimed).toBeUndefined();
    expect([...session.voiceWaitsFor]).toEqual(['beat-2', 'beat-4']);
  });

  it('leaves a v1 Current exactly as it was', () => {
    const session = compileRiseCurrent({
      schema: RISE_CURRENT_SCHEMA, id: 'v1', title: 'V1', origin: { kind: 'human', name: 'T' },
      segments: [{ id: 's', text: 'A passage.' }]
    });
    expect(session.spokenIds).toBeUndefined();
    expect(session.atoms.every(atom => atom.hold === undefined && atom.beatTimed === undefined)).toBe(true);
  });
});

describe('scenes with parameters', () => {
  it('lowers a persistent engine with the theme’s defaults under the scene’s parameters, and a pattern engine as a procedural cue the field admits', () => {
    const { program } = materializeRiseCurrent({ ...V2, scenes: [{ id: 'field', engine: 'attractor', params: { palette: 'jade' } }, { id: 'calm', engine: 'ostensoria', params: { palette: 'ice' } }] });
    const clips = program.tracks.find(track => track.kind === 'visual').clips;
    expect(clips[0].cue).toEqual({ kind: 'field', renderer: 'attractor', config: { system: 'thomas', palette: 'jade', form: 'mirror' } });
    expect(clips[3].cue).toEqual({ kind: 'procedural', collections: ['ostensoria'], config: { palette: 'ice' } });
    const session = compileRiseCurrent({ ...V2, scenes: [{ id: 'field', engine: 'attractor' }, { id: 'calm', engine: 'ostensoria' }] });
    expect(session.visualConfig.interlocution.procedural).toEqual(['ostensoria']);
    expect(session.visualConfig.visualMode).toBe('interlocution');
  });
});

describe('what a v2 Current carries for the layers', () => {
  it('puts each beat’s typography and cue on its atoms, the Current’s faces on the presentation, and says when there is maths', () => {
    const session = compileRiseCurrent(V2);
    const caption = session.atoms.find(atom => atom.sourceId === 'beat-2');
    expect(caption.beat).toEqual({ place: 'caption' });
    expect(session.atoms.find(atom => atom.sourceId === 'beat-1').beat).toEqual({ cue: 'bright' });
    expect(session.atoms.find(atom => atom.sourceId === 'beat-1').scene).toBe('field');
    expect(session.atoms.find(atom => atom.sourceId === 'beat-1').cueCommands).toEqual([{ surface: 'attractor', parameter: 'intensity', value: 0.75 }]);
    expect(session.atoms.find(atom => atom.sourceId === 'beat-3').scene).toBe('calm');
    expect(session.presentation.typeFaces).toEqual({ text: 'book-serif', caption: 'humanist-sans' });
    expect(session.hasMath).toBe(false);
    const withMath = compileRiseCurrent({ ...V2, beats: [{ say: 'x squared', show: 'So $x^2$.' }] });
    expect(withMath.hasMath).toBe(true);
  });
});
