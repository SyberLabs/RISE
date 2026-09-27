import { getTextById } from '../content/library.js';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { firstBodyOrdinal } from '../content/archive/divisions.js';
import { READING_LIMITS } from '../core/reading-limits.js';

const CHUNKS = new Set(['word', 'phrase', 'sentence', 'paragraph']);
const CURVES = new Set(['flat', 'induction', 'ascent', 'wave', 'climax']);
const PACES = new Set([100, 150, 200, 250, 300, 400, 500]);
const AUDIO = new Set(['silent', 'aurora', 'faded-signal', 'focus', 'deep', 'gateway']);
const VISUALS = new Set(['off', 'focals']);
const SECTIONS = new Set(['first', 'shortest', 'longest']);

function assertPlan(decision) {
  const config = decision?.config;
  if (!decision || typeof decision.workId !== 'string' || !config
    || !SECTIONS.has(config.section) || !PACES.has(config.wpm)
    || !CURVES.has(config.curve) || !CHUNKS.has(config.chunkMode)
    || !AUDIO.has(config.audio) || !VISUALS.has(config.visualMode)
    || !['stream', 'page'].includes(config.projection)
    || !['instant', 'progressive'].includes(config.revealMode)) {
    throw new TypeError('Jev returned an invalid reading plan.');
  }
  return config;
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
  return candidates.reduce((chosen, candidate) => {
    const words = Number(candidate.entry.words) || 0;
    const prior = Number(chosen.entry.words) || 0;
    return (section === 'shortest' ? words < prior : words > prior) ? candidate : chosen;
  });
}

/** Resolve an exact released edition into the existing Chamber session input. */
export async function resolveJevReading(decision) {
  const plan = assertPlan(decision);
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
  const audioPreset = ['focus', 'deep', 'gateway'].includes(plan.audio)
    ? plan.audio : 'silent';
  const soundscape = ['aurora', 'faded-signal'].includes(plan.audio)
    ? plan.audio : 'none';
  const input = {
    text: entry.content,
    textSource: divisions.divided ? `${work.title} · ${label}` : work.title,
    wpm: plan.wpm,
    curve: plan.curve,
    chunkMode: plan.chunkMode,
    revealMode: plan.revealMode,
    audioPreset,
    soundscape,
    projection: plan.projection,
    visualConfig: {
      visualMode: plan.visualMode,
      ...(plan.visualMode === 'focals'
        ? { focals: { type: 'standard', standardGlyph: 'breath', personalImage: null } }
        : {})
    },
    verseLines: entry.verse === true,
    provenance: work.provenance,
    origin: { view: 'portal', icon: '✧', name: 'Home' },
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
