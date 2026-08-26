/**
 * The bridge between the navigator's selection and `visualConfig`.
 *
 * The taxonomy (visual-taxonomy.js) says what a reader may choose; this says
 * how that choice is written into the score the Chamber already reads —
 * `visualMode` plus `interlocution` / `attractor` / `genesis` / `focals`. Kept
 * apart from the tree because this half is content-coupled (it must know which
 * museum category is a manner and which a subject) while the tree stays pure.
 *
 * TWO DECISIONS THE CREATOR SETTLED, written down where they take effect:
 *
 *  A · ONE POOL PER SOURCED LEAF. `By Manner` carries a single category, not a
 *      set. Wanting Impressionism AND Ukiyo-e is what Blend across leaves is
 *      for. A legacy config that named several manner categories collapses to
 *      the first the next time a reader edits it, and is left untouched until
 *      then.
 *
 *  B · HARMONOGRAPH / IRIS / SPECTRAL ARE DRAWN IN TIME. What makes them
 *      Dynamic is that the Chamber draws them out procedurally over time —
 *      that IS their motion — so they reach the cortex through the procedural
 *      path (`interlocution`, one engine, continuous), not a bespoke director.
 *      Attractor and Genesis differ only in HAVING a director, so they keep
 *      their dedicated modes. No cortex change; the category is true.
 *
 * The engine partitions are DERIVED from the taxonomy's categories, never
 * re-listed here — the redesign's whole point is one categorisation.
 */

import { MUSEUM_CATEGORIES } from '../sources/visual/museum.js';
import {
  DEDICATED_MODE,
  FIELD,
  categoryOf,
  taxonomyLeaves
} from './visual-taxonomy.js';
import { normalizeVisualSelection, normalizeWordFill } from './visual-selection.js';
import {
  GALLERY_CADENCE_DEFAULT,
  normalizeGalleryCadence
} from './visual-presence.js';
import { isLaunchHeldFocal, releaseLaunchHeldFocal } from './visual-identity.js';

/* Procedural engines by role, read off the tree so they cannot drift from it. */
const ENGINE_LEAVES = taxonomyLeaves().filter(l => l.engineId && !l.pool);
const GALLERY_PROCEDURAL = new Set(
  ENGINE_LEAVES.filter(l => l.category === FIELD.GALLERY).map(l => l.engineId)
);
const DYNAMIC_PROCEDURAL = new Set(
  ENGINE_LEAVES
    .filter(l => l.category === FIELD.DYNAMIC && !DEDICATED_MODE[l.engineId])
    .map(l => l.engineId)
);

const PERSONAL_IDS = id => id === 'custom' || id === 'global-pool' || id.startsWith('personal:');

/** A sourced/category id → the leaf that owns it, or null if it maps to none. */
export function classifySourced(id) {
  if (typeof id !== 'string' || !id) return null;
  if (id.startsWith('aic-')) {
    const kind = MUSEUM_CATEGORIES[id.slice(4)]?.kind;
    return { leaf: kind === 'subject' ? 'by-subject' : 'by-manner', pool: id };
  }
  if (id.startsWith('sci-')) return { leaf: 'science', pool: id };
  if (PERSONAL_IDS(id)) return { leaf: 'personal', pool: id };
  return null;   // a retired or unknown source: carried in config, not shown
}

/** The default pool a Sourced/Personal leaf shows before a reader picks one. */
const DEFAULT_POOL = Object.freeze({
  'by-manner': 'aic-impressionism',
  'by-subject': 'aic-ships',
  'science': 'sci-astronomy',
  'personal': 'global-pool'
});

const emptySelection = () => ({
  enabled: new Set(),
  style: {
    focal: { type: 'standard', glyph: 'breath' },
    attractor: { system: 'aizawa', palette: 'white', form: 'mirror' },
    klee: { preset: 'random', glass: true },
    harmonograph: { climate: 'auto' }
  },
  pool: { ...DEFAULT_POOL },
  livingText: { enabled: false },
  galleryCadence: GALLERY_CADENCE_DEFAULT,
  streamGlass: true,
  wordFill: { mode: 'same' },
  emptyGallery: false,
  preserveBaseSelection: false,
  focalDirty: false,
  programLocked: false,
  config: {}
});

/**
 * A `visualConfig` → the navigator's selection.
 *
 * The inverse of `configPatch`. Reads the mode a session was saved in and
 * rebuilds which leaves are on and how each is styled, so reopening the panel
 * shows the reading exactly as it will play.
 */
export function selectionFromConfig(visualConfig = {}) {
  const sel = emptySelection();
  const cfg = visualConfig || {};
  sel.config = cloneVisualConfig(cfg);
  sel.livingText = {
    ...(cfg.livingText || {}),
    enabled: cfg.livingText?.enabled === true
  };
  sel.galleryCadence = normalizeGalleryCadence(
    cfg.interlocution?.galleryCadence ?? GALLERY_CADENCE_DEFAULT
  );
  // The session compiler reads this as "glass unless explicitly false", so
  // the selection has to carry the same default or reopening a reading would
  // quietly switch its glass off.
  sel.streamGlass = cfg.interlocution?.streamGlass !== false;
  sel.wordFill = cloneWordFill(cfg.interlocution?.wordFill);
  const mode = cfg.visualMode || 'off';

  if (cfg.focals?.standardGlyph) sel.style.focal.glyph = cfg.focals.standardGlyph;
  if (cfg.focals?.type === 'personal') sel.style.focal.type = 'personal';
  if (cfg.attractor) sel.style.attractor = { ...sel.style.attractor, ...cfg.attractor };
  if (cfg.genesis) sel.style.klee = { ...sel.style.klee, ...cfg.genesis };

  if (mode === 'off') return sel;
  if (mode === 'focals') { sel.enabled.add('focal'); return sel; }
  if (mode === 'attractor') { sel.enabled.add('attractor'); return sel; }
  if (mode === 'genesis') { sel.enabled.add('klee'); return sel; }

  // interlocution — the shared procedural + sourced pool.
  sel.emptyGallery = true;
  const inter = normalizeVisualSelection(cfg.interlocution || {});
  const procedural = inter.procedural || [];
  const dynamicProc = procedural.filter(id => DYNAMIC_PROCEDURAL.has(id));
  const galleryProc = procedural.filter(id => GALLERY_PROCEDURAL.has(id));
  const sourced = inter.sourced || [];

  if (cfg.interlocution?.harmonographClimate) {
    sel.style.harmonograph.climate = cfg.interlocution.harmonographClimate;
  }

  // An exclusive Dynamic field: one drawn-in-time engine, nothing else.
  if (dynamicProc.length === 1 && galleryProc.length === 0 && sourced.length === 0) {
    sel.enabled.add(dynamicProc[0]);
    sel.emptyGallery = false;
    return sel;
  }

  // Otherwise a Gallery — held presence, one pool per sourced leaf.
  for (const id of galleryProc) sel.enabled.add(id);
  for (const id of sourced) {
    const hit = classifySourced(id);
    if (!hit) continue;
    if (!sel.enabled.has(hit.leaf)) { sel.enabled.add(hit.leaf); sel.pool[hit.leaf] = hit.pool; }
  }
  sel.emptyGallery = sel.enabled.size === 0;
  sel.preserveBaseSelection = sel.emptyGallery
    && (procedural.length > 0 || sourced.length > 0);
  return sel;
}

/**
 * The navigator's selection → a `visualConfig` patch.
 *
 * Only the fields a field-choice owns; a caller spreads it over the config it
 * already holds so pace, living text, and the rest are untouched. The
 * interlocution it writes is normalised, so what it hands back is exactly what
 * the Chamber will keep — no family it declares can silently prune a shelf.
 */
function fieldPatch(selection) {
  const { enabled, style, pool } = selection;
  const on = [...enabled];

  if (!on.length) {
    if (selection.emptyGallery) {
      const held = selection.programLocked || selection.preserveBaseSelection
        ? (selection.config?.interlocution || {})
        : {};
      return {
        visualMode: 'interlocution',
        interlocution: withNormalised({
          ...held,
          sourceFamily: held.sourceFamily || 'procedural',
          procedural: Array.isArray(held.procedural) ? held.procedural : [],
          sourced: Array.isArray(held.sourced) ? held.sourced : [],
          presentation: 'continuous'
        })
      };
    }
    return { visualMode: 'off' };
  }
  if (enabled.has('focal')) {
    return {
      visualMode: 'focals',
      focals: style.focal.type === 'personal'
        ? { type: 'personal' }
        : { type: 'standard', standardGlyph: style.focal.glyph }
    };
  }
  if (enabled.has('klee')) return { visualMode: 'genesis', genesis: { ...style.klee } };

  // A single drawn-in-time engine, or a Gallery of held sources.
  const dynamic = on.find(id => DYNAMIC_PROCEDURAL.has(id));
  if (dynamic) {
    return {
      visualMode: 'interlocution',
      interlocution: withNormalised({
        sourceFamily: 'procedural',
        procedural: [dynamic],
        sourced: [],
        presentation: 'continuous',
        harmonographClimate: style.harmonograph.climate,
        // The engine's own dials travel with it. The cortex reads
        // config.attractor for system, palette and form; without this the
        // living field would fall back to defaults and a reader's Halvorsen
        // would quietly become an Aizawa.
        attractor: { ...style.attractor }
      })
    };
  }

  const procedural = on.filter(id => GALLERY_PROCEDURAL.has(id));
  const selectedSourced = on
    .filter(id => classifySourced(pool[id] || '') || pool[id])
    .filter(id => ['by-manner', 'by-subject', 'science', 'personal'].includes(id))
    .map(id => pool[id])
    .filter(Boolean);
  const preservedSourced = normalizeVisualSelection(selection.config?.interlocution || {}).sourced
    .filter(id => !classifySourced(id));
  const sourced = [...new Set([...selectedSourced, ...preservedSourced])];

  return {
    visualMode: 'interlocution',
    interlocution: withNormalised({
      sourceFamily: galleryFamily(procedural, sourced),
      procedural,
      sourced,
      presentation: 'continuous'
    })
  };
}

/**
 * The complete visual configuration emitted by the Navigator.
 *
 * The tree owns field selection; the preserved base owns runtime settings the
 * reader is not editing here. Rich engine styles remain present even while a
 * different field occupies the room, because Ink may reference them. This is
 * the sole merge boundary — the component never reconstructs visualConfig.
 */
export function configPatch(selection) {
  const base = cloneVisualConfig(selection.config || {});
  const field = fieldPatch(selection);
  const held = isLaunchHeldFocal(base.focals);
  let focals = {
    type: 'standard',
    standardGlyph: selection.style.focal.glyph,
    ...(base.focals || {})
  };

  if (field.visualMode === 'focals') {
    if (!held || selection.focalDirty) {
      focals = { ...focals, ...(field.focals || {}) };
    }
  } else {
    focals = releaseLaunchHeldFocal(focals) || focals;
  }

  return {
    ...base,
    ...field,
    focals,
    attractor: { ...(base.attractor || {}), ...selection.style.attractor },
    genesis: { ...(base.genesis || {}), ...selection.style.klee },
    livingText: { ...(base.livingText || {}), ...selection.livingText },
    interlocution: {
      ...(base.interlocution || {}),
      ...(field.interlocution || {}),
      galleryCadence: normalizeGalleryCadence(selection.galleryCadence),
      streamGlass: selection.streamGlass !== false,
      wordFill: cloneWordFill(selection.wordFill)
    }
  };
}

/** Blend the moment the pool mixes kinds; otherwise the single kind's family. */
function galleryFamily(procedural, sourced) {
  const kinds = [
    procedural.length > 0,
    sourced.some(id => !PERSONAL_IDS(id)),
    sourced.some(PERSONAL_IDS)
  ].filter(Boolean).length;
  if (kinds >= 2) return 'blend';
  if (procedural.length) return 'procedural';
  if (sourced.some(PERSONAL_IDS)) return 'personal';
  return 'collections';
}

function withNormalised(inter) {
  const norm = normalizeVisualSelection(inter);
  return { ...inter, ...norm };
}

function cloneWordFill(value) {
  const fill = normalizeWordFill(value);
  if (fill.mode === 'plain' || fill.mode === 'accent') return { mode: fill.mode };
  if (fill.mode === 'same') return { mode: 'same', ...(fill.border ? { border: fill.border } : {}) };
  return {
    ...fill,
    procedural: [...fill.procedural],
    sourced: [...fill.sourced]
  };
}

function cloneVisualConfig(value) {
  const config = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    ...config,
    focals: { ...(config.focals || {}) },
    attractor: { ...(config.attractor || {}) },
    genesis: { ...(config.genesis || {}) },
    livingText: { ...(config.livingText || {}) },
    interlocution: {
      ...(config.interlocution || {}),
      ...(config.interlocution?.wordFill
        ? { wordFill: cloneWordFill(config.interlocution.wordFill) }
        : {})
    }
  };
}

/**
 * The pools a Sourced or Personal leaf offers — its dropdown, from the
 * registries. One pool is chosen per leaf (decision A), so these are the
 * options that one choice ranges over. Manner and subject are the museum's
 * own `kind`; Science is its own registry; Personal is the two shared shelves
 * a reader always has (blueprint pools are added by the app at mount).
 */
export function poolOptions(leafId) {
  const museum = kind => Object.entries(MUSEUM_CATEGORIES)
    .filter(([, cat]) => cat.kind === kind)
    .map(([id, cat]) => ({ id: `aic-${id}`, label: cat.name }));
  switch (leafId) {
    case 'by-manner': return museum('style');
    case 'by-subject': return museum('subject');
    case 'science': return [{ id: 'sci-astronomy', label: 'Astronomy' }];
    case 'personal': return [
      { id: 'global-pool', label: 'Shared pool' },
      { id: 'custom', label: 'This session' }
    ];
    default: return [];
  }
}
