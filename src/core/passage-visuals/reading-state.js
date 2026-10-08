/**
 * Per-reading visual direction state.
 *
 * Held in a WeakMap keyed by the session object, so it survives the
 * Chamber's destroy/recreate cycle (Page and Stream, Lab and back) and is
 * never serialized with the session. Nothing here performs network work.
 */

import { jevColors } from '../jev-palette.js';
import { sessionColorTheme } from '../session-presentation.js';
import { themedFlameLookup } from '../theme-engine-map.js';
import { isContinuousPresentation } from '../visual-presence.js';
import { flamePreset } from '../../visuals/living-flame/flame-presets.js';
import { PassageDirector } from './director.js';

/**
 * The Gallery shelf the Gallery look seeds when the reader has
 * chosen nothing. An empty or default shelf is permission for procedural
 * visuals, not a choice of a particular one.
 */
const DEFAULT_SHELVES = new Set(['', 'turrell']);

const states = new WeakMap();

const MUSEUM_SOURCE = /^(?:aic|sci)-/u;

/**
 * What Follow text draws (R6): museum works for the Gallery look's Turrell
 * shelf or a shelf of museum and science collections, flames otherwise.
 */
function followFamily(visual = {}) {
  if (visual.visualMode !== 'interlocution') return 'flame';
  const procedural = (visual.interlocution?.procedural || []).filter(Boolean);
  const sourced = (visual.interlocution?.sourced || []).filter(Boolean);
  const museum = sourced.length > 0 && sourced.every(id => MUSEUM_SOURCE.test(id));
  if (procedural.length === 1 && procedural[0] === 'turrell' && (!sourced.length || museum)) return 'gallery';
  return procedural.length === 0 && museum ? 'gallery' : 'flame';
}

/**
 * Whether Follow text can run in this reading, whether it should be the
 * default, and what it draws. Authored programs and explicit visual choices
 * are preserved.
 */
export function directionEligibility(session) {
  return { ...eligibility(session), family: followFamily(session?.visualConfig) };
}

function eligibility(session) {
  if (!session || !(session.sourceTexts instanceof Map)) {
    return { canFollow: false, defaultMode: 'hold', reason: 'no-source-text' };
  }
  const visual = session.visualConfig || {};
  if (visual.visualMode === 'off' || !visual.visualMode) {
    return { canFollow: false, defaultMode: 'off', reason: 'visuals-off' };
  }
  if (session.visualProgram?.segments?.length || session.experienceProgram) {
    // A reading saved from its own direction keeps its saved passages and
    // lets the passages it never assigned keep following the text locally.
    if (visual.passageDirection === 'local' && session.visualProgram?.coordinateSpace === 'source') {
      return { canFollow: true, defaultMode: 'follow', reason: 'saved-with-local', composite: true };
    }
    return { canFollow: false, defaultMode: 'hold', reason: 'authored-program' };
  }
  // Living Flame holds one composition until Follow text moves it by passage.
  if (visual.visualMode === 'living-flame') return { canFollow: true, defaultMode: 'follow', reason: 'living-flame' };
  const interlocution = visual.interlocution || {};
  const gallery = visual.visualMode === 'interlocution' && isContinuousPresentation(interlocution.presentation);
  if (!gallery) return { canFollow: false, defaultMode: 'hold', reason: 'no-gallery' };
  const sourced = Array.isArray(interlocution.sourced) ? interlocution.sourced.filter(Boolean) : [];
  const procedural = Array.isArray(interlocution.procedural) ? interlocution.procedural.filter(Boolean) : [];
  if (sourced.length) return { canFollow: true, defaultMode: 'hold', reason: 'chosen-imagery' };
  if (['jev', 'jev-sample'].includes(session.origin?.experience)) {
    return { canFollow: true, defaultMode: 'hold', reason: 'requested-visual' };
  }
  const shelf = procedural.join('|');
  return DEFAULT_SHELVES.has(shelf)
    ? { canFollow: true, defaultMode: 'follow', reason: 'eligible' }
    : { canFollow: true, defaultMode: 'hold', reason: 'chosen-engine' };
}

/** The reading's direction state, created once with its default mode. */
export function directionStateFor(session) {
  if (!session || typeof session !== 'object') return null;
  let state = states.get(session);
  if (!state) {
    const eligibility = directionEligibility(session);
    state = {
      eligibility,
      mode: eligibility.defaultMode,
      history: [],
      director: null,
      directorError: null,
      heldCue: null,
      energy: 0.35
    };
    states.set(session, state);
  }
  return state;
}

/**
 * The program Follow text schedules: the director's per-block segments, or
 * for a saved reading, its saved passages first and local blocks after, so
 * a saved span always wins where it exists.
 */
export function followProgram(session, director, eligibility) {
  if (!eligibility?.composite) return director.program;
  const saved = (session.visualProgram?.segments || []).filter(segment =>
    segment.match?.fromCharacter !== undefined || segment.match?.fromToken !== undefined
      || segment.match?.fromProgress !== undefined);
  return {
    coordinateSpace: 'source',
    segments: [...saved, ...director.program.segments],
    fallback: director.program.fallback
  };
}

/** Build (once) the passage director for a reading, or record why not. */
export function ensureDirector(session, state = directionStateFor(session)) {
  if (!state || state.director || state.directorError) return state?.director || null;
  try {
    const sources = (session.sources || [])
      .map(source => ({
        id: source.id,
        text: session.sourceTexts.get(source.id),
        chunkProfile: source.chunkProfile ?? null
      }))
      .filter(source => typeof source.text === 'string');
    // The theme is lowered where the cue is built, so a saved cue draws as saved. A reading with no theme
    // takes classic's, the Gallery look's, so its passages keep one colour too (R6).
    const flameRecipe = themedFlameLookup(flamePreset, sessionColorTheme(session) || jevColors('classic'));
    const director = new PassageDirector({
      sources, atoms: session.atoms || [], flameRecipe, family: state.eligibility?.family || 'flame'
    });
    if (!director.ready) throw new Error('No directable source text');
    state.director = director;
  } catch (error) {
    // Alignment failure or empty text: the reading continues with its own
    // visuals. Direction never prevents reading.
    state.directorError = error?.code || error?.message || 'direction-unavailable';
  }
  return state.director;
}

/**
 * Which sources may be sent to Jev: every one of a verified catalog reading,
 * otherwise exactly those whose digests the reader consented to. Consent is
 * for the whole reading as shown, so a multi-source reading covers each source.
 */
export function permittedSourceDigests({ digests = [], catalogVerified = false, consent = null } = {}) {
  if (catalogVerified) return [...digests];
  const granted = new Set(Array.isArray(consent?.sourceDigests) ? consent.sourceDigests : []);
  return digests.filter(digest => granted.has(digest));
}
