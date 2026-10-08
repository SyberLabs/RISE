/**
 * A sealed v2 Current as events: one passage per beat that is shown, carrying
 * what the voice says; a hold sends nothing, since nothing of it is shown or
 * said through the stream. The Current itself rides beside the stream (the
 * adapter's `sealed`), which is what the runtime compiles.
 */
import { describe, expect, it } from 'vitest';
import { currentToEvents } from './current-events.js';

const V2 = {
  schema: 'rise.current.v2',
  id: 'sky',
  title: 'Why the sky is blue',
  origin: { kind: 'model', name: 'Claude', provider: 'Anthropic' },
  look: 'gallery',
  scenes: [{ id: 'field', engine: 'attractor' }],
  beats: [
    { say: 'Sunlight carries every colour at once.', scene: 'field' },
    { hold: { ms: 2000 } },
    { say: 'x squared', show: 'x²' },
    { show: 'A title.', hold: { ms: 1500 } }
  ]
};

describe('a v2 Current as events', () => {
  it('opens with the Current’s head, says each spoken beat, shows each shown one, and sends nothing for a hold', () => {
    const events = currentToEvents(V2);
    expect(events[0]).toEqual({ type: 'current.open', body: { title: 'Why the sky is blue', origin: V2.origin, look: 'gallery' } });
    const begins = events.filter(event => event.type === 'segment.begin').map(event => event.body);
    expect(begins.map(body => body.segmentId)).toEqual(['beat-0', 'beat-2', 'beat-3']);
    expect(begins[0]).toEqual({ segmentId: 'beat-0', visual: 'attractor' });
    const texts = Object.fromEntries(events.filter(event => event.type === 'segment.text').map(event => [event.body.segmentId, event.body.text]));
    // The stream carries the voice's text for a spoken beat, and the shown text for a shown one.
    expect(texts).toEqual({ 'beat-0': 'Sunlight carries every colour at once.', 'beat-2': 'x squared', 'beat-3': 'A title.' });
    expect(events.filter(event => event.type === 'dive.attach')).toEqual([]);
    expect(events.at(-1)).toEqual({ type: 'current.complete', body: {} });
  });

  it('names a scene’s visual on the stream only where the stream’s vocabulary has it: a Living Flame rides on the sealed Current alone', () => {
    const scenes = [{ id: 'flame', engine: 'living-flame' }, { id: 'plate', engine: 'ostensoria' }];
    const events = currentToEvents({ ...V2, scenes, beats: [{ say: 'A flame.', scene: 'flame' }, { say: 'A plate.', scene: 'plate' }] });
    const begins = events.filter(event => event.type === 'segment.begin').map(event => event.body);
    expect(begins).toEqual([{ segmentId: 'beat-0' }, { segmentId: 'beat-1' }]);
  });

  it('refuses what the validator refuses', () => {
    expect(() => currentToEvents({ ...V2, beats: [{ hold: { ms: 10 } }] })).toThrow(/hold/u);
  });
});
