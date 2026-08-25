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
  resolveFontSize
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
    this.render();
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
  setGlass(on) {
    if (this.locked || this.programInfo) return;
    this.selection.style.klee = { ...this.selection.style.klee, glass: on };
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

  textMaterialCapability(wordFill = this.selection.wordFill, settings = this.textMaterialSettings()) {
    return resolveTextMaterialCapability({
      face: settings.face,
      fontSize: settings.fontSize,
      chunkMode: 'word',
      visualMode: 'interlocution',
      presentation: 'continuous',
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

  explainBlockedMask(wordFill, returnFocus) {
    this.openDialog({
      title: 'Visual masks require Thick + Fit.',
      body: 'Bold, chamber-filling words provide enough surface for imagery.',
      primaryLabel: 'Use Thick + Fit',
      primaryAction: 'use-thick-fit',
      confirm: () => {
        this.selection.emptyGallery = true;
        this.selection.preserveBaseSelection = true;
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
      const gallery = this.selection.enabled.size > 0
        && [...this.selection.enabled].every(id => categoryOf(id) === FIELD.GALLERY);
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

  setWordFill(value, returnFocus) {
    if (this.locked) return;
    if (this.programInfo) return this.explainProgramOwnership(returnFocus);
    const settings = this.textMaterialSettings();
    let wordFill = null;
    if (value === 'accent') {
      wordFill = wordFillValue(this.selection.wordFill) === 'accent'
        ? { mode: 'plain' }
        : { mode: 'accent' };
      this.inkFocus = null;
    } else if (value === 'same') {
      wordFill = { mode: 'same', border: normalizeWordFill(this.selection.wordFill).border || 'cream' };
      this.inkFocus = null;
    } else if (value.startsWith('procedural:')) {
      const engineId = value.slice('procedural:'.length);
      wordFill = {
        mode: 'pick', sourceFamily: 'procedural', procedural: [engineId], sourced: [],
        border: normalizeWordFill(this.selection.wordFill).border || 'cream'
      };
      this.inkFocus = engineId;
    } else if (value.startsWith('sourced:')) {
      const sourceId = value.slice('sourced:'.length);
      wordFill = {
        mode: 'pick', sourceFamily: 'collections', procedural: [], sourced: [sourceId],
        border: normalizeWordFill(this.selection.wordFill).border || 'cream'
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
    if (!this.hasActiveMask() || !['off', 'cream', 'accent'].includes(border)) return;
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

  setStreamGlass(enabled) {
    if (this.locked || this.programInfo) return;
    this.selection.streamGlass = enabled === true;
    this.emit();
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
    if (focusKey) {
      const again = this.container.querySelector(focusKey);
      // Only take focus back if it is still ours to take — a dialog that
      // opened during this render owns it now.
      if (again && !this.dialog && typeof again.focus === 'function') {
        again.focus({ preventScroll: true });
      }
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

  renderTextEntry(id) {
    if (id === 'face') {
      const selected = this.textMaterialSettings().face;
      return this.renderTextShell('Face', 'The letters, not the room.', bench('Face',
        CHAMBER_STREAM_FACES.map(item => ({
          id: item.id, label: item.id === 'thick' ? 'Thick ★' : item.label, on: item.id === selected,
          readOnly: Boolean(this.programInfo), special: item.id === 'thick',
          attr: `data-chamber-face="${escapeHtml(item.id)}"${item.id === 'thick' ? ' aria-describedby="vnav-thick-explanation"' : ''}`
        })), 'vnav-face-grid') + `<p id="vnav-thick-explanation" class="vnav-control-explanation">Thick
          is the mask-ready face — the other three cannot carry a Visual mask.</p>`);
    }
    if (id === 'size') {
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
      return this.renderTextShell('Size', selected === 'fit' ? SIZE_HINT_FIT : 'Choose the scale of the reading.',
        `${scale}${mode}<p id="vnav-fit-consequence" class="vnav-fit-consequence">Fit scales each
          Word to fill the chamber and paints the gallery through the letters. Words step one at a
          time; Recitation and phrase chunking stand aside.</p>`);
    }
    const value = wordFillValue(this.selection.wordFill);
    const settings = this.textMaterialSettings();
    const fieldLocked = Boolean(this.locked);
    const programLocked = Boolean(this.programInfo);
    const maskAvailable = this.textMaterialCapability({ mode: 'same' }, settings).available;
    const engines = WORD_FILL_PROCEDURAL_PATTERNS.map(item => ({
      id: item.id, label: item.name, on: value === `procedural:${item.id}`,
      disabled: fieldLocked,
      readOnly: programLocked,
      blocked: !maskAvailable && !programLocked,
      attr: `data-word-fill="procedural:${escapeHtml(item.id)}"`
    }));
    const poolBenches = inkPoolFamilies().map(family => bench(family.label,
      family.options.map(item => ({
        id: item.id, label: item.label, on: value === `sourced:${item.id}`,
        disabled: fieldLocked,
        readOnly: programLocked,
        blocked: !maskAvailable && !programLocked,
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
      { id: 'same', label: 'Same as the Field', on: value === 'same', disabled: fieldLocked, readOnly: programLocked, blocked: !maskAvailable && !programLocked, attr: 'data-word-fill="same"' },
      {
        id: 'own', label: `Something of its own ${ownOpen ? '▾' : '▸'}`, on: chosenOwn,
        disabled: fieldLocked,
        attr: `data-ink-branch="own" aria-expanded="${ownOpen}" aria-controls="vnav-ink-own"`
      }
    ], 'vnav-ink-answers');

    return this.renderTextShell('Ink', 'Paint the gallery through the letters.', `
      ${answers}
      ${ownOpen ? `<div class="vnav-ink-own" id="vnav-ink-own">
        ${bench('A generated field', engines)}
        ${poolBenches}
      </div>` : ''}
      ${this.hasActiveMask() ? bench('Border', [
        { id: 'off', label: 'Off', on: normalizeWordFill(this.selection.wordFill).border === 'off', disabled: fieldLocked, readOnly: programLocked, attr: 'data-word-fill-border="off"' },
        { id: 'cream', label: 'Cream', on: normalizeWordFill(this.selection.wordFill).border === 'cream', disabled: fieldLocked, readOnly: programLocked, attr: 'data-word-fill-border="cream"' },
        { id: 'accent', label: 'Accent', on: normalizeWordFill(this.selection.wordFill).border === 'accent', disabled: fieldLocked, readOnly: programLocked, attr: 'data-word-fill-border="accent"' }
      ], 'is-property') : ''}
      ${styles}
      <p class="vnav-fit-coupling">Fit paints the gallery through the letters. Words step one at a time; Recitation and phrase chunking stand aside.</p>`);
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

  renderTextShell(title, desc, body) {
    return `<div class="vnav-entry-head"><span class="vnav-glyph">${glyphFor({ id: title.toLowerCase() })}</span>
      <div><h3>${escapeHtml(title)}</h3><p class="vnav-kind">Text</p></div></div>
      <p class="vnav-desc">${escapeHtml(desc)}</p>${body}`;
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
    const galleryContext = [...this.selection.enabled].some(id => categoryOf(id) === FIELD.GALLERY)
      || categoryOf(this.focus?.id) === FIELD.GALLERY
      || this.selection.emptyGallery;
    return `<div class="vnav-reader-controls">
      <label class="vnav-living"><input type="checkbox" data-action="living-text"
        ${this.selection.livingText.enabled ? 'checked' : ''} ${fieldLocked ? 'disabled' : ''}> <span>Living Text</span></label>
      <label class="vnav-living"><input type="checkbox" data-action="stream-glass"
        ${this.selection.streamGlass !== false ? 'checked' : ''} ${fieldLocked ? 'disabled' : ''}> <span>Glass</span></label>
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
      if (leaf.engineId === 'klee') {
        html += `<label class="vnav-glass"><input type="checkbox" data-action="glass"
          ${this.selection.style.klee.glass !== false ? 'checked' : ''}
          ${this.locked || this.programInfo ? 'disabled' : ''}> Glass tile behind the text</label>`;
      }
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
    q('[data-action="stream-glass"]')?.addEventListener('change', e => this.setStreamGlass(e.target.checked));
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

  destroy() { this._destroyed = true; this.container.innerHTML = ''; }
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
  blocked: 'Needs the Thick face and Fit size — a Visual mask cannot be carried otherwise.',
  readOnly: 'This reading came with its own visual program, which owns this choice.'
});

function bench(label, opts, className = '') {
  return `
    <div class="vnav-bench ${className}">
      <span class="vnav-bench-label">${escapeHtml(label)}</span>
      <div class="vnav-opts">
        ${opts.map(o => {
    const state = o.blocked ? 'blocked' : (o.readOnly ? 'readOnly' : (o.on ? 'chosen' : 'open'));
    const reason = CHIP_REASON[state];
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
  Object.freeze({ id: 'science', label: 'Science' }),
  Object.freeze({ id: 'personal', label: 'Yours' })
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
