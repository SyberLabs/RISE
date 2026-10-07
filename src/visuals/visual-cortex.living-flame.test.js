/**
 * Living Flame is a listed Dynamic engine (RDR-023), so the navigator and
 * setup's preview ask the cortex for its leaf still like any other leaf.
 */
import { describe, expect, it, vi } from 'vitest';
import { flameComposition } from '../core/theme-engine-map.js';
import { flamePreset } from './living-flame/flame-presets.js';
import { sampleLivingFlame } from './living-flame/index.js';
import { visualCortex } from './visual-cortex.js';

vi.mock('./living-flame/index.js', async importOriginal => ({
  ...await importOriginal(),
  sampleLivingFlame: vi.fn(async () => 'data:image/png;base64,flame')
}));

describe('the Living Flame leaf still', () => {
  it('is one still of the composition a reading with no theme draws', async () => {
    const work = await visualCortex.renderLeafStill('living-flame');
    expect(work).toEqual({ url: 'data:image/png;base64,flame', still: true });
    expect(sampleLivingFlame).toHaveBeenCalledWith(flamePreset(flameComposition(null)));
  });
});
