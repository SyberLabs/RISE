/**
 * Chamber Orbital Component
 * Fidget spinner interface for session configuration
 *
 * Design: 3 orbit nodes (Visual, Audio, Temporal) around central TEXT
 * - Each orbit shows collapsed state
 * - Click to expand modal with full controls
 * - Drag handles to rotate entire structure (aesthetic only)
 */

import { VisualInterlocutionPanel } from './VisualInterlocutionPanel.js';
import { PersonalSwells } from '../core/personal-swells.js';
import { namingModal } from './NamingModal.js';
import './VisualInterlocutionPanel.css';

export class ChamberOrbital {
  constructor(container, options = {}) {
    console.log('[ChamberOrbital] Constructor called', container, options);
    this.container = container;
    this.onBeginSession = options.onBeginSession || (() => { });
    this.onNavigate = options.onNavigate || (() => { });

    // Session configuration state
    this.config = {
      text: null,
      textSource: null, // 'drop', 'paste', 'library', 'starter'

      // Visual orbit - new 3-way mode structure
      visualInterlocution: {
        // Top-level mode: 'off' | 'focals' | 'interlocution'
        visualMode: 'off',

        // Focals config (persistent gentle focal point)
        focals: {
          type: 'standard',
          standardGlyph: 'breath',
          personalImage: null
        },

        // Interlocution config (probabilistic interrupts)
        interlocution: {
          procedural: ['klee', 'turrell'],
          sourced: [],
          frequency: 0.2,
          duration: 80,
          kleePreset: 'random'
        }
      },

      // Audio orbit
      audioPreset: 'silent',
      entrainmentMode: 'binaural',
      entrainmentWaveform: 'sine',
      voiceEnabled: false,
      voiceId: null,
      selectedSwellId: null,

      // Temporal orbit
      wpm: 220,
      curve: 'flat',
      chunkMode: 'word'
    };

    // Active modal
    this.activeModal = null;

    // Visual interlocution panel instance
    this.viPanel = null;

    this.render();
    this.attachEvents();
  }

  update(data) {
    console.log('[ChamberOrbital] update called with hot-payload:', data);
    if (data && data.text) {
      this.loadText(data.text, data.source || 'Library', data.config);
    }
    // Always refresh swells when view is updated/re-entered
    this.renderPersonalPool();
  }

  render() {
    console.log('[ChamberOrbital] Rendering HTML to container');
    this.container.innerHTML = `
      <div class="chamber-orbital" role="main">
        <!-- Back button -->
        <button class="orbital-back btn-ghost" data-action="back">
          <span class="icon">←</span>
          <span>Portal</span>
        </button>

        <!-- Orbital Interface -->
        <div class="orbital-stage">
          <!-- Orbit container -->
          <div class="orbit-container" id="orbit-container">

            <!-- Temporal Orbit (top) - Master dimension -->
            <div class="orbit-node orbit-temporal" data-orbit="temporal">
              <div class="orbit-content">
                <div class="orbit-label text-fog">Temporal</div>
                <div class="orbit-status text-light">${this.getTemporalStatus()}</div>
              </div>
            </div>

            <!-- Audio Orbit (bottom-left) - Sonic layer -->
            <div class="orbit-node orbit-audio" data-orbit="audio">
              <div class="orbit-content">
                <div class="orbit-label text-fog">Audio</div>
                <div class="orbit-status text-light">${this.getAudioStatus()}</div>
              </div>
            </div>

            <!-- Visual Orbit (bottom-right) - Visual layer -->
            <div class="orbit-node orbit-visual" data-orbit="visual">
              <div class="orbit-content">
                <div class="orbit-label text-fog">Visual</div>
                <div class="orbit-status text-light">${this.getVisualPreview()}</div>
              </div>
            </div>
          </div>

          <!-- Center: TEXT -->
          <div class="orbit-center" id="orbit-center">
            <div class="text-source" id="text-source">
              ${this.renderTextSource()}
            </div>
          </div>
        </div>

        <!-- Begin Button -->
        <div class="orbital-actions">
          <button class="btn-primary btn-large" id="begin-btn" ${!this.config.text ? 'disabled' : ''}>
            ${this.config.text ? 'Begin Session' : 'Load Text First'}
          </button>
        </div>

        <!-- Modals (hidden by default) -->
        <div class="orbital-modals">
          ${this.renderModals()}
        </div>
      </div>
    `;

    this.initVisualPanel();
  }

  renderTextSource() {
    if (this.config.text) {
      return `
        <div class="text-loaded">
          <div class="text-sigil">文</div>
          <div class="text-info">
            <div class="text-name text-light">${this.config.textSource || 'Text Loaded'}</div>
            <div class="text-meta text-fog">${this.getWordCount()} words</div>
          </div>
          <button class="text-clear btn-ghost-sm" data-action="clear-text">✕</button>
        </div>
      `;
    }

    return `
      <div class="text-empty">
        <button class="text-choose-btn" data-action="library">
          <span class="choose-sigil">無</span>
          <span class="choose-label">Choose Text</span>
        </button>
      </div>
    `;
  }

  renderModals() {
    return `
      <!-- Visual Modal -->
      <div class="orbital-modal" id="modal-visual" hidden>
        <div class="modal-content">
          <div class="modal-header">
            <h2>Visual Configuration</h2>
            <button class="modal-close" data-close="visual">✕</button>
          </div>
          <div class="modal-body">
            <!-- Visual Interlocution -->
            <div id="orbital-vi-panel-container" class="config-section"></div>
          </div>
        </div>
      </div>

      <!-- Audio Modal -->
      <div class="orbital-modal" id="modal-audio" hidden>
        <div class="modal-content">
          <div class="modal-header">
            <h2>Audio Configuration</h2>
            <button class="modal-close" data-close="audio">✕</button>
          </div>
          <div class="modal-body">
            <!-- Audio Preset -->
            <div class="config-section">
              <div class="config-label-row">
                <label class="config-label">Audio Preset</label>
                <span class="config-info" data-tooltip="Presets target specific brainwave frequencies. Focus (Alpha 10Hz) enhances concentration. Deep (Theta 6Hz) promotes meditation. Gateway (Delta 2Hz) yields deep flow states.">?</span>
              </div>
              <div class="audio-preset-options">
                <button class="audio-preset-option ${this.config.audioPreset === 'silent' ? 'active' : ''}" data-preset="silent">
                  <span class="preset-icon">○</span>
                  <span class="preset-label">Silent</span>
                </button>
                <button class="audio-preset-option ${this.config.audioPreset === 'focus' ? 'active' : ''}" data-preset="focus">
                  <span class="preset-icon">◇</span>
                  <span class="preset-label">Focus</span>
                </button>
                <button class="audio-preset-option ${this.config.audioPreset === 'deep' ? 'active' : ''}" data-preset="deep">
                  <span class="preset-icon">◈</span>
                  <span class="preset-label">Deep</span>
                </button>
                <button class="audio-preset-option ${this.config.audioPreset === 'gateway' ? 'active' : ''}" data-preset="gateway">
                  <span class="preset-icon">⬡</span>
                  <span class="preset-label">Gateway</span>
                </button>
              </div>
            </div>

            <!-- Entrainment Type -->
            <div class="config-section">
              <div class="config-label-row">
                <label class="config-label">Entrainment Type</label>
                <span class="config-info" data-tooltip="The method used to deliver frequency stimulation. Binaural requires headphones (different tones per ear). Monaural works on speakers. Isochronic uses rhythmic pulses. Spatial rotates the sound field around your head.">?</span>
              </div>
              <div class="audio-mode-options">
                <button class="audio-mode-option ${this.config.entrainmentMode === 'binaural' ? 'active' : ''}" data-entrainment="binaural">Binaural</button>
                <button class="audio-mode-option ${this.config.entrainmentMode === 'monaural' ? 'active' : ''}" data-entrainment="monaural">Monaural</button>
                <button class="audio-mode-option ${this.config.entrainmentMode === 'isochronic' ? 'active' : ''}" data-entrainment="isochronic">Isochronic</button>
                <button class="audio-mode-option ${this.config.entrainmentMode === 'spatial' ? 'active' : ''}" data-entrainment="spatial">Spatial</button>
              </div>
            </div>

            <!-- Waveform -->
            <div class="config-section">
              <div class="config-label-row">
                <label class="config-label">Waveform</label>
                <span class="config-info" data-tooltip="The shape of the audio wave. Sine is smooth and gentle. Triangle adds subtle harmonic texture. Saw is brighter and more present.">?</span>
              </div>
              <div class="audio-waveform-options">
                <button class="audio-waveform-option ${this.config.entrainmentWaveform === 'sine' ? 'active' : ''}" data-waveform="sine">Sine</button>
                <button class="audio-waveform-option ${this.config.entrainmentWaveform === 'triangle' ? 'active' : ''}" data-waveform="triangle">Triangle</button>
                <button class="audio-waveform-option ${this.config.entrainmentWaveform === 'sawtooth' ? 'active' : ''}" data-waveform="sawtooth">Saw</button>
              </div>
            </div>
            <!-- Voice -->
            <div class="config-section">
              <label class="toggle">
                <input type="checkbox" id="voice-toggle" ${this.config.voiceEnabled ? 'checked' : ''}>
                <span class="toggle-switch"></span>
                <span class="toggle-label">Text-to-Speech</span>
              </label>
            </div>

            <!-- Voice Selection (shown when TTS enabled) -->
            <div class="config-section voice-select-section" id="voice-select-section" ${this.config.voiceEnabled ? '' : 'hidden'}>
              <label class="config-label">Voice</label>
              <select id="voice-select" class="voice-select">
                <option value="">System Default</option>
              </select>
            </div>

            <!-- Personal Swell Pool -->
            <div class="config-section">
              <div class="section-header-row">
                <label class="config-label">Personal Swell Pool</label>
                <div class="pool-actions">
                  <label class="pool-upload-btn" title="Upload MP3 Swell">
                    <span>+</span>
                    <input type="file" id="swell-upload" accept="audio/mpeg,audio/mp3" hidden>
                  </label>
                </div>
              </div>
              <div id="personal-swell-list" class="personal-swell-list">
                <!-- Swells rendered dynamically -->
                <div class="pool-empty">No personal swells uploaded.</div>
              </div>
              <p class="config-note">Users can upload high-quality synth swells to be used randomly in the session atmosphere.</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Temporal Modal -->
      <div class="orbital-modal" id="modal-temporal" hidden>
        <div class="modal-content">
          <div class="modal-header">
            <h2>Temporal Configuration</h2>
            <button class="modal-close" data-close="temporal">✕</button>
          </div>
          <div class="modal-body">
            <!-- Pacing -->
            <div class="config-section">
              <label class="input-label">
                <span>Pacing</span>
                <span class="input-label-value font-mono" id="wpm-val">${this.config.wpm} WPM</span>
              </label>
              <input type="range" id="wpm-slider" class="slider" min="100" max="500" value="${this.config.wpm}" step="10">
              <div class="config-notice text-fog font-mono" style="font-size: 9px; margin-top: 0.5rem; opacity: 0.7;">
                ◊ Adjustable in-chamber via Arrow Keys
              </div>
            </div>

            <!-- Curve -->
            <div class="config-section">
              <label class="config-label">Pacing Curve</label>
              <div class="curve-options">
                <button class="curve-option ${this.config.curve === 'flat' ? 'active' : ''}" data-curve="flat">
                  <span class="curve-icon">─</span>
                  <span>Flat</span>
                </button>
                <button class="curve-option ${this.config.curve === 'induction' ? 'active' : ''}" data-curve="induction">
                  <span class="curve-icon">╲</span>
                  <span>Induction</span>
                </button>
                <button class="curve-option ${this.config.curve === 'ascent' ? 'active' : ''}" data-curve="ascent">
                  <span class="curve-icon">╱</span>
                  <span>Ascent</span>
                </button>
                <button class="curve-option ${this.config.curve === 'wave' ? 'active' : ''}" data-curve="wave">
                  <span class="curve-icon">∿</span>
                  <span>Wave</span>
                </button>
                <button class="curve-option ${this.config.curve === 'climax' ? 'active' : ''}" data-curve="climax">
                  <span class="curve-icon">∧</span>
                  <span>Climax</span>
                </button>
              </div>
            </div>

            <!-- Chunking -->
            <div class="config-section">
              <label class="config-label">Chunking Mode</label>
              <div class="chunk-options">
                <button class="chunk-option ${this.config.chunkMode === 'word' ? 'active' : ''}" data-chunk="word">Word</button>
                <button class="chunk-option ${this.config.chunkMode === 'phrase' ? 'active' : ''}" data-chunk="phrase">Phrase</button>
                <button class="chunk-option ${this.config.chunkMode === 'sentence' ? 'active' : ''}" data-chunk="sentence">Sentence</button>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  initVisualPanel() {
    try {
      const container = this.container.querySelector('#orbital-vi-panel-container');
      console.log('[ChamberOrbital] initVisualPanel - container found:', !!container);
      if (!container) {
        console.error('[ChamberOrbital] orbital-vi-panel-container not found in DOM!');
        return;
      }
      if (!this.viPanel) {
        console.log('[ChamberOrbital] Instantiating VisualInterlocutionPanel...');
        this.viPanel = new VisualInterlocutionPanel(container, {
          ...this.config.visualInterlocution,
          expanded: true,
          locked: !this.config.text,
          lockedMessage: 'Please load a text source first to configure Visuals.',
          onChange: (config, activeTypes) => {
            this.config.visualInterlocution = { ...config, activeTypes };
            this.updateOrbitStatus('visual');
          }
        });
        console.log('[ChamberOrbital] InnerHTML after instantiation length:', container.innerHTML.length);
      }
    } catch (err) {
      console.error('[ChamberOrbital] Error initializing viPanel:', err);
    }
  }

  getVisualPreview() {
    if (!this.config) return '◎ Configuration missing';

    const vi = this.config.visualInterlocution;
    const mode = vi?.visualMode || 'off';

    if (mode === 'focals') {
      const glyph = vi.focals?.type === 'personal' ? 'Personal' : this.capitalizeFirst(vi.focals?.standardGlyph || 'breath');
      return `◯ Focals · ${glyph}`;
    }

    if (mode === 'interlocution') {
      return `◈ Rhythmic`;
    }

    return `◎ Off`;
  }

  getAudioStatus() {
    const preset = this.capitalizeFirst(this.config.audioPreset);
    const hasSwell = !!this.config.selectedSwellId;
    const hasPreset = this.config.audioPreset !== 'silent';

    if (hasSwell && hasPreset) {
      return `○ Mixed`;
    }
    if (hasSwell) {
      return `○ Personal`;
    }
    return `○ ${preset}`;
  }

  getTemporalStatus() {
    return `${this.config.wpm} WPM`;
  }

  getWordCount() {
    if (!this.config.text) return 0;
    return this.config.text.split(/\s+/).filter(w => w.length > 0).length;
  }

  capitalizeFirst(str) {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }

  attachEvents() {
    // Back button
    this.container.querySelector('[data-action="back"]')?.addEventListener('click', () => {
      window.rise?.audioEngine?.playClick();
      this.onNavigate('portal');
    });

    // Text source actions
    this.attachTextSourceEvents();

    // Orbit node clicks
    this.attachOrbitEvents();

    // Begin button
    this.container.querySelector('#begin-btn')?.addEventListener('click', () => {
      if (this.config.text) {
        window.rise?.audioEngine?.playClick();
        this.beginSession();
      }
    });

    // Modal events
    this.attachModalEvents();
  }

  attachTextSourceEvents() {
    // Browse library (single entry point)
    this.container.querySelector('[data-action="library"]')?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.onNavigate('library');
    });

    // Clear text
    this.container.querySelector('[data-action="clear-text"]')?.addEventListener('click', () => {
      window.rise?.audioEngine?.playHiss();
      this.clearText();
    });
  }

  attachOrbitEvents() {
    const nodes = this.container.querySelectorAll('.orbit-node');
    nodes.forEach(node => {
      node.addEventListener('click', () => {
        window.rise?.audioEngine?.playClick();
        const orbit = node.dataset.orbit;
        this.openModal(orbit);
      });
    });
  }


  attachModalEvents() {
    // Close buttons
    const closeBtns = this.container.querySelectorAll('.modal-close');
    closeBtns.forEach(btn => {
      btn.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.closeModal(btn.dataset.close);
      });
    });

    // Click outside to close
    const modals = this.container.querySelectorAll('.orbital-modal');
    modals.forEach(modal => {
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          const modalId = modal.id.replace('modal-', '');
          this.closeModal(modalId);
        }
      });
    });

    // Visual modal controls
    this.attachVisualModalEvents();

    // Audio modal controls
    this.attachAudioModalEvents();

    // Temporal modal controls
    this.attachTemporalModalEvents();
  }

  attachVisualModalEvents() {
    // VI Panel handles its own events
  }

  async renderPersonalPool() {
    const listEl = this.container.querySelector('#personal-swell-list');
    if (!listEl) return;

    const swells = await PersonalSwells.getAll();
    
    if (swells.length === 0) {
      listEl.innerHTML = '<div class="pool-empty">No personal swells uploaded.</div>';
      return;
    }

    listEl.innerHTML = swells.map(swell => {
      const isSelected = this.config.selectedSwellId === swell.id;
      return `
        <div class="swell-item ${isSelected ? 'selected' : ''}" data-id="${swell.id}">
          <span class="swell-name" title="${swell.name}">${swell.name}</span>
          <div class="swell-actions">
            <button class="swell-btn preview-btn" data-action="preview" title="Preview Swell">▶</button>
            <button class="swell-btn delete-btn" data-action="delete" title="Delete Swell">✕</button>
          </div>
        </div>
      `;
    }).join('');

    // Attach row events (Selection)
    listEl.querySelectorAll('.swell-item').forEach(row => {
      row.addEventListener('click', (e) => {
        // Only select if we didn't click a button
        if (e.target.closest('.swell-btn')) return;
        
        const id = row.dataset.id;
        if (this.config.selectedSwellId === id) {
          this.config.selectedSwellId = null; // Deselect if already selected
        } else {
          this.config.selectedSwellId = id;
        }
        
        if (window.rise?.audioEngine) window.rise.audioEngine.playClick();
        this.renderPersonalPool();
        this.updateOrbitStatus('audio');
      });
    });

    // Attach button events (Delete / Preview)
    listEl.querySelectorAll('.swell-btn').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation(); // Prevent row selection
        const id = btn.closest('.swell-item').dataset.id;
        const action = btn.dataset.action;

        if (action === 'delete') {
          if (window.rise?.audioEngine) window.rise.audioEngine.playHiss();
          await PersonalSwells.removeSwell(id);
          if (this.config.selectedSwellId === id) this.config.selectedSwellId = null;
          if (window.rise?.audioEngine) await window.rise.audioEngine.reloadPersonalSwells();
          this.renderPersonalPool();
          this.updateOrbitStatus('audio');
        } else if (action === 'preview') {
          if (window.rise?.audioEngine) {
            // Targeted preview!
            window.rise.audioEngine.playSwell(id);
          }
        }
      });
    });
  }

  attachAudioModalEvents() {
    // Audio preset
    const presetOptions = this.container.querySelectorAll('[data-preset]');
    presetOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.audioPreset = opt.dataset.preset;
        this.updateOrbitStatus('audio');
        presetOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });


    // Entrainment mode
    const entrainmentOptions = this.container.querySelectorAll('[data-entrainment]');
    entrainmentOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.entrainmentMode = opt.dataset.entrainment;
        this.updateOrbitStatus('audio');
        entrainmentOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    // Waveform
    const waveformOptions = this.container.querySelectorAll('[data-waveform]');
    waveformOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        window.rise?.audioEngine?.playClick();
        this.config.entrainmentWaveform = opt.dataset.waveform;
        this.updateOrbitStatus('audio');
        waveformOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });


    // Initial active states
    this.container.querySelectorAll('[data-entrainment]').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.entrainment === this.config.entrainmentMode);
    });
    this.container.querySelectorAll('[data-waveform]').forEach(opt => {
      opt.classList.toggle('active', opt.dataset.waveform === this.config.entrainmentWaveform);
    });

    // Voice toggle
    const voiceToggle = this.container.querySelector('#voice-toggle');
    const voiceSelectSection = this.container.querySelector('#voice-select-section');
    const voiceSelect = this.container.querySelector('#voice-select');

    voiceToggle?.addEventListener('change', () => {
      window.rise?.audioEngine?.playClick();
      this.config.voiceEnabled = voiceToggle.checked;
      // Show/hide voice selector
      if (voiceSelectSection) {
        voiceSelectSection.hidden = !voiceToggle.checked;
      }
      // Populate voices if enabling
      if (voiceToggle.checked && voiceSelect) {
        this.populateVoices(voiceSelect);
      }
      this.updateOrbitStatus('audio');
    });

    // Voice selection change
    voiceSelect?.addEventListener('change', () => {
      this.config.voiceId = voiceSelect.value;
      this.updateOrbitStatus('audio');
    });

    // Pre-populate voices if TTS is already enabled
    if (this.config.voiceEnabled && voiceSelect) {
      this.populateVoices(voiceSelect);
    }

    // Personal Pool Upload
    const swellUpload = this.container.querySelector('#swell-upload');
    swellUpload?.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file) return;

      if (window.rise?.audioEngine) window.rise.audioEngine.playHiss();
      
      const displayName = await namingModal.show(file.name, 'Name Swell', 'Atmospheric Metadata');
      if (!displayName) {
        swellUpload.value = '';
        return;
      }
      
      try {
        await PersonalSwells.addSwell(file, displayName);
        if (window.rise?.audioEngine) {
          await window.rise.audioEngine.reloadPersonalSwells();
        }
        this.renderPersonalPool();
      } catch (err) {
        console.error('[Orbital] Upload failed:', err);
      }

      // Reset input
      swellUpload.value = '';
    });

    // Initial render of pool
    this.renderPersonalPool();
  }

  async populateVoices(selectEl) {
    // Get voices from SpeechSynthesis API
    const synth = window.speechSynthesis;
    if (!synth) {
      console.warn('[ChamberOrbital] SpeechSynthesis not available');
      return;
    }

    const getVoices = () => {
      return new Promise((resolve) => {
        let voices = synth.getVoices();
        if (voices.length > 0) {
          resolve(voices);
          return;
        }
        // Chrome loads voices async
        synth.onvoiceschanged = () => {
          resolve(synth.getVoices());
        };
        // Fallback timeout
        setTimeout(() => resolve(synth.getVoices()), 100);
      });
    };

    const voices = await getVoices();

    // Clear existing options except default
    selectEl.innerHTML = '<option value="">System Default</option>';

    // Group voices by language
    const grouped = {};
    voices.forEach(voice => {
      const lang = voice.lang.split('-')[0].toUpperCase();
      if (!grouped[lang]) grouped[lang] = [];
      grouped[lang].push(voice);
    });

    // Add grouped options
    Object.keys(grouped).sort().forEach(lang => {
      const optgroup = document.createElement('optgroup');
      optgroup.label = lang;
      grouped[lang].forEach(voice => {
        const option = document.createElement('option');
        option.value = voice.name;
        option.textContent = `${voice.name} ${voice.localService ? '' : '(Online)'}`;
        if (this.config.voiceId === voice.name) {
          option.selected = true;
        }
        optgroup.appendChild(option);
      });
      selectEl.appendChild(optgroup);
    });
  }

  attachTemporalModalEvents() {
    // WPM slider
    const wpmSlider = this.container.querySelector('#wpm-slider');
    const wpmVal = this.container.querySelector('#wpm-val');
    wpmSlider?.addEventListener('input', () => {
      this.config.wpm = parseInt(wpmSlider.value, 10);
      wpmVal.textContent = `${wpmSlider.value} WPM`;
      this.updateOrbitStatus('temporal');
    });

    // Curve options
    const curveOptions = this.container.querySelectorAll('[data-curve]');
    curveOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.curve = opt.dataset.curve;
        curveOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });

    // Chunk mode
    const chunkOptions = this.container.querySelectorAll('[data-chunk]');
    chunkOptions.forEach(opt => {
      opt.addEventListener('click', () => {
        window.rise?.audioEngine?.playHiss();
        this.config.chunkMode = opt.dataset.chunk;
        chunkOptions.forEach(o => o.classList.remove('active'));
        opt.classList.add('active');
      });
    });
  }

  openModal(orbit) {
    const modal = this.container.querySelector(`#modal-${orbit}`);
    if (modal) {
      modal.hidden = false;
      this.activeModal = orbit;
    }
  }

  closeModal(orbit) {
    const modal = this.container.querySelector(`#modal-${orbit}`);
    if (modal) {
      modal.hidden = true;
      this.activeModal = null;
    }
  }

  updateOrbitStatus(orbit) {
    const node = this.container.querySelector(`.orbit-${orbit}`);
    if (!node) return;

    const statusEl = node.querySelector('.orbit-status');
    if (!statusEl) return;

    let status = '';
    switch (orbit) {
      case 'visual':
        status = this.getVisualPreview();
        break;
      case 'audio':
        status = this.getAudioStatus();
        break;
      case 'temporal':
        status = this.getTemporalStatus();
        break;
    }

    statusEl.textContent = status;
  }

  syncUIWithConfig() {
    // Temporal Modal
    const wpmSlider = this.container.querySelector('#wpm-slider');
    const wpmVal = this.container.querySelector('#wpm-val');
    if (wpmSlider && wpmVal) {
      wpmSlider.value = this.config.wpm;
      wpmVal.textContent = `${this.config.wpm} WPM`;
    }

    const curveOptions = this.container.querySelectorAll('[data-curve]');
    curveOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.curve === this.config.curve);
    });

    const chunkOptions = this.container.querySelectorAll('[data-chunk]');
    chunkOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.chunk === this.config.chunkMode);
    });

    // Audio Modal
    const presetOptions = this.container.querySelectorAll('[data-preset]');
    presetOptions.forEach(opt => {
      opt.classList.toggle('active', opt.dataset.preset === this.config.audioPreset);
    });

    // Voice toggle
    const voiceToggle = this.container.querySelector('#voice-toggle');
    if (voiceToggle) {
      voiceToggle.checked = !!this.config.voiceEnabled;
    }
  }

  loadText(text, source, config = {}) {
    console.log('[ChamberOrbital] loadText called', { text: text?.substring(0, 50), source, config });
    this.config.text = text;
    this.config.textSource = source;

    // Apply optional config parameters from source
    if (config.wpm) this.config.wpm = config.wpm;
    if (config.curve) this.config.curve = config.curve;
    if (config.audioPreset) this.config.audioPreset = config.audioPreset;
    if (config.entrainmentMode) this.config.entrainmentMode = config.entrainmentMode;
    if (config.entrainmentWaveform) this.config.entrainmentWaveform = config.entrainmentWaveform;

    // Apply visual configuration from archetype/source
    if (config.visualConfig) {
      console.log('[ChamberOrbital] Applying visualConfig from source:', config.visualConfig);
      this.config.visualInterlocution = {
        ...this.config.visualInterlocution,
        visualMode: config.visualConfig.visualMode || 'off',
        focals: config.visualConfig.focals || this.config.visualInterlocution.focals,
        interlocution: {
          ...this.config.visualInterlocution.interlocution,
          ...(config.visualConfig.interlocution || {})
        }
      };

      // Update the VisualInterlocutionPanel if it exists
      if (this.viPanel) {
        this.viPanel.setConfig(config.visualConfig);
      }
    }

    // Sync HTML modal elements with new config state
    this.syncUIWithConfig();

    // Update UI state for all orbits
    this.updateOrbitStatus('temporal');
    this.updateOrbitStatus('audio');
    this.updateOrbitStatus('visual');

    // Unlock visual interlocution
    if (this.viPanel) {
      this.viPanel.setLocked(false);
    }

    // Re-render text source area
    const textSourceEl = this.container.querySelector('#text-source');
    console.log('[ChamberOrbital] textSourceEl found:', !!textSourceEl);
    if (textSourceEl) {
      textSourceEl.innerHTML = this.renderTextSource();
      this.attachTextSourceEvents();
      console.log('[ChamberOrbital] Text source area re-rendered');
    }

    // Enable begin button
    const beginBtn = this.container.querySelector('#begin-btn');
    if (beginBtn) {
      beginBtn.disabled = false;
      beginBtn.textContent = 'Begin Session';
      console.log('[ChamberOrbital] Begin button enabled');
    }

    // Refresh personal pool to sync with any changes made in Workshop
    this.renderPersonalPool();
  }

  clearText() {
    this.config.text = null;
    this.config.textSource = null;

    // Lock visual interlocution again
    if (this.viPanel) {
      this.viPanel.setLocked(true);
      this.updateOrbitStatus('visual');
    }

    // Re-render text source area
    const textSourceEl = this.container.querySelector('#text-source');
    if (textSourceEl) {
      textSourceEl.innerHTML = this.renderTextSource();
      this.attachTextSourceEvents();
    }

    // Disable begin button
    const beginBtn = this.container.querySelector('#begin-btn');
    if (beginBtn) {
      beginBtn.disabled = true;
      beginBtn.textContent = 'Load Text First';
    }
  }

  beginSession() {
    // Build session data from config
    const vi = this.config.visualInterlocution;
    const sessionData = {
      text: this.config.text,
      textSource: this.config.textSource,
      wpm: this.config.wpm,
      curve: this.config.curve,
      chunkMode: this.config.chunkMode,
      audioPreset: this.config.audioPreset,
      entrainmentMode: this.config.entrainmentMode,
      entrainmentWaveform: this.config.entrainmentWaveform,
      voiceEnabled: this.config.voiceEnabled,
      voiceId: this.config.voiceId,
      selectedSwellId: this.config.selectedSwellId,
      visualConfig: {
        visualMode: vi.visualMode || 'off',
        focals: vi.focals || { type: 'standard', standardGlyph: 'breath', personalImage: null },
        interlocution: {
          ...(vi.interlocution || {}),
          procedural: vi.activeTypes || vi.interlocution?.procedural || ['klee', 'turrell'],
          sourced: vi.interlocution?.sourced || [],
          frequency: vi.interlocution?.frequency ?? 0.2,
          duration: vi.interlocution?.duration ?? 80,
          kleePreset: vi.interlocution?.kleePreset || 'random'
        }
      }
    };

    this.onBeginSession(sessionData);
  }

  destroy() {
    // Cleanup
    if (this.viPanel) {
      this.viPanel.destroy();
    }
  }
}

