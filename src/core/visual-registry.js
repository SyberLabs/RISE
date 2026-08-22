/**
 * The cortex-general procedural patterns, named once.
 *
 * `blueprint` and `freedom` are deliberately absent: both are
 * Atrium-exclusive and arrive only with the sequence that curated them,
 * never as a generic option.
 */

/**
 * `description` says what the field LOOKS LIKE, in the terms someone
 * choosing one would use — density, motion, whether it reads as figure
 * or as atmosphere. A curator picking a surface for a passage has the
 * id and this sentence and nothing else.
 */
export const PROCEDURAL_PATTERNS = Object.freeze([
  Object.freeze({
    id: 'klee', name: 'Klee Lines', icon: '╱', hasPresets: true,
    description: 'Line drawing that wanders — bezier curves, arcs and polygons in varied '
      + 'weights, composed as a sparse figure on a dark ground. Graphic and deliberate '
      + 'rather than atmospheric; reads as a made mark.'
  }),
  Object.freeze({
    id: 'turrell', name: 'Turrell Fields', icon: '◈',
    description: 'A bounded aperture of soft light held inside a near-black chamber, its '
      + 'edge diffuse enough that the eye cannot decide whether it is an opening, a surface '
      + 'or a solid. Almost still, no line work, entirely atmosphere.'
  }),
  Object.freeze({
    id: 'fractal', name: 'Fractal Flames', icon: '✧',
    description: 'Iterated-function flames: dense filamentary structures of light on black, '
      + 'symmetrical and self-similar, closer to smoke or a nebula than to drawing. The '
      + 'busiest of these surfaces.'
  }),
  Object.freeze({
    id: 'neural', name: 'Neural Networks', icon: '◉',
    description: 'Layered nodes joined by weighted, glowing connections, with pulses passing '
      + 'along them. Diagrammatic and regular — a legible structure rather than a texture.'
  }),
  Object.freeze({
    id: 'rockgarden', name: 'Rock Garden', icon: '◯',
    description: 'A few overlapping stone-like forms — ellipses, blobs, irregular polygons — '
      + 'placed asymmetrically in greyscale, after karesansui. Sparse, quiet and mostly '
      + 'empty space.'
  }),
  Object.freeze({
    id: 'harmonograph', name: 'Harmonograph', icon: '∿',
    description: 'A single continuous line traced by two damped pendulums tuned to a musical '
      + 'interval, winding into a lattice and decaying into stillness. Thin, precise, and '
      + 'visibly losing energy as it draws.'
  }),
  Object.freeze({
    id: 'ostensoria', name: 'Iris Plates', icon: '◍',
    description: 'A square plate grown from strange-attractor density — radial vessels, '
      + 'spectral bands, and a dark halo on the chamber void. One seed, one plate, drawn once.'
  }),
  Object.freeze({
    id: 'apparitio', name: 'Spectral Plates', icon: '☾',
    description: 'An upright apparition on a single mirror axis: swept spectral wings, a '
      + 'filigree spine, a crowning halo on the chamber void. Each seed appears once.'
  })
]);

/**
 * Gallery / PREP listing. Attractor is the existing Chamber field
 * (`visualMode: 'attractor'` / AttractorField / VisualFieldDirector),
 * not a sixth visualMode and not a new generator. It is listed here so
 * a stranger can pick it the way they pick Flames. It is not folded into
 * PROCEDURAL_PATTERN_IDS: that id is already a Storm of Steel work-engine.
 */
export const LISTED_PROCEDURAL_PATTERNS = Object.freeze([
  ...PROCEDURAL_PATTERNS,
  Object.freeze({
    id: 'attractor', name: 'Attractor', icon: '∮',
    description: 'A persistent strange-attractor filament of light around the reading — '
      + 'gentle chaotic flow, no interrupts.'
  })
]);

export const PROCEDURAL_PATTERN_IDS = Object.freeze(
  PROCEDURAL_PATTERNS.map(pattern => pattern.id)
);

export function proceduralPattern(id) {
  return PROCEDURAL_PATTERNS.find(pattern => pattern.id === id) || null;
}
