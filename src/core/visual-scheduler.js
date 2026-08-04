/**
 * Generic visual scheduler (PERICOPE-IMAGERY-SPEC §6).
 *
 * The middle layer of the three: it FOLLOWS a compiled visual program
 * by reading atom coordinates and emitting cues. It is entirely
 * domain-agnostic — it understands that atoms may carry coordinates
 * and that segments match ranges, but it does not know what a
 * pericope, a Gospel, or a verse *means*. A content domain compiles
 * the program (above it); a cortex renders the cues (below it).
 *
 * The law: content domains author schedules; the runtime follows
 * them; the cortex renders cues.
 */

/**
 * Match an atom to its segment cue, or the program's fallback.
 * The coordinateSpace names which atom fields carry the coordinate;
 * 'scripture' reads {chapter, verse}. An atom missing its coordinate
 * (structural silence, a non-scripture atom) yields the fallback.
 *
 * @param {Object} program - { coordinateSpace, segments, fallback }
 * @param {Object} atom
 * @returns {{ id: string, cue: Object }}
 */
export function cueForAtom(program, atom) {
    const FALLBACK_ID = '__fallback__';
    if (!program || program.enabled === false) {
        return { id: FALLBACK_ID, cue: program?.fallback ?? { kind: 'still' } };
    }
    const coord = readCoordinate(program.coordinateSpace, atom);
    if (coord && program.coordinateSpace === 'scripture') {
        // Linear scan — segments are few (a chapter's pericopes) and
        // disjoint, so the first containing segment is the only one.
        for (const seg of program.segments) {
            if (seg.match.chapter === coord.chapter
                && coord.verse >= seg.match.verseStart
                && coord.verse <= seg.match.verseEnd) {
                return { id: seg.id, cue: seg.cue };
            }
        }
    }
    if (coord && program.coordinateSpace === 'source') {
        // A Journey's coordinate is the sourceId an atom already
        // carries (JOURNEYS-SPEC §7.2), so a movement needs no new
        // atom field. A paragraph break inside a movement carries that
        // movement's sourceId and therefore HOLDS its cue; an authored
        // boundary carries a synthetic one and therefore changes it.
        // NARROW SEGMENTS FIRST. A movement's whole-passage cue and its
        // figures both name the same sourceId, so a linear scan that
        // took the first match would hand every atom the broad cue and
        // no figure would ever be reached. Ranged segments are tried
        // before unranged ones, and the passage-wide cue becomes what it
        // should be: what holds wherever nothing finer was authored.
        let broad = null;
        for (const seg of program.segments) {
            if (!seg.match?.sourceIds?.includes(coord.sourceId)) continue;
            const ranged = seg.match.fromProgress !== undefined
                || seg.match.fromCharacter !== undefined
                || seg.match.fromToken !== undefined;
            if (!ranged) {
                broad = broad || seg;
                continue;
            }
            if (matchesSourceRange(seg.match, atom, coord.progress)) {
                return { id: seg.id, cue: seg.cue };
            }
        }
        if (broad) return { id: broad.id, cue: broad.cue };
    }
    return { id: FALLBACK_ID, cue: program.fallback };
}

function halfOpenAtomOverlap(atomFrom, atomTo, rangeFrom, rangeTo) {
    if (!Number.isInteger(atomFrom) || !Number.isInteger(atomTo)) return false;
    // Structural pause atoms are zero-width points. They hold a cue only
    // when the authored span actually crosses their source position.
    return atomFrom === atomTo
        ? atomFrom >= rangeFrom && atomFrom < rangeTo
        : atomTo > rangeFrom && atomFrom < rangeTo;
}

function matchesSourceRange(match, atom, progress) {
    if (match.fromCharacter !== undefined) {
        return halfOpenAtomOverlap(
            atom?.sourceCharacterStart,
            atom?.sourceCharacterEnd,
            match.fromCharacter,
            match.toCharacter
        );
    }
    if (match.fromToken !== undefined) {
        return halfOpenAtomOverlap(
            atom?.sourceTokenStart,
            atom?.sourceTokenEnd,
            match.fromToken,
            match.toToken
        );
    }
    // Progress remains half-open so adjacent Journey figures cannot both
    // claim the point where they meet.
    return progress >= match.fromProgress && progress < match.toProgress;
}

function readCoordinate(space, atom) {
    if (space === 'scripture') {
        if (Number.isInteger(atom?.chapter) && Number.isInteger(atom?.verse)) {
            return { chapter: atom.chapter, verse: atom.verse };
        }
    }
    if (space === 'source') {
        const sourceId = atom?.sourceId;
        if (typeof sourceId === 'string' && sourceId) {
            const progress = Number(atom?.sourceProgress);
            return {
                sourceId,
                progress: Number.isFinite(progress) ? progress : 0
            };
        }
    }
    return null;
}

/**
 * A stateful driver over one program. Feed it atoms; it invokes
 * `onCue(cue, { cueId, generation })` ONLY when the cue changes,
 * advancing a generation token each time. The consumer (the Chamber)
 * wires onCue to the cortex. The generation is the SOL-review
 * principle: a resolved pool must verify its generation is still
 * current before it publishes — the moment that requested it must
 * still exist.
 */
export class VisualScheduleController {
    constructor(program, onCue) {
        this.program = program || null;
        this.onCue = typeof onCue === 'function' ? onCue : () => {};
        this._activeCueId = null;
        this._generation = 0;
    }

    /** True when there is a program that is enabled. */
    get active() {
        return !!this.program && this.program.enabled !== false;
    }

    /**
     * Observe one atom. Emits a cue only on change (one activation
     * per segment). Returns the resolved { id, cue } for inspection,
     * or null when the atom is coordinate-less structural silence.
     *
     * STRUCTURAL SILENCE HOLDS THE CUE: a paragraph break between two
     * verses carries no coordinate. It is NOT a passage change — it is
     * the pause between verses of the same reading. Emitting the
     * fallback for it would thrash the cue (episode → fallback →
     * episode) every other atom. So a coordinate-less atom leaves the
     * active cue exactly as it was; only a real coordinate moves it.
     * The genuine unmapped stretches (whole verses in no segment) DO
     * carry coordinates and correctly resolve to the fallback.
     */
    observe(atom) {
        if (!this.program) return null;
        // Structural silence holds the cue in EITHER space. In source
        // space an atom with no sourceId is the same kind of event a
        // coordinate-less verse is: a pause inside the reading, not a
        // change of reading.
        const coordinated = readCoordinate(this.program.coordinateSpace, atom) !== null;
        if (!coordinated) return null; // hold: structural silence

        const { id, cue } = cueForAtom(this.program, atom);
        if (id !== this._activeCueId) {
            this._activeCueId = id;
            this._generation += 1;
            // Look-ahead: the NEXT sourced segment's collections, so a
            // short upcoming episode (a single-verse flagellation) has
            // its provider pool warm before the reader arrives
            // (PERICOPE-IMAGERY-SPEC §6.3).
            const prefetch = this._upcomingSourcedCollections(atom);
            this.onCue(cue, { cueId: id, generation: this._generation, prefetch });
        }
        return { id, cue };
    }

    /**
     * The collections of the next one or two SOURCED segments after
     * the current atom's position — the pools worth warming ahead.
     * Coordinate-space only; empty otherwise.
     */
    _upcomingSourcedCollections(atom) {
        if (this.program.coordinateSpace === 'source') {
            // Ordered segments, not chapter/verse (§8.2). Warm the pools
            // of the next sourced segments so a movement's imagery is
            // ready before its first word rather than after it.
            const here = this.program.segments.findIndex(
                seg => seg.match?.sourceIds?.includes(atom?.sourceId));
            const out = [];
            for (const seg of this.program.segments.slice(here + 1)) {
                if (seg.cue?.kind === 'sourced' && Array.isArray(seg.cue.collections)) {
                    out.push(...seg.cue.collections);
                    if (out.length >= 2) break;
                }
            }
            return out;
        }
        if (this.program.coordinateSpace !== 'scripture') return [];
        if (!Number.isInteger(atom?.chapter) || !Number.isInteger(atom?.verse)) return [];
        const out = [];
        for (const seg of this.program.segments) {
            if (seg.match.chapter < atom.chapter) continue;
            // The active segment is already being armed by applyCue; only
            // warm segments whose start is genuinely ahead of this atom.
            if (seg.match.chapter === atom.chapter
                && seg.match.verseStart <= atom.verse) continue;
            if (seg.cue?.kind === 'sourced' && Array.isArray(seg.cue.collections)) {
                out.push(...seg.cue.collections);
                if (out.length >= 2) break; // two ahead is plenty
            }
        }
        return out;
    }

    get generation() {
        return this._generation;
    }

    get activeCueId() {
        return this._activeCueId;
    }

    /** Reset so the next atom re-emits (e.g. on session restart). */
    reset() {
        this._activeCueId = null;
    }
}
