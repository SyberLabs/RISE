import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';

const DISPLAY_RECT = {
  left: 100,
  top: 100,
  right: 500,
  bottom: 260,
  width: 400,
  height: 160,
  x: 100,
  y: 100,
  toJSON() {}
};

const WORD_RECTS = [
  {
    left: 160,
    top: 136,
    right: 220,
    bottom: 176,
    width: 60,
    height: 40,
    x: 160,
    y: 136,
    toJSON() {}
  },
  {
    left: 230,
    top: 136,
    right: 330,
    bottom: 176,
    width: 100,
    height: 40,
    x: 230,
    y: 136,
    toJSON() {}
  }
];

function stubMotionAndViewport({ narrow = false, reducedMotion = false } = {}) {
  vi.stubGlobal('matchMedia', vi.fn((query) => ({
    matches: query === '(max-width: 640px)' ? narrow : reducedMotion
  })));
}

function makeProgressiveGlassChamber() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const session = {
    title: 'Progressive glass',
    revealMode: 'progressive',
    atoms: [{ content: 'First second', duration: 1000 }],
    totalDuration: 1000,
    atomCount: 1,
    visualConfig: { visualMode: 'off' }
  };
  const chamber = new Chamber(container, { session, player: null, autoStart: false });
  const atomDisplay = container.querySelector('#atom-display');
  atomDisplay.classList.add('glass-tile');
  atomDisplay.style.padding = '16px 24px';
  atomDisplay.getBoundingClientRect = () => DISPLAY_RECT;
  Object.defineProperties(atomDisplay, {
    clientWidth: { configurable: true, value: 400 },
    clientHeight: { configurable: true, value: 160 }
  });
  const spans = chamber.paintAtomText(atomDisplay, session.atoms[0].content, { reveal: true });
  spans.forEach((span, index) => {
    span.getBoundingClientRect = () => WORD_RECTS[index];
    Object.defineProperties(span, {
      offsetLeft: { configurable: true, value: index === 0 ? 60 : 130 },
      offsetTop: { configurable: true, value: 30 },
      offsetWidth: { configurable: true, value: index === 0 ? 60 : 100 },
      offsetHeight: { configurable: true, value: 40 }
    });
  });
  return { chamber, container, atomDisplay, spans };
}

/** How many word panes the mask is currently made of. */
const panes = atomDisplay => {
  const mask = atomDisplay.style.getPropertyValue('--progressive-glass-mask');
  return mask ? mask.split('linear-gradient').length - 1 : 0;
};

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
});

describe('the word a phrase ends on', () => {
  it('is marked so it can arrive sharp rather than condensing', () => {
    // Every other word has a successor to carry the eye while its blur
    // resolves, and 360ms of it costs nothing. The last word has none,
    // and the atom can be replaced before the blur is finished — so the
    // final word of a phrase was still soft when the phrase turned, and
    // never came into focus at all.
    vi.useFakeTimers();
    stubMotionAndViewport();
    const { chamber, spans } = makeProgressiveGlassChamber();

    chamber.revealAtomWords(spans, [0, 500]);

    expect(spans[0].hasAttribute('data-final')).toBe(false);
    expect(spans[1].hasAttribute('data-final')).toBe(true);
    chamber.destroy();
  });

  it('marks the only word of a one-word phrase', () => {
    vi.useFakeTimers();
    stubMotionAndViewport();
    const { chamber, atomDisplay } = makeProgressiveGlassChamber();
    const single = [atomDisplay.querySelector('.atom-word')];

    chamber.revealAtomWords(single, [0]);

    expect(single[0].hasAttribute('data-final')).toBe(true);
    chamber.destroy();
  });
});

describe('Chamber progressive glass envelope', () => {
  it('expands one glass surface with revealed words while preserving final text layout', () => {
    vi.useFakeTimers();
    stubMotionAndViewport();
    const { chamber, atomDisplay, spans } = makeProgressiveGlassChamber();

    chamber.revealAtomWords(spans, [0, 500]);

    expect(atomDisplay.querySelectorAll('.atom-word')).toHaveLength(2);
    expect(spans[0].hasAttribute('data-pending')).toBe(false);
    expect(spans[1].hasAttribute('data-pending')).toBe(true);
    expect(atomDisplay.classList.contains('is-progressive-glass')).toBe(true);
    expect(atomDisplay.classList.contains('is-progressive-glass-ready')).toBe(true);
    // One pane, over the first word, feathered 24px past it each side.
    expect(panes(atomDisplay)).toBe(1);
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask-position'))
      .toBe('36px 14px');
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask-size'))
      .toBe('108px 72px');

    vi.advanceTimersByTime(500);

    expect(spans[1].hasAttribute('data-pending')).toBe(false);
    expect(atomDisplay.querySelectorAll('.atom-word')).toHaveLength(2);
    // The second word ADDS a pane; the first one is untouched, rather
    // than both being replaced by one wider union.
    expect(panes(atomDisplay)).toBe(2);
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask-position'))
      .toBe('36px 14px, 106px 14px');
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask-size'))
      .toBe('108px 72px, 148px 72px');
    chamber.destroy();
  });

  it('changes nothing at all between one word and the next', () => {
    // THE POINT OF THE WHOLE DESIGN. An envelope that moved toward the
    // next word — however it was eased, and continuously most of all —
    // gave the reader a frontier advancing over a known distance, which
    // is a progress bar and reads as one. Between onsets the glass is
    // now completely still; at an onset a pane appears where its word
    // is. Nothing is ever in transit.
    vi.useFakeTimers();
    stubMotionAndViewport();
    const { chamber, atomDisplay, spans } = makeProgressiveGlassChamber();

    chamber.revealAtomWords(spans, [0, 500]);
    const atOnset = atomDisplay.style.getPropertyValue('--progressive-glass-mask-size');

    for (const step of [139, 200, 160]) {
      vi.advanceTimersByTime(step);
      expect(spans[1].hasAttribute('data-pending'), 'pending after ' + step).toBe(true);
      expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask-size'))
        .toBe(atOnset);
      expect(panes(atomDisplay)).toBe(1);
    }

    vi.advanceTimersByTime(1);
    expect(spans[1].hasAttribute('data-pending')).toBe(false);
    expect(panes(atomDisplay)).toBe(2);
    chamber.destroy();
  });

  it('clears envelope state and prevents a cancelled onset from mutating it', () => {
    vi.useFakeTimers();
    stubMotionAndViewport();
    const { chamber, atomDisplay, spans } = makeProgressiveGlassChamber();

    chamber.revealAtomWords(spans, [0, 500]);
    chamber.cancelReveal();
    vi.advanceTimersByTime(500);

    expect(spans[1].hasAttribute('data-pending')).toBe(true);
    expect(atomDisplay.classList.contains('is-progressive-glass')).toBe(false);
    expect(atomDisplay.classList.contains('is-progressive-glass-ready')).toBe(false);
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask')).toBe('');
    chamber.destroy();
  });

  it('remeasures revealed words after desktop layout changes', () => {
    vi.useFakeTimers();
    stubMotionAndViewport();
    const { chamber, atomDisplay, spans } = makeProgressiveGlassChamber();
    chamber.revealAtomWords(spans, [0, 500]);

    Object.defineProperties(spans[0], {
      offsetLeft: { configurable: true, value: 80 },
      offsetTop: { configurable: true, value: 40 },
      offsetWidth: { configurable: true, value: 70 }
    });
    chamber._refreshProgressiveGlass();

    expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask-position'))
      .toBe('56px 24px');
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask-size'))
      .toBe('118px 72px');
    chamber.destroy();
  });

  it('gives a word that has not arrived yet no glass, through a reflow', () => {
    // The previous design had to carry an in-flight target across a
    // reflow, because the pane was already travelling toward a word that
    // had not appeared. Nothing travels now, so a reflow has only what is
    // on screen to re-measure — and an unrevealed word must not be on it.
    vi.useFakeTimers();
    stubMotionAndViewport();
    const { chamber, atomDisplay, spans } = makeProgressiveGlassChamber();
    chamber.revealAtomWords(spans, [0, 500]);
    vi.advanceTimersByTime(140);

    Object.defineProperties(spans[1], {
      offsetLeft: { configurable: true, value: 150 },
      offsetWidth: { configurable: true, value: 100 }
    });
    chamber._refreshProgressiveGlass();

    expect(spans[1].hasAttribute('data-pending')).toBe(true);
    expect(panes(atomDisplay)).toBe(1);
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask-position'))
      .toBe('36px 14px');

    vi.advanceTimersByTime(360);
    expect(spans[1].hasAttribute('data-pending')).toBe(false);
    // Its pane arrives at the place the reflow moved it to.
    expect(panes(atomDisplay)).toBe(2);
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask-position'))
      .toBe('36px 14px, 126px 14px');
    chamber.destroy();
  });

  it('finishes the reveal and restores the complete slab when reduced motion turns on', () => {
    vi.useFakeTimers();
    let onMotionChange;
    vi.stubGlobal('matchMedia', vi.fn((query) => query === '(prefers-reduced-motion: reduce)'
      ? {
          matches: false,
          addEventListener: (_event, listener) => { onMotionChange = listener; },
          removeEventListener: vi.fn()
        }
      : { matches: false }));
    const { chamber, atomDisplay, spans } = makeProgressiveGlassChamber();
    chamber.revealAtomWords(spans, [0, 500]);

    onMotionChange({ matches: true });

    expect(spans.every(span => !span.hasAttribute('data-pending'))).toBe(true);
    expect(atomDisplay.classList.contains('is-progressive-glass')).toBe(false);
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask')).toBe('');
    chamber.destroy();
  });

  it('clears an in-flight envelope when the next atom is silent', () => {
    vi.useFakeTimers();
    stubMotionAndViewport();
    const { chamber, atomDisplay, spans } = makeProgressiveGlassChamber();
    chamber.revealAtomWords(spans, [0, 500]);

    chamber.displayAtom({ content: '', duration: 500 }, 1);
    vi.advanceTimersByTime(500);

    expect(atomDisplay.classList.contains('is-progressive-glass')).toBe(false);
    expect(spans[1].hasAttribute('data-pending')).toBe(true);
    chamber.destroy();
  });

  it.each([
    ['the mobile glass band', { narrow: true }],
    ['reduced motion', { reducedMotion: true }]
  ])('keeps the complete slab for %s', (_label, media) => {
    vi.useFakeTimers();
    stubMotionAndViewport(media);
    const { chamber, atomDisplay, spans } = makeProgressiveGlassChamber();

    chamber.revealAtomWords(spans, [0, 500]);

    expect(atomDisplay.classList.contains('glass-tile')).toBe(true);
    expect(atomDisplay.classList.contains('is-progressive-glass')).toBe(false);
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-mask')).toBe('');
    chamber.destroy();
  });
});
