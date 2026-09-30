/**
 * RISE Pacing Engine
 * Computes atom durations based on type, complexity, weight, and state curves
 */

import { READING_PACE } from './reading-limits.js';

/**
 * Modality types for atoms
 */
export const Modality = {
    TEXT: 'text',
    IMAGE: 'image',
    SYMBOL: 'symbol',
    AUDIO: 'audio',
    COMPOSITE: 'composite'
};

/**
 * Every pace profile a reading may choose. The one list: the compiler, the
 * settings a reader keeps, and the rooms that offer a choice all read it, so a
 * profile added here is offered everywhere or named nowhere.
 */
export const PACE_CURVE_IDS = Object.freeze([
    'flat', 'induction', 'ascent', 'wave', 'climax', 'breath'
]);

/**
 * BREATH is a rhythm, not a curve of the reading's length, so it is not a
 * StateCurve: how much an atom may swell depends on how close it already is to
 * the shortest an atom can be, and a curve sees only position.
 *
 * It swells and eases about every ten seconds. The reading makes a whole number
 * of cycles, and the phase is read off the authored clock, so the swell and the
 * ease cancel and the reading is as long as it was. Where an atom has no room
 * to swell, because it is at the floor or the ceiling, it does not; a reading
 * too fast to swell is left exactly as it was. Nothing here measures the reader
 * or claims anything about them: it is only how long each phrase is held.
 */
export const BREATH = Object.freeze({ periodMs: 10_000, depth: 0.15 });

/** Whole cycles a reading of this authored length makes. */
export function breathCycles(totalMs) {
    const ms = Number(totalMs);
    return Number.isFinite(ms) && ms > 0 ? Math.max(1, Math.round(ms / BREATH.periodMs)) : 1;
}

/** How far an atom of this length may swell or ease without leaving [min, max]. */
export function breathDepth(durationMs, { min = 100, max = 10_000 } = {}) {
    const d = Number(durationMs);
    if (!(d > 0)) return 0;
    return Math.max(0, Math.min(BREATH.depth, 1 - min / d, max / d - 1));
}

/** The factor on an atom's authored length at `position` (0 to 1) of the reading. */
export function breathMultiplier(position, { cycles, depth }) {
    return 1 + depth * Math.sin(2 * Math.PI * cycles * position);
}

/**
 * State curve presets for pacing variation
 */
export class StateCurve {
    constructor(curveFunction) {
        this.curveFunction = curveFunction;
    }

    /**
     * Get multiplier at position
     * @param {number} position - 0.0 to 1.0 progress through session
     * @returns {number} Duration multiplier
     */
    at(position) {
        return this.curveFunction(Math.max(0, Math.min(1, position)));
    }

    /**
     * Induction curve: fast → slow (descending)
     * Induces settling, receptivity
     */
    static induction() {
        // Start at 0.8x (slightly fast), end at 2.0x (very slow)
        return new StateCurve(p => 0.8 + p * 1.2);
    }

    /**
     * Ascent curve: slow → fast (ascending)
     * Builds energy, momentum
     */
    static ascent() {
        // Start at 1.8x (very slow), end at 0.5x (very fast)
        return new StateCurve(p => 1.8 - p * 1.3);
    }

    /**
     * Wave curve: oscillating rhythm
     * Maintains engagement through variation
     * @param {number} frequency - Number of cycles (default 3)
     */
    static wave(frequency = 3.0) {
        // Base 1.0, swing from 0.4 to 1.6
        return new StateCurve(p => 1.0 + 0.6 * Math.sin(p * frequency * 2 * Math.PI));
    }

    /**
     * Climax curve: narrative arc
     * Build to peak, then resolve
     * @param {number} peakPosition - Where the peak occurs (default 0.75)
     */
    static climax(peakPosition = 0.75) {
        return new StateCurve(p => {
            if (p < peakPosition) {
                // Accelerate towards peak: from 1.5x down to 0.4x speed
                return 1.5 - 1.1 * (p / peakPosition);
            } else {
                // Decelerate after peak: from 0.4x back up to 1.5x speed
                return 0.4 + 1.1 * ((p - peakPosition) / (1 - peakPosition));
            }
        });
    }

    /**
     * Flat curve: constant pacing
     */
    static flat() {
        return new StateCurve(() => 1.0);
    }
}

/**
 * Pacing Engine
 * Computes atom durations based on multiple factors
 */
export class PacingEngine {
    constructor(config = {}) {
        this.baseWpm = this.normalizeWpm(config.baseWpm);
        this.stateCurve = config.stateCurve || StateCurve.flat();

        // Modifier toggles.
        // TEMPORAL CONTRACT: Atom.duration as authored by the chunker
        // IS the reading contract. Semantic texture is opt-in and
        // zero-mean — it varies pace around the authored duration with
        // no net WPM drift (the old always-on complexity/weight
        // defaults compounded to a universal 1.4375× slowdown).
        this.modifiers = {
            semanticTexture: config.semanticTexture === true,
            position: config.usePosition !== false
        };
        // Off unless a reading chose the breath profile (see setBreath).
        this.breath = null;

        // Duration limits
        this.minDuration = config.minDuration || 100;   // ms
        this.maxDuration = config.maxDuration || 10000; // ms

        // Image defaults
        this.imageDurations = {
            flash: 100,      // Subliminal
            glimpse: 500,    // Recognition
            view: 2000,      // Contemplation
            hold: 5000       // Absorption
        };

        // Symbol defaults
        this.symbolDuration = config.symbolDuration || 400;
    }

    /**
     * Compute duration for an atom
     * @param {Object} atom - The atom to pace
     * @param {number} position - Session progress 0.0 → 1.0
     * @returns {number} Duration in milliseconds
     */
    computeDuration(atom, position = 0.5) {
        const authoredDuration = Number(atom?.duration);
        if (atom?.timingLocked && Number.isFinite(authoredDuration)) {
            // Structural pauses and authored markers are contracts, not hints.
            // Keep very short intentional markers (for example [FLASH]=50ms)
            // while still rejecting zero/negative and runaway values.
            return Math.round(Math.max(16, Math.min(this.maxDuration, authoredDuration)));
        }

        let baseDuration;

        // Base duration from modality
        switch (atom.modality) {
            case Modality.TEXT:
                if (Number.isFinite(authoredDuration) && authoredDuration > 0) {
                    // chunkText already accounts for WPM, word length,
                    // punctuation, phrase size, and paragraph breathing.
                    baseDuration = authoredDuration;
                } else {
                    const wordCount = (atom.content || '').split(/\s+/).filter(w => w).length || 1;
                    baseDuration = (wordCount / this.baseWpm) * 60 * 1000;
                }
                break;

            case Modality.IMAGE:
                baseDuration = atom.duration || this.imageDurations.view;
                break;

            case Modality.SYMBOL:
                baseDuration = atom.duration || this.symbolDuration;
                break;

            case Modality.AUDIO:
                baseDuration = atom.duration || 1000;
                break;

            default:
                baseDuration = atom.duration || 500;
        }

        let duration = baseDuration;

        // Semantic texture: zero-mean around the authored duration.
        // Neutral atoms (0.5/0.5 defaults) map to exactly 1.0; the
        // full range is bounded to [0.8, 1.2].
        if (this.modifiers.semanticTexture) {
            const complexity = Number.isFinite(atom.complexity) ? atom.complexity : 0.5;
            const weight = Number.isFinite(atom.weight) ? atom.weight : 0.5;
            duration *= 1 + (complexity - 0.5) * 0.24 + (weight - 0.5) * 0.16;
        }

        if (this.modifiers.position) {
            const curveMultiplier = this.stateCurve.at(position);
            duration *= curveMultiplier;
        }

        // Words only: an image or a sign is held as long as it was authored.
        if (this.breath && atom.modality === Modality.TEXT) {
            duration *= breathMultiplier(position, {
                cycles: this.breath.cycles,
                depth: breathDepth(duration, { min: this.minDuration, max: this.maxDuration })
            });
        }

        // Clamp to limits
        return Math.round(Math.max(this.minDuration, Math.min(this.maxDuration, duration)));
    }

    /**
     * Set the state curve
     * @param {StateCurve} curve 
     */
    setStateCurve(curve) {
        this.stateCurve = curve;
    }

    /**
     * Give the reading a breath. `totalMs` is its authored length, from which
     * the whole number of cycles follows.
     * @param {{ totalMs: number }} options
     */
    setBreath({ totalMs }) {
        this.breath = { cycles: breathCycles(totalMs) };
    }

    /**
     * Set base WPM
     * @param {number} wpm
     */
    setWpm(wpm) {
        this.baseWpm = this.normalizeWpm(wpm);
    }

    normalizeWpm(wpm) {
        const value = Number(wpm);
        return Number.isFinite(value)
            ? Math.max(READING_PACE.min, Math.min(READING_PACE.max, value))
            : 320;
    }

    /**
     * Apply pacing to a list of atoms.
     *
     * Curve position advances with cumulative AUTHORED time, not atom
     * count: a curve's climax must land at the reading's temporal
     * midpoint regardless of chunk mode, marker density, or how
     * unevenly durations are distributed. Each atom is evaluated at
     * its temporal midpoint.
     * @param {Array} atoms
     * @returns {Array} Atoms with computed durations
     */
    paceAtoms(atoms) {
        const total = atoms.length;
        let totalMs = 0;
        for (const atom of atoms) {
            const duration = Number(atom?.duration);
            if (Number.isFinite(duration) && duration > 0) totalMs += duration;
        }
        let cursorMs = 0;
        return atoms.map((atom, index) => {
            const duration = Number(atom?.duration);
            const authoredMs = Number.isFinite(duration) && duration > 0 ? duration : 0;
            // Atoms without authored durations (legacy direct callers)
            // fall back to index spacing
            const position = totalMs > 0
                ? (cursorMs + authoredMs / 2) / totalMs
                : (total > 1 ? index / (total - 1) : 0.5);
            cursorMs += authoredMs;
            return {
                ...atom,
                duration: this.computeDuration(atom, position)
            };
        });
    }
}
