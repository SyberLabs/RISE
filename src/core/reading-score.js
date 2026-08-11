/**
 * Scored pace — how a reading track becomes cuts and durations.
 *
 * A scored pace is a DEFAULT. It decides what the reader meets having asked
 * for nothing; their own controls stay above it. That ruling shows up twice
 * here: outside a scored span the session's own pace governs (there is no
 * track-level fallback to overrule it), and scored durations are baked into
 * atoms so the Chamber's speed control keeps scaling the whole reading
 * uniformly — the reader sets the tempo, the score keeps its contour.
 */

import { resolveSourceSpan, buildNormalizedSourceIndex } from './source-span.js';
import { anchorCoordinateSystem } from './experience-program.js';

export class ReadingScoreError extends Error {
  constructor(code, message, details = {}) {
    super(message);
    this.name = 'ReadingScoreError';
    this.code = code;
    this.details = details;
  }
}

function readingClipsForSource(readingProgram, sourceId) {
  const segments = readingProgram?.segments;
  if (!Array.isArray(segments) || !sourceId) return [];
  return segments.filter(segment =>
    Array.isArray(segment?.match?.sourceIds) && segment.match.sourceIds.includes(sourceId));
}

/**
 * Duration is inversely proportional to pace, so retiming an atom cut at one
 * wpm to another is the ratio of the two — no re-chunking, no re-measuring.
 */
export function paceFactor(fromWpm, toWpm) {
  if (!Number.isFinite(fromWpm) || !Number.isFinite(toWpm) || fromWpm <= 0 || toWpm <= 0) return 1;
  return fromWpm / toWpm;
}

/**
 * Resolve one source's reading clips into an ordered cutting plan.
 *
 * The canonical validator has already guaranteed the shape this relies on:
 * same-lane exclusivity means a source carries at most one unranged clip and
 * any number of ranged clips in a SINGLE coordinate system. So the base layer
 * is unambiguous and the ranged spans cannot fight each other.
 *
 * Unranged clips lose to ranged ones where they overlap, which is the nesting
 * `sameLaneClipsConflict` permits and the runtime is expected to resolve.
 *
 * @returns {{ pieces: Array<{fromCharacter: number, toCharacter: number, mode: string, wpm: number}>,
 *             progressPace: Array<{fromProgress: number, toProgress: number, wpm: number}>,
 *             recut: boolean }}
 */
export function buildReadingPlan(readingProgram, source, defaults = {}) {
  const text = typeof source?.raw === 'string' ? source.raw : '';
  const defaultMode = defaults.chunkMode || 'word';
  const defaultWpm = Number(defaults.wpm) || 320;
  const whole = [{ fromCharacter: 0, toCharacter: text.length, mode: defaultMode, wpm: defaultWpm }];
  const clips = readingClipsForSource(readingProgram, source?.id);
  if (!clips.length || !text) {
    return { pieces: whole, progressPace: [], recut: false };
  }

  let baseMode = defaultMode;
  let baseWpm = defaultWpm;
  const progressPace = [];
  const spans = [];
  let normalizedIndex;

  for (const clip of clips) {
    const system = anchorCoordinateSystem(clip.match);
    const cue = clip.cue || {};
    if (system === 'unranged') {
      if (cue.chunkMode !== undefined) baseMode = cue.chunkMode;
      if (cue.wpm !== undefined) baseWpm = cue.wpm;
      continue;
    }
    if (system === 'progress') {
      if (cue.wpm !== undefined) {
        progressPace.push({
          fromProgress: clip.match.fromProgress,
          toProgress: clip.match.toProgress,
          wpm: cue.wpm
        });
      }
      continue;
    }
    if (normalizedIndex === undefined) normalizedIndex = buildNormalizedSourceIndex(text);
    const span = resolveSourceSpan(clip.match, text, `$.reading.${clip.id}`, { normalizedIndex });
    if (!span) continue;
    spans.push({ from: span.fromCharacter, to: span.toCharacter, cue });
  }

  if (!spans.length) {
    const recut = baseMode !== defaultMode;
    return {
      pieces: [{ fromCharacter: 0, toCharacter: text.length, mode: baseMode, wpm: baseWpm }],
      progressPace,
      recut
    };
  }

  spans.sort((left, right) => left.from - right.from);
  const pieces = [];
  let cursor = 0;
  for (const span of spans) {
    if (span.from > cursor) {
      pieces.push({ fromCharacter: cursor, toCharacter: span.from, mode: baseMode, wpm: baseWpm });
    }
    pieces.push({
      fromCharacter: Math.max(span.from, cursor),
      toCharacter: span.to,
      mode: span.cue.chunkMode ?? baseMode,
      wpm: span.cue.wpm ?? baseWpm
    });
    cursor = Math.max(cursor, span.to);
  }
  if (cursor < text.length) {
    pieces.push({ fromCharacter: cursor, toCharacter: text.length, mode: baseMode, wpm: baseWpm });
  }

  const recut = pieces.length > 1 || pieces[0].mode !== defaultMode;
  return { pieces: pieces.filter(piece => piece.toCharacter > piece.fromCharacter), progressPace, recut };
}

/**
 * A chunk profile prepares the WHOLE text — the scripture profile numbers
 * verses across it, the dialogue profile promotes speaker heads — so cutting
 * it into pieces would prepare each side as if the other did not exist.
 *
 * Refused rather than approximated. A pace scored over the whole source is
 * still available, because one piece is never cut.
 */
export function assertChunkProfileAllowsRecut(source, plan) {
  if (!plan?.recut || !source?.chunkProfile) return;
  throw new ReadingScoreError(
    'READING_SCORE_PROFILE_CONFLICT',
    `Source "${source.name || source.id}" uses the ${source.chunkProfile} chunk profile, which prepares the whole text, so a pace that varies within the source cannot cut it. Score the whole source instead, or remove the profile.`,
    { sourceId: source.id, chunkProfile: source.chunkProfile }
  );
}

/**
 * Retime atoms falling inside progress-coordinate pace cues.
 *
 * Runs after `sourceProgress` is stamped, because that is the coordinate the
 * cue is written in. `timingLocked` atoms are left alone: that flag means the
 * duration was chosen rather than computed, and an authored pause is authored
 * whatever the pace around it.
 */
export function applyProgressPace(atoms, progressPace, pieceWpmAt) {
  if (!Array.isArray(progressPace) || !progressPace.length) return 0;
  let retimed = 0;
  for (const atom of atoms) {
    if (!atom || atom.timingLocked) continue;
    const progress = Number(atom.sourceProgress);
    if (!Number.isFinite(progress)) continue;
    const cue = progressPace.find(entry =>
      progress >= entry.fromProgress && progress < entry.toProgress);
    if (!cue) continue;
    const from = pieceWpmAt(atom);
    const factor = paceFactor(from, cue.wpm);
    if (factor === 1) continue;
    atom.duration = Math.max(1, Math.round(atom.duration * factor));
    retimed += 1;
  }
  return retimed;
}
