import { afterEach, describe, expect, it, vi } from 'vitest';
import { compileRiseCurrent } from '../../core/rise-current.js';
import { lowerCurrentLook } from '../../core/current-look.js';
import { loadMath, resetMathForTests } from '../../core/math-typeset.js';
import { Chamber } from './Chamber.js';

// The stylesheet is the browser's concern; here only the code loads.
vi.mock('katex/dist/katex.min.css', () => ({}));

afterEach(() => {
  resetMathForTests();
  vi.useRealTimers();
});

/** A spoken beat placed as a caption whose shown words carry maths (e2e/live-mcp.spec.js SKY_BEATS). */
const CURRENT = {
  schema: 'rise.current.v2',
  id: 'sky-caption',
  title: 'Why the sky is blue',
  origin: { kind: 'model', name: 'Claude', provider: 'Anthropic' },
  look: 'signal',
  scenes: [{ id: 'field', engine: 'attractor' }],
  beats: [
    { say: 'Sunlight carries every colour at once.', scene: 'field' },
    { say: 'Scattering goes as one over lambda to the fourth.', show: 'Scattering goes as $1/\\lambda^4$.', place: 'caption' },
    { say: 'So blue reaches your eye.' }
  ]
};

/** A Chamber reduced to what displayAtom paints with; layout, masks and imagery are the browser's. */
function stage(session) {
  const container = document.createElement('div');
  container.innerHTML = '<div id="atom-display" class="atom-display"></div>';
  const chamber = Object.assign(Object.create(Chamber.prototype), {
    container,
    session,
    progressiveRevealEnabled: true,
    _resolveWordFitBox: () => null,
    applyChamberMask: () => {},
    applyLivingText: () => {},
    applyBandOffset: () => {},
    syncFillGlyphMask: async () => {},
    _prefersReducedMotion: () => false,
    getSettings: () => ({ fontSize: 'medium' })
  });
  return { chamber, atomDisplay: container.querySelector('#atom-display') };
}

describe('a spoken beat placed as a caption', () => {
  it('keeps its place on every atom of the beat, revealed or concealed', async () => {
    vi.useFakeTimers();
    await loadMath();
    const session = compileRiseCurrent(CURRENT, { lowerLook: lowerCurrentLook });
    const captioned = session.atoms.map((atom, index) => [atom, index]).filter(([atom]) => atom.sourceId === 'beat-1');
    expect(captioned.length).toBeGreaterThan(0);
    const { chamber, atomDisplay } = stage(session);
    for (const concealed of [false, true]) {
      for (const [atom, index] of captioned) {
        chamber.displayAtom(atom, index, { concealed });
        expect(atomDisplay.dataset.place, `${atom.content} (concealed: ${concealed})`).toBe('caption');
        await vi.advanceTimersByTimeAsync(atom.duration);
        expect(atomDisplay.dataset.place, `${atom.content} after its reveal`).toBe('caption');
      }
    }
    expect(atomDisplay.querySelector('.katex')).not.toBeNull();
  });
});
