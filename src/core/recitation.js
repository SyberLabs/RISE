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
 *
 * A CONSTANT LEAD, NOT A PROPORTIONAL ONE. This used to scale every
 * interval by 0.7, which does not hold the text slightly ahead of the
 * voice — it accelerates away from it, because the error compounds with
 * every word. By the end of a long phrase the reveal had finished while
 * the voice was still in the middle of it. That scaling was introduced to
 * paper over waveform boundaries that merge, and the detector below now
 * handles those directly, so the workaround can go.
 */
export const SPOKEN_REVEAL_LEAD_MS = 90;

/**
 * A stop consonant is silence — /t/, /k/ and /p/ all close the vocal
 * tract — so a dip in energy is not by itself a word boundary. Measured
 * on speech-shaped audio: stops run 20-50ms and word gaps 70ms and up.
 * 55 sits between them with room for the 20ms analysis window to
 * quantize either way — at 70 a real 70ms gap rounds to three windows
 * against a four-window threshold and the boundary is lost.
 */
export const ONSET_MIN_GAP_MS = 55;

/**
 * How much of a clip is the silence Kokoro leaves after the last word.
 * Measured over the 321 pack clips whose onset count reaches their word
 * count, so the final onset can be trusted: median 7% of the spoken span.
 */
export const TRAILING_SILENCE_SHARE = 0.07;

/** Two onsets closer together than this were one word, not two. */
export const ONSET_MIN_SPACING_MS = 110;

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
 *     between words (see speechOnsets). The first onset is preserved so
 *     nothing appears before the voice; every word after it is a constant
 *     step ahead of where it is spoken.
 *
 * A mismatch between onset count and word count is not an edge case — it
 * is the common case, 60% of the shipped voice pack — so the onsets are
 * not the schedule. They CORRECT one: words are laid out in proportion to
 * their length between the first onset and the last, and each is then
 * moved onto a real boundary if one is close enough to be its own.
 *
 * @param {string[]|number} words the words themselves, so their lengths
 *   can carry the rhythm — or merely how many, when they are not to hand
 * @param {number} budgetMs
 * @param {number[]} [onsetsMs] speech onsets, ascending, from t=0
 * @returns {number[]} ms offset at which each word appears
 */
export function revealSchedule(words, budgetMs, onsetsMs = null) {
    const weights = wordWeights(words);
    const wordCount = weights.length;
    if (wordCount <= 0) return [];
    if (budgetMs <= 0 && !onsetsMs?.length) return new Array(wordCount).fill(0);

    if (onsetsMs?.length) {
        const onsets = [...new Set(onsetsMs
            .map(at => Math.max(0, Number(at) || 0))
            .filter(Number.isFinite))].sort((a, b) => a - b);
        // WHEN THE VOICE HAS ALREADY SAID WHERE EVERY WORD IS, DO NOT
        // GUESS AT IT.
        //
        // One boundary per word is the detector reporting that it found
        // the whole phrase, and there is then nothing left to model: word
        // i begins at onset i. This used to predict a rhythm from letter
        // counts anyway and only then snap that prediction onto the
        // boundaries - and a prediction that had drifted further than its
        // own tolerance could not snap back. Measured on a ten-word
        // phrase with ten onsets: the fifth word was spoken at 1920ms and
        // revealed at 2610ms, 690ms behind the voice, and two pairs of
        // words landed on the same instant because monotonicity clamped
        // the later of each pair onto the earlier.
        //
        // More onsets than words means the detector split something;
        // fewer means it merged something. Both still need the model.
        let out;
        if (onsets.length === wordCount) {
            out = onsets.slice();
        } else {
            const predicted = predictOnsets(weights, onsets, budgetMs);
            // Within a word's own predicted length: a boundary further
            // off than that belongs to some other word.
            const reach = Math.max(
                60, (predicted[wordCount - 1] - predicted[0]) / wordCount);
            out = spaceReveals(snapToOnsets(predicted, onsets, reach), budgetMs);
        }

        // The first word waits for the real voice; every later one is the
        // same step ahead of its own onset, so THE LEAD IS TAKEN OUT OF
        // THE FIRST INTERVAL AND NO OTHER. Every interval after it is the
        // voice's own, unaltered, which is the whole point — the rhythm a
        // reader sees should be the rhythm they hear.
        //
        // A voice whose first interval is shorter than the lead cannot
        // give the whole of it. Take half of what there is rather than
        // clamping, which folded the first two words onto the same
        // instant.
        const anchor = Math.round(out[0] || 0);
        const firstInterval = out.length > 1 ? out[1] - out[0] : 0;
        const lead = Math.min(SPOKEN_REVEAL_LEAD_MS, Math.max(0, firstInterval / 2));
        return out.map((at, i) => (i === 0 ? anchor : Math.round(at - lead)));
    }

    // Even division. The LAST word lands at the end of the budget, not
    // past it, so the phrase is whole for the remainder of the atom.
    const step = wordCount > 1 ? budgetMs / (wordCount - 1) : 0;
    return Array.from({ length: wordCount }, (_, i) => Math.round(i * step));
}

/**
 * NO TWO WORDS MAY ARRIVE AT THE SAME INSTANT.
 *
 * snapToOnsets keeps time from running backwards by clamping a word onto
 * the one before it, which leaves the two sharing a timestamp - and two
 * words appearing together reads as a stutter rather than as speech. A
 * clamped word steps forward instead, by the smallest interval a reader
 * sees as separate, and never past the end of the clip it belongs to.
 */
function spaceReveals(times, budgetMs) {
    const ceiling = Math.max(0, Number(budgetMs) || 0);
    const out = [];
    let floor = -Infinity;
    for (const at of times) {
        // WHOLE MILLISECONDS, BECAUSE THAT IS WHAT THE READER GETS. The
        // schedule is rounded on its way out, so two times that differ by
        // less than a millisecond are one time as far as the reveal is
        // concerned. Comparing the unrounded values let a pair 5e-13
        // apart - the ordinary residue of dividing a span by a weight -
        // pass a guard whose whole purpose was to keep them apart, and
        // the rounding then put them back on the same instant.
        let placed = Math.round(at);
        if (placed <= floor) placed = floor + ONSET_MIN_SPACING_MS;
        if (ceiling > 0 && placed > ceiling) placed = Math.max(floor, ceiling);
        out.push(placed);
        floor = placed;
    }
    return out;
}

/**
 * How long a word takes to say, relative to its neighbours.
 *
 * Letters, not syllables. Syllable counting in English needs a
 * dictionary to be worth anything, and the error it saves is smaller
 * than the error already in the onsets — whereas "colonies" being four
 * times "of" is right, and is most of what a rhythm is made of.
 */
function wordWeights(words) {
    if (Array.isArray(words)) {
        return words.map(word => Math.max(
            1,
            String(word ?? '').replace(/[^\p{L}\p{N}]/gu, '').length
        ));
    }
    return new Array(Math.max(0, Number(words) || 0)).fill(1);
}

/** Running total of the weight BEFORE each word. */
function leadingWeights(weights) {
    const out = [];
    let sum = 0;
    for (const weight of weights) {
        out.push(sum);
        sum += weight;
    }
    return out;
}

/**
 * Where each word is spoken, from the boundaries the waveform gave up.
 *
 * DETECTION COMES UP SHORT MORE OFTEN THAN NOT. Measured across all 877
 * clips in the shipped voice pack, 60% have fewer onsets than the phrase
 * has words: short function words run into their neighbours and leave no
 * gap to find. So the schedule cannot simply be the onsets — it has to be
 * a model of the phrase that the onsets correct.
 *
 * The model is that a word occupies time in proportion to its length. Two
 * anchors fix it to the voice: the first onset is where speech begins,
 * and the last onset is where the LAST WORD begins — so the detected span
 * covers every word but the final one, and that is what sets the rate.
 * The final word then lands on its own onset instead of at the end of the
 * clip, which is where it used to land and why the ends of sentences were
 * hard to catch: the tail was stretched to `budgetMs`, and for a spoken
 * atom `budgetMs` is the whole recording, trailing silence included.
 */
function predictOnsets(weights, onsets, budgetMs) {
    const first = onsets[0];
    const last = onsets[onsets.length - 1];
    const leading = leadingWeights(weights);
    const total = leading[leading.length - 1] + weights[weights.length - 1];
    const beforeLast = total - weights[weights.length - 1];

    const span = Math.max(0, Math.max(0, Number(budgetMs) || 0) - first);
    // The voice's own pace, from the first onset to the final word.
    const voiceRate = (last > first && beforeLast > 0) ? (last - first) / beforeLast : 0;
    // What the recording implies on its own: the words fill it but for
    // the silence Kokoro leaves at the end, measured across the 321 clips
    // in the pack whose detection is complete enough to trust — a median
    // of 7% of the spoken span.
    const clipRate = (span > 0 && total > 0) ? (span * (1 - TRAILING_SILENCE_SHARE)) / total : 0;

    // Trust the voice when detection found at least as many boundaries as
    // there are words — the last one is then almost certainly the last
    // word, and the schedule is the voice's own rhythm exactly.
    //
    // Otherwise trust it only as far as it is plausible: if the phrase
    // would be finished long before the recording is, the last onset was
    // NOT the last word and the assumption has compressed the phrase. Two
    // onsets for six words is the case that shows it — taken at face
    // value it put all six inside the opening third of the clip.
    const complete = onsets.length >= weights.length;
    const rate = (voiceRate > 0 && (complete || voiceRate * total >= span * 0.7))
        ? voiceRate
        : (clipRate || voiceRate);

    return weights.map((_, i) => first + rate * leading[i]);
}

/**
 * Move each predicted time onto a real boundary when one is near enough.
 *
 * The prediction carries the shape of the phrase; the onsets carry where
 * the speaker actually was. Snapping takes both — but only within reach,
 * or a spurious boundary inside a word drags a word to the wrong place.
 * Each onset is spent once and time never runs backwards.
 */
function snapToOnsets(predicted, onsets, toleranceMs) {
    const out = [];
    let from = 0;
    let floor = -Infinity;
    for (const at of predicted) {
        let best = -1;
        let bestGap = toleranceMs;
        for (let j = from; j < onsets.length; j += 1) {
            if (onsets[j] < floor) continue;
            const gap = Math.abs(onsets[j] - at);
            if (gap <= bestGap) { bestGap = gap; best = j; }
            if (onsets[j] > at + toleranceMs) break;
        }
        const chosen = best >= 0 ? onsets[best] : at;
        const placed = Math.max(floor, chosen);
        out.push(placed);
        floor = placed;
        if (best >= 0) from = best + 1;
    }
    return out;
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
export function speechOnsets(samples, sampleRate, {
    windowMs = 20,
    floorRatio = 0.06,
    minGapMs = ONSET_MIN_GAP_MS,
    minSpacingMs = ONSET_MIN_SPACING_MS
} = {}) {
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
    // Two thresholds, not one. A single threshold with energy hovering
    // near it toggles every window and reports a boundary each time.
    const rise = floor * 1.8;
    const windowRealMs = (win / sampleRate) * 1000;
    const minGapWindows = Math.max(1, Math.round(minGapMs / windowRealMs));

    const onsets = [];
    // Begin INSIDE a gap so the first burst of energy registers as an
    // onset, and long enough inside one that it qualifies. Seeding with 0
    // instead made the first word appear at the very start of the clip —
    // but Kokoro opens with roughly 300ms of silence, so the word arrived
    // a third of a second before it was spoken, and every later word
    // inherited the offset.
    let inGap = true;
    let gapWindows = minGapWindows;

    energy.forEach((e, i) => {
        if (e < floor) {
            inGap = true;
            gapWindows += 1;
            return;
        }
        if (e <= rise) {
            // Between the two thresholds nothing is decided; a gap that
            // is still running goes on running.
            if (inGap) gapWindows += 1;
            return;
        }
        // Energy is unambiguously back. Only a gap long enough to have
        // been a word boundary opens a new word — a stop consonant
        // inside one does not.
        if (inGap && gapWindows >= minGapWindows) {
            const at = Math.round(i * windowRealMs);
            if (!onsets.length || at - onsets[onsets.length - 1] >= minSpacingMs) {
                onsets.push(at);
            }
        }
        inGap = false;
        gapWindows = 0;
    });
    return onsets;
}
