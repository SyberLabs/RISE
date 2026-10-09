/**
 * /try/ — the one-minute public sample, and the reader's own text after it.
 *
 * Both readings use only what every visitor already has: the text, the
 * procedural field, a soundscape and, for the sample, the recitation pack
 * shipped with the release (static Opus files, src/audio/voice-pack.manifest.json).
 * No Plus, no AI key, no account. Nothing here touches the network.
 */
import { DEFAULT_VOICE_ID } from '../audio/voice-pack-key.js';
import { SEQUENCE_CAPABILITIES } from '../core/sequence-capabilities.js';

export const TRY_PATH = '/try/';
export const TRY_TEXT_PATH = '/try/your-text/';
export const TRY_PUBLICATION_URL = 'https://syberlabs.io/services/';

/**
 * The opening of Ovid's Metamorphoses in Dryden's translation (1693), as it
 * stands in the Archive edition the Metamorphoses Keystone reads
 * (standard-ebooks:ovid/metamorphoses_various-translators, Book I). Every
 * line has a phrase in the release voice pack, so the sample is spoken
 * without a provider; try-session.test.js holds both facts.
 */
export const TRY_SAMPLE = Object.freeze({
  title: 'Metamorphoses',
  author: 'Ovid',
  translator: 'John Dryden',
  duration: 'About 1 minute',
  text: [
    'Of bodies changed to various forms I sing:',
    'Ye gods, from whom these miracles did spring,',
    'Inspire my numbers with celestial heat,',
    'Till I my long laborious work complete;',
    'And add perpetual tenor to my rhymes,',
    'Deduced from Nature’s birth to Caesar’s times.',
    '',
    'Before the seas, and this terrestrial ball,',
    'And heaven’s high canopy that covers all,',
    'One was the face of Nature; if a face:',
    'Rather a rude and indigested mass:',
    'A lifeless lump, unfashion’d and unframed,',
    'Of jarring seeds, and justly Chaos named.',
    'No sun was lighted up the world to view,',
    'No moon did yet her blunted horns renew,',
    'Nor yet was earth suspended in the sky,',
    'Nor poised, did on her own foundations lie,',
    'Nor seas about the shores their arms had thrown;',
    'But earth, and air, and water were in one.'
  ].join('\n')
});

/**
 * The most a visitor may paste here. The reader itself takes far more
 * (READING_LIMITS.maxTextCharacters, 2,000,000, and maxAtoms, 120,000, in
 * src/core/reading-limits.js); this page asks for a short excerpt, and any
 * text this long compiles well inside both (try-session.test.js).
 */
export const TRY_TEXT_MAX_CHARS = 5000;

/** The one look both readings share: the Metamorphoses Keystone's field, bed and face. */
function look({ sound }) {
  return {
    wpm: 200,
    chunkMode: 'phrase',
    curve: 'flat',
    revealMode: 'progressive',
    projection: 'stream',
    audioPreset: 'silent',
    soundscape: sound ? 'aurora' : 'none',
    visualConfig: {
      consentScope: globalThis.crypto?.randomUUID?.() || `try:${Date.now()}`,
      visualMode: 'interlocution',
      livingText: { enabled: true },
      interlocution: {
        sourceFamily: 'procedural',
        procedural: ['ostensoria'],
        sourced: [],
        presentation: 'continuous',
        galleryCadence: 0.5,
        responsive: false
      }
    },
    presentation: { chamberFace: 'literary', bandOffset: { phone: -0.75, default: 0 } }
  };
}

/** Session input for the sample. Sound on means the recorded voice and the bed. */
export function trySampleSession({ sound = true, run = 0 } = {}) {
  return {
    ...look({ sound }),
    title: TRY_SAMPLE.title,
    text: TRY_SAMPLE.text,
    textSource: `${TRY_SAMPLE.title} · ${TRY_SAMPLE.author}`,
    verseLines: true,
    capabilities: sound ? [SEQUENCE_CAPABILITIES.RECITATION_AUDIO] : [],
    recitation: { enabled: sound },
    voiceId: DEFAULT_VOICE_ID,
    origin: { view: 'try', kind: 'sample', run },
    publicPath: TRY_PATH
  };
}

/** Whether the text can be read here; the message says why not. */
export function tryTextProblem(text) {
  if (typeof text !== 'string' || !/[\p{L}\p{N}]/u.test(text)) return 'Add a few words to read.';
  if (text.length > TRY_TEXT_MAX_CHARS) {
    return `Keep it to ${TRY_TEXT_MAX_CHARS.toLocaleString('en-US')} characters or fewer.`;
  }
  return null;
}

/**
 * Session input for the visitor's own text, in the sample's look. No voice:
 * the free voice exists only for text recorded in the release. The text is
 * compiled and read in this browser; origin `try` keeps the Plus voice out
 * (chamber-session-factory.js), so it is not sent anywhere.
 */
export function tryTextSession({ text, sound = true, run = 0 } = {}) {
  const problem = tryTextProblem(text);
  if (problem) throw new Error(problem);
  return {
    ...look({ sound }),
    title: 'Your text',
    text,
    textSource: 'Your text',
    recitation: { enabled: false },
    voiceId: null,
    origin: { view: 'try', kind: 'text', run },
    provenance: { kind: 'local-text' },
    publicPath: TRY_TEXT_PATH
  };
}
