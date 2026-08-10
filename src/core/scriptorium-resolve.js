/**
 * Resolve Library works named by a proposed Experience Program into
 * Workshop-shaped sources. Ids and titles only leave the building;
 * payloads are loaded here at accept time (SCRIPTORIUM-SPEC §7).
 */

import { ingestedArchiveTexts } from '../content/archive/index.js';
import { isBoundarySource } from './journey-compiler.js';
import { assertQuotationAnchorsAgainstSources } from './source-span.js';

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
 * @param {object} program validated experience program
 * @returns {Promise<{ sources: object[], missing: string[], refused: string[] }>}
 */
export async function resolveProgramLibrarySources(program) {
  const wanted = programSourceIds(program);
  const registry = ingestedArchiveTexts();
  const byId = new Map(registry.map(work => [work.id, work]));
  const sources = [];
  const missing = [];
  const refused = [];

  for (const id of wanted) {
    const work = byId.get(id);
    if (!work) {
      missing.push(id);
      continue;
    }
    try {
      const sections = await work.getSections();
      const data = sectionsToText(sections);
      if (!data) {
        refused.push(id);
        continue;
      }
      const words = typeof work.wordCount === 'number'
        ? work.wordCount
        : data.split(/\s+/u).filter(Boolean).length;
      sources.push({
        id: work.id,
        name: work.title || work.id,
        providerId: 'archive-ingest',
        type: 'text/plain',
        words,
        data,
        metadata: {
          author: work.author || null,
          tradition: work.tradition || null
        }
      });
    } catch {
      refused.push(id);
    }
  }

  return { sources, missing, refused };
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
