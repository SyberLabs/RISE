/**
 * Catalog eligibility for automatic Jev visual direction.
 *
 * A reading's labels only say where to look. Eligibility comes from trusted
 * source loading — the released archive, loaded again through its provider
 * — and verified content identity: the reading's exact text must equal a
 * released entry, or the released work read whole. Pasted, uploaded, or
 * edited text never passes, whatever its labels claim.
 */

function catalogPointer(session) {
  const continuation = session?.continuation;
  if (continuation?.kind === 'library-division' && typeof continuation.workId === 'string') {
    return {
      workId: continuation.workId,
      editionId: continuation.editionId,
      sourceRevision: continuation.sourceRevision
    };
  }
  const provenance = session?.provenance;
  if (provenance?.kind === 'library-work' && typeof provenance.workId === 'string') {
    return { workId: provenance.workId };
  }
  return null;
}

async function loadArchiveContents(workId) {
  const { ArchiveTextProvider } = await import('../../sources/text/archive.js');
  return new ArchiveTextProvider().getContents(workId);
}

/**
 * @param {object} session a compiled session (with in-memory source text)
 * @param {{ loadContents?: (workId: string) => Promise<object> }} [options]
 * @returns {Promise<boolean>}
 */
export async function verifyCatalogReading(session, { loadContents = loadArchiveContents } = {}) {
  const sources = Array.isArray(session?.sources) ? session.sources : [];
  if (sources.length !== 1 || !(session?.sourceTexts instanceof Map)) return false;
  const text = session.sourceTexts.get(sources[0].id);
  const pointer = catalogPointer(session);
  if (typeof text !== 'string' || !text.trim() || !pointer) return false;
  let contents;
  try {
    contents = await loadContents(pointer.workId);
  } catch {
    return false;
  }
  const metadata = contents?.item?.metadata || {};
  if ((metadata.workId || contents?.item?.id) !== pointer.workId) return false;
  if (pointer.editionId !== undefined
    && (metadata.editionId !== pointer.editionId || metadata.sourceRevision !== pointer.sourceRevision)) {
    return false;
  }
  const entries = (Array.isArray(contents?.entries) ? contents.entries : [])
    .map(entry => String(entry?.content ?? entry ?? ''))
    .filter(content => content.trim());
  if (entries.includes(text)) return true;
  return entries.length > 1 && entries.join('\n\n') === text;
}
