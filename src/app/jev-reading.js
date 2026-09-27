import { getTextById } from '../content/library.js';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { firstBodyOrdinal } from '../content/archive/divisions.js';
import { READING_LIMITS } from '../core/reading-limits.js';
import { CHAMBER_STREAM_FACES } from '../core/chamber-stream-face.js';
import { FONT_SIZE_CHIPS } from '../core/chamber-type-size.js';
import { JEV_AUDIO_IDS, resolveJevChamberConfig } from '../core/jev-config.js';
import { jevPalette } from '../core/jev-palette.js';
import { compileJevVisualProgram } from '../core/jev-sequence.js';
import {
  ATTRACTOR_PALETTES,
  KLEE_PRESETS
} from '../core/visual-style-definitions.js';

const CHUNKS = new Set(['word', 'phrase', 'sentence', 'paragraph']);
const CURVES = new Set(['flat', 'induction', 'ascent', 'wave', 'climax']);
const PACES = new Set([100, 150, 200, 250, 300, 400, 500]);
const AUDIO = new Set(['silent', ...JEV_AUDIO_IDS]);
const VISUALS = new Set(['off', 'focals', 'genesis', 'attractor', 'interlocution']);
const ENGINES = new Set(['klee', 'turrell', 'fractal', 'harmonograph', 'ostensoria', 'apparitio']);
const PALETTES = new Set(ATTRACTOR_PALETTES.map(item => item.id));
const KLEE = new Set(KLEE_PRESETS.map(item => item.id));
const FACES = new Set(CHAMBER_STREAM_FACES.map(item => item.id));
const SIZES = new Set(FONT_SIZE_CHIPS.map(item => item.fontSize));
const CADENCES = new Set(['slow', 'balanced', 'lively']);
const WORD_FILLS = new Set(['plain', 'accent', 'same']);
const STYLES = new Set(['quiet', 'gentle', 'immersive', 'psychedelic']);
const SECTIONS = new Set(['first', 'middle', 'last', 'shortest', 'longest']);
const VISUAL_ARCS = new Set(['single', 'dual', 'triple']);
const ARC_SPLITS = new Set(['30', '50', '70']);

function assertPlan(decision) {
  const config = decision?.config;
  if (!decision || typeof decision.workId !== 'string' || !config
    || !SECTIONS.has(config.section) || !PACES.has(config.wpm)
    || !CURVES.has(config.curve) || !CHUNKS.has(config.chunkMode)
    || !AUDIO.has(config.audio) || !VISUALS.has(config.visualMode)
    || !ENGINES.has(config.visualEngine) || !PALETTES.has(config.visualPalette)
    || !KLEE.has(config.kleePreset) || !CADENCES.has(config.galleryCadence)
    || !FACES.has(config.chamberFace) || !SIZES.has(config.fontSize)
    || !WORD_FILLS.has(config.wordFill) || !STYLES.has(config.visualStyle)
    || !VISUAL_ARCS.has(config.visualArc) || !ARC_SPLITS.has(config.arcSplit)
    || !ENGINES.has(config.middleEngine) || !ENGINES.has(config.finaleEngine)
    || !jevPalette(config.colorTheme)
    || !config.colors || Object.keys(config.colors).length !== 3
    || Object.entries(jevPalette(config.colorTheme)).some(([key, value]) => config.colors[key] !== value)
    || !['stream', 'page'].includes(config.projection)
    || !['instant', 'progressive'].includes(config.revealMode)) {
    throw new TypeError('Jev returned an invalid reading plan.');
  }
  const resolved = resolveJevChamberConfig(config);
  if (Object.entries(resolved).some(([key, value]) =>
    JSON.stringify(config[key]) !== JSON.stringify(value))) {
    throw new TypeError('Jev returned an invalid reading plan.');
  }
  const visualProgram = compileJevVisualProgram(config);
  if (JSON.stringify(config.visualProgram) !== JSON.stringify(visualProgram)) {
    throw new TypeError('Jev returned an invalid reading plan.');
  }
  return { plan: config, resolved, visualProgram };
}

/** Admit the versioned Worker JSON before offering a reading to the reader. */
export function validateJevRecommendation(decision) {
  if (!decision || decision.schemaVersion !== 1
    || typeof decision.requestId !== 'string' || !decision.requestId || decision.requestId.length > 100
    || typeof decision.model !== 'string' || !/^typesafe\/jev-1\.13(?:-\d{8})?$/.test(decision.model)
    || typeof decision.workId !== 'string' || typeof decision.editionId !== 'string'
    || typeof decision.sourceRevision !== 'string' || typeof decision.reason !== 'string') {
    throw new TypeError('Jev returned an invalid reading plan.');
  }
  return assertPlan(decision);
}

/** Select from the edition's actual divisions, never from model-supplied text. */
export function selectJevDivision(divisions, section) {
  const entries = divisions?.entries;
  if (!Array.isArray(entries) || !SECTIONS.has(section)) {
    throw new TypeError('The selected reading has no available divisions.');
  }
  const first = firstBodyOrdinal(entries, { noun: divisions.noun }) - 1;
  const candidates = entries.slice(first)
    .map((entry, offset) => ({ entry, index: first + offset }))
    .filter(({ entry }) => typeof entry?.content === 'string'
      && entry.content.trim() && entry.content.length <= READING_LIMITS.maxTextCharacters);
  if (!candidates.length) throw new TypeError('The selected reading has no playable division.');
  if (section === 'first') return candidates[0];
  if (section === 'middle') return candidates[Math.floor((candidates.length - 1) / 2)];
  if (section === 'last') return candidates.at(-1);
  return candidates.reduce((chosen, candidate) => {
    const words = Number(candidate.entry.words) || 0;
    const prior = Number(chosen.entry.words) || 0;
    return (section === 'shortest' ? words < prior : words > prior) ? candidate : chosen;
  });
}

/** Resolve an exact released edition into the existing Chamber session input. */
export async function resolveJevReading(decision) {
  const { plan, resolved, visualProgram } = validateJevRecommendation(decision);
  const released = releaseInventory[decision.workId];
  const work = getTextById(decision.workId);
  if (!released || !released.editionId?.startsWith('standard-ebooks:')
    || !released.source?.url?.startsWith('https://standardebooks.org/ebooks/')
    || released.workId !== decision.workId
    || released.editionId !== decision.editionId
    || released.sourceRevision !== decision.sourceRevision
    || work?.provider !== 'archive-ingest'
    || work.editionId !== decision.editionId
    || work.sourceRevision !== decision.sourceRevision
    || typeof work.getDivisions !== 'function') {
    throw new TypeError('The selected edition is not available in this RISE release.');
  }

  const divisions = await work.getDivisions();
  const { entry, index } = selectJevDivision(divisions, plan.section);
  const label = entry.title ? `${entry.label} — ${entry.title}` : entry.label;
  const input = {
    text: entry.content,
    textSource: divisions.divided ? `${work.title} · ${label}` : work.title,
    wpm: plan.wpm,
    curve: plan.curve,
    chunkMode: plan.chunkMode,
    revealMode: plan.revealMode,
    ...resolved,
    visualProgram,
    verseLines: entry.verse === true,
    provenance: work.provenance,
    origin: { view: 'portal', icon: '✧', name: 'Home', experience: 'jev' },
    ...(divisions.divided && divisions.entries.length > 1 ? { continuation: {
      kind: 'library-division',
      workId: work.workId || work.id,
      editionId: work.editionId,
      sourceRevision: work.sourceRevision,
      entryId: String(entry.id),
      entryIndex: index,
      entryCount: divisions.entries.length,
      noun: typeof divisions.noun === 'string' && divisions.noun.trim()
        ? divisions.noun.toLowerCase() : 'entry'
    } } : {})
  };
  return input;
}
