/**
 * Compile the small visual arc returned by Jev into the Chamber's existing
 * source-coordinate visual program. This is deliberately pure: it only
 * lowers bounded data and never performs provider or network work.
 */

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

  const intervals = count === 2
    ? [[0, split], [split, 1]]
    : [[0, 0.3], [0.3, 0.7], [0.7, 1]];
  const names = count === 2
    ? ['opening', 'finale']
    : ['opening', 'middle', 'finale'];

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
        collections: [engines[index]]
      }
    })),
    fallback: { kind: 'still' }
  };
}

export { PROCEDURAL_ENGINES as JEV_PROCEDURAL_ENGINES };

export const compileJevVisualProgram = buildJevVisualProgram;
