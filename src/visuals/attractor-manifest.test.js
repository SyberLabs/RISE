import { describe, expect, it } from 'vitest';
import { ATTRACTOR_VISUAL_MANIFEST } from '../core/visual-control-contract.js';

describe('Attractor visual manifest', () => {
  it('describes only the readable canvas intensity control, cueable while the field runs, and is immutable', () => {
    expect(ATTRACTOR_VISUAL_MANIFEST).toEqual({
      surface: 'attractor',
      parameters: {
        intensity: { type: 'number', minimum: 0.4, maximum: 0.75, default: 0.65, cueable: true }
      },
      readableOverText: true,
      requiresCanvas: true
    });
    expect(Object.isFrozen(ATTRACTOR_VISUAL_MANIFEST)).toBe(true);
    expect(Object.isFrozen(ATTRACTOR_VISUAL_MANIFEST.parameters)).toBe(true);
    expect(Object.isFrozen(ATTRACTOR_VISUAL_MANIFEST.parameters.intensity)).toBe(true);
  });
});
