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

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  document.body.replaceChildren();
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
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-left')).toBe('36px');
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-top')).toBe('14px');
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-width')).toBe('108px');
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-height')).toBe('72px');

    vi.advanceTimersByTime(500);

    expect(spans[1].hasAttribute('data-pending')).toBe(false);
    expect(atomDisplay.querySelectorAll('.atom-word')).toHaveLength(2);
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-left')).toBe('36px');
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-width')).toBe('218px');
    chamber.destroy();
  });

  it('glides toward the next word and reaches its bound at the reveal onset', () => {
    vi.useFakeTimers();
    stubMotionAndViewport();
    const { chamber, atomDisplay, spans } = makeProgressiveGlassChamber();

    chamber.revealAtomWords(spans, [0, 500]);

    expect(atomDisplay.style.getPropertyValue('--progressive-glass-width')).toBe('108px');
    vi.advanceTimersByTime(139);
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-width')).toBe('108px');

    vi.advanceTimersByTime(1);
    expect(spans[1].hasAttribute('data-pending')).toBe(true);
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-motion-ms')).toBe('360ms');
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-width')).toBe('218px');

    vi.advanceTimersByTime(360);
    expect(spans[1].hasAttribute('data-pending')).toBe(false);
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
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-width')).toBe('');
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

    expect(atomDisplay.style.getPropertyValue('--progressive-glass-left')).toBe('56px');
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-top')).toBe('24px');
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-width')).toBe('118px');
    chamber.destroy();
  });

  it('preserves the in-flight target when layout changes before its word appears', () => {
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
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-width')).toBe('238px');
    vi.advanceTimersByTime(360);
    expect(spans[1].hasAttribute('data-pending')).toBe(false);
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-width')).toBe('238px');
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
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-width')).toBe('');
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
    expect(atomDisplay.style.getPropertyValue('--progressive-glass-width')).toBe('');
    chamber.destroy();
  });
});
