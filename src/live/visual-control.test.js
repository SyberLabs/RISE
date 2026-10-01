import { describe, expect, it } from 'vitest';
import { validateVisualCommand } from '../core/visual-control-contract.js';
import { interpretVisualControl } from './visual-control.js';

describe('validateVisualCommand', () => {
  it('clamps a finite readable intensity while retaining the requested value', () => {
    expect(validateVisualCommand({ surface: 'attractor', parameter: 'intensity', value: 8 }))
      .toEqual({
        ok: true,
        command: { surface: 'attractor', parameter: 'intensity', value: 0.75 },
        requested: 8,
        effective: 0.75
      });
  });

  it('refuses non-finite values and extra command fields', () => {
    expect(validateVisualCommand({ surface: 'attractor', parameter: 'intensity', value: NaN }))
      .toEqual({ ok: false, code: 'INVALID_CONTROL' });
    expect(validateVisualCommand({ surface: 'attractor', parameter: 'intensity', value: 0.7, shader: 'glow' }))
      .toEqual({ ok: false, code: 'INVALID_CONTROL' });
  });

  it('distinguishes unknown visual names from malformed commands', () => {
    expect(validateVisualCommand({ surface: 'nebula', parameter: 'intensity', value: 0.7 }))
      .toEqual({ ok: false, code: 'UNSUPPORTED_SURFACE' });
    expect(validateVisualCommand({ surface: 'attractor', parameter: 'hue', value: 0.7 }))
      .toEqual({ ok: false, code: 'UNSUPPORTED_SURFACE' });
  });
});

describe('interpretVisualControl', () => {
  it('accepts only the closed more-vibrant phrase after harmless normalization', () => {
    expect(interpretVisualControl(' Please MORE   VIBRANT! ')).toBe(true);
    expect(interpretVisualControl('not more vibrant')).toBe(false);
    expect(interpretVisualControl('more vibrant and stop')).toBe(false);
  });
});
