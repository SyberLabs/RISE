/**
 * The phone navigator's rail: every taxonomy leaf, in one line a thumb can
 * run along.
 *
 * A PROJECTION, NEVER A SECOND LIST. The rail is derived from the taxonomy's
 * leaves and categories, so an engine added to the tree reaches the rail with
 * no edit here. Families are named in the reader's words; the categories they
 * come from stay the engine's words and stay in visual-taxonomy.js.
 */
import { FIELD, categoryOf, taxonomyLeaves } from './visual-taxonomy.js';

export const RAIL_FAMILIES = Object.freeze([
  Object.freeze({ id: 'stillness', label: 'Stillness' }),
  Object.freeze({ id: 'drawn', label: 'Drawn' }),
  Object.freeze({ id: 'fields', label: 'Fields' }),
  Object.freeze({ id: 'art', label: 'Art' }),
  Object.freeze({ id: 'yours', label: 'Yours' })
]);

function familyOf(leaf) {
  if (leaf.category === FIELD.OFF || leaf.category === FIELD.FOCAL) return 'stillness';
  if (leaf.category === FIELD.DYNAMIC) return 'drawn';
  if (leaf.pool === 'personal') return 'yours';
  if (leaf.pool) return 'art';
  return 'fields';
}

export function worldRail(leaves = taxonomyLeaves()) {
  const order = RAIL_FAMILIES.map(family => family.id);
  return Object.freeze(leaves
    .map((leaf, index) => ({ leaf, index, family: familyOf(leaf) }))
    .sort((a, b) => order.indexOf(a.family) - order.indexOf(b.family) || a.index - b.index)
    .map(({ leaf, family }) => Object.freeze({
      id: leaf.id,
      label: leaf.label,
      family,
      category: leaf.category,
      engineId: leaf.engineId || null,
      pool: leaf.pool || null
    })));
}

export function railNeighbour(rail, id, step) {
  const at = rail.findIndex(world => world.id === id);
  if (at < 0) return rail[0]?.id ?? null;
  return rail[Math.max(0, Math.min(rail.length - 1, at + step))].id;
}

/**
 * Choose is replace. The rail commits one visual; joining a second Gallery
 * source is the separate Blend act, which keeps `toggleField`.
 */
export function chooseField(enabled, id) {
  const category = categoryOf(id);
  if (!category) return new Set(enabled);
  return category === FIELD.OFF ? new Set() : new Set([id]);
}
