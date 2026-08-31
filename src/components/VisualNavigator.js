/**
 * VisualNavigator — the field, chosen by walking a directory.
 *
 * Columns, text material, preview, and Chapel trays live in sibling modules.
 * This file mounts them, keeps selection, and rebuilds the panel.
 *
 * IT COMPUTES NO CONFIG OF ITS OWN. On any change it hands `configPatch` the
 * whole selection and emits the patch.
 */

import { escapeHtml } from '../core/sanitize.js';
import { describeField } from '../core/visual-taxonomy.js';
import {
  configPatch,
  selectionFromConfig
} from '../core/visual-taxonomy-config.js';
import {
  clearLaunchVisualSelection,
  releaseLaunchHeldFocal
} from '../core/visual-identity.js';
import { isChapelCollection } from '../content/chapel/imagery/labels.js';
import { inkFocusFrom, readingCollections } from './visual-navigator/markup.js';
import { directoryMethods } from './visual-navigator/directory.js';
import { textMethods } from './visual-navigator/text.js';
import { previewMethods } from './visual-navigator/preview.js';
import { chapelMethods } from './visual-navigator/chapel.js';
import './VisualNavigator.css';

export class VisualNavigator {
  constructor(container, options = {}) {
    this.container = container;
    this.onChange = options.onChange || (() => {});
    this.onTextMaterialTransaction = options.onTextMaterialTransaction || (() => {});
    this.onOpenPersonal = options.onOpenPersonal || (() => {});
    this.locked = options.locked === true;
    // The gate's second line. It names the dependency rather than the
    // machinery: a reader is choosing a reading, not loading a text.
    this.lockedMessage = options.lockedMessage
      || 'Choose a reading before bringing visuals into the Chamber.';
    this.programInfo = options.programInfo || null;
    this.selection = selectionFromConfig(options.visualConfig || {});
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

  getConfig() { return this.patch(); }

  setConfig(visualConfig = {}) {
    this.selection = selectionFromConfig(visualConfig);
    if (readingCollections(visualConfig).some(isChapelCollection)) this._chapelLaunch = true;
    this.inkFocus = inkFocusFrom(this.selection.wordFill);
    const first = [...this.selection.enabled][0];
    if (first) this.openLeafById(first);
    else { this.path = []; this.focus = null; }
    this.render();
  }

  setProgramInfo(info) {
    this.programInfo = info && typeof info === 'object' ? info : null;
    this.render();
  }

  /**
   * What stands where the browser would be, until a reading exists.
   *
   * A real heading rather than a live region: the panel is not announcing a
   * change, it is stating a condition. When the state flips while the panel
   * is open, render() replaces this wholesale and the reader's focus falls to
   * the panel, which is the honest place for it.
   */
  renderGate() {
    return `<div class="vnav-gate" role="note">
      <span class="vnav-gate-mark" aria-hidden="true">◈</span>
      <h3>Pick a text first</h3>
      <p>${escapeHtml(this.lockedMessage)}</p>
    </div>`;
  }

  setLocked(locked) {
    this.locked = locked === true;
    if (this.locked) {
      this.selection.enabled = new Set();
      this.selection.emptyKind = 'off';
      // A question about a reading that has gone cannot be answered. It is
      // withdrawn rather than left standing over the gate.
      this.dialog = null;
      this._dialogReturnFocusSelector = null;
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
    // A PANEL THAT CANNOT ACT SHOULD NOT LOOK LIKE ONE THAT CAN.
    //
    // With no text, this rendered the whole browser under a one-line notice.
    // A reader could walk the tree and open a leaf, and met the refusal only
    // at the end — a disabled "Bring into the room" that said nothing about
    // why. The dependency was announced once at the top and contradicted by
    // everything beneath it. The gate stands in the browser's place instead:
    // nothing to walk into, nothing to tab through, and the reason given
    // where the work would have been.
    this.container.innerHTML = this.locked
      ? `<div class="vnav vnav-is-gated">${this.renderGate()}</div>`
      : `
      <div class="vnav${this.focus ? ' vnav-at-leaf' : ''}">
        <div class="vnav-bar">
          ${this.path.length || this.focus ? '<button type="button" class="vnav-back" data-action="navigator-back">‹ Back</button>' : ''}
          <span class="vnav-path">${this.pathBar()}</span>
          <span class="vnav-field">${escapeHtml(describeField(this.selection.enabled))}</span>
        </div>
        ${this.programInfo ? this.renderProgramLock() : ''}
        ${this.renderReadingCollections()}
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

Object.assign(
  VisualNavigator.prototype,
  directoryMethods,
  textMethods,
  previewMethods,
  chapelMethods
);
