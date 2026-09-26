/**
 * The phone navigator: one visual fills the screen, a rail of the others sits
 * under the thumb, and nothing reaches the reading until Choose.
 *
 * LOOKING IS NOT CHOOSING. The directory commits on every chip. Here focus and
 * Vary edits are staged in `this.stage`, and `this.selection` stays the
 * committed reading, so leaving without Choose changes nothing. Text material
 * (Aa) is not a visual choice and still writes at once through the existing
 * text methods, which is why those methods run against `this.selection`.
 *
 * THE RULES ARE NOT RESTATED. Exclusivity is `chooseField` / `toggleField`,
 * the Fit coupling is the directory's `confirmFitRelease`, the benches'
 * options come from `substylesFor` / `poolOptions` / FOCAL_GLYPHS.
 */
import { escapeHtml, safeUrl } from '../../core/sanitize.js';
import {
  FIELD,
  categoryOf,
  leafById,
  substylesFor,
  toggleField
} from '../../core/visual-taxonomy.js';
import { poolOptions } from '../../core/visual-taxonomy-config.js';
import { FOCAL_GLYPHS } from '../../core/visual-style-definitions.js';
import { RAIL_FAMILIES, chooseField, railNeighbour, worldRail } from '../../core/world-rail.js';
import { MemoryCore } from '../../core/memory.js';
import { glyphFor, optId, optLabel } from './markup.js';
import { stillQueue } from './preview.js';
import { createLiveStage } from './live-stage.js';
import './world-stage.css';

export const PHONE_QUERY = '(max-width: 767px), (max-height: 500px) and (pointer: coarse)';
export const STAGE_HOLD_MS = 900;
const SWIPE_CLAIM_PX = 24;
const EDGE_GUARD_PX = 20;
const SWIPE_VERTICAL_PX = 48;

const FAMILY_LINE = Object.freeze({
  stillness: 'Stillness',
  drawn: 'Drawn in time',
  fields: 'A held field',
  art: 'Works of art',
  yours: 'Your own images'
});

const reducedMotion = () => typeof window.matchMedia === 'function'
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * One line of the reader's own text to judge the visual against: the first
 * sentence long enough to be prose rather than a title, cut at a word.
 */
export function sampleLine(text, limit = 110) {
  if (typeof text !== 'string' || !text.trim()) return '';
  const head = text.slice(0, 4000);
  const sentences = head.replace(/\s+/g, ' ').match(/[^.!?]+[.!?]?/g) || [];
  const prose = sentences.map(s => s.trim()).find(s => s.split(' ').length >= 6) || sentences[0]?.trim() || '';
  if (prose.length <= limit) return prose;
  const cut = prose.slice(0, limit);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:]$/, '')}…`;
}

export function phonePresentation() {
  return typeof window.matchMedia === 'function' && window.matchMedia(PHONE_QUERY).matches
    ? 'stage' : 'directory';
}

export const stageMethods = {
  initStage(options = {}) {
    this.mode = options.mode === 'pick' ? 'pick' : 'configure';
    this.onClose = options.onClose || (() => {});
    this.onPick = options.onPick || (() => {});
    this.getSampleText = typeof options.getSampleText === 'function'
      ? options.getSampleText
      : () => (typeof options.sampleText === 'string' ? options.sampleText : '');
    this.pickable = options.pickable instanceof Set ? options.pickable : null;
    this._initialLeafId = options.initialLeafId || null;
    this._onFieldCommitted = () => this._stageCommitted();
    this.stage = this._freshStage();
    this._liveHost = null;
    this._liveStage = null;
    this._liveFactories = options.liveFactories;
  },

  /** The live host outlives every render, so an engine is never rebuilt by one. */
  _syncLive() {
    if (this.presentation !== 'stage' || this.locked) return;
    if (!this._liveStage) {
      this._liveHost = document.createElement('div');
      this._liveHost.className = 'vstage-live';
      this._liveStage = createLiveStage({
        host: this._liveHost,
        ...(this._liveFactories ? { factories: this._liveFactories } : {})
      });
      // The Orbital builds its navigator with the page, long before anyone
      // opens it; a picker is built at the moment it is opened.
      if (this.mode !== 'pick' && !this._stageOpen) this._liveStage.suspend('closed');
    }
    this.container.querySelector('.vstage-live-slot')?.appendChild(this._liveHost);
    const world = this._stageWorld();
    const engineId = world?.engineId || null;
    this._liveStage.focus(engineId, engineId ? this._stageStyle(engineId) : {});
  },

  _freshStage() {
    const rail = this.stageRail();
    const committed = [...this.selection.enabled][0];
    const wanted = this._initialLeafId || committed || 'off';
    const focusId = rail.some(world => world.id === wanted) ? wanted : (rail[0]?.id ?? null);
    return { focusId, sheet: null, staged: { style: {}, pool: {} }, committed: false };
  },

  stageRail() {
    const rail = worldRail();
    return this.pickable ? rail.filter(world => this.pickable.has(world.id)) : rail;
  },

  /** Opening is a fresh look: whatever was staged last time is gone. */
  enterStage() {
    if (this.presentation !== 'stage') return;
    this._stageOpen = true;
    this.stage = this._freshStage();
    this.render();
    this._liveStage?.resume('closed');
    this._stageRevealFocus('auto');
  },

  leaveStage() {
    this._stageOpen = false;
    this._liveStage?.suspend('closed');
  },

  _stageWorld(id = this.stage?.focusId) {
    return this.stageRail().find(world => world.id === id) || null;
  },

  _stageBucket(engineId) {
    return engineId === 'klee' ? 'klee' : engineId;
  },

  _stageStyle(engineId) {
    const bucket = this._stageBucket(engineId);
    return { ...(this.selection.style[bucket] || {}), ...(this.stage.staged.style[bucket] || {}) };
  },

  _stagePool(world) {
    return this.stage.staged.pool[world.id]
      || this.selection.pool?.[world.id]
      || poolOptions(world.id)[0]?.id
      || null;
  },

  _stageStillKey(world) {
    if (!world) return null;
    if (world.engineId) {
      const style = this._stageStyle(world.engineId);
      const parts = substylesFor(world.engineId).map(b => `${b.key}=${style[b.key] ?? ''}`).join('&');
      return parts ? `${world.engineId}?${parts}` : world.engineId;
    }
    return world.pool ? this._stagePool(world) : null;
  },

  _stageLoadStill(world, { prioritize = false } = {}) {
    const key = this._stageStillKey(world);
    if (!key || stillQueue.cached(key)) return;
    const engineId = world.engineId;
    const request = this._fetchStill(key, cortex => engineId
      ? cortex.renderLeafStill(engineId).then(still => still?.url)
      : this._sourcedStill(cortex, key), { serial: Boolean(engineId) });
    if (prioritize) stillQueue.prioritize(key);
    void request.then(url => {
      if (this._destroyed || this.presentation !== 'stage') return;
      if (url) this._stagePaint(world.id);
      else if (world.id === this.stage.focusId) this._stageMarkMissing(world.id);
    });
  },

  _stagePaint(id) {
    const world = this._stageWorld(id);
    const url = safeUrl(stillQueue.cached(this._stageStillKey(world)) || '');
    if (!url) return;
    const art = this.container.querySelector(`.vstage-tile[data-world="${id}"] .vstage-tile-art`);
    if (art) {
      art.style.backgroundImage = `url("${url}")`;
      art.classList.add('has-still');
    }
    if (id === this.stage.focusId) {
      const still = this.container.querySelector('.vstage-still');
      if (still) {
        still.style.backgroundImage = `url("${url}")`;
        still.classList.add('has-still');
        still.querySelector('.vstage-missing')?.remove();
      }
    }
  },

  _stageMarkMissing(id) {
    if (id !== this.stage.focusId) return;
    const still = this.container.querySelector('.vstage-still');
    if (!still || still.classList.contains('has-still') || still.querySelector('.vstage-missing')) return;
    still.insertAdjacentHTML('beforeend',
      '<p class="vstage-missing">The picture didn’t arrive. The visual itself still works.</p>');
  },

  _stageObserveTiles() {
    const rail = this.container.querySelector('.vstage-rail');
    const focused = this._stageWorld();
    if (focused) this._stageLoadStill(focused, { prioritize: true });
    this._stageObserver?.disconnect();
    if (!rail || typeof IntersectionObserver !== 'function') return;
    this._stageObserver = new IntersectionObserver(entries => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const world = this._stageWorld(entry.target.dataset.world);
        if (world) this._stageLoadStill(world);
        this._stageObserver?.unobserve(entry.target);
      }
    }, { root: rail, rootMargin: '0px 96px' });
    rail.querySelectorAll('.vstage-tile').forEach(tile => this._stageObserver.observe(tile));
  },

  _stageHasVary(world) {
    if (!world || this.mode === 'pick' && world.id === 'personal') return false;
    if (world.id === 'focal') return true;
    if (world.engineId && substylesFor(world.engineId).length) return true;
    if (world.pool) return true;
    return world.category === FIELD.GALLERY && this.mode !== 'pick';
  },

  _stageStatus(world) {
    if (!world) return '';
    const inRoom = this.mode !== 'pick' && (world.id === 'off'
      ? this.selection.enabled.size === 0
      : this.selection.enabled.has(world.id));
    const kind = world.pool && this._stagePoolLabel(world) ? world.label : FAMILY_LINE[world.family];
    return [kind, inRoom ? 'In the room' : null].filter(Boolean).join(' · ');
  },

  /** A collection is what a reader recognises; "By Manner" is how it is filed. */
  _stagePoolLabel(world) {
    const pool = this._stagePool(world);
    return poolOptions(world.id).find(option => option.id === pool)?.label || null;
  },

  _stageName(world) {
    return (world?.pool && this._stagePoolLabel(world)) || world?.label || '';
  },

  _stageCanBlend(world) {
    if (this.mode === 'pick' || !world || world.category !== FIELD.GALLERY) return false;
    if (this.selection.enabled.has(world.id)) return false;
    return [...this.selection.enabled].some(id => categoryOf(id) === FIELD.GALLERY);
  },

  renderStage() {
    const world = this._stageWorld();
    const face = this.textMaterialSettings().face;
    const sheet = this.stage.sheet;
    const stillUrl = safeUrl(stillQueue.cached(this._stageStillKey(world)) || '');
    const owned = Boolean(this.programInfo) && this.mode !== 'pick';
    const sample = sampleLine(this.getSampleText());
    return `
      <div class="vstage${sheet ? ` has-sheet-${sheet}` : ''}${this.stage.committed ? ' is-committed' : ''}"
        data-mode="${this.mode}">
        <div class="vstage-still${stillUrl ? ' has-still' : ''}" aria-hidden="true"
          ${stillUrl ? `style="background-image:url(&quot;${stillUrl}&quot;)"` : ''}>
          <span class="vstage-still-glyph">${world ? glyphFor(world) : '◈'}</span>
        </div>
        <div class="vstage-live-slot" aria-hidden="true"></div>
        <div class="vstage-scrim" aria-hidden="true"></div>
        <div class="vstage-top">
          <button type="button" class="vstage-icon" data-stage="close" aria-label="Close">✕</button>
          ${this.mode === 'pick' ? '' : `<button type="button" class="vstage-icon vstage-aa" data-stage="text"
            aria-label="Letters" aria-expanded="${sheet === 'text'}">Aa</button>`}
        </div>
        ${sample && this.mode !== 'pick' ? `<p class="vstage-sample${this.glassOn() ? ' has-glass' : ''}"
          data-face-sample="${escapeHtml(face)}">${escapeHtml(sample)}</p>` : ''}
        <div class="vstage-foot">
          <div class="vstage-caption" aria-live="polite">
            <h2 class="vstage-name">${escapeHtml(this._stageName(world))}</h2>
            <p class="vstage-family">${escapeHtml(this._stageStatus(world))}</p>
          </div>
          ${owned ? this._stageProgramNote() : ''}
          ${this._stageRailHtml()}
          <div class="vstage-actions">
            ${this._stageHasVary(world) ? `<button type="button" class="vstage-vary" data-stage="vary"
              aria-expanded="${sheet === 'vary'}">Vary</button>` : '<span></span>'}
            <div class="vstage-commit">
              ${this._stageCanBlend(world) ? '<button type="button" class="vstage-blend" data-stage="blend">Add to blend</button>' : ''}
              <button type="button" class="vstage-choose" data-stage="choose"
                ${owned ? 'disabled aria-disabled="true"' : ''}>Choose</button>
            </div>
          </div>
        </div>
        ${sheet === 'vary' ? this._stageVarySheet(world) : ''}
        ${sheet === 'text' ? this._stageTextSheet() : ''}
        ${this.renderDialog()}
      </div>`;
  },

  _stageProgramNote() {
    return `<div class="vstage-program" data-program-lock role="status">
      This reading brings its own visuals, scene by scene.
      ${this.selection.enabled.has('focal')
        ? '<button type="button" data-action="release-to-program">Release focal</button>' : ''}
    </div>`;
  },

  _stageRailHtml() {
    const rail = this.stageRail();
    const groups = RAIL_FAMILIES
      .map(family => ({ family, worlds: rail.filter(world => world.family === family.id) }))
      .filter(group => group.worlds.length);
    return `<div class="vstage-rail" role="listbox" aria-label="Visuals" aria-orientation="horizontal">
      ${groups.map(({ family, worlds }) => `
        <div class="vstage-family-group" role="group" aria-label="${escapeHtml(family.label)}">
          <span class="vstage-family-label" aria-hidden="true">${escapeHtml(family.label)}</span>
          <div class="vstage-family-tiles">${worlds.map(world => this._stageTile(world)).join('')}</div>
        </div>`).join('')}
    </div>`;
  },

  _stageTile(world) {
    const focused = world.id === this.stage.focusId;
    const url = safeUrl(stillQueue.cached(this._stageStillKey(world)) || '');
    const inRoom = this.mode !== 'pick' && (world.id === 'off'
      ? this.selection.enabled.size === 0 : this.selection.enabled.has(world.id));
    return `<button type="button" class="vstage-tile${focused ? ' is-focused' : ''}${inRoom ? ' is-in-room' : ''}"
      role="option" aria-selected="${focused}" tabindex="${focused ? '0' : '-1'}"
      data-world="${escapeHtml(world.id)}">
      <span class="vstage-tile-art${url ? ' has-still' : ''}" aria-hidden="true"
        ${url ? `style="background-image:url(&quot;${url}&quot;)"` : ''}>${glyphFor(world)}</span>
      <span class="vstage-tile-name">${escapeHtml(world.label)}</span>
    </button>`;
  },

  _stageChip(label, on, attr) {
    return `<button type="button" class="vstage-chip${on ? ' is-on' : ''}" aria-pressed="${on}" ${attr}>${escapeHtml(label)}</button>`;
  },

  _stageBench(label, chips) {
    return `<div class="vstage-bench"><span class="vstage-bench-label">${escapeHtml(label)}</span>
      <div class="vstage-chips">${chips.join('')}</div></div>`;
  },

  _stageVarySheet(world) {
    if (!world) return '';
    const benches = [];
    if (world.id === 'focal') {
      const style = { ...this.selection.style.focal, ...(this.stage.staged.style.focal || {}) };
      const personal = style.type === 'personal';
      benches.push(this._stageBench('Glyph', FOCAL_GLYPHS.map(glyph => this._stageChip(
        glyph.icon || glyph.id, !personal && style.glyph === glyph.id,
        `data-stage-glyph="${escapeHtml(glyph.id)}" aria-label="${escapeHtml(glyph.name || glyph.id)}"`))));
      if (this.mode !== 'pick') {
        benches.push(this._stageBench('Your image', [
          this._stageChip(this.selection.config.focals?.personalImage ? 'Your image' : 'Upload an image',
            personal, 'data-stage-focal-type="personal"'),
          `<input type="file" accept="image/*" hidden data-input="personal-focal">`
        ]));
      }
    }
    if (world.engineId) {
      const style = this._stageStyle(world.engineId);
      for (const bench of substylesFor(world.engineId)) {
        benches.push(this._stageBench(bench.label, bench.options.map(option => this._stageChip(
          optLabel(option), style[bench.key] === optId(option),
          `data-stage-sub="${escapeHtml(bench.key)}" data-val="${escapeHtml(optId(option))}"`))));
      }
    }
    if (world.pool) {
      const options = [...poolOptions(world.id)];
      if (world.id === 'personal') {
        options.push(...MemoryCore.getWorkshopBlueprints()
          .filter(project => Array.isArray(project.customVisuals) && project.customVisuals.length > 0)
          .map(project => ({ id: `personal:${project.id}`, label: `${project.title || 'Untitled sequence'} images` })));
      }
      const current = this._stagePool(world);
      benches.push(this._stageBench('Collection', options.map(option => this._stageChip(
        option.label, current === option.id, `data-stage-pool="${escapeHtml(option.id)}"`))));
      if (world.id === 'personal') {
        benches.push('<button type="button" class="vstage-manage" data-action="open-personal">Manage uploads</button>');
      }
    }
    if (world.category === FIELD.GALLERY && this.mode !== 'pick') {
      benches.push(this._stageBench('Pace of change', [
        ['0', 'Slow'], ['0.5', 'Measured'], ['1', 'Quick']
      ].map(([value, label]) => this._stageChip(label, this.selection.galleryCadence === Number(value),
        `data-gallery-cadence="${value}"`))));
    }
    return `<section class="vstage-sheet vstage-sheet-vary" role="dialog" aria-modal="true"
      aria-label="Vary ${escapeHtml(world.label)}">
      <button type="button" class="vstage-sheet-handle" data-stage="sheet-close" aria-label="Close">
        <span aria-hidden="true"></span></button>
      <div class="vstage-sheet-head"><h3 class="vstage-sheet-title">${escapeHtml(world.label)}</h3>
        <button type="button" class="vstage-sheet-done" data-stage="sheet-close">Done</button></div>
      ${benches.join('')}
    </section>`;
  },

  _stageTextSheet() {
    const wasOpen = this._readerSheetOpen;
    this._readerSheetOpen = true;
    const readerControls = this.renderReaderControls();
    this._readerSheetOpen = wasOpen;
    return `<section class="vstage-sheet vstage-sheet-text" role="dialog" aria-modal="true" aria-label="Letters">
      <button type="button" class="vstage-sheet-handle" data-stage="sheet-close" aria-label="Close">
        <span aria-hidden="true"></span></button>
      <div class="vstage-sheet-head"><h3 class="vstage-sheet-title">Letters</h3>
        <button type="button" class="vstage-sheet-done" data-stage="sheet-close">Done</button></div>
      ${this._renderSpecimen()}
      <div class="vnav-type-sections" data-active-section="face">
        ${this._faceSection(true)}
        ${this._sizeSection(true)}
        ${this._inkSection(true)}
      </div>
      ${readerControls}
    </section>`;
  },

  renderStageGate() {
    return `<div class="vstage vstage-gated">
      <div class="vstage-top"><button type="button" class="vstage-icon" data-stage="close" aria-label="Close">✕</button></div>
      ${this.renderGate()}
    </div>`;
  },

  attachStage() {
    const root = this.container.querySelector('.vstage');
    if (!root) return;
    root.querySelectorAll('[data-stage]').forEach(button => {
      button.onclick = event => this._stageAction(button.dataset.stage, event);
    });
    root.querySelectorAll('.vstage-tile').forEach(tile => {
      tile.onclick = () => {
        if (tile.dataset.world === this.stage.focusId) this.stageChoose();
        else this.stageFocus(tile.dataset.world, { reveal: false });
      };
    });
    const rail = root.querySelector('.vstage-rail');
    rail?.addEventListener('keydown', event => this._stageRailKey(event));
    root.querySelectorAll('[data-stage-sub]').forEach(chip => {
      chip.onclick = () => this._stageStage('style', chip.dataset.stageSub, chip.dataset.val);
    });
    root.querySelectorAll('[data-stage-glyph]').forEach(chip => {
      chip.onclick = () => this._stageStage('glyph', null, chip.dataset.stageGlyph);
    });
    root.querySelectorAll('[data-stage-pool]').forEach(chip => {
      chip.onclick = () => this._stageStage('pool', null, chip.dataset.stagePool);
    });
    root.querySelector('[data-stage-focal-type="personal"]')?.addEventListener('click', () => {
      if (this.selection.config.focals?.personalImage) this._stageStage('focal-type', null, 'personal');
      else root.querySelector('[data-input="personal-focal"]')?.click();
    });
    root.querySelector('.vstage-sheet')?.addEventListener('keydown', event => {
      if (event.key !== 'Escape') return;
      // Spent here: whoever hosts the stage must not also close it.
      event.preventDefault();
      this.stageOpenSheet(null);
    });
    this._stageAttachGestures(root);
  },

  _stageAction(action, event) {
    if (action === 'close') return this.stageClose();
    if (action === 'choose') return this.stageChoose();
    if (action === 'blend') return this.stageChoose({ blend: true });
    if (action === 'vary') return this.stageOpenSheet(this.stage.sheet === 'vary' ? null : 'vary', event?.currentTarget);
    if (action === 'text') return this.stageOpenSheet(this.stage.sheet === 'text' ? null : 'text', event?.currentTarget);
    if (action === 'sheet-close') return this.stageOpenSheet(null);
    return undefined;
  },

  _stageRailKey(event) {
    const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (step) {
      event.preventDefault();
      this.stageFocus(railNeighbour(this.stageRail(), this.stage.focusId, step), { focusTile: true });
    } else if (event.key === 'Home' || event.key === 'End') {
      event.preventDefault();
      const rail = this.stageRail();
      this.stageFocus((event.key === 'Home' ? rail[0] : rail.at(-1))?.id, { focusTile: true });
    } else if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      this.stageChoose();
    }
  },

  stageFocus(id, { reveal = true, focusTile = false } = {}) {
    if (!id || !this._stageWorld(id) || this.stage.committed) return;
    if (id === this.stage.focusId && !focusTile) return;
    const rail = this.container.querySelector('.vstage-rail');
    const scroll = rail?.scrollLeft ?? 0;
    this.stage.focusId = id;
    if (this.stage.sheet === 'vary' && !this._stageHasVary(this._stageWorld(id))) this.stage.sheet = null;
    this.render();
    const next = this.container.querySelector('.vstage-rail');
    if (next) next.scrollLeft = scroll;
    if (reveal || focusTile) this._stageRevealFocus(reducedMotion() ? 'auto' : 'smooth');
    if (focusTile) {
      this.container.querySelector('.vstage-tile.is-focused')?.focus({ preventScroll: true });
    }
  },

  _stageRevealFocus(behavior) {
    const tile = this.container.querySelector('.vstage-tile.is-focused');
    tile?.scrollIntoView?.({ inline: 'center', block: 'nearest', behavior });
  },

  _stageStage(kind, key, value) {
    const world = this._stageWorld();
    if (!world) return;
    const staged = this.stage.staged;
    if (kind === 'style' && world.engineId) {
      const bucket = this._stageBucket(world.engineId);
      staged.style[bucket] = { ...(staged.style[bucket] || {}), [key]: value };
    } else if (kind === 'glyph') {
      staged.style.focal = { ...(staged.style.focal || {}), type: 'standard', glyph: value };
    } else if (kind === 'focal-type') {
      staged.style.focal = { ...(staged.style.focal || {}), type: value };
    } else if (kind === 'pool') {
      staged.pool[world.id] = value;
    }
    this.render();
  },

  stageOpenSheet(sheet, opener = null) {
    this._stageSheetOpener = sheet ? opener : null;
    const returnTo = this.stage.sheet && !sheet ? this.stage.sheet : null;
    this.stage.sheet = sheet;
    if (sheet) this._liveStage?.suspend('sheet');
    else this._liveStage?.resume('sheet');
    this.render();
    if (sheet) {
      this.container.querySelector('.vstage-sheet .vstage-chip, .vstage-sheet button:not(.vstage-sheet-handle)')
        ?.focus({ preventScroll: true });
    } else if (returnTo) {
      this.container.querySelector(`[data-stage="${returnTo}"]`)?.focus({ preventScroll: true });
    }
  },

  _applyStaged(world) {
    const staged = this.stage.staged;
    if (world.engineId) {
      const bucket = this._stageBucket(world.engineId);
      if (staged.style[bucket]) {
        this.selection.style[bucket] = { ...this.selection.style[bucket], ...staged.style[bucket] };
      }
    }
    if (world.id === 'focal' && staged.style.focal) {
      this.selection.style.focal = { ...this.selection.style.focal, ...staged.style.focal };
      this.selection.focalDirty = true;
    }
    if (world.pool) {
      const pool = this._stagePool(world);
      if (pool) this.selection.pool = { ...this.selection.pool, [world.id]: pool };
    }
  },

  stageChoose({ blend = false } = {}) {
    const world = this._stageWorld();
    if (!world || this.stage.committed || this.locked) return;
    if (this.mode === 'pick') {
      const style = world.engineId ? this._stageStyle(world.engineId)
        : world.id === 'focal' ? { ...this.selection.style.focal, ...(this.stage.staged.style.focal || {}) }
          : {};
      this.onPick({ leafId: world.id, style, pool: world.pool ? this._stagePool(world) : null });
      this._stageCommitted();
      return;
    }
    if (this.programInfo) return;
    this._applyStaged(world);
    const enabled = blend
      ? toggleField(this.selection.enabled, world.id)
      : chooseField(this.selection.enabled, world.id);
    if (!this.selection.enabled.has(world.id) && world.id !== 'off' && this.fitHoldsTheWord()) {
      const probe = { ...this.selection, enabled, emptyKind: enabled.size ? 'leaves' : 'off' };
      if (!this._fieldPresentsGallery(probe)) {
        this.confirmFitRelease(leafById(world.id));
        return;
      }
    }
    if (world.id === 'focal') this.selection.focalDirty = true;
    this.selection.enabled = enabled;
    this.selection.emptyKind = enabled.size ? 'leaves' : 'off';
    this.emit();
    this._stageCommitted();
  },

  /** The chrome leaves, the choice holds a moment, and the panel closes. */
  _stageCommitted() {
    if (this.presentation !== 'stage') return;
    this.stage.committed = true;
    this.stage.sheet = null;
    this.render();
    clearTimeout(this._stageHoldTimer);
    if (reducedMotion()) {
      this.stageClose();
      return;
    }
    this._stageHoldTimer = setTimeout(() => this.stageClose(), STAGE_HOLD_MS);
  },

  stageClose() {
    clearTimeout(this._stageHoldTimer);
    this._liveStage?.suspend('closed');
    this.onClose();
  },

  _stageAttachGestures(root) {
    let start = null;
    root.addEventListener('pointerdown', event => {
      const onSheetGrip = event.target.closest('.vstage-sheet-handle, .vstage-sheet-title');
      if (!onSheetGrip && event.target.closest('.vstage-rail, .vstage-actions, .vstage-sheet, .vstage-top, [role="dialog"]')) return;
      const width = root.clientWidth || window.innerWidth || 0;
      if (event.clientX < EDGE_GUARD_PX || (width && event.clientX > width - EDGE_GUARD_PX)) return;
      start = { x: event.clientX, y: event.clientY, id: event.pointerId };
    });
    root.addEventListener('pointerup', event => {
      if (!start || event.pointerId !== start.id) return;
      const dx = event.clientX - start.x;
      const dy = event.clientY - start.y;
      start = null;
      if (Math.abs(dx) >= SWIPE_CLAIM_PX && Math.abs(dx) > Math.abs(dy)) {
        this.stageFocus(railNeighbour(this.stageRail(), this.stage.focusId, dx < 0 ? 1 : -1));
      } else if (Math.abs(dy) >= SWIPE_VERTICAL_PX && Math.abs(dy) > Math.abs(dx)) {
        if (dy < 0 && this._stageHasVary(this._stageWorld())) this.stageOpenSheet('vary');
        else if (dy > 0) {
          if (this.stage.sheet) this.stageOpenSheet(null);
          else this.stageClose();
        }
      }
    });
    root.addEventListener('pointercancel', () => { start = null; });
  }
};
