/**
 * Typography a composition may ask for: faces, their roles, and text sizes
 * relative to the reader's own setting
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §10).
 *
 * Every face is one RISE hosts itself (public/fonts, scripts/build-fonts.mjs),
 * because a host's card may load fonts from RISE's origin and nowhere else,
 * and because no reader's browser should announce itself to a font service
 * to read a page. A model names a face by role (what the text is for) or by
 * id; the role is what the guide teaches.
 *
 * Sizes are steps on the reader's chosen size, never absolute: the reader's
 * setting is the baseline the model moves from, on every host alike.
 */

const face = (id, role, family, weight = 400) => Object.freeze({ id, role, family, weight });

/** The faces, by id. `family` is the CSS stack; the first name is a face RISE hosts. */
export const TYPE_FACES = Object.freeze([
  face('crimson-pro', 'book-serif', "'Crimson Pro', Georgia, serif"),
  face('instrument-serif', 'display-serif', "'Instrument Serif', Georgia, 'Times New Roman', serif"),
  face('instrument-sans', 'humanist-sans', "'Instrument Sans', system-ui, -apple-system, 'Segoe UI', sans-serif"),
  face('space-grotesk', 'geometric-sans', "'Space Grotesk', -apple-system, BlinkMacSystemFont, sans-serif", 500),
  face('jetbrains-mono', 'mono', "'JetBrains Mono', ui-monospace, 'SFMono-Regular', Menlo, monospace"),
  face('marcellus', 'display', "'Marcellus', 'Instrument Serif', Georgia, serif"),
  face('caveat', 'handwritten', "'Caveat', 'Segoe Print', cursive", 500),
  face('barlow-condensed', 'condensed', "'Barlow Condensed', 'Arial Narrow', sans-serif", 500),
  face('inter', null, "'Inter', system-ui, -apple-system, 'Segoe UI', sans-serif")
]);

const BY_ID = new Map(TYPE_FACES.map(item => [item.id, item]));
const BY_ROLE = new Map(TYPE_FACES.filter(item => item.role).map(item => [item.role, item]));

/** The roles a model may name, in the guide's order. */
export const TYPE_ROLES = Object.freeze([...BY_ROLE.keys()]);

/** Everything a `type` field may say: a role, or a face id. */
export const TYPE_NAMES = Object.freeze([...TYPE_ROLES, ...TYPE_FACES.map(item => item.id)]);

/** The face a role or id names, or null. */
export function resolveTypeFace(name) {
  if (typeof name !== 'string') return null;
  return BY_ROLE.get(name) ?? BY_ID.get(name) ?? null;
}

/** The reader's fixed sizes, smallest first; `fit` counts as the largest. */
const SIZE_STEPS = Object.freeze(['small', 'medium', 'large', 'xlarge']);
const STEP_OF = Object.freeze({ smaller: -1, 'as-set': 0, larger: 1, display: 2 });

/**
 * The size a beat asks for, as a step from the reader's own: never below the
 * smallest, never above the largest.
 * @param {string} base the reader's size (a FONT_SIZE_CHIPS fontSize, or 'fit')
 * @param {string|undefined} size the beat's `size`
 */
export function stepFontSize(base, size) {
  const from = SIZE_STEPS.indexOf(base === 'fit' ? 'xlarge' : base);
  const index = (from < 0 ? SIZE_STEPS.indexOf('medium') : from) + (STEP_OF[size] ?? 0);
  return SIZE_STEPS[Math.max(0, Math.min(SIZE_STEPS.length - 1, index))];
}
