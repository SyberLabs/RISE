import { getTextById } from '../content/library.js';
import { firstBodyOrdinal } from '../content/archive/divisions.js';
import { READING_LIMITS } from '../core/reading-limits.js';
import { CHAMBER_STREAM_FACES } from '../core/chamber-stream-face.js';
import { FONT_SIZE_CHIPS } from '../core/chamber-type-size.js';
import { JEV_AUDIO_IDS, resolveJevChamberConfig } from '../core/jev-config.js';
import { isRiseOriginal, jevReleasedEdition } from '../core/jev-describe.js';
import { JEV_PALETTES, jevColors } from '../core/jev-palette.js';
import {
  compileJevAudioProgram,
  compileJevVisualProgram
} from '../core/jev-sequence.js';
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
const COLORS = new Set(Object.keys(JEV_PALETTES));

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
    || (config.visualArc !== 'single' && config.projection !== 'stream')
    || !ENGINES.has(config.middleEngine) || !ENGINES.has(config.finaleEngine)
    || !COLORS.has(config.colorTheme) || !COLORS.has(config.textColor)
    || !COLORS.has(config.backgroundColor)
    || !AUDIO.has(config.middleAudio) || !AUDIO.has(config.finaleAudio)
    || !COLORS.has(config.middleTheme) || !COLORS.has(config.finaleTheme)
    || !config.colors || Object.keys(config.colors).length !== 3
    || Object.entries(jevColors(config.colorTheme, config.textColor, config.backgroundColor))
      .some(([key, value]) => config.colors[key] !== value)
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
  const audioProgram = compileJevAudioProgram(config);
  if (JSON.stringify(config.audioProgram) !== JSON.stringify(audioProgram)) {
    throw new TypeError('Jev returned an invalid reading plan.');
  }
  return { plan: config, resolved, visualProgram, audioProgram };
}

/** Admit the versioned Worker JSON before offering a reading to the reader. */
export function validateJevRecommendation(decision) {
  if (!decision || decision.schemaVersion !== 2
    || typeof decision.requestId !== 'string' || !decision.requestId || decision.requestId.length > 100
    || typeof decision.model !== 'string'
    || !((decision.model === 'kev-latest' && decision.provider === 'Kev'
      && /^[a-f0-9]{40}$/.test(decision.revision || ''))
      || (/^typesafe\/jev-1\.13(?:-\d{8})?$/.test(decision.model)
        && (!decision.provider || decision.provider === 'TypeSafe'))
      // A roll composed on this device (src/core/roll.js), under its own name.
      || (decision.model === 'rise/roll-1' && decision.provider === 'RISE'))
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

/** Admit a decision, then find the exact division of the exact released edition it names. */
async function openJevDivision(decision) {
  const admitted = validateJevRecommendation(decision);
  // One release rule for rolls, Jev and admission (jev-describe.js).
  const released = jevReleasedEdition(decision.workId);
  const work = getTextById(decision.workId);
  const admittedSource = work?.provider === (isRiseOriginal(decision.workId) ? 'rise-original' : 'archive-ingest');
  if (!released || !admittedSource
    || released.workId !== decision.workId
    || released.editionId !== decision.editionId
    || released.sourceRevision !== decision.sourceRevision
    || work.editionId !== decision.editionId
    || work.sourceRevision !== decision.sourceRevision
    || typeof work.getDivisions !== 'function') {
    throw new TypeError('The selected edition is not available in this RISE release.');
  }

  const divisions = await work.getDivisions();
  return { ...admitted, work, divisions, ...selectJevDivision(divisions, admitted.plan.section) };
}

/** One exact division, by id, whose label must still be the one the caller named. */
function exactDivision(divisions, entryId, label) {
  const index = divisions.entries.findIndex(entry => String(entry.id) === String(entryId));
  const entry = divisions.entries[index];
  if (!entry || entry.label !== label) {
    throw new TypeError(`The division changed: expected “${label}”, found “${entry?.label ?? 'nothing'}”.`);
  }
  return { entry, index };
}

/**
 * Resolve an exact released edition into the existing Chamber session input.
 * `exact` ({ entryId, label }) opens that division instead of the plan's
 * section, under the same edition gate (today's poem).
 */
export async function resolveJevReading(decision, exact = null) {
  const opened = await openJevDivision(decision);
  const { plan, resolved, visualProgram, audioProgram, work, divisions } = opened;
  const { entry, index } = exact ? exactDivision(divisions, exact.entryId, exact.label) : opened;
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
    audioProgram,
    verseLines: entry.verse === true,
    provenance: work.provenance,
    origin: { view: 'home', icon: '✧', name: 'Home', experience: 'jev' },
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

/**
 * The opening of a passage, for a preview: cut at the last line break or
 * sentence end that fits in maxChars. Verse keeps its line breaks. When
 * nothing ends in reach, it cuts between words and ends with an ellipsis.
 */
export function openingOf(text, maxChars = 240) {
  text = text.replace(/^(?:[^\S\n]*\n)+/u, '').trimEnd();
  if (text.length <= maxChars) return text;
  const head = text.slice(0, maxChars + 1);
  let end = 0;
  // A title such as "Mr." does not end a sentence.
  for (const match of head.matchAll(/\n|(?<!\b(?:Mr|Mrs|Ms|Dr|St))[.!?][’”"')\]]*(?=\s)/gu)) {
    const stop = match[0] === '\n' ? match.index : match.index + match[0].length;
    if (stop <= maxChars) end = stop;
  }
  if (end) return text.slice(0, end).trimEnd();
  const space = head.search(/\s\S*$/u);
  return `${text.slice(0, space > 0 ? space : maxChars - 1).trimEnd()}…`;
}

/**
 * The opening of the same division resolveJevReading opens, for a preview,
 * whether that division is verse, so the Chamber reads it by line, and its
 * word count, so Home can say how long it takes.
 */
export async function openingLines(decision) {
  const { entry } = await openJevDivision(decision);
  return { text: openingOf(entry.content, 240), verse: entry.verse === true, words: Number(entry.words) || 0 };
}
