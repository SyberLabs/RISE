/**
 * A recording of a text, and where every word of it lands.
 *
 * THE VOICE PACK PROBLEM AT A DIFFERENT SCALE. `align-voice-pack.mjs`
 * aligns clips RISE synthesised — three seconds, one phrase, the whole
 * transcript known and short. This aligns a recording somebody read aloud:
 * minutes long, against a chapter, with the pauses, the breaths and the
 * occasional dropped word of a human being.
 *
 * The output is a narration cue for `rise.experience-program.v1` — a
 * `words[]` of `{ text, fromCharacter, toCharacter, durationMs }`, which is
 * what `NARRATION-LANE-SPEC` already defines and what
 * `render/captions.js` already performs. NARRATION DOES NOT REWRITE: each
 * word's text is the literal slice of the source it names, so the lane's
 * own `assertWordsInsideSpan` can prove the alignment against the text
 * rather than taking this script's word for it.
 *
 * WINDOWED, BECAUSE THE TRELLIS IS FRAMES x TOKENS. Ten minutes against
 * fifteen hundred words is 2.5GB of lattice and will not run; thirty
 * seconds against a window of words is 13MB and will. Each window is
 * offered more words than it can hold and aligns as many as the audio
 * supports, so no window has to know in advance how fast the reader was.
 *
 *   node scripts/align-narration.mjs --audio <file> --text <file> [--out <file>]
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
    FRAME_MS,
    forcedAlign,
    loadAligner,
    MODEL_ID,
    MODEL_RATE,
    readWav,
    tokensForWords
} from './lib/ctc-align.mjs';
import {
    assertWordsInsideSpan,
    NARRATION_LIMITS,
    validateNarrationWords
} from '../src/core/narration.js';

/** How much audio one lattice covers. */
const WINDOW_S = 30;

/**
 * How far the next window starts along. The difference is overlap, and it
 * exists so a word straddling a window boundary is aligned whole inside the
 * next one rather than truncated in this one.
 */
const HOP_S = 24;

/**
 * Words offered to a window, against about 80 a fast reader could manage in
 * thirty seconds. The surplus is what lets the window decide where the
 * audio ran out instead of being told.
 */
const WORD_WINDOW = 240;

/** A word may not be shorter than the lane allows, or start where the last did. */
const MIN_WORD_MS = 1;

/**
 * How much of a recording the text must actually reach.
 *
 * THE FAILURE THIS CATCHES IS SILENT. When the windows lose the text, every
 * word still gets a timing, the count still matches, every lane check still
 * passes — and the whole reading sits inside the first minute. Nothing
 * downstream notices; the video is simply wrong. A digit in "a 4 AM Walk in
 * the Park" did exactly that, compressing 694 words into 66 seconds of a
 * 295-second recording, and the only symptom was a number nobody was
 * printing.
 *
 * Below this, the alignment is refused rather than written.
 */
const MIN_COVERAGE = 0.7;

function parseArgs(argv) {
    const args = { audio: null, text: null, out: null, voiceAssetId: 'narration' };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--audio') args.audio = argv[++i];
        else if (argv[i] === '--text') args.text = argv[++i];
        else if (argv[i] === '--out') args.out = argv[++i];
        else if (argv[i] === '--voice-asset') args.voiceAssetId = argv[++i];
    }
    return args;
}

/**
 * Whatever arrived, as mono float32 at the model's rate.
 *
 * ffmpeg rather than a decoder here: a recording is an MP3, an M4A or a
 * FLAC, and this script has no business knowing which. It is already a
 * system dependency of the suite.
 */
function decodeToModelRate(file) {
    const staging = mkdtempSync(join(tmpdir(), 'rise-align-'));
    const wav = join(staging, 'mono.wav');
    execFileSync('ffmpeg', [
        '-v', 'error', '-y', '-i', resolve(file),
        '-ac', '1', '-ar', String(MODEL_RATE), '-c:a', 'pcm_f32le', wav
    ], { stdio: ['ignore', 'ignore', 'pipe'] });
    try {
        const decoded = readWav(wav);
        if (!decoded) throw new Error(`ffmpeg produced audio this script cannot read: ${wav}`);
        return decoded;
    } finally {
        rmSync(staging, { recursive: true, force: true });
    }
}

/**
 * The source, as words that still know where they came from.
 *
 * Offsets into the ORIGINAL text, punctuation included, because the lane
 * checks `text.slice(from, to)` against the word it was given. A token here
 * is exactly what `splitWords` would call a word, so the reveal and the
 * narration agree on how many there are.
 */
export function wordsWithOffsets(text) {
    const words = [];
    const pattern = /\S+/gu;
    let match;
    while ((match = pattern.exec(text)) !== null) {
        words.push({
            text: match[0],
            fromCharacter: match.index,
            toCharacter: match.index + match[0].length
        });
    }
    return words;
}

/**
 * Align a long recording against the text it speaks.
 *
 * @returns {Promise<{words: object[], durationMs: number, alignedWords: number}>}
 */
export async function alignNarration(samples, rate, text, aligner) {
    const sourceWords = wordsWithOffsets(text);
    const durationMs = Math.round((samples.length / rate) * 1000);
    const windowSamples = WINDOW_S * rate;
    const hopSamples = HOP_S * rate;

    const startedAtMs = new Array(sourceWords.length).fill(null);
    let cursor = 0;

    let offset = 0;
    while (offset < samples.length && cursor < sourceWords.length) {
        const end = Math.min(samples.length, offset + windowSamples);
        const finalWindow = end >= samples.length;
        const audio = samples.subarray(offset, end);
        // Under a fifth of a second of audio carries no word worth placing,
        // and the model wants more than a handful of frames to say anything.
        if (audio.length < rate * 0.2) break;

        const candidates = sourceWords.slice(cursor, cursor + WORD_WINDOW);
        const { tokens, wordStart } = tokensForWords(candidates.map(word => word.text), aligner);
        if (!tokens.length) break;

        const { frames, vocabSize, logProbs } = await aligner.emissions(audio);
        const firstFrame = forcedAlign(
            logProbs, frames, vocabSize, tokens, aligner.BLANK,
            // The last window has to finish the text; every other one stops
            // where its evidence does.
            { partial: !finalWindow }
        );

        const windowStartMs = Math.round((offset / rate) * 1000);
        // Words beyond the hop belong to the overlap: the next window sees
        // them whole, so they are aligned there instead of here.
        const acceptBeforeMs = finalWindow ? Infinity : HOP_S * 1000;

        let accepted = 0;
        let lastTimed = -1;
        for (const [index] of candidates.entries()) {
            const tokenIndex = wordStart[index];
            if (tokenIndex < 0) {
                // A WORD THIS ALPHABET CANNOT CARRY IS NOT A MISSING WORD.
                //
                // "4" in "a 4 AM Walk in the Park", or "14%" — the model's
                // vocabulary is A-Z and an apostrophe, so these normalise to
                // nothing and have no frame to report. Treating that as the
                // audio having stopped matching is what broke a five-minute
                // recording: the window stalled on a digit, the stall
                // triggered a full hop past twenty-four seconds of speech,
                // and the text never re-synchronised — 694 words compressed
                // into the first 66 seconds of a 295-second reading.
                //
                // It is carried instead, and its time comes from the words
                // either side of it.
                accepted = index + 1;
                continue;
            }
            const frame = firstFrame[tokenIndex];
            if (frame < 0) break;                       // the audio stopped supporting the text
            const withinMs = frame * FRAME_MS;
            if (withinMs >= acceptBeforeMs) break;
            startedAtMs[cursor + index] = windowStartMs + withinMs;
            lastTimed = index;
            accepted = index + 1;
        }
        // No progress means another identical window would make none either.
        if (!accepted) {
            if (finalWindow) break;
            offset += hopSamples;
            continue;
        }
        if (finalWindow) break;

        // A WINDOW MUST NOT BEGIN IN THE MIDDLE OF A WORD.
        //
        // With a fixed hop it usually does, and the tail of the word being
        // spoken across the boundary becomes the head of the next window —
        // where the aligner, having to put the first candidate somewhere,
        // puts it on that tail. Measured against known timings: every word
        // in the recording landed within 21ms at p90 except the two sitting
        // on a boundary, which were 897ms and 997ms early.
        //
        // So the next window starts where the last accepted word starts,
        // and that word is aligned again with its whole self inside. One
        // word is realigned per window; nothing is placed from a fragment.
        // Back to the last word the AUDIO placed — a carried word has no
        // time of its own to restart from.
        const redo = cursor + lastTimed;
        if (lastTimed > 0 && startedAtMs[redo] != null) {
            cursor = redo;
            offset = Math.round((startedAtMs[redo] / 1000) * rate);
        } else {
            // Almost nothing matched here. Step by the hop rather than by a
            // word, because there is no word to step by.
            cursor += accepted;
            offset += hopSamples;
        }
    }

    const placedByAudio = startedAtMs
        .map((at, index) => (at == null ? -1 : index))
        .filter(index => index >= 0);

    // A word the windows never reached — the reader dropped it, or the
    // recording ended early — is carried rather than dropped: the lane
    // needs one timing per word or the count stops matching the text.
    let previous = 0;
    for (let i = 0; i < startedAtMs.length; i++) {
        if (startedAtMs[i] == null) startedAtMs[i] = previous + MIN_WORD_MS;
        startedAtMs[i] = Math.max(startedAtMs[i], previous + (i ? MIN_WORD_MS : 0));
        previous = startedAtMs[i];
    }

    const words = sourceWords.map((word, index) => {
        const start = startedAtMs[index];
        const next = index + 1 < startedAtMs.length ? startedAtMs[index + 1] : durationMs;
        return {
            text: word.text,
            fromCharacter: word.fromCharacter,
            toCharacter: word.toCharacter,
            durationMs: Math.max(MIN_WORD_MS, Math.round(next - start))
        };
    });

    const lastPlaced = placedByAudio.length
        ? startedAtMs[placedByAudio[placedByAudio.length - 1]]
        : 0;
    return {
        words,
        durationMs,
        alignedWords: placedByAudio.length,
        // HOW MUCH OF THE RECORDING THE TEXT ACTUALLY REACHED.
        //
        // The failure mode that matters here is silent: the words all get a
        // timing, the count matches, every lane check passes, and the whole
        // reading sits inside the first minute. Nothing downstream would
        // notice. This is the number that does.
        coverage: durationMs ? lastPlaced / durationMs : 0,
        startedAtMs
    };
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!args.audio || !args.text) {
        console.error('usage: align-narration.mjs --audio <file> --text <file> [--out <file>]');
        process.exitCode = 1;
        return;
    }

    const text = readFileSync(resolve(args.text), 'utf8');
    console.log(`[narration] loading ${MODEL_ID}`);
    const aligner = await loadAligner();

    const { samples, rate } = decodeToModelRate(args.audio);
    console.log(`[narration] ${(samples.length / rate).toFixed(1)}s of audio, `
        + `${wordsWithOffsets(text).length} words of text`);

    const result = await alignNarration(samples, rate, text, aligner);

    // PROVED AGAINST THE LANE, not against this script's own opinion. These
    // are the same checks the score runs when a program is imported.
    //
    // A RECORDING IS NOT A CUE. `NARRATION_LIMITS.maxWords` caps a spoken
    // CLIP at 512 words, because a clip is one unit of speech bound to one
    // source span — not a whole reading. A five-minute narration is 709
    // words and has to arrive as several clips, one per movement, which is
    // what the lane is shaped for. Validating the whole recording as a
    // single cue was a category error on this script's part, and the cap
    // refusing it is the lane working.
    //
    // So the word SHAPE is checked in groups no larger than a cue may be,
    // and the partition into actual cues is left to whoever knows the
    // movement structure. Every word is checked against the source either
    // way, which is the proof that matters here.
    for (let at = 0; at < result.words.length; at += NARRATION_LIMITS.maxWords) {
        validateNarrationWords(result.words.slice(at, at + NARRATION_LIMITS.maxWords));
    }
    assertWordsInsideSpan(result.words, 0, text.length, text);
    const cues = Math.ceil(result.words.length / NARRATION_LIMITS.maxWords);

    if (result.coverage < MIN_COVERAGE) {
        throw new Error(
            `the text only reaches ${(result.coverage * 100).toFixed(1)}% of the recording. `
            + 'The windows lost the text rather than the reading being short: check that this '
            + 'script is what was actually read, in the order it was read.');
    }

    const payload = JSON.stringify({
        durationMs: result.durationMs,
        voiceAssetId: args.voiceAssetId,
        // Not wrapped in a cue: a cue names a source span, and which span
        // each of these belongs to is the score's business, not this
        // script's. At least `cues` of them will be needed.
        cues,
        words: result.words
    }, null, 2);
    if (args.out) {
        writeFileSync(resolve(args.out), `${payload}\n`);
        console.log(`[narration] wrote ${resolve(args.out)}`);
    } else {
        console.log(payload);
    }
    const lastMs = Math.round(result.coverage * result.durationMs);
    console.log(`[narration] ${result.alignedWords}/${result.words.length} words placed by audio`);
    console.log(`[narration] text reaches ${(lastMs / 1000).toFixed(1)}s of `
        + `${(result.durationMs / 1000).toFixed(1)}s (${(result.coverage * 100).toFixed(1)}%)`);
    if (cues > 1) {
        console.log(`[narration] ${result.words.length} words needs at least ${cues} spoken `
            + `clips (a cue carries ${NARRATION_LIMITS.maxWords})`);
    }
}

// Only when run, so the alignment can be imported and measured. Compared as
// resolved paths rather than by filename: a suffix match would also fire for
// any other script that happened to end the same way.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
    main().catch(error => {
        console.error(`[narration] ${error?.message || error}`);
        process.exitCode = 1;
    });
}
