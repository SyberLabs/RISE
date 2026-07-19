/**
 * Workshop Component
 * Session building interface
 *
 * Design principles:
 * - Progressive disclosure
 * - Most "app-like" space but still maintains design principles
 * - Generous spacing, no cluttered toolbars
 */

import { VisualInterlocutionPanel } from './VisualInterlocutionPanel.js';
import { SourceBrowser } from './SourceBrowser.js';
import { MemoryCore } from '../core/memory.js';
import { PersonalSwells } from '../core/personal-swells.js';
import { namingModal } from './NamingModal.js';
import { safeUrl } from '../core/sanitize.js';
import { normalizeVisualSelection } from '../core/visual-selection.js';
import { VISUAL_PRESENCE_DEFAULT_MS } from '../core/visual-presence.js';
import './VisualInterlocutionPanel.css';
import './SourceBrowser.css';

const MAX_TEXT_FILE_BYTES = 4 * 1024 * 1024;
const MAX_IMAGE_FILE_BYTES = 8 * 1024 * 1024;
const MAX_CUSTOM_VISUALS = 24;

function createDefaultSessionData() {
  return {
    title: '',
    intent: 'custom',
    sources: [],
    wpm: 220,
    curve: 'flat',
    chunkMode: 'word',
    displayMode: 'focal',
    audioPreset: 'silent',
    soundscape: 'none',
    selectedSwellId: null,
    visualConfig: {
      visualMode: 'off',
      focals: {
        type: 'standard',
        standardGlyph: 'breath',
        personalImage: null
      },
      attractor: {
        system: 'aizawa'
      },
      genesis: {
        preset: 'random',
        glass: true
      },
      livingText: {
        enabled: false
      },
      interlocution: {
        sourceFamily: 'procedural',
        procedural: [],
        sourced: [],
        globalPool: {
          mode: 'all',
          assetIds: []
        },
        frequency: 0.3,
        duration: VISUAL_PRESENCE_DEFAULT_MS,
        renderLanguage: 'native',
        kleePreset: 'random',
        responsive: false,
        responsiveMood: true,
        responsiveRhythm: true
      }
    },
    customVisuals: []
  };
}

function cloneSessionData(data) {
  return JSON.parse(JSON.stringify(data));
}

function normalizeSessionData(data = {}) {
  const defaults = createDefaultSessionData();
  const incoming = cloneSessionData(data);
  const visualConfig = incoming.visualConfig || {};

  return {
    ...defaults,
    ...incoming,
    sources: Array.isArray(incoming.sources) ? incoming.sources : [],
    customVisuals: Array.isArray(incoming.customVisuals) ? incoming.customVisuals : [],
    visualConfig: {
      ...defaults.visualConfig,
      ...visualConfig,
      focals: { ...defaults.visualConfig.focals, ...(visualConfig.focals || {}) },
      attractor: { ...defaults.visualConfig.attractor, ...(visualConfig.attractor || {}) },
      genesis: { ...defaults.visualConfig.genesis, ...(visualConfig.genesis || {}) },
      livingText: { ...defaults.visualConfig.livingText, ...(visualConfig.livingText || {}) },
      interlocution: {
        ...defaults.visualConfig.interlocution,
        ...(visualConfig.interlocution || {})
      }
    }
  };
}

export class Workshop {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.onCreateSession = options.onCreateSession || (() => { });

    this.sessionData = createDefaultSessionData();
    this.activeBlueprintId = null;
    this.activeDraftKind = 'new';
    this.editorDirty = false;
    this.savedBlueprints = MemoryCore.getWorkshopBlueprints();
    // Unsaved drafts are intentionally memory-only. They survive navigation
    // within this app instance, but are never written to browser storage.
    this.suspendedDrafts = [];
    this.resetArmed = false;
    this.resetTimer = null;

    this.viPanel = null;
    this.sourceBrowser = null;

    // Store bound keyboard handler for proper cleanup
    this.boundKeyboardHandler = this.handleKeyboard.bind(this);
    this._active = false;

    // Track drag state
    this.isDragging = false;

    this.render();
    this.attachEvents();
  }

  update(data) {
    this.savedBlueprints = MemoryCore.getWorkshopBlueprints();
    if (!data) {
      this.updateSequencePicker();
      return;
    }

    if (data.blueprintId) {
      this.openSavedBlueprint(data.blueprintId);
      return;
    }

    if (data.text) {
      const suspended = this.suspendCurrentDraft();
      const blank = createDefaultSessionData();
      this.replaceEditorData(blank, {
        kind: 'recursion'
      });
      this.addSource({
        id: `synthesis-${Date.now()}`,
        name: 'Chamber Synthesis',
        type: 'text/plain',
        data: data.text,
        metadata: {
           source: 'chamber-recursion'
        }
      }, { id: 'recursion', name: 'Recursion Memory' });
      this.updateSequencePicker();
      if (suspended) {
        this.showToast('Your unfinished Workshop draft is available above');
      }
    }
  }

  isCurrentDraftDirty() {
    return this.editorDirty;
  }

  markEditorDirty() {
    this.editorDirty = true;
  }

  getDraftLabel(data = this.sessionData) {
    const title = typeof data.title === 'string' ? data.title.trim() : '';
    if (title) return title;
    const firstSource = Array.isArray(data.sources) ? data.sources[0]?.name : '';
    return firstSource || 'Untitled sequence';
  }

  suspendCurrentDraft() {
    if (!this.isCurrentDraftDirty()) return false;

    this.suspendedDrafts.unshift({
      id: `draft_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      label: this.getDraftLabel(),
      data: cloneSessionData(this.sessionData),
      kind: this.activeDraftKind,
      blueprintId: this.activeBlueprintId,
      dirty: true
    });
    return true;
  }

  replaceEditorData(data, options = {}) {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    this.resetArmed = false;
    this.sourceBrowser?.destroy?.();
    this.sourceBrowser = null;
    this.viPanel?.destroy();
    this.viPanel = null;

    this.sessionData = normalizeSessionData(data);
    delete this.sessionData.updatedAt;
    this.activeBlueprintId = options.blueprintId || null;
    this.activeDraftKind = options.kind || (this.activeBlueprintId ? 'saved' : 'new');
    this.editorDirty = options.dirty === true;

    this.render();
    this.attachEvents();
  }

  startNewSequence({ preserveCurrent = true, notify = false } = {}) {
    if (preserveCurrent) this.suspendCurrentDraft();
    const blank = createDefaultSessionData();
    this.replaceEditorData(blank, {
      kind: 'new'
    });
    if (notify) this.showToast('Workshop reset');
  }

  openSavedBlueprint(blueprintId, { preserveCurrent = true } = {}) {
    this.savedBlueprints = MemoryCore.getWorkshopBlueprints();
    const blueprint = this.savedBlueprints.find(item => item.id === blueprintId);
    if (!blueprint) {
      this.showToast('That sequence is no longer in the Vault');
      this.updateSequencePicker();
      return false;
    }

    if (preserveCurrent) this.suspendCurrentDraft();
    const editable = normalizeSessionData(blueprint);
    delete editable.id;
    delete editable.updatedAt;
    this.replaceEditorData(editable, {
      blueprintId,
      kind: 'saved'
    });
    return true;
  }

  restoreSuspendedDraft(draftId) {
    const index = this.suspendedDrafts.findIndex(draft => draft.id === draftId);
    if (index < 0) return false;

    const [draft] = this.suspendedDrafts.splice(index, 1);
    this.suspendCurrentDraft();
    this.replaceEditorData(draft.data, {
      blueprintId: draft.blueprintId,
      kind: draft.kind,
      dirty: draft.dirty
    });
    return true;
  }

  renderSequenceOptions() {
    const blueprints = this.savedBlueprints;
    const isBlank = !this.activeBlueprintId && !this.isCurrentDraftDirty();
    const currentLabel = this.getDraftLabel();
    const options = [
      `<option value="new" ${isBlank ? 'selected' : ''}>+ New sequence</option>`
    ];

    if (!this.activeBlueprintId && !isBlank) {
      options.push(`<option value="current" selected>Current draft — ${this.escapeHtml(currentLabel)}</option>`);
    }

    if (this.suspendedDrafts.length > 0) {
      options.push('<optgroup label="Unsaved in this app">');
      this.suspendedDrafts.forEach(draft => {
        options.push(`<option value="draft:${this.escapeHtml(draft.id)}">Unsaved — ${this.escapeHtml(draft.label)}</option>`);
      });
      options.push('</optgroup>');
    }

    if (blueprints.length > 0) {
      options.push('<optgroup label="Saved to Vault">');
      blueprints.forEach(blueprint => {
        const selected = blueprint.id === this.activeBlueprintId ? 'selected' : '';
        options.push(`<option value="saved:${this.escapeHtml(blueprint.id)}" ${selected}>${this.escapeHtml(this.getDraftLabel(blueprint))}</option>`);
      });
      options.push('</optgroup>');
    }

    return options.join('');
  }

  getEditorStatus() {
    if (this.activeBlueprintId) {
      return this.isCurrentDraftDirty()
        ? 'Editing a saved sequence · changes remain private until saved'
        : 'Editing a saved sequence from the Vault';
    }
    if (this.activeDraftKind === 'recursion') {
      return 'New from Recursion · not saved';
    }
    if (this.isCurrentDraftDirty()) {
      return 'Unsaved draft · available only while this app remains open';
    }
    return 'A clean canvas for a new sequence';
  }

  updateSequencePicker() {
    const picker = this.container.querySelector('#workshop-sequence-select');
    const status = this.container.querySelector('#workshop-sequence-status');
    if (picker) picker.innerHTML = this.renderSequenceOptions();
    if (status) status.textContent = this.getEditorStatus();
  }

  handleSequenceSelection(value) {
    if (!value || value === 'current') return;
    if (value === 'new') {
      this.startNewSequence({ preserveCurrent: true });
      return;
    }
    if (value.startsWith('draft:')) {
      this.restoreSuspendedDraft(value.slice('draft:'.length));
      return;
    }
    if (value.startsWith('saved:')) {
      const blueprintId = value.slice('saved:'.length);
      if (blueprintId !== this.activeBlueprintId) {
        this.openSavedBlueprint(blueprintId);
      }
    }
  }

  armOrResetSequence() {
    if (!this.isCurrentDraftDirty() && !this.activeBlueprintId) {
      this.startNewSequence({ preserveCurrent: false, notify: true });
      return;
    }

    const button = this.container.querySelector('#reset-workshop-btn');
    if (!this.resetArmed) {
      this.resetArmed = true;
      if (button) {
        button.textContent = 'Confirm Reset';
        button.classList.add('reset-armed');
      }
      this.resetTimer = setTimeout(() => {
        this.resetArmed = false;
        this.resetTimer = null;
        if (button?.isConnected) {
          button.textContent = 'Reset';
          button.classList.remove('reset-armed');
        }
      }, 3500);
      return;
    }

    this.startNewSequence({ preserveCurrent: false, notify: true });
  }

  render() {
    this.container.innerHTML = `
      <div class="workshop" role="main">
        <!-- Header -->
        <header class="workshop-header">
          <button class="btn-ghost" data-action="back">
            <span class="icon">←</span>
            <span>Portal</span>
          </button>
          <h1>Workshop</h1>
        </header>

        <!-- Modules: the craft leads; the shared shelves follow -->
        <div class="workshop-content">
          <section class="workshop-sequence-manager" aria-labelledby="workshop-sequences-label">
            <div class="sequence-manager-copy">
              <label class="input-label" id="workshop-sequences-label" for="workshop-sequence-select">Workshop Sequences</label>
              <p class="input-note text-fog" id="workshop-sequence-status">${this.getEditorStatus()}</p>
            </div>
            <select class="input-select" id="workshop-sequence-select" aria-describedby="workshop-sequence-status">
              ${this.renderSequenceOptions()}
            </select>
          </section>

          <!-- 1. Sequence Creator (the room's purpose) -->
          <form class="workshop-form sequence-creator-module" id="workshop-form">
            <div class="module-header">
              <h2 class="module-title">Sequence Creator</h2>
              <span class="module-subtitle text-fog">Compose a session: sources, visuals, pacing, atmosphere</span>
            </div>

            <!-- Title -->
            <div class="input-group">
              <label class="input-label" for="session-title">Session Title</label>
              <input
                type="text"
                id="session-title"
                class="input"
                placeholder="Untitled Session"
                value="${this.escapeHtml(this.sessionData.title)}"
              />
            </div>

            <!-- Intent -->
            <div class="input-group">
              <label class="input-label">Category</label>
              <div class="intent-options">
                ${['focus', 'learning', 'exploration', 'reflection', 'custom'].map(intent => `
                  <label class="radio">
                    <input
                      type="radio"
                      name="intent"
                      value="${intent}"
                      ${this.sessionData.intent === intent ? 'checked' : ''}
                    />
                    <span class="radio-label text-capitalize">${intent}</span>
                  </label>
                `).join('')}
              </div>
            </div>

            <!-- Sources -->
            <div class="input-group">
              <label class="input-label">Sources</label>
              <div class="sources-list" id="sources-list">
                ${this.sessionData.sources.length === 0 ? `
                  <div class="empty-sources text-fog">
                    No sources added yet
                  </div>
                ` : this.renderSources()}
              </div>
              <div class="source-actions">
                <button type="button" class="btn-secondary" data-action="open-browser">
                  Browse Sources
                </button>
                <button type="button" class="btn-secondary" data-action="import-file">
                  Import File
                </button>
              </div>
            </div>

            <!-- Reading mechanics live beside the sources they modify:
                 what you read, then how it reads. Accompaniment
                 (images, visuals, atmosphere) follows as its own layer. -->
            <div class="config-section">
              <h3 class="config-section-title text-light">Reading</h3>

              <!-- Pacing -->
              <div class="input-group">
                <label class="input-label">
                  <span>Pacing</span>
                  <span class="input-label-value font-mono" id="wpm-value">${this.sessionData.wpm} WPM</span>
                </label>
                <div class="slider-container">
                  <input
                    type="range"
                    id="wpm-slider"
                    class="slider"
                    min="100"
                    max="500"
                    value="${this.sessionData.wpm}"
                    step="10"
                  />
                </div>
                <div class="config-notice text-fog font-mono">
                  ◊ Adjustable in-chamber via Arrow Keys
                </div>
              </div>

              <!-- Curve -->
              <div class="input-group">
                <label class="input-label">Pacing Curve</label>
                <div class="curve-options">
                  ${['flat', 'induction', 'ascent', 'wave', 'climax'].map(curve => `
                    <button
                      type="button"
                      class="curve-btn ${this.sessionData.curve === curve ? 'active' : ''}"
                      data-curve="${curve}"
                    >
                      <span class="curve-icon">${this.getCurveIcon(curve)}</span>
                      <span class="curve-label text-capitalize">${curve}</span>
                    </button>
                  `).join('')}
                </div>
              </div>

              <!-- Chunking -->
              <div class="input-group">
                <label class="input-label">Chunking Mode</label>
                <div class="chunk-options">
                  <button type="button" class="chunk-btn ${this.sessionData.chunkMode === 'word' ? 'active' : ''}" data-chunk="word">Word</button>
                  <button type="button" class="chunk-btn ${this.sessionData.chunkMode === 'phrase' ? 'active' : ''}" data-chunk="phrase">Phrase</button>
                  <button type="button" class="chunk-btn ${this.sessionData.chunkMode === 'sentence' ? 'active' : ''}" data-chunk="sentence">Sentence</button>
                </div>
              </div>
            </div>

            <!-- Sequence Images (travel with this sequence only) -->
            <div class="input-group">
              <div class="input-label-row">
                <label class="input-label">This Sequence's Images</label>
                <button type="button" class="btn-secondary btn-compact" data-action="upload-image">
                  + Add Image
                </button>
              </div>
              <p class="input-note text-fog">Travel with this sequence only — flashed via Personal → Active Sequence in Visuals. For images shared across every session, use the Global Image Pool shelf below.</p>
              <div class="visual-drop-zone" id="visual-drop-zone">
                <div class="visual-assets-list" id="visual-assets-list">
                  ${this.sessionData.customVisuals.length === 0 ? `
                    <div class="drop-zone-prompt">
                      <span class="drop-icon">⬆</span>
                      <span class="drop-text">Drop images here or click + Add Image</span>
                    </div>
                  ` : this.renderVisualAssets()}
                </div>
              </div>
            </div>

            <!-- Visual Interlocution Panel -->
            <div id="vi-panel-container" class="input-group"></div>

            <!-- Atmosphere -->
            <div class="config-section">
              <h3 class="config-section-title text-light">Atmosphere</h3>

              <!-- Soundscape (living compositions) leads,
                   pure tones follow — the same grammar as the Chamber's
                   audio panel, exclusive beds included -->
              <div class="input-group">
                <label class="input-label">Soundscape</label>
                <p class="input-note text-fog">Living compositions, synthesized in real time. A soundscape is a finished mix — selecting one rests the pure tones.</p>
                <div class="audio-options soundscape-options">
                  ${[['none', '○', 'None'], ['aurora', '✧', 'Aurora'], ['faded-signal', '◌', 'Faded Signal']].map(([id, icon, name]) => `
                    <button
                      type="button"
                      class="audio-btn ${(this.sessionData.soundscape || 'none') === id ? 'active' : ''}"
                      data-soundscape="${id}"
                    >
                      <span class="audio-icon">${icon}</span>
                      <span class="audio-label">${name}</span>
                    </button>
                  `).join('')}
                </div>
              </div>

              <div class="input-group">
                <label class="input-label">Pure Tones</label>
                <div class="audio-options">
                  ${['silent', 'focus', 'deep', 'gateway'].map(preset => `
                    <button
                      type="button"
                      class="audio-btn ${this.sessionData.audioPreset === preset ? 'active' : ''}"
                      data-audio-preset="${preset}"
                    >
                      <span class="audio-icon">${this.getAudioIcon(preset)}</span>
                      <span class="audio-label text-capitalize">${preset}</span>
                    </button>
                  `).join('')}
                  <button
                    type="button"
                    class="audio-btn ${this.sessionData.audioPreset === 'personal' ? 'active' : ''}"
                    data-audio-preset="personal"
                  >
                    <span class="audio-icon">★</span>
                    <span class="audio-label">Personal</span>
                  </button>
                </div>

                <div id="personal-swell-picker-container" class="input-sub-group ${this.sessionData.audioPreset === 'personal' ? '' : 'hidden'}">
                   <select id="personal-swell-select" class="input-select input-select-full">
                      <option value="">Select custom swell...</option>
                   </select>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="workshop-actions">
              <button type="button" class="btn-ghost workshop-reset-btn" data-action="reset-workshop" id="reset-workshop-btn">
                Reset
              </button>
              <button type="button" class="btn-ghost" data-action="save-draft" id="save-draft-btn">
                Save to Vault
              </button>
              <button type="button" class="btn-secondary" data-action="preview">
                Preview Session
              </button>
              <button type="submit" class="btn-primary" id="create-btn" disabled>
                Create Session
              </button>
            </div>
            
            <!-- Hidden File Inputs -->
            <input type="file" id="file-import-input" accept=".txt" style="display: none;" />
            <input type="file" id="image-import-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display: none;" />
            <input type="file" id="global-import-input" accept="image/jpeg,image/png,image/webp,image/gif" style="display: none;" />
            <input type="file" id="personal-swell-input" accept="audio/mpeg,audio/wav" style="display: none;" />
          </form>

          <!-- 2. Studio Shelves: shared libraries, not part of any one
               sequence. Managed here, selected where they're used. -->
          <section class="workshop-shelves">
            <div class="module-header">
              <h2 class="module-title">Studio Shelves</h2>
              <span class="module-subtitle text-fog">Shared across every session — manage here, select where you use them</span>
            </div>

            <section class="workshop-module global-pool-module">
              <div class="module-header module-header-row">
                <div>
                  <h3 class="shelf-title">Global Image Pool</h3>
                  <span class="shelf-note text-fog">Available to any session via Personal → Global Pool in Visuals</span>
                </div>
                <button type="button" class="btn-secondary btn-compact" data-action="upload-global-image">
                  + Add Image
                </button>
              </div>
              <div class="input-group">
                <div class="global-pool-list" id="global-pool-list">
                  <!-- Populated dynamically -->
                </div>
              </div>
            </section>

            <section class="workshop-module personal-swell-module">
              <div class="module-header module-header-row">
                <div>
                  <h3 class="shelf-title">Personal Swell Pool</h3>
                  <span class="shelf-note text-fog">MP3 swells — the selected one opens a session (choose under Pure Tones → Personal, or in the Chamber's audio panel)</span>
                </div>
                <button type="button" class="btn-secondary btn-compact" data-action="upload-personal-swell">
                  + Add Swell
                </button>
              </div>
              <div class="input-group">
                <div class="personal-swell-list" id="personal-swell-list">
                  <!-- Populated dynamically -->
                </div>
              </div>
            </section>
          </section>
        </div>
      </div>
    `;

    // Initialize Visual Interlocution Panel
    this.initVisualPanel();

    this.updateCreateButton();
    this.updateGlobalPoolList();
    this.updatePersonalSwellList();
  }

  initVisualPanel() {
    const viContainer = this.container.querySelector('#vi-panel-container');
    if (viContainer) {
      this.viPanel = new VisualInterlocutionPanel(viContainer, {
        ...this.sessionData.visualConfig,
        customVisuals: this.sessionData.customVisuals,
        expanded: true,
        locked: this.sessionData.sources.length === 0,
        onChange: (config, activeTypes) => {
          this.sessionData.visualConfig = config;
          this.markEditorDirty();
          // Only log if mode is NOT off to reduce noise while building
          if (config.visualMode !== 'off') {
            console.log('[Workshop] Visual config updated:', config.visualMode);
          }
        }
      });
    }
  }

  openSourceBrowser() {
    this.sourceBrowser = new SourceBrowser({
      mode: 'text', // Workshop only needs text sources; visuals are handled separately
      onSelect: (item, provider) => {
        this.addSource(item, provider);
      },
      onClose: () => {
        this.sourceBrowser = null;
      }
    });
  }

  /**
   * Check if an item is a visual (not text)
   */
  isVisualItem(item, provider) {
    return provider.contentType === 'image' ||
           provider.contentType === 'diagram' ||
           item.type === 'image' ||
           item.metadata?.generative ||
           item.data?.isGenerative ||
           item.data?.isImage ||
           item.data?.url;
  }

  /**
   * Add a visual source (procedural generator or external image)
   */
  addVisualSource(item, provider) {
    // Handle procedural generators
    if (item.metadata?.generative || item.data?.isGenerative) {
      // Add to procedural config instead of customVisuals
      const generatorType = item.data?.generatorType || item.id;
      const interlocution = this.sessionData.visualConfig.interlocution;
      if (!interlocution.procedural.includes(generatorType)) {
        const sourceFamily = interlocution.sourceFamily === 'blend' ? 'blend' : 'procedural';
        this.sessionData.visualConfig.interlocution = {
          ...interlocution,
          ...normalizeVisualSelection({
            ...interlocution,
            sourceFamily,
            procedural: [...interlocution.procedural, generatorType]
          })
        };
        this.sessionData.visualConfig.visualMode = 'interlocution';
        this.markEditorDirty();
        this.viPanel?.setConfig({
          visualMode: 'interlocution',
          interlocution: this.sessionData.visualConfig.interlocution
        });
        console.log('[Workshop] Added procedural generator:', generatorType);

        // Show toast feedback
        this.showToast(`Added ${item.name} to visual patterns`);
        this.updateSequencePicker();
      }
      return;
    }

    // Handle external images (Wikimedia, etc.)
    if (item.data?.url || item.metadata?.url) {
      const imageUrl = item.data?.url || item.metadata?.url;

      // For external URLs, we'll fetch and convert to base64 for consistency
      this.fetchAndAddImage(imageUrl, item.name);
      return;
    }

    console.warn('[Workshop] Unknown visual item type:', item);
  }

  /**
   * Fetch external image and add to customVisuals
   */
  async fetchAndAddImage(url, name) {
    try {
      // Show loading state
      this.showToast(`Loading ${name}...`);

      const response = await fetch(url);
      const blob = await response.blob();

      const reader = new FileReader();
      reader.onload = (e) => {
        this.sessionData.customVisuals.push(e.target.result);
        this.updateVisualAssetsList();
        this.updateCreateButton();
        this.showToast(`Added ${name}`);
      };
      reader.onerror = () => {
        console.error('[Workshop] Failed to convert image to base64');
        this.showToast('Failed to load image');
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('[Workshop] Failed to fetch image:', error);
      this.showToast('Failed to load image - CORS blocked');
    }
  }

  /**
   * Simple toast notification
   */
  showToast(message) {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.add('fade-out');
      setTimeout(() => toast.remove(), 300);
    }, 2000);
  }

  addSource(item, provider) {
    // Normalize array payloads (e.g. ArXiv search results returning multiple structured objects)
    let normalizedData = item.data;
    if (Array.isArray(item.data)) {
        normalizedData = item.data.map(d => {
            if (typeof d === 'string') return d;
            return d.content || d.data || JSON.stringify(d);
        }).join('\n\n--- ◈ SOURCE DIVIDER ◈ ---\n\n');
    }

    // Persist as pure string representation
    item.data = normalizedData;

    // Count words in content
    let words = 0;
    if (typeof item.data === 'string') {
      words = item.data.split(/\s+/).filter(w => w.length > 0).length;
    }

    this.sessionData.sources.push({
      id: item.id,
      name: item.name,
      providerId: provider.id,
      type: item.type,
      words: words,
      data: item.data,
      metadata: item.metadata
    });

    this.markEditorDirty();
    this.updateSourcesList();
    this.updateCreateButton();
    this.updateSequencePicker();
    console.log('[Workshop] Added source:', item.name);
  }

  renderSources() {
    return this.sessionData.sources.map((source, index) => {
      // Generate preview text (first 100 chars)
      const previewText = typeof source.data === 'string'
        ? source.data.substring(0, 100).replace(/\n/g, ' ').trim() + (source.data.length > 100 ? '...' : '')
        : '';

      const isFirst = index === 0;
      const isLast = index === this.sessionData.sources.length - 1;

      return `
        <div class="source-item card" data-source-index="${index + 1}">
          <div class="source-item-header">
            <span class="source-name text-light">${this.escapeHtml(source.name)}</span>
            <div class="source-actions-mini">
              <button type="button" class="btn-icon" data-action="preview-source" data-index="${index}" title="Preview content">
                ◎
              </button>
              <button type="button" class="btn-icon" data-action="move-up" data-index="${index}" ${isFirst ? 'disabled' : ''} title="Move up">
                ▲
              </button>
              <button type="button" class="btn-icon" data-action="move-down" data-index="${index}" ${isLast ? 'disabled' : ''} title="Move down">
                ▼
              </button>
              <button type="button" class="btn-icon" data-action="remove-source" data-index="${index}" title="Remove">
                ✕
              </button>
            </div>
          </div>
          <span class="source-meta">${source.words.toLocaleString()} words · ${source.providerId || 'local'}</span>
          ${previewText ? `<span class="source-preview">${this.escapeHtml(previewText)}</span>` : ''}
        </div>
      `;
    }).join('');
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Show source preview modal
   */
  showSourcePreview(index) {
    const source = this.sessionData.sources[index];
    if (!source) return;

    // Create modal overlay
    const modal = document.createElement('div');
    modal.className = 'source-preview-modal';
    modal.innerHTML = `
      <div class="source-preview-content">
        <header class="source-preview-header">
          <h3>${this.escapeHtml(source.name)}</h3>
          <button class="btn-icon source-preview-close">✕</button>
        </header>
        <div class="source-preview-body">
          <pre class="source-preview-text">${this.escapeHtml(typeof source.data === 'string' ? source.data : JSON.stringify(source.data, null, 2))}</pre>
        </div>
        <footer class="source-preview-footer">
          <span class="text-fog">${source.words} words</span>
          <button class="btn-secondary source-preview-close">Close</button>
        </footer>
      </div>
    `;

    document.body.appendChild(modal);

    // Animate in
    requestAnimationFrame(() => modal.classList.add('open'));

    // Close handlers
    const closeModal = () => {
      modal.classList.remove('open');
      setTimeout(() => modal.remove(), 200);
    };

    modal.querySelectorAll('.source-preview-close').forEach(btn => {
      btn.addEventListener('click', closeModal);
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Escape key
    const escHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escHandler);
      }
    };
    document.addEventListener('keydown', escHandler);
  }

  renderVisualAssets() {
    return this.sessionData.customVisuals.map((uri, index) => `
      <div class="visual-asset-item" style="position: relative; min-width: 100px; height: 100px; border-radius: 4px; overflow: hidden; background: #111;">
        <img src="${safeUrl(uri)}" alt="Personal visual" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;" />
        <button type="button" class="btn-icon" data-action="remove-visual" data-index="${index}" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); width: 24px; height: 24px; border-radius: 4px;">
           <span class="icon text-error" style="font-size: 0.8rem;">✕</span>
        </button>
      </div>
    `).join('');
  }

  async populatePersonalSwellSelect() {
    const select = this.container.querySelector('#personal-swell-select');
    if (!select) return;

    const swells = await PersonalSwells.getAll();
    const currentId = this.sessionData.selectedSwellId;

    select.innerHTML = '<option value="">Select custom swell...</option>' + 
      swells.map(s => `
        <option value="${this.escapeHtml(s.id)}" ${s.id === currentId ? 'selected' : ''}>
          ${this.escapeHtml(s.name)}
        </option>
      `).join('');
  }

  updateGlobalPoolList() {
    const list = this.container.querySelector('#global-pool-list');
    if (!list) return;
    
    const assets = MemoryCore.getGlobalImageAssets();
    if (assets.length === 0) {
      list.innerHTML = `<div class="empty-sources text-fog" style="flex:1;">No global images saved</div>`;
      return;
    }

    list.innerHTML = assets.map(asset => `
      <div class="visual-asset-item" title="${this.escapeHtml(asset.name)}" style="position: relative; min-width: 100px; height: 100px; border-radius: 4px; overflow: hidden; background: #111;">
        <img src="${safeUrl(asset.uri)}" alt="${this.escapeHtml(asset.name)}" loading="lazy" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;" />
        <span class="global-asset-name">${this.escapeHtml(asset.name)}</span>
        <button type="button" class="btn-icon" data-action="remove-global" data-global-id="${this.escapeHtml(asset.id)}" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); width: 24px; height: 24px; border-radius: 4px;">
           <span class="icon text-error" style="font-size: 0.8rem;">✕</span>
        </button>
      </div>
    `).join('');
  }

  async updatePersonalSwellList() {
    const list = this.container.querySelector('#personal-swell-list');
    if (!list) return;

    const swells = await PersonalSwells.getAll();
    if (swells.length === 0) {
      list.innerHTML = `<div class="empty-sources text-fog" style="padding: 1rem; border: none;">No personal swells uploaded</div>`;
      return;
    }

    list.innerHTML = swells.map((swell) => `
      <div class="swell-item" style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.8rem; background: rgba(255,255,255,0.03); border-radius: 4px; border: 1px solid var(--color-shadow);">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span class="icon" style="color: var(--color-threshold); font-size: 0.8rem;">♪</span>
          <span style="font-size: 13px; color: var(--color-cloud);">${this.escapeHtml(swell.name)}</span>
        </div>
        <div style="display: flex; gap: 5px;">
          <button class="btn-icon" data-action="preview-personal-swell" data-id="${swell.id}" style="color: var(--color-mist); font-size: 10px;">◎</button>
          <button class="btn-icon" data-action="remove-personal-swell" data-id="${swell.id}" style="color: var(--color-rose); font-size: 10px;">✕</button>
        </div>
      </div>
    `).join('');
  }

  getCurveIcon(curve) {
    const icons = {
      flat: '─',
      induction: '╲',
      ascent: '╱',
      wave: '∿',
      climax: '∧'
    };
    return icons[curve] || '─';
  }

  getDisplayIcon(mode) {
    const icons = {
      focal: '◎',
      chamber: '◈',
      orbital: '◌'
    };
    return icons[mode] || '◎';
  }

  getAudioIcon(preset) {
    const icons = {
      silent: '○',
      focus: '◇',
      deep: '◈',
      gateway: '⬡'
    };
    return icons[preset] || '○';
  }

  attachEvents() {
    // Back button
    this.container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      window.rise?.audioEngine?.playClick();
      this.onNavigate('portal');
    });

    // Form submission
    const form = this.container.querySelector('#workshop-form');
    form?.addEventListener('submit', (e) => {
      e.preventDefault();
      window.rise?.audioEngine?.playClick();
      this.createSession();
    });
    const syncSequenceManager = (event) => {
      const clickChangesEditor = event.type === 'click' && event.target.closest(
        '[data-curve], [data-chunk], [data-mode], [data-soundscape], [data-audio-preset], '
        + '[data-action="remove-source"], [data-action="remove-visual"], '
        + '[data-action="move-up"], [data-action="move-down"]'
      );
      if (event.type === 'input' || event.type === 'change' || clickChangesEditor) {
        this.markEditorDirty();
      }
      queueMicrotask(() => {
      if (this.container.querySelector('#workshop-sequence-select')) {
        this.updateSequencePicker();
      }
      });
    };
    form?.addEventListener('input', syncSequenceManager);
    form?.addEventListener('change', syncSequenceManager);
    form?.addEventListener('click', syncSequenceManager);

    this.container.querySelector('#workshop-sequence-select')?.addEventListener('change', (event) => {
      window.rise?.audioEngine?.playHiss();
      this.handleSequenceSelection(event.target.value);
    });

    // Title input
    const titleInput = this.container.querySelector('#session-title');
    titleInput?.addEventListener('input', (e) => {
      this.sessionData.title = e.target.value;
      this.updateCreateButton();
    });

    // Intent radios
    const intentRadios = this.container.querySelectorAll('input[name="intent"]');
    intentRadios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        window.rise?.audioEngine?.playHiss();
        this.sessionData.intent = e.target.value;
      });
    });

    // WPM slider
    const wpmSlider = this.container.querySelector('#wpm-slider');
    const wpmValue = this.container.querySelector('#wpm-value');
    wpmSlider?.addEventListener('input', (e) => {
      this.sessionData.wpm = parseInt(e.target.value);
      if (wpmValue) {
        wpmValue.textContent = `${this.sessionData.wpm} WPM`;
      }
    });

    // Curve buttons
    this.container.querySelectorAll('[data-curve]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.sessionData.curve = btn.dataset.curve;
        this.updateActiveButtons('[data-curve]', btn);
      });
    });

    // Chunking buttons
    this.container.querySelectorAll('[data-chunk]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.sessionData.chunkMode = btn.dataset.chunk;
        this.updateActiveButtons('[data-chunk]', btn);
      });
    });

    // Display mode buttons
    this.container.querySelectorAll('[data-mode]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.sessionData.displayMode = btn.dataset.mode;
        this.updateActiveButtons('[data-mode]', btn);
      });
    });

    // Atmosphere — soundscapes and pure tones are exclusive beds
    // (same rule as the Chamber's audio panel: a soundscape is a
    // finished mix; steady tones at the same carrier would mask it).
    // 'Personal' is an entry swell — an event, not a bed — so it
    // coexists with a soundscape.
    this.container.querySelectorAll('[data-soundscape]').forEach(btn => {
      btn.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.sessionData.soundscape = btn.dataset.soundscape;
        this.updateActiveButtons('[data-soundscape]', btn);

        if (btn.dataset.soundscape !== 'none'
          && this.sessionData.audioPreset !== 'silent'
          && this.sessionData.audioPreset !== 'personal') {
          this.sessionData.audioPreset = 'silent';
          this.container.querySelectorAll('[data-audio-preset]').forEach(o =>
            o.classList.toggle('active', o.dataset.audioPreset === 'silent'));
        }
      });
    });

    // Audio preset buttons
    this.container.querySelectorAll('[data-audio-preset]').forEach(btn => {
      btn.addEventListener('click', async () => {
        window.rise?.audioEngine?.playHiss();
        const preset = btn.dataset.audioPreset;
        this.sessionData.audioPreset = preset;
        this.updateActiveButtons('[data-audio-preset]', btn);

        // A tone bed displaces the soundscape (entry swells don't)
        if (preset !== 'silent' && preset !== 'personal'
          && this.sessionData.soundscape && this.sessionData.soundscape !== 'none') {
          this.sessionData.soundscape = 'none';
          this.container.querySelectorAll('[data-soundscape]').forEach(o =>
            o.classList.toggle('active', o.dataset.soundscape === 'none'));
        }

        const picker = this.container.querySelector('#personal-swell-picker-container');
        if (preset === 'personal') {
           picker?.classList.remove('hidden');
           await this.populatePersonalSwellSelect();
        } else {
           picker?.classList.add('hidden');
           this.sessionData.selectedSwellId = null;
        }
      });
    });

    // Swell selection
    this.container.querySelector('#personal-swell-select')?.addEventListener('change', (e) => {
       this.sessionData.selectedSwellId = e.target.value || null;
       console.log('[Workshop] Selected swell ID:', this.sessionData.selectedSwellId);
    });

    // Source actions and Import
    const fileInput = this.container.querySelector('#file-import-input');
    const imageInput = this.container.querySelector('#image-import-input');
    const globalInput = this.container.querySelector('#global-import-input');
    
    fileInput?.addEventListener('change', (e) => this.handleFileUpload(e));
    imageInput?.addEventListener('change', (e) => this.handleFileUpload(e));
    globalInput?.addEventListener('change', (e) => this.handleGlobalUpload(e));
    const personalSwellInput = this.container.querySelector('#personal-swell-input');
    personalSwellInput?.addEventListener('change', (e) => this.handlePersonalSwellUpload(e));

    if (this.boundContainerClickHandler) {
      this.container.removeEventListener('click', this.boundContainerClickHandler);
    }
    this.boundContainerClickHandler = (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      if (action === 'open-browser') {
        window.rise?.audioEngine?.playHiss();
        this.openSourceBrowser();
      } else if (action === 'import-file') {
        window.rise?.audioEngine?.playHiss();
        if (fileInput) fileInput.click();
      } else if (action === 'upload-image') {
        window.rise?.audioEngine?.playHiss();
        // Trigger specific image input
        if (imageInput) imageInput.click();
      } else if (action === 'upload-global-image') {
        window.rise?.audioEngine?.playHiss();
        // Trigger global pool input
        if (globalInput) globalInput.click();
      } else if (action === 'upload-personal-swell') {
        window.rise?.audioEngine?.playHiss();
        if (personalSwellInput) personalSwellInput.click();
      } else if (action === 'remove-source') {
        window.rise?.audioEngine?.playHiss();
        const index = parseInt(target.dataset.index);
        this.removeSource(index);
      } else if (action === 'remove-visual') {
        window.rise?.audioEngine?.playHiss();
        const index = parseInt(target.dataset.index);
        this.sessionData.customVisuals.splice(index, 1);
        this.updateVisualAssetsList();
        // Visuals removal does not affect create button lock anymore
      } else if (action === 'remove-global') {
        window.rise?.audioEngine?.playHiss();
        MemoryCore.removeGlobalImage(target.dataset.globalId);
        this.updateGlobalPoolList();
        this.viPanel?.refreshGlobalAssets();
      } else if (action === 'move-up') {
        window.rise?.audioEngine?.playHiss();
        const index = parseInt(target.dataset.index);
        this.swapSources(index, index - 1);
      } else if (action === 'move-down') {
        window.rise?.audioEngine?.playHiss();
        const index = parseInt(target.dataset.index);
        this.swapSources(index, index + 1);
      } else if (action === 'preview-source') {
        window.rise?.audioEngine?.playHiss();
        const index = parseInt(target.dataset.index);
        this.showSourcePreview(index);
      } else if (action === 'preview-personal-swell') {
        const id = target.dataset.id;
        window.rise?.audioEngine?.playSwell(); // Plays a random one for now
        this.showToast('Previewing atmosphere...');
      } else if (action === 'remove-personal-swell') {
        window.rise?.audioEngine?.playHiss();
        const id = target.dataset.id;
        this.removePersonalSwell(id);
      } else if (action === 'save-draft') {
        window.rise?.audioEngine?.playHiss();
        this.saveSequenceToVault();
      } else if (action === 'reset-workshop') {
        window.rise?.audioEngine?.playHiss();
        this.armOrResetSequence();
      } else if (action === 'preview') {
        window.rise?.audioEngine?.playHiss();
        this.onCreateSession({ ...this.sessionData, isPreview: true });
      }
    };
    this.container.addEventListener('click', this.boundContainerClickHandler);

    // Drag and drop for images
    this.attachDragDropEvents();
  }

  /**
   * Setup drag and drop event handlers for image upload
   */
  attachDragDropEvents() {
    const dropZone = this.container.querySelector('#visual-drop-zone');
    if (!dropZone) return;

    // Prevent default drag behaviors on window to allow drop zone to work
    const preventDefaults = (e) => {
      e.preventDefault();
      e.stopPropagation();
    };

    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(event => {
      dropZone.addEventListener(event, preventDefaults);
    });

    // Visual feedback on drag
    const highlight = () => {
      dropZone.classList.add('drag-over');
      this.isDragging = true;
    };

    const unhighlight = () => {
      dropZone.classList.remove('drag-over');
      this.isDragging = false;
    };

    ['dragenter', 'dragover'].forEach(event => {
      dropZone.addEventListener(event, highlight);
    });

    ['dragleave', 'drop'].forEach(event => {
      dropZone.addEventListener(event, unhighlight);
    });

    // Handle drop
    dropZone.addEventListener('drop', (e) => {
      const files = e.dataTransfer?.files;
      if (!files || files.length === 0) return;

      // Process each file
      Array.from(files).forEach(file => {
        if (file.type.startsWith('image/')) {
          this.processDroppedImage(file);
        }
      });
    });
  }

  /**
   * Process a dropped image file
   */
  processDroppedImage(file) {
    if (file.size > MAX_IMAGE_FILE_BYTES) {
      this.showToast('Images must be 8 MB or smaller');
      return;
    }
    if (this.sessionData.customVisuals.length >= MAX_CUSTOM_VISUALS) {
      this.showToast(`A sequence can contain up to ${MAX_CUSTOM_VISUALS} personal visuals`);
      return;
    }
    const reader = new FileReader();
    reader.onload = (e) => {
      this.sessionData.customVisuals.push(e.target.result);
      this.updateVisualAssetsList();
      this.updateCreateButton();
    };
    reader.onerror = () => {
      console.error('[Workshop] Failed to read dropped image:', file.name);
    };
    reader.readAsDataURL(file);
  }

  handleKeyboard(e) {
    if (e.key === 'Escape') {
      this.onNavigate('portal');
    } else if (window.rise?.audioEngine && !e.repeat && e.key && e.key.length === 1) {
      // Trigger sound for alphanumeric/symbol keys
      window.rise.audioEngine.playKeyPress(e.keyCode);
    }
  }

  activate() {
    if (this._active) return;
    this._active = true;
    document.addEventListener('keydown', this.boundKeyboardHandler);
  }

  deactivate() {
    if (!this._active) return;
    this._active = false;
    document.removeEventListener('keydown', this.boundKeyboardHandler);
  }

  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    // Check if the file is an image
    if (file.type.startsWith('image/')) {
        if (file.size > MAX_IMAGE_FILE_BYTES) {
            this.showToast('Images must be 8 MB or smaller');
            event.target.value = '';
            return;
        }
        if (this.sessionData.customVisuals.length >= MAX_CUSTOM_VISUALS) {
            this.showToast(`A sequence can contain up to ${MAX_CUSTOM_VISUALS} personal visuals`);
            event.target.value = '';
            return;
        }
        reader.onload = (e) => {
            this.sessionData.customVisuals.push(e.target.result);
            this.updateVisualAssetsList();
            this.updateCreateButton();
            event.target.value = '';
        };
        reader.readAsDataURL(file);
        return;
    }

    if (file.size > MAX_TEXT_FILE_BYTES) {
      this.showToast('Text files must be 4 MB or smaller');
      event.target.value = '';
      return;
    }

    // Handle text parsing
    reader.onload = (e) => {
      let text = e.target.result;
      
      // Basic JSON unpacking if the user uploaded a raw JSON block
      if (file.name.endsWith('.json')) {
         try {
             const parsed = JSON.parse(text);
             // Attempt to heuristically flatten JSON values if it's an array or object
             if (Array.isArray(parsed)) {
                 text = parsed.map(v => typeof v === 'string' ? v : JSON.stringify(v)).join(' ');
             } else if (typeof parsed === 'object') {
                 text = Object.values(parsed).filter(v => typeof v === 'string').join(' ');
             }
         } catch(err) {
             console.log('[Workshop] JSON parse failed, injecting as raw string.');
         }
      }

      this.addSource({
        id: `local-${Date.now()}`,
        name: file.name,
        type: file.type || 'text/plain',
        data: text,
        metadata: { source: 'local-file' }
      }, { id: 'local', name: 'Local File' });

      // Reset the input so the same file could be uploaded again if needed
      event.target.value = '';
    };
    reader.onerror = () => {
      console.error('[Workshop] Failed to read file.');
    };
    
    reader.readAsText(file);
  }

  updateActiveButtons(selector, activeBtn) {
    this.container.querySelectorAll(selector).forEach(btn => {
      btn.classList.remove('active');
    });
    activeBtn.classList.add('active');
  }

  removeSource(index) {
    this.sessionData.sources.splice(index, 1);
    this.updateSourcesList();
    this.updateCreateButton();
  }

  swapSources(indexA, indexB) {
    if (indexA < 0 || indexB < 0 || indexA >= this.sessionData.sources.length || indexB >= this.sessionData.sources.length) return;
    const temp = this.sessionData.sources[indexA];
    this.sessionData.sources[indexA] = this.sessionData.sources[indexB];
    this.sessionData.sources[indexB] = temp;
    this.updateSourcesList();
  }

  updateSourcesList() {
    const sourcesList = this.container.querySelector('#sources-list');
    if (sourcesList) {
      sourcesList.innerHTML = this.sessionData.sources.length === 0
        ? '<div class="empty-sources text-fog">No sources added yet</div>'
        : this.renderSources();
    }
  }

  updateVisualAssetsList() {
    this.markEditorDirty();
    const visualList = this.container.querySelector('#visual-assets-list');
    if (visualList) {
      visualList.innerHTML = this.sessionData.customVisuals.length === 0
        ? `<div class="drop-zone-prompt">
             <span class="drop-icon">⬆</span>
             <span class="drop-text">Drop images here or click + Add Image</span>
           </div>`
        : this.renderVisualAssets();
    }
    // Keep the panel's personal-source selection synchronized in both
    // directions. Removing the final image must also remove the stale
    // `custom` source flag before compilation.
    if (this.viPanel) {
        this.viPanel.updateCustomVisuals(this.sessionData.customVisuals);
    }
    // If custom visuals are added, enable interlocution mode if not already set
    if (this.sessionData.customVisuals.length > 0) {
        if (this.viPanel) {
            if (this.sessionData.visualConfig.visualMode === 'off') {
                this.viPanel.setVisualMode('interlocution');
            }
        } else if (this.sessionData.visualConfig.visualMode === 'off') {
            this.sessionData.visualConfig.visualMode = 'interlocution';
        }
    }
    this.updateSequencePicker();
  }

  updateCreateButton() {
    const createBtn = this.container.querySelector('#create-btn');
    const isLocked = this.sessionData.sources.length === 0;
    
    if (createBtn) {
      createBtn.disabled = isLocked;
    }

    if (this.viPanel && this.viPanel.locked !== isLocked) {
      this.viPanel.setLocked(isLocked);
    }
  }

  persistSequenceToVault() {
    const payload = cloneSessionData(this.sessionData);
    delete payload.updatedAt;
    if (this.activeBlueprintId) {
      payload.id = this.activeBlueprintId;
    } else {
      delete payload.id;
    }

    const saved = MemoryCore.saveWorkshopBlueprint(payload);
    if (!saved?.id) return null;
    this.savedBlueprints = MemoryCore.getWorkshopBlueprints();

    const vault = window.rise?.router?.getViewInstance('vault');
    vault?.refreshBlueprints?.();
    return saved;
  }

  saveSequenceToVault() {
    const saved = this.persistSequenceToVault();
    if (!saved) {
      this.showToast('Could not save this sequence');
      return null;
    }

    // Saving completes this editor transaction. Reopening for modification is
    // explicit through Workshop Sequences, so later Recursions cannot merge
    // into a configuration the user already committed to the Vault.
    this.startNewSequence({ preserveCurrent: false });
    this.showToast('Saved to Vault · Workshop cleared');
    return saved;
  }

  createSession() {
    const saved = this.persistSequenceToVault();
    const session = saved || cloneSessionData(this.sessionData);

    // Compile and navigate before clearing the retained Workshop instance.
    this.onCreateSession(session);
    if (saved) {
      this.startNewSequence({ preserveCurrent: false });
    }
  }

  handleGlobalUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const success = MemoryCore.saveGlobalImage(e.target.result, { name: file.name });
        if (success) {
            this.updateGlobalPoolList();
            this.viPanel?.refreshGlobalAssets();
        } else {
            alert('Could not add this image. The Global Pool holds up to 20 images and shares browser storage with your sequences.');
        }
        event.target.value = '';
    };
    reader.readAsDataURL(file);
  }

  async handlePersonalSwellUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const displayName = await namingModal.show(file.name, 'Name Swell', 'Atmospheric Metadata');
    if (!displayName) {
      event.target.value = '';
      return;
    }
    
    this.showToast(`Decoding ${displayName}...`);
    try {
      await PersonalSwells.addSwell(file, displayName);
      await this.updatePersonalSwellList();
      this.showToast('Swell added to personal pool');
      if (window.rise?.audioEngine) {
        await window.rise.audioEngine.reloadPersonalSwells();
      }
    } catch (error) {
      console.error('[Workshop] Failed to upload personal swell:', error);
      this.showToast('Failed to upload audio');
    }
    event.target.value = '';
  }

  async removePersonalSwell(id) {
    try {
      await PersonalSwells.removeSwell(id);
      await this.updatePersonalSwellList();
      this.showToast('Swell removed');
      if (window.rise?.audioEngine) {
        await window.rise.audioEngine.reloadPersonalSwells();
      }
    } catch (error) {
      console.error('[Workshop] Failed to remove swell:', error);
    }
  }

  destroy() {
    if (this.resetTimer) {
      clearTimeout(this.resetTimer);
      this.resetTimer = null;
    }
    if (this.viPanel) {
      this.viPanel.destroy();
    }
    this.sourceBrowser?.destroy?.();
    this.sourceBrowser = null;
    if (this.boundContainerClickHandler) {
      this.container.removeEventListener('click', this.boundContainerClickHandler);
      this.boundContainerClickHandler = null;
    }
    this.deactivate();
  }
}
