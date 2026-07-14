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
import './VisualInterlocutionPanel.css';
import './SourceBrowser.css';

export class Workshop {
  constructor(container, options = {}) {
    this.container = container;
    this.onNavigate = options.onNavigate || (() => { });
    this.onCreateSession = options.onCreateSession || (() => { });

    this.sessionData = {
      title: '',
      intent: 'custom',
      sources: [],
      wpm: 220,
      curve: 'flat',
      chunkMode: 'word',
      displayMode: 'focal',
      audioPreset: 'silent',
      selectedSwellId: null,
      visualConfig: {
        // Top-level mode: 'off' | 'focals' | 'attractor' | 'interlocution'
        visualMode: 'off',

        // Focals config (persistent gentle focal point)
        focals: {
          type: 'standard', // 'standard' | 'personal'
          standardGlyph: 'breath',
          personalImage: null
        },

        // Attractor config (persistent strange-attractor field)
        attractor: {
          system: 'aizawa' // 'aizawa' | 'thomas' | 'halvorsen'
        },

        // Genesis config (continuously growing Klee composition)
        genesis: {
          preset: 'random'
        },

        // Living Text (semantic hue/glow on the text stream)
        livingText: {
          enabled: false
        },

        // Interlocution config (probabilistic interrupts)
        interlocution: {
          procedural: ['klee', 'turrell'],
          sourced: [],
          frequency: 0.3,
          duration: 33,
          kleePreset: 'random',
          responsive: false,
          responsiveMood: true,
          responsiveRhythm: true
        }
      },
      customVisuals: [] // Base64 image URIs
    };

    this.viPanel = null;
    this.sourceBrowser = null;

    // Store bound keyboard handler for proper cleanup
    this.boundKeyboardHandler = this.handleKeyboard.bind(this);

    // Track drag state
    this.isDragging = false;

    this.render();
    this.attachEvents();
  }

  update(data) {
    if (data && data.text) {
      this.addSource({
        id: `synthesis-${Date.now()}`,
        name: 'Chamber Synthesis',
        type: 'text/plain',
        data: data.text,
        metadata: {
           source: 'chamber-recursion'
        }
      }, { id: 'recursion', name: 'Recursion Memory' });
    }
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

        <!-- Modules -->
        <div class="workshop-content">
          <!-- 1. Global Image Pool (Persistent Asset Management) -->
          <section class="workshop-module global-pool-module">
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <h2 class="module-title">Global Image Pool</h2>
                <span class="text-fog" style="font-size: 0.8rem;">Persistent across all sessions</span>
              </div>
              <button type="button" class="btn-secondary" data-action="upload-global-image" style="font-size: 11px; padding: 4px 8px;">
                + Add Image
              </button>
            </div>
            <div class="input-group">
              <div class="global-pool-list" id="global-pool-list" style="display: flex; gap: 1rem; overflow-x: auto; padding-bottom: 1rem;">
                <!-- Populated dynamically -->
              </div>
            </div>
          </section>

          <!-- 1.5 Personal Swell Pool (Persistent Audio Management) -->
          <section class="workshop-module personal-swell-module">
            <div class="module-header" style="display: flex; justify-content: space-between; align-items: flex-end;">
              <div>
                <h2 class="module-title">Personal Swell Pool</h2>
                <span class="text-fog" style="font-size: 0.8rem;">Persistent MP3 atmosphere samples</span>
              </div>
              <button type="button" class="btn-secondary" data-action="upload-personal-swell" style="font-size: 11px; padding: 4px 8px;">
                + Add Swell
              </button>
            </div>
            <div class="input-group">
              <div class="personal-swell-list" id="personal-swell-list" style="display: flex; flex-direction: column; gap: 0.5rem; max-height: 200px; overflow-y: auto; padding: 0.5rem; background: var(--color-abyss); border-radius: var(--radius-sm);">
                <!-- Populated dynamically -->
              </div>
            </div>
          </section>

          <!-- 2. Sequence Creator (Session Specific) -->
          <form class="workshop-form sequence-creator-module" id="workshop-form">
            <div class="module-header">
              <h2 class="module-title">Sequence Creator</h2>
            </div>

            <!-- Title -->
            <div class="input-group">
              <label class="input-label" for="session-title">Session Title</label>
              <input
                type="text"
                id="session-title"
                class="input"
                placeholder="Untitled Session"
                value="${this.sessionData.title}"
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

            <!-- Visual Assets -->
            <div class="input-group">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <label class="input-label">Visual Assets</label>
                <button type="button" class="btn-secondary" data-action="upload-image" style="font-size: 11px; padding: 4px 8px;">
                  + Add Image
                </button>
              </div>
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

            <!-- Configuration -->
            <div class="config-section">
              <h3 class="config-section-title text-light">Configuration</h3>

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
                <div class="config-notice text-fog font-mono" style="font-size: 9px; margin-top: 0.5rem; opacity: 0.7;">
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


              <!-- Audio Preset -->
              <div class="input-group">
                <label class="input-label">Audio Atmosphere</label>
                <div class="audio-options">
                  ${['silent', 'focus', 'deep', 'gateway'].map(preset => `
                    <button
                      type="button"
                      class="audio-btn ${this.sessionData.audioPreset === preset ? 'active' : ''}"
                      data-preset="${preset}"
                    >
                      <span class="audio-icon">${this.getAudioIcon(preset)}</span>
                      <span class="audio-label text-capitalize">${preset}</span>
                    </button>
                  `).join('')}
                  <button
                    type="button"
                    class="audio-btn ${this.sessionData.audioPreset === 'personal' ? 'active' : ''}"
                    data-preset="personal"
                  >
                    <span class="audio-icon">★</span>
                    <span class="audio-label">Personal</span>
                  </button>
                </div>
                
                <div id="personal-swell-picker-container" class="input-sub-group ${this.sessionData.audioPreset === 'personal' ? '' : 'hidden'}" style="margin-top: 0.5rem;">
                   <select id="personal-swell-select" class="input-select" style="width: 100%;">
                      <option value="">Select custom swell...</option>
                   </select>
                </div>
              </div>
            </div>

            <!-- Actions -->
            <div class="workshop-actions">
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
      if (!this.sessionData.visualConfig.interlocution.procedural.includes(generatorType)) {
        this.sessionData.visualConfig.interlocution.procedural.push(generatorType);
        this.sessionData.visualConfig.visualMode = 'interlocution';
        console.log('[Workshop] Added procedural generator:', generatorType);

        // Show toast feedback
        this.showToast(`Added ${item.name} to visual patterns`);
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

    this.updateSourcesList();
    this.updateCreateButton();
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
        <img src="${uri}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;" />
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
        <option value="${s.id}" ${s.id === currentId ? 'selected' : ''}>
          ${s.name}
        </option>
      `).join('');
  }

  updateGlobalPoolList() {
    const list = this.container.querySelector('#global-pool-list');
    if (!list) return;
    
    const globals = MemoryCore.getGlobalImages();
    if (globals.length === 0) {
      list.innerHTML = `<div class="empty-sources text-fog" style="flex:1;">No global images saved</div>`;
      return;
    }

    list.innerHTML = globals.map((uri, index) => `
      <div class="visual-asset-item" style="position: relative; min-width: 100px; height: 100px; border-radius: 4px; overflow: hidden; background: #111;">
        <img src="${uri}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.8;" />
        <button type="button" class="btn-icon" data-action="remove-global" data-index="${index}" style="position: absolute; top: 4px; right: 4px; background: rgba(0,0,0,0.6); width: 24px; height: 24px; border-radius: 4px;">
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
          <span style="font-size: 13px; color: var(--color-cloud);">${swell.name}</span>
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

    // Audio preset buttons
    this.container.querySelectorAll('[data-preset]').forEach(btn => {
      btn.addEventListener('click', async () => {
        window.rise?.audioEngine?.playHiss();
        const preset = btn.dataset.preset;
        this.sessionData.audioPreset = preset;
        this.updateActiveButtons('[data-preset]', btn);

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

    this.container.addEventListener('click', (e) => {
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
        const index = parseInt(target.dataset.index);
        MemoryCore.removeGlobalImage(index);
        this.updateGlobalPoolList();
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
        const saved = MemoryCore.saveWorkshopBlueprint(this.sessionData);
        if (saved && saved.id) {
           this.sessionData.id = saved.id;
           const btn = this.container.querySelector('#save-draft-btn');
           if (btn) {
              const original = btn.textContent;
              btn.textContent = 'Saved.';
              setTimeout(() => btn.textContent = original, 2000);
           }
           // Notify Vault to refresh its blueprints list
           const vault = window.rise?.router?.getViewInstance('vault');
           if (vault?.refreshBlueprints) {
              vault.refreshBlueprints();
           }
        }
      } else if (action === 'preview') {
        window.rise?.audioEngine?.playHiss();
        this.onCreateSession({ ...this.sessionData, isPreview: true });
      }
    });

    // Keyboard (using stored bound reference for proper cleanup)
    document.addEventListener('keydown', this.boundKeyboardHandler);

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

  handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    // Check if the file is an image
    if (file.type.startsWith('image/')) {
        reader.onload = (e) => {
            this.sessionData.customVisuals.push(e.target.result);
            this.updateVisualAssetsList();
            this.updateCreateButton();
            event.target.value = '';
        };
        reader.readAsDataURL(file);
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
    const visualList = this.container.querySelector('#visual-assets-list');
    if (visualList) {
      visualList.innerHTML = this.sessionData.customVisuals.length === 0
        ? `<div class="drop-zone-prompt">
             <span class="drop-icon">⬆</span>
             <span class="drop-text">Drop images here or click + Add Image</span>
           </div>`
        : this.renderVisualAssets();
    }
    // If custom visuals are added, enable interlocution mode if not already set
    if (this.sessionData.customVisuals.length > 0) {
        if (this.viPanel) {
            this.viPanel.updateCustomVisuals(this.sessionData.customVisuals);
            if (this.sessionData.visualConfig.visualMode === 'off') {
                this.viPanel.setVisualMode('interlocution');
            }
        } else if (this.sessionData.visualConfig.visualMode === 'off') {
            this.sessionData.visualConfig.visualMode = 'interlocution';
        }
    }
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

  createSession() {
    // 1. Auto-save the current configuration to the Vault so the Sequence Visuals and metadata persist
    const saved = MemoryCore.saveWorkshopBlueprint(this.sessionData);
    if (saved && saved.id) {
       this.sessionData.id = saved.id;
    }
    
    // 2. Route to Chamber
    this.onCreateSession(this.sessionData);
  }

  handleGlobalUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
        const success = MemoryCore.saveGlobalImage(e.target.result);
        if (success) {
            this.updateGlobalPoolList();
        } else {
            alert('Failed to save to Global Pool. Image may be too large or storage quota exceeded.');
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
    if (this.viPanel) {
      this.viPanel.destroy();
    }
    // Remove keyboard listener using the stored bound reference
    document.removeEventListener('keydown', this.boundKeyboardHandler);
  }
}
