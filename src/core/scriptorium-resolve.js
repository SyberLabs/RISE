/**
 * Resolve Library works named by a proposed Experience Program into
 * Workshop-shaped sources. Ids and titles only leave the building;
 * payloads are loaded here at accept time (SCRIPTORIUM-SPEC §7).
 */

import { ingestedArchiveTexts } from '../content/archive/index.js';
import { mostlyVerse } from '../content/archive/divisions.js';
import { isBoundarySource } from './journey-compiler.js';
import { assertQuotationAnchorsAgainstSources } from './source-span.js';
import {
  countWords,
  extentSourceName,
  parseLibraryExtent,
  sentenceAlignedPrefix
} from './library-extent.js';

function programSourceIds(program) {
  const ids = new Set();
  for (const track of program?.tracks || []) {
    for (const clip of track.clips || []) {
      for (const sourceId of clip.anchor?.sourceIds || []) {
        if (isBoundarySource(sourceId)) continue;
        ids.add(sourceId);
      }
      const after = clip.anchor?.afterSourceId;
      const before = clip.anchor?.beforeSourceId;
      if (after && !isBoundarySource(after)) ids.add(after);
      if (before && !isBoundarySource(before)) ids.add(before);
    }
  }
  return [...ids];
}

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
 * @returns {Promise<{ sources: object[], missing: string[], refused: string[] }>}
 */
export async function resolveLibrarySourceIds(ids = []) {
  const wanted = [...new Set(ids.filter(Boolean))];
  const registry = ingestedArchiveTexts();
  const byId = new Map(registry.map(work => [work.id, work]));
  const sources = [];
  const missing = [];
  const refused = [];

  for (const id of wanted) {
    const extent = parseLibraryExtent(id);
    const work = byId.get(extent.workId);
    if (!work) {
      missing.push(id);
      continue;
    }
    try {
      const resolved = extent.division
        ? await resolveDivisionExtent(work, extent)
        : await resolveWholeWork(work);
      if (!resolved) {
        refused.push(id);
        continue;
      }
      const { opening, ...source } = resolved;
      sources.push({
        // The id keeps its extent: a score that named a division must go on
        // naming it, and its media anchors are written against these ids.
        id,
        providerId: 'archive-ingest',
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
      refused.push(id);
    }
  }

  return { sources, missing, refused };
}

async function resolveWholeWork(work) {
  const sections = await work.getSections();
  const data = sectionsToText(sections);
  if (!data) return null;
  const words = typeof work.wordCount === 'number' ? work.wordCount : countWords(data);
  return { name: work.title || work.id, words, data, verseLines: mostlyVerse(sections) };
}

/**
 * A named division of a work, or its opening when the score asked for less
 * than the division holds. A division the work does not have is a refusal,
 * never the nearest one it does have — the same law the swells follow: a work
 * that will not resolve is absent, never a substitute.
 */
async function resolveDivisionExtent(work, extent) {
  if (typeof work.getDivisions !== 'function') return null;
  const scheme = await work.getDivisions();
  const entries = Array.isArray(scheme?.entries) ? scheme.entries : [];
  // AN ORDINAL IS A POSITION IN THE SCHEME, not the `ordinal` field. Only
  // about half the library's schemes carry that field at all, and one of them
  // begins at two — so reading it would have refused a division most works
  // have. `divisions.count` the model is given is this array's length.
  const entry = entries[extent.division - 1];
  if (!entry) return null;
  const content = typeof entry.content === 'string' ? entry.content.trim() : '';
  if (!content) return null;

  const asked = extent.words;
  const cut = asked ? sentenceAlignedPrefix(content, asked) : null;
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
export async function resolveProgramLibrarySources(program) {
  return resolveLibrarySourceIds(programSourceIds(program));
}

export async function resolveOperationLibrarySources(operationSet) {
  const ids = (operationSet?.operations || [])
    .filter(item => item.op === 'add-source')
    .map(item => item.sourceId);
  return resolveLibrarySourceIds(ids);
}

/**
 * After Library works are loaded, refuse ambiguous quotation anchors so the
 * curator can extend them — before a Vault draft is saved.
 */
export function assertResolvedProgramQuotations(program, sources) {
  return assertQuotationAnchorsAgainstSources(program, sources);
}

/** Preview rows for the Scriptorium verdict — no payloads. */
export function previewProgramChoices(program, context = null) {
  const library = new Map((context?.library || []).map(item => [item.id, item]));
  const sourceIds = programSourceIds(program);
  const tracks = (program.tracks || []).map(track => ({
    kind: track.kind,
    clipCount: (track.clips || []).length
  }));
  const sources = sourceIds.map(id => {
    const entry = library.get(id);
    return {
      id,
      title: entry?.title || id,
      author: entry?.author || null,
      words: entry?.words ?? null,
      divisionsTitled: entry?.divisions?.titled === true,
      divisionsAuthored: entry?.divisions?.authored === true,
      divisionsReason: entry?.divisions?.reason || null
    };
  });
  return { sources, tracks, authority: program.authority };
}
