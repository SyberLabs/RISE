/**
 * R.I.S.E. — Main Application Entry
 * Recursive Installation of Symbolic Experience
 */

import './style.css';
import { Source, Session } from './core/models.js';
import { chunkText, countWords, estimateDuration } from './core/chunker.js';
import { Player } from './core/player.js';
import { DisplayManager } from './display/modes.js';
import { audioEngine, LAYER_PRESETS, BRAINWAVE_BANDS } from './audio/engine.js';
import { PacingEngine, StateCurve } from './core/pacing.js';
import { STARTER_SEQUENCES, SEQUENCE_CATEGORIES } from './content/starters.js';
import { LIBRARY_CATEGORIES, getAllTexts, getTextsByCategory, getTextById } from './content/library.js';
import './content/texts/tao-te-ching.js'; // Register Tao Te Ching
import './content/texts/heart-sutra.js'; // Register Heart Sutra
import './content/texts/yoga-sutras.js'; // Register Yoga Sutras
import './content/texts/gospel-of-thomas.js'; // Register Gospel of Thomas
import './content/texts/upanishads.js'; // Register Upanishads
import './content/texts/hermetica.js'; // Register Hermetica

/**
 * Application state
 */
const state = {
  source: null,
  session: null,
  player: null,
  displayManager: null,
  pacingEngine: new PacingEngine(),
  wpm: 220,
  chunkMode: 'word',
  displayMode: 'focal',
  audioEnabled: false,
  audioPreset: 'silent',  // silent, focus, deep, gateway
  voiceEnabled: false,    // TTS voice synthesis
  curveType: 'flat'  // flat, induction, ascent, wave, climax
};

/**
 * DOM Elements
 */
const elements = {
  // Views
  builder: document.getElementById('builder'),
  chamber: document.getElementById('chamber'),
  review: document.getElementById('review'),

  // Builder
  dropZone: document.getElementById('drop-zone'),
  fileInput: document.getElementById('file-input'),
  sourceInfo: document.getElementById('source-info'),
  sourceName: document.getElementById('source-name'),
  sourceStats: document.getElementById('source-stats'),
  wpmSlider: document.getElementById('wpm-slider'),
  wpmValue: document.getElementById('wpm-value'),
  chunkOptions: document.querySelectorAll('.chunk-option'),
  modeOptions: document.querySelectorAll('.mode-option'),
  audioPresetOptions: document.querySelectorAll('.audio-preset-option'),
  audioLayers: document.getElementById('audio-layers'),
  layerToggles: document.querySelectorAll('.layer-toggle'),
  curveOptions: document.querySelectorAll('.curve-option'),
  enterButton: document.getElementById('enter-button'),

  // Chamber
  chamberField: document.querySelector('.chamber-field'),
  atomDisplay: document.getElementById('atom-display'),
  playPauseBtn: document.getElementById('play-pause-btn'),
  stopBtn: document.getElementById('stop-btn'),
  progressBar: document.getElementById('progress-bar'),
  volumeBtn: document.getElementById('volume-btn'),
  volumeFill: document.getElementById('volume-fill'),
  timeDisplay: document.getElementById('time-display'),
  iconPlay: document.querySelector('.icon-play'),
  iconPause: document.querySelector('.icon-pause'),

  // Review
  reviewSessionName: document.getElementById('review-session-name'),
  statDuration: document.getElementById('stat-duration'),
  statAtoms: document.getElementById('stat-atoms'),
  statWpm: document.getElementById('stat-wpm'),
  repeatBtn: document.getElementById('repeat-btn'),
  newSessionBtn: document.getElementById('new-session-btn'),

  // Starters Sidebar
  startersSidebar: document.getElementById('starters-sidebar'),
  startersList: document.getElementById('starters-list'),
  startersToggle: document.getElementById('starters-toggle'),
  closeSidebar: document.getElementById('close-sidebar'),
  sidebarOverlay: document.getElementById('sidebar-overlay'),

  // Voice Controls
  voiceToggle: document.getElementById('voice-toggle'),
  voiceStatus: document.getElementById('voice-status'),
  voiceSelect: document.getElementById('voice-select'),

  // Toast
  toastContainer: document.getElementById('toast-container'),

  // Chunk options container (for locking)
  chunkOptionsContainer: document.querySelector('.chunk-options'),

  // Library
  libraryToggle: document.getElementById('library-toggle'),
  libraryModal: document.getElementById('library-modal'),
  libraryClose: document.getElementById('close-library'),
  libraryCategories: document.getElementById('library-categories'),
  libraryTexts: document.getElementById('library-texts'),
  libraryVerses: document.getElementById('library-verses'),

  // Audio Layers
  audioModal: document.getElementById('audio-modal'),
  audioClose: document.getElementById('audio-close'),
  sundialNodes: document.querySelectorAll('.sundial-node'),
  sundialCenter: document.querySelector('.sundial-center'),
  audioFaders: document.querySelectorAll('.vertical-fader'),
  audioPresetButtons: document.querySelectorAll('.btn-preset'),
  audioLayersButton: null // Will create dynamically
};

/**
 * View management
 */
function showView(viewName) {
  const views = ['builder', 'chamber', 'review'];
  views.forEach(name => {
    const el = elements[name];
    if (name === viewName) {
      el.hidden = false;
      el.classList.remove('fade-out');
    } else {
      el.hidden = true;
    }
  });
}

/**
 * Format time in M:SS
 * @param {number} ms 
 * @returns {string}
 */
function formatTime(ms) {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Show a toast notification
 * @param {string} message - Message to display
 * @param {number} duration - Duration in ms (default 3000)
 */
function showToast(message, duration = 3000) {
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = message;
  elements.toastContainer.appendChild(toast);

  // Auto-remove
  setTimeout(() => {
    toast.classList.add('fade-out');
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

/**
 * Update source display
 */
function updateSourceDisplay() {
  if (!state.source) {
    elements.sourceInfo.hidden = true;
    elements.enterButton.disabled = true;
    return;
  }

  const wordCount = countWords(state.source.raw);
  const duration = estimateDuration(state.source.raw, state.wpm);

  elements.sourceName.textContent = state.source.name;
  elements.sourceStats.textContent = `${wordCount} words · ~${formatTime(duration)}`;
  elements.sourceInfo.hidden = false;
  elements.enterButton.disabled = false;
}

/**
 * Handle file loading
 * @param {File} file 
 */
async function loadFile(file) {
  const text = await file.text();
  state.source = new Source({
    name: file.name,
    type: 'file',
    raw: text
  });
  updateSourceDisplay();
}

/**
 * Compile session from source
 */
function compileSession() {
  if (!state.source) return null;

  // Set the pacing curve based on selection
  const curveMap = {
    flat: StateCurve.flat(),
    induction: StateCurve.induction(),
    ascent: StateCurve.ascent(),
    wave: StateCurve.wave(),
    climax: StateCurve.climax()
  };
  state.pacingEngine.setStateCurve(curveMap[state.curveType] || StateCurve.flat());
  state.pacingEngine.setWpm(state.wpm);

  // Chunk the text into atoms
  // When voice is enabled, use phrase mode for natural speech flow
  const effectiveChunkMode = state.voiceEnabled ? 'phrase' : state.chunkMode;
  let atoms = chunkText(state.source.raw, {
    mode: effectiveChunkMode,
    wpm: state.wpm,
    source: state.source.id
  });

  // Apply pacing curve to atom durations
  atoms = state.pacingEngine.paceAtoms(atoms);

  state.session = new Session({
    name: state.source.name,
    sources: [state.source],
    atoms,
    wpm: state.wpm,
    chunkMode: state.chunkMode
  });

  console.log(`[Session] ${atoms.length} atoms, curve: ${state.curveType}${state.voiceEnabled ? `, voice: phrase mode` : ``}`);
  return state.session;
}

/**
 * Initialize display manager
 */
function initDisplayManager() {
  if (!state.displayManager) {
    state.displayManager = new DisplayManager(elements.chamberField);
  }

  // Set the selected display mode
  state.displayManager.setMode(state.displayMode);

  // If using chamber mode, sync entrainment frequency from audio preset
  if (state.displayMode === 'chamber' && state.audioEnabled && state.audioPreset !== 'silent') {
    const preset = LAYER_PRESETS[state.audioPreset];
    if (preset?.binaural?.enabled) {
      const bandName = preset.binaural.band || 'theta';
      const band = BRAINWAVE_BANDS[bandName];
      if (band) {
        const freq = band.default || (band.min + band.max) / 2;
        const chamberRenderer = state.displayManager.getRenderer('chamber');
        chamberRenderer?.setEntrainmentFrequency(freq / 10); // Slow it down for visual
      }
    }
  }
}

/**
 * Start audio for session
 */
async function startSessionAudio() {
  if (!state.audioEnabled || state.audioPreset === 'silent') return;

  await audioEngine.startSession({
    preset: state.audioPreset
  });
}

/**
 * Stop session audio
 */
function stopSessionAudio() {
  audioEngine.stopSession();
}

/**
 * Update layer toggle UI based on current preset
 */
function updateLayerUI() {
  const preset = LAYER_PRESETS[state.audioPreset];
  if (!preset) return;

  elements.layerToggles.forEach(toggle => {
    const layer = toggle.dataset.layer;
    const layerConfig = preset[layer];
    const isActive = layerConfig?.enabled || false;

    toggle.classList.toggle('active', isActive);
    const statusEl = toggle.querySelector('.layer-status');
    if (statusEl) statusEl.textContent = isActive ? 'on' : 'off';
  });
}

/**
 * Initialize voice dropdown with available voices
 */
async function initVoices() {
  if (!audioEngine.isVoiceAvailable()) {
    // Voice not available - hide controls
    elements.voiceToggle?.parentElement?.classList.add('hidden');
    return;
  }

  const voices = await audioEngine.getVoices();

  if (elements.voiceSelect && voices.length > 0) {
    elements.voiceSelect.innerHTML = '';

    // Add default option
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = 'System Default';
    elements.voiceSelect.appendChild(defaultOpt);

    // Group by language
    const byLang = {};
    voices.forEach(voice => {
      const lang = voice.lang.split('-')[0];
      if (!byLang[lang]) byLang[lang] = [];
      byLang[lang].push(voice);
    });

    // Prioritize English voices
    const langOrder = ['en', ...Object.keys(byLang).filter(l => l !== 'en').sort()];

    langOrder.forEach(lang => {
      if (!byLang[lang]) return;

      const group = document.createElement('optgroup');
      group.label = lang.toUpperCase();

      byLang[lang].forEach(voice => {
        const opt = document.createElement('option');
        opt.value = voice.name;
        opt.textContent = voice.name.replace(/Microsoft |Google |Apple /g, '');
        group.appendChild(opt);
      });

      elements.voiceSelect.appendChild(group);
    });

    console.log(`[Voice] Loaded ${voices.length} voices`);
  }
}

/**
 * Enter the chamber
 */
async function enterChamber() {
  const session = compileSession();
  if (!session) return;

  // Initialize display manager with selected mode
  initDisplayManager();

  // Create player
  state.player = new Player(session);

  // Wire up player events
  state.player.on('atom', ({ atom }) => {
    state.displayManager.render(atom);
  });

  state.player.on('progress', ({ progress, elapsed, remaining }) => {
    elements.progressBar.style.width = `${progress * 100}%`;
    elements.timeDisplay.textContent = `${formatTime(elapsed)} / ${formatTime(elapsed + remaining)}`;
  });

  state.player.on('state', ({ state: playerState }) => {
    updatePlayPauseButton(playerState);

    if (playerState === 'paused') {
      state.displayManager.setBreathing(true);
      audioEngine.pause();
    } else if (playerState === 'playing') {
      state.displayManager.setBreathing(false);
      audioEngine.unpause();
    }
  });

  state.player.on('complete', ({ duration, atomCount }) => {
    stopSessionAudio();
    audioEngine.stopSpeaking(); // Stop any ongoing speech
    showReview(duration, atomCount);
  });

  // Show chamber and start
  showView('chamber');

  // Start audio
  await startSessionAudio();

  // Configure voice sync if enabled
  if (state.voiceEnabled) {
    audioEngine.setVoiceRateFromWpm(state.wpm);
    state.player.setVoiceSync(true, (text, options) => {
      audioEngine.speak(text, options);
    });
  } else {
    state.player.setVoiceSync(false, null);
  }

  // Brief delay before starting
  setTimeout(() => {
    state.player.play();
  }, 500);
}

/**
 * Update play/pause button state
 * @param {string} playerState 
 */
function updatePlayPauseButton(playerState) {
  const isPlaying = playerState === 'playing';
  elements.iconPlay.hidden = isPlaying;
  elements.iconPause.hidden = !isPlaying;
}

/**
 * Exit chamber
 */
function exitChamber() {
  if (state.player) {
    state.player.destroy();
    state.player = null;
  }

  // Stop audio
  stopSessionAudio();

  // Clear display
  if (state.displayManager) {
    state.displayManager.clear();
    // Deactivate current mode (stops animations)
    state.displayManager.getRenderer(state.displayMode).deactivate();
  }

  elements.progressBar.style.width = '0%';

  showView('builder');
}

/**
 * Show review screen
 * @param {number} duration 
 * @param {number} atomCount 
 */
function showReview(duration, atomCount) {
  // Deactivate display mode
  if (state.displayManager) {
    state.displayManager.getRenderer(state.displayMode).deactivate();
  }

  elements.reviewSessionName.textContent = state.session.name;
  elements.statDuration.textContent = formatTime(duration);
  elements.statAtoms.textContent = atomCount;
  elements.statWpm.textContent = state.wpm;

  showView('review');
}

/**
 * Repeat the current session
 */
async function repeatSession() {
  if (!state.session) {
    showView('builder');
    return;
  }

  // Re-initialize display manager
  initDisplayManager();

  // Create new player with same session
  state.player = new Player(state.session);

  // Wire up events again
  state.player.on('atom', ({ atom }) => state.displayManager.render(atom));
  state.player.on('progress', ({ progress, elapsed, remaining }) => {
    elements.progressBar.style.width = `${progress * 100}%`;
    elements.timeDisplay.textContent = `${formatTime(elapsed)} / ${formatTime(elapsed + remaining)}`;
  });
  state.player.on('state', ({ state: playerState }) => {
    updatePlayPauseButton(playerState);
    if (playerState === 'paused') {
      state.displayManager.setBreathing(true);
      audioEngine.pause();
    } else if (playerState === 'playing') {
      state.displayManager.setBreathing(false);
      audioEngine.unpause();
    }
  });
  state.player.on('complete', ({ duration, atomCount }) => {
    stopSessionAudio();
    showReview(duration, atomCount);
  });

  showView('chamber');

  // Start audio
  await startSessionAudio();

  setTimeout(() => {
    state.player.play();
  }, 500);
}

/**
 * Update volume display
 * @param {number} volume 0-1
 */
function updateVolumeDisplay(volume) {
  if (elements.volumeFill) {
    elements.volumeFill.style.height = `${volume * 100}%`;
  }
}

/**
 * Initialize event listeners
 */
function initEventListeners() {
  // Drop zone
  elements.dropZone.addEventListener('click', () => {
    elements.fileInput.click();
  });

  elements.dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    elements.dropZone.classList.add('dragover');
  });

  elements.dropZone.addEventListener('dragleave', () => {
    elements.dropZone.classList.remove('dragover');
  });

  elements.dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    elements.dropZone.classList.remove('dragover');

    const file = e.dataTransfer.files[0];
    if (file && (file.type === 'text/plain' || file.name.endsWith('.txt') || file.name.endsWith('.md'))) {
      loadFile(file);
    }
  });

  elements.fileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) {
      loadFile(file);
    }
  });

  // WPM slider
  elements.wpmSlider.addEventListener('input', (e) => {
    state.wpm = parseInt(e.target.value, 10);
    elements.wpmValue.textContent = `${state.wpm} WPM`;
    updateSourceDisplay();
  });

  // Chunk options
  elements.chunkOptions.forEach(option => {
    option.addEventListener('click', () => {
      elements.chunkOptions.forEach(o => o.classList.remove('active'));
      option.classList.add('active');
      state.chunkMode = option.dataset.mode;
    });
  });

  // Display mode options
  elements.modeOptions.forEach(option => {
    option.addEventListener('click', () => {
      elements.modeOptions.forEach(o => o.classList.remove('active'));
      option.classList.add('active');
      state.displayMode = option.dataset.mode;
    });
  });

  // Audio toggle
  // Audio preset options
  elements.audioPresetOptions.forEach(option => {
    option.addEventListener('click', () => {
      elements.audioPresetOptions.forEach(o => o.classList.remove('active'));
      option.classList.add('active');
      const preset = option.dataset.preset;
      state.audioPreset = preset;
      state.audioEnabled = preset !== 'silent';

      // Update layer toggle states
      updateLayerUI();
      console.log(`[Audio] Preset: ${preset}`);
    });
  });

  // Individual layer toggles
  elements.layerToggles.forEach(toggle => {
    toggle.addEventListener('click', () => {
      const layer = toggle.dataset.layer;
      toggle.classList.toggle('active');
      const isActive = toggle.classList.contains('active');
      const statusEl = toggle.querySelector('.layer-status');
      if (statusEl) statusEl.textContent = isActive ? 'on' : 'off';
      console.log(`[Audio] Layer ${layer}: ${isActive ? 'on' : 'off'}`);
    });
  });

  // Voice toggle
  elements.voiceToggle?.addEventListener('click', () => {
    state.voiceEnabled = !state.voiceEnabled;
    elements.voiceToggle.classList.toggle('active', state.voiceEnabled);
    elements.voiceStatus.textContent = state.voiceEnabled ? 'On' : 'Off';
    elements.voiceSelect.disabled = !state.voiceEnabled;

    // Sync to audio engine
    audioEngine.setVoiceEnabled(state.voiceEnabled);

    // Update voice rate from WPM
    if (state.voiceEnabled) {
      audioEngine.setVoiceRateFromWpm(state.wpm);

      // Lock chunk options to phrase mode
      elements.chunkOptionsContainer?.classList.add('voice-locked');
      elements.chunkOptions.forEach(o => o.classList.remove('active'));
      const phraseOption = document.querySelector('.chunk-option[data-mode="phrase"]');
      phraseOption?.classList.add('active');

      // Show toast notification
      showToast('<span class="toast-icon">🗣</span> Voice mode uses <strong>Phrase</strong> chunking for natural speech');
    } else {
      // Unlock chunk options
      elements.chunkOptionsContainer?.classList.remove('voice-locked');
    }

    console.log(`[Voice] ${state.voiceEnabled ? 'Enabled' : 'Disabled'}`);
  });

  // Voice selection
  elements.voiceSelect?.addEventListener('change', async () => {
    const voiceName = elements.voiceSelect.value;
    if (voiceName) {
      await audioEngine.setVoice(voiceName);
    }
  });

  // Initialize voices on load
  initVoices();

  // Curve options
  elements.curveOptions.forEach(option => {
    option.addEventListener('click', () => {
      elements.curveOptions.forEach(o => o.classList.remove('active'));
      option.classList.add('active');
      state.curveType = option.dataset.curve;
      console.log(`[Curve] ${state.curveType}`);
    });
  });

  // Enter button
  elements.enterButton.addEventListener('click', enterChamber);

  // Chamber controls
  elements.playPauseBtn.addEventListener('click', () => {
    if (state.player) {
      state.player.toggle();
    }
  });

  elements.stopBtn.addEventListener('click', exitChamber);

  // Volume control
  elements.volumeBtn?.addEventListener('wheel', (e) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.1 : 0.1;
    const newVolume = Math.max(0, Math.min(1, audioEngine.config.masterVolume + delta));
    audioEngine.setVolume(newVolume);
    updateVolumeDisplay(newVolume);
  });

  // Keyboard shortcuts
  document.addEventListener('keydown', (e) => {
    // Only handle in chamber view
    if (elements.chamber.hidden) return;

    if (e.code === 'Space') {
      e.preventDefault();
      if (state.player) {
        state.player.toggle();
      }
    } else if (e.code === 'Escape') {
      e.preventDefault();
      exitChamber();
    }
  });

  // Review buttons
  elements.repeatBtn.addEventListener('click', repeatSession);
  elements.newSessionBtn.addEventListener('click', () => {
    state.session = null;
    showView('builder');
  });

  // Starters sidebar
  elements.startersToggle?.addEventListener('click', openSidebar);
  elements.closeSidebar?.addEventListener('click', closeSidebar);
  elements.sidebarOverlay?.addEventListener('click', closeSidebar);

  // Populate starters on load
  populateStarters();
}

/**
 * Open starter sequences sidebar
 */
function openSidebar() {
  elements.startersSidebar?.classList.add('open');
  elements.sidebarOverlay?.classList.add('visible');
}

/**
 * Close starter sequences sidebar
 */
function closeSidebar() {
  elements.startersSidebar?.classList.remove('open');
  elements.sidebarOverlay?.classList.remove('visible');
}

// ═══════════════════════════════════════════════════════════
// LIBRARY FUNCTIONALITY
// ═══════════════════════════════════════════════════════════

let currentLibraryText = null;
let currentLibraryCategory = 'sacred';

/**
 * Open library modal
 */
function openLibrary() {
  elements.libraryModal.hidden = false;
  populateLibraryCategories();
  populateLibraryTexts(currentLibraryCategory);
  showLibraryTexts();
}

/**
 * Close library modal
 */
function closeLibrary() {
  elements.libraryModal.hidden = true;
  currentLibraryText = null;
}

/**
 * Show text list, hide verse picker
 */
function showLibraryTexts() {
  elements.libraryTexts.hidden = false;
  elements.libraryVerses.hidden = true;
}

/**
 * Show verse picker, hide text list
 */
function showLibraryVerses() {
  elements.libraryTexts.hidden = true;
  elements.libraryVerses.hidden = false;
}

/**
 * Populate category tabs
 */
function populateLibraryCategories() {
  elements.libraryCategories.innerHTML = LIBRARY_CATEGORIES.map(cat => `
    <button class="library-category-tab ${cat.id === currentLibraryCategory ? 'active' : ''}" 
            data-category="${cat.id}">
      ${cat.icon} ${cat.name}
    </button>
  `).join('');

  // Add click handlers
  elements.libraryCategories.querySelectorAll('.library-category-tab').forEach(tab => {
    tab.addEventListener('click', () => {
      currentLibraryCategory = tab.dataset.category;
      populateLibraryCategories();
      populateLibraryTexts(currentLibraryCategory);
    });
  });
}

/**
 * Populate text cards for a category
 */
function populateLibraryTexts(categoryId) {
  const texts = getTextsByCategory(categoryId);

  if (texts.length === 0) {
    elements.libraryTexts.innerHTML = `
      <div style="text-align: center; color: var(--glow-dim); padding: 2rem;">
        No texts in this category yet.
      </div>
    `;
    return;
  }

  elements.libraryTexts.innerHTML = texts.map(text => `
    <div class="library-text-card" data-text-id="${text.id}">
      <div class="library-text-header">
        <span class="library-text-title">${text.title}</span>
        <span class="library-text-chapters">${text.chapterCount} verses</span>
      </div>
      <div class="library-text-author">${text.author} · ${text.tradition}</div>
      <div class="library-text-description">${text.description}</div>
    </div>
  `).join('');

  // Add click handlers
  elements.libraryTexts.querySelectorAll('.library-text-card').forEach(card => {
    card.addEventListener('click', () => {
      const textId = card.dataset.textId;
      openTextVerses(textId);
    });
  });
}

/**
 * Open verse picker for a specific text
 */
function openTextVerses(textId) {
  const text = getTextById(textId);
  if (!text) return;

  currentLibraryText = text;
  const sequences = text.getSequences();

  elements.libraryVerses.innerHTML = `
    <div class="library-verses-header">
      <button class="library-verses-back">← Back</button>
      <span class="library-verses-title">${text.title}</span>
    </div>
    <div class="library-verses-grid">
      ${sequences.map((seq, idx) => `
        <div class="library-verse-card" data-verse-idx="${idx}">
          <div class="library-verse-number">${idx + 1}</div>
          <div class="library-verse-name">${seq.description || ''}</div>
        </div>
      `).join('')}
    </div>
  `;

  // Back button
  elements.libraryVerses.querySelector('.library-verses-back').addEventListener('click', () => {
    showLibraryTexts();
  });

  // Verse cards
  elements.libraryVerses.querySelectorAll('.library-verse-card').forEach(card => {
    card.addEventListener('click', () => {
      const idx = parseInt(card.dataset.verseIdx, 10);
      loadLibraryVerse(idx);
    });
  });

  showLibraryVerses();
}

/**
 * Load a verse from the library as the current source
 */
function loadLibraryVerse(verseIndex) {
  if (!currentLibraryText) return;

  const sequences = currentLibraryText.getSequences();
  const verse = sequences[verseIndex];
  if (!verse) return;

  // Create source from verse
  state.source = new Source({
    name: `${currentLibraryText.title} — ${verse.name}`,
    type: 'generated',
    raw: verse.content
  });

  // Set WPM and curve from verse metadata
  state.wpm = verse.wpm || currentLibraryText.defaultWpm || 140;
  state.curveType = verse.curve || currentLibraryText.defaultCurve || 'induction';

  // Update UI
  elements.wpmSlider.value = state.wpm;
  elements.wpmValue.textContent = `${state.wpm} WPM`;

  elements.curveOptions?.forEach(option => {
    option.classList.toggle('active', option.dataset.curve === state.curveType);
  });

  updateSourceDisplay();
  closeLibrary();

  console.log(`[Library] Loaded: ${verse.name} from ${currentLibraryText.title}`);
}

/**
 * Initialize library event listeners
 */
function initLibrary() {
  elements.libraryToggle?.addEventListener('click', openLibrary);
  elements.libraryClose?.addEventListener('click', closeLibrary);

  // Close on backdrop click
  elements.libraryModal?.addEventListener('click', (e) => {
    if (e.target === elements.libraryModal) {
      closeLibrary();
    }
  });

  // Close on Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !elements.libraryModal.hidden) {
      closeLibrary();
    }
  });

  console.log(`[Library] Initialized with ${getAllTexts().length} texts`);
}

/**
 * Populate starters list in sidebar
 */
function populateStarters() {
  if (!elements.startersList) return;

  const categoryIcons = {};
  SEQUENCE_CATEGORIES.forEach(c => { categoryIcons[c.id] = c.icon; });

  elements.startersList.innerHTML = STARTER_SEQUENCES.map(starter => `
    <div class="starter-card" data-starter-id="${starter.id}">
      <div class="starter-header">
        <h3 class="starter-name">${starter.name}</h3>
        <span class="starter-curve">${starter.curve}</span>
      </div>
      <p class="starter-description">${starter.description}</p>
      <div class="starter-category">
        <span class="category-icon">${categoryIcons[starter.category] || '◇'}</span>
        <span>${starter.category}</span>
      </div>
    </div>
  `).join('');

  // Add click handlers
  elements.startersList.querySelectorAll('.starter-card').forEach(card => {
    card.addEventListener('click', () => {
      const starterId = card.dataset.starterId;
      loadStarter(starterId);
    });
  });
}

/**
 * Load a starter sequence
 * @param {string} starterId 
 */
function loadStarter(starterId) {
  const starter = STARTER_SEQUENCES.find(s => s.id === starterId);
  if (!starter) return;

  // Create source from starter content
  state.source = new Source({
    name: starter.name,
    type: 'generated',
    raw: starter.content
  });

  // Set curve type
  state.curveType = starter.curve;

  // Update curve selector UI
  elements.curveOptions?.forEach(option => {
    option.classList.toggle('active', option.dataset.curve === starter.curve);
  });

  // Update display
  updateSourceDisplay();

  // Close sidebar
  closeSidebar();

  console.log(`[Starter] Loaded: ${starter.name} (${starter.curve} curve)`);
}

// Create Audio Layers Toggle Button
function createAudioLayersButton() {
  const container = document.querySelector('.header-controls');
  if (container && !document.querySelector('#audio-layers-toggle')) {
    const btn = document.createElement('button');
    btn.id = 'audio-layers-toggle';
    btn.className = 'icon-button';
    btn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <path d="M12 1v22M2 6l20 12M22 6L2 18"/>
        <circle cx="12" cy="12" r="3"/>
      </svg>
    `;
    btn.title = 'Sonic Architecture';
    // Append to header controls
    container.appendChild(btn);
    elements.audioLayersButton = btn;

    btn.addEventListener('click', () => {
      openAudioLayers();
    });
  }
}

/**
 * Open Audio Layers Modal
 */
function openAudioLayers() {
  audioEngine.init().then(() => {
    elements.audioModal.classList.remove('hidden');
    updateAudioUI();
  });
}

/**
 * Close Audio Layers Modal
 */
function closeAudioLayers() {
  elements.audioModal.classList.add('hidden');
}

/**
 * Update Audio UI from Engine State
 */
function updateAudioUI() {
  // Update Presets
  elements.audioPresetButtons.forEach(btn => {
    btn.classList.toggle('active', btn.dataset.preset === audioEngine.currentPreset);
  });

  // Update Sundial - show which frequency is active
  const currentCarrier = audioEngine.getCarrierFrequency();
  elements.sundialNodes.forEach(node => {
    const freq = parseInt(node.dataset.freq);
    node.classList.toggle('active', freq === currentCarrier);
  });

  // Highlight 432 center if that's the base
  elements.sundialCenter.classList.toggle('active', currentCarrier === 432);
}

/**
 * Initialize Audio Layer Events
 */
function initAudioEvents() {
  createAudioLayersButton();

  // Close Modal
  elements.audioClose?.addEventListener('click', closeAudioLayers);

  // Presets
  elements.audioPresetButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const preset = btn.dataset.preset;
      audioEngine.applyPreset(preset);
      updateAudioUI();
    });
  });

  // Sundial
  elements.sundialNodes.forEach(node => {
    node.addEventListener('click', () => {
      const freq = parseInt(node.dataset.freq);
      const label = node.dataset.label;

      // Activate this node
      elements.sundialNodes.forEach(n => n.classList.remove('active'));
      elements.sundialCenter.classList.remove('active');
      node.classList.add('active');

      // Play this frequency as the Drone
      audioEngine.startDrone(freq);

      // Ensure Drone volume is up so they hear it
      const currentVol = audioEngine.config.layerVolumes.drone;
      if (currentVol < 0.1) {
        audioEngine.setLayerVolume('drone', 0.2);
        updateAudioUI();
      }

      console.log(`[Sundial] Activated ${label} (${freq}Hz)`);
      showToast(`Resonating: ${freq}Hz (${label})`);
    });
  });

  elements.sundialCenter?.addEventListener('click', () => {
    // Reset to Root (432Hz)
    elements.sundialNodes.forEach(n => n.classList.remove('active'));
    elements.sundialCenter.classList.add('active');

    // Set carrier tuning back to sacred (432)
    audioEngine.setCarrierTuning('sacred');

    // Restart drone at base frequency
    audioEngine.startDrone(432);

    showToast('Resonating: 432Hz (Root)');
  });
}

/**
 * Initialize the application
 */
function init() {
  initEventListeners();
  initLibrary();
  initAudioEvents();
  showView('builder');

  console.log(`
  ╔═══════════════════════════════════════╗
  ║                                       ║
  ║            R.I.S.E.                   ║
  ║                                       ║
  ║   Recursive Installation of           ║
  ║   Symbolic Experience                 ║
  ║                                       ║
  ║   The chamber is ready.               ║
  ║   The stream awaits.                  ║
  ║                                       ║
  ║   Display modes: focal | chamber | orbital
  ║   Audio: binaural entrainment         ║
  ║                                       ║
  ╚═══════════════════════════════════════╝
  `);
}

// Start
init();
