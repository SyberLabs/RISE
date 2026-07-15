/**
 * R.I.S.E. Core Models
 * Data structures for atoms, sources, and sessions
 */

/**
 * Modality types for content atoms
 * @typedef {'text' | 'image' | 'symbol' | 'audio' | 'composite'} Modality
 */

/**
 * Chunking modes for text content
 * @typedef {'word' | 'phrase' | 'sentence' | 'paragraph'} ChunkMode
 */

/**
 * Player states
 * @typedef {'idle' | 'playing' | 'paused' | 'complete'} PlayerState
 */

/**
 * An Atom is the fundamental unit of content in R.I.S.E.
 * Each atom represents a single displayable element with timing metadata.
 */
export class Atom {
  /**
   * @param {Object} config
   * @param {string|ArrayBuffer} config.content - The content to display
   * @param {Modality} [config.modality='text'] - Type of content
   * @param {number} [config.duration=250] - Display duration in milliseconds
   * @param {number} [config.weight=0.5] - Semantic importance 0-1
   * @param {number} [config.complexity=0.5] - Content complexity 0-1
   * @param {string[]} [config.tags=[]] - Tags for cross-reference
   * @param {string} [config.source=''] - Provenance identifier
   * @param {string} [config.sourceId=''] - Source UUID for sequencing
   * @param {number} [config.position=0] - Order in original source
   * @param {string} [config.url=''] - URL for image/media atoms
   * @param {string} [config.phase=''] - Ritual phase assignment
   * @param {boolean} [config.timingLocked=false] - Preserve authored duration through pacing
   */
  constructor({
    content,
    modality = 'text',
    duration = 250,
    weight = 0.5,
    complexity = 0.5,
    tags = [],
    source = '',
    sourceId = '',
    position = 0,
    url = '',
    phase = '',
    timingLocked = false
  }) {
    const modalities = new Set(['text', 'image', 'symbol', 'audio', 'composite']);
    const numericDuration = Number(duration);
    const clamp01 = value => Math.max(0, Math.min(1, Number.isFinite(Number(value)) ? Number(value) : 0.5));
    this.id = crypto.randomUUID();
    this.content = content ?? '';
    this.modality = modalities.has(modality) ? modality : 'text';
    this.duration = Number.isFinite(numericDuration) ? Math.max(16, Math.min(600000, numericDuration)) : 250;
    this.weight = clamp01(weight);
    this.complexity = clamp01(complexity);
    this.tags = Array.isArray(tags) ? tags.filter(tag => typeof tag === 'string').slice(0, 32) : [];
    this.source = typeof source === 'string' ? source : '';
    this.sourceId = typeof sourceId === 'string' ? sourceId : '';
    this.position = Number.isInteger(position) && position >= 0 ? position : 0;
    this.url = typeof url === 'string' ? url : '';
    this.phase = typeof phase === 'string' ? phase : '';
    this.timingLocked = timingLocked === true;
  }

  /**
   * Create a text atom
   */
  static text(content, options = {}) {
    return new Atom({ content, modality: 'text', ...options });
  }

  /**
   * Create an image atom
   */
  static image(url, options = {}) {
    return new Atom({
      content: url,
      url,
      modality: 'image',
      duration: options.duration || 2000,
      ...options
    });
  }

  /**
   * Create a symbol atom
   */
  static symbol(symbol, options = {}) {
    return new Atom({
      content: symbol,
      modality: 'symbol',
      duration: options.duration || 400,
      ...options
    });
  }

  /**
   * Create a pause atom
   */
  static pause(duration = 1000) {
    return new Atom({
      content: '',
      modality: 'text',
      duration,
      weight: 0
    });
  }
}

/**
 * A Source represents the origin of content before parsing into atoms.
 */
export class Source {
  /**
   * @param {Object} config
   * @param {string} config.name - Display name of the source
   * @param {'file' | 'url' | 'text' | 'generated'} [config.type='file'] - Source type
   * @param {string} config.raw - Raw content
   * @param {Date} [config.fetched=new Date()] - When content was loaded
   */
  constructor({
    name,
    type = 'file',
    raw,
    fetched = new Date()
  }) {
    this.id = crypto.randomUUID();
    this.name = name;
    this.type = type;
    this.raw = raw;
    this.fetched = fetched;
  }
}

/**
 * A Session represents a complete playback configuration.
 */
export class Session {
  /**
   * @param {Object} config
   * @param {string} [config.name='Untitled Session'] - Session name
   * @param {string} [config.title] - Alternative session name (alias for name)
   * @param {string} [config.intent=''] - Session purpose/intent
   * @param {Source[]} [config.sources=[]] - Content sources
   * @param {Atom[]} [config.atoms=[]] - Compiled atoms
   * @param {number} [config.wpm=220] - Words per minute
   * @param {ChunkMode} [config.chunkMode='word'] - Chunking strategy
   * @param {string} [config.curve='flat'] - Pacing curve
   * @param {string} [config.displayMode='focal'] - Display mode
   * @param {string} [config.audioPreset='silent'] - Audio preset
   * @param {string} [config.soundscape='none'] - Living soundscape (e.g. 'aurora')
   * @param {Object} [config.visualConfig] - Visual configuration
   * @param {boolean} [config.voiceEnabled=false] - Enable text-to-speech
   * @param {string|null} [config.voiceId=null] - Selected voice name
   */
  constructor({
    name = 'Untitled Session',
    title,
    intent = '',
    sources = [],
    atoms = [],
    wpm = 220,
    chunkMode = 'word',
    curve = 'flat',
    displayMode = 'focal',
    audioPreset = 'silent',
    soundscape = 'none',
    entrainmentMode = 'binaural',
    entrainmentWaveform = 'sine',
    visualConfig = { enabled: false },
    customVisuals = [],
    isCustom = false,
    voiceEnabled = false,
    voiceId = null,
    selectedSwellId = null
  }) {
    const safeWpm = Number(wpm);
    const chunkModes = new Set(['word', 'phrase', 'sentence', 'paragraph']);
    this.id = crypto.randomUUID();
    this.name = String(title || name || 'Untitled Session').slice(0, 200); // Support both title and name
    this.intent = intent;
    this.sources = Array.isArray(sources) ? sources : [];
    this.atoms = Array.isArray(atoms) ? atoms : [];
    this.wpm = Number.isFinite(safeWpm) ? Math.max(50, Math.min(1000, safeWpm)) : 220;
    this.chunkMode = chunkModes.has(chunkMode) ? chunkMode : 'word';
    this.curve = curve;
    this.displayMode = displayMode;
    this.audioPreset = audioPreset;
    this.soundscape = soundscape;
    this.entrainmentMode = entrainmentMode;
    this.entrainmentWaveform = entrainmentWaveform;
    this.visualConfig = visualConfig;
    this.customVisuals = customVisuals;
    this.isCustom = isCustom;
    this.voiceEnabled = voiceEnabled;
    this.voiceId = voiceId;
    this.selectedSwellId = selectedSwellId;
    this.createdAt = new Date();
  }

  /**
   * Calculate total duration of all atoms
   * @returns {number} Total duration in milliseconds
   */
  get totalDuration() {
    return this.atoms.reduce((sum, atom) => {
      const duration = Number(atom?.duration);
      return sum + (Number.isFinite(duration) && duration > 0 ? duration : 0);
    }, 0);
  }

  /**
   * Get atom count
   * @returns {number}
   */
  get atomCount() {
    return this.atoms.length;
  }
}

/**
 * Session state for tracking playback
 */
export class SessionState {
  /**
   * @param {Session} session 
   */
  constructor(session) {
    this.session = session;
    this.currentIndex = 0;
    this.state = 'idle';
    this.startTime = null;
    this.elapsedTime = 0;
    this.pausedAt = null;
  }

  /**
   * Get current atom
   * @returns {Atom|null}
   */
  get currentAtom() {
    if (this.currentIndex >= this.session.atoms.length) return null;
    return this.session.atoms[this.currentIndex];
  }

  /**
   * Get progress as 0-1
   * @returns {number}
   */
  get progress() {
    if (this.session.atoms.length === 0) return 0;
    return this.currentIndex / this.session.atoms.length;
  }

  /**
   * Check if session is complete
   * @returns {boolean}
   */
  get isComplete() {
    return this.currentIndex >= this.session.atoms.length;
  }

  /**
   * Advance to next atom
   */
  advance() {
    if (!this.isComplete) {
      this.currentIndex++;
    }
  }

  /**
   * Reset state
   */
  reset() {
    this.currentIndex = 0;
    this.state = 'idle';
    this.startTime = null;
    this.elapsedTime = 0;
    this.pausedAt = null;
  }
}
