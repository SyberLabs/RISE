/**
 * Compile the small visual arc returned by Jev into the Chamber's existing
 * source-coordinate visual program. This is deliberately pure: it only
 * lowers bounded data and never performs provider or network work.
 */

import { jevPalette } from './jev-palette.js';

const PROCEDURAL_ENGINES = Object.freeze([
  'klee',
  'turrell',
  'fractal',
  'harmonograph',
  'ostensoria',
  'apparitio'
]);

const ARC_SPLITS = new Set([0.3, 0.5, 0.7]);
const ARC_COUNTS = Object.freeze({ single: 1, dual: 2, triple: 3 });
const JEV_SOUNDSCAPES = new Set(['silent', 'aurora', 'faded-signal']);

function nextDistinctEngine(requested, used) {
  const requestedIndex = PROCEDURAL_ENGINES.indexOf(requested);
  const start = requestedIndex >= 0 ? requestedIndex : 0;
  for (let offset = 0; offset < PROCEDURAL_ENGINES.length; offset += 1) {
    const engine = PROCEDURAL_ENGINES[(start + offset) % PROCEDURAL_ENGINES.length];
    if (!used.has(engine)) return engine;
  }
  return null;
}

function chooseEngines(values, count) {
  const requested = [values.visualEngine, values.middleEngine, values.finaleEngine];
  const used = new Set();
  const engines = [];
  for (let index = 0; index < count; index += 1) {
    if (!PROCEDURAL_ENGINES.includes(requested[index])) return null;
    const engine = nextDistinctEngine(requested[index], used);
    if (!engine) return null;
    used.add(engine);
    engines.push(engine);
  }
  return engines;
}

function phaseValues(values, count, openingKey, middleKey, finaleKey) {
  const phases = [values[openingKey]];
  if (count === 3) phases.push(values[middleKey]);
  phases.push(values[finaleKey]);
  return phases;
}

function phaseIntervals(count, split) {
  return count === 2
    ? [[0, split], [split, 1]]
    : [[0, 0.3], [0.3, 0.7], [0.7, 1]];
}

function phaseNames(count) {
  return count === 2
    ? ['opening', 'finale']
    : ['opening', 'middle', 'finale'];
}

/**
 * @param {Object} value
 * @returns {Object|null} A canonical source-coordinate visual program.
 */
export function buildJevVisualProgram(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const count = ARC_COUNTS[value.visualArc];
  if (!count || count === 1) return null;

  const split = Number(value.arcSplit) / 100;
  if (count === 2 && !ARC_SPLITS.has(split)) return null;

  const engines = chooseEngines(value, count);
  if (!engines) return null;

  const themes = phaseValues(value, count, 'colorTheme', 'middleTheme', 'finaleTheme');
  if (themes.some(theme => !jevPalette(theme))) return null;
  const intervals = phaseIntervals(count, split);
  const names = phaseNames(count);

  return {
    coordinateSpace: 'source',
    segments: intervals.map(([fromProgress, toProgress], index) => ({
      id: `jev-${names[index]}`,
      match: {
        sourceIds: ['primary'],
        fromProgress,
        toProgress
      },
      cue: {
        kind: 'procedural',
        collections: [engines[index]],
        colorTheme: themes[index]
      }
    })),
    fallback: { kind: 'still' }
  };
}

/**
 * Compile Jev's bounded phase soundscapes into the existing source-coordinate
 * audio schedule. Silent phases are explicit silence cues; every other phase
 * names one of the shipped soundscapes and never creates a tone.
 */
export function compileJevAudioProgram(value = {}) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;

  const count = ARC_COUNTS[value.visualArc];
  if (!count || count === 1) return null;

  const split = Number(value.arcSplit) / 100;
  if (count === 2 && !ARC_SPLITS.has(split)) return null;

  const sounds = phaseValues(value, count, 'audio', 'middleAudio', 'finaleAudio');
  if (sounds.some(soundscape => !JEV_SOUNDSCAPES.has(soundscape))) return null;

  const intervals = phaseIntervals(count, split);
  const names = phaseNames(count);
  return {
    coordinateSpace: 'source',
    segments: intervals.map(([fromProgress, toProgress], index) => ({
      id: `jev-${names[index]}-audio`,
      match: {
        sourceIds: ['primary'],
        fromProgress,
        toProgress
      },
      cue: sounds[index] === 'silent'
        ? { kind: 'silence', fadeMs: 500 }
        : { kind: 'soundscape', soundscapeId: sounds[index], fadeMs: 500 }
    })),
    fallback: { kind: 'silence', fadeMs: 500 }
  };
}

export { PROCEDURAL_ENGINES as JEV_PROCEDURAL_ENGINES };

export const compileJevVisualProgram = buildJevVisualProgram;
