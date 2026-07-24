/**
 * Runtime boundary for content-authored visual programs.
 *
 * Programs are launch identity: they travel with a reading, survive the
 * Chamber's destroy/recreate cycle, and remain opaque to the generic
 * scheduler/cortex. This module keeps that persisted boundary bounded and
 * restores the one non-JSON value the scripture matcher legitimately uses:
 * Infinity for "through the end of the chapter".
 */

const INFINITY_TOKEN = '__rise_infinity__';
const MAX_SEGMENTS = 512;
const MAX_COLLECTIONS = 32;
const MAX_ID_LENGTH = 160;
const MAX_FOCAL_FIELDS = 32;

function boundedString(value, max = MAX_ID_LENGTH) {
  return typeof value === 'string' ? value.slice(0, max) : '';
}

function positiveInteger(value) {
  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

function normalizeFocal(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  const focal = {};
  for (const [rawKey, rawValue] of Object.entries(value).slice(0, MAX_FOCAL_FIELDS)) {
    const key = boundedString(rawKey, 80);
    if (!key) continue;
    if (typeof rawValue === 'string') focal[key] = boundedString(rawValue, 2048);
    else if (typeof rawValue === 'boolean') focal[key] = rawValue;
    else if (typeof rawValue === 'number' && Number.isFinite(rawValue)) focal[key] = rawValue;
  }
  return focal;
}

export function normalizeVisualCue(value) {
  if (!value || typeof value !== 'object') return { kind: 'still' };
  if (value.kind === 'sourced') {
    const collections = Array.isArray(value.collections)
      ? [...new Set(value.collections
        .map(id => boundedString(id))
        .filter(Boolean))].slice(0, MAX_COLLECTIONS)
      : [];
    return collections.length
      ? { kind: 'sourced', collections }
      : { kind: 'still' };
  }
  if (value.kind === 'focal') {
    return { kind: 'focal', focal: normalizeFocal(value.focal) };
  }
  return { kind: 'still' };
}

/**
 * Return a safe executable copy, or null when the value is not a scripture
 * program. The infinity token is accepted here so deserialization and normal
 * in-memory normalization share exactly one validation path.
 */
export function normalizeVisualProgram(value) {
  if (!value || typeof value !== 'object'
    || value.coordinateSpace !== 'scripture'
    || !Array.isArray(value.segments)) {
    return null;
  }

  const segments = [];
  for (const segment of value.segments.slice(0, MAX_SEGMENTS)) {
    const chapter = positiveInteger(segment?.match?.chapter);
    const verseStart = positiveInteger(segment?.match?.verseStart);
    const rawEnd = segment?.match?.verseEnd;
    const verseEnd = rawEnd === Infinity || rawEnd === INFINITY_TOKEN
      ? Infinity
      : positiveInteger(rawEnd);
    const id = boundedString(segment?.id);
    if (!id || !chapter || !verseStart || !verseEnd || verseEnd < verseStart) continue;
    segments.push({
      id,
      match: { chapter, verseStart, verseEnd },
      cue: normalizeVisualCue(segment.cue)
    });
  }
  if (!segments.length) return null;

  return {
    coordinateSpace: 'scripture',
    enabled: value.enabled !== false,
    segments,
    fallback: normalizeVisualCue(value.fallback)
  };
}

/**
 * Produce a JSON-safe program. JSON.stringify(Infinity) silently writes null,
 * which previously made a restored end-of-chapter segment unmatchable.
 */
export function serializeVisualProgram(value) {
  const program = normalizeVisualProgram(value);
  if (!program) return null;
  return {
    ...program,
    segments: program.segments.map(segment => ({
      ...segment,
      match: {
        ...segment.match,
        verseEnd: segment.match.verseEnd === Infinity
          ? INFINITY_TOKEN
          : segment.match.verseEnd
      }
    }))
  };
}

export function deserializeVisualProgram(value) {
  return normalizeVisualProgram(value);
}
