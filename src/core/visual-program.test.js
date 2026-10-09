import { describe, expect, it } from 'vitest';
import {
  deserializeVisualProgram,
  normalizeAudioProgram,
  normalizeVisualCue,
  normalizeVisualProgram,
  serializeVisualProgram,
  visualFallbackCueFromConfig
} from './visual-program.js';
import { compileSession } from './session-compiler.js';
import { flameComposition } from './theme-engine-map.js';
import { VisualScheduleController } from './visual-scheduler.js';

const program = {
  coordinateSpace: 'scripture',
  enabled: true,
  segments: [{
    id: 'entombment',
    match: { chapter: 27, verseStart: 57, verseEnd: Infinity },
    cue: { kind: 'sourced', collections: ['chapel-gospel-entombment'] }
  }],
  fallback: { kind: 'still' }
};

describe('a saved audio program that names a parked Feelings soundscape', () => {
  it('reads each parked cue as its stand-in and leaves an offered one as it is', () => {
    const saved = {
      coordinateSpace: 'source',
      segments: [
        { id: 'a', match: { sourceIds: ['s1'], fromProgress: 0, toProgress: 0.5 }, cue: { kind: 'soundscape', soundscapeId: 'chase', fadeMs: 500 } },
        { id: 'b', match: { sourceIds: ['s1'], fromProgress: 0.5, toProgress: 1 }, cue: { kind: 'soundscape', soundscapeId: 'aurora', fadeMs: 500 } }
      ],
      fallback: { kind: 'soundscape', soundscapeId: 'wonder' }
    };
    const program = normalizeAudioProgram(saved);
    expect(program.segments.map(segment => segment.cue.soundscapeId)).toEqual(['night-drive', 'aurora']);
    expect(program.fallback.soundscapeId).toBe('aurora');
  });
});

describe('visual program persistence boundary', () => {
  it('round-trips an end-of-chapter range through JSON without losing Infinity', () => {
    const json = JSON.stringify(serializeVisualProgram(program));
    expect(json).not.toContain('"verseEnd":null');

    const restored = deserializeVisualProgram(JSON.parse(json));
    expect(restored.segments[0].match.verseEnd).toBe(Infinity);
    expect(restored.segments[0].cue.collections).toEqual(['chapel-gospel-entombment']);
  });

  it('bounds and rejects malformed executable programs', () => {
    expect(normalizeVisualProgram({ coordinateSpace: 'screen', segments: [] })).toBeNull();
    expect(normalizeVisualProgram({
      coordinateSpace: 'scripture',
      segments: [{ id: 'bad', match: { chapter: 27, verseStart: 5, verseEnd: 2 } }]
    })).toBeNull();
  });

  it('persists visual fields and lowers legacy whole-reading defaults to cues', () => {
    const fieldProgram = {
      coordinateSpace: 'source',
      segments: [{
        id: 'genesis', match: { sourceIds: ['source-1'] },
        cue: { kind: 'field', renderer: 'genesis', config: { preset: 'harmonic', glass: false } }
      }],
      fallback: { kind: 'field', renderer: 'attractor', config: { system: 'thomas' } }
    };
    expect(deserializeVisualProgram(JSON.parse(JSON.stringify(
      serializeVisualProgram(fieldProgram)
    )))).toEqual(fieldProgram);
    expect(visualFallbackCueFromConfig({
      visualMode: 'focals', focals: { standardGlyph: 'star' }
    })).toEqual({
      kind: 'field', renderer: 'focal', config: { standardGlyph: 'star' }
    });
  });

  it('lowers a Living Flame reading to its field, in the classic composition where no theme is known', () => {
    const cue = visualFallbackCueFromConfig({ visualMode: 'living-flame' });
    expect(cue).toMatchObject({ kind: 'field', renderer: 'living-flame' });
    expect(cue.config.recipe.id).toBe(flameComposition(null));
    expect(normalizeVisualCue(cue)).toEqual(cue);
  });

  it('keeps a generated scene’s id and code, and stills one that is malformed or too large', () => {
    const cue = { kind: 'scene', sceneId: 'vector', code: 'export default () => ({ frame() {} })' };
    expect(normalizeVisualCue({ ...cue, extra: true })).toEqual(cue);
    expect(normalizeVisualCue({ ...cue, code: 7 })).toEqual({ kind: 'still' });
    expect(normalizeVisualCue({ ...cue, sceneId: '' })).toEqual({ kind: 'still' });
    expect(normalizeVisualCue({ ...cue, code: 'x'.repeat(24_577) })).toEqual({ kind: 'still' });
  });

  it('keeps a figure’s id and svg, and stills one that is malformed, too large, or both code and svg', () => {
    const cue = { kind: 'scene', sceneId: 'triangle', svg: '<svg/>' };
    expect(normalizeVisualCue({ ...cue, extra: true })).toEqual(cue);
    expect(normalizeVisualCue({ ...cue, svg: 7 })).toEqual({ kind: 'still' });
    expect(normalizeVisualCue({ ...cue, svg: 'x'.repeat(32_769) })).toEqual({ kind: 'still' });
    expect(normalizeVisualCue({ ...cue, code: 'export default () => ({})' })).toEqual({ kind: 'still' });
  });

  it('round-trips bounded procedural styles without carrying unknown fields', () => {
    const styled = {
      coordinateSpace: 'source',
      segments: [{
        id: 'klee-harmonic', match: { sourceIds: ['source-1'] },
        cue: {
          kind: 'procedural', collections: ['klee'],
          config: { preset: 'harmonic', injected: true }
        }
      }],
      fallback: { kind: 'still' }
    };
    expect(deserializeVisualProgram(JSON.parse(JSON.stringify(
      serializeVisualProgram(styled)
    ))).segments[0].cue).toEqual({
      kind: 'procedural', collections: ['klee'], config: { preset: 'harmonic' }
    });
  });

  it('keeps only shipped color themes on procedural phase cues', () => {
    const input = {
      coordinateSpace: 'source',
      segments: [
        { id: 'first', match: { sourceIds: ['primary'] },
          cue: { kind: 'procedural', collections: ['fractal'], colorTheme: 'prism' } },
        { id: 'second', match: { sourceIds: ['primary'] },
          cue: { kind: 'procedural', collections: ['klee'], colorTheme: 'custom-css' } }
      ],
      fallback: { kind: 'still' }
    };
    const cues = deserializeVisualProgram(JSON.parse(JSON.stringify(
      serializeVisualProgram(input)
    ))).segments.map(segment => segment.cue);
    expect(cues[0].colorTheme).toBe('prism');
    expect(cues[1]).not.toHaveProperty('colorTheme');
  });

  it('continues through compilation and activates the restored final episode', () => {
    const restored = deserializeVisualProgram(JSON.parse(
      JSON.stringify(serializeVisualProgram(program))
    ));
    const session = compileSession({
      text: '[v 27:57] And when it was evening, there came a certain rich man.',
      textSource: 'The Chapel · Matthew 27',
      chunkProfile: 'scripture',
      chunkMode: 'phrase',
      visualProgram: restored
    });
    const verseAtom = session.atoms.find(atom => atom.chapter === 27 && atom.verse === 57);
    const seen = [];
    const schedule = new VisualScheduleController(
      session.visualProgram,
      cue => seen.push(cue)
    );

    schedule.observe(verseAtom);

    expect(session.visualProgram.segments[0].match.verseEnd).toBe(Infinity);
    expect(seen).toEqual([
      { kind: 'sourced', collections: ['chapel-gospel-entombment'] }
    ]);
  });
});
