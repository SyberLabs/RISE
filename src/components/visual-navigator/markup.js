/**
 * Shared chips, glyphs, and ink helpers for the Visual Navigator.
 */
import { escapeHtml } from '../../core/sanitize.js';
import { VISUAL_TAXONOMY } from '../../core/visual-taxonomy.js';
import { poolOptions } from '../../core/visual-taxonomy-config.js';
import { normalizeWordFill } from '../../core/visual-selection.js';

export const ROOT = VISUAL_TAXONOMY.children;

export const CADENCE = Object.freeze([
  Object.freeze({ value: 0, label: 'Slow' }),
  Object.freeze({ value: 0.5, label: 'Measured' }),
  Object.freeze({ value: 1, label: 'Quick' })
]);
const FOCAL_MAX_DIM = 1024;
const FOCAL_PASSTHROUGH_BYTES = 150 * 1024;

export const optId = o => (typeof o === 'string' ? o : o.id);
export const optLabel = o => (typeof o === 'string' ? o[0].toUpperCase() + o.slice(1) : (o.name || o.label || o.id));

export function glyphFor(node) {
  const glyphs = { off: '○', visual: '❖', focal: '◯', gallery: '▦',
    'gallery-procedural': '❋', 'gallery-sourced': '▤', personal: '◈', dynamic: '∮',
    attractor: '∮', klee: '✎', harmonograph: '∿', ostensoria: '✷', apparitio: '❂',
    fractal: '❋', turrell: '◗', rockgarden: '⬡', neural: '⧉',
    'by-manner': '◐', 'by-subject': '◑', science: '◉',
    face: 'A', size: '⤢', ink: '◑' };
  return glyphs[node.id] || '·';
}

/**
 * A chip carries four conditions — chosen, blocked, owned by a program, and
 * plainly unavailable — and used to render them as near-identical pills. They
 * are not degrees of one thing: `not chosen`, `unavailable because of
 * something you chose elsewhere`, and `fixed because this reading came with a
 * program` are three different messages, and only the last two are worth
 * acting on. An inert chip with no reason attached reads as a broken one, so
 * each state now names itself where the cursor already is.
 */
export const CHIP_REASON = Object.freeze({
  readOnly: 'This reading came with its own visual program, which owns this choice.'
});

/**
 * Why a mask cannot be carried, in the reader's terms.
 *
 * The capability resolver distinguishes four causes and the panel used to
 * answer all of them with one sentence about Thick and Fit — which is simply
 * untrue when the cause is the field. A reader holding a Focal was told to
 * change their face and size, neither of which would have helped.
 */
export const MASK_REASON = Object.freeze({
  'requires-gallery': 'Needs a Gallery field — a Focal or a Dynamic field has no imagery to paint through the letters.',
  'requires-word': 'Needs one word at a time — phrase chunking leaves no single Word to fill.',
  'requires-thick': 'Needs the Thick face — the other three are too fine to carry imagery.',
  'requires-fit': 'Needs the Fit size — a Word must fill the chamber to hold a picture.',
  'program-owned': 'This reading came with its own visual program, which owns this choice.'
});

export function bench(label, opts, className = '') {
  return `
    <div class="vnav-bench ${className}">
      <span class="vnav-bench-label">${escapeHtml(label)}</span>
      <div class="vnav-opts">
        ${opts.map(o => {
    const state = o.blocked ? 'blocked' : (o.readOnly ? 'readOnly' : (o.on ? 'chosen' : 'open'));
    const reason = o.reason || CHIP_REASON[state];
    return `
          <button type="button" class="vnav-opt ${o.on ? 'on is-selected' : ''} ${o.swatch ? 'swatch' : ''} ${o.blocked ? 'is-blocked' : ''} ${o.readOnly ? 'is-owned' : ''} ${o.special ? 'is-special' : ''}"
            data-state="${state}"
            ${reason ? `title="${escapeHtml(reason)}"` : ''}
            ${o.disabled ? 'disabled' : ''} ${o.readOnly || o.blocked ? 'aria-disabled="true"' : ''} ${o.attr}>
            ${o.swatch ? `<i style="background:${escapeHtml(o.swatch)}"></i>` : ''}${escapeHtml(String(o.label))}
          </button>`;
  }).join('')}
      </div>
    </div>`;
}

export const readingCollections = config => Array.isArray(config?.interlocution?.atriumCollections)
  ? config.interlocution.atriumCollections
  : [];

const readAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = event => resolve(event.target.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

export async function compressFocalImage(file) {
  const raw = await readAsDataUrl(file);
  if (file.size <= FOCAL_PASSTHROUGH_BYTES) return raw;
  try {
    const image = await new Promise((resolve, reject) => {
      const node = new Image();
      node.onload = () => resolve(node);
      node.onerror = () => reject(new Error('Image decode failed'));
      node.src = raw;
    });
    const scale = Math.min(1, FOCAL_MAX_DIM / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
    const compressed = canvas.toDataURL('image/jpeg', 0.85);
    return compressed?.length > 64 && compressed.length < raw.length ? compressed : raw;
  } catch (error) {
    console.warn('[VisualNavigator] Focal image compression failed; using original:', error);
    return raw;
  }
}

export function wordFillValue(fill) {
  if (fill?.mode === 'accent') return 'accent';
  const normalized = normalizeWordFill(fill);
  if (normalized.mode !== 'pick') return 'same';
  if (normalized.procedural[0]) return `procedural:${normalized.procedural[0]}`;
  if (normalized.sourced[0]) return `sourced:${normalized.sourced[0]}`;
  return 'same';
}

export function inkFocusFrom(fill) {
  const value = wordFillValue(fill);
  return value.startsWith('procedural:') ? value.slice('procedural:'.length) : null;
}

/**
 * The ink pools, in the four families the taxonomy already keeps them in.
 *
 * These used to be flatMapped into one row, which threw away a distinction
 * the config holds and made a reader sort a Ukiyo-e movement, a bird and a
 * storage scope out of a single undifferentiated pile. A manner of painting,
 * a subject, a domain and a scope are four kinds of answer; only the last is
 * about whose pictures rather than which.
 */
const INK_POOL_FAMILIES = Object.freeze([
  Object.freeze({ id: 'by-manner', label: 'By manner' }),
  Object.freeze({ id: 'by-subject', label: 'By subject' }),
  Object.freeze({ id: 'science', label: 'Science' })
  // 'personal' — Shared pool and This session — is NOT offered here, and the
  // omission is deliberate rather than an oversight. setWordFill accepts the
  // ids, so the chips took a click and looked chosen; but the cortex sorts
  // 'global-pool' and 'custom' into its core types, so _isExternalCategory
  // rejects them, _poolCategoriesForTypes returns nothing, and the fill
  // resolves to an empty pool. A control that answers a press with silence is
  // worse than one that is absent. Restore this family together with a word
  // -fill path that can actually resolve personal works.
]);

export function inkPoolFamilies() {
  const seen = new Set();
  return INK_POOL_FAMILIES.map(family => {
    const options = poolOptions(family.id).filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });
    return { ...family, options };
  }).filter(family => family.options.length > 0);
}
