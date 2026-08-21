const HASH_PATTERN = /^sha256:[a-f0-9]{64}$/;

function boundedString(value, name, max = 240) {
  if (typeof value !== 'string' || !value.trim()) {
    throw new TypeError(`Reading continuation ${name} must be a non-empty string.`);
  }
  return value.trim().slice(0, max);
}

/**
 * A bounded pointer to the next division of an ordinary Archive reading.
 * It deliberately carries no prose: the exact edition is resolved again at
 * the continuation boundary, where a revision mismatch can be refused.
 */
export function createLibraryContinuation(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  if (value.kind !== 'library-division') return null;

  const workId = boundedString(value.workId, 'workId');
  const editionId = boundedString(value.editionId, 'editionId');
  const sourceRevision = boundedString(value.sourceRevision, 'sourceRevision', 80);
  if (!HASH_PATTERN.test(sourceRevision)) {
    throw new TypeError('Reading continuation sourceRevision must be a sha256 content hash.');
  }

  const entryIndex = Number(value.entryIndex);
  const entryCount = Number(value.entryCount);
  if (!Number.isInteger(entryIndex) || entryIndex < 0) {
    throw new TypeError('Reading continuation entryIndex must be a non-negative integer.');
  }
  if (!Number.isInteger(entryCount) || entryCount < 1 || entryIndex >= entryCount) {
    throw new TypeError('Reading continuation entryCount must include the current entry.');
  }

  return Object.freeze({
    kind: 'library-division',
    workId,
    editionId,
    sourceRevision,
    entryId: boundedString(String(value.entryId), 'entryId'),
    entryIndex,
    entryCount,
    noun: typeof value.noun === 'string' && value.noun.trim()
      ? value.noun.trim().slice(0, 48).toLowerCase()
      : 'entry'
  });
}

export function hasNextLibraryDivision(value) {
  const continuation = createLibraryContinuation(value);
  return Boolean(continuation && continuation.entryIndex + 1 < continuation.entryCount);
}

/** Resolve a successor from a freshly loaded, exactly identified edition. */
export function resolveNextLibraryDivision(value, contents) {
  const continuation = createLibraryContinuation(value);
  if (!continuation || continuation.entryIndex + 1 >= continuation.entryCount) return null;

  const metadata = contents?.item?.metadata || {};
  const actualWorkId = metadata.workId || contents?.item?.id;
  if (actualWorkId !== continuation.workId
    || metadata.editionId !== continuation.editionId
    || metadata.sourceRevision !== continuation.sourceRevision) {
    const error = new Error('This Archive edition changed after the reading began. Return to the Library to choose the reviewed edition.');
    error.code = 'READING_CONTINUATION_SOURCE_CHANGED';
    throw error;
  }

  const entries = Array.isArray(contents?.entries) ? contents.entries : [];
  if (entries.length !== continuation.entryCount) {
    const error = new Error('This Archive edition no longer has the same division structure. Return to the Library to choose a reading.');
    error.code = 'READING_CONTINUATION_STRUCTURE_CHANGED';
    throw error;
  }

  const current = entries[continuation.entryIndex];
  if (!current || String(current.id) !== continuation.entryId) {
    const error = new Error('The current division can no longer be located in this Archive edition.');
    error.code = 'READING_CONTINUATION_ENTRY_CHANGED';
    throw error;
  }

  const nextIndex = continuation.entryIndex + 1;
  const entry = entries[nextIndex];
  if (!entry) return null;

  return Object.freeze({
    entry,
    continuation: createLibraryContinuation({
      ...continuation,
      entryId: String(entry.id),
      entryIndex: nextIndex
    })
  });
}
