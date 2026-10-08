import { afterEach, describe, expect, it, vi } from 'vitest';
import { loadMath, resetMathForTests } from '../../core/math-typeset.js';
import { Chamber } from './Chamber.js';

// The stylesheet is the browser's concern; here only the code loads.
vi.mock('katex/dist/katex.min.css', () => ({}));

afterEach(() => resetMathForTests());

function typography({ base = 'medium', typeFaces = null } = {}) {
  const atomDisplay = document.createElement('div');
  const chamber = {
    effectiveFontSize: () => base,
    session: { presentation: typeFaces ? { typeFaces } : {} }
  };
  const apply = beat => Chamber.prototype.applyBeatTypography.call(chamber, atomDisplay, beat === undefined ? {} : { beat });
  return { atomDisplay, apply };
}

describe('applyBeatTypography', () => {
  it('places a caption beat and shows it', () => {
    const { atomDisplay, apply } = typography();
    expect(apply({ place: 'caption' })).toBe(true);
    expect(atomDisplay.dataset.place).toBe('caption');
  });

  it('leaves a centred beat, and a beatless atom, without a place', () => {
    const { atomDisplay, apply } = typography();
    apply({ place: 'caption' });
    expect(apply({ place: 'centre' })).toBe(true);
    expect(atomDisplay.dataset.place).toBeUndefined();
    apply({ place: 'caption' });
    expect(apply(undefined)).toBe(true);
    expect(atomDisplay.hasAttribute('data-place')).toBe(false);
  });

  it('shows nothing for place none, and sets no place', () => {
    const { atomDisplay, apply } = typography();
    expect(apply({ place: 'none' })).toBe(false);
    expect(atomDisplay.hasAttribute('data-place')).toBe(false);
  });

  it('steps the size from the reader’s own', () => {
    const { atomDisplay, apply } = typography({ base: 'medium' });
    apply({ size: 'larger' });
    expect(atomDisplay.dataset.fontSize).toBe('large');
    apply({});
    expect(atomDisplay.dataset.fontSize).toBe('medium');
  });

  it('sets the face and weight a beat names', () => {
    const { atomDisplay, apply } = typography();
    apply({ type: 'handwritten' });
    expect(atomDisplay.style.getPropertyValue('--font-stream-face')).toContain('Caveat');
    expect(atomDisplay.style.getPropertyValue('--font-stream-weight')).toBe('500');
  });

  it('falls back to the Current’s faces: text for centred, caption for a placed beat', () => {
    const { atomDisplay, apply } = typography({ typeFaces: { text: 'mono', caption: 'book-serif' } });
    apply(undefined);
    expect(atomDisplay.style.getPropertyValue('--font-stream-face')).toContain('JetBrains Mono');
    apply({ place: 'caption' });
    expect(atomDisplay.style.getPropertyValue('--font-stream-face')).toContain('Crimson Pro');
  });

  it('prefers the beat’s own face to the Current’s', () => {
    const { atomDisplay, apply } = typography({ typeFaces: { text: 'mono' } });
    apply({ type: 'handwritten' });
    expect(atomDisplay.style.getPropertyValue('--font-stream-face')).toContain('Caveat');
  });

  it('removes the face when neither the beat nor the Current names one', () => {
    const { atomDisplay, apply } = typography();
    apply({ type: 'handwritten' });
    apply({});
    expect(atomDisplay.style.getPropertyValue('--font-stream-face')).toBe('');
    expect(atomDisplay.style.getPropertyValue('--font-stream-weight')).toBe('');
  });
});

describe('paintAtomText emphasis', () => {
  const paint = (content, options) => {
    const atomDisplay = document.createElement('div');
    const spans = Chamber.prototype.paintAtomText.call({}, atomDisplay, content, options);
    return { atomDisplay, spans };
  };

  it('marks exactly the word a beat names', () => {
    const { atomDisplay, spans } = paint('Sunlight carries every colour at once.', { reveal: false, emphasis: ['colour'] });
    const marked = atomDisplay.querySelectorAll('.atom-word.is-emphasised');
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toBe('colour');
    expect(spans).toBeNull();
  });

  it('matches whatever the word’s punctuation or case', () => {
    const { atomDisplay } = paint('Sunlight carries every "colour," at once.', { emphasis: ['Colour'] });
    const marked = atomDisplay.querySelectorAll('.atom-word.is-emphasised');
    expect(marked).toHaveLength(1);
    expect(marked[0].textContent).toBe('"colour,"');
  });

  it('writes plain text, with no spans, when there is nothing to mark', () => {
    const { atomDisplay, spans } = paint('Sunlight carries every colour at once.', { reveal: false });
    expect(atomDisplay.textContent).toBe('Sunlight carries every colour at once.');
    expect(atomDisplay.querySelector('.atom-word')).toBeNull();
    expect(spans).toBeNull();
  });
});

describe('paintAtomText maths', () => {
  const paint = () => {
    const atomDisplay = document.createElement('div');
    Chamber.prototype.paintAtomText.call({}, atomDisplay, 'Then $x^2$ ends.', { reveal: false });
    return atomDisplay;
  };

  it('sets a formula as one word, in source until the typesetter loads', () => {
    const atomDisplay = paint();
    const maths = atomDisplay.querySelectorAll('.atom-word.atom-math');
    expect(maths).toHaveLength(1);
    expect(maths[0].querySelector('.atom-math.is-source').textContent).toBe('x^2');
  });

  it('typesets the formula once the typesetter has loaded', async () => {
    await loadMath();
    const maths = paint().querySelectorAll('.atom-word.atom-math');
    expect(maths).toHaveLength(1);
    expect(maths[0].querySelector('.katex')).not.toBeNull();
  });
});
