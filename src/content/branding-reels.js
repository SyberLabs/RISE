/**
 * Branding reel slate — canon pairings for mute-social MP4s.
 *
 * Texts resolve from the Archive at render time. This file names the
 * pairing and how it is presented; it does not store a second copy of
 * the prose.
 *
 * A reel is four choices:
 *   workId + division   which passage
 *   visual + soundscape which surface
 *   livery              how the words are set (see BRANDING_LIVERIES)
 *   length              'short' (~20 s) or 'standard' (~45 s)
 *
 * Only fifteen works are served from the Archive, so range comes from
 * divisions × surfaces × liveries rather than from breadth of canon.
 */

import {
  EXPERIENCE_PROGRAM_SCHEMA,
  validateExperienceProgram
} from '../core/experience-program.js';

export const BRANDING_MIN_WORDS = 90;
export const BRANDING_MAX_WORDS = 130;
export const BRANDING_SHORT_MIN_WORDS = 45;
export const BRANDING_SHORT_MAX_WORDS = 68;
export const BRANDING_PROFILE_ID = 'social-portrait-1080';
export const BRANDING_WPM = 160;

/**
 * Ceiling for a branding master, in kbit/s. Roughly three times what any
 * platform actually delivers for a portrait reel, so nothing visible is
 * lost — but it stops a drifting fractal, which is close to noise frame
 * to frame, from spending 20 Mbit/s and landing as a 124 MB clip.
 */
export const BRANDING_MAX_BITRATE_KBPS = 10_000;

/**
 * THREE WAYS TO SET THE WORDS, not one.
 *
 * The slate used to burn every clip with the same gold Helvetica at the
 * same height with no scrim, which read as a meme caption over whatever
 * happened to be behind it — including, on the Impressionists take, a
 * man's face. Each livery here carries its own answer to legibility:
 * `ink` and `signal` lay a gradient footer under the text, `glass`
 * brings back the Chamber's own frosted tile, which is what the product
 * actually looks like and therefore the honest demo.
 *
 * Sizes are CSS px at 1080 wide; the painter scales them to the frame.
 */
export const BRANDING_LIVERIES = Object.freeze({
  ink: Object.freeze({
    fontFamily: '"Crimson Pro", Georgia, serif',
    fontSize: 60,
    fontWeight: 500,
    lineHeight: 1.34,
    letterSpacing: 0.004,
    maxWidth: 0.80,
    color: '#F2E9D8',
    edgeColor: 'none',
    shadow: Object.freeze({ blur: 26, color: '#000000', opacity: 0.62 }),
    scrim: Object.freeze({ height: 0.36, color: '#07070A', opacity: 0.66 }),
    position: Object.freeze({ x: 0.5, y: 0.815 })
  }),
  signal: Object.freeze({
    fontFamily: '"Helvetica Neue", Arial, sans-serif',
    fontSize: 58,
    fontWeight: 700,
    lineHeight: 1.22,
    letterSpacing: -0.006,
    maxWidth: 0.84,
    color: '#F4C430',
    edgeColor: '#1A140C',
    scrim: Object.freeze({ height: 0.30, color: '#0A0A0C', opacity: 0.48 }),
    position: Object.freeze({ x: 0.5, y: 0.80 })
  }),
  glass: Object.freeze({
    fontFamily: '"Crimson Pro", Georgia, serif',
    fontSize: 52,
    fontWeight: 400,
    lineHeight: 1.36,
    letterSpacing: 0,
    maxWidth: 0.72,
    color: '#ECE8E0',
    edgeColor: 'none',
    glass: true,
    position: Object.freeze({ x: 0.5, y: 0.78 })
  })
});

export const BRANDING_LIVERY_IDS = Object.freeze(Object.keys(BRANDING_LIVERIES));

/**
 * HOW LONG ONE PLATE HOLDS THE FRAME, per surface.
 *
 * Every procedural surface draws one complete composition per seed, so a
 * take longer than one plate needs a cadence. A dense fractal wants to be
 * looked at; a Klee line drawing is read in a couple of seconds and then
 * wants to be replaced. `zoom` and `drift` are the slow push that keeps a
 * finished plate from sitting dead in a portrait frame — kept modest,
 * because zoom upscales the plate rather than cropping into it.
 */
export const BRANDING_PLATE_TIMING = Object.freeze({
  klee: Object.freeze({ drawMs: 3800, holdMs: 1600, dissolveMs: 700, zoom: 1.10, drift: 0.07 }),
  harmonograph: Object.freeze({ drawMs: 4200, holdMs: 1800, dissolveMs: 800, zoom: 1.08, drift: 0.06 }),
  ostensoria: Object.freeze({ drawMs: 4400, holdMs: 2000, dissolveMs: 900, zoom: 1.06, drift: 0.05 }),
  apparitio: Object.freeze({ drawMs: 4400, holdMs: 2000, dissolveMs: 900, zoom: 1.06, drift: 0.05 }),
  fractal: Object.freeze({ drawMs: 7000, holdMs: 1600, dissolveMs: 1200, zoom: 1.32, drift: 0.10 }),
  neural: Object.freeze({ drawMs: 5000, holdMs: 1400, dissolveMs: 900, zoom: 1.24, drift: 0.08 }),
  turrell: Object.freeze({ drawMs: 8000, holdMs: 2200, dissolveMs: 1600, zoom: 1.22, drift: 0.09 }),
  rockgarden: Object.freeze({ drawMs: 5500, holdMs: 1600, dissolveMs: 1000, zoom: 1.16, drift: 0.07 }),
  // Attractors run their own clock and stills have the gallery wall's.
  // Neither cycles plates, so draw/hold would only restart something that
  // is already moving.
  attractor: Object.freeze({ zoom: 1, drift: 0 }),
  // A painting is matted by default. Cropping a horizontal work to a
  // portrait frame discards most of the painting, and it puts the caption
  // on whatever the crop happens to contain — on the marine takes, gold
  // lettering over a near-white sea no scrim could rescue. `cover` is for
  // imagery that is reliably dark, which in this slate means astronomy.
  sourced: Object.freeze({ zoom: 1.02, drift: 0.07, fit: 'plate' })
});

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

function procedural(id, config) {
  return config
    ? { kind: 'procedural', collections: [id], config }
    : { kind: 'procedural', collections: [id] };
}

function collection(id) {
  return { kind: 'sourced', collections: [id] };
}

function attractor(system, palette, form) {
  return { kind: 'field', renderer: 'attractor', config: { system, palette, form } };
}

export const BRANDING_REELS = freeze([
  // ── Klee Lines ────────────────────────────────────────────────
  {
    id: 'meditations-klee-architectural',
    title: 'Meditations · Klee Lines',
    workId: 'literary-meditations',
    division: 'Book IV',
    visual: procedural('klee', { preset: 'architectural' }),
    soundscape: 'faded-signal',
    livery: 'glass',
    length: 'short'
  },
  {
    id: 'analects-klee-twittering',
    title: 'Analects · Klee Lines',
    workId: 'confucius-analects',
    division: 'Book IV: Le Jin',
    visual: procedural('klee', { preset: 'twittering' }),
    soundscape: 'faded-signal',
    livery: 'ink',
    length: 'short'
  },
  {
    id: 'emerson-klee-gravitational',
    title: 'Circles · Klee Lines',
    workId: 'literary-essays-emerson',
    division: 'Circles',
    visual: procedural('klee', { preset: 'gravitational' }),
    soundscape: 'faded-signal',
    livery: 'signal',
    length: 'standard'
  },
  {
    id: 'tao-klee-harmonic',
    title: 'Tao Te Ching · Klee Lines',
    workId: 'sacred-tao-te-ching',
    division: 'Part I · Chapter XI',
    visual: procedural('klee', { preset: 'harmonic' }),
    soundscape: 'aurora',
    livery: 'glass',
    length: 'short'
  },
  {
    id: 'walden-klee-chaotic',
    title: 'Walden · Klee Lines',
    workId: 'literary-walden',
    division: 'Solitude',
    visual: procedural('klee', { preset: 'chaotic' }),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'standard'
  },

  // ── Harmonograph ──────────────────────────────────────────────
  {
    id: 'meditations-harmonograph-midnight',
    title: 'Meditations · Harmonograph',
    workId: 'literary-meditations',
    division: 'Book III',
    visual: procedural('harmonograph', { climate: 'midnightWater' }),
    soundscape: 'faded-signal',
    livery: 'ink',
    length: 'standard'
  },
  {
    id: 'spoon-river-harmonograph-ember',
    title: 'Spoon River · Harmonograph',
    workId: 'spoon-river-anthology',
    division: 'Hod Putt',
    visual: procedural('harmonograph', { climate: 'emberDawn' }),
    soundscape: 'aurora',
    livery: 'signal',
    length: 'short'
  },
  {
    id: 'ulysses-harmonograph-solar',
    title: 'Ulysses · Harmonograph',
    workId: 'ulysses',
    division: 'Part I · Chapter 3',
    visual: procedural('harmonograph', { climate: 'solarFlare' }),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'standard'
  },
  {
    id: 'tao-harmonograph-jade',
    title: 'Tao Te Ching · Harmonograph',
    workId: 'sacred-tao-te-ching',
    division: 'Part I · Chapter VIII',
    visual: procedural('harmonograph', { climate: 'jadeVeil' }),
    soundscape: 'aurora',
    livery: 'glass',
    length: 'short'
  },
  {
    id: 'inferno-harmonograph-storm',
    openAt: 'Thus I descended out of the first circle',
    title: 'Inferno · Harmonograph',
    workId: 'the-divine-comedy',
    division: 'Inferno · Canto V',
    visual: procedural('harmonograph', { climate: 'stormViolet' }),
    soundscape: 'faded-signal',
    livery: 'signal',
    length: 'standard'
  },

  // ── Iris Plates ───────────────────────────────────────────────
  {
    id: 'metamorphoses-ostensoria-iris',
    openAt: 'Of bodies changed to various forms I sing',
    title: 'Metamorphoses · Iris Plates',
    workId: 'metamorphoses',
    division: 'Book I · Creation of the World',
    visual: procedural('ostensoria', { palette: 'iris' }),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'standard'
  },
  {
    id: 'daphne-ostensoria-ice',
    openAt: 'The first and fairest of his loves',
    title: 'Daphne · Iris Plates',
    workId: 'metamorphoses',
    division: 'Book I · Transformation of Daphne Into a Laurel',
    visual: procedural('ostensoria', { palette: 'ice' }),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'standard'
  },
  {
    id: 'ancient-mariner-ostensoria-verdant',
    title: 'The Ancient Mariner · Iris Plates',
    workId: 'lyrical-ballads',
    division: 'Volume I · The Ancient Mariner',
    visual: procedural('ostensoria', { palette: 'verdant' }),
    soundscape: 'aurora',
    livery: 'signal',
    length: 'standard'
  },
  {
    id: 'tao-ostensoria-peacock',
    title: 'Tao Te Ching · Iris Plates',
    workId: 'sacred-tao-te-ching',
    division: 'Part I · Chapter IV',
    visual: procedural('ostensoria', { palette: 'peacock' }),
    soundscape: 'faded-signal',
    livery: 'glass',
    length: 'short'
  },

  // ── Spectral Plates ───────────────────────────────────────────
  {
    id: 'inferno-apparitio-prism',
    openAt: 'Midway upon the journey of our life',
    title: 'Inferno · Spectral Plates',
    workId: 'the-divine-comedy',
    division: 'Inferno · Canto I',
    visual: procedural('apparitio', { palette: 'prism' }),
    soundscape: 'faded-signal',
    livery: 'signal',
    length: 'standard'
  },
  {
    id: 'tao-apparitio-marian',
    title: 'Tao Te Ching · Spectral Plates',
    workId: 'sacred-tao-te-ching',
    division: 'Part I · Chapter VI',
    visual: procedural('apparitio', { palette: 'marian' }),
    soundscape: 'faded-signal',
    livery: 'glass',
    length: 'short'
  },
  {
    id: 'middlemarch-apparitio-holo',
    openAt: '“Sir Humphry Davy',
    title: 'Middlemarch · Spectral Plates',
    workId: 'middlemarch',
    division: 'Book I · Chapter II',
    visual: procedural('apparitio', { palette: 'holo' }),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'standard'
  },
  {
    id: 'karamazov-apparitio-ember',
    openAt: 'Faith does not, in the realist, spring from the miracle',
    title: 'Karamazov · Spectral Plates',
    workId: 'the-brothers-karamazov',
    division: 'Book I · Chapter V: Elders',
    visual: procedural('apparitio', { palette: 'ember' }),
    soundscape: 'faded-signal',
    livery: 'ink',
    length: 'short'
  },

  // ── Fractal Flames ────────────────────────────────────────────
  {
    id: 'meditations-fractal',
    title: 'Meditations · Fractal Flames',
    workId: 'literary-meditations',
    division: 'Book II',
    visual: procedural('fractal'),
    soundscape: 'faded-signal',
    livery: 'ink',
    length: 'standard'
  },
  {
    id: 'paradise-fractal',
    openAt: 'Of Man’s first disobedience',
    title: 'Paradise Lost · Fractal Flames',
    workId: 'paradise-lost',
    division: 'Book I',
    visual: procedural('fractal'),
    soundscape: 'faded-signal',
    livery: 'signal',
    length: 'standard'
  },

  // ── Neural Networks ───────────────────────────────────────────
  {
    id: 'emerson-neural',
    openAt: 'I read the other day some verses',
    title: 'Self-Reliance · Neural Networks',
    workId: 'literary-essays-emerson',
    division: 'Self-Reliance',
    visual: procedural('neural'),
    soundscape: 'faded-signal',
    livery: 'signal',
    length: 'short'
  },
  {
    id: 'ulysses-neural',
    title: 'Ulysses · Neural Networks',
    workId: 'ulysses',
    division: 'Part II · Chapter 4',
    visual: procedural('neural'),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'short'
  },

  // ── Turrell Fields ────────────────────────────────────────────
  {
    id: 'tao-turrell',
    title: 'Tao Te Ching · Turrell Fields',
    workId: 'sacred-tao-te-ching',
    division: 'Part I · Chapter I',
    visual: procedural('turrell'),
    soundscape: 'faded-signal',
    livery: 'glass',
    length: 'short'
  },
  {
    id: 'walden-turrell',
    title: 'Walden · Turrell Fields',
    workId: 'literary-walden',
    division: 'Where I Lived, and What I Lived For',
    visual: procedural('turrell'),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'standard'
  },

  // ── Rock Garden ───────────────────────────────────────────────
  {
    id: 'walden-rockgarden',
    title: 'Walden · Rock Garden',
    workId: 'literary-walden',
    division: 'The Ponds',
    visual: procedural('rockgarden'),
    soundscape: 'aurora',
    livery: 'glass',
    length: 'short'
  },
  {
    id: 'analects-rockgarden',
    title: 'Analects · Rock Garden',
    workId: 'confucius-analects',
    division: 'Book VI: Yung Yey',
    visual: procedural('rockgarden'),
    soundscape: 'faded-signal',
    livery: 'ink',
    length: 'short'
  },

  // ── Attractors ────────────────────────────────────────────────
  {
    id: 'paradise-aizawa-kaleido',
    openAt: 'High on a throne',
    title: 'Paradise Lost · Attractor',
    workId: 'paradise-lost',
    division: 'Book II',
    visual: attractor('aizawa', 'gold', 'kaleido'),
    soundscape: 'faded-signal',
    livery: 'signal',
    length: 'standard'
  },
  {
    id: 'inferno-thomas-mirror',
    openAt: 'Through me the way is to the city dolent',
    title: 'Inferno · Attractor',
    workId: 'the-divine-comedy',
    division: 'Inferno · Canto III',
    visual: attractor('thomas', 'blue', 'mirror'),
    soundscape: 'faded-signal',
    livery: 'ink',
    length: 'standard'
  },
  {
    id: 'iliad-halvorsen-bilateral',
    openAt: 'Now from that stubborn conflict',
    title: 'Iliad · Attractor',
    workId: 'the-iliad',
    division: 'Book VI: Interviews Between Glaucus and Diomed, and Hector and Andromache',
    visual: attractor('halvorsen', 'red', 'bilateral'),
    soundscape: 'faded-signal',
    livery: 'signal',
    length: 'short'
  },
  {
    id: 'karamazov-aizawa-purple',
    title: 'Karamazov · Attractor',
    workId: 'the-brothers-karamazov',
    division: 'Book I · Chapter IV: The Third Son, Alyosha',
    visual: attractor('aizawa', 'purple', 'mirror'),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'short'
  },

  // ── CC0 collections ───────────────────────────────────────────
  {
    id: 'tintern-landscapes',
    title: 'Tintern Abbey · Landscapes',
    workId: 'lyrical-ballads',
    division: 'Volume I · Lines Written a Few Miles Above Tintern Abbey, on Revisiting the Banks of the Wye During a Tour',
    visual: collection('aic-landscapes'),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'standard'
  },
  {
    id: 'iliad-knights',
    openAt: 'Sing the wrath of Peleus',
    title: 'Iliad · Knights',
    workId: 'the-iliad',
    division: 'Book I: The Contention of Achilles and Agamemnon',
    visual: collection('aic-knights'),
    soundscape: 'aurora',
    livery: 'signal',
    length: 'standard'
  },
  {
    id: 'analects-ukiyoe',
    title: 'Analects · Ukiyo-e',
    workId: 'confucius-analects',
    division: 'Book I: Hsio R',
    visual: collection('aic-ukiyoe'),
    soundscape: 'faded-signal',
    livery: 'ink',
    length: 'short'
  },
  {
    id: 'oedipus-oldmasters',
    openAt: 'My children, latest born to Cadmus old',
    title: 'Oedipus Rex · Old Masters',
    workId: 'oedipus-rex',
    division: 'Oedipus Rex',
    visual: collection('aic-oldmasters'),
    soundscape: 'faded-signal',
    livery: 'ink',
    length: 'standard'
  },
  {
    id: 'ulysses-postimpressionism',
    title: 'Ulysses · Post-Impressionists',
    workId: 'ulysses',
    division: 'Part I · Chapter 1',
    visual: collection('aic-postimpressionism'),
    soundscape: 'aurora',
    livery: 'signal',
    length: 'standard'
  },
  {
    id: 'middlemarch-impressionism',
    openAt: 'Miss Brooke had that kind of beauty',
    title: 'Middlemarch · Impressionists',
    workId: 'middlemarch',
    division: 'Book I · Chapter I',
    visual: collection('aic-impressionism'),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'standard'
  },
  {
    id: 'karamazov-portraits',
    title: 'Karamazov · Portraits',
    workId: 'the-brothers-karamazov',
    division: 'Book I · Chapter I: Fyodor Pavlovitch Karamazov',
    visual: collection('aic-portraits'),
    soundscape: 'faded-signal',
    livery: 'ink',
    length: 'standard'
  },
  {
    id: 'spoon-river-flowers',
    title: 'Spoon River · Flowers',
    workId: 'spoon-river-anthology',
    division: 'The Hill',
    visual: collection('aic-flowers'),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'short'
  },
  {
    id: 'iliad-ships',
    openAt: 'All other deities, all mortal men',
    title: 'Iliad · Ships',
    workId: 'the-iliad',
    division: 'Book II: The Trial of the Army, and Catalogue of the Forces',
    visual: collection('aic-ships'),
    soundscape: 'aurora',
    livery: 'signal',
    length: 'standard'
  },
  {
    id: 'walden-animals',
    openAt: 'I wonder what the world is doing now',
    title: 'Walden · Animals',
    workId: 'literary-walden',
    division: 'Brute Neighbors',
    visual: collection('aic-animals'),
    soundscape: 'aurora',
    livery: 'ink',
    length: 'short'
  },
  {
    id: 'paradiso-astronomy',
    openAt: 'The glory of Him who moveth everything',
    title: 'Paradiso · Astronomy',
    workId: 'the-divine-comedy',
    division: 'Paradiso · Canto I',
    visual: collection('sci-astronomy'),
    soundscape: 'faded-signal',
    livery: 'glass',
    length: 'standard',
    // Deep-sky imagery is dark edge to edge, so it is the one collection
    // that can carry the whole frame without swallowing the words.
    framing: { fit: 'cover' }
  }
]);

/** Which timing table a reel's surface belongs to. */
export function brandingVisualFamily(visual) {
  if (!visual) return 'sourced';
  if (visual.kind === 'sourced') return 'sourced';
  if (visual.kind === 'field') return visual.renderer === 'attractor' ? 'attractor' : 'klee';
  return visual.collections?.[0] || 'klee';
}

export function brandingWordWindow(reel) {
  const window = reel?.length === 'short'
    ? { minWords: BRANDING_SHORT_MIN_WORDS, maxWords: BRANDING_SHORT_MAX_WORDS }
    : { minWords: BRANDING_MIN_WORDS, maxWords: BRANDING_MAX_WORDS };
  return reel?.openAt ? { ...window, openAt: reel.openAt } : window;
}

/**
 * Everything the painter needs that the score deliberately does not carry.
 * Visual cues drop unknown config by contract, so framing and typography
 * travel with the painter — the same seam draw/hold already used.
 */
export function brandingPresentation(reel) {
  const caption = BRANDING_LIVERIES[reel?.livery] || BRANDING_LIVERIES.ink;
  const family = brandingVisualFamily(reel?.visual);
  const timing = BRANDING_PLATE_TIMING[family] || BRANDING_PLATE_TIMING.klee;
  return Object.freeze({ caption, ...timing, ...(reel?.framing || {}) });
}

export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

/**
 * A run of an edition's own enumeration — "II.", "3.", a bare all-caps
 * heading — is structure, not prose. Left in, the compiler makes it an
 * atom and a clip spends a beat with the single caption "II" on screen.
 */
function isEnumerator(sentence) {
  const trimmed = String(sentence || '').trim();
  if (!trimmed) return true;
  if (/[a-z]/.test(trimmed)) return false;
  return wordCount(trimmed) < 3;
}

/**
 * The same enumeration also arrives glued to the sentence it numbers —
 * "I The Master said, …" — where it is not a sentence of its own to drop.
 * A numeral is stripped only before a capital, so "I go and come with a
 * strange liberty" keeps its pronoun.
 */
function stripLeadingEnumerator(sentence) {
  return String(sentence || '')
    .replace(/^\s*(?:[IVXLCDM]{1,7}|\d{1,3})[.)]?\s+(?=[A-Z“‘"'(])/, '')
    .trim();
}

export function clipToReadingWindow(text, {
  minWords = BRANDING_MIN_WORDS,
  maxWords = BRANDING_MAX_WORDS,
  openAt = null
} = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  // A closing quote after the stop is still the end of a sentence. Without
  // this, `wise?”` ran on into the numeral that followed it and an epigraph
  // ending in `helmet of Mambrino.”` swallowed the chapter's first line.
  const all = trimmed
    .split(/(?<=[.!?][”’"']?)\s+/)
    .map(stripLeadingEnumerator)
    .filter(sentence => !isEnumerator(sentence));
  // An unresolved opening yields nothing rather than the apparatus it was
  // written to skip, so a re-ingest that moves the line fails loudly
  // instead of quietly shipping a synopsis.
  const from = openAt ? all.findIndex(sentence => sentence.includes(openAt)) : 0;
  if (from < 0) return '';
  const sentences = all.slice(from);
  if (openAt) {
    // Exact, not sentence-rounded: an epigraph's attribution ("The Maid's
    // Tragedy: Beaumont and Fletcher") carries no stop of its own and is
    // otherwise part of the sentence the passage begins in.
    sentences[0] = sentences[0].slice(sentences[0].indexOf(openAt)).trim();
  }
  const cleaned = sentences.join(' ').trim();
  if (!cleaned) return '';
  if (wordCount(cleaned) <= maxWords) return cleaned;
  const kept = [];
  let count = 0;
  for (const sentence of sentences) {
    const next = wordCount(sentence);
    if (count >= minWords && count + next > maxWords) break;
    if (count + next > maxWords) {
      const room = maxWords - count;
      if (room > 0) {
        kept.push(sentence.split(/\s+/).filter(Boolean).slice(0, room).join(' '));
      }
      break;
    }
    kept.push(sentence);
    count += next;
    if (count >= maxWords) break;
  }
  return kept.join(' ').trim() || cleaned.split(/\s+/).slice(0, maxWords).join(' ');
}

export function gatherReading(entries, startIndex, {
  minWords = BRANDING_MIN_WORDS,
  maxWords = BRANDING_MAX_WORDS,
  openAt = null
} = {}) {
  const parts = [];
  let reading = '';
  for (let i = startIndex; i < entries.length; i += 1) {
    const content = String(entries[i]?.content || '').trim();
    if (!content) continue;
    parts.push(content);
    // Measured AFTER the opening cut, not before: a division that spends
    // its first hundred words on a canto argument would otherwise stop
    // gathering while the passage itself is still ahead.
    reading = clipToReadingWindow(parts.join('\n\n'), { minWords, maxWords, openAt });
    if (wordCount(reading) >= minWords) break;
  }
  return reading;
}

export function brandingSource(reel, text, extra = {}) {
  const id = `branding-${reel.id}`;
  return {
    id,
    sourceId: id,
    name: reel.title,
    data: String(text || ''),
    ...extra
  };
}

export function brandingProgram(reel, sourceId) {
  const anchor = { sourceIds: [sourceId] };
  return validateExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: `branding-${reel.id}`,
    authority: 'user',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: [{ id: 'm1', anchor, data: { index: 0, title: reel.title } }]
      },
      {
        id: 'visual-main',
        kind: 'visual',
        clips: [{ id: 'v1', anchor, cue: reel.visual }],
        fallback: { kind: 'still' }
      },
      {
        id: 'audio-bed',
        kind: 'audio',
        clips: [{
          id: 'bed-1',
          anchor,
          cue: { kind: 'soundscape', soundscapeId: reel.soundscape, fadeMs: 400 }
        }],
        fallback: { kind: 'silence', fadeMs: 400 }
      },
      {
        id: 'reading',
        kind: 'reading',
        clips: [{
          id: 'pace-1',
          anchor,
          cue: { kind: 'pace', wpm: BRANDING_WPM, chunkMode: 'phrase' }
        }]
      }
    ]
  });
}
