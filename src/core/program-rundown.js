/**
 * What a proposed score will actually DO, in a reader's words.
 *
 * The Scriptorium accepts a score without opening the Workshop, so this is
 * the only place a reader sees what they are agreeing to. It answers the
 * questions the score's JSON does not: how long, how it moves, what is behind
 * it, what it sounds like.
 *
 * Reading only. It never edits a program, and nothing derived here is written
 * back — a span described as "the first third" is prose about a progress
 * anchor, not a second coordinate the runtime could disagree with.
 */

import { anchorCoordinateSystem } from './experience-program.js';

const PERCENT = fraction => `${Math.round(fraction * 100)}%`;

function catalogName(context, section, id) {
  const entry = context?.catalog?.[section]?.[id];
  return entry?.name || id;
}

/**
 * Where a clip sits, said in the coordinate the author actually used.
 *
 * Progress is stated as a percentage because that is what it is; a quotation
 * is stated by its own words. Neither is converted into the other — the
 * Workshop's character spans are a different coordinate and turning one into
 * the other for display is how an approximate range becomes an authored one.
 */
export function describeSpan(anchor) {
  switch (anchorCoordinateSystem(anchor)) {
    case 'progress': {
      const from = anchor.fromProgress;
      const to = anchor.toProgress;
      if (from === 0 && to === 1) return 'throughout';
      if (from === 0) return `the first ${PERCENT(to)}`;
      if (to === 1) return `the last ${PERCENT(1 - from)}`;
      return `${PERCENT(from)}–${PERCENT(to)}`;
    }
    case 'quotation':
      return `from “${anchor.quoteStart}” to “${anchor.quoteEnd}”`;
    case 'character':
      return `characters ${anchor.fromCharacter}–${anchor.toCharacter}`;
    case 'token':
      return `words ${anchor.fromToken}–${anchor.toToken}`;
    default:
      return 'throughout';
  }
}

function describeVisualCue(cue, context) {
  if (cue.kind === 'still') return 'nothing — a still ground';
  if (cue.kind === 'focal') return 'a focal image';
  if (cue.kind === 'field') return `the ${cue.renderer} field`;
  const names = (cue.collections || []).map(id => catalogName(context, 'collections', id));
  const engines = (cue.engines || []).map(id => catalogName(context, 'engines', id));
  const shown = engines.length ? engines : names;
  return shown.join(', ') || cue.kind;
}

function describeAudioCue(cue, context) {
  if (cue.kind === 'silence') return 'silence';
  if (cue.kind === 'hold') return 'whatever was already sounding';
  if (cue.kind === 'soundscape') return catalogName(context, 'soundscapes', cue.soundscapeId);
  if (cue.kind === 'tone') return `${cue.presetId} tone`;
  return cue.kind;
}

/**
 * A pace cue as a sentence. Both fields are optional and either alone is a
 * complete instruction, so the two halves are composed rather than templated.
 */
export function describePace(cue) {
  const parts = [];
  if (cue.wpm !== undefined) parts.push(`${cue.wpm} words a minute`);
  if (cue.chunkMode !== undefined) {
    parts.push(cue.chunkMode === 'word' ? 'one word at a time' : `in ${cue.chunkMode}s`);
  }
  return parts.join(', ');
}

const trackOf = (program, kind) => (program?.tracks || []).find(track => track.kind === kind);

/**
 * @returns {{
 *   title: string, authority: string,
 *   movements: Array<{id, title, sources: Array<{id, title, words}>, words: number|null}>,
 *   pace: Array<{span: string, description: string}>,
 *   visuals: Array<{span: string, description: string}>,
 *   audio: Array<{span: string, description: string}>,
 *   totals: { words: number|null, movements: number, clips: number },
 *   unpaced: boolean
 * }}
 */
export function describeProgramRundown(program, context = null) {
  const words = new Map();
  for (const item of [...(context?.sources || []), ...(context?.library || [])]) {
    if (Number.isInteger(item.words)) words.set(item.id, item.words);
  }
  const titles = new Map();
  for (const item of [...(context?.sources || []), ...(context?.library || [])]) {
    titles.set(item.id, item.title || item.id);
  }

  const movementTrack = trackOf(program, 'movement');
  const movements = (movementTrack?.clips || []).map(clip => {
    const sources = (clip.anchor.sourceIds || []).map(id => ({
      id,
      title: titles.get(id) || id,
      words: words.has(id) ? words.get(id) : null
    }));
    const known = sources.filter(source => source.words !== null);
    return {
      id: clip.id,
      title: clip.data?.title || null,
      sources,
      words: known.length === sources.length
        ? known.reduce((sum, source) => sum + source.words, 0)
        : null
    };
  });

  const lane = (kind, describe) => (trackOf(program, kind)?.clips || []).map(clip => ({
    span: describeSpan(clip.anchor),
    description: describe(clip.cue, context)
  }));

  const pace = (trackOf(program, 'reading')?.clips || []).map(clip => ({
    span: describeSpan(clip.anchor),
    description: describePace(clip.cue)
  }));

  const totalWords = movements.every(movement => movement.words !== null)
    ? movements.reduce((sum, movement) => sum + movement.words, 0)
    : null;

  return {
    title: program?.id || 'Untitled score',
    authority: program?.authority || 'proposed',
    movements,
    pace,
    visuals: lane('visual', describeVisualCue),
    audio: lane('audio', describeAudioCue),
    totals: {
      words: totalWords,
      movements: movements.length,
      clips: (program?.tracks || []).reduce((sum, track) => sum + (track.clips || []).length, 0)
    },
    // Said plainly in the room, because it is the reader's answer rather than
    // an omission: an unscored reading runs at whatever pace they have set.
    unpaced: pace.length === 0
  };
}

/**
 * Minutes are a view of a word count, never a stored value — and with a scored
 * pace the score's own wpm governs where it applies, so the reader's setting
 * only answers for the rest.
 */
export function estimateRundownMinutes(rundown, readerWpm = 320) {
  if (!Number.isInteger(rundown?.totals?.words)) return null;
  const wholeReading = rundown.pace.find(entry => entry.span === 'throughout');
  const scored = wholeReading && /(\d+) words a minute/.exec(wholeReading.description);
  const wpm = scored ? Number(scored[1]) : readerWpm;
  if (!Number.isFinite(wpm) || wpm <= 0) return null;
  return Math.max(1, Math.round(rundown.totals.words / wpm));
}
