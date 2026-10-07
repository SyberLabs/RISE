/**
 * ROLL: a reading composed on this device, by chance, inside bounds.
 *
 * A roll is work × section × look × rhythm × pace. The look (looks.js) is
 * the one audiovisual choice; rhythm and pace are drawn from a short range
 * that suits the look, but they are not part of it: the look never changes
 * how the text moves, and setup changes either. So every roll reads as an
 * intention ("slow phrases · soft atmospheric light · soft
 * rain · literary serif"), never as a slot machine.
 *
 * The result is the same decision shape Jev returns and passes the same
 * admission (validateJevRecommendation). It says what it is: model
 * rise/roll-1, provider RISE. Nothing is sent anywhere.
 *
 * One visual and one sound hold for the whole reading, so the decision
 * reopens in Reader Setup as the look it was drawn in.
 */

import { jevReleasedEdition, jevReleasedWorkIds } from './jev-describe.js';
import { resolveJevChamberConfig } from './jev-config.js';
import { jevColors } from './jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from './jev-sequence.js';
import { LOOKS } from './looks.js';

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
 * Look values Jev's menu (validateJevRecommendation) spells another way. Every
 * other value a look writes is spelled the same on both sides.
 */
export const JEV_SPELLING = Object.freeze({
  soundscape: Object.freeze({ none: 'silent' }),
  galleryCadence: Object.freeze({ 0.15: 'slow', 0.5: 'balanced', 0.85: 'lively' })
});

/**
 * What Jev's menu requires that a look does not say, for each look a roll may
 * draw. `engines` stands in only where the look names none Jev offers; a look
 * whose field is not on the menu (Gallery's sourced works, Flame's Living
 * Flame) has no entry. Inlay has none until the five-reader observation
 * (consolidated-reader decisions, Q3).
 */
const JEV_FILLS = Object.freeze({
  plain: { visualStyle: 'quiet', engines: ['turrell'] },
  nocturne: { visualStyle: 'gentle' },
  garden: { visualStyle: 'gentle', kleePreset: 'random' },
  signal: { visualStyle: 'immersive', engines: ['apparitio'] },
  iris: { visualStyle: 'immersive' },
  revel: { visualStyle: 'psychedelic' },
  vigil: { visualStyle: 'quiet', engines: ['turrell'] }
});

/** The looks a roll may draw, in the registry's order. */
export const ROLL_LOOKS = Object.freeze(LOOKS.filter(look => Object.hasOwn(JEV_FILLS, look.id)));

/**
 * The vivid looks: those whose procedural visuals are immersive or
 * psychedelic, so a reading drawn from them is never plain black or quiet.
 */
export const VIVID_LOOKS = Object.freeze(ROLL_LOOKS.filter(look =>
  ['immersive', 'psychedelic'].includes(JEV_FILLS[look.id].visualStyle)));

/**
 * The rhythms and paces a roll draws in each look, centre first: the ranges
 * of the tempers the looks replaced. What a roll draws only; a look never
 * holds its rhythm or pace, and the reader changes both in setup. Never Word,
 * which stays a choice in Reader setup; every pace is one Jev's menu admits.
 */
export const ROLL_RANGES = Object.freeze({
  plain: { rhythms: ['sentence'], paces: [150, 200] },
  nocturne: { rhythms: ['phrase'], paces: [150, 200] },
  garden: { rhythms: ['phrase'], paces: [150, 200] },
  signal: { rhythms: ['phrase'], paces: [250, 300] },
  iris: { rhythms: ['phrase'], paces: [200, 250] },
  revel: { rhythms: ['phrase'], paces: [300, 400] },
  vigil: { rhythms: ['sentence', 'phrase'], paces: [100, 150] }
});

const pick = (list, random) => list[Math.min(list.length - 1, Math.floor(random() * list.length))];

let serial = 0;

/**
 * One reading in one look, for one work and section, at one rhythm and pace
 * inside the look's range (its centre when not given). `look` is a look id;
 * `random` picks among the look's engines. Pure given `random`.
 */
export function composeRoll({ look: id, workId, section, rhythm, pace, random = Math.random }) {
  const look = ROLL_LOOKS.find(entry => entry.id === id);
  if (!look) throw new TypeError(`A roll cannot draw the look ${JSON.stringify(id)}.`);
  const range = ROLL_RANGES[look.id];
  rhythm ??= range.rhythms[0];
  pace ??= range.paces[0];
  if (!range.rhythms.includes(rhythm) || !range.paces.includes(pace)) {
    throw new TypeError(`${look.name} is not rolled in ${rhythm} at ${pace} words a minute.`);
  }
  const edition = jevReleasedEdition(workId);
  if (!edition) throw new TypeError(`${workId} is not a released reading.`);
  const fills = JEV_FILLS[look.id];
  const { visualInterlocution: visual, presentation, soundscape } = look.config;
  const engine = pick(fills.engines ?? look.engines, random);
  const audio = JEV_SPELLING.soundscape[soundscape] ?? soundscape;
  const color = presentation.colorTheme;
  const selectors = {
    section, chunkMode: rhythm, wpm: pace, curve: 'flat',
    audio, middleAudio: audio, finaleAudio: audio,
    visualMode: visual.visualMode, visualStyle: fills.visualStyle,
    visualEngine: engine, middleEngine: engine, finaleEngine: engine,
    visualPalette: 'white',
    kleePreset: fills.kleePreset ?? 'harmonic',
    visualArc: 'single', arcSplit: '50',
    galleryCadence: JEV_SPELLING.galleryCadence[visual.interlocution?.galleryCadence] ?? 'slow',
    chamberFace: presentation.chamberFace,
    fontSize: presentation.fontSize,
    colorTheme: color, textColor: color, backgroundColor: color,
    middleTheme: color, finaleTheme: color,
    wordFill: 'plain', projection: 'stream', revealMode: 'instant'
  };
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
    look: look.id,
    config
  };
}

/**
 * Roll a reading. Given the previous roll, no part (work, look, section)
 * repeats, so Roll Again always visibly changes. A vivid roll draws its
 * look from VIVID_LOOKS only.
 */
export function rollReading({ random = Math.random, previous = null, vivid = false } = {}) {
  const draw = (list, last) => pick(list.filter(item => item !== last), random);
  const look = draw((vivid ? VIVID_LOOKS : ROLL_LOOKS).map(entry => entry.id), previous?.look);
  const decision = composeRoll({
    look,
    workId: draw(jevReleasedWorkIds(), previous?.decision.workId),
    section: draw(SECTIONS, previous?.decision.config.section),
    rhythm: pick(ROLL_RANGES[look].rhythms, random),
    pace: pick(ROLL_RANGES[look].paces, random),
    random
  });
  return { look, decision };
}
