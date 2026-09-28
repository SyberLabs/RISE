/**
 * The finite visual vocabulary a passage may be directed into.
 *
 * Each treatment maps to a real, supported renderer with a bounded
 * configuration. Jev chooses a treatment id and an intensity band; this
 * module compiles those two choices into a concrete cue. Nothing a model
 * returns is ever executed or passed through as parameters.
 */

export const TREATMENT_CATALOG_VERSION = 1;

export const INTENSITY_BANDS = Object.freeze({ quiet: 0.15, balanced: 0.35, intense: 0.6 });
export const INTENSITY_BAND_IDS = Object.freeze(Object.keys(INTENSITY_BANDS));

/**
 * Criteria are written for Jev: what each treatment expresses in the
 * abstract. They describe structure, scale, rhythm, and openness, never a
 * literal picture.
 */
export const VISUAL_TREATMENTS = Object.freeze([
  Object.freeze({ id: 'ember-cathedral', label: 'Ember Cathedral', kind: 'flame',
    criterion: 'Ordered amber filaments in architectural symmetry: structure, resolve, deliberate argument, warmth held in order.' }),
  Object.freeze({ id: 'violet-nebula', label: 'Violet Nebula', kind: 'flame',
    criterion: 'Diffuse violet ribbons in deep negative space: mystery, distance, grief, the unknown, night.' }),
  Object.freeze({ id: 'glacial-silk', label: 'Glacial Silk', kind: 'flame',
    criterion: 'Pale cyan folds drifting slowly: calm, clarity, reflection, coolness, restraint.' }),
  Object.freeze({ id: 'solar-bloom', label: 'Solar Bloom', kind: 'flame',
    criterion: 'Radial gold structure expanding outward: joy, revelation, arrival, release, opening.' }),
  Object.freeze({ id: 'verdant-current', label: 'Verdant Current', kind: 'flame',
    criterion: 'Green branching flows: growth, life, journeying, renewal, unfolding thought.' }),
  Object.freeze({ id: 'prismatic-knot', label: 'Prismatic Knot', kind: 'flame',
    criterion: 'Interwoven strands under a cyclic spectrum: conflict, entanglement, tension, many voices.' }),
  Object.freeze({ id: 'klee-architectural', label: 'Klee Architecture', kind: 'procedural',
    criterion: 'Graphic line architecture drawn in time: construction, method, reasoning, built order.' }),
  Object.freeze({ id: 'klee-harmonic', label: 'Klee Harmony', kind: 'procedural',
    criterion: 'Balanced graphic line forms: harmony, dialogue, lightness, measured play.' }),
  Object.freeze({ id: 'harmonograph', label: 'Harmonograph', kind: 'procedural',
    criterion: 'Fine harmonic line lattice: rhythm, recurrence, cycles, music, return.' }),
  Object.freeze({ id: 'turrell', label: 'Turrell Light', kind: 'procedural',
    criterion: 'A soft aperture of atmospheric light: contemplation, spaciousness, presence without event.' }),
  Object.freeze({ id: 'attractor', label: 'Attractor', kind: 'field',
    criterion: 'One continuous luminous filament orbiting itself: obsession, restless thought, circling, pursuit.' }),
  Object.freeze({ id: 'stillness', label: 'Stillness', kind: 'still',
    criterion: 'No imagery at all: silence, starkness, a pause, or a passage that imagery would intrude on.' })
]);

export const TREATMENT_IDS = Object.freeze(VISUAL_TREATMENTS.map(item => item.id));
const BY_ID = new Map(VISUAL_TREATMENTS.map(item => [item.id, item]));

export function visualTreatment(id) {
  return BY_ID.get(id) || null;
}

export function isTreatmentChoice(treatmentId, intensityBand) {
  return BY_ID.has(treatmentId) && Object.hasOwn(INTENSITY_BANDS, intensityBand);
}

/**
 * Compile a treatment and band into a cue. `flameRecipe` supplies the full
 * recipe for flame treatments (from the lazily loaded presets); the cue
 * always carries the full recipe rather than a preset id.
 */
export function compileTreatmentCue(treatmentId, intensityBand, flameRecipe = null) {
  const treatment = BY_ID.get(treatmentId);
  const intensity = INTENSITY_BANDS[intensityBand];
  if (!treatment || intensity === undefined) return { kind: 'still' };
  switch (treatment.id) {
    case 'klee-architectural':
      return { kind: 'procedural', collections: ['klee'], config: { preset: 'architectural' } };
    case 'klee-harmonic':
      return { kind: 'procedural', collections: ['klee'], config: { preset: 'harmonic' } };
    case 'harmonograph':
      return { kind: 'procedural', collections: ['harmonograph'] };
    case 'turrell':
      return { kind: 'procedural', collections: ['turrell'] };
    case 'attractor':
      return { kind: 'field', renderer: 'attractor', config: { system: 'thomas', palette: 'white', form: 'mirror' } };
    case 'stillness':
      return { kind: 'still' };
    default:
      if (!flameRecipe || flameRecipe.id !== treatment.id) return { kind: 'still' };
      return { kind: 'field', renderer: 'living-flame', config: { recipe: flameRecipe, intensity } };
  }
}

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

/**
 * The reader's effective energy: the band scaled by the global Energy
 * control, never above the reader ceiling of 0.65.
 */
export function effectiveEnergy(bandEnergy, userEnergy = 0.35, ceiling = 0.65) {
  return clamp((Number(bandEnergy) || 0) * (Number(userEnergy) || 0) / 0.35, 0, ceiling);
}

/**
 * Local direction: the fixed, deterministic mapping from the conductor's
 * signal to a treatment and band. It covers every block and never waits.
 */
export function localDirection(signal) {
  const confidence = Number(signal?.confidence);
  const valence = Number(signal?.valence) || 0;
  const arousal = Number(signal?.arousal) || 0;
  if (!(confidence >= 0.15)) return { treatmentId: 'glacial-silk', intensityBand: 'quiet' };
  const intensityBand = arousal >= 0.65 ? 'intense' : arousal <= 0.35 ? 'quiet' : 'balanced';
  let treatmentId = 'ember-cathedral';
  if (arousal >= 0.65 && valence > 0.15) treatmentId = 'solar-bloom';
  else if (arousal >= 0.65 && valence < -0.15) treatmentId = 'prismatic-knot';
  else if (arousal <= 0.35 && valence < -0.15) treatmentId = 'violet-nebula';
  else if (arousal <= 0.35 && valence > 0.15) treatmentId = 'glacial-silk';
  return { treatmentId, intensityBand };
}
