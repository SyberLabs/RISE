import { describe, expect, it } from 'vitest';
import { ATTRACTOR_VISUAL_MANIFEST, validateVisualCommand } from './visual-control-contract.js';
import { manifestFor } from '../scenes/manifests.js';

describe('a visual command against a manifest', () => {
  it('is the attractor’s intensity, held to its window, by default', () => {
    expect(validateVisualCommand({ surface: 'attractor', parameter: 'intensity', value: 0.9 }))
      .toMatchObject({ ok: true, command: { surface: 'attractor', parameter: 'intensity', value: 0.75 }, requested: 0.9, effective: 0.75 });
    expect(validateVisualCommand({ surface: 'attractor', parameter: 'speed', value: 2 }).code).toBe('UNSUPPORTED_SURFACE');
    expect(validateVisualCommand({ surface: 'attractor', parameter: 'intensity', value: 'high' }).code).toBe('INVALID_CONTROL');
    expect(validateVisualCommand({ surface: 'attractor', parameter: 'intensity' }).code).toBe('INVALID_CONTROL');
    expect(ATTRACTOR_VISUAL_MANIFEST.parameters.intensity.cueable).toBe(true);
  });

  it('takes another engine’s manifest: a cueable number is held to its bounds, a parameter that is not cueable is refused', () => {
    const flame = manifestFor('living-flame');
    expect(validateVisualCommand({ surface: 'living-flame', parameter: 'hue', value: 400 }, flame))
      .toMatchObject({ ok: true, effective: 180 });
    expect(validateVisualCommand({ surface: 'living-flame', parameter: 'symmetry', value: 4 }, flame).code).toBe('UNSUPPORTED_SURFACE');
    expect(validateVisualCommand({ surface: 'attractor', parameter: 'hue', value: 10 }, flame).code).toBe('UNSUPPORTED_SURFACE');
  });

  it('holds an enum parameter to its values when a manifest makes one cueable', () => {
    const manifest = { surface: 'test', parameters: { mood: { type: 'enum', values: ['calm', 'bright'], default: 'calm', cueable: true } } };
    expect(validateVisualCommand({ surface: 'test', parameter: 'mood', value: 'bright' }, manifest)).toMatchObject({ ok: true, effective: 'bright' });
    expect(validateVisualCommand({ surface: 'test', parameter: 'mood', value: 'loud' }, manifest).code).toBe('INVALID_CONTROL');
  });
});
