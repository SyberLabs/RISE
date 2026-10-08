import { describe, expect, it } from 'vitest';
import { Chamber } from './Chamber.js';

/**
 * A beat's size step must survive the atom's sizing pass: applyBeatTypography sets it first and
 * sizeAtomText runs after, so the second must honour the beat or the step is lost on screen.
 */
function chamberAt(base) {
  const atomDisplay = document.createElement('div');
  const chamber = {
    effectiveFontSize: () => base,
    session: { presentation: {}, chunkMode: 'phrase' },
    _resolveWordFitBox: () => null,
    applyChamberMask: () => {},
    _applyFitBorder: () => {}
  };
  return { atomDisplay, chamber };
}

describe('sizeAtomText with a beat', () => {
  it('keeps the beat’s size step', () => {
    const { atomDisplay, chamber } = chamberAt('medium');
    Chamber.prototype.applyBeatTypography.call(chamber, atomDisplay, { beat: { size: 'larger' } });
    Chamber.prototype.sizeAtomText.call(chamber, atomDisplay, 'A line.', { size: 'larger' });
    expect(atomDisplay.dataset.fontSize).toBe('large');
  });

  it('returns to the reader’s size for an atom without a beat', () => {
    const { atomDisplay, chamber } = chamberAt('medium');
    Chamber.prototype.sizeAtomText.call(chamber, atomDisplay, 'A line.');
    expect(atomDisplay.dataset.fontSize).toBe('medium');
  });
});
