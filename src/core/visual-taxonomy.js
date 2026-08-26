/**
 * The canonical shape of the visual system — one tree, read everywhere.
 *
 * The Orbital's visual panel grew five top-level modes, a source family, and a
 * flat word-source dropdown that each named the same engines at different
 * depths — so Attractor was a full bench in one place and a single dead line
 * in another (VISION V2). This module is the settled hierarchy as data: a
 * reader walks Off · Visual → { Focal, Gallery, Dynamic }, and every surface
 * that shows a field reads it from here rather than re-listing it.
 *
 * WHAT THIS MODULE IS AND IS NOT. It is the tree, the categories, and the pure
 * rules for what may be on at once. It is NOT the panel (that renders this) and
 * NOT the config mapping to `rise.experience-program.v1` (that is the panel's
 * job, and it reads the categories declared here to know how to write). Kept
 * headless so the rules are testable with no DOM, the way the partition was.
 *
 * SUBSTYLES ARE LINKED, NEVER COPIED. An engine's systems, palettes, presets,
 * and climates already live in visual-style-definitions.js; a leaf points at
 * them. Two copies of a style list is one list and one thing that will
 * disagree with it — the defect this whole redesign exists to end.
 */

import {
  ATTRACTOR_SYSTEMS,
  ATTRACTOR_PALETTES,
  FOCAL_GLYPHS,
  HARMONOGRAPH_CLIMATES,
  KLEE_PRESETS
} from './visual-style-definitions.js';
import { LISTED_PROCEDURAL_PATTERNS } from './visual-registry.js';

/**
 * The four kinds of field, and the one rule that separates them.
 *
 * OFF, FOCAL, and DYNAMIC are EXCLUSIVE — one at a time, because each IS the
 * room: a single point, or a single drawing gesture. GALLERY is the one
 * blendable kind — held imagery that intermingles — so enabling a second
 * gallery source does not clear the first. That difference is the whole of
 * what "Blend" used to be: a state, not a menu item.
 */
export const FIELD = Object.freeze({
  OFF: 'off',
  FOCAL: 'focal',
  GALLERY: 'gallery',
  DYNAMIC: 'dynamic'
});

/**
 * Which category each registered procedural engine belongs to.
 *
 * The reader-facing split the creator settled: engines that DRAW themselves —
 * orbit, grow, trace — are Dynamic and exclusive; engines that are simply a
 * held field are Gallery and blendable. Attractor and Klee are Dynamic but
 * reach the cortex through their own dedicated modes rather than the gallery
 * pool, so they carry `mode` here; the rest are Dynamic-by-single-procedural
 * (one engine, continuous) or Gallery-by-pool.
 *
 * A NEW ENGINE MUST BE PLACED. `everyEngineIsCategorised` (the test) fails if
 * the registry gains an id this map does not name, so an engine can never
 * reach a reader uncategorised — the guard the flat dropdown never had.
 */
const ENGINE_CATEGORY = Object.freeze({
  attractor: FIELD.DYNAMIC,
  klee: FIELD.DYNAMIC,          // surfaced as the "Genesis" leaf
  harmonograph: FIELD.DYNAMIC,
  ostensoria: FIELD.DYNAMIC,    // surfaced as "Iris Plates"
  apparitio: FIELD.DYNAMIC,     // surfaced as "Spectral Plates"
  fractal: FIELD.GALLERY,
  turrell: FIELD.GALLERY,
  neural: FIELD.GALLERY,
  rockgarden: FIELD.GALLERY
});

/** Engines that own a dedicated visualMode, not the shared procedural pool. */
export const DEDICATED_MODE = Object.freeze({ attractor: 'attractor', klee: 'genesis' });

/** Display names that diverge from the registry id (the creator's renames). */
const DISPLAY_NAME = Object.freeze({
  klee: 'Genesis',
  ostensoria: 'Iris Plates',
  apparitio: 'Spectral Plates',
  rockgarden: 'Rock Garden'
});

const engine = id => LISTED_PROCEDURAL_PATTERNS.find(p => p.id === id) || null;
const engineName = id => DISPLAY_NAME[id] || engine(id)?.name || id;

/**
 * A leaf's substyle benches — the SAME objects the current panel renders,
 * addressed by engine id so a leaf never restates them.
 */
export function substylesFor(engineId) {
  switch (engineId) {
    case 'attractor':
      return [
        { key: 'system', label: 'System', options: ATTRACTOR_SYSTEMS },
        { key: 'palette', label: 'Filament', options: ATTRACTOR_PALETTES },
        { key: 'form', label: 'Form', options: ['mirror', 'kaleido', 'bilateral'] }
      ];
    case 'klee':
      return [{ key: 'preset', label: 'Preset', options: KLEE_PRESETS }];
    case 'harmonograph':
      return [{ key: 'climate', label: 'Climate', options: HARMONOGRAPH_CLIMATES }];
    default:
      return [];
  }
}

const leaf = (id, extra = {}) => Object.freeze({
  id,
  label: extra.label || engineName(id),
  category: extra.category || ENGINE_CATEGORY[id] || FIELD.GALLERY,
  engineId: extra.engineId ?? id,
  ...extra
});

/**
 * THE TREE. Off, then Visual with its three rooms. Focal is a leaf with a
 * glyph bench; Gallery divides into Procedural / Sourced / Personal; Dynamic
 * lists the drawing engines. Sourced and Personal name their kinds rather than
 * every pool, because a pool is data the catalogue owns, not structure.
 */
export const VISUAL_TAXONOMY = Object.freeze({
  id: 'field',
  label: 'The Field',
  children: Object.freeze([
    Object.freeze({ id: 'off', label: 'Off', category: FIELD.OFF, kind: 'leaf' }),
    Object.freeze({
      id: 'visual',
      label: 'Visual',
      kind: 'branch',
      children: Object.freeze([
        Object.freeze({
          id: 'focal',
          label: 'Focal',
          category: FIELD.FOCAL,
          kind: 'leaf',
          glyphs: FOCAL_GLYPHS
        }),
        Object.freeze({
          id: 'gallery',
          label: 'Gallery',
          category: FIELD.GALLERY,
          kind: 'branch',
          continuousOnly: true,   // flashes are authored in the Workshop
          children: Object.freeze([
            Object.freeze({
              id: 'gallery-procedural',
              label: 'Procedural',
              kind: 'branch',
              children: Object.freeze(
                galleryEngineIds().map(id => leaf(id, { kind: 'leaf' }))
              )
            }),
            Object.freeze({
              id: 'gallery-sourced',
              label: 'Sourced',
              kind: 'branch',
              children: Object.freeze([
                Object.freeze({ id: 'by-manner', label: 'By Manner', category: FIELD.GALLERY, kind: 'leaf', pool: 'manner' }),
                Object.freeze({ id: 'by-subject', label: 'By Subject', category: FIELD.GALLERY, kind: 'leaf', pool: 'subject' }),
                Object.freeze({ id: 'science', label: 'Science', category: FIELD.GALLERY, kind: 'leaf', pool: 'science' })
              ])
            }),
            Object.freeze({ id: 'personal', label: 'Personal', category: FIELD.GALLERY, kind: 'leaf', pool: 'personal' })
          ])
        }),
        Object.freeze({
          id: 'dynamic',
          label: 'Dynamic',
          category: FIELD.DYNAMIC,
          kind: 'branch',
          children: Object.freeze(
            dynamicEngineIds().map(id => leaf(id, { kind: 'leaf' }))
          )
        })
      ])
    })
  ])
});

function galleryEngineIds() {
  return Object.keys(ENGINE_CATEGORY).filter(id => ENGINE_CATEGORY[id] === FIELD.GALLERY);
}
function dynamicEngineIds() {
  // Attractor and Genesis(klee) first — they carry the dedicated modes and the
  // richest benches — then the single-procedural dynamic fields.
  const order = ['attractor', 'klee', 'harmonograph', 'ostensoria', 'apparitio'];
  return order.filter(id => ENGINE_CATEGORY[id] === FIELD.DYNAMIC);
}

/** Every leaf, flattened — the panel's lookup and the tests' inventory. */
export function taxonomyLeaves(node = VISUAL_TAXONOMY, out = []) {
  if (node.kind === 'leaf' || (!node.children && node.id !== 'field')) {
    if (node.category) out.push(node);
  }
  (node.children || []).forEach(child => taxonomyLeaves(child, out));
  return out;
}

const LEAF_BY_ID = Object.freeze(
  Object.fromEntries(taxonomyLeaves().map(node => [node.id, node]))
);
export const leafById = id => LEAF_BY_ID[id] || null;
export const categoryOf = id => LEAF_BY_ID[id]?.category ?? null;

/**
 * Turn a leaf on or off, honouring the one rule.
 *
 * Pure: a Set in, a NEW Set out, so a caller can hold the old one. Enabling an
 * exclusive field clears everything; enabling a gallery source clears only the
 * exclusive fields and joins whatever gallery sources are already on. Off is
 * the empty room, so enabling it clears all and adds nothing.
 */
export function toggleField(enabled, id) {
  const next = new Set(enabled);
  const cat = categoryOf(id);
  if (!cat) return next;
  if (next.has(id)) { next.delete(id); return next; }
  if (cat === FIELD.GALLERY) {
    for (const held of [...next]) if (categoryOf(held) !== FIELD.GALLERY) next.delete(held);
    next.add(id);
  } else {
    next.clear();
    if (cat !== FIELD.OFF) next.add(id);
  }
  return next;
}

/** The gallery sources currently on — two or more of which is a Blend. */
export function galleryMembers(enabled) {
  return [...enabled].filter(id => categoryOf(id) === FIELD.GALLERY);
}
export function isBlend(enabled) {
  return galleryMembers(enabled).length >= 2;
}

/** One line for the status bar: "— off —", a leaf's name, or "Blend · N". */
export function describeField(enabled) {
  const on = [...enabled];
  if (!on.length) return '— off —';
  const gallery = galleryMembers(enabled);
  if (gallery.length >= 2) return `Blend · ${gallery.length} in gallery`;
  return LEAF_BY_ID[on[0]]?.label || '—';
}
