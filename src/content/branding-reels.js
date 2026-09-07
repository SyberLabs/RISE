/**
 * Branding reel slate — thirty unique canon pairings for mute-social MP4s.
 *
 * Texts resolve from the Archive at render time. This file names the
 * pairing; it does not store a second copy of the prose.
 */

import {
  EXPERIENCE_PROGRAM_SCHEMA,
  validateExperienceProgram
} from '../core/experience-program.js';

export const BRANDING_MIN_WORDS = 90;
export const BRANDING_MAX_WORDS = 130;
export const BRANDING_CAPTION = Object.freeze({
  fontFamily: '"Helvetica Neue", Arial, sans-serif',
  fontSize: 64,
  color: '#F4C430',
  edgeColor: '#1A140C',
  position: Object.freeze({ x: 0.5, y: 0.76 })
});
export const BRANDING_DRAW_MS = 2000;
export const BRANDING_HOLD_MS = 1200;
export const BRANDING_PROFILE_ID = 'social-portrait-1080';
export const BRANDING_WPM = 160;

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
  {
    id: 'meditations-fractal',
    title: 'Meditations · Fractal Flames',
    workId: 'literary-meditations',
    division: 'Book II',
    visual: procedural('fractal'),
    soundscape: 'faded-signal'
  },
  {
    id: 'metamorphoses-iris',
    title: 'Metamorphoses · Iris Plates',
    workId: 'metamorphoses',
    division: 'Book I · Creation of the World',
    visual: procedural('ostensoria', { palette: 'iris' }),
    soundscape: 'aurora'
  },
  {
    id: 'tintern-landscapes',
    title: 'Tintern Abbey · Landscapes',
    workId: 'lyrical-ballads',
    division: 'Volume I · Lines Written a Few Miles Above Tintern Abbey, on Revisiting the Banks of the Wye During a Tour',
    visual: collection('aic-landscapes'),
    soundscape: 'aurora'
  },
  {
    id: 'tao-turrell',
    title: 'Tao Te Ching · Turrell Fields',
    workId: 'sacred-tao-te-ching',
    division: 'Part I · Chapter I',
    visual: procedural('turrell'),
    soundscape: 'faded-signal'
  },
  {
    id: 'iliad-knights',
    title: 'Iliad · Knights',
    workId: 'the-iliad',
    division: 'Book I: The Contention of Achilles and Agamemnon',
    visual: collection('aic-knights'),
    soundscape: 'aurora'
  },
  {
    id: 'inferno-apparitio',
    title: 'Inferno · Spectral Plates',
    workId: 'the-divine-comedy',
    division: 'Inferno · Canto I',
    visual: procedural('apparitio', { palette: 'prism' }),
    soundscape: 'faded-signal'
  },
  {
    id: 'paradise-aizawa',
    title: 'Paradise Lost · Attractor',
    workId: 'paradise-lost',
    division: 'Book I',
    visual: attractor('aizawa', 'gold', 'kaleido'),
    soundscape: 'faded-signal'
  },
  {
    id: 'walden-rockgarden',
    title: 'Walden · Rock Garden',
    workId: 'literary-walden',
    division: 'Where I Lived, and What I Lived For',
    visual: procedural('rockgarden'),
    soundscape: 'aurora'
  },
  {
    id: 'emerson-klee',
    title: 'Nature · Klee Lines',
    workId: 'literary-essays-emerson',
    division: 'Nature',
    visual: procedural('klee', { preset: 'architectural' }),
    soundscape: 'faded-signal'
  },
  {
    id: 'analects-ukiyoe',
    title: 'Analects · Ukiyo-e',
    workId: 'confucius-analects',
    division: 'Book I: Hsio R',
    visual: collection('aic-ukiyoe'),
    soundscape: 'faded-signal'
  },
  {
    id: 'oedipus-oldmasters',
    title: 'Oedipus Rex · Old Masters',
    workId: 'oedipus-rex',
    division: 'Oedipus Rex',
    visual: collection('aic-oldmasters'),
    soundscape: 'faded-signal'
  },
  {
    id: 'ulysses-postimpressionism',
    title: 'Ulysses · Post-Impressionists',
    workId: 'ulysses',
    division: 'Part I · Chapter 1',
    visual: collection('aic-postimpressionism'),
    soundscape: 'aurora'
  },
  {
    id: 'middlemarch-impressionism',
    title: 'Middlemarch · Impressionists',
    workId: 'middlemarch',
    division: 'Book I · Chapter I',
    visual: collection('aic-impressionism'),
    soundscape: 'aurora'
  },
  {
    id: 'karamazov-portraits',
    title: 'Karamazov · Portraits',
    workId: 'the-brothers-karamazov',
    division: 'Book I · Chapter I: Fyodor Pavlovitch Karamazov',
    visual: collection('aic-portraits'),
    soundscape: 'faded-signal'
  },
  {
    id: 'spoon-river-flowers',
    title: 'Spoon River · Flowers',
    workId: 'spoon-river-anthology',
    division: 'The Hill',
    visual: collection('aic-flowers'),
    soundscape: 'aurora'
  },
  {
    id: 'iliad-ships',
    title: 'Iliad · Ships',
    workId: 'the-iliad',
    division: 'Book II: The Trial of the Army, and Catalogue of the Forces',
    visual: collection('aic-ships'),
    soundscape: 'aurora'
  },
  {
    id: 'walden-animals',
    title: 'Walden · Animals',
    workId: 'literary-walden',
    division: 'Brute Neighbors',
    visual: collection('aic-animals'),
    soundscape: 'aurora'
  },
  {
    id: 'paradiso-astronomy',
    title: 'Paradiso · Astronomy',
    workId: 'the-divine-comedy',
    division: 'Paradiso · Canto I',
    visual: collection('sci-astronomy'),
    soundscape: 'faded-signal'
  },
  {
    id: 'daphne-ostensoria-ice',
    title: 'Daphne · Iris Plates',
    workId: 'metamorphoses',
    division: 'Book I · Transformation of Daphne Into a Laurel',
    visual: procedural('ostensoria', { palette: 'ice' }),
    soundscape: 'aurora'
  },
  {
    id: 'meditations-harmonograph',
    title: 'Meditations · Harmonograph',
    workId: 'literary-meditations',
    division: 'Book III',
    visual: procedural('harmonograph', { climate: 'midnightWater' }),
    soundscape: 'faded-signal'
  },
  {
    id: 'tao-apparitio',
    title: 'Tao Te Ching · Spectral Plates',
    workId: 'sacred-tao-te-ching',
    division: 'Part I · Chapter VI',
    visual: procedural('apparitio', { palette: 'marian' }),
    soundscape: 'faded-signal'
  },
  {
    id: 'paradise-halvorsen',
    title: 'Paradise Lost · Attractor',
    workId: 'paradise-lost',
    division: 'Book II',
    visual: attractor('halvorsen', 'red', 'bilateral'),
    soundscape: 'faded-signal'
  },
  {
    id: 'emerson-neural',
    title: 'Self-Reliance · Neural Networks',
    workId: 'literary-essays-emerson',
    division: 'Self-Reliance',
    visual: procedural('neural'),
    soundscape: 'faded-signal'
  },
  {
    id: 'analects-klee',
    title: 'Analects · Klee Lines',
    workId: 'confucius-analects',
    division: 'Book II: Wei Chang',
    visual: procedural('klee', { preset: 'twittering' }),
    soundscape: 'faded-signal'
  },
  {
    id: 'inferno-thomas',
    title: 'Inferno · Attractor',
    workId: 'the-divine-comedy',
    division: 'Inferno · Canto III',
    visual: attractor('thomas', 'blue', 'mirror'),
    soundscape: 'faded-signal'
  },
  {
    id: 'spoon-river-harmonograph',
    title: 'Spoon River · Harmonograph',
    workId: 'spoon-river-anthology',
    division: 'Hod Putt',
    visual: procedural('harmonograph', { climate: 'emberDawn' }),
    soundscape: 'aurora'
  },
  {
    id: 'ancient-mariner-ostensoria',
    title: 'The Ancient Mariner · Iris Plates',
    workId: 'lyrical-ballads',
    division: 'Volume I · The Ancient Mariner',
    visual: procedural('ostensoria', { palette: 'verdant' }),
    soundscape: 'aurora'
  },
  {
    id: 'karamazov-klee',
    title: 'Karamazov · Klee Lines',
    workId: 'the-brothers-karamazov',
    division: 'Book I · Chapter IV: The Third Son, Alyosha',
    visual: procedural('klee', { preset: 'gravitational' }),
    soundscape: 'faded-signal'
  },
  {
    id: 'middlemarch-apparitio',
    title: 'Middlemarch · Spectral Plates',
    workId: 'middlemarch',
    division: 'Book I · Chapter II',
    visual: procedural('apparitio', { palette: 'holo' }),
    soundscape: 'aurora'
  },
  {
    id: 'ulysses-harmonograph',
    title: 'Ulysses · Harmonograph',
    workId: 'ulysses',
    division: 'Part I · Chapter 3',
    visual: procedural('harmonograph', { climate: 'solarFlare' }),
    soundscape: 'aurora'
  }
]);

export function wordCount(text) {
  return String(text || '').trim().split(/\s+/).filter(Boolean).length;
}

export function clipToReadingWindow(text, {
  minWords = BRANDING_MIN_WORDS,
  maxWords = BRANDING_MAX_WORDS
} = {}) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return '';
  if (wordCount(trimmed) <= maxWords) return trimmed;
  const sentences = trimmed.split(/(?<=[.!?])\s+/);
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
  return kept.join(' ').trim() || trimmed.split(/\s+/).slice(0, maxWords).join(' ');
}

export function gatherReading(entries, startIndex, {
  minWords = BRANDING_MIN_WORDS,
  maxWords = BRANDING_MAX_WORDS
} = {}) {
  const parts = [];
  for (let i = startIndex; i < entries.length; i += 1) {
    const content = String(entries[i]?.content || '').trim();
    if (!content) continue;
    parts.push(content);
    if (wordCount(parts.join('\n\n')) >= minWords) break;
  }
  return clipToReadingWindow(parts.join('\n\n'), { minWords, maxWords });
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
