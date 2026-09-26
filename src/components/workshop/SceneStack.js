/**
 * The phone Workshop: a sequence is a stack of scenes.
 *
 * THIS IS A VIEW. It owns what is on screen (which scene is open, which sheet,
 * a draft being written) and nothing about the sequence: every change goes
 * through `api`, which is the Workshop, which goes through workshop-scenes.js.
 * So there is one draft, one history, one preview path, one Vault — the phone
 * and the desk differ only in what they show.
 *
 * Its controls carry `data-sa`, never `data-action`: the Workshop delegates
 * `data-action` clicks on its container, and a scene control must not be
 * mistaken for a studio one.
 */
import { escapeHtml, safeUrl } from '../../core/sanitize.js';
import { stillQueue } from '../visual-navigator/preview.js';
import './scene-stack.css';

export const PACE_MIN = 120;
export const PACE_MAX = 400;
export const PACE_SNAPS = Object.freeze([160, 200, 260, 320]);
export const DIVIDE_OFFER_WORDS = 400;
const SNAP_WITHIN = 8;
const LONG_PRESS_MS = 250;
const SCENE_VIEW_CHARS = 6000;

export function snapPace(value) {
  const wpm = Math.max(PACE_MIN, Math.min(PACE_MAX, Math.round(Number(value) || 200)));
  const near = PACE_SNAPS.find(snap => Math.abs(snap - wpm) <= SNAP_WITHIN);
  return near ?? wpm;
}

const ENGINE_OF_ASSET = Object.freeze({
  'surface:attractor': 'attractor',
  'surface:genesis': 'klee'
});

const GLYPH_OF_ASSET = Object.freeze({
  'surface:off': '○',
  'surface:focal': '◯',
  'surface:attractor': '∮',
  'surface:genesis': '✎'
});

/** A still for a scene's visual, from the same queue the navigator uses. */
function stillRequest(assetId) {
  if (typeof assetId !== 'string') return null;
  const engine = ENGINE_OF_ASSET[assetId] || (assetId.startsWith('procedural:') ? assetId.slice(11) : null);
  if (engine) {
    return {
      key: engine,
      serial: true,
      load: async () => {
        const { visualCortex } = await import('../../visuals/visual-cortex.js');
        return (await visualCortex.renderLeafStill(engine))?.url;
      }
    };
  }
  if (assetId.startsWith('collection:')) {
    const collection = assetId.slice(11);
    return {
      key: collection,
      serial: false,
      load: async () => {
        const { visualCortex } = await import('../../visuals/visual-cortex.js');
        const works = await visualCortex.resolveCollectionWorks(collection, { limit: 1 });
        const work = Array.isArray(works) ? works[0] : null;
        return work?.data?.url || work?.url || null;
      }
    };
  }
  return null;
}

export class SceneStack {
  constructor(host, api, options = {}) {
    this.host = host;
    this.api = api;
    this.Picker = options.Picker || null;
    this.loadPicker = options.loadPicker || (async () => (await import('../VisualNavigator.js')).VisualNavigator);
    this.view = 'stack';
    this.sceneId = null;
    this.sheet = null;
    this.sheetData = null;
    this.draft = '';
    this.sceneDraft = null;
    this.error = null;
    this.picker = null;
    this._returnFocus = null;
    this._drag = null;
    this._destroyed = false;
    this._onClick = event => this.handleClick(event);
    this._onKey = event => this.handleKey(event);
    this._onInput = event => this.handleInput(event);
    this._onPointerDown = event => this.handlePointerDown(event);
    host.addEventListener('click', this._onClick);
    host.addEventListener('keydown', this._onKey);
    host.addEventListener('input', this._onInput);
    host.addEventListener('pointerdown', this._onPointerDown);
    this.render();
  }

  /* ─── state ─────────────────────────────────────────────────────────── */

  scenes() {
    return this.api.scenes();
  }

  openScene(id) {
    const scene = this.scenes().find(item => item.id === id);
    if (!scene) return;
    this.view = 'scene';
    this.sceneId = id;
    this.sceneDraft = null;
    this.error = null;
    this.sheet = null;
    this.render();
    this.focusFirst('.scene-view [data-sa="close-scene"]');
  }

  closeScene() {
    if (!this.commitSceneDraft()) return;
    const id = this.sceneId;
    this.view = 'stack';
    this.sceneId = null;
    this.render();
    this.focusFirst(`.scene-card[data-scene-id="${cssId(id)}"] .scene-card-open`);
  }

  /** A written scene's words are saved when the author leaves them. */
  commitSceneDraft() {
    if (this.sceneDraft == null) return true;
    const scene = this.scenes().find(item => item.id === this.sceneId);
    if (!scene?.editable) {
      this.sceneDraft = null;
      return true;
    }
    const result = this.api.editScene(this.sceneId, this.sceneDraft);
    if (result && result.ok === false) {
      this.error = result.message;
      this.render();
      return false;
    }
    this.sceneDraft = null;
    return true;
  }

  openSheet(sheet, data = null, opener = null) {
    this._returnFocus = opener ? focusKeyOf(opener) : this._returnFocus;
    this.sheet = sheet;
    this.sheetData = data;
    this.error = null;
    this.render();
    if (sheet === 'visual') {
      void this.mountPicker();
      return;
    }
    this.focusFirst('.scene-sheet textarea, .scene-sheet [data-sheet-focus], .scene-sheet button:not(.scene-sheet-handle)');
  }

  closeSheet() {
    this.picker?.destroy();
    this.picker = null;
    this.sheet = null;
    this.sheetData = null;
    this.error = null;
    this.render();
    const key = this._returnFocus;
    this._returnFocus = null;
    if (key) this.focusFirst(key);
  }

  refresh() {
    if (this._destroyed) return;
    // The sequence changed underneath; a picker open over it keeps its place.
    if (this.sheet === 'visual' && this.picker) return;
    // Typing a title or dragging the pace changes the draft, and the draft
    // asks for a refresh. Rebuilding would take the field from the author
    // mid-gesture; the sheet redraws when it closes.
    const active = this.host.ownerDocument?.activeElement;
    if (active && this.host.contains(active) && active.matches('input, textarea, select')) return;
    if (this.view === 'scene' && !this.scenes().some(scene => scene.id === this.sceneId)) {
      this.view = 'stack';
      this.sceneId = null;
      this.sceneDraft = null;
    }
    this.render();
  }

  focusFirst(selector) {
    requestAnimationFrame(() => this.host.querySelector(selector)?.focus?.({ preventScroll: true }));
  }

  /* ─── render ────────────────────────────────────────────────────────── */

  render() {
    if (this._destroyed) return;
    const list = this.host.querySelector('.scenes-list');
    const scroll = list?.scrollTop ?? 0;
    const scenes = this.scenes();
    this.host.innerHTML = `
      <div class="scenes" data-view="${this.view}">
        ${this.renderBar()}
        <main class="scenes-list" aria-label="Scenes">
          ${scenes.length ? scenes.map(scene => this.renderCard(scene, scenes.length)).join('') : this.renderEmpty()}
        </main>
        ${this.renderThumb(scenes.length)}
        ${this.view === 'scene' ? this.renderSceneView(scenes) : ''}
        ${this.sheet ? this.renderSheet() : ''}
        <div class="sr-only" role="status" aria-live="polite" data-scenes-status></div>
      </div>`;
    const next = this.host.querySelector('.scenes-list');
    if (next) next.scrollTop = scroll;
    this.paintStills();
  }

  renderBar() {
    const dirty = this.api.dirty();
    return `<header class="scenes-bar">
      <button type="button" class="scenes-icon" data-sa="back" aria-label="Back to the Portal">←</button>
      <button type="button" class="scenes-title" data-sa="more" aria-haspopup="dialog">
        <span>${escapeHtml(this.api.title() || 'Untitled sequence')}</span>
        ${dirty ? '<i class="scenes-dirty" aria-label="Unsaved changes"></i>' : ''}
      </button>
      <button type="button" class="scenes-icon" data-sa="more" aria-label="Sequence menu" aria-haspopup="dialog">⋯</button>
    </header>`;
  }

  renderEmpty() {
    return `<section class="scenes-empty">
      <p class="scenes-empty-kicker">A new sequence</p>
      <button type="button" class="scenes-empty-primary" data-sa="write">Write the first scene</button>
      <button type="button" class="scenes-empty-secondary" data-sa="library">From the Library</button>
      <button type="button" class="scenes-empty-secondary" data-sa="file">From a file</button>
    </section>`;
  }

  /** What the sequence itself shows and plays, where a scene sets nothing. */
  sequenceDefaults() {
    return this.api.sequence?.() || { visual: false, sound: false };
  }

  renderCard(scene, total) {
    const number = String(scene.index + 1).padStart(2, '0');
    const label = `Scene ${scene.index + 1} of ${total}`;
    const sequence = this.sequenceDefaults();
    // A scene with no picture of its own is a text card, not an empty frame.
    const bare = !scene.visual;
    const unset = !scene.visual && !scene.sound && !sequence.visual && !sequence.sound;
    return `<article class="scene-card${bare ? ' is-bare' : ''}" data-scene-id="${escapeHtml(scene.id)}">
      <button type="button" class="scene-card-open" data-sa="open-scene" data-scene-id="${escapeHtml(scene.id)}"
        aria-label="${escapeHtml(`${label}: ${scene.name}`)}">
        ${bare ? '' : `<span class="scene-card-art" data-still-for="${escapeHtml(scene.visual.assetId || '')}" aria-hidden="true">
          <span class="scene-card-glyph">${escapeHtml(GLYPH_OF_ASSET[scene.visual.assetId] || '')}</span>
        </span>`}
        <span class="scene-card-num" aria-hidden="true">${number}</span>
        <span class="scene-card-text">${escapeHtml(scene.excerpt)}</span>
        ${unset ? '<span class="scene-card-invite">Tap to set visual &amp; sound</span>' : ''}
      </button>
      <div class="scene-card-meta">
        <span class="scene-card-lanes">
          ${unset ? '' : `<span>◈ ${escapeHtml(describeVisual(scene, sequence))}</span>
          <span>♪ ${escapeHtml(describeSound(scene, sequence))}</span>`}
        </span>
        <button type="button" class="scene-card-btn scene-card-handle" data-sa="drag" data-scene-id="${escapeHtml(scene.id)}"
          aria-label="${escapeHtml(`Edit ${label}. Hold to reorder.`)}">≡</button>
        <button type="button" class="scene-card-btn" data-sa="card-more" data-scene-id="${escapeHtml(scene.id)}"
          aria-label="${escapeHtml(`More for ${label}`)}" aria-haspopup="dialog">⋯</button>
        <button type="button" class="scene-card-btn scene-card-play" data-sa="play-scene" data-scene-id="${escapeHtml(scene.id)}"
          aria-label="${escapeHtml(`Play ${label}`)}">▶</button>
      </div>
    </article>`;
  }

  renderThumb(count) {
    const pace = this.api.pace();
    return `<footer class="scenes-thumb">
      <button type="button" class="scenes-pace" data-sa="pace" aria-haspopup="dialog">
        <strong>${escapeHtml(String(pace.wpm))}</strong><span>wpm</span>
      </button>
      <button type="button" class="scenes-play" data-sa="play-all" ${count ? '' : 'disabled'}>▶ Play</button>
      <button type="button" class="scenes-add" data-sa="add" aria-haspopup="dialog">+ Scene</button>
    </footer>`;
  }

  renderSceneView(scenes) {
    const scene = scenes.find(item => item.id === this.sceneId);
    if (!scene) return '';
    const text = this.api.sceneText(scene.id);
    const words = this.sceneDraft ?? text;
    const body = scene.editable
      ? `<textarea class="scene-view-editor" data-scene-editor aria-label="Words of this scene"
          spellcheck="true">${escapeHtml(words)}</textarea>`
      : `<div class="scene-view-reading" tabindex="0" aria-label="Words of this scene">${escapeHtml(text.slice(0, SCENE_VIEW_CHARS))}${text.length > SCENE_VIEW_CHARS ? '…' : ''}</div>
         <p class="scene-view-note">${escapeHtml(scene.written
            ? 'This scene has passage visuals from the full studio. Its words stay as they are.'
            : 'Words from the Library are read as they were published.')}</p>`;
    return `<section class="scene-view" role="dialog" aria-modal="true"
        aria-label="${escapeHtml(`Scene ${scene.index + 1}: ${scene.name}`)}">
      <span class="scene-view-art" data-still-for="${escapeHtml(scene.visual?.assetId || '')}" aria-hidden="true"></span>
      <header class="scene-view-bar">
        <button type="button" class="scenes-icon" data-sa="close-scene" aria-label="Back to all scenes">←</button>
        <span class="scene-view-count">Scene ${scene.index + 1} of ${scenes.length}</span>
        <span></span>
      </header>
      <div class="scene-view-words">${body}
        ${this.error ? `<p class="scene-error" role="alert">${escapeHtml(this.error)}</p>` : ''}</div>
      <footer class="scene-view-foot">
        <button type="button" class="scene-lane" data-sa="visual" data-scene-id="${escapeHtml(scene.id)}" aria-haspopup="dialog">
          <span class="scene-lane-kicker">Visual</span><strong>${escapeHtml(describeVisual(scene, this.sequenceDefaults()))}</strong></button>
        <button type="button" class="scene-lane" data-sa="sound" data-scene-id="${escapeHtml(scene.id)}" aria-haspopup="dialog">
          <span class="scene-lane-kicker">Sound</span><strong>${escapeHtml(describeSound(scene, this.sequenceDefaults()))}</strong></button>
        <button type="button" class="scenes-play scene-view-play" data-sa="play-scene" data-scene-id="${escapeHtml(scene.id)}">▶ Play</button>
      </footer>
    </section>`;
  }

  renderSheet() {
    const body = {
      add: () => this.renderAddSheet(),
      write: () => this.renderWriteSheet(),
      visual: () => '<div class="scene-picker-host" data-picker-host></div>',
      sound: () => this.renderSoundSheet(),
      pace: () => this.renderPaceSheet(),
      more: () => this.renderMoreSheet(),
      'card-more': () => this.renderCardSheet(),
      confirm: () => this.renderConfirmSheet()
    }[this.sheet]?.() || '';
    const full = ['write', 'visual'].includes(this.sheet);
    return `<div class="scene-sheet-backdrop" data-sa="sheet-backdrop"></div>
      <section class="scene-sheet${full ? ' is-full' : ''}" data-sheet="${escapeHtml(this.sheet)}"
        role="dialog" aria-modal="true" aria-label="${escapeHtml(SHEET_LABEL[this.sheet] || '')}">
        ${full ? '' : '<button type="button" class="scene-sheet-handle" data-sa="close-sheet" aria-label="Close"><span aria-hidden="true"></span></button>'}
        ${body}
      </section>`;
  }

  renderAddSheet() {
    return `<h2 class="scene-sheet-title">Add a scene</h2>
      <div class="scene-sheet-list">
        <button type="button" class="scene-sheet-row" data-sa="write" data-sheet-focus>
          <strong>Write</strong><span>Type or paste the words.</span></button>
        <button type="button" class="scene-sheet-row" data-sa="library">
          <strong>From the Library</strong><span>A chapter or a whole work.</span></button>
        <button type="button" class="scene-sheet-row" data-sa="file">
          <strong>From a file</strong><span>A .txt or .md from this device.</span></button>
      </div>`;
  }

  renderWriteSheet() {
    const words = this.draft.split(/\s+/).filter(Boolean).length;
    return `<header class="scene-write-bar">
        <button type="button" class="scene-text-btn" data-sa="close-sheet">Cancel</button>
        <span class="scene-write-count" data-write-count>${words} ${words === 1 ? 'word' : 'words'}</span>
        <button type="button" class="scene-text-btn is-primary" data-sa="write-done">Done</button>
      </header>
      <textarea class="scene-write" data-write-draft aria-label="The words of the new scene"
        placeholder="Write, or paste, the words of this scene.">${escapeHtml(this.draft)}</textarea>
      ${this.error ? `<p class="scene-error" role="alert">${escapeHtml(this.error)}</p>` : ''}
      <div class="scene-write-divide" data-write-divide ${words > DIVIDE_OFFER_WORDS ? '' : 'hidden'}>
        <p>That is a long passage. It can become several scenes.</p>
        <button type="button" class="scene-text-btn" data-sa="write-divide">Divide into scenes</button>
      </div>`;
  }

  renderSoundSheet() {
    const scene = this.scenes().find(item => item.id === this.sheetData?.sceneId);
    const current = scene?.sound?.whole ? scene.sound.assetId : null;
    const options = this.api.soundOptions();
    const row = (id, name, detail) => `<button type="button" class="scene-sheet-row scene-choice${(current || null) === id ? ' is-on' : ''}"
        data-sa="choose-sound" data-sound-id="${escapeHtml(id || '')}" aria-pressed="${(current || null) === id}">
        <strong>${escapeHtml(name)}</strong>${detail ? `<span>${escapeHtml(detail)}</span>` : ''}</button>`;
    return `<h2 class="scene-sheet-title">Sound</h2>
      ${scene?.sound && !scene.sound.whole ? `<p class="scene-sheet-note">This scene has ${scene.sound.passages} passage sounds from the full studio. Choosing here replaces them.</p>` : ''}
      <div class="scene-sheet-list">
        ${this.sequenceDefaults().sound
          ? row(null, 'Same as the sequence', 'Whatever plays under the whole reading.')
          : row(null, 'No sound', 'This scene is read in silence.')}
        ${options.map(option => row(option.id, option.name, option.detail)).join('')}
      </div>`;
  }

  renderPaceSheet() {
    const pace = this.api.pace();
    return `<h2 class="scene-sheet-title">Pace</h2>
      <label class="scene-pace">
        <span class="scene-pace-value"><strong data-pace-value>${pace.wpm}</strong> words a minute</span>
        <input type="range" min="${PACE_MIN}" max="${PACE_MAX}" step="1" value="${pace.wpm}"
          data-pace-slider data-sheet-focus list="scene-pace-snaps" aria-label="Words a minute">
        <datalist id="scene-pace-snaps">${PACE_SNAPS.map(value => `<option value="${value}"></option>`).join('')}</datalist>
        <span class="scene-pace-ends" aria-hidden="true"><span>Slow</span><span>Quick</span></span>
      </label>
      <div class="scene-seg" role="group" aria-label="How the words arrive">
        ${[['word', 'A word at a time'], ['phrase', 'A phrase at a time']].map(([value, label]) => `
          <button type="button" class="scene-seg-btn${pace.chunkMode === value ? ' is-on' : ''}"
            data-sa="chunk" data-chunk="${value}" aria-pressed="${pace.chunkMode === value}">${label}</button>`).join('')}
      </div>`;
  }

  renderMoreSheet() {
    const sequences = this.api.sequences();
    return `<label class="scene-rename"><span class="scene-sheet-kicker">Title</span>
        <input type="text" class="scene-rename-input" data-rename maxlength="120" data-sheet-focus
          value="${escapeHtml(this.api.title())}" placeholder="Untitled sequence"></label>
      <div class="scene-sheet-list">
        <button type="button" class="scene-sheet-row" data-sa="save"><strong>Save</strong><span>Keep it in the Vault.</span></button>
        <button type="button" class="scene-sheet-row" data-sa="export"><strong>Export the score</strong><span>Words from the Library travel with it; words written here stay on this device.</span></button>
        <button type="button" class="scene-sheet-row" data-sa="import"><strong>Import a score</strong><span>Open a score file.</span></button>
        <button type="button" class="scene-sheet-row" data-sa="studio"><strong>Full studio</strong><span>Score passages, presentation and media, as on a desk.</span></button>
        ${sequences.length ? `<p class="scene-sheet-kicker">Open another</p>
          ${sequences.map(item => `<button type="button" class="scene-sheet-row" data-sa="open-sequence"
            data-sequence-id="${escapeHtml(item.id)}"><strong>${escapeHtml(item.title)}</strong></button>`).join('')}` : ''}
        <button type="button" class="scene-sheet-row is-quiet" data-sa="reset"><strong>Start over</strong><span>Clear this sequence.</span></button>
      </div>`;
  }

  renderCardSheet() {
    const scenes = this.scenes();
    const scene = scenes.find(item => item.id === this.sheetData?.sceneId);
    if (!scene) return '';
    return `<h2 class="scene-sheet-title">${escapeHtml(`Scene ${scene.index + 1}`)}</h2>
      <div class="scene-sheet-list">
        <button type="button" class="scene-sheet-row" data-sa="move" data-dir="-1" ${scene.index === 0 ? 'disabled' : ''} data-sheet-focus>
          <strong>Move up</strong></button>
        <button type="button" class="scene-sheet-row" data-sa="move" data-dir="1" ${scene.index === scenes.length - 1 ? 'disabled' : ''}>
          <strong>Move down</strong></button>
        <button type="button" class="scene-sheet-row is-danger" data-sa="remove"><strong>Remove</strong></button>
      </div>`;
  }

  renderConfirmSheet() {
    const confirm = this.sheetData || {};
    return `<h2 class="scene-sheet-title">${escapeHtml(confirm.title || '')}</h2>
      ${confirm.body ? `<p class="scene-sheet-note">${escapeHtml(confirm.body)}</p>` : ''}
      <div class="scene-confirm">
        <button type="button" class="scene-text-btn" data-sa="close-sheet" data-sheet-focus>Keep</button>
        <button type="button" class="scene-text-btn is-danger" data-sa="confirm-yes">${escapeHtml(confirm.label || 'Confirm')}</button>
      </div>`;
  }

  paintStills() {
    for (const el of this.host.querySelectorAll('[data-still-for]')) {
      const request = stillRequest(el.dataset.stillFor);
      if (!request) continue;
      const cached = stillQueue.cached(request.key);
      if (cached) {
        paint(el, cached);
        continue;
      }
      void stillQueue.request(request.key, request.load, { serial: request.serial }).then(url => {
        if (url && el.isConnected) paint(el, url);
      });
    }
  }

  /* ─── picker ────────────────────────────────────────────────────────── */

  async mountPicker() {
    const host = this.host.querySelector('[data-picker-host]');
    if (!host) return;
    const scenes = this.scenes();
    const scene = scenes.find(item => item.id === this.sheetData?.sceneId);
    // A scene with no visual yet opens where the sequence already is, or on
    // the one visual that moves on the stage.
    const before = scene ? scenes.slice(0, scene.index).reverse().find(item => item.visual?.leafId) : null;
    const initialLeafId = scene?.visual?.leafId || before?.visual?.leafId || 'attractor';
    const Picker = this.Picker || await this.loadPicker();
    if (this._destroyed || this.sheet !== 'visual' || !host.isConnected) return;
    this.picker = new Picker(host, {
      mode: 'pick',
      visualConfig: this.api.visualConfig(),
      pickable: this.api.pickableLeaves(),
      initialLeafId,
      onPick: pick => this.chooseVisual(scene?.id, pick),
      onClose: () => this.closeSheet()
    });
  }

  chooseVisual(sceneId, pick) {
    const scene = this.scenes().find(item => item.id === sceneId);
    if (!scene) return;
    const apply = () => {
      const result = this.api.setSceneVisual(sceneId, pick);
      if (result && result.ok === false) this.announce(result.message);
    };
    if (scene.visual && !scene.visual.whole) {
      this.picker?.destroy();
      this.picker = null;
      this.openSheet('confirm', {
        title: `Replace ${scene.visual.passages} passage visuals?`,
        body: 'This scene has passage visuals from the full studio. One visual for the whole scene takes their place.',
        label: 'Replace them',
        action: () => apply()
      });
      return;
    }
    apply();
  }

  announce(message) {
    const status = this.host.querySelector('[data-scenes-status]');
    if (status) status.textContent = message || '';
  }

  /* ─── events ────────────────────────────────────────────────────────── */

  handleClick(event) {
    const target = event.target.closest('[data-sa]');
    if (!target || !this.host.contains(target) || target.disabled) return;
    const action = target.dataset.sa;
    const sceneId = target.dataset.sceneId || this.sheetData?.sceneId || this.sceneId;
    switch (action) {
      case 'back': return this.api.back();
      case 'more': return this.openSheet('more', null, target);
      case 'add': return this.openSheet('add', null, target);
      case 'write':
        this.draft = '';
        return this.openSheet('write', null, this.sheet ? null : target);
      case 'library':
        this.closeSheet();
        return this.api.openLibrary();
      case 'file':
        this.closeSheet();
        return this.api.importFile();
      case 'write-done': return this.finishWriting();
      case 'write-divide': return this.divideWriting();
      case 'open-scene': return this.openScene(sceneId);
      case 'drag':
        // A tap on the handle edits; a hold on it reorders, and the click
        // that ends a hold is not a tap.
        if (this._liftedAt && Date.now() - this._liftedAt < 600) return undefined;
        return this.openScene(sceneId);
      case 'close-scene': return this.closeScene();
      case 'play-scene':
        if (!this.commitSceneDraft()) return undefined;
        return this.api.playScene(sceneId);
      case 'play-all': return this.api.playAll();
      case 'visual':
        if (!this.commitSceneDraft()) return undefined;
        return this.openSheet('visual', { sceneId }, target);
      case 'sound': return this.openSheet('sound', { sceneId }, target);
      case 'choose-sound':
        this.api.setSceneSound(sceneId, target.dataset.soundId || null);
        return this.closeSheet();
      case 'pace': return this.openSheet('pace', null, target);
      case 'chunk':
        this.api.setPace({ chunkMode: target.dataset.chunk });
        return this.render();
      case 'card-more': return this.openSheet('card-more', { sceneId }, target);
      case 'move': {
        const scene = this.scenes().find(item => item.id === sceneId);
        if (scene) this.api.moveScene(scene.index, scene.index + Number(target.dataset.dir));
        return this.closeSheet();
      }
      case 'remove': {
        const scene = this.scenes().find(item => item.id === sceneId);
        return this.openSheet('confirm', {
          sceneId,
          title: `Remove scene ${scene ? scene.index + 1 : ''}?`,
          body: 'Its words, visual and sound leave this sequence.',
          label: 'Remove',
          action: () => this.api.removeScene(sceneId)
        });
      }
      case 'confirm-yes': {
        const act = this.sheetData?.action;
        this._returnFocus = null;
        this.closeSheet();
        act?.();
        return undefined;
      }
      case 'save': this.closeSheet(); return this.api.save();
      case 'export': this.closeSheet(); return this.api.exportJson();
      case 'import': this.closeSheet(); return this.api.importJson();
      case 'studio': this.closeSheet(); return this.api.openStudio();
      case 'open-sequence': this.closeSheet(); return this.api.openSequence(target.dataset.sequenceId);
      case 'reset':
        return this.openSheet('confirm', {
          title: 'Start over?',
          body: 'This sequence is cleared. A saved copy in the Vault is kept.',
          label: 'Start over',
          action: () => this.api.reset()
        });
      case 'close-sheet':
      case 'sheet-backdrop':
        return this.closeSheet();
      default:
        return undefined;
    }
  }

  handleInput(event) {
    if (event.target.matches('[data-write-draft]')) {
      this.draft = event.target.value;
      const words = this.draft.split(/\s+/).filter(Boolean).length;
      const count = this.host.querySelector('[data-write-count]');
      if (count) count.textContent = `${words} ${words === 1 ? 'word' : 'words'}`;
      const divide = this.host.querySelector('[data-write-divide]');
      if (divide) divide.hidden = words <= DIVIDE_OFFER_WORDS;
    } else if (event.target.matches('[data-scene-editor]')) {
      this.sceneDraft = event.target.value;
    } else if (event.target.matches('[data-pace-slider]')) {
      const wpm = snapPace(event.target.value);
      event.target.value = String(wpm);
      const value = this.host.querySelector('[data-pace-value]');
      if (value) value.textContent = String(wpm);
      this.api.setPace({ wpm });
      const chip = this.host.querySelector('.scenes-pace strong');
      if (chip) chip.textContent = String(wpm);
    } else if (event.target.matches('[data-rename]')) {
      this.api.rename(event.target.value);
    }
  }

  handleKey(event) {
    // An Escape the picker already spent (closing its own sheet) is not ours.
    if (event.key !== 'Escape' || event.defaultPrevented) return;
    if (this.sheet) {
      event.preventDefault();
      event.stopPropagation();
      this.closeSheet();
    } else if (this.view === 'scene' && !this.sheet) {
      event.preventDefault();
      event.stopPropagation();
      this.closeScene();
    }
  }

  finishWriting() {
    const result = this.api.addWritten(this.draft);
    if (result && result.ok === false) {
      this.error = result.message;
      this.render();
      this.focusFirst('[data-write-draft]');
      return;
    }
    this.draft = '';
    this._returnFocus = null;
    this.closeSheet();
    this.focusFirst('.scene-card:last-of-type .scene-card-open');
  }

  divideWriting() {
    const text = this.draft;
    this.draft = '';
    this._returnFocus = null;
    this.closeSheet();
    this.api.divideAndAdd(text);
  }

  /* ─── reorder by dragging the handle ────────────────────────────────── */

  handlePointerDown(event) {
    const handle = event.target.closest('[data-sa="drag"]');
    if (!handle || this.view !== 'stack') return;
    const card = handle.closest('.scene-card');
    const scenes = this.scenes();
    const from = scenes.findIndex(scene => scene.id === handle.dataset.sceneId);
    if (!card || from < 0) return;
    const start = event.clientY;
    const height = card.getBoundingClientRect().height || 120;
    const drag = { from, to: from, start, height, card, lifted: false };
    drag.timer = setTimeout(() => {
      drag.lifted = true;
      card.classList.add('is-lifted');
      navigator.vibrate?.(8);
    }, LONG_PRESS_MS);
    const move = moveEvent => {
      if (!drag.lifted) {
        if (Math.abs(moveEvent.clientY - start) > 10) cancel();
        return;
      }
      moveEvent.preventDefault?.();
      const dy = moveEvent.clientY - start;
      card.style.transform = `translateY(${dy}px)`;
      drag.to = Math.max(0, Math.min(scenes.length - 1, from + Math.round(dy / height)));
    };
    const cancel = () => {
      clearTimeout(drag.timer);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      card.classList.remove('is-lifted');
      card.style.transform = '';
      this._drag = null;
    };
    const up = () => {
      const { lifted, to } = drag;
      cancel();
      if (lifted) this._liftedAt = Date.now();
      if (lifted && to !== from) this.api.moveScene(from, to);
    };
    this._drag = drag;
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
  }

  destroy() {
    this._destroyed = true;
    this.picker?.destroy();
    this.host.removeEventListener('click', this._onClick);
    this.host.removeEventListener('keydown', this._onKey);
    this.host.removeEventListener('input', this._onInput);
    this.host.removeEventListener('pointerdown', this._onPointerDown);
    this.host.innerHTML = '';
  }
}

const SHEET_LABEL = Object.freeze({
  add: 'Add a scene',
  write: 'Write a scene',
  visual: 'Choose a visual',
  sound: 'Sound',
  pace: 'Pace',
  more: 'Sequence',
  'card-more': 'Scene',
  confirm: 'Confirm'
});

// "Same as the sequence" is only true when the sequence has one to share.
function describeVisual(scene, sequence = {}) {
  if (!scene.visual) return sequence.visual ? 'Same as the sequence' : 'Choose a visual';
  if (!scene.visual.whole) return `${scene.visual.passages} passage visuals`;
  return scene.visual.name || 'A visual';
}

function describeSound(scene, sequence = {}) {
  if (!scene.sound) return sequence.sound ? 'Same as the sequence' : 'Choose a sound';
  if (!scene.sound.whole) return `${scene.sound.passages} passage sounds`;
  return scene.sound.name || 'A sound';
}

function paint(el, url) {
  const safe = safeUrl(url);
  if (!safe) return;
  el.style.backgroundImage = `url("${safe}")`;
  el.classList.add('has-still');
}

function cssId(id) {
  return String(id).replace(/["\\]/g, '\\$&');
}

function focusKeyOf(el) {
  const action = el?.dataset?.sa;
  if (!action) return null;
  const scene = el.dataset.sceneId ? `[data-scene-id="${cssId(el.dataset.sceneId)}"]` : '';
  return `[data-sa="${action}"]${scene}`;
}
