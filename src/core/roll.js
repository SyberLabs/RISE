/**
 * ROLL: a reading composed on this device, by chance, inside bounds.
 *
 * A roll is reading × section × temper. A temper is a coherent region of
 * the choices Jev itself may make (pace, unit, imagery, sound, type,
 * colour); a roll picks one value from each of the temper's short lists.
 * So every roll reads as an intention ("slow phrases · soft atmospheric
 * light · soft rain · literary serif"), never as a slot machine.
 *
 * The result is the same decision shape Jev returns and passes the same
 * admission (validateJevRecommendation). It says what it is: model
 * rise/roll-1, provider RISE. Nothing is sent anywhere.
 *
 * One visual and one sound hold for the whole reading, so the decision
 * survives the hand-off to Reader Setup intact.
 */

import { jevReleasedEdition, jevReleasedWorkIds } from './jev-describe.js';
import { resolveJevChamberConfig } from './jev-config.js';
import { jevColors } from './jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from './jev-sequence.js';

const SECTIONS = Object.freeze(['first', 'middle', 'last', 'shortest', 'longest']);

/**
 * What a released work is called, without loading the Library.
 *
 * A roll names its reading, and so does the wormhole page, which is a page of its
 * own and cannot afford the Library's corpora to print a title. The table is a
 * copy, so a test holds it to the Library: a work released without a name here,
 * or renamed there, fails until this is updated.
 */
const TITLES = Object.freeze({
  'middlemarch': ["Middlemarch", "George Eliot"],
  'the-brothers-karamazov': ["The Brothers Karamazov", "Fyodor Dostoevsky"],
  'literary-meditations': ["Meditations", "Marcus Aurelius"],
  'sacred-tao-te-ching': ["Tao Te Ching", "Laozi"],
  'the-iliad': ["The Iliad", "Homer"],
  'the-divine-comedy': ["The Divine Comedy", "Dante Alighieri"],
  'metamorphoses': ["Metamorphoses", "Ovid"],
  'spoon-river-anthology': ["Spoon River Anthology", "Edgar Lee Masters"],
  'oedipus-rex': ["Oedipus Rex", "Sophocles"],
  'literary-walden': ["Walden", "Henry David Thoreau"],
  'ulysses': ["Ulysses", "James Joyce"],
  'paradise-lost': ["Paradise Lost", "John Milton"],
  'literary-essays-emerson': ["Essays", "Ralph Waldo Emerson"],
  'confucius-analects': ["Analects", "Confucius"],
  'lyrical-ballads': ["Lyrical Ballads", "William Wordsworth and Samuel Taylor Coleridge"],
  // RISE originals, all by RISE.
  'the-prompt-and-the-pencil': ["The Prompt and the Pencil", 'RISE'],
  'the-group-chat-went-quiet': ["The Group Chat Went Quiet", 'RISE'],
  'who-taught-the-feed': ["Who Taught the Feed?", 'RISE'],
  'the-last-save-point': ["The Last Save Point", 'RISE'],
  'a-video-is-a-small-business': ["A Video Is a Small Business", 'RISE'],
  'the-photo-that-knew-your-street': ["The Photo That Knew Your Street", 'RISE'],
  'the-repair-table': ["The Repair Table", 'RISE'],
  'robot-in-the-hallway': ["Robot in the Hallway", 'RISE'],
  'signal-from-the-moon': ["Signal from the Moon", 'RISE'],
  'the-fan-edit': ["The Fan Edit", 'RISE'],
  'the-deepfake-in-the-chat': ["The Deepfake in the Chat", 'RISE'],
  'captions-on': ["Captions On", 'RISE'],
  'a-map-made-of-heat': ["A Map Made of Heat", 'RISE'],
  'the-smallest-app': ["The Smallest App", 'RISE'],
  'the-online-friend': ["The Online Friend", 'RISE'],
  'when-the-screen-goes-dark': ["When the Screen Goes Dark", 'RISE']
});

/** The name and author of a released work, or null. */
export function rollTitleOf(workId) {
  const named = TITLES[workId];
  return named ? { title: named[0], author: named[1] } : null;
}

/**
 * Each list is a closed choice; the first entry is the temper's centre.
 * Values are exactly those validateJevRecommendation admits.
 */
export const TEMPERS = Object.freeze([
  {
    id: 'nocturne', chunkMode: ['phrase'], wpm: [150, 200], curve: ['flat', 'wave'],
    visualMode: 'interlocution', visualStyle: 'gentle', engines: ['turrell', 'harmonograph'],
    galleryCadence: ['slow'], audio: ['soft-rain', 'aurora', 'nocturne', 'starlight'],
    faces: ['literary', 'book'], sizes: ['medium', 'large'], colors: ['classic', 'amethyst']
  },
  {
    id: 'plainsong', chunkMode: ['sentence'], wpm: [150, 200], curve: ['flat', 'induction'],
    visualMode: 'off', visualStyle: 'quiet', engines: ['turrell'],
    galleryCadence: ['slow'], audio: ['silent'],
    faces: ['book', 'literary', 'display'], sizes: ['large', 'xlarge'], colors: ['classic', 'jade']
  },
  {
    id: 'signal', chunkMode: ['phrase', 'word'], wpm: [250, 300], curve: ['wave'],
    visualMode: 'attractor', visualStyle: 'immersive', engines: ['apparitio'], palettes: ['blue', 'white', 'purple'],
    galleryCadence: ['balanced'], audio: ['faded-signal', 'night-drive', 'mystery'],
    faces: ['mono', 'sans'], sizes: ['large'], colors: ['cobalt', 'prism']
  },
  {
    id: 'ember', chunkMode: ['word'], wpm: [200, 250], curve: ['ascent', 'climax'],
    visualMode: 'interlocution', visualStyle: 'immersive', engines: ['apparitio', 'ostensoria'],
    galleryCadence: ['balanced'], audio: ['triumph', 'wonder', 'excited'],
    faces: ['display', 'thick'], sizes: ['large', 'fit'], colors: ['ember']
  },
  {
    id: 'garden', chunkMode: ['phrase'], wpm: [150, 200], curve: ['flat'],
    visualMode: 'genesis', visualStyle: 'gentle', engines: ['klee'], klee: ['harmonic', 'architectural', 'twittering'],
    galleryCadence: ['slow'], audio: ['piano', 'lullaby', 'waltz'],
    faces: ['literary', 'book'], sizes: ['medium', 'large'], colors: ['jade', 'classic']
  },
  {
    id: 'vigil', chunkMode: ['sentence', 'phrase'], wpm: [100, 150], curve: ['flat'],
    visualMode: 'focals', visualStyle: 'quiet', engines: ['turrell'],
    galleryCadence: ['slow'], audio: ['haunted', 'mystery', 'sad', 'nocturne'],
    faces: ['display', 'literary'], sizes: ['large'], colors: ['amethyst', 'classic']
  },
  {
    id: 'revel', chunkMode: ['word'], wpm: [300, 400], curve: ['climax', 'wave'],
    visualMode: 'interlocution', visualStyle: 'psychedelic', engines: ['fractal'],
    galleryCadence: ['lively'], audio: ['chase', 'thrilling', 'excited'],
    faces: ['thick', 'sans'], sizes: ['fit', 'xlarge'], colors: ['prism']
  },
  {
    id: 'salon', chunkMode: ['phrase'], wpm: [200, 250], curve: ['wave'],
    visualMode: 'interlocution', visualStyle: 'gentle', engines: ['klee', 'harmonograph'],
    galleryCadence: ['balanced'], audio: ['jazz', 'bossa', 'ragtime', 'blues'],
    faces: ['sans', 'literary'], sizes: ['medium'], colors: ['cobalt', 'classic', 'ember']
  }
].map(temper => Object.freeze(temper)));

const pick = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

let serial = 0;

/** One reading from one temper, for one work and section. Pure given `random`. */
export function composeRoll({ temper, workId, section, random = Math.random }) {
  const edition = jevReleasedEdition(workId);
  if (!edition) throw new TypeError(`${workId} is not a released reading.`);
  const engine = pick(temper.engines, random);
  const audio = pick(temper.audio, random);
  const color = pick(temper.colors, random);
  const chunkMode = pick(temper.chunkMode, random);
  const selectors = {
    section, chunkMode,
    wpm: pick(temper.wpm, random),
    curve: pick(temper.curve, random),
    audio, middleAudio: audio, finaleAudio: audio,
    visualMode: temper.visualMode, visualStyle: temper.visualStyle,
    visualEngine: engine, middleEngine: engine, finaleEngine: engine,
    visualPalette: pick(temper.palettes || ['white'], random),
    kleePreset: pick(temper.klee || ['harmonic'], random),
    visualArc: 'single', arcSplit: '50',
    galleryCadence: pick(temper.galleryCadence, random),
    chamberFace: pick(temper.faces, random),
    fontSize: pick(temper.sizes, random),
    colorTheme: color, textColor: color, backgroundColor: color,
    middleTheme: color, finaleTheme: color,
    wordFill: 'plain', projection: 'stream', revealMode: 'instant'
  };
  // Fit paints single words only; any other unit reads larger instead.
  if (selectors.fontSize === 'fit' && chunkMode !== 'word') selectors.fontSize = 'large';
  const resolved = resolveJevChamberConfig(selectors);
  const config = {
    ...selectors,
    colors: jevColors(selectors.colorTheme, selectors.textColor, selectors.backgroundColor),
    ...resolved
  };
  config.visualProgram = compileJevVisualProgram(config);
  config.audioProgram = compileJevAudioProgram(config);
  serial += 1;
  return {
    schemaVersion: 2,
    requestId: `roll-${Date.now().toString(36)}-${serial}`,
    model: 'rise/roll-1',
    provider: 'RISE',
    reason: '',
    workId: edition.workId,
    ...rollTitleOf(edition.workId),
    editionId: edition.editionId,
    sourceRevision: edition.sourceRevision,
    temper: temper.id,
    config
  };
}

/**
 * Roll a reading. Given the previous roll, never the same work or temper
 * twice running, so Roll Again always visibly changes something.
 */
export function rollReading({ random = Math.random, previous = null } = {}) {
  const tempers = TEMPERS.filter(temper => temper.id !== previous?.temper);
  const works = jevReleasedWorkIds().filter(id => id !== previous?.decision?.workId);
  const temper = pick(tempers, random);
  const decision = composeRoll({ temper, workId: pick(works, random), section: pick(SECTIONS, random), random });
  return { temper: temper.id, decision };
}
