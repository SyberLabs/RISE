/**
 * Resolve Library works named by a proposed Experience Program into
 * Workshop-shaped sources. Ids and titles only leave the building;
 * payloads are loaded here at accept time
 * (docs/vision/SCRIPTORIUM-SPEC.md §7).
 */

import { ingestedArchiveTexts } from '../content/archive/index.js';
import { isLocalWorkId, localWorkRuntime } from './local-works.js';
import { mostlyVerse } from '../content/archive/divisions.js';
import { assertQuotationAnchorsAgainstSources } from './source-span.js';
import { createCuratorSourceReader } from './curator-context.js';
import {
  LIBRARY_LOAD_REFUSAL,
  operationSetSourceIds,
  programSourceIds
} from './experience-program-io.js';
import { countWords } from './chunker.js';
import {
  EXTENT_REFUSAL,
  extentSourceName,
  parseLibraryExtent,
  sentenceAlignedPrefix
} from './library-extent.js';

function sectionsToText(sections) {
  if (!Array.isArray(sections)) return '';
  return sections
    .map(section => {
      if (typeof section === 'string') return section;
      if (section && typeof section.content === 'string') return section.content;
      return '';
    })
    .filter(Boolean)
    .join('\n\n');
}

/**
 * @param {string[]} ids
 * @returns {Promise<{ sources: object[], missing: string[], refused: string[],
 *   reasons: Record<string, string> }>}
 *   `reasons` maps every refused id to a LIBRARY_LOAD_REFUSAL member. It is
 *   what the phrasing reads. `describeImportFailure` used to re-derive the
 *   reason by re-parsing the id, which cannot tell a below-floor cut from a
 *   division holding no text — and told the reader the second when it was
 *   the first. Only this loop knows, so only this loop says.
 */
/**
 * @param {string[]} ids source ids, each `work`, `work#12` or `work#12:200`
 * @param {{ localWorks?: Array }} [overlay] reader works the session holds,
 *   as `rise.local-work.v1` records. Asked AFTER the archive, and reachable
 *   only under the reserved `local-` prefix, so an id can belong to exactly
 *   one registry — an overlay that could shadow a shelved work would make a
 *   reader's file silently replace an edition RISE answers for.
 */
export async function resolveLibrarySourceIds(ids = [], { localWorks = [] } = {}) {
  const wanted = [...new Set(ids.filter(Boolean))];
  const registry = ingestedArchiveTexts();
  const byId = new Map(registry.map(work => [work.id, work]));
  for (const record of Array.isArray(localWorks) ? localWorks : []) {
    if (!record || !isLocalWorkId(record.id) || byId.has(record.id)) continue;
    byId.set(record.id, localWorkRuntime(record));
  }
  const sources = [];
  const missing = [];
  const refused = [];
  const reasons = {};
  const refuse = (id, reason) => {
    refused.push(id);
    reasons[id] = reason;
  };

  for (const id of wanted) {
    const extent = parseLibraryExtent(id);
    // An id that names an extent badly is refused as an extent. Reporting it
    // as a missing WORK was the lie: the work is on the shelf, and it was the
    // cut that could not be honoured.
    //
    // ONLY THE GRAMMAR IS JUDGED BEFORE THE SHELF IS ASKED, and it is the one
    // verdict that can be: an id whose shape is wrong names no work at all —
    // `workId` is the whole unparsed string — so there is nothing to look up.
    //
    // THE FLOOR IS NOT SUCH A VERDICT, and treating it as one was the defect.
    // `parseLibraryExtent` sees a sub-floor `:N` in the string and nothing
    // else, so refusing here made a fact about the cut shadow the question of
    // whether the work or the division exists: `no-such-work-at-all#5:20` and
    // `sacred-tao-te-ching#900:39` were both refused FLOOR, and the wording
    // that reads a FLOOR reason says "The division itself is here and has
    // text" — about a work that may not be on this build's shelf, and a
    // chapter the Tao does not have. The same ids spelled `:200` were
    // correctly absent and correctly no-such-division, so which of §13's four
    // statuses a script learned turned on the `:N`. The floor is judged in
    // resolveDivisionExtent, after the work, the division and its text are
    // established — where the sentence it earns is true.
    if (extent.refusal === EXTENT_REFUSAL.GRAMMAR) {
      refuse(id, LIBRARY_LOAD_REFUSAL.GRAMMAR);
      continue;
    }
    const work = byId.get(extent.workId);
    if (!work) {
      missing.push(id);
      continue;
    }
    try {
      const resolved = extent.division
        ? await resolveDivisionExtent(work, extent)
        : await resolveWholeWork(work);
      if (resolved.refusal) {
        refuse(id, resolved.refusal);
        continue;
      }
      const { opening, refusal, ...source } = resolved;
      sources.push({
        // The id keeps its extent: a score that named a division must go on
        // naming it, and its media anchors are written against these ids.
        id,
        // Where this reading came from, and the Vault will show it: a work
        // RISE prepared is not a file the reader dropped in, and a saved
        // project that cannot tell them apart is one nobody can audit.
        providerId: work.providerId || 'archive-ingest',
        type: 'text/plain',
        ...source,
        metadata: {
          author: work.author || null,
          tradition: work.tradition || null,
          // Where this text came from, for a reading that is part of a work.
          workId: work.id,
          ...(extent.division ? { division: extent.division } : {}),
          ...(opening ? { opening: true } : {})
        }
      });
    } catch {
      refuse(id, LIBRARY_LOAD_REFUSAL.LOAD_FAILED);
    }
  }

  return { sources, missing, refused, reasons };
}

async function resolveWholeWork(work) {
  const sections = await work.getSections();
  const data = sectionsToText(sections);
  if (!data) return { refusal: LIBRARY_LOAD_REFUSAL.EMPTY_WORK };
  const words = typeof work.wordCount === 'number' ? work.wordCount : countWords(data);
  return { name: work.title || work.id, words, data, verseLines: mostlyVerse(sections) };
}

/**
 * A named division of a work, or its opening when the score asked for less
 * than the division holds. A division the work does not have is a refusal,
 * never the nearest one it does have — the same law the swells follow: a work
 * that will not resolve is absent, never a substitute.
 *
 * EACH REFUSAL SAYS WHICH IT IS. These four used to be one `null`, and the
 * wording downstream then had to guess from the id — which is how a 37-word
 * cut against a 40-word floor came to be reported as a division holding no
 * text.
 */
async function resolveDivisionExtent(work, extent) {
  if (typeof work.getDivisions !== 'function') {
    return { refusal: LIBRARY_LOAD_REFUSAL.UNDIVIDED };
  }
  const scheme = await work.getDivisions();
  const entries = Array.isArray(scheme?.entries) ? scheme.entries : [];
  // AN ORDINAL IS A POSITION IN THE SCHEME, not the `ordinal` field. Only
  // about half the library's schemes carry that field at all, and one of them
  // begins at two — so reading it would have refused a division most works
  // have. `divisions.count` the model is given is this array's length.
  const entry = entries[extent.division - 1];
  if (!entry) return { refusal: LIBRARY_LOAD_REFUSAL.NO_DIVISION };
  const content = typeof entry.content === 'string' ? entry.content.trim() : '';
  if (!content) return { refusal: LIBRARY_LOAD_REFUSAL.EMPTY_DIVISION };

  // EXISTENCE FIRST, THEN THE FLOOR. Everything the floor's wording asserts —
  // that the work is here, that this division is here, that it holds text —
  // has now been established rather than assumed, so the refusal states facts
  // instead of inventing them. A sub-floor ask on a division nobody has is
  // refused above as the missing division it is.
  if (extent.refusal === EXTENT_REFUSAL.FLOOR) {
    return { refusal: LIBRARY_LOAD_REFUSAL.FLOOR };
  }

  const asked = extent.words;
  // A cut with no honest boundary within reach is a refusal, not a longer
  // reading (see sentenceAlignedPrefix).
  const cut = asked ? sentenceAlignedPrefix(content, asked) : null;
  if (asked && !cut) return { refusal: LIBRARY_LOAD_REFUSAL.NO_BOUNDARY };
  const opening = Boolean(cut && cut.boundary !== 'whole');
  return {
    name: extentSourceName({
      workTitle: work.title || work.id,
      noun: scheme?.noun || work.chapterNoun,
      ordinal: extent.division,
      divisionTitle: entry.title,
      label: entry.label,
      opening
    }),
    words: opening
      ? cut.words
      : (Number.isInteger(entry.words) ? entry.words : countWords(content)),
    data: opening ? cut.text : content,
    // The edition said so at ingest; nothing here re-derives it.
    verseLines: entry.verse === true,
    opening
  };
}

/**
 * @param {object} program validated experience program
 * @returns {Promise<{ sources: object[], missing: string[], refused: string[] }>}
 */
export async function resolveProgramLibrarySources(program, overlay = {}) {
  return resolveLibrarySourceIds(programSourceIds(program), overlay);
}

export async function resolveOperationLibrarySources(operationSet) {
  return resolveLibrarySourceIds(operationSetSourceIds(operationSet));
}

/**
 * After Library works are loaded, refuse ambiguous quotation anchors so the
 * curator can extend them — before a Vault draft is saved.
 */
export function assertResolvedProgramQuotations(program, sources) {
  return assertQuotationAnchorsAgainstSources(program, sources);
}

/**
 * Preview rows for the Scriptorium verdict — no payloads.
 *
 * An extent id is looked up through the same reader the gate uses, so a row
 * for `sacred-tao-te-ching#40` says which chapter it is and how long it runs
 * instead of showing the raw id beside a blank length.
 */
export function previewProgramChoices(program, context = null) {
  const library = new Map((context?.library || []).map(item => [item.id, item]));
  const read = createCuratorSourceReader(context || {});
  const sourceIds = programSourceIds(program);
  const tracks = (program.tracks || []).map(track => ({
    kind: track.kind,
    clipCount: (track.clips || []).length
  }));
  const sources = sourceIds.map(id => {
    const reading = read(id);
    const entry = library.get(id) || library.get(reading.workId);
    return {
      id,
      title: entry?.title
        ? extentSourceName({
          workTitle: entry.title,
          noun: entry.divisions?.noun,
          ordinal: reading.division,
          label: entry.divisions?.labels?.[reading.division - 1],
          opening: reading.askedWords != null
        })
        : id,
      author: entry?.author || null,
      words: reading.words ?? entry?.words ?? null,
      divisionsTitled: entry?.divisions?.titled === true,
      divisionsAuthored: entry?.divisions?.authored === true,
      divisionsReason: entry?.divisions?.reason || null
    };
  });
  return { sources, tracks, authority: program.authority };
}
