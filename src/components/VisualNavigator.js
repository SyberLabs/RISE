/**
 * VisualNavigator — the field, chosen by walking a directory.
 *
 * The Orbital's five-mode selector and its flat word-source dropdown are
 * replaced by the canonical tree: Off · Visual → { Focal, Gallery, Dynamic }.
 * A reader descends the columns, opens a leaf's entry — its name, nature,
 * substyles, and one switch — and the room changes. Every rule about what may
 * be on at once lives in visual-taxonomy.js; every rule about how a choice
 * becomes a score lives in visual-taxonomy-config.js. This draws them.
 *
 * IT COMPUTES NO CONFIG OF ITS OWN. On any change it hands `configPatch` the
 * whole selection and emits the patch — the same discipline the admit room
 * kept with the partition: the view renders and reports, the model decides.
 *
 * ChamberOrbital mounts this as the reader's sole visual-control surface.
 */

import { escapeHtml, safeUrl } from '../core/sanitize.js';
import {
  FIELD,
  VISUAL_TAXONOMY,
  categoryOf,
  describeField,
  galleryMembers,
  isBlend,
  leafById,
  substylesFor,
  toggleField
} from '../core/visual-taxonomy.js';
import {
  configPatch,
  poolOptions,
  selectionFromConfig
} from '../core/visual-taxonomy-config.js';
import { CHAMBER_STREAM_FACES, resolveChamberStreamFace } from '../core/chamber-stream-face.js';
import {
  FONT_SIZE_CHIPS,
  SIZE_HINT_FIT,
  persistFontSize,
  resolveFontSize,
  threeStepIntent
} from '../core/chamber-type-size.js';
import { resolveTextMaterialCapability } from '../core/chamber-text-material.js';
import { WORD_FILL_PROCEDURAL_PATTERNS } from '../core/visual-registry.js';
import { normalizeGlobalPoolSelection, normalizeWordFill } from '../core/visual-selection.js';
import { MemoryCore } from '../core/memory.js';
import { normalizeGalleryCadence } from '../core/visual-presence.js';
import {
  clearLaunchVisualSelection,
  releaseLaunchHeldFocal
} from '../core/visual-identity.js';
import { FOCAL_GLYPHS } from '../core/visual-style-definitions.js';
import './VisualNavigator.css';

const ROOT = VISUAL_TAXONOMY.children;   // [off, visual]
const TEXT = Object.freeze([
  Object.freeze({ id: 'face', label: 'Face', textControl: true }),
  Object.freeze({ id: 'size', label: 'Size', textControl: true }),
  Object.freeze({ id: 'ink', label: 'Ink', textControl: true })
]);
const ROOT_WITH_TEXT = Object.freeze([...ROOT, ...TEXT]);
const CADENCE = Object.freeze([
  Object.freeze({ value: 0, label: 'Slow' }),
  Object.freeze({ value: 0.5, label: 'Measured' }),
  Object.freeze({ value: 1, label: 'Quick' })
]);
const FOCAL_MAX_DIM = 1024;
const FOCAL_PASSTHROUGH_BYTES = 150 * 1024;

const CHAPEL_COLLECTION_LABELS = Object.freeze({
  'chapel-crucifixion': 'The Crucifixion',
  'chapel-passion': 'The Passion',
  'chapel-nativity': 'The Nativity',
  'chapel-resurrection': 'The Resurrection',
  'chapel-prophets': 'The Prophets',
  'chapel-patriarchs': 'The Patriarchs',
  'dore:all': 'Doré · The Old Testament'
});

/** An option in a substyle bench may be a string or a { id, name } record. */
const optId = o => (typeof o === 'string' ? o : o.id);
const optLabel = o => (typeof o === 'string' ? o[0].toUpperCase() + o.slice(1) : (o.name || o.label || o.id));

export class VisualNavigator {
  constructor(container, options = {}) {
    this.container = container;
    this.onChange = options.onChange || (() => {});
    this.onTextMaterialTransaction = options.onTextMaterialTransaction || (() => {});
    this.onOpenPersonal = options.onOpenPersonal || (() => {});
    this.locked = options.locked === true;
    this.lockedMessage = options.lockedMessage || 'Load text to configure visuals.';
    this.programInfo = options.programInfo || null;
    this.selection = selectionFromConfig(options.visualConfig || {});
    this.selection.programLocked = Boolean(this.programInfo);
    this._chapelLaunch = options.readingVisualDomain === 'chapel'
      || readingCollections(this.selection.config).some(isChapelCollection);
    this._chapelTrayOpen = false;
    this.inkFocus = inkFocusFrom(this.selection.wordFill);
    this.dialog = null;
    this._dialogReturnFocusSelector = null;
    this._restoringDialogFocus = false;
    this._faceHint = false;
    this.path = [];          // branch nodes descended, under ROOT
    this.focus = null;       // the open leaf, or null
    this._destroyed = false;

    // Arrive on whatever is already enabled, so reopening shows the reading.
    const first = [...this.selection.enabled][0];
    if (first) this.openLeafById(first);

    this.render();
  }

  /* ── selection helpers ────────────────────────────────────────────── */
  patch() {
    return configPatch(this.selection);
  }

  emit() {
    if (this._destroyed) return;
    const next = this.patch();
    this.selection.config = next;
    this.onChange(next);
  }

  styleOf(engineId) {
    return this.selection.style[engineId === 'genesis' ? 'klee' : engineId] || {};
  }

  /* ── navigation ───────────────────────────────────────────────────── */
  columns() {
    const cols = [ROOT_WITH_TEXT];
    for (const node of this.path) if (node.children) cols.push(node.children);
    return cols;
  }

  openLeafById(id) {
    // Walk to the leaf so its column chain is shown around it.
    const trail = [];
    const find = (nodes, chain) => {
      for (const n of nodes) {
        if (n.id === id) { trail.push(...chain, n); return true; }
        if (n.children && find(n.children, [...chain, n])) return true;
      }
      return false;
    };
    find(ROOT, []);
    if (!trail.length) return;
    this.focus = trail[trail.length - 1];
    this.path = trail.slice(0, -1).filter(n => n.children);
  }

  navigate(colIndex, node) {
    this.path = this.path.slice(0, colIndex);
    if (node.children) { this.path.push(node); this.focus = null; }
    else { this.focus = node; }
    // FACE, SIZE AND INK NAME A PLACE IN ONE PANE, SO GOING THERE HAS TO GO
    // THERE. They marked their section active and left the reader looking at
    // whatever the pane happened to be scrolled to — a rail entry that
    // highlights a destination without travelling to it is a broken link.
    if (node.textControl) this._revealSection = node.id;
    this.render();
  }

  /**
   * Put the named section under the pinned specimen.
   *
   * render() restores each pane's scroll offset so that choosing a chip near
   * the bottom does not snap the pane away from it; a rail navigation is the
   * one case that MUST override that, because the reader asked to be moved.
   */
  _revealNamedSection() {
    const id = this._revealSection;
    this._revealSection = null;
    if (!id) return;
    const pane = this.container.querySelector('.vnav-entry');
    // Matched rather than selected: the ids are a known set, and jsdom has
    // no CSS.escape to build a selector with.
    const section = pane && [...pane.querySelectorAll('[data-section]')]
        .find(el => el.dataset.section === id);
    if (!pane || !section) return;
    const specimen = pane.querySelector('.vnav-specimen');
    const clearance = (specimen?.offsetHeight || 0) + 8;
    const delta = section.getBoundingClientRect().top - pane.getBoundingClientRect().top;
    pane.scrollTop = Math.max(0, pane.scrollTop + delta - clearance);
  }

  /* ── mutation ─────────────────────────────────────────────────────── */
  toggleEnabled() {
    const leaf = this.focus;
    if (!leaf || !categoryOf(leaf.id) || this.locked || this.programInfo) return;
    // The one rule lives in the model; call it and take the new set.
    this.selection.enabled = toggleField(this.selection.enabled, leaf.id);
    this.selection.emptyGallery = false;
    this.selection.preserveBaseSelection = false;
    this.emit();
    this.render();
  }

  setSubstyle(engineId, key, value) {
    if (this.locked || this.programInfo) return;
    const bucket = engineId === 'genesis' ? 'klee' : engineId;
    this.selection.style[bucket] = { ...this.selection.style[bucket], [key]: value };
    this.emit();
    this.render();
  }

  setGlyph(glyph) {
    if (this.locked || this.programInfo) return;
    this.selection.style.focal = { ...this.selection.style.focal, type: 'standard', glyph };
    this.selection.focalDirty = true;
    this.emit();
    this.render();
  }

  navigateBack() {
    if (!this.path.length) return;
    this.path = this.path.slice(0, -1);
    this.focus = null;
    this.render();
  }

  setFocalType(type) {
    if (this.locked || this.programInfo || !['standard', 'personal'].includes(type)) return;
    this.selection.style.focal = { ...this.selection.style.focal, type };
    this.selection.focalDirty = true;
    this.emit();
    this.render();
  }

  async setPersonalFocalFile(file) {
    if (!file || this.locked || this.programInfo) return;
    const image = await compressFocalImage(file);
    if (this._destroyed) return;
    this.selection.config.focals = {
      ...(this.selection.config.focals || {}),
      type: 'personal',
      personalImage: image
    };
    this.selection.style.focal.type = 'personal';
    this.selection.focalDirty = true;
    this.emit();
    this.render();
  }

  removePersonalFocal() {
    if (this.locked || this.programInfo) return;
    this.selection.config.focals = {
      ...(this.selection.config.focals || {}),
      type: 'personal',
      personalImage: null
    };
    this.selection.style.focal.type = 'personal';
    this.selection.focalDirty = true;
    this.emit();
    this.render();
  }
  /**
   * WHO OWNS THE GLASS RIGHT NOW.
   *
   * One class on one element — `glass-tile` on the atom — is read from
   * `genesis.glass` when the Genesis engine is mounted and from
   * `interlocution.streamGlass` otherwise. Genesis is a Dynamic field and
   * Dynamic is exclusive, so exactly one owner can hold it at a time; the
   * reader sees one thing either way, and should have one switch.
   */
  _glassOwner() {
    return this.selection.enabled.has('klee') ? 'genesis' : 'stream';
  }

  /** Is the glass on, in whichever key the mounted field reads? */
  glassOn() {
    return this._glassOwner() === 'genesis'
      ? this.selection.style.klee.glass !== false
      : this.selection.streamGlass !== false;
  }

  setGlass(on) {
    if (this.locked || this.programInfo) return;
    if (this._glassOwner() === 'genesis') {
      this.selection.style.klee = { ...this.selection.style.klee, glass: on === true };
    } else {
      this.selection.streamGlass = on === true;
    }
    this.emit();
    this.render();
  }
  setPool(leafId, poolId) {
    if (this.locked || this.programInfo) return;
    this.selection.pool = { ...this.selection.pool, [leafId]: poolId };
    this.emit();
    this.render();
  }

  setGlobalPoolMode(mode) {
    if (this.locked || this.programInfo) return;
    const current = normalizeGlobalPoolSelection(this.selection.config.interlocution?.globalPool);
    this.selection.config.interlocution = {
      ...(this.selection.config.interlocution || {}),
      globalPool: normalizeGlobalPoolSelection({ ...current, mode })
    };
    this.emit();
    this.render();
  }

  toggleGlobalAsset(id) {
    if (this.locked || this.programInfo) return;
    const current = normalizeGlobalPoolSelection(this.selection.config.interlocution?.globalPool);
    const assetIds = current.assetIds.includes(id)
      ? current.assetIds.filter(assetId => assetId !== id)
      : [...current.assetIds, id];
    this.selection.config.interlocution = {
      ...(this.selection.config.interlocution || {}),
      globalPool: normalizeGlobalPoolSelection({ mode: 'selected', assetIds })
    };
    this.emit();
    this.render();
  }

  releaseToProgram() {
    if (!this.programInfo) return;
    this.selection.enabled = new Set();
    this.selection.emptyGallery = true;
    this.selection.focalDirty = false;
    this.emit();
    this.render();
  }

  writeSetting(key, value) {
    if (typeof window === 'undefined') return;
    if (typeof window.rise?.handleSettingsChange === 'function') {
      window.rise.handleSettingsChange(key, value);
    } else if (window.rise?.settings) {
      window.rise.settings[key] = value;
    }
  }

  textMaterialSettings() {
    return {
      face: resolveChamberStreamFace(globalThis.rise?.settings?.chamberFace),
      fontSize: resolveFontSize(globalThis.rise?.settings?.fontSize)
    };
  }

  /**
   * Is the field a continuous Gallery — the one category that can be painted
   * through letters?
   *
   * Off, Focal and Dynamic are the exclusive categories, and none of them
   * offers a continuous surface behind the reading, so none of them can carry
   * a mask. `emptyGallery` counts: it emits interlocution + continuous with an
   * empty pool, which is a Gallery waiting for works.
   */
  _fieldIsGallery() {
    if (this.selection.emptyGallery) return true;
    const on = [...this.selection.enabled];
    return on.length > 0 && on.every(id => categoryOf(id) === FIELD.GALLERY);
  }

  /**
   * THE PANEL USED TO ASSERT THE FIELD RATHER THAN ASK IT.
   *
   * This passed `visualMode: 'interlocution'` and `presentation: 'continuous'`
   * as constants, so of the resolver's four conditions only two could ever
   * fail — which is why every refusal in this panel said "requires Thick +
   * Fit", and why `requires-gallery` was a state the reader could never be
   * shown. It also explains the silent overwrite in setSize: when a reader
   * held a Focal and chose Fit, the panel discarded the Focal to make its own
   * assumption true rather than report that the two do not fit.
   *
   * Asking costs nothing and makes the refusals honest.
   */
  textMaterialCapability(wordFill = this.selection.wordFill, settings = this.textMaterialSettings()) {
    const gallery = this._fieldIsGallery();
    return resolveTextMaterialCapability({
      face: settings.face,
      fontSize: settings.fontSize,
      chunkMode: 'word',
      visualMode: gallery ? 'interlocution' : 'off',
      presentation: gallery ? 'continuous' : 'full-frame',
      wordFill,
      programOwned: Boolean(this.programInfo)
    });
  }

  hasActiveMask() {
    return this.textMaterialCapability().maskActive;
  }

  requestTextMaterialTransaction({ face, fontSize, wordFill, temporal = null, settings = null }) {
    const next = normalizeWordFill(wordFill);
    this.selection.wordFill = next;
    const visualConfig = configPatch(this.selection);
    this.selection.config = visualConfig;
    this.onTextMaterialTransaction({
      settings: settings || { chamberFace: face, fontSize },
      temporal,
      visualConfig
    });
  }

  openDialog(dialog, returnFocus = document.activeElement) {
    this.dialog = dialog;
    this._dialogReturnFocusSelector = [
      'data-chamber-face',
      'data-font-size',
      'data-word-fill',
      'data-word-fill-border'
    ].map(attribute => {
      const value = returnFocus?.getAttribute?.(attribute);
      return value == null ? null : `[${attribute}=${JSON.stringify(value)}]`;
    }).find(Boolean) || null;
    this.render();
    queueMicrotask(() => this.container.querySelector('[data-dialog-primary]')?.focus());
  }

  closeDialog() {
    const returnFocusSelector = this._dialogReturnFocusSelector;
    this.dialog = null;
    this._dialogReturnFocusSelector = null;
    this.render();
    const returnFocus = this.container.querySelector(returnFocusSelector);
    if (!returnFocus) return;
    this._restoringDialogFocus = true;
    returnFocus.focus();
    this._restoringDialogFocus = false;
  }

  explainProgramOwnership(returnFocus) {
    this.openDialog({
      title: 'This text material is owned by the curated program.',
      body: 'The curated program controls its text material for this reading.',
      primaryLabel: 'Close',
      confirm: () => this.closeDialog()
    }, returnFocus);
  }

  /**
   * Say which of the four conditions is missing, and offer the remedy for
   * THAT one.
   *
   * One sentence used to answer every refusal — 'Visual masks require Thick +
   * Fit' — with a single corrective that set the face, the size and the
   * timing. When the missing condition was the field, that advice was simply
   * wrong: it changed three things that were not the problem, and the mask
   * still could not be carried. A remedy that does not address the cause is
   * worse than no remedy, because it spends the reader's trust.
   */
  /**
   * Fit needs a Gallery; this field is not one. Say what will be lost, name
   * it, and let the reader decide — rather than discarding it and moving on.
   */
  confirmFieldReplacement({ fontSize, settings, returnFocus }) {
    const held = [...this.selection.enabled]
      .map(id => leafById(id)?.label)
      .filter(Boolean);
    this.openDialog({
      title: 'Fit paints through a Gallery.',
      body: `${held.length ? held.join(' and ') : 'This field'} cannot be painted through the letters, `
        + 'and will be set aside to make room for one. The reading keeps everything else.',
      primaryLabel: 'Set it aside',
      primaryAction: 'replace-field-for-fit',
      confirm: () => {
        this.selection.enabled = new Set();
        this.selection.emptyGallery = true;
        this.selection.preserveBaseSelection = false;
        this.requestTextMaterialTransaction({
          face: settings.face,
          fontSize,
          wordFill: this.selection.wordFill,
          temporal: { chunkMode: 'word', recitation: false },
          settings: { chamberFace: settings.face, fontSize, chamberMask: false }
        });
        this.closeDialog();
      }
    }, returnFocus);
  }

  explainBlockedMask(wordFill, returnFocus) {
    // NAME EVERYTHING THAT IS MISSING, BECAUSE THE REMEDY FIXES ALL OF IT.
    //
    // One sentence used to answer every refusal — 'Visual masks require Thick
    // + Fit' — while the corrective quietly also opened a Gallery. So the
    // message undersold what the button did, and when the field was the only
    // thing missing it named two things that were not the problem. The
    // resolver reports the first failing condition; the reader needs all of
    // them, since they are about to be set in one stroke.
    const settings = this.textMaterialSettings();
    const needsField = !this._fieldIsGallery();
    const missing = [];
    if (needsField) missing.push('a Gallery field');
    if (resolveChamberStreamFace(settings.face) !== 'thick') missing.push('the Thick face');
    if (resolveFontSize(settings.fontSize) !== 'fit') missing.push('the Fit size');
    // Only a field that CANNOT hold imagery is named as being set aside. A
    // Gallery already behind the reading is kept: it is the thing the mask is
    // about to be painted from, and discarding it to "fix" a face would throw
    // away the works the reader chose.
    const displaced = needsField
      ? [...this.selection.enabled].map(id => leafById(id)?.label).filter(Boolean)
      : [];
    const list = missing.length > 1
      ? `${missing.slice(0, -1).join(', ')} and ${missing[missing.length - 1]}`
      : (missing[0] || 'more surface');

    this.openDialog({
      title: `A mask needs ${list}.`,
      body: displaced.length
        ? `${displaced.join(' and ')} holds no imagery behind the reading, so it will be set aside `
          + 'for a Gallery. Bold, chamber-filling words provide the surface the imagery is painted on.'
        : 'Bold, chamber-filling words provide the surface, and a Gallery is what is painted through them.',
      primaryLabel: missing.length > 1 ? 'Set them' : 'Set it',
      primaryAction: 'use-thick-fit',
      confirm: () => {
        if (needsField) {
          // The field is the problem: clear it and open an empty Gallery.
          this.selection.enabled = new Set();
          this.selection.preserveBaseSelection = false;
        } else {
          // The field is already a Gallery — keep the works that are in it.
          this.selection.preserveBaseSelection = true;
        }
        // Ignored by fieldPatch whenever leaves are enabled; it only speaks
        // for the empty case.
        this.selection.emptyGallery = true;
        this.requestTextMaterialTransaction({
          face: 'thick',
          fontSize: 'fit',
          wordFill,
          temporal: { chunkMode: 'word', recitation: false }
        });
        this.closeDialog();
      }
    }, returnFocus);
  }

  confirmMaskInvalidation({ face, fontSize, returnFocus }) {
    this.openDialog({
      title: 'This change cannot keep the current visual mask. Continue with Accent ink?',
      body: '',
      primaryLabel: 'Continue with Accent',
      primaryAction: 'dialog-confirm',
      confirm: () => {
        this.requestTextMaterialTransaction({
          face,
          fontSize,
          wordFill: { mode: 'accent' }
        });
        this.closeDialog();
      }
    }, returnFocus);
  }

  setFace(value, returnFocus) {
    if (resolveChamberStreamFace(value) !== value) return;
    if (this.programInfo) return this.explainProgramOwnership(returnFocus);
    const settings = this.textMaterialSettings();
    if (this.hasActiveMask() && value !== settings.face) {
      return this.confirmMaskInvalidation({ face: value, fontSize: settings.fontSize, returnFocus });
    }
    this.writeSetting('chamberFace', value);
    this.render();
  }

  setSize(value, returnFocus) {
    const persist = persistFontSize(value);
    if (!persist) return;
    if (this.programInfo) return this.explainProgramOwnership(returnFocus);
    const settings = this.textMaterialSettings();
    if (this.hasActiveMask() && persist !== settings.fontSize) {
      return this.confirmMaskInvalidation({ face: settings.face, fontSize: persist, returnFocus });
    }
    if (persist === 'fit' && this.locked) return;
    if (persist === 'fit') {
      const gallery = this._fieldIsGallery();
      // FIT USED TO TAKE THE FIELD WITHOUT ASKING. Choosing Fit while a Focal
      // was held cleared `enabled` outright — the Chapel rose a reader had
      // chosen simply vanished, replaced by an empty Gallery, with no dialog
      // and no way to know it had happened. Fit does need a Gallery, so the
      // conflict is real; what was missing was the asking. This panel already
      // knows how to ask — confirmMaskInvalidation does it in the other
      // direction — so the same courtesy applies here.
      if (!gallery && this.selection.enabled.size > 0) {
        return this.confirmFieldReplacement({ fontSize: persist, settings, returnFocus });
      }
      if (!gallery) this.selection.enabled = new Set();
      this.selection.emptyGallery = !gallery;
      if (!gallery) this.selection.preserveBaseSelection = false;
      this.requestTextMaterialTransaction({
        face: settings.face,
        fontSize: persist,
        wordFill: this.selection.wordFill,
        temporal: { chunkMode: 'word', recitation: false },
        settings: { chamberFace: settings.face, fontSize: persist, chamberMask: false }
      });
    } else {
      this.writeSetting('fontSize', persist);
    }
    this.render();
  }

  /**
   * The word itself is holding the frame.
   *
   * Fit scales one word to fill the chamber, which is what gives the border
   * something to edge and what leaves glass nothing to sit behind. Three
   * places asked this and all three used to ask about the imagery mask
   * instead — one of the several ways a reader reaches Fit, not the condition.
   */
  fitHoldsTheWord() {
    return resolveFontSize(this.textMaterialSettings().fontSize) === 'fit';
  }

  setWordFill(value, returnFocus) {
    if (this.locked) return;
    if (this.programInfo) return this.explainProgramOwnership(returnFocus);
    const settings = this.textMaterialSettings();
    let wordFill = null;
    // The edge survives the ink: it is the Fit word's, not the fill's.
    const keptBorder = normalizeWordFill(this.selection.wordFill).border || 'cream';
    if (value === 'accent') {
      wordFill = wordFillValue(this.selection.wordFill) === 'accent'
        ? { mode: 'plain', border: keptBorder }
        : { mode: 'accent', border: keptBorder };
      this.inkFocus = null;
    } else if (value === 'same') {
      wordFill = { mode: 'same', border: keptBorder };
      this.inkFocus = null;
    } else if (value.startsWith('procedural:')) {
      const engineId = value.slice('procedural:'.length);
      wordFill = {
        mode: 'pick', sourceFamily: 'procedural', procedural: [engineId], sourced: [],
        border: keptBorder
      };
      this.inkFocus = engineId;
    } else if (value.startsWith('sourced:')) {
      const sourceId = value.slice('sourced:'.length);
      wordFill = {
        mode: 'pick', sourceFamily: 'collections', procedural: [], sourced: [sourceId],
        border: keptBorder
      };
      this.inkFocus = null;
    } else return;

    if (wordFill.mode === 'accent' || wordFill.mode === 'plain') {
      this.requestTextMaterialTransaction({ ...settings, wordFill });
    } else if (!this.textMaterialCapability(wordFill, settings).available) {
      this.explainBlockedMask(wordFill, returnFocus);
      return;
    } else {
      this.selection.wordFill = normalizeWordFill(wordFill);
      this.emit();
    }
    this.render();
  }

  setWordFillBorder(border, returnFocus) {
    if (this.programInfo) return this.explainProgramOwnership(returnFocus);
    if (!this.fitHoldsTheWord() || !['off', 'cream', 'accent'].includes(border)) return;
    this.selection.wordFill = normalizeWordFill({ ...this.selection.wordFill, border });
    this.emit();
    this.render();
  }

  /**
   * Open or close the Ink pane's third answer. State only: browsing what is
   * on offer is not choosing it, so this never touches the selection and
   * never emits.
   */
  toggleInkBranch() {
    this._inkBranchOpen = this._inkBranchOpen === false;
    this.render();
  }

  setLivingText(enabled) {
    if (this.locked || this.programInfo) return;
    this.selection.livingText = {
      ...this.selection.livingText,
      enabled: enabled === true
    };
    this.emit();
  }

  setCadence(value) {
    if (this.locked || this.programInfo) return;
    this.selection.galleryCadence = normalizeGalleryCadence(value);
    this.emit();
    this.render();
  }

  getConfig() { return this.patch(); }

  setConfig(visualConfig = {}) {
    this.selection = selectionFromConfig(visualConfig);
    this.selection.programLocked = Boolean(this.programInfo);
    if (readingCollections(visualConfig).some(isChapelCollection)) this._chapelLaunch = true;
    this.inkFocus = inkFocusFrom(this.selection.wordFill);
    const first = [...this.selection.enabled][0];
    if (first) this.openLeafById(first);
    else { this.path = []; this.focus = null; }
    this.render();
  }

  setProgramInfo(info) {
    this.programInfo = info && typeof info === 'object' ? info : null;
    this.selection.programLocked = Boolean(this.programInfo);
    this.render();
  }

  setLocked(locked) {
    this.locked = locked === true;
    if (this.locked) {
      this.selection.enabled = new Set();
      this.selection.emptyGallery = false;
      this.emit();
    }
    this.render();
  }

  clearLaunchVisualIdentity() {
    const config = this.patch();
    const released = releaseLaunchHeldFocal(config.focals);
    this.programInfo = null;
    this._chapelLaunch = false;
    this._chapelTrayOpen = false;
    this.setConfig({
      ...config,
      focals: released || config.focals,
      interlocution: clearLaunchVisualSelection(config.interlocution)
    });
  }

  /* ── render ───────────────────────────────────────────────────────── */
  /**
   * A stable identity for a control, so the same one can be found again in a
   * DOM that has just been rebuilt underneath it.
   */
  _controlKey(el) {
    if (!el || el === this.container || !this.container.contains(el)) return null;
    for (const attr of ['data-word-fill', 'data-word-fill-border', 'data-font-size',
      'data-chamber-face', 'data-gallery-cadence', 'data-action', 'data-id',
      'data-pool', 'data-sub', 'data-glyph', 'data-focal-type']) {
      const value = el.getAttribute?.(attr);
      if (value !== null && value !== undefined) {
        return `[${attr}="${String(value).replace(/"/g, '\\"')}"]`;
      }
    }
    return null;
  }

  render() {
    if (this._destroyed) return;

    // EVERY CHOICE REBUILT THE WHOLE PANEL, AND THE PANEL FORGOT ITSELF.
    //
    // render() replaces the container's innerHTML to change what is usually
    // one class on one chip. Two things did not survive that and neither was
    // restored: the scroll offset of the option area — so choosing a pool
    // near the bottom snapped the pane to the top and carried the new
    // selection out of sight — and focus, which fell to the document body
    // because the clicked button no longer existed. A keyboard reader was
    // ejected from the panel on every single choice and had to tab back in.
    //
    // The interruption path already did this properly: opening a dialog
    // records a selector for what opened it and closing puts focus back. The
    // rare case was preserved and the ordinary one discarded; this gives the
    // ordinary one the same care.
    const focusKey = this._restoringDialogFocus
      ? null
      : this._controlKey(this.container.ownerDocument?.activeElement);
    const scrolls = [...this.container.querySelectorAll('.vnav-entry, .vnav-col, .vnav-body')]
      .map((el, i) => [i, el.scrollTop])
      .filter(([, top]) => top > 0);

    const cols = this.columns();
    this.container.innerHTML = `
      <div class="vnav">
        <div class="vnav-bar">
          ${this.path.length ? '<button type="button" class="vnav-back" data-action="navigator-back">‹ Back</button>' : ''}
          <span class="vnav-path">${this.pathBar()}</span>
          <span class="vnav-field">${escapeHtml(describeField(this.selection.enabled))}</span>
        </div>
        ${this.programInfo ? this.renderProgramLock() : ''}
        ${this.renderReadingCollections()}
        ${this.locked ? `<div class="vnav-lock" role="status">${escapeHtml(this.lockedMessage)}</div>` : ''}
        <div class="vnav-body" style="--vnav-cols:${cols.length}">
          ${cols.map((nodes, i) => this.renderColumn(nodes, i, i === cols.length - 1)).join('')}
          <div class="vnav-entry">${this.renderEntry()}</div>
        </div>
        ${this.renderReaderControls()}
        ${this.renderDialog()}
      </div>`;
    this.attach();

    if (scrolls.length) {
      const panes = [...this.container.querySelectorAll('.vnav-entry, .vnav-col, .vnav-body')];
      for (const [i, top] of scrolls) if (panes[i]) panes[i].scrollTop = top;
    }
    this._revealNamedSection();
    void this._mountLeafPreview();
    void this._mountSpecimenInk();
    if (focusKey) {
      const again = this.container.querySelector(focusKey);
      // Only take focus back if it is still ours to take — a dialog that
      // opened during this render owns it now.
      if (again && !this.dialog && typeof again.focus === 'function') {
        again.focus({ preventScroll: true });
      }
    }
  }

  /**
   * SHOW THE LEAF, DO NOT NAME IT.
   *
   * The entry has always reserved a preview slot and filled it with a glyph
   * and the words 'live preview mounts here'. A reader choosing between Klee
   * Lines, Turrell Fields and Fractal Flames is choosing between three
   * pictures, and three captions cannot tell them apart.
   *
   * The cortex is a 256KB chunk and this panel is 102KB, so it is imported
   * ONLY when a reader actually opens a leaf — a preview must not be paid for
   * by everyone who opens the Orbital. Generation-guarded, because the import
   * and the render both take time a reader can navigate through, and silent
   * on failure: an engine that will not draw leaves the glyph exactly where
   * it was.
   */
  async _mountLeafPreview() {
    const leaf = this.focus;
    const slot = this.container.querySelector('.vnav-preview');

    // WHAT IS BEING PREVIEWED, NOT HOW MANY TIMES THE PANEL HAS REDRAWN.
    //
    // render() replaces the whole panel on every selection, so this runs
    // again after changes that have nothing to do with the picture. Keyed on
    // the render, it aborted a fetch in flight and started it over each time
    // — measured at two requests for one leaf, the first killed by an
    // unrelated toggle. On a slow connection a reader adjusting anything
    // could keep a sourced preview from ever arriving.
    //
    // Keyed on the subject instead, an unrelated redraw is simply not news:
    // the request in flight is for the same thing it was for, and is left
    // alone to finish. Only a change of subject cancels.
    const key = leaf?.engineId
      ? this._engineStillKey(leaf.engineId)
      : (leaf?.pool ? this.selection.pool?.[leaf.id] : null);

    if (!key || !slot) {
      this._cancelPreview();
      return;
    }

    const cached = this._previewCache?.get(key);
    if (cached) {
      this._previewKey = key;
      this._paintLeafPreview(slot, cached, key);
      return;
    }

    // Already fetching this very thing: the rebuilt slot will be painted by
    // the request that is already running.
    if (this._previewKey === key && this._previewAbort) return;

    this._cancelPreview();
    this._previewKey = key;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    this._previewAbort = controller;

    try {
      const { visualCortex } = await import('../visuals/visual-cortex.js');
      if (this._previewKey !== key) return;

      const url = leaf.engineId
        ? (await visualCortex.renderLeafStill(leaf.engineId))?.url
        : await this._sourcedStill(visualCortex, key, controller?.signal);


      if (this._previewKey !== key || !url) return;
      (this._previewCache ||= new Map()).set(key, url);
      // The panel may have been rebuilt while this was in flight, so paint
      // into whatever slot is live now rather than the one we started with.
      this._paintLeafPreview(this.container.querySelector('.vnav-preview'), url, key);
    } catch {
      /* the glyph stays; a preview is never worth an interruption */
    } finally {
      if (this._previewAbort === controller) this._previewAbort = null;
    }
  }

  /**
   * Draw the chosen ink so the specimen can wear it.
   *
   * Keyed on the ink rather than the redraw, for the reason the leaf preview
   * is: the panel rebuilds constantly and an unrelated change must not throw
   * away a fetch that is already running for the very same ink.
   *
   * Only fetched when the mask could actually be carried. A specimen wearing
   * imagery the reading cannot wear would be a lie told in the one place a
   * reader is entitled to trust.
   */
  async _mountSpecimenInk() {
    const value = wordFillValue(this.selection.wordFill);
    const isEngine = value.startsWith('procedural:');
    const key = isEngine
      ? value.slice('procedural:'.length)
      : (value.startsWith('sourced:') ? value.slice('sourced:'.length) : null);

    if (!key || !this.hasActiveMask()) {
      this._cancelInk();
      return;
    }
    if (this._previewCache?.has(key)) {
      this._inkKey = key;
      this._paintSpecimen(key);
      return;
    }
    if (this._inkKey === key && this._inkAbort) return;

    this._cancelInk();
    this._inkKey = key;
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    this._inkAbort = controller;
    try {
      const { visualCortex } = await import('../visuals/visual-cortex.js');
      if (this._inkKey !== key) return;
      const url = isEngine
        ? (await visualCortex.renderLeafStill(key))?.url
        : await this._sourcedStill(visualCortex, key, controller?.signal);
      if (this._inkKey !== key || !url) return;
      (this._previewCache ||= new Map()).set(key, url);
      this._paintSpecimen(key);
    } catch {
      /* the plain word stays, which is honest */
    } finally {
      if (this._inkAbort === controller) this._inkAbort = null;
    }
  }

  _paintSpecimen(key) {
    const figure = this.container.querySelector('.vnav-specimen');
    if (!figure || this._inkKey !== key) return;
    const safe = safeUrl(this._previewCache?.get(key) || '');
    if (!safe) return;
    figure.classList.add('has-ink');
    figure.style.setProperty('--specimen-ink', `url('${safe}')`);
  }

  _cancelInk() {
    this._inkAbort?.abort();
    this._inkAbort = null;
    this._inkKey = null;
  }

  /** Stop work for a subject nobody is looking at any more. */
  _cancelPreview() {
    this._previewAbort?.abort();
    this._previewAbort = null;
    this._previewKey = null;
  }

  /**
   * One work from a collection, for a shelf to show what is on it.
   *
   * Network-bound, so it takes the abort signal and asks for exactly one:
   * a preview has no use for a pool and a reader who moves on should not
   * still be paying for twelve. A collection that will not resolve — a
   * provider down, a reader offline — yields nothing and the glyph remains,
   * which is the same reverent degradation the Gallery makes.
   */
  async _sourcedStill(visualCortex, collectionId, signal) {
    const works = await visualCortex.resolveCollectionWorks(collectionId, { limit: 1, signal });
    const work = Array.isArray(works) ? works[0] : null;
    return work?.data?.url || work?.url || null;
  }

  /**
   * WHAT IS BEING PREVIEWED INCLUDES WHICH ONE OF IT.
   *
   * The preview was cached under the engine's id alone, so an engine's
   * substyles all shared one picture: choosing Architectural, then Chaotic,
   * then Gravitational returned whichever had been drawn first, and Genesis
   * appeared not to respond to its own presets. The substyle benches are the
   * things that change the picture, so they are the things in the key. Glass
   * is deliberately not among them — it is not a substyle and does not change
   * what the engine draws.
   */
  _engineStillKey(engineId) {
    const style = this.styleOf(engineId);
    const parts = substylesFor(engineId)
      .map(b => `${b.key}=${style[b.key] ?? ''}`)
      .join('&');
    return parts ? `${engineId}?${parts}` : engineId;
  }

  _paintLeafPreview(slot, url, key) {
    if (!slot || !slot.isConnected || this._previewKey !== key) return;
    const safe = safeUrl(url);
    if (!safe) return;
    slot.classList.add('has-still');
    slot.style.backgroundImage = `url("${safe}")`;
    // The glyph and the caption were both placeholders for a picture. Once
    // the picture is here they are not a label on it, they are litter on it.
    for (const sel of ['.vnav-preview-note', '.vnav-preview-glyph']) {
      slot.querySelector(sel)?.remove();
    }
  }

  pathBar() {
    const names = this.path.map(n => `<span>${escapeHtml(n.label.toLowerCase())}</span>`);
    if (this.focus) names.push(`<span class="here">${escapeHtml(this.focus.label.toLowerCase())}</span>`);
    return names.length ? names.join('<i>/</i>') : '<span>field</span>';
  }

  renderColumn(nodes, colIndex, current = false) {
    const row = n => {
      const selected = this.path[colIndex] === n || this.focus === n;
      const on = categoryOf(n.id) && this.selection.enabled.has(n.id);
      return `
        <button type="button" class="vnav-node ${selected ? 'sel' : ''} ${on ? 'on' : ''}"
          data-col="${colIndex}" data-id="${escapeHtml(n.id)}">
          <span class="g">${glyphFor(n)}</span>
          <span class="nm">${escapeHtml(n.label)}</span>
          ${on ? '<span class="dot" aria-label="in the room"></span>' : ''}
          ${n.children ? '<span class="arw">›</span>' : ''}
        </button>`;
    };
    const rows = colIndex === 0
      ? `<span class="vnav-group" data-group="field">Field</span>
         ${ROOT.map(row).join('')}
         <span class="vnav-group" data-group="text">Text</span>
         ${TEXT.map(row).join('')}`
      : nodes.map(row).join('');
    return `<div class="vnav-col ${current ? 'vnav-current' : ''}">${rows}</div>`;
  }

  renderEntry() {
    const leaf = this.focus;
    if (leaf?.textControl) return this.renderTextEntry(leaf.id);
    if (!leaf || !categoryOf(leaf.id)) {
      return `<div class="vnav-empty"><span>◈</span>Choose a field to open its entry</div>`;
    }
    const cat = categoryOf(leaf.id);
    const enabled = this.selection.enabled.has(leaf.id);
    const blend = cat === FIELD.GALLERY && enabled && isBlend(this.selection.enabled);
    const kind = cat === FIELD.DYNAMIC ? 'Dynamic · drawn in time'
      : cat === FIELD.GALLERY ? 'Gallery · held presence'
      : cat === FIELD.FOCAL ? 'Gallery · a single point' : 'Field';

    const commit = `
      <div class="vnav-commit">
        <button type="button" class="vnav-toggle ${enabled ? 'on' : ''}" data-action="toggle"
          role="switch" aria-checked="${enabled}" ${this.locked || this.programInfo ? 'disabled' : ''}>
          <span class="knob"></span>
        </button>
        <span class="vnav-commit-label">${
          blend ? `In the blend · ${galleryMembers(this.selection.enabled).length} in gallery`
          : this.programInfo ? 'Owned by the curated program'
          : enabled ? 'In the room' : 'Bring into the room'
        }</span>
      </div>`;

    return `
      <div class="vnav-entry-head">
        <span class="vnav-glyph">${glyphFor(leaf)}</span>
        <div>
          <h3>${escapeHtml(leaf.label)}</h3>
          <p class="vnav-kind">${kind}${blend ? ' · <b>Blend</b>' : ''}</p>
        </div>
      </div>
      <div class="vnav-preview" aria-hidden="true">
        <span class="vnav-preview-glyph">${glyphFor(leaf)}</span>
        <span class="vnav-preview-note">live preview mounts here</span>
      </div>
      ${leaf.desc ? `<p class="vnav-desc">${escapeHtml(leaf.desc)}</p>` : ''}
      ${leaf.id === 'focal' ? this.renderHeldFocal() : ''}
      ${this.renderBenches(leaf)}
      ${commit}`;
  }

  /**
   * ONE SURFACE FOR ONE OBJECT.
   *
   * Face, Size and Ink were three rooms, and a reader could never see the
   * thing they were configuring — because the thing is a word, and a word is
   * all three at once. Worse, the dependency between them had to be
   * EXPLAINED: Ink needs the Thick face and the Fit size, and cause and
   * effect lived in different rooms, so the panel could only assert the
   * coupling in prose beneath itself.
   *
   * Here the specimen is the subject and the controls stand around it. The
   * coupling stops being a sentence and becomes a thing you watch happen:
   * take the Thick face away and the imagery leaves the letters, in the same
   * view, without a word being written about it.
   *
   * The rail keeps its three doors. They are not three rooms any more, they
   * are three ways into one, and each marks the group it opened on.
   */
  renderTextEntry(id) {
    const active = ['face', 'size', 'ink'].includes(id) ? id : 'face';
    return `<div class="vnav-entry-head"><span class="vnav-glyph">${glyphFor({ id: 'ink' })}</span>
      <div><h3>Type</h3><p class="vnav-kind">Text</p></div></div>
      ${this._renderSpecimen()}
      <div class="vnav-type-sections" data-active-section="${escapeHtml(active)}">
        ${this._faceSection(active === 'face')}
        ${this._sizeSection(active === 'size')}
        ${this._inkSection(active === 'ink')}
      </div>`;
  }

  _faceSection(isActive) {
    {
      const selected = this.textMaterialSettings().face;
      // A FACE IS A SHAPE, AND A SHAPE SHOULD BE SHOWN. Four words set in one
      // another's typeface told a reader nothing about the choice they were
      // making; the difference between these four IS the letterform. Each
      // chip now wears its own face and a sample line carries the chosen one
      // at reading scale. The family is never named — that is a CSS matter,
      // and Chamber.settings-door.test.js forbids leaking it into the chrome.
      return this._section('Face', 'The letters, not the room.', isActive,
        `<div class="vnav-control-group">${bench('Face',
          CHAMBER_STREAM_FACES.map(item => ({
            id: item.id, label: item.id === 'thick' ? `${item.label} ★` : item.label,
            on: item.id === selected,
            readOnly: Boolean(this.programInfo), special: item.id === 'thick',
            attr: `data-chamber-face="${escapeHtml(item.id)}" data-face-sample="${escapeHtml(item.id)}"`
              + `${item.id === 'thick' ? ' aria-describedby="vnav-thick-explanation"' : ''}`
          })), 'vnav-face-grid')}
        </div>
        <p id="vnav-thick-explanation" class="vnav-control-explanation">Thick
          is the mask-ready face — the other three cannot carry a Visual mask.</p>`);
    }
  }

  _sizeSection(isActive) {
    {
      const selected = this.textMaterialSettings().fontSize;
      // A SCALE AND A MODE ARE NOT FOUR SIZES. S, M and L are three points on
      // one continuum; Fit is a different reading — it scales each word to
      // fill the chamber, steps one word at a time, and stands recitation and
      // phrase chunking aside. Offered as a fourth chip it invited the casual,
      // reversible try that a larger size deserves and it does not. Its cost
      // is also stated here rather than after the fact: the pane used to read
      // 'Choose the scale of the reading' until Fit was chosen, and only then
      // explain what Fit had already done.
      const chips = FONT_SIZE_CHIPS.filter(item => item.fontSize !== 'fit');
      const fit = FONT_SIZE_CHIPS.find(item => item.fontSize === 'fit');
      const scale = bench('Scale', chips.map(item => ({
        id: item.id, label: item.label, on: item.fontSize === selected,
        readOnly: Boolean(this.programInfo),
        attr: `data-font-size="${escapeHtml(item.id)}"`
      })));
      const mode = fit ? bench('Or read one word at a time', [{
        id: fit.id, label: 'Fit', on: selected === 'fit',
        readOnly: Boolean(this.programInfo), special: true,
        attr: `data-font-size="${escapeHtml(fit.id)}" aria-describedby="vnav-fit-consequence"`
      }], 'vnav-mode-bench') : '';
      // Controls and prose were sharing one undivided field, so a sentence
      // about Fit sat at the same rank as the buttons that set it. The
      // controls take a surface; the explanation stands outside it.
      // A SCALE SHOULD BE SEEN AS A SCALE. S, M and L differ by ratios the
      // Chamber actually uses — 0.82, 1, 1.18 — and were shown as three
      // identical letters. The sample carries the real ratio, read from the
      // same function the reading reads, so the preview cannot drift from it.
      //
      // Fit is not a fourth ratio. It fills the chamber with ONE word, so the
      // sample shows one word where the scale shows a phrase: the preview
      // teaches the difference the row could only assert.
      const isFit = resolveFontSize(selected) === 'fit';
      // THE BORDER IS A PROPERTY OF THE FIT WORD, SO IT LIVES WHERE FIT IS
      // CHOSEN. It sat at the foot of Ink, under the generated fields and the
      // museum pools, as though it were an attribute of the imagery. It is
      // not: Chamber.applyChamberMask is the only reader of it, and the only
      // thing it sets is --fit-border-color on the masked word.
      //
      // And the panel had the surface for it already. A control group holding
      // three small chips and a Fit chip left most of its width empty while
      // the sentence explaining Fit's cost stood outside, beneath it. The
      // explanation moves in beside the control it explains, which fills the
      // space and puts the consequence next to the button that causes it.
      return this._section('Size', selected === 'fit' ? SIZE_HINT_FIT : 'Choose the scale of the reading.', isActive,
        `<div class="vnav-control-group vnav-size-group">
          <div class="vnav-size-controls">${scale}${mode}${this._borderBench()}</div>
          <div class="vnav-size-note">
            <span class="vnav-bench-label">${isFit ? 'What Fit does' : 'What Fit would do'}</span>
            <p id="vnav-fit-consequence" class="vnav-fit-consequence">Fit scales each
              Word to fill the chamber and paints the gallery through the letters. Words step one at a
              time; Recitation and phrase chunking stand aside.</p>
          </div>
        </div>`);
    }
  }

  /**
   * The edge of the Fit word.
   *
   * Shown wherever it can act, which is wherever the word is a Fit word. It
   * used to be gated on the imagery mask, so Fit + Accent offered no border
   * at all — yet a word filling the chamber needs an edge to read against the
   * field whether the letters carry a Rembrandt or a flat accent. The Chamber
   * owns it on the same path that decides the Fit word, so the two agree.
   */
  _borderBench() {
    if (!this.fitHoldsTheWord()) return '';
    const border = normalizeWordFill(this.selection.wordFill).border;
    const shared = { disabled: Boolean(this.locked), readOnly: Boolean(this.programInfo) };
    return bench('Border of the word', [
      { id: 'off', label: 'Off', on: border === 'off', ...shared, attr: 'data-word-fill-border="off"' },
      { id: 'cream', label: 'Cream', on: border === 'cream', ...shared, attr: 'data-word-fill-border="cream"' },
      { id: 'accent', label: 'Accent', on: border === 'accent', ...shared, attr: 'data-word-fill-border="accent"' }
    ], 'is-property vnav-border-bench');
  }

  _inkSection(isActive) {
    const value = wordFillValue(this.selection.wordFill);
    const settings = this.textMaterialSettings();
    const fieldLocked = Boolean(this.locked);
    const programLocked = Boolean(this.programInfo);
    const capability = this.textMaterialCapability({ mode: 'same' }, settings);
    const maskAvailable = capability.available;
    // Four causes, four sentences. The panel used to answer every one of them
    // with 'requires Thick + Fit', which is false whenever the cause is the
    // field: a reader holding a Focal was told to change a face and a size
    // that would not have helped.
    const maskReason = maskAvailable ? null : MASK_REASON[capability.reason];
    const engines = WORD_FILL_PROCEDURAL_PATTERNS.map(item => ({
      id: item.id, label: item.name, on: value === `procedural:${item.id}`,
      disabled: fieldLocked,
      readOnly: programLocked,
      blocked: !maskAvailable && !programLocked,
      reason: !maskAvailable && !programLocked ? maskReason : null,
      attr: `data-word-fill="procedural:${escapeHtml(item.id)}"`
    }));
    const poolBenches = inkPoolFamilies().map(family => bench(family.label,
      family.options.map(item => ({
        id: item.id, label: item.label, on: value === `sourced:${item.id}`,
        disabled: fieldLocked,
        readOnly: programLocked,
        blocked: !maskAvailable && !programLocked,
        reason: !maskAvailable && !programLocked ? maskReason : null,
        attr: `data-word-fill="sourced:${escapeHtml(item.id)}"`
      }))
    )).join('');
    const styles = this.inkFocus ? this.renderStyleBenches(this.inkFocus) : '';

    // ONE QUESTION, NOT THREE HEADINGS.
    //
    // Ink, Engines and Pools were drawn as three groups and were one: every
    // chip in all of them writes `data-word-fill`, and wordFillValue collapses
    // them to a single value. So Accent, Same as the Field, Klee Lines and Old
    // Masters were mutually exclusive answers to one question laid out as
    // twenty peers, and nothing said that choosing Landscapes silently
    // un-chose Same as the Field. The captions implied accumulation where the
    // mechanism is replacement.
    //
    // The third answer is a DISCLOSURE, not a value. Opening it must not
    // change the reading — a reader browsing what is available has not yet
    // chosen anything — so it carries `data-ink-branch`, never
    // `data-word-fill`.
    //
    // It stands OPEN by default. The fault here was never that too much was
    // on screen; it was that what was on screen claimed a rank it did not
    // hold. Nesting fixes the rank. Hiding would have bought compactness by
    // spending discoverability, and every engine and pool that was reachable
    // before is still reachable at a glance.
    const chosenOwn = value.startsWith('procedural:') || value.startsWith('sourced:');
    const ownOpen = chosenOwn || this._inkBranchOpen !== false;
    const answers = bench('What paints the letters', [
      { id: 'accent', label: 'Accent', on: value === 'accent', disabled: fieldLocked, readOnly: programLocked, attr: 'data-word-fill="accent"' },
      { id: 'same', label: 'Same as the Field', on: value === 'same', disabled: fieldLocked, readOnly: programLocked, blocked: !maskAvailable && !programLocked, reason: !maskAvailable && !programLocked ? maskReason : null, attr: 'data-word-fill="same"' },
      {
        id: 'own', label: `Something of its own ${ownOpen ? '▾' : '▸'}`, on: chosenOwn,
        disabled: fieldLocked,
        attr: `data-ink-branch="own" aria-expanded="${ownOpen}" aria-controls="vnav-ink-own"`
      }
    ], 'vnav-ink-answers');

    return this._section('Ink', 'Paint the gallery through the letters.', isActive, `
      ${answers}
      ${ownOpen ? `<div class="vnav-ink-own" id="vnav-ink-own">
        <span class="vnav-ink-own-caption">Something of its own</span>
        ${bench('A generated field', engines)}
        ${poolBenches}
      </div>` : ''}
      ${styles}`);
  }

  renderDialog() {
    if (!this.dialog) return '';
    return `<div class="vnav-dialog-backdrop"><section class="vnav-dialog" role="dialog" aria-modal="true"
      aria-labelledby="vnav-dialog-title" tabindex="-1">
      <h3 id="vnav-dialog-title">${escapeHtml(this.dialog.title)}</h3>
      ${this.dialog.body ? `<p>${escapeHtml(this.dialog.body)}</p>` : ''}
      <div class="vnav-dialog-actions">
        <button type="button" data-action="dialog-cancel">Cancel</button>
        <button type="button" class="is-special" data-dialog-primary data-action="${escapeHtml(this.dialog.primaryAction || 'dialog-primary')}">${escapeHtml(this.dialog.primaryLabel)}</button>
      </div>
    </section></div>`;
  }

  /** One group of the type editor. The door a reader came through is marked. */
  _section(title, desc, isActive, body) {
    return `<section class="vnav-type-section${isActive ? ' is-active' : ''}"
      data-section="${escapeHtml(title.toLowerCase())}">
      <h4 class="vnav-section-title">${escapeHtml(title)}</h4>
      <p class="vnav-desc">${escapeHtml(desc)}</p>${body}
    </section>`;
  }

  /**
   * THE WORD, AS IT WILL ACTUALLY APPEAR.
   *
   * Face, scale and ink on one object, because that is what they are: three
   * attributes of a single word. The ink is painted THROUGH the letterforms —
   * which is the whole promise of Fit — but only when the mask could really
   * be carried. An imagined imagery-through-letters on a face that cannot
   * hold one would be a lie told in the reader's own specimen, and the plain
   * word is itself the answer to why Thick and Fit matter.
   */
  _renderSpecimen() {
    const { face, fontSize } = this.textMaterialSettings();
    const size = resolveFontSize(fontSize);
    const isFit = size === 'fit';
    const masked = this.hasActiveMask();
    const ink = masked ? this._specimenInkUrl() : null;
    // THE SPECIMEN WEARS EVERY ANSWER, NOT ONLY THE PICTURESQUE ONE.
    //
    // It carried imagery through the letters and nothing else, so a reader
    // choosing Accent saw the sample unchanged and a reader setting a border
    // saw no edge — two of the three things this pane decides were invisible
    // in the one place built to show them. The accent is a fill like any
    // other, and the border is drawn the way the Chamber draws it, on the one
    // condition under which the Chamber draws it at all.
    const fill = wordFillValue(this.selection.wordFill);
    const border = isFit ? normalizeWordFill(this.selection.wordFill).border : 'off';
    const edge = border === 'cream' ? 'var(--color-light)'
      : border === 'accent' ? 'var(--color-accent)' : null;
    const label = isFit
      ? 'One Word, filling the chamber'
      : 'The reading, as it will appear';
    const style = [
      `--preview-intent:${threeStepIntent(fontSize)}`,
      ink ? `--specimen-ink:url('${ink}')` : '',
      edge ? `--specimen-edge:${edge}` : ''
    ].filter(Boolean).join(';');
    return `<figure class="vnav-preview-type vnav-specimen${ink ? ' has-ink' : ''}"
      data-face-sample="${escapeHtml(face)}"
      data-size-sample="${escapeHtml(size)}"
      ${fill === 'accent' ? 'data-ink-sample="accent"' : ''}
      ${edge ? 'data-edge-sample="on"' : ''}
      style="${style}">
      <span class="vnav-preview-label">${escapeHtml(label)}</span>
      <p class="vnav-preview-sample">${isFit ? 'Light' : 'Light enters form'}</p>
    </figure>`;
  }

  /** The chosen ink's still, if one has been drawn for it. */
  _specimenInkUrl() {
    const value = wordFillValue(this.selection.wordFill);
    const key = value.startsWith('procedural:') ? value.slice('procedural:'.length)
      : value.startsWith('sourced:') ? value.slice('sourced:'.length)
        : null;
    if (!key) return null;
    const url = this._previewCache?.get(key);
    return url ? safeUrl(url) : null;
  }

  renderStyleBenches(engineId) {
    const style = this.styleOf(engineId);
    return substylesFor(engineId).map(b => bench(b.label, b.options.map(o => ({
      id: optId(o), label: optLabel(o), on: style[b.key] === optId(o), swatch: o.swatch,
      disabled: Boolean(this.locked || this.programInfo),
      attr: `data-sub="${escapeHtml(b.key)}" data-val="${escapeHtml(optId(o))}" data-engine="${escapeHtml(engineId)}"`
    })))).join('');
  }

  renderReaderControls() {
    const fieldLocked = Boolean(this.locked || this.programInfo);
    // Every glass path in the Chamber is gated on glassCanApply(), so this
    // switch cannot act while a mask carries the letters OR while a Fit word
    // fills the chamber — a frosted plate behind a word that size is the size
    // of the room, and the field would be behind it. Saying so is cheaper
    // than letting the switch look available and do nothing.
    const maskHoldsLetters = this.hasActiveMask() || this.fitHoldsTheWord();
    const galleryContext = [...this.selection.enabled].some(id => categoryOf(id) === FIELD.GALLERY)
      || categoryOf(this.focus?.id) === FIELD.GALLERY
      || this.selection.emptyGallery;
    return `<div class="vnav-reader-controls">
      <label class="vnav-living"><input type="checkbox" data-action="living-text"
        ${this.selection.livingText.enabled ? 'checked' : ''} ${fieldLocked ? 'disabled' : ''}> <span>Living Text</span></label>
      <label class="vnav-living"${maskHoldsLetters
        ? ' title="The word itself is holding the frame — a Fit word, or a Visual mask carrying the letters. Glass behind it would swallow the field. It returns at a fixed scale."'
        : ''}><input type="checkbox" data-action="glass"
        ${this.glassOn() ? 'checked' : ''}
        ${fieldLocked || maskHoldsLetters ? 'disabled' : ''}> <span>Glass behind the text</span></label>
      ${galleryContext ? `<div class="vnav-cadence"><span>Cadence</span>${CADENCE.map(item => `
        <button type="button" class="vnav-opt ${this.selection.galleryCadence === item.value ? 'on' : ''}"
          data-gallery-cadence="${item.value}" ${fieldLocked ? 'disabled' : ''}>${item.label}</button>`).join('')}</div>` : ''}
    </div>`;
  }

  renderProgramLock() {
    const episodes = Math.max(0, Number(this.programInfo?.episodes) || 0);
    return `<div class="vnav-program" data-program-lock role="status">
      <span>✦</span><span><b>Special Collection · ${episodes} episodes</b><br>
      The imagery follows this passage scene by scene. Its field is read-only.</span>
      ${this.selection.enabled.has('focal')
        ? '<button type="button" class="vnav-program-release" data-action="release-to-program">Release focal</button>'
        : ''}</div>`;
  }

  renderReadingCollections() {
    if (this.programInfo) return '';
    const curated = readingCollections(this.selection.config);
    if (!curated.length && !this._chapelLaunch) return '';
    if (!this._chapelLaunch && !curated.every(isChapelCollection)) {
      return `<div class="vnav-reading-collections" role="group" aria-label="Collections curated for this reading">
        <b>From this reading</b><div class="vnav-reading-chips">${curated.map(id =>
          `<span>${escapeHtml(readingCollectionLabel(id))}</span>`).join('')}</div></div>`;
    }

    const active = curated.filter(isChapelCollection);
    const available = Object.keys(CHAPEL_COLLECTION_LABELS).filter(id =>
      !active.includes(id)
      && !(id === 'dore:all' && active.some(item => item.startsWith('dore:'))));
    return `<div class="vnav-reading-collections vnav-chapel-collections" role="group"
      aria-label="Chapel collections for this reading">
      <b>From this reading</b><div class="vnav-reading-chips">${active.map(id => `
        <span>${escapeHtml(readingCollectionLabel(id))}<button type="button"
          data-chapel-remove="${escapeHtml(id)}" aria-label="Remove ${escapeHtml(readingCollectionLabel(id))}">×</button></span>`).join('')}
        ${available.length ? `<button type="button" class="vnav-chapel-add" data-action="chapel-add-toggle"
          aria-label="Add a Chapel collection" aria-expanded="${this._chapelTrayOpen}">+</button>` : ''}</div>
      ${available.length ? `<div class="vnav-chapel-menu" ${this._chapelTrayOpen ? '' : 'hidden'}>${available.map(id =>
        `<button type="button" data-chapel-add="${escapeHtml(id)}">+ ${escapeHtml(readingCollectionLabel(id))}</button>`).join('')}</div>` : ''}
      <p>Sacred collections for this reading. Remove one or draw another in.</p></div>`;
  }

  editChapelCollections(mutate) {
    const current = readingCollections(this.selection.config).filter(isChapelCollection);
    const next = mutate(current);
    const config = this.patch();
    config.interlocution = {
      ...(config.interlocution || {}),
      sourceFamily: next.length ? 'collections' : 'procedural',
      atriumCollections: next,
      sourced: next
    };
    this.selection = selectionFromConfig(config);
    this.selection.programLocked = Boolean(this.programInfo);
    this.emit();
    this.render();
  }

  renderHeldFocal() {
    const focal = this.selection.config.focals || {};
    if (focal.type !== 'rose' && focal.type !== 'icon') return '';
    const label = focal.type === 'rose'
      ? `Rosa Mystica${focal.roseMode === 'verbum' ? ' · Verbum' : ''}`
      : (focal.iconName || focal.iconId || 'Chapel icon');
    return `<div class="vnav-held" data-held-focal><b>${escapeHtml(label)}</b><br>
      Held from the Chapel${this.programInfo ? ' · release it above to follow the curated program' : ' · choose a glyph below to release it'}.</div>`;
  }

  renderBenches(leaf) {
    let html = '';

    if (leaf.id === 'focal') {
      const fieldLocked = Boolean(this.locked || this.programInfo);
      const personal = this.selection.style.focal.type === 'personal';
      const image = this.selection.config.focals?.personalImage;
      html += bench('Source', [
        { id: 'standard', label: 'Glyph', on: !personal, disabled: fieldLocked, attr: 'data-focal-type="standard"' },
        { id: 'personal', label: 'Personal', on: personal, disabled: fieldLocked, attr: 'data-focal-type="personal"' }
      ]);
      html += bench('Glyph', FOCAL_GLYPHS.map(g => ({
        id: g.id, label: g.glyph || g.id, on: this.selection.style.focal.glyph === g.id,
        disabled: fieldLocked,
        attr: `data-glyph="${escapeHtml(g.id)}"`
      })));
      if (personal) {
        html += image ? `<div class="vnav-personal-focal" data-personal-focal-preview>
          <img src="${safeUrl(image)}" alt="Personal focal">
          <button type="button" data-action="remove-personal-focal" ${fieldLocked ? 'disabled' : ''}>Remove</button></div>`
          : `<label class="vnav-personal-upload" data-action="upload-personal-focal">Upload focal image
            <input type="file" accept="image/*" hidden data-input="personal-focal" ${fieldLocked ? 'disabled' : ''}></label>`;
      }
    }

    if (leaf.engineId) {
      const style = this.styleOf(leaf.engineId);
      for (const b of substylesFor(leaf.engineId)) {
        html += bench(b.label, b.options.map(o => ({
          id: optId(o), label: optLabel(o), on: style[b.key] === optId(o), swatch: o.swatch,
          disabled: Boolean(this.locked || this.programInfo),
          attr: `data-sub="${escapeHtml(b.key)}" data-val="${escapeHtml(optId(o))}"`
        })));
      }
      // The Klee leaf used to carry its own 'Glass tile behind the text', which
      // was the same reader-facing thing as the switch in the controls below —
      // two controls trading ownership invisibly as the field changed. There is
      // one glass, and it lives with the other reader controls.

    }

    if (leaf.pool) {
      const options = [...poolOptions(leaf.id)];
      if (leaf.id === 'personal') {
        options.push(...MemoryCore.getWorkshopBlueprints()
          .filter(project => Array.isArray(project.customVisuals) && project.customVisuals.length > 0)
          .map(project => ({
            id: `personal:${project.id}`,
            label: `${project.title || 'Untitled sequence'} images`
          })));
      }
      const cur = this.selection.pool[leaf.id];
      html += bench('Pool', options.map(o => ({
        id: o.id, label: o.label, on: cur === o.id,
        disabled: Boolean(this.locked || this.programInfo),
        attr: `data-pool="${escapeHtml(o.id)}"`
      })));
      if (leaf.id === 'personal') {
        html += this.renderGlobalPoolPicker();
        html += '<button type="button" class="vnav-manage" data-action="open-personal">Manage uploads</button>';
      }
    }

    return html;
  }

  renderGlobalPoolPicker() {
    if (this.selection.pool.personal !== 'global-pool') return '';
    const assets = MemoryCore.getGlobalImageAssets();
    const pool = normalizeGlobalPoolSelection(this.selection.config.interlocution?.globalPool);
    const availableIds = new Set(assets.map(asset => asset.id));
    const selectedCount = pool.assetIds.filter(id => availableIds.has(id)).length;
    if (!assets.length) {
      return '<div class="vnav-global-picker"><b>Global Pool</b><p>The shared pool is empty. Add images from the Workshop Studio Shelf.</p></div>';
    }
    const modes = `<div class="vnav-global-mode" role="group" aria-label="Global Pool selection mode">
      <button type="button" class="vnav-opt ${pool.mode === 'all' ? 'on' : ''}" data-global-pool-mode="all" ${this.locked || this.programInfo ? 'disabled' : ''}>All Images</button>
      <button type="button" class="vnav-opt ${pool.mode === 'selected' ? 'on' : ''}" data-global-pool-mode="selected" ${this.locked || this.programInfo ? 'disabled' : ''}>Selected Images</button></div>`;
    const body = pool.mode === 'selected'
      ? `<div class="vnav-global-assets">${assets.map(asset => {
        const selected = pool.assetIds.includes(asset.id);
        return `<button type="button" class="${selected ? 'on' : ''}" data-global-asset-id="${escapeHtml(asset.id)}"
          aria-pressed="${selected}" title="${escapeHtml(asset.name)}" ${this.locked || this.programInfo ? 'disabled' : ''}><img src="${safeUrl(asset.uri)}" alt="${escapeHtml(asset.name)}"></button>`;
      }).join('')}</div>`
      : '<p>New shared images join this sequence automatically.</p>';
    const count = pool.mode === 'all'
      ? `${assets.length} available`
      : `${selectedCount} of ${assets.length} selected`;
    return `<div class="vnav-global-picker"><div class="vnav-global-head"><b>Global Pool</b><span>${count}</span></div>${modes}${body}</div>`;
  }

  attach() {
    this.container.querySelectorAll('.vnav-node').forEach(b =>
      b.onclick = () => {
        const col = Number(b.dataset.col);
        const node = this.columns()[col].find(n => n.id === b.dataset.id);
        if (node) this.navigate(col, node);
      });
    const q = sel => this.container.querySelector(sel);
    q('[data-action="navigator-back"]')?.addEventListener('click', () => this.navigateBack());
    q('[data-action="toggle"]')?.addEventListener('click', () => this.toggleEnabled());
    q('[data-action="glass"]')?.addEventListener('change', e => this.setGlass(e.target.checked));
    q('[data-action="living-text"]')?.addEventListener('change', e => this.setLivingText(e.target.checked));
    q('[data-action="open-personal"]')?.addEventListener('click', () => this.onOpenPersonal());
    this.container.querySelectorAll('[data-action="release-to-program"]').forEach(b =>
      b.onclick = () => this.releaseToProgram());
    this.container.querySelectorAll('[data-chamber-face]').forEach(b => {
      b.onclick = () => this.setFace(b.dataset.chamberFace, b);
      if (b.dataset.chamberFace === 'thick') {
        for (const type of ['pointerenter', 'focus', 'pointerup']) {
          b.addEventListener(type, event => {
            if (!this._faceHint
              && (type !== 'pointerup' || event.pointerType === 'touch' || !event.pointerType)) {
              this._faceHint = true;
              this.container.querySelector('#vnav-thick-explanation')?.removeAttribute('hidden');
            }
          });
        }
      }
    });
    this.container.querySelectorAll('[data-font-size]').forEach(b =>
      b.onclick = () => this.setSize(b.dataset.fontSize, b));
    this.container.querySelectorAll('[data-word-fill]').forEach(b =>
      b.onclick = () => this.setWordFill(b.dataset.wordFill, b));
    this.container.querySelectorAll('[data-ink-branch]').forEach(b =>
      b.onclick = () => this.toggleInkBranch());
    this.container.querySelectorAll('[data-word-fill-border]').forEach(b =>
      b.onclick = () => this.setWordFillBorder(b.dataset.wordFillBorder, b));
    if (this.programInfo) {
      this.container.querySelectorAll('[data-chamber-face], [data-font-size], [data-word-fill], [data-word-fill-border]')
        .forEach(b => ['pointerenter', 'focus', 'pointerup'].forEach(type =>
          b.addEventListener(type, () => {
            if (type === 'focus' && this._restoringDialogFocus) return;
            this.explainProgramOwnership(b);
          })));
    }
    q('[data-action="dialog-cancel"]')?.addEventListener('click', () => this.closeDialog());
    q('[data-dialog-primary]')?.addEventListener('click', () => this.dialog?.confirm());
    q('[role="dialog"]')?.addEventListener('keydown', event => {
      if (event.key === 'Escape') this.closeDialog();
    });
    this.container.querySelectorAll('[data-gallery-cadence]').forEach(b =>
      b.onclick = () => this.setCadence(b.dataset.galleryCadence));
    this.container.querySelectorAll('[data-sub]').forEach(b =>
      b.onclick = () => this.setSubstyle(b.dataset.engine || this.focus.engineId, b.dataset.sub, b.dataset.val));
    this.container.querySelectorAll('[data-glyph]').forEach(b =>
      b.onclick = () => this.setGlyph(b.dataset.glyph));
    this.container.querySelectorAll('[data-focal-type]').forEach(b =>
      b.onclick = () => this.setFocalType(b.dataset.focalType));
    q('[data-action="remove-personal-focal"]')?.addEventListener('click', () => this.removePersonalFocal());
    const personalInput = q('[data-input="personal-focal"]');
    q('[data-action="upload-personal-focal"]')?.addEventListener('click', () => personalInput?.click());
    personalInput?.addEventListener('change', e => this.setPersonalFocalFile(e.target.files?.[0]));
    this.container.querySelectorAll('[data-pool]').forEach(b =>
      b.onclick = () => this.setPool(this.focus.id, b.dataset.pool));
    this.container.querySelectorAll('[data-global-pool-mode]').forEach(b =>
      b.onclick = () => this.setGlobalPoolMode(b.dataset.globalPoolMode));
    this.container.querySelectorAll('[data-global-asset-id]').forEach(b =>
      b.onclick = () => this.toggleGlobalAsset(b.dataset.globalAssetId));
    this.container.querySelectorAll('[data-chapel-remove]').forEach(b =>
      b.onclick = () => this.editChapelCollections(current =>
        current.filter(id => id !== b.dataset.chapelRemove)));
    this.container.querySelectorAll('[data-chapel-add]').forEach(b =>
      b.onclick = () => this.editChapelCollections(current =>
        current.includes(b.dataset.chapelAdd) ? current : [...current, b.dataset.chapelAdd]));
    q('[data-action="chapel-add-toggle"]')?.addEventListener('click', e => {
      this._chapelTrayOpen = !this._chapelTrayOpen;
      q('.vnav-chapel-menu').hidden = !this._chapelTrayOpen;
      e.currentTarget.setAttribute('aria-expanded', String(this._chapelTrayOpen));
    });
  }

  destroy() {
    this._cancelPreview(); this._cancelInk(); this._destroyed = true; this.container.innerHTML = ''; }
}

function glyphFor(node) {
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
const CHIP_REASON = Object.freeze({
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
const MASK_REASON = Object.freeze({
  'requires-gallery': 'Needs a Gallery field — a Focal or a Dynamic field has no imagery to paint through the letters.',
  'requires-word': 'Needs one word at a time — phrase chunking leaves no single Word to fill.',
  'requires-thick': 'Needs the Thick face — the other three are too fine to carry imagery.',
  'requires-fit': 'Needs the Fit size — a Word must fill the chamber to hold a picture.',
  'program-owned': 'This reading came with its own visual program, which owns this choice.'
});

function bench(label, opts, className = '') {
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

const readingCollections = config => Array.isArray(config?.interlocution?.atriumCollections)
  ? config.interlocution.atriumCollections
  : [];
const isChapelCollection = id => typeof id === 'string'
  && (id.startsWith('chapel-') || id.startsWith('dore:'));
const readingCollectionLabel = id => {
  if (CHAPEL_COLLECTION_LABELS[id]) return CHAPEL_COLLECTION_LABELS[id];
  if (id.startsWith('dore:')) {
    const book = id.slice('dore:'.length).replace(/-(\d)/, ' $1').replace(/^./, c => c.toUpperCase());
    return `Doré · ${book}`;
  }
  if (id.startsWith('chapel-gospel-')) {
    return id.slice('chapel-gospel-'.length).split('-')
      .map(word => word[0].toUpperCase() + word.slice(1)).join(' ');
  }
  return id;
};

const readAsDataUrl = file => new Promise((resolve, reject) => {
  const reader = new FileReader();
  reader.onload = event => resolve(event.target.result);
  reader.onerror = () => reject(reader.error);
  reader.readAsDataURL(file);
});

async function compressFocalImage(file) {
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

function wordFillValue(fill) {
  if (fill?.mode === 'accent') return 'accent';
  const normalized = normalizeWordFill(fill);
  if (normalized.mode !== 'pick') return 'same';
  if (normalized.procedural[0]) return `procedural:${normalized.procedural[0]}`;
  if (normalized.sourced[0]) return `sourced:${normalized.sourced[0]}`;
  return 'same';
}

function inkFocusFrom(fill) {
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

function inkPoolFamilies() {
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
