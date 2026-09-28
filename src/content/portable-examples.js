import quiet from './portable-examples/quiet.json' with { type: 'json' };
import energetic from './portable-examples/energetic.json' with { type: 'json' };

export const PORTABLE_EXAMPLES = Object.freeze([
  Object.freeze({
    id: 'quiet', tone: 'Quiet', description: 'Soft light at a measured pace.', bundle: quiet
  }),
  Object.freeze({
    id: 'energetic', tone: 'Energetic', description: 'Fractal light at a faster pace.', bundle: energetic
  })
]);
