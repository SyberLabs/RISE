/**
 * Say, in ordinary words, what a Jev plan will do, and let the reader change
 * one part of it without asking Jev again.
 *
 * THE WORDS ARE A FUNCTION OF THE PLAN. Jev is a choice model, not a prose
 * generator, so nothing here comes from the model: every sentence is derived
 * from the exact values the Chamber will play. If the words and the reading
 * ever disagree, this file is wrong, and a test can say so.
 */

import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import modernManifest from '../content/modern-readings-manifest.json' with { type: 'json' };
import { resolveJevChamberConfig } from './jev-config.js';
import { jevColors } from './jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from './jev-sequence.js';

const COLOR_NAMES = Object.freeze({
  classic: { label: 'Classic', accent: 'bronze', ink: 'ivory', ground: 'near-black' },
  amethyst: { label: 'Amethyst', accent: 'lilac', ink: 'lilac', ground: 'deep violet' },
  prism: { label: 'Neon night', accent: 'magenta', ink: 'rose', ground: 'dark purple' },
  ember: { label: 'Ember', accent: 'orange', ink: 'gold', ground: 'dark red-brown' },
  cobalt: { label: 'Electric blue', accent: 'electric blue', ink: 'cyan', ground: 'deep navy' },
  jade: { label: 'Jade', accent: 'jade', ink: 'mint', ground: 'dark green' }
});

const ENGINE_WORDS = Object.freeze({
  fractal: 'fractal light', apparitio: 'prismatic light', ostensoria: 'iridescent radial light',
  klee: 'line art', harmonograph: 'fine harmonic lines', turrell: 'soft atmospheric light'
});
const CADENCE_SECONDS = Object.freeze({ slow: 24, balanced: 15, lively: 10 });
const PACE_WORDS = Object.freeze({ 100: 'Very slow', 150: 'Slow', 200: 'Medium', 250: 'Brisk', 300: 'Fast', 400: 'Very fast', 500: 'Fastest' });
const SOUND_WORDS = Object.freeze({
  chase: 'an energetic chase theme', thrilling: 'a tense, driving theme', excited: 'a bright, upbeat theme',
  triumph: 'a triumphant theme', 'faded-signal': 'a faded-signal synth bed', aurora: 'an ambient aurora bed',
  'soft-rain': 'soft rain'
});
const FACE_WORDS = Object.freeze({
  literary: 'Literary serif', display: 'Display serif', thick: 'Bold', jp: 'Japanese serif',
  mono: 'Monospaced', sans: 'Clean sans', book: 'Book serif'
});
const SIZE_WORDS = Object.freeze({ small: 'small', medium: 'medium', large: 'large', xlarge: 'extra large', fit: 'fitted to the screen' });
const CHUNK_WORDS = Object.freeze({ word: 'one word at a time', phrase: 'short phrases', sentence: 'whole sentences', paragraph: 'whole paragraphs' });

/** Plain-language rows for one admitted plan. */
export function describeJevPlan(config) {
  const colors = COLOR_NAMES[config.colorTheme] || COLOR_NAMES.classic;
  const ink = COLOR_NAMES[config.textColor] || colors;
  const ground = COLOR_NAMES[config.backgroundColor] || colors;
  const page = config.projection === 'page';
  const visual = config.visualConfig?.visualMode || config.visualMode;
  const engine = config.visualConfig?.interlocution?.procedural?.[0] || config.visualEngine;
  const lively = config.galleryCadence === 'lively';

  let motion;
  let motionDetail;
  if (page) {
    motion = 'No motion in page view';
    motionDetail = 'you scroll at your own pace; visuals pause';
  } else if (visual === 'off') {
    motion = 'No moving visuals';
    motionDetail = 'the words alone on a dark ground';
  } else if (visual === 'interlocution') {
    const words = ENGINE_WORDS[engine] || 'moving light';
    motion = `${lively ? 'Fast, flowing' : config.galleryCadence === 'slow' ? 'Slow, drifting' : 'Flowing'} ${words}`;
    const phases = config.visualProgram?.segments?.length;
    motionDetail = `a new scene about every ${CADENCE_SECONDS[config.galleryCadence] || 15} seconds`
      + (phases > 1 ? `, in ${phases} changing phases` : '');
  } else if (visual === 'genesis') {
    motion = 'Growing line art';
    motionDetail = 'drawn continuously behind the words';
  } else if (visual === 'attractor') {
    motion = 'A luminous attractor field';
    motionDetail = 'turning continuously behind the words';
  } else {
    motion = 'A single quiet figure';
    motionDetail = 'still, behind the words';
  }

  const soundWords = id => id === 'silent' ? 'no sound'
    : SOUND_WORDS[id] || `the ${String(id).replace(/-/g, ' ')} soundscape`;
  // A phased plan can change sound partway; say every distinct phase.
  const phasedSounds = (config.audioProgram?.segments || [])
    .map(segment => segment.cue?.kind === 'silence' ? 'silent' : segment.cue?.soundscapeId)
    .filter(Boolean);
  const sounds = (phasedSounds.length ? phasedSounds : [config.audio])
    .filter((id, index, all) => index === 0 || id !== all[index - 1]);
  const sound = sounds.map(soundWords).join(', then ');

  return [
    { key: 'colors', label: 'Colors', value: colors.label,
      detail: `${colors.accent} light, ${ink.ink} text on ${ground.ground}` },
    { key: 'energy', label: 'Motion', value: motion, detail: motionDetail },
    { key: 'speed', label: 'Pace & sound',
      value: page ? 'Your own pace' : `${PACE_WORDS[config.wpm] || 'Custom'}: ${config.wpm} words a minute`,
      detail: `with ${sound}` },
    { key: 'text', label: 'Text',
      value: `${FACE_WORDS[config.chamberFace] || 'Serif'}, ${SIZE_WORDS[config.fontSize] || 'medium'}`,
      detail: CHUNK_WORDS[config.chunkMode] || 'short phrases' }
  ];
}

/* ── What RISE cannot do, said before playback ─────────────────────────── */

const REFERENCES = Object.freeze([
  { pattern: /\btokyo\s+drift\b/u, name: 'Tokyo Drift', kind: 'film', reads: 'neon night colors, speed and energy' },
  { pattern: /\bfast\s+(?:and|&)\s+(?:the\s+)?furious\b/u, name: 'Fast & Furious', kind: 'film', reads: 'speed and energy' },
  { pattern: /\bneed\s+for\s+speed\b/u, name: 'Need for Speed', kind: 'game', reads: 'speed and neon color' },
  { pattern: /\binitial\s+d\b/u, name: 'Initial D', kind: 'series', reads: 'speed and night-road energy' },
  { pattern: /\bblade\s+runner\b/u, name: 'Blade Runner', kind: 'film', reads: 'neon night colors and atmosphere' },
  { pattern: /\bakira\b/u, name: 'Akira', kind: 'film', reads: 'neon color and speed' },
  { pattern: /\btron\b/u, name: 'Tron', kind: 'film', reads: 'electric neon lines' },
  { pattern: /\bcyberpunk\b/u, name: 'Cyberpunk', kind: 'style', reads: 'neon night colors' }
]);

/**
 * Read the reader's own words for things RISE cannot deliver. Deterministic
 * and local: it never guesses beyond what the words name.
 */
export function readJevRequest(intent) {
  const text = ` ${String(intent || '').normalize('NFKC').toLocaleLowerCase('en')} `;
  const reference = REFERENCES.find(item => item.pattern.test(text)) || null;
  const limits = [];
  if (reference && reference.kind !== 'style') {
    limits.push(`play the ${reference.name} soundtrack or show footage from it`);
  } else if (/\b(?:soundtrack|song|songs|music video|playlist|album|movie|film|trailer)\b/u.test(text)) {
    limits.push('play songs, soundtracks, or film clips');
  }
  if (/\b(?:car|cars|racing|race|drift|drifting|street race)\b/u.test(text)) {
    limits.push('show cars or racing');
  }
  const place = text.match(/\b(tokyo|japan|paris|london|new york|los angeles|seoul|hong kong)\b/u)?.[1];
  if (place) limits.push(`show real places such as ${place.replace(/\b\w/gu, c => c.toUpperCase())}`);
  return { reference, limits };
}

/** Whether the reader named the text Jev chose. */
export function namesWork(intent, work) {
  const text = ` ${String(intent || '').normalize('NFKC').toLocaleLowerCase('en').replace(/[^\p{L}\p{N}]+/gu, ' ')} `;
  const title = String(work?.title || '').toLocaleLowerCase('en').replace(/^the\s+/u, '').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  const author = String(work?.author || '').toLocaleLowerCase('en').split(/\s+/u).pop();
  return Boolean((title.length > 2 && text.includes(` ${title} `))
    || (author && author.length > 3 && text.includes(` ${author} `)));
}

/* ── Adjusting one part locally ────────────────────────────────────────── */

export const JEV_ADJUSTMENTS = Object.freeze({
  energy: Object.freeze({
    calm: { label: 'Calm', visualStyle: 'gentle', visualEngine: 'turrell', galleryCadence: 'slow' },
    balanced: { label: 'Balanced', visualStyle: 'immersive', visualEngine: 'apparitio', galleryCadence: 'balanced' },
    intense: { label: 'Intense', visualStyle: 'psychedelic', visualEngine: 'fractal', galleryCadence: 'lively' }
  }),
  speed: Object.freeze({
    slow: { label: 'Slow', wpm: 150 }, medium: { label: 'Medium', wpm: 200 },
    fast: { label: 'Fast', wpm: 300 }, fastest: { label: 'Fastest', wpm: 400 }
  }),
  colors: Object.freeze({
    prism: { label: 'Neon night', colorTheme: 'prism', textColor: 'cobalt', backgroundColor: 'prism' },
    cobalt: { label: 'Electric blue', colorTheme: 'cobalt', textColor: 'cobalt', backgroundColor: 'cobalt' },
    ember: { label: 'Ember', colorTheme: 'ember', textColor: 'ember', backgroundColor: 'ember' },
    jade: { label: 'Jade', colorTheme: 'jade', textColor: 'jade', backgroundColor: 'jade' },
    classic: { label: 'Classic', colorTheme: 'classic', textColor: 'classic', backgroundColor: 'classic' }
  }),
  sound: Object.freeze({
    chase: { label: 'Chase', audio: 'chase' }, thrilling: { label: 'Tense', audio: 'thrilling' },
    excited: { label: 'Upbeat', audio: 'excited' }, silent: { label: 'Off', audio: 'silent' }
  })
});

/** Which adjustment option the plan currently matches, or null. */
export function currentJevAdjustment(config, kind) {
  if (kind === 'energy') {
    if (config.visualMode === 'off' || config.projection === 'page') return null;
    if (config.visualStyle === 'psychedelic' || config.galleryCadence === 'lively') return 'intense';
    if (config.visualStyle === 'immersive') return 'balanced';
    return 'calm';
  }
  if (kind === 'speed') return Object.entries(JEV_ADJUSTMENTS.speed).find(([, v]) => v.wpm === config.wpm)?.[0] || null;
  if (kind === 'colors') return Object.hasOwn(JEV_ADJUSTMENTS.colors, config.colorTheme) ? config.colorTheme : null;
  if (kind === 'sound') return Object.entries(JEV_ADJUSTMENTS.sound).find(([, v]) => v.audio === config.audio)?.[0] || null;
  return null;
}

function releasedEdition(workId) {
  const item = releaseInventory[workId];
  if (item) {
    return item.editionId?.startsWith('standard-ebooks:')
      && item.source?.url?.startsWith('https://standardebooks.org/ebooks/') ? item : null;
  }
  const original = modernManifest[workId];
  return original?.editionId === `rise-original:${workId}` ? original : null;
}

/** The works Jev may choose (released classics and RISE originals), for the reader's own text picker. */
export function jevReleasedWorkIds() {
  return [...Object.keys(releaseInventory), ...Object.keys(modernManifest)].filter(id => releasedEdition(id));
}

/**
 * Apply one reader change to an admitted decision and return a new decision
 * that passes the same admission as Jev's own (validateJevRecommendation).
 * No network: the plan is re-derived with the Chamber's own compilers.
 */
export function adjustJevDecision(decision, kind, value) {
  const next = { ...decision, config: { ...decision.config } };
  const config = next.config;
  if (kind === 'workId') {
    const edition = releasedEdition(value);
    if (!edition) throw new TypeError('That text is not available in this RISE release.');
    next.workId = edition.workId;
    next.editionId = edition.editionId;
    next.sourceRevision = edition.sourceRevision;
    next.reason = '';
    return next;
  }
  const option = JEV_ADJUSTMENTS[kind]?.[value];
  if (!option) throw new TypeError(`Unknown adjustment ${kind}:${value}`);
  const { label: _label, ...fields } = option;
  Object.assign(config, fields);

  if (kind === 'energy') {
    // An explicit energy is one visual for the whole reading.
    Object.assign(config, {
      visualMode: 'interlocution', projection: 'stream', visualArc: 'single',
      middleEngine: config.visualEngine, finaleEngine: config.visualEngine
    });
  }
  if (kind === 'colors') {
    config.middleTheme = config.colorTheme;
    config.finaleTheme = config.colorTheme;
  }
  if (kind === 'sound') {
    config.middleAudio = config.audio;
    config.finaleAudio = config.audio;
  }
  // Psychedelic is defined with the Neon night palette (resolveJevChamberConfig
  // forces it). A reader who picks other colors keeps the same fast motion
  // under the immersive style instead of having the colors overruled.
  if (config.visualStyle === 'psychedelic' && config.colorTheme !== 'prism') {
    config.visualStyle = 'immersive';
    config.visualEngine = 'fractal';
    config.galleryCadence = 'lively';
  }
  if (config.fontSize === 'fit' && config.chunkMode !== 'word') config.fontSize = 'large';

  config.colors = jevColors(config.colorTheme, config.textColor, config.backgroundColor);
  Object.assign(config, resolveJevChamberConfig(config));
  config.visualProgram = compileJevVisualProgram(config);
  config.audioProgram = compileJevAudioProgram(config);
  return next;
}
