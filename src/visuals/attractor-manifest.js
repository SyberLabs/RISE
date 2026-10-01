const intensity = Object.freeze({
  type: 'number',
  minimum: 0.4,
  maximum: 0.75,
  default: 0.65
});

export const ATTRACTOR_VISUAL_MANIFEST = Object.freeze({
  surface: 'attractor',
  parameters: Object.freeze({ intensity }),
  readableOverText: true,
  requiresCanvas: true
});
