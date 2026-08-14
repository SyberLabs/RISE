/**
 * Recitation — emphasis notation and the progressive reveal.
 *
 * Pure functions over text and time. No DOM, no audio, no session
 * state: the Chamber decides WHEN to reveal, this decides WHAT the
 * reveal consists of. Keeping it separable is what lets the reveal be
 * tested without a browser and reused by Page Mode later.
 *
 * See RECITATION-SPEC §1 and §3.
 */

/**
 * Emphasis is AUTHORED, exactly as phrase boundaries are.
 *
 * The Vault's sequences already carry `|` marks placed by a human, and
 * emphasis is the same kind of notation: a claim about the text that
 * only its author can make. Sentiment is not emphasis — a valence model
 * scores "beautiful" high and "15" low, yet a sentence may lean on
 * both — so the runtime never guesses which words matter.
 *
 * The mark is `*word*` or `*several words*`, chosen because it survives
 * the chunker untouched (verified) and reads naturally in a source file.
 */
const EMPHASIS = /\*([^*]+)\*/g;

/** Reveal budget as a share of the atom's duration (measured: 43%). */
export const REVEAL_SHARE = 0.4;

/** Ceiling, so a long atom does not crawl. */
export const REVEAL_MAX_MS = 800;

/**
 * Below this an atom already bypasses the fade path and appears whole.
 * Revealing a phrase that lives 300ms is a strobe, not a reveal.
 */
export const REVEAL_MIN_ATOM_MS = 400;

/**
 * Spoken text should lead comprehension very slightly, not trail speech.
 * Preserve the first measured onset, then compress later onset intervals so
 * the written phrase completes 30% sooner. This especially helps short-word
 * runs whose boundaries merge in waveform analysis.
 */
export const SPOKEN_REVEAL_TIME_SCALE = 0.7;

/**
 * Strip emphasis marks. Used for speech and for any consumer that wants
 * the plain sentence — the marks are notation, never content.
 */
export function stripEmphasis(text) {
    return typeof text === 'string' ? text.replace(EMPHASIS, '$1') : '';
}

/**
 * Chamber atom face scale. Longer phrases step down so the field
 * never overflows; render and the live Chamber must share this.
 */
export function sizeAtomScale(content) {
    const shown = stripEmphasis(content).length;
    let scale = 1;
    if (shown > 20) scale = 56 / 72;
    if (shown > 40) scale = 40 / 72;
    if (shown > 60) scale = 32 / 72;
    return scale;
}

/** Does this text carry any authored emphasis? */
export function hasEmphasis(text) {
    return typeof text === 'string' && EMPHASIS.test(text.replace(EMPHASIS, m => m));
}

/**
 * Split an atom into words, each marked as emphasised or not.
 *
 * Emphasis spans may cover several words (`*Lord Jesus Christ*`), so
 * the marks are resolved BEFORE splitting — otherwise a multi-word span
 * would leave orphaned asterisks on its first and last words.
 *
 * @returns {{text: string, emphasised: boolean}[]}
 */
export function splitWords(content) {
    if (typeof content !== 'string' || !content.trim()) return [];

    const words = [];
    let cursor = 0;
    let match;
    EMPHASIS.lastIndex = 0;

    const pushPlain = (chunk) => {
        for (const w of chunk.split(/\s+/)) {
            if (w) words.push({ text: w, emphasised: false });
        }
    };

    while ((match = EMPHASIS.exec(content)) !== null) {
        pushPlain(content.slice(cursor, match.index));
        for (const w of match[1].split(/\s+/)) {
            if (w) words.push({ text: w, emphasised: true });
        }
        cursor = match.index + match[0].length;
    }
    pushPlain(content.slice(cursor));

    return words;
}

/**
 * How long the reveal should take, and whether to reveal at all.
 *
 * WITHOUT speech the reveal borrows from the atom's duration and never
 * extends it: the temporal contract says `duration` is how long the
 * reader has, and an animation that ate into that would break a promise
 * the whole pacing system rests on.
 *
 * WITH speech the voice is the clock — see revealSchedule().
 *
 * @param {number} durationMs the atom's computed duration
 * @param {{reducedMotion?: boolean}} [opts]
 * @returns {number} reveal duration in ms; 0 means "appear whole"
 */
export function revealBudget(durationMs, { reducedMotion = false } = {}) {
    // Reduced motion disables the reveal entirely. Not "reveal faster":
    // this is animation, and the safety posture is opt-out by default.
    if (reducedMotion) return 0;
    if (!Number.isFinite(durationMs) || durationMs < REVEAL_MIN_ATOM_MS) return 0;
    return Math.min(REVEAL_MAX_MS, Math.round(durationMs * REVEAL_SHARE));
}

/**
 * When each word should appear.
 *
 * Two modes, and the difference is which clock governs:
 *
 *   - no onsets → the words divide the reveal budget evenly. The atom
 *     still lasts exactly `duration`; only the first `budget` ms of it
 *     are spent arriving.
 *   - onsets given → the words anchor to the VOICE. kokoro-js exposes no
 *     per-word timestamps, but its raw samples do expose the silences
 *     between words (see speechOnsets). The first real onset is preserved;
 *     later intervals are compressed slightly so text leads rather than
 *     trails comprehension.
 *
 * A mismatch between onset count and word count is expected and
 * tolerated: silence detection is a heuristic, and a phrase with an
 * internal pause or an elided word will not line up. Extra onsets are
 * ignored; missing ones fall back to even spacing for the remainder,
 * so the reveal degrades into the no-speech behaviour rather than
 * stalling or bunching.
 *
 * @param {number} wordCount
 * @param {number} budgetMs
 * @param {number[]} [onsetsMs] speech onsets, ascending, from t=0
 * @returns {number[]} ms offset at which each word appears
 */
export function revealSchedule(wordCount, budgetMs, onsetsMs = null) {
    if (wordCount <= 0) return [];
    if (budgetMs <= 0 && !onsetsMs?.length) return new Array(wordCount).fill(0);

    if (onsetsMs?.length) {
        const detectedCount = Math.min(wordCount, onsetsMs.length);
        const out = onsetsMs.slice(0, detectedCount)
            .map(at => Math.max(0, Number(at) || 0));

        if (out.length < wordCount) {
            // Short words often join into one continuous energy burst, so the
            // waveform may expose fewer gaps than the sentence has words.
            // Spread the unmatched tail across the remaining AUDIO duration;
            // extrapolating from sparse gaps can otherwise run past the WAV.
            const missing = wordCount - out.length;
            const last = out[out.length - 1] || 0;
            const detectedPace = out.length > 1
                ? (last - out[0]) / (out.length - 1)
                : 120;
            const finish = Number.isFinite(budgetMs) && budgetMs > last
                ? budgetMs
                : last + (Math.max(1, detectedPace) * missing);
            const pace = (finish - last) / missing;
            for (let i = 1; i <= missing; i++) {
                out.push(last + (pace * i));
            }
        }
        const anchor = out[0] || 0;
        return out.map(at => Math.round(
            anchor + ((at - anchor) * SPOKEN_REVEAL_TIME_SCALE)
        ));
    }

    // Even division. The LAST word lands at the end of the budget, not
    // past it, so the phrase is whole for the remainder of the atom.
    const step = wordCount > 1 ? budgetMs / (wordCount - 1) : 0;
    return Array.from({ length: wordCount }, (_, i) => Math.round(i * step));
}

/**
 * Find where words begin in generated speech.
 *
 * kokoro-js returns raw Float32Array samples and no timestamps, but the
 * silences between words are real signal. RMS over short windows finds
 * them: a run below the floor is a gap, and the sample where energy
 * returns is the next word's onset.
 *
 * This is a heuristic and is treated as one — revealSchedule tolerates
 * a count that disagrees with the word count.
 *
 * @param {Float32Array} samples
 * @param {number} sampleRate
 * @param {{windowMs?: number, floorRatio?: number}} [opts]
 * @returns {number[]} onsets in ms, ascending, starting with 0
 */
export function speechOnsets(samples, sampleRate, { windowMs = 20, floorRatio = 0.06 } = {}) {
    if (!samples?.length || !sampleRate) return [];

    const win = Math.max(1, Math.floor(sampleRate * (windowMs / 1000)));
    const energy = [];
    for (let i = 0; i + win <= samples.length; i += win) {
        let sum = 0;
        for (let j = i; j < i + win; j++) sum += samples[j] * samples[j];
        energy.push(Math.sqrt(sum / win));
    }
    if (!energy.length) return [];

    const floor = Math.max(...energy) * floorRatio;
    const onsets = [];
    // Begin INSIDE a gap so the first burst of energy registers as an
    // onset. Seeding with 0 instead made the first word appear at the
    // very start of the clip — but Kokoro opens with roughly 300ms of
    // silence, so the word arrived a third of a second before it was
    // spoken, and every later word inherited the offset.
    let inGap = true;
    energy.forEach((e, i) => {
        if (e < floor) {
            inGap = true;
        } else if (inGap) {
            inGap = false;
            onsets.push(Math.round((i * win / sampleRate) * 1000));
        }
    });
    return onsets;
}
