/**
 * Compile the small visual arc returned by Jev into the Chamber's existing
 * source-coordinate visual program. This is deliberately pure: it only
 * lowers bounded data and never performs provider or network work.
 */

import { jevPalette } from './jev-palette.js';
import { JEV_AUDIO_IDS } from './jev-config.js';

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
const JEV_SOUNDSCAPES = new Set(['silent', ...JEV_AUDIO_IDS]);

function nextDistinctEngine(requested, used) {
  const requestedIndex = PROCEDURAL_ENGINES.indexOf(requested);
  const start = requestedIndex >= 0 ? requestedIndex : 0;
  for (let offset = 0; offset < PROCEDURAL_ENGINES.length; offset += 1) {
    const engine = PROCEDURAL_ENGINES[(start + offset) % PROCEDURAL_ENGINES.length];
    if (!used.has(engine)) return engine;
  }
  return null;
}

// A psychedelic or immersive reading asked for energy. Soft light and fine
// line lattice are the calmest engines, so an energetic arc never spends a
// phase on them; repeats resolve through the energetic engines first.
const CALM_ENGINES = new Set(['turrell', 'harmonograph']);
const ENERGETIC_ENGINES = Object.freeze(['fractal', 'apparitio', 'ostensoria', 'klee']);

function nextEnergeticEngine(requested, used) {
  const start = Math.max(0, ENERGETIC_ENGINES.indexOf(requested));
  for (let offset = 0; offset < ENERGETIC_ENGINES.length; offset += 1) {
    const engine = ENERGETIC_ENGINES[(start + offset) % ENERGETIC_ENGINES.length];
    if (!used.has(engine)) return engine;
  }
  return null;
}

function chooseEngines(values, count) {
  const requested = count === 2
    ? [values.visualEngine, values.finaleEngine]
    : [values.visualEngine, values.middleEngine, values.finaleEngine];
  const energetic = values.visualStyle === 'psychedelic' || values.visualStyle === 'immersive';
  const used = new Set();
  const engines = [];
  for (let index = 0; index < count; index += 1) {
    if (!PROCEDURAL_ENGINES.includes(requested[index])) return null;
    const engine = energetic
      ? nextEnergeticEngine(CALM_ENGINES.has(requested[index]) ? 'fractal' : requested[index], used)
      : nextDistinctEngine(requested[index], used);
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
  if (value.visualMode === 'off') return null;

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

export const compileJevVisualProgram = buildJevVisualProgram;

/** Bring the next admitted Jev scene forward to a point within the current scene. */
export function advanceJevVisualArc(program, sourceProgress) {
  const segments = program?.segments;
  if (program?.coordinateSpace !== 'source' || program?.fallback?.kind !== 'still'
    || !Array.isArray(segments) || ![2, 3].includes(segments.length)
    || !Number.isFinite(sourceProgress) || sourceProgress <= 0 || sourceProgress >= 1) return null;

  const names = segments.length === 2
    ? ['jev-opening', 'jev-finale']
    : ['jev-opening', 'jev-middle', 'jev-finale'];
  const used = new Set();
  let previousEnd = 0;
  for (const [index, segment] of segments.entries()) {
    const { fromProgress, toProgress, sourceIds } = segment?.match || {};
    const engine = segment?.cue?.collections?.[0];
    if (segment?.id !== names[index] || !Array.isArray(sourceIds)
      || sourceIds.length !== 1 || sourceIds[0] !== 'primary'
      || fromProgress !== previousEnd || !Number.isFinite(toProgress)
      || toProgress <= fromProgress || toProgress > 1
      || segment?.cue?.kind !== 'procedural' || segment.cue.collections?.length !== 1
      || !PROCEDURAL_ENGINES.includes(engine) || used.has(engine)) return null;
    used.add(engine);
    previousEnd = toProgress;
  }
  if (previousEnd !== 1) return null;

  const currentIndex = segments.findIndex((segment, index) => index < segments.length - 1
    && sourceProgress > segment.match.fromProgress
    && sourceProgress < segment.match.toProgress);
  if (currentIndex < 0) return null;

  return {
    ...program,
    segments: segments.map((segment, index) => index === currentIndex
      ? { ...segment, match: { ...segment.match, toProgress: sourceProgress } }
      : index === currentIndex + 1
        ? { ...segment, match: { ...segment.match, fromProgress: sourceProgress } }
        : segment)
  };
}
