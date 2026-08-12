import { describe, expect, it } from 'vitest';
import {
  normalizeConfigurableVisualCue,
  normalizeFieldStyle,
  normalizeProceduralStyle,
  visualCueStyleSummary
} from './visual-style-definitions.js';

describe('visual style definitions', () => {
  it('normalizes bounded field variants and summarizes their resolved identity', () => {
    const attractor = normalizeConfigurableVisualCue({
      kind: 'field', renderer: 'attractor',
      config: { system: 'thomas', palette: 'gold', form: 'bilateral', injected: true }
    });
    expect(attractor.config).toEqual({ system: 'thomas', palette: 'gold', form: 'bilateral' });
    expect(visualCueStyleSummary(attractor)).toBe('Thomas · Gold · Bilateral');
    expect(normalizeFieldStyle('focal', { standardGlyph: 'rose', roseMode: 'verbum' }))
      .toEqual({ type: 'standard', standardGlyph: 'rose', roseMode: 'verbum' });
    const personal = normalizeConfigurableVisualCue({
      kind: 'field', renderer: 'focal',
      config: { type: 'personal', personalAssetId: 'portrait', personalImage: 'blob:transient' }
    });
    expect(personal.config).toEqual({ type: 'personal', personalAssetId: 'portrait' });
    expect(visualCueStyleSummary(personal)).toBe('Personal image');
  });

  it('admits configuration only for known procedural families', () => {
    expect(normalizeProceduralStyle(['klee'], { preset: 'harmonic', extra: true }))
      .toEqual({ preset: 'harmonic' });
    expect(normalizeProceduralStyle(['harmonograph'], { climate: 'jadeVeil' }))
      .toEqual({ climate: 'jadeVeil' });
    expect(normalizeProceduralStyle(['fractal'], { preset: 'harmonic' })).toEqual({});
  });
});
