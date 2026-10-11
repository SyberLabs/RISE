/**
 * A sealed v2 Current as events: the beat stream it would have been. Each
 * scene is declared, its source in pieces, before the first beat that starts
 * it; each beat carries its fields, and its words are what it says (a shown
 * beat's, what it shows; a hold's, none). The Current itself rides beside the
 * stream (the adapter's `sealed`), which is what the runtime compiles.
 */
import { describe, expect, it } from 'vitest';
import { EVENT_LIMITS } from '../protocol.js';
import { currentToEvents } from './current-events.js';

const V2 = {
  schema: 'rise.current.v2',
  id: 'sky',
  title: 'Why the sky is blue',
  origin: { kind: 'model', name: 'Claude', provider: 'Anthropic' },
  look: 'gallery',
  scenes: [{ id: 'field', engine: 'attractor', params: { palette: 'blue' } }],
  beats: [
    { say: 'Sunlight carries every colour at once.', scene: 'field' },
    { hold: { ms: 2000, maxMs: 4000 }, cue: 'calm' },
    { say: 'x squared', show: 'x²', place: 'caption' },
    { show: 'A title.', hold: { ms: 1500 }, size: 'display' }
  ]
};

describe('a v2 Current as events', () => {
  it('opens with the Current’s head, declares a scene before the beat that starts it, and sends each beat with its words', () => {
    const events = currentToEvents(V2);
    expect(events[0]).toEqual({ type: 'current.open', body: { title: 'Why the sky is blue', origin: V2.origin, look: 'gallery' } });
    expect(events[1]).toEqual({ type: 'scene.declare', body: { sceneId: 'field', engine: 'attractor', params: { palette: 'blue' } } });
    const begins = events.filter(event => event.type === 'segment.begin').map(event => event.body);
    expect(begins).toEqual([
      { segmentId: 'beat-0', beat: { scene: 'field' } },
      { segmentId: 'beat-1', beat: { hold: { ms: 2000, maxMs: 4000 }, cue: 'calm' } },
      { segmentId: 'beat-2', beat: { show: 'x²', place: 'caption' } },
      { segmentId: 'beat-3', beat: { hold: { ms: 1500 }, size: 'display' } }
    ]);
    const texts = Object.fromEntries(events.filter(event => event.type === 'segment.text').map(event => [event.body.segmentId, event.body.text]));
    // The words are what is said, or for a shown beat what is shown; a hold commits none.
    expect(texts).toEqual({ 'beat-0': 'Sunlight carries every colour at once.', 'beat-2': 'x squared', 'beat-3': 'A title.' });
    expect(events.filter(event => event.type === 'segment.end').map(event => event.body.segmentId)).toEqual(['beat-0', 'beat-1', 'beat-2', 'beat-3']);
    expect(events.at(-1)).toEqual({ type: 'current.complete', body: {} });
  });

  it('sends a generated scene’s or a figure’s source in pieces that fit an event, in order', () => {
    const code = `const T = [${'1, '.repeat(1500)}1];\nexport default () => ({ frame() {} });\n`;
    const scenes = [{ id: 'vector', code }, { id: 'flame', engine: 'living-flame' }];
    const events = currentToEvents({ ...V2, scenes, beats: [{ say: 'A vector.', scene: 'vector' }, { say: 'A flame.', scene: 'flame' }] });
    expect(events.filter(event => event.type === 'scene.declare').map(event => event.body)).toEqual([
      { sceneId: 'vector', form: 'code' }, { sceneId: 'flame', engine: 'living-flame' }
    ]);
    const pieces = events.filter(event => event.type === 'scene.text').map(event => event.body);
    expect(pieces.length).toBeGreaterThan(1);
    expect(pieces.every(piece => piece.text.length <= EVENT_LIMITS.sceneChunk)).toBe(true);
    expect(pieces.map(piece => piece.text).join('')).toBe(code);
    expect(pieces.map(piece => piece.offset)).toEqual(pieces.map((_, i) => pieces.slice(0, i).reduce((sum, piece) => sum + piece.text.length, 0)));
    // The source comes before the beat that starts its scene.
    const at = type => events.findIndex(event => event.type === type);
    expect(at('scene.text')).toBeLessThan(at('segment.begin'));
  });

  it('refuses what the validator refuses', () => {
    expect(() => currentToEvents({ ...V2, beats: [{ hold: { ms: 10 } }] })).toThrow(/hold/u);
  });
});
