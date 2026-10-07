/**
 * The engine catalog: every engine named once, the cortex-general
 * procedural patterns among them.
 *
 * Unknown ids are dropped. Retired engines are not listed.
 *
 * Every entry says what each surface offers: `listed`, an engine choice in
 * Reader setup; `composer`, a visual the ChatGPT Composer may present. The
 * Composer set follows RISE_CURRENT_VISUALS (rise-current.js), never the
 * reverse.
 *
 * A listed entry is a navigator leaf: `category` places it under Gallery
 * (held, blendable) or Dynamic (drawn, exclusive), `label` names it where
 * the navigator's name differs from `name`, and catalog order is the
 * navigator's order within each category.
 */

/**
 * `description` says what the field LOOKS LIKE, in the terms someone
 * choosing one would use — density, motion, whether it reads as figure
 * or as atmosphere. A curator picking a surface for a passage has the
 * id and this sentence and nothing else.
 */
export const PROCEDURAL_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'klee', name: 'Klee Lines', label: 'Genesis', icon: '╱', hasPresets: true,
    listed: true, category: 'dynamic', composer: true,
    description: 'Line drawing that wanders — bezier curves, arcs and polygons in varied '
      + 'weights, composed as a sparse figure on a dark ground. Graphic and deliberate '
      + 'rather than atmospheric; reads as a made mark.'
  }),
  Object.freeze({
    id: 'fractal', name: 'Fractal Flames', icon: '✧', listed: true, category: 'gallery', composer: false,
    description: 'Iterated-function flames: dense filamentary structures of light on black, '
      + 'symmetrical and self-similar, closer to smoke or a nebula than to drawing. The '
      + 'busiest of these surfaces.'
  }),
  Object.freeze({
    id: 'turrell', name: 'Turrell Fields', icon: '◈', listed: true, category: 'gallery', composer: false,
    description: 'A bounded aperture of soft light held inside a near-black chamber, its '
      + 'edge diffuse enough that the eye cannot decide whether it is an opening, a surface '
      + 'or a solid. Almost still, no line work, entirely atmosphere.'
  }),
  Object.freeze({
    id: 'neural', name: 'Neural Networks', icon: '◉', wordFillCapable: false,
    listed: true, category: 'gallery', composer: false,
    description: 'Layered nodes joined by weighted, glowing connections, with pulses passing '
      + 'along them. Diagrammatic and regular — a legible structure rather than a texture.'
  }),
  Object.freeze({
    id: 'rockgarden', name: 'Rock Garden', icon: '◯', wordFillCapable: false,
    listed: true, category: 'gallery', composer: false,
    description: 'A few overlapping stone-like forms — ellipses, blobs, irregular polygons — '
      + 'placed asymmetrically in greyscale, after karesansui. Sparse, quiet and mostly '
      + 'empty space.'
  }),
  Object.freeze({
    id: 'harmonograph', name: 'Harmonograph', icon: '∿', listed: true, category: 'dynamic', composer: false,
    description: 'A single continuous line traced by two damped pendulums tuned to a musical '
      + 'interval, winding into a lattice and decaying into stillness. Thin, precise, and '
      + 'visibly losing energy as it draws.'
  }),
  Object.freeze({
    id: 'ostensoria', name: 'Iris Plates', icon: '◍', listed: true, category: 'dynamic', composer: false,
    description: 'A square plate grown from strange-attractor density — radial vessels, '
      + 'spectral bands, and a dark halo on the chamber void. One seed, one plate, drawn once.'
  }),
  Object.freeze({
    id: 'apparitio', name: 'Spectral Plates', icon: '☾', wordFillCapable: false,
    listed: true, category: 'dynamic', composer: false,
    description: 'An upright apparition on a single mirror axis: swept spectral wings, a '
      + 'filigree spine, a crowning halo on the chamber void. Each seed appears once.'
  })
]);

/**
 * Attractor is the existing Chamber field (`visualMode: 'attractor'` /
 * AttractorField / VisualFieldDirector), not a sixth visualMode and not a
 * new generator. It is listed so a stranger can pick it the way they pick
 * Flames. It is not folded into PROCEDURAL_PATTERN_IDS: that id is already
 * a Storm of Steel work-engine.
 *
 * Living Flame and night streaks are fields of their own, not procedural
 * patterns, so neither reaches PROCEDURAL_PATTERN_IDS.
 */
export const ENGINE_CATALOG = Object.freeze([
  Object.freeze({
    id: 'attractor', name: 'Attractor', icon: '∮', listed: true, category: 'dynamic', composer: true,
    description: 'A persistent strange-attractor filament of light around the reading — '
      + 'gentle chaotic flow, no interrupts.'
  }),
  ...PROCEDURAL_PATTERNS,
  Object.freeze({
    id: 'living-flame', name: 'Living Flame', listed: false, composer: false,
    description: 'An iterated-function flame drawn by many thousands of glowing particles: '
      + 'one composition at a time, drifting and breathing slowly on a dark ground. '
      + 'Dense and luminous; reads as atmosphere, not as a made mark.'
  }),
  Object.freeze({
    id: 'night-streaks', name: 'Night Streaks', listed: false, composer: false,
    description: 'Light streaks rushing toward the viewer past a swaying vanishing point, '
      + 'like a car drifting through a night city. Forward speed that never strobes; '
      + 'drawn under the attractor in Jev\'s neon night-drive look.'
  })
]);

/** Gallery / PREP listing: the engines Reader setup offers. */
export const LISTED_PROCEDURAL_PATTERNS = Object.freeze(
  ENGINE_CATALOG.filter(pattern => pattern.listed)
);

/** Engines suitable for authoring inside letterforms. Runtime support is broader for legacy data. */
export const WORD_FILL_PROCEDURAL_PATTERNS = Object.freeze(
  LISTED_PROCEDURAL_PATTERNS.filter(pattern => pattern.wordFillCapable !== false)
);

export const PROCEDURAL_PATTERN_IDS = Object.freeze(
  PROCEDURAL_PATTERNS.map(pattern => pattern.id)
);

export function proceduralPattern(id) {
  return PROCEDURAL_PATTERNS.find(pattern => pattern.id === id) || null;
}
