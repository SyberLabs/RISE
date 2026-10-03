/**
 * Visual Lab: explore, change, save, and reuse Living Flame scenes.
 *
 * The artwork fills the viewport; controls sit in a collapsible side panel
 * (a bottom sheet on phones). The Lab uses the same renderer and recipe
 * boundary as the Chamber and never schedules anything itself: passage
 * assignments belong to the Workshop, scenes belong here.
 */

import { validateFlameRecipe, parseFlameRecipeJson } from '../../core/flame-recipe.js';
import { loadFlameScenes, saveFlameScene } from '../../core/flame-scenes.js';
import { escapeHtml } from '../../core/sanitize.js';
import './VisualLab.css';

const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

export class VisualLab {
  /**
   * @param {HTMLElement} container
   * @param {object} options
   * @param {'route'|'overlay'} [options.mode]
   * @param {object|null} [options.recipe] starting recipe (validated)
   * @param {(recipe: object) => void} [options.onUseInReading]
   * @param {() => void} [options.onEditInWorkshop]
   * @param {() => void} [options.onClose]
   * @param {boolean} [options.embedded] a tab of Make: no Close of its own
   */
  constructor(container, {
    mode = 'route', recipe = null, onUseInReading = null, onEditInWorkshop = null, onClose = null, embedded = false
  } = {}) {
    this.container = container;
    this.embedded = embedded;
    this.mode = mode;
    this.onUseInReading = onUseInReading;
    this.onEditInWorkshop = onEditInWorkshop;
    this.onClose = onClose;
    this.initialRecipe = recipe;
    this.field = null;
    this.module = null;
    this.paused = false;
    this.destroyed = false;
    this.render();
    this.ready = this.mount();
  }

  render() {
    const overlay = this.mode === 'overlay';
    this.container.innerHTML = `
      <div class="visual-lab ${overlay ? 'is-overlay' : ''}" ${overlay ? 'role="dialog" aria-modal="true" aria-label="Visual Lab"' : 'role="main"'}>
        <div class="vl-stage" aria-hidden="true"></div>
        <p class="vl-renderer" id="vl-renderer" role="status"></p>
        <button type="button" class="vl-toggle" aria-expanded="true" aria-controls="vl-panel">Controls</button>
        <aside class="vl-panel" id="vl-panel" aria-label="Scene controls">
          <header class="vl-head">
            <h1 class="vl-title">Visual Lab</h1>
            ${this.embedded ? '' : `<button type="button" class="vl-close" data-vl="close">${overlay ? 'Return to reading' : 'Close'}</button>`}
          </header>
          <label class="vl-field">Composition
            <select name="vl-preset"></select>
          </label>
          <label class="vl-field">Energy <output data-vl-out="energy"></output>
            <input type="range" name="vl-energy" min="0" max="100" step="1" />
          </label>
          <label class="vl-field">Complexity <output data-vl-out="complexity"></output>
            <input type="range" name="vl-complexity" min="0" max="100" step="1" />
          </label>
          <label class="vl-field">Symmetry <output data-vl-out="symmetry"></output>
            <input type="range" name="vl-symmetry" min="1" max="8" step="1" />
          </label>
          <label class="vl-field">Color <output data-vl-out="hue"></output>
            <input type="range" name="vl-hue" min="-180" max="180" step="1" />
          </label>
          <div class="vl-actions">
            <button type="button" data-vl="pause" aria-pressed="false">Pause</button>
            <button type="button" data-vl="mutate">Mutate</button>
            <button type="button" data-vl="undo" disabled>Undo</button>
            <button type="button" data-vl="save">Save</button>
          </div>
          <div class="vl-actions">
            <button type="button" data-vl="export">Export JSON</button>
            <label class="vl-import">Import JSON
              <input type="file" name="vl-import" accept="application/json,.json" />
            </label>
          </div>
          <p class="vl-status" id="vl-status" role="status" aria-live="polite"></p>
          <div class="vl-exits">
            <button type="button" class="vl-primary" data-vl="use">Use in reading</button>
            <button type="button" data-vl="workshop">Edit passage assignments in Workshop</button>
          </div>
        </aside>
      </div>`;
    this.root = this.container.querySelector('.visual-lab');
  }

  async mount() {
    this.module = await import('../../visuals/living-flame/index.js');
    if (this.destroyed) return;
    const { FLAME_PRESETS, RecipeHistory } = this.module;
    this.history = new RecipeHistory(20);
    this.recipe = this.initialRecipe || FLAME_PRESETS[0];
    this.populatePresets();
    this.field = this.module.createLivingFlameField(this.root.querySelector('.vl-stage'), {
      recipe: this.recipe,
      energy: this.recipe.macros.energy,
      reducedMotion: this._reducedMotion(),
      onStatus: status => this.showRenderer(status)
    });
    this.syncControls();
    this.attach();
  }

  _reducedMotion() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true
      || document.documentElement.classList.contains('reduced-motion');
  }

  populatePresets() {
    const select = this.root.querySelector('[name="vl-preset"]');
    const scenes = loadFlameScenes();
    const option = recipe => `<option value="${escapeHtml(recipe.id)}">${escapeHtml(recipe.name)}</option>`;
    select.innerHTML = `
      <optgroup label="Compositions">${this.module.FLAME_PRESETS.map(option).join('')}</optgroup>
      ${scenes.length ? `<optgroup label="Your scenes">${scenes.map(option).join('')}</optgroup>` : ''}
      ${this._isKnown(this.recipe.id) ? '' : `<option value="${escapeHtml(this.recipe.id)}">${escapeHtml(this.recipe.name)}</option>`}`;
    select.value = this.recipe.id;
  }

  _isKnown(id) {
    return this.module.FLAME_PRESET_IDS.includes(id) || loadFlameScenes().some(scene => scene.id === id);
  }

  showRenderer(status) {
    const label = this.root?.querySelector('#vl-renderer');
    if (!label) return;
    label.textContent = status.renderer === 'webgl2'
      ? ''
      : status.renderer === 'cpu'
        ? 'Showing a still: this device could not animate the flame.'
        : 'This device could not draw the flame.';
  }

  syncControls() {
    const { macros, symmetry } = this.recipe;
    const set = (name, value, text) => {
      const input = this.root.querySelector(`[name="vl-${name}"]`);
      if (input) input.value = String(value);
      const out = this.root.querySelector(`[data-vl-out="${name}"]`);
      if (out) out.textContent = text;
    };
    set('energy', Math.round(macros.energy * 100), `${Math.round(macros.energy * 100)}%`);
    set('complexity', Math.round(macros.complexity * 100), `${Math.round(macros.complexity * 100)}%`);
    set('symmetry', symmetry, `${symmetry}`);
    set('hue', Math.round(macros.hue), `${Math.round(macros.hue)}°`);
    this.root.querySelector('[data-vl="undo"]').disabled = !this.history.size;
    const select = this.root.querySelector('[name="vl-preset"]');
    if (select && [...select.options].some(item => item.value === this.recipe.id)) select.value = this.recipe.id;
  }

  status(message) {
    const node = this.root?.querySelector('#vl-status');
    if (node) node.textContent = message;
  }

  /** Replace the scene; a bad candidate never displaces the working one. */
  apply(next, { record = true, transitionMs = 900 } = {}) {
    let recipe;
    try {
      recipe = validateFlameRecipe(next);
    } catch (error) {
      this.status(error.message);
      return false;
    }
    if (record) this.history.push(this.recipe);
    this.recipe = recipe;
    this.field?.setRecipe(recipe, { transitionMs: this._reducedMotion() ? 0 : transitionMs });
    this.field?.setEnergy(recipe.macros.energy);
    this.syncControls();
    return true;
  }

  attach() {
    const root = this.root;
    root.querySelector('.vl-toggle').addEventListener('click', event => {
      const open = root.classList.toggle('panel-collapsed') === false;
      event.currentTarget.setAttribute('aria-expanded', String(open));
    });
    root.querySelector('[name="vl-preset"]').addEventListener('change', event => {
      const id = event.target.value;
      const next = this.module.flamePreset(id) || loadFlameScenes().find(scene => scene.id === id);
      if (next && this.apply(next, { transitionMs: 1200 })) this.status(`${next.name}.`);
    });
    const macro = (name, transform) => root.querySelector(`[name="vl-${name}"]`)
      .addEventListener('input', event => {
        const value = Number(event.target.value);
        this.apply(transform(value), { record: !this._dragging, transitionMs: 0 });
        this._dragging = true;
      });
    macro('energy', value => ({ ...this.recipe, macros: { ...this.recipe.macros, energy: clamp(value / 100, 0, 1) } }));
    macro('complexity', value => ({ ...this.recipe, macros: { ...this.recipe.macros, complexity: clamp(value / 100, 0, 1) } }));
    macro('hue', value => ({ ...this.recipe, macros: { ...this.recipe.macros, hue: clamp(value, -180, 180) } }));
    macro('symmetry', value => ({ ...this.recipe, symmetry: clamp(Math.round(value), 1, 8) }));
    root.querySelectorAll('input[type="range"]').forEach(input => input.addEventListener('change', () => {
      this._dragging = false;
    }));
    root.addEventListener('click', event => {
      const action = event.target.closest?.('[data-vl]')?.dataset.vl;
      if (action) this.act(action, event.target.closest('[data-vl]'));
    });
    root.querySelector('[name="vl-import"]').addEventListener('change', event => this.importFile(event.target));
    // Escape is not handled here: the router owns it and dispatches to the
    // Chamber, which closes an open overlay Lab before anything else.
  }

  act(action, button) {
    if (action === 'close') return this.onClose?.();
    if (action === 'pause') {
      this.paused = !this.paused;
      if (this.paused) this.field?.pause();
      else this.field?.resume();
      button.textContent = this.paused ? 'Play' : 'Pause';
      button.setAttribute('aria-pressed', String(this.paused));
      return;
    }
    if (action === 'mutate') {
      const seed = (Date.now() ^ Math.floor(Math.random() * 0xffffffff)) >>> 0;
      const next = this.module.mutateRecipe(this.recipe, seed);
      if (!next) {
        this.status('No clear variation appeared; the current scene stays.');
        return;
      }
      if (this.apply(next, { transitionMs: 1200 })) this.status('Mutated. Undo returns the previous scene.');
      return;
    }
    if (action === 'undo') {
      const previous = this.history.pop();
      if (previous) this.apply(previous, { record: false, transitionMs: 900 });
      this.syncControls();
      return;
    }
    if (action === 'save') return this.save();
    if (action === 'export') return this.exportJson();
    if (action === 'use') {
      if (this.onUseInReading) this.onUseInReading(this.recipe);
      return;
    }
    if (action === 'workshop') this.onEditInWorkshop?.();
  }

  save() {
    const preset = this.module.FLAME_PRESET_IDS.includes(this.recipe.id);
    const recipe = preset
      ? { ...this.recipe, id: `scene-${Date.now().toString(36)}`, name: `${this.recipe.name} · saved`.slice(0, 64) }
      : this.recipe;
    try {
      saveFlameScene(recipe);
      this.apply(recipe, { record: false, transitionMs: 0 });
      this.populatePresets();
      this.syncControls();
      this.status(`Saved “${recipe.name}” on this device.`);
    } catch (error) {
      this.status(error.message);
    }
  }

  exportJson() {
    const blob = new Blob([JSON.stringify(this.recipe, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${this.recipe.id}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    this.status('Exported the recipe as JSON.');
  }

  async importFile(input) {
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    if (file.size > 64 * 1024) {
      this.status('That file is larger than 64 KB, so it is not a Living Flame recipe.');
      return;
    }
    try {
      const recipe = parseFlameRecipeJson(await file.text());
      if (this.apply(recipe, { transitionMs: 1200 })) {
        this.populatePresets();
        this.syncControls();
        this.status(`Imported “${recipe.name}”.`);
      }
    } catch (error) {
      this.status(`${error.message} The current scene is unchanged.`);
    }
  }

  get currentRecipe() {
    return this.recipe;
  }

  activate() {
    if (!this.paused) this.field?.resume();
  }

  deactivate() {
    this.field?.pause();
  }

  destroy() {
    this.destroyed = true;
    this.field?.destroy();
    this.field = null;
    this.container.innerHTML = '';
  }
}
