/**
 * The finite visual vocabulary a passage may be directed into.
 *
 * Each treatment maps to a real, supported renderer with a bounded
 * configuration. Jev chooses a treatment id and an intensity band; this
 * module compiles those two choices into a concrete cue. Nothing a model
 * returns is ever executed or passed through as parameters.
 */

export const TREATMENT_CATALOG_VERSION = 2;

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
  // A Gallery reading's museum works (RDR-023 part 2): one collection each, chosen by the passage's mood.
  Object.freeze({ id: 'gallery-landscapes', label: 'Landscapes', kind: 'sourced', collection: 'aic-landscapes',
    criterion: 'Land, sea and sky with figures small or absent: calm, openness, distance, rest, reflection.' }),
  Object.freeze({ id: 'gallery-impressionism', label: 'Monet & the Impressionists', kind: 'sourced', collection: 'aic-impressionism',
    criterion: 'Light and weather in loose, bright brushwork: ordinary life, pleasure, the passing moment, release.' }),
  Object.freeze({ id: 'gallery-postimpressionism', label: 'Van Gogh & Post-Impressionists', kind: 'sourced', collection: 'aic-postimpressionism',
    criterion: 'Saturated colour and emphatic structure: agitation, conflict, longing, a mind under strain.' }),
  Object.freeze({ id: 'gallery-oldmasters', label: 'Old Masters', kind: 'sourced', collection: 'aic-oldmasters',
    criterion: 'Weighty, formal painting on dark grounds: grief, gravity, faith, myth, the solemn and the tragic.' }),
  Object.freeze({ id: 'stillness', label: 'Stillness', kind: 'still',
    criterion: 'No imagery at all: silence, starkness, a pause, or a passage that imagery would intrude on.' })
]);

export const TREATMENT_IDS = Object.freeze(VISUAL_TREATMENTS.map(item => item.id));
const BY_ID = new Map(VISUAL_TREATMENTS.map(item => [item.id, item]));

/**
 * WHAT FOLLOW TEXT MAY CHOOSE: one family, one colour (R6). A reading keeps its engine family and its
 * colour theme while the text moves only the composition and the intensity, so Follow text draws the
 * flame compositions and nothing else, and only those a theme can colour: Prismatic Knot is a cyclic
 * spectrum, which theming leaves as it is (themedFlameRecipe), so it would flash every colour in a
 * reading that has one. The other treatments stay for saved readings, which replay as they were shown.
 */
export const FOLLOW_TREATMENT_IDS = Object.freeze(VISUAL_TREATMENTS
  .filter(item => item.kind === 'flame' && item.id !== 'prismatic-knot').map(item => item.id));
/** A Gallery reading follows with museum works, never a flame: its family is the gallery of works. */
const FOLLOW_FAMILIES = Object.freeze({
  flame: FOLLOW_TREATMENT_IDS,
  gallery: Object.freeze(VISUAL_TREATMENTS.filter(item => item.kind === 'sourced').map(item => item.id))
});

/** What Follow text may choose for a reading's family ('flame' or 'gallery'). */
export function followTreatmentIds(family = 'flame') {
  return Object.hasOwn(FOLLOW_FAMILIES, family) ? FOLLOW_FAMILIES[family] : FOLLOW_FAMILIES.flame;
}

export function isFollowChoice(treatmentId, intensityBand, family = 'flame') {
  return followTreatmentIds(family).includes(treatmentId) && Object.hasOwn(INTENSITY_BANDS, intensityBand);
}

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
      if (treatment.kind === 'sourced') return { kind: 'sourced', collections: [treatment.collection] };
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
 * What each mood draws, per family. A flame reads conflict through the intense
 * band in the nebula's dark folds, not in another colour; the gallery gives
 * agitation and grief their own painters.
 */
const MOOD_TREATMENTS = Object.freeze({
  flame: Object.freeze({ calm: 'glacial-silk', ordinary: 'ember-cathedral', joy: 'solar-bloom', conflict: 'violet-nebula', grief: 'violet-nebula' }),
  gallery: Object.freeze({ calm: 'gallery-landscapes', ordinary: 'gallery-impressionism', joy: 'gallery-impressionism', conflict: 'gallery-postimpressionism', grief: 'gallery-oldmasters' })
});

/**
 * Local direction: the fixed, deterministic mapping from the conductor's
 * signal to a treatment and band in the reading's family. It covers every
 * block and never waits.
 */
export function localDirection(signal, family = 'flame') {
  const moods = Object.hasOwn(MOOD_TREATMENTS, family) ? MOOD_TREATMENTS[family] : MOOD_TREATMENTS.flame;
  const confidence = Number(signal?.confidence);
  const valence = Number(signal?.valence) || 0;
  const arousal = Number(signal?.arousal) || 0;
  if (!(confidence >= 0.15)) return { treatmentId: moods.calm, intensityBand: 'quiet' };
  const intensityBand = arousal >= 0.65 ? 'intense' : arousal <= 0.35 ? 'quiet' : 'balanced';
  let mood = 'ordinary';
  if (arousal >= 0.65 && valence > 0.15) mood = 'joy';
  else if (arousal >= 0.65 && valence < -0.15) mood = 'conflict';
  else if (arousal <= 0.35 && valence < -0.15) mood = 'grief';
  else if (arousal <= 0.35 && valence > 0.15) mood = 'calm';
  return { treatmentId: moods[mood], intensityBand };
}
