import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ReadingStream } from './reading-stream.js';

// Two verse lines, a stanza break, one more line: the shape of Today's poem.
const POEM = 'The owners of the mine.\nI pulled the wires with judge and jury,\n\nAnd the upper courts.';

const reduce = matches => vi.stubGlobal('matchMedia', vi.fn(() => ({ matches })));
let hidden = false;
const setHidden = value => {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
};

describe('the reading stream', () => {
  let host;
  let progress;
  let stream;
  const shown = () => [
    host.querySelector('.reading-stream-previous')?.textContent,
    host.querySelector('.reading-stream-current')?.textContent
  ];
  /** Every unit the stream shows, in order, until it rests. */
  const unitsOf = (text, chunkMode) => {
    stream.play(text, { chunkMode, wpm: 6000 });
    const units = [shown()[1]];
    while (!progress.includes(1)) {
      vi.advanceTimersToNextTimer();
      if (!progress.includes(1)) units.push(shown()[1]);
    }
    return units;
  };

  beforeEach(() => {
    vi.useFakeTimers();
    reduce(false);
    hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    host = document.createElement('div');
    progress = [];
    stream = new ReadingStream(host, { onProgress: fraction => progress.push(fraction) });
  });
  afterEach(() => {
    stream.destroy();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    delete document.hidden;
  });

  it('is decorative to assistive technology', () => {
    expect(host.getAttribute('aria-hidden')).toBe('true');
  });

  it('cuts the text the way the Chamber does, and a line break never shows as an empty unit', () => {
    expect(unitsOf(POEM, 'phrase')).toEqual([
      'The owners of the mine.',
      'I pulled the wires with judge and jury,',
      'And the upper courts.'
    ]);
    progress.length = 0;
    expect(unitsOf(POEM, 'word')).toEqual(
      'The owners of the mine. I pulled the wires with judge and jury, And the upper courts.'.split(' ')
    );
    progress.length = 0;
    expect(unitsOf('One sentence here. Then another one.', 'sentence'))
      .toEqual(['One sentence here.', 'Then another one.']);
    progress.length = 0;
    expect(unitsOf('First paragraph, short.\n\nSecond paragraph.', 'paragraph'))
      .toEqual(['First paragraph, short.', 'Second paragraph.']);
  });

  it('shows the previous unit dim above the current one', () => {
    stream.play(POEM, { chunkMode: 'phrase', wpm: 120 });
    expect(shown()).toEqual(['', 'The owners of the mine.']);
    vi.advanceTimersByTime(2500);
    expect(shown()).toEqual(['The owners of the mine.', 'I pulled the wires with judge and jury,']);
  });

  it('holds each unit for its words at the pace, never under 300 ms', () => {
    // 120 wpm is 500 ms a word: five words hold 2.5 s.
    stream.play(POEM, { chunkMode: 'phrase', wpm: 120 });
    vi.advanceTimersByTime(2499);
    expect(shown()[1]).toBe('The owners of the mine.');
    vi.advanceTimersByTime(1);
    expect(shown()[1]).toBe('I pulled the wires with judge and jury,');

    // 400 wpm is 150 ms a word, which the floor lifts to 300.
    stream.play(POEM, { chunkMode: 'word', wpm: 400 });
    vi.advanceTimersByTime(299);
    expect(shown()[1]).toBe('The');
    vi.advanceTimersByTime(1);
    expect(shown()[1]).toBe('owners');
  });

  it('rests 2.4 s after the last unit, then reads again from the start, reporting progress', () => {
    stream.play(POEM, { chunkMode: 'phrase', wpm: 120 });
    vi.advanceTimersByTime(2500 + 4000 + 2000);
    expect(shown()[1]).toBe('And the upper courts.');
    expect(progress).toEqual([0, 1 / 3, 2 / 3, 1]);
    vi.advanceTimersByTime(2399);
    expect(shown()[1]).toBe('And the upper courts.');
    vi.advanceTimersByTime(1);
    expect(shown()).toEqual(['', 'The owners of the mine.']);
    expect(progress).toEqual([0, 1 / 3, 2 / 3, 1, 0]);
  });

  it('under reduced motion shows the opening still, with no timers', () => {
    reduce(true);
    // The opening runs on while it fits in about 90 characters: three
    // phrases are 85, and the fourth would make 105.
    stream.play(`${POEM}\nThen the rats came.`, { chunkMode: 'phrase', wpm: 300 });
    expect(shown()).toEqual(['', 'The owners of the mine. I pulled the wires with judge and jury, And the upper courts.']);
    expect(progress).toEqual([0]);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('waits while the tab is hidden and picks up when it is seen again', () => {
    stream.play(POEM, { chunkMode: 'phrase', wpm: 120 });
    setHidden(true);
    expect(vi.getTimerCount()).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(shown()[1]).toBe('The owners of the mine.');
    setHidden(false);
    vi.advanceTimersByTime(2500);
    expect(shown()[1]).toBe('I pulled the wires with judge and jury,');
  });

  it('does not start while the tab is hidden', () => {
    hidden = true;
    stream.play(POEM, { chunkMode: 'phrase', wpm: 120 });
    expect(shown()[1]).toBe('The owners of the mine.');
    expect(vi.getTimerCount()).toBe(0);
  });

  it('stop keeps what is shown and leaves no timers, even when the tab comes back', () => {
    stream.play(POEM, { chunkMode: 'phrase', wpm: 120 });
    vi.advanceTimersByTime(2500);
    stream.stop();
    expect(vi.getTimerCount()).toBe(0);
    setHidden(true);
    setHidden(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(shown()[1]).toBe('I pulled the wires with judge and jury,');
  });

  it('destroy empties the host and leaves no timers', () => {
    stream.play(POEM, { chunkMode: 'phrase', wpm: 120 });
    stream.destroy();
    setHidden(false);
    expect(vi.getTimerCount()).toBe(0);
    expect(host.children).toHaveLength(0);
  });

  it('play again restarts with the new text and its mode', () => {
    stream.play(POEM, { chunkMode: 'phrase', wpm: 120 });
    vi.advanceTimersByTime(2500);
    stream.play('latest news', { chunkMode: 'word', wpm: 300 });
    expect(shown()).toEqual(['', 'latest']);
    expect(host.dataset.chunkMode).toBe('word');
    expect(vi.getTimerCount()).toBe(1);
  });
});
