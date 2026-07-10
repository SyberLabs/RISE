/**
 * R.I.S.E. Core Models
 * Data structures for atoms, sources, and sessions
 */

/**
 * Modality types for content atoms
 * @typedef {'text' | 'image' | 'symbol' | 'sound'} Modality
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
    phase = ''
  }) {
    this.id = crypto.randomUUID();
    this.content = content;
    this.modality = modality;
    this.duration = duration;
    this.weight = weight;
    this.complexity = complexity;
    this.tags = tags;
    this.source = source;
    this.sourceId = sourceId;
    this.position = position;
    this.url = url;
    this.phase = phase;
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
   * @param {string} [config.intent=''] - Session purpose/intent
   * @param {Source[]} [config.sources=[]] - Content sources
   * @param {Atom[]} [config.atoms=[]] - Compiled atoms
   * @param {number} [config.wpm=220] - Words per minute
   * @param {ChunkMode} [config.chunkMode='word'] - Chunking strategy
   */
  constructor({
    name = 'Untitled Session',
    intent = '',
    sources = [],
    atoms = [],
    wpm = 220,
    chunkMode = 'word'
  }) {
    this.id = crypto.randomUUID();
    this.name = name;
    this.intent = intent;
    this.sources = sources;
    this.atoms = atoms;
    this.wpm = wpm;
    this.chunkMode = chunkMode;
    this.createdAt = new Date();
  }

  /**
   * Calculate total duration of all atoms
   * @returns {number} Total duration in milliseconds
   */
  get totalDuration() {
    return this.atoms.reduce((sum, atom) => sum + atom.duration, 0);
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
