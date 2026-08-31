/**
 * Directory columns, field toggles, leaf benches, and reader switches.
 */
import { escapeHtml, safeUrl } from '../../core/sanitize.js';
import {
  FIELD,
  categoryOf,
  galleryMembers,
  isBlend,
  substylesFor,
  toggleField
} from '../../core/visual-taxonomy.js';
import { configPatch, poolOptions } from '../../core/visual-taxonomy-config.js';
import { FOCAL_GLYPHS } from '../../core/visual-style-definitions.js';
import { MemoryCore } from '../../core/memory.js';
import { normalizeGlobalPoolSelection } from '../../core/visual-selection.js';
import {
  ROOT,
  CADENCE,
  glyphFor,
  bench,
  optId,
  optLabel,
  compressFocalImage
} from './markup.js';

const TEXT = Object.freeze([
  Object.freeze({ id: 'face', label: 'Face', textControl: true }),
  Object.freeze({ id: 'size', label: 'Size', textControl: true }),
  Object.freeze({ id: 'ink', label: 'Ink', textControl: true })
]);
const ROOT_WITH_TEXT = Object.freeze([...ROOT, ...TEXT]);

export const directoryMethods = {
  columns() {
    const cols = [ROOT_WITH_TEXT];
    for (const node of this.path) if (node.children) cols.push(node.children);
    return cols;
  },

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
  },

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
  },

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
  },

  toggleEnabled(returnFocus) {
    const leaf = this.focus;
    if (!leaf || !categoryOf(leaf.id) || this.locked || this.programInfo) return;
    // THE SAME QUESTION, ASKED FROM THE OTHER SIDE.
    //
    // setSize asks before letting Fit take a field that cannot carry it, and
    // this asked nothing at all — so choosing Fit while a Focal was held
    // opened a dialog, while enabling that Focal while Fit was on landed
    // silently in the very state the dialog exists to prevent. A rule
    // enforced on one road and not the other is not a rule; it is a toll.
    if (!this.selection.enabled.has(leaf.id) && this.fitHoldsTheWord()) {
      const enabled = toggleField(this.selection.enabled, leaf.id);
      const probe = {
        ...this.selection,
        enabled,
        emptyKind: enabled.size ? 'leaves' : 'off'
      };
      if (!this._fieldPresentsGallery(probe)) {
        return this.confirmFitRelease(leaf, returnFocus);
      }
    }
    this.commitField(leaf.id);
  },

  commitField(id) {
    // The one rule lives in the model; call it and take the new set.
    this.selection.enabled = toggleField(this.selection.enabled, id);
    this.selection.emptyKind = this.selection.enabled.size ? 'leaves' : 'off';
    this.emit();
    this.render();
  },

  confirmFitRelease(leaf, returnFocus) {
    const settings = this.textMaterialSettings();
    this.openDialog({
      title: 'Fit paints the letters from a continuous field.',
      body: `${leaf.label} draws the room in its own mode, which leaves no continuous `
        + 'field to paint from, so taking it returns the reading to a fixed size. '
        + 'Everything else is kept.',
      primaryLabel: `Take ${leaf.label}`,
      primaryAction: 'release-fit-for-field',
      confirm: () => {
        this.commitField(leaf.id);
        this.requestTextMaterialTransaction({
          face: settings.face,
          fontSize: 'medium',
          wordFill: this.selection.wordFill,
          settings: { chamberFace: settings.face, fontSize: 'medium', chamberMask: false }
        });
        this.closeDialog();
      }
    }, returnFocus);
  },

  setSubstyle(engineId, key, value) {
    if (this.locked || this.programInfo) return;
    const bucket = engineId === 'genesis' ? 'klee' : engineId;
    this.selection.style[bucket] = { ...this.selection.style[bucket], [key]: value };
    this.emit();
    this.render();
  },

  setGlyph(glyph) {
    if (this.locked || this.programInfo) return;
    this.selection.style.focal = { ...this.selection.style.focal, type: 'standard', glyph };
    this.selection.focalDirty = true;
    this.emit();
    this.render();
  },

  /**
   * One press, one level.
   *
   * The entry IS a step. On a phone the columns collapse to one and the open
   * leaf takes the pane, so the list a reader chose from is behind them —
   * Back has to return to that list before it unwinds any branch. Popping the
   * path and clearing the focus together skipped a level, and a leaf opened
   * straight off the root (Face, Size, Ink) left `path` empty, so Back was
   * not rendered at all and there was no way back to the rail.
   */
  navigateBack() {
    if (this.focus) { this.focus = null; this.render(); return; }
    if (!this.path.length) return;
    this.path = this.path.slice(0, -1);
    this.render();
  },

  setFocalType(type) {
    if (this.locked || this.programInfo || !['standard', 'personal'].includes(type)) return;
    this.selection.style.focal = { ...this.selection.style.focal, type };
    this.selection.focalDirty = true;
    this.emit();
    this.render();
  },

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
  },

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
  },

  _glassOwner() {
    return this.selection.enabled.has('klee') ? 'genesis' : 'stream';
  },

  glassOn() {
    return this._glassOwner() === 'genesis'
      ? this.selection.style.klee.glass !== false
      : this.selection.streamGlass !== false;
  },

  setGlass(on) {
    if (this.locked || this.programInfo) return;
    if (this._glassOwner() === 'genesis') {
      this.selection.style.klee = { ...this.selection.style.klee, glass: on === true };
    } else {
      this.selection.streamGlass = on === true;
    }
    this.emit();
    this.render();
  },

  setPool(leafId, poolId) {
    if (this.locked || this.programInfo) return;
    this.selection.pool = { ...this.selection.pool, [leafId]: poolId };
    this.emit();
    this.render();
  },

  setGlobalPoolMode(mode) {
    if (this.locked || this.programInfo) return;
    const current = normalizeGlobalPoolSelection(this.selection.config.interlocution?.globalPool);
    this.selection.config.interlocution = {
      ...(this.selection.config.interlocution || {}),
      globalPool: normalizeGlobalPoolSelection({ ...current, mode })
    };
    this.emit();
    this.render();
  },

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
  },

  releaseToProgram() {
    if (!this.programInfo) return;
    this.selection.enabled = new Set();
    this.selection.emptyKind = 'held-empty';
    this.selection.focalDirty = false;
    this.emit();
    this.render();
  },

  writeSetting(key, value) {
    if (typeof window === 'undefined') return;
    if (typeof window.rise?.handleSettingsChange === 'function') {
      window.rise.handleSettingsChange(key, value);
    } else if (window.rise?.settings) {
      window.rise.settings[key] = value;
    }
  },

  _fieldPresentsGallery(selection = this.selection) {
    if (selection.emptyKind === 'held-empty') return true;
    if (!selection.enabled.size) return false;
    const patch = configPatch(selection);
    const presentation = patch.interlocution?.presentation;
    return patch.visualMode === 'interlocution'
      && (presentation === 'continuous' || presentation === 'continuous-word');
  },

  pathBar() {
    const names = this.path.map(n => `<span>${escapeHtml(n.label.toLowerCase())}</span>`);
    if (this.focus) names.push(`<span class="here">${escapeHtml(this.focus.label.toLowerCase())}</span>`);
    return names.length ? names.join('<i>/</i>') : '<span>field</span>';
  },

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
  },

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
  },

  renderStyleBenches(engineId) {
    const style = this.styleOf(engineId);
    return substylesFor(engineId).map(b => bench(b.label, b.options.map(o => ({
      id: optId(o), label: optLabel(o), on: style[b.key] === optId(o), swatch: o.swatch,
      disabled: Boolean(this.locked || this.programInfo),
      attr: `data-sub="${escapeHtml(b.key)}" data-val="${escapeHtml(optId(o))}" data-engine="${escapeHtml(engineId)}"`
    })))).join('');
  },

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
      || this.selection.emptyKind === 'held-empty';
    // A SWITCH SHOULD SAY WHAT IT DOES, AND WHY IT CANNOT.
    //
    // These were bare checkboxes with a word beside them: a boolean, and no
    // account of what it changes or why a reader might want it. Glass carried
    // its one explanation in a `title`, which a phone can never show — so on
    // the surface where it matters most it was disabled and silent.
    //
    // The label wraps the input, which is what makes the whole row the
    // control: a click anywhere on it forwards natively. Nothing is layered
    // on top of that, because a row handler ADDED to a wrapping label is
    // exactly how one press becomes two toggles.
    const glassNote = maskHoldsLetters
      ? 'The word itself is holding the frame — a Fit word, or a mask carrying the letters. Glass behind it would swallow the field. It returns at a fixed scale.'
      : 'A blurred pane behind the words, so they hold their edge against the imagery.';
    return `<div class="vnav-reader-controls">
      <label class="vnav-switch${this.selection.livingText.enabled ? ' is-on' : ''}${fieldLocked ? ' is-off-limits' : ''}">
        <input type="checkbox" data-action="living-text" aria-describedby="vnav-living-note"
          ${this.selection.livingText.enabled ? 'checked' : ''} ${fieldLocked ? 'disabled' : ''}>
        <span class="vnav-switch-track" aria-hidden="true"><span class="vnav-switch-knob"></span></span>
        <span class="vnav-switch-copy">
          <span class="vnav-switch-name">Living Text</span>
          <span class="vnav-switch-note" id="vnav-living-note">Lets the reading's own feeling colour the words as they pass.</span>
        </span>
      </label>
      <label class="vnav-switch${this.glassOn() ? ' is-on' : ''}${fieldLocked || maskHoldsLetters ? ' is-off-limits' : ''}">
        <input type="checkbox" data-action="glass" aria-describedby="vnav-glass-note"
          ${this.glassOn() ? 'checked' : ''}
          ${fieldLocked || maskHoldsLetters ? 'disabled' : ''}>
        <span class="vnav-switch-track" aria-hidden="true"><span class="vnav-switch-knob"></span></span>
        <span class="vnav-switch-copy">
          <span class="vnav-switch-name">Glass behind the text</span>
          <span class="vnav-switch-note" id="vnav-glass-note">${escapeHtml(glassNote)}</span>
        </span>
      </label>
      ${galleryContext ? `<div class="vnav-cadence"><span>Cadence</span>${CADENCE.map(item => `
        <button type="button" class="vnav-opt ${this.selection.galleryCadence === item.value ? 'on' : ''}"
          data-gallery-cadence="${item.value}" ${fieldLocked ? 'disabled' : ''}>${item.label}</button>`).join('')}</div>` : ''}
    </div>`;
  },

  renderProgramLock() {
    const episodes = Math.max(0, Number(this.programInfo?.episodes) || 0);
    return `<div class="vnav-program" data-program-lock role="status">
      <span>✦</span><span><b>Special Collection · ${episodes} episodes</b><br>
      The imagery follows this passage scene by scene. Its field is read-only.</span>
      ${this.selection.enabled.has('focal')
        ? '<button type="button" class="vnav-program-release" data-action="release-to-program">Release focal</button>'
        : ''}</div>`;
  },

  renderHeldFocal() {
    const focal = this.selection.config.focals || {};
    if (focal.type !== 'rose' && focal.type !== 'icon') return '';
    const label = focal.type === 'rose'
      ? `Rosa Mystica${focal.roseMode === 'verbum' ? ' · Verbum' : ''}`
      : (focal.iconName || focal.iconId || 'Chapel icon');
    return `<div class="vnav-held" data-held-focal><b>${escapeHtml(label)}</b><br>
      Held from the Chapel${this.programInfo ? ' · release it above to follow the curated program' : ' · choose a glyph below to release it'}.</div>`;
  },

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
  },

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
  },
};
