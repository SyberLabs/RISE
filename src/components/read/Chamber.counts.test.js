/**
 * A reading's counts from the Chamber (src/core/telemetry.js): its begin, its end, and the first word after Home's Begin.
 *
 * What is held: the begin is counted once, at the first play or as the page opens, with where the reading came from
 * and how it opened; the end once, yes when the Player reaches the last word and no when the reader leaves or closes
 * the tab; the first word once, only for a reading Home's Begin opened, measured from that press. A reading that never
 * began is never ended, and no interval is left open for a later reading to measure from.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../core/telemetry.js', () => ({ count: vi.fn() }));

import { count } from '../../core/telemetry.js';
import { markBegin, takeBegin } from '../../core/begin-steps.js';
import { Chamber } from './Chamber.js';

function mount(session = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const player = { state: 'idle', pause: vi.fn(), play: vi.fn(), stop: vi.fn(), on: vi.fn(), setInterlocutionHandler: vi.fn() };
  const chamber = new Chamber(container, {
    session: { title: 'Meditations', atoms: [{ content: 'A thought', duration: 60000 }], totalDuration: 60000, atomCount: 1, visualConfig: { visualMode: 'off' }, ...session },
    player
  });
  // What the Player would say: each handler the Chamber gave it for `event`.
  const emit = (event, data) => { for (const [name, handler] of player.on.mock.calls) if (name === event) handler(data); };
  return { chamber, emit };
}

const counted = event => count.mock.calls.filter(([name]) => name === event).map(([, fields]) => fields);
const MINUTES = { minutes: expect.any(Number) };

afterEach(() => {
  document.body.replaceChildren();
  count.mockClear();
  takeBegin();
  vi.useRealTimers();
});

describe('a reading’s begin', () => {
  it('is counted once, at its first play, as the stream', () => {
    const { chamber, emit } = mount({ provenance: { kind: 'library-division' } });
    emit('state', { state: 'playing' });
    emit('state', { state: 'paused' });
    emit('state', { state: 'playing' });
    expect(counted('rise.reading.begun')).toEqual([{ source: 'library', mode: 'stream' }]);
    chamber.destroy();
  });

  it('names where it came from: the reader’s own text, a public address, RISE’s library, or other', () => {
    for (const [session, source] of [
      [{ provenance: { kind: 'local-text' } }, 'import'],
      [{ provenance: { kind: 'local-text' }, publicPath: '/try/your-text/' }, 'import'],
      [{ provenance: { kind: 'keystone' }, publicPath: '/keystones/meditations' }, 'public'],
      [{ provenance: { kind: 'library-division' }, publicPath: '/' }, 'public'],
      [{ provenance: { kind: 'library-work' } }, 'library'],
      [{ provenance: { kind: 'school' } }, 'library'],
      [{ provenance: { kind: 'chapel-book' } }, 'library'],
      [{ provenance: { kind: 'journey' } }, 'other'],
      [{}, 'other']
    ]) {
      count.mockClear();
      const { chamber, emit } = mount(session);
      emit('state', { state: 'playing' });
      expect(counted('rise.reading.begun'), JSON.stringify(session)).toEqual([{ source, mode: 'stream' }]);
      chamber.destroy();
    }
  });

  it('is counted as the page when the reading opens as one', () => {
    vi.useFakeTimers();
    const { chamber } = mount({ projection: 'page' });
    vi.advanceTimersByTime(120);
    expect(counted('rise.reading.begun')).toEqual([{ source: 'other', mode: 'page' }]);
    chamber.destroy();
  });
});

describe('a reading’s end', () => {
  it('is counted once, as yes, when the Player reaches the last word, and not again as the reader leaves', () => {
    vi.useFakeTimers();
    const { chamber, emit } = mount();
    emit('state', { state: 'playing' });
    emit('complete');
    chamber.destroy();
    window.dispatchEvent(new Event('pagehide'));
    expect(counted('rise.reading.ended')).toEqual([{ end: 'yes', ...MINUTES }]);
  });

  it('is counted once, as no, when the reader leaves before it, or closes the tab', () => {
    const left = mount();
    left.emit('state', { state: 'playing' });
    left.chamber.destroy();
    const closed = mount();
    closed.emit('state', { state: 'playing' });
    window.dispatchEvent(new Event('pagehide'));
    closed.chamber.destroy();
    window.dispatchEvent(new Event('pagehide'));
    expect(counted('rise.reading.ended')).toEqual([{ end: 'no', ...MINUTES }, { end: 'no', ...MINUTES }]);
  });

  it('is never counted for a reading that never began', () => {
    const { chamber } = mount();
    chamber.destroy();
    window.dispatchEvent(new Event('pagehide'));
    expect(count).not.toHaveBeenCalled();
  });
});

describe('the first word', () => {
  it('is counted once after Home’s Begin, from the press, at the first atom spoken or shown', () => {
    markBegin();
    const { chamber, emit } = mount({ origin: { view: 'home' } });
    emit('state', { state: 'playing' });
    emit('atom', { atom: { content: '' }, index: 0 });
    emit('atom', { atom: { content: 'A thought' }, index: 0, concealed: true });
    expect(counted('rise.reading.first_word')).toEqual([]);
    emit('atom', { atom: { content: 'A thought' }, index: 0 });
    emit('atom', { atom: { content: 'A thought' }, index: 0 });
    expect(counted('rise.reading.first_word')).toEqual([{ ms: expect.any(Number) }]);
    expect(counted('rise.reading.first_word')[0].ms).toBeGreaterThanOrEqual(0);
    expect(takeBegin()).toBeNull();
    chamber.destroy();
  });

  it('is not counted for a reading Home did not begin, nor for one that waited for a second press', () => {
    markBegin();
    const library = mount({ origin: { view: 'library' } });
    library.emit('state', { state: 'playing' });
    library.emit('atom', { atom: { content: 'A thought' }, index: 0 });
    library.chamber.destroy();
    const waited = mount({ origin: { view: 'home' } });
    expect(waited.chamber._deferToGesture()).toBe(true);
    waited.emit('state', { state: 'playing' });
    waited.emit('atom', { atom: { content: 'A thought' }, index: 0 });
    waited.chamber.destroy();
    expect(counted('rise.reading.first_word')).toEqual([]);
  });

  it('leaves no interval open when a reading Home began is left before its first word', () => {
    markBegin();
    const { chamber, emit } = mount({ origin: { view: 'home' } });
    emit('state', { state: 'playing' });
    chamber.destroy();
    expect(takeBegin()).toBeNull();
  });
});
