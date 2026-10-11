import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { GLASS_CONTINUITY } from './glass-continuity.js';

const SEAM = { content: '', duration: 500, tags: ['source-break'], seam: { depth: 'piece', label: '', name: '' } };

function mount({ glass = true } = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const session = {
    title: 'Glass between phrases',
    atoms: [{ content: 'First phrase.', duration: 1000 }],
    totalDuration: 1000,
    atomCount: 1,
    visualConfig: { visualMode: 'off' }
  };
  const chamber = new Chamber(container, { session, player: null, autoStart: false });
  const display = container.querySelector('#atom-display');
  if (glass) display.classList.add('glass-tile');
  return { chamber, container, display, band: container.querySelector('#atom-band') };
}

describe('the Chamber keeps its glass between phrases', () => {
  let mounted;
  afterEach(() => {
    mounted?.chamber.destroy();
    mounted?.container.remove();
    mounted = null;
    delete Element.prototype.animate;
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('holds the glass through a seam: the words leave but keep its box, and the next phrase arrives on it', () => {
    vi.useFakeTimers();
    mounted = mount();
    const { chamber, display, band } = mounted;
    chamber.displayAtom({ content: 'First phrase.', duration: 1000 }, 0);
    expect(band.dataset.bandState).toBe('words');

    chamber.displayAtom(SEAM, 1);
    expect(band.dataset.bandState).toBe('holding');
    // The outgoing words stay, hidden from assistive technology, so the glass keeps its paint and its size.
    expect(display.querySelector('[data-outgoing]')?.getAttribute('aria-hidden')).toBe('true');
    expect(display.textContent).toBe('First phrase.');
    expect(display.style.opacity).not.toBe('0');

    vi.advanceTimersByTime(400);
    chamber.displayAtom({ content: 'Second phrase.', duration: 1000 }, 2);
    expect(band.dataset.bandState).toBe('words');
    expect(display.textContent).toBe('Second phrase.');
    expect(display.querySelector('[data-outgoing]')).toBeNull();
    // The glass is not faded out and in again: only the words are.
    expect(display.style.opacity).toBe('1');
    expect(display.querySelector('.atom-phrase')?.textContent).toBe('Second phrase.');
  });

  it.each([
    ['', false, { out: GLASS_CONTINUITY.wordsOutMs, in: GLASS_CONTINUITY.wordsInMs, eased: true }],
    [' under reduced motion', true, { out: GLASS_CONTINUITY.reducedMotionMs, in: GLASS_CONTINUITY.reducedMotionMs, eased: false }]
  ])('fades the words out and in, and eases the glass to the new size%s', (_label, reduced, expected) => {
    vi.useFakeTimers();
    vi.stubGlobal('matchMedia', vi.fn(query => ({ matches: query === '(prefers-reduced-motion: reduce)' && reduced })));
    const animations = [];
    // jsdom has no Web Animations; each animation is recorded instead.
    Element.prototype.animate = function (keyframes, options) {
      const animation = { element: this, keyframes, options, cancel: vi.fn(), onfinish: null };
      animations.push(animation);
      return animation;
    };
    mounted = mount();
    const { chamber, display, band } = mounted;
    // The longer phrase takes a line more. Whichever of the two is the glass's box (jsdom gives the band one, as a phone does).
    const rect = () => {
      const height = display.textContent.includes('longer') ? 160 : 120;
      return { width: 600, height, top: 0, left: 0, right: 600, bottom: height };
    };
    display.getBoundingClientRect = band.getBoundingClientRect = rect;
    chamber.displayAtom({ content: 'First phrase.', duration: 1000 }, 0);
    animations.length = 0;

    chamber.displayAtom(SEAM, 1);
    const out = animations.find(a => a.element.matches('[data-outgoing]'));
    expect(out.options.duration).toBe(expected.out);

    chamber.displayAtom({ content: 'A second and longer phrase.', duration: 1000 }, 2);
    const fadeIn = animations.find(a => a.element.matches('.atom-phrase'));
    expect(fadeIn.options.duration).toBe(expected.in);
    const ease = animations.find(a => a.keyframes.some(frame => frame.clipPath));
    expect(Boolean(ease)).toBe(expected.eased);
    if (ease) expect(ease.keyframes[0].clipPath).toMatch(/^inset\(20px 0px round /u);
  });

  it('dissolves the glass when no words come within the grace, back to the empty display it always was', () => {
    vi.useFakeTimers();
    mounted = mount();
    const { chamber, display, band } = mounted;
    chamber.displayAtom({ content: 'First phrase.', duration: 1000 }, 0);
    chamber.displayAtom(SEAM, 1);
    vi.advanceTimersByTime(GLASS_CONTINUITY.graceMs + GLASS_CONTINUITY.dissolveMs);
    expect(display.textContent).toBe('');
    expect(display.childNodes.length).toBe(0);
    expect(display.style.opacity).toBe('0');
    expect(band.dataset.bandState).toBeUndefined();
  });

  it('dissolves at once into a hold known to be long', () => {
    vi.useFakeTimers();
    mounted = mount();
    const { chamber, display, band } = mounted;
    chamber.displayAtom({ content: 'First phrase.', duration: 1000 }, 0);
    chamber.displayAtom({ content: '', duration: 2500, tags: ['HOLD'] }, 1);
    expect(band.dataset.bandState).not.toBe('holding');
    vi.advanceTimersByTime(GLASS_CONTINUITY.dissolveMs);
    expect(display.textContent).toBe('');
    expect(band.dataset.bandState).toBeUndefined();
  });

  it('a pause dissolves a held glass', () => {
    vi.useFakeTimers();
    mounted = mount();
    const { chamber, display } = mounted;
    chamber.displayAtom({ content: 'First phrase.', duration: 1000 }, 0);
    chamber.displayAtom(SEAM, 1);
    chamber.releaseGlass();
    vi.advanceTimersByTime(GLASS_CONTINUITY.dissolveMs);
    expect(display.textContent).toBe('');
  });

  it('without glass a silence empties the display at once, as before', () => {
    mounted = mount({ glass: false });
    const { chamber, display } = mounted;
    chamber.displayAtom({ content: 'First phrase.', duration: 1000 }, 0);
    chamber.displayAtom(SEAM, 1);
    expect(display.textContent).toBe('');
    expect(display.style.opacity).toBe('0');
  });
});
