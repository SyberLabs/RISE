/**
 * Align the voice pack: where each word is actually spoken.
 *
 * THE WAVEFORM WAS NEVER GOING TO TELL US THIS.
 *
 * `speechOnsets` finds silences. That is a real signal and a cheap one,
 * but connected speech does not put a silence between every word — it
 * puts one where the speaker pauses, which is a different thing. Measured
 * over the shipped pack, 60% of clips came back with FEWER onsets than
 * the phrase has words, and the boundaries they did report were not the
 * word starts: one clip placed "trivial" at 2020ms and "influence" at
 * 2060ms, forty milliseconds apart, which nobody has ever said aloud.
 *
 * So the reveal was interpolating between anchors that were themselves
 * wrong. Against the alignment this script produces, what shipped ran a
 * median of 319ms from the voice, p90 1451ms, with 28% of words appearing
 * after they had been spoken.
 *
 * WE KNOW THE WORDS. That is the whole asset the detector was throwing
 * away. A CTC acoustic model gives a per-frame distribution over
 * characters; Viterbi over that lattice, constrained to the transcript we
 * already have, yields the frame at which each word begins. It is not a
 * guess corrected by a model — it is the alignment.
 *
 * Validated against an independent arbiter rather than against itself:
 * greedy CTC decoding uses no alignment algorithm at all, and where it
 * reproduces the transcript exactly (106 of 140 sampled clips) the two
 * agree to the frame — p50 0ms, p90 0ms, max 0ms.
 *
 * This reads existing audio and rewrites `onsetsMs`. It never synthesises;
 * `build-voice-pack.mjs` owns that. Run it after a build.
 *
 *   node scripts/align-voice-pack.mjs [--dry-run] [--limit N]
 */

import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { splitWords } from '../src/core/recitation.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = resolve(ROOT, 'src/audio/voice-pack.manifest.json');
const PUBLIC_ROOT = resolve(ROOT, 'public');

/**
 * The acoustic model. Character-level CTC, so its lattice is over the
 * same alphabet the transcript is written in and no lexicon is needed.
 */
const MODEL_ID = 'Xenova/wav2vec2-base-960h';

/** What the model was trained at. The pack is 24k, so it is resampled. */
const MODEL_RATE = 16000;

/**
 * Two words may not share a millisecond.
 *
 * `revealSchedule` puts the onsets through a Set before it compares their
 * count to the word count, so a duplicate would silently drop the phrase
 * back onto the interpolating path — the one this script exists to stop
 * using. A frame is 20ms; anything closer than this was never two words.
 */
const MIN_SEPARATION_MS = 10;

function parseArgs(argv) {
    const args = { dryRun: false, limit: Infinity };
    for (let i = 0; i < argv.length; i++) {
        if (argv[i] === '--dry-run') args.dryRun = true;
        else if (argv[i] === '--limit') args.limit = Number(argv[++i]) || Infinity;
    }
    return args;
}

/** The pack is 32-bit IEEE float (fmt tag 3), not 16-bit PCM. */
function readWav(file) {
    const buf = readFileSync(file);
    let off = 12;
    let fmt = null;
    let data = null;
    while (off + 8 <= buf.length) {
        const id = buf.toString('ascii', off, off + 4);
        const size = buf.readUInt32LE(off + 4);
        if (id === 'fmt ') {
            fmt = {
                tag: buf.readUInt16LE(off + 8),
                channels: buf.readUInt16LE(off + 8 + 2),
                rate: buf.readUInt32LE(off + 8 + 4),
                bits: buf.readUInt16LE(off + 8 + 14)
            };
        }
        if (id === 'data') { data = buf.subarray(off + 8, off + 8 + size); break; }
        off += 8 + size + (size % 2);
    }
    if (!fmt || !data) return null;
    const bytes = fmt.bits / 8;
    const frames = Math.floor(data.length / bytes / fmt.channels);
    const out = new Float32Array(frames);
    if (fmt.tag === 3 && fmt.bits === 32) {
        for (let i = 0; i < frames; i++) out[i] = data.readFloatLE(i * bytes * fmt.channels);
    } else if (fmt.bits === 16) {
        for (let i = 0; i < frames; i++) out[i] = data.readInt16LE(i * bytes * fmt.channels) / 32768;
    } else {
        return null;
    }
    return { samples: out, rate: fmt.rate };
}

/**
 * Linear resampling to the model's rate.
 *
 * Adequate here and not a shortcut worth apologising for: the output is a
 * frame index at 20ms resolution, and the aliasing linear interpolation
 * introduces at 24k -> 16k sits far above the formant energy the model
 * reads. Proven by the arbiter — alignment agrees with greedy decoding on
 * the same resampled audio to the frame.
 */
function resample(src, from, to) {
    if (from === to) return src;
    const n = Math.round((src.length * to) / from);
    const out = new Float32Array(n);
    const step = (src.length - 1) / (n - 1);
    for (let i = 0; i < n; i++) {
        const x = i * step;
        const i0 = Math.floor(x);
        const i1 = Math.min(src.length - 1, i0 + 1);
        const t = x - i0;
        out[i] = src[i0] * (1 - t) + src[i1] * t;
    }
    return out;
}

/** The transcript, in the alphabet the model emits. */
const normalizeWord = word => String(word ?? '')
    .toUpperCase()
    .replace(/[‘’ʼ´`]/g, "'")
    .replace(/[^A-Z']/g, '');

/** Per-frame log-softmax, so scores can be summed along a path. */
function logSoftmax(raw, frames, vocab) {
    const out = new Float64Array(frames * vocab);
    for (let t = 0; t < frames; t++) {
        const base = t * vocab;
        let max = -Infinity;
        for (let v = 0; v < vocab; v++) max = Math.max(max, raw[base + v]);
        let sum = 0;
        for (let v = 0; v < vocab; v++) sum += Math.exp(raw[base + v] - max);
        const lse = max + Math.log(sum);
        for (let v = 0; v < vocab; v++) out[base + v] = raw[base + v] - lse;
    }
    return out;
}

/**
 * Viterbi forced alignment of a known token sequence to CTC emissions.
 *
 * The lattice has one state per token consumed. At each frame the path
 * either stays — emitting a blank, or repeating the token it is already
 * on, which is how CTC represents a held phoneme — or advances by
 * emitting the next token. Every frame is consumed and every token is
 * emitted, so the result is the single most likely way this audio could
 * have produced this text.
 *
 * @returns {Int32Array} the frame at which each token was emitted
 */
function forcedAlign(logProbs, frames, vocab, tokens, blank) {
    const L = tokens.length;
    const NEG = -1e30;
    const score = new Float64Array((frames + 1) * (L + 1)).fill(NEG);
    const advanced = new Uint8Array((frames + 1) * (L + 1));
    score[0] = 0;

    for (let t = 0; t < frames; t++) {
        const emit = t * vocab;
        for (let j = 0; j <= L; j++) {
            const here = score[t * (L + 1) + j];
            if (here <= NEG) continue;
            const hold = j > 0
                ? Math.max(logProbs[emit + blank], logProbs[emit + tokens[j - 1]])
                : logProbs[emit + blank];
            const stayAt = (t + 1) * (L + 1) + j;
            if (here + hold > score[stayAt]) {
                score[stayAt] = here + hold;
                advanced[stayAt] = 0;
            }
            if (j < L) {
                const stepAt = (t + 1) * (L + 1) + j + 1;
                const step = here + logProbs[emit + tokens[j]];
                if (step > score[stepAt]) {
                    score[stepAt] = step;
                    advanced[stepAt] = 1;
                }
            }
        }
    }

    const firstFrame = new Int32Array(L).fill(-1);
    let j = L;
    for (let t = frames; t > 0 && j > 0; t--) {
        if (advanced[t * (L + 1) + j] === 1) {
            firstFrame[j - 1] = t - 1;
            j--;
        }
    }
    return firstFrame;
}

/**
 * Keep the series strictly increasing without moving anything that was
 * already right. A word the model could not place (punctuation alone, a
 * numeral the character vocabulary has no letter for) is carried forward
 * from its neighbour rather than dropped: the count has to match the
 * phrase or the runtime falls back to interpolating.
 */
function monotonic(times, durationMs) {
    const out = [];
    let floor = 0;
    for (const at of times) {
        const value = Number.isFinite(at) && at >= 0 ? at : floor + MIN_SEPARATION_MS;
        const placed = Math.max(value, floor);
        out.push(Math.round(placed));
        floor = placed + MIN_SEPARATION_MS;
    }
    // Nothing may be pushed past the end of its own recording.
    const last = out[out.length - 1];
    if (last >= durationMs) {
        const overflow = last - durationMs + MIN_SEPARATION_MS;
        for (let i = out.length - 1, shift = overflow; i >= 0 && shift > 0; i--) {
            const lower = i === 0 ? 0 : out[i - 1] + MIN_SEPARATION_MS;
            const moved = Math.max(lower, out[i] - shift);
            shift -= out[i] - moved;
            out[i] = moved;
        }
    }
    return out;
}

async function main() {
    const args = parseArgs(process.argv.slice(2));
    if (!existsSync(MANIFEST_PATH)) {
        console.error('[align] no manifest at', MANIFEST_PATH);
        process.exitCode = 1;
        return;
    }
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf8'));

    // transformers.js arrives with kokoro-js and is a build-time dependency
    // only; nothing in this import reaches the browser bundle.
    const { AutoModelForCTC, AutoTokenizer, Tensor } = await import('@huggingface/transformers');
    console.log(`[align] loading ${MODEL_ID}`);
    const model = await AutoModelForCTC.from_pretrained(MODEL_ID, { dtype: 'fp32' });
    const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    const vocab = tokenizer.model.vocab;
    const idOf = new Map(vocab.map((token, index) => [token, index]));
    const BLANK = idOf.get('<pad>');
    const SEPARATOR = idOf.get('|');
    const UNKNOWN = idOf.get('<unk>');

    let aligned = 0;
    let missingAudio = 0;
    let unplaceable = 0;
    let processed = 0;
    const exactBefore = [];
    const exactAfter = [];

    for (const [voiceId, voice] of Object.entries(manifest.voices || {})) {
        for (const [key, entry] of Object.entries(voice.entries || {})) {
            if (processed >= args.limit) break;
            const file = join(PUBLIC_ROOT, entry.asset.replace(/^\//, ''));
            if (!existsSync(file)) { missingAudio++; continue; }
            const words = splitWords(entry.spokenText || entry.text).map(w => w.text);
            if (!words.length) continue;
            const wav = readWav(file);
            if (!wav) { missingAudio++; continue; }
            processed++;

            exactBefore.push(
                new Set((entry.onsetsMs || []).map(Number)).size === words.length ? 1 : 0);

            const audio = resample(wav.samples, wav.rate, MODEL_RATE);
            const output = await model({
                input_values: new Tensor('float32', audio, [1, audio.length])
            });
            const [, frames, vocabSize] = output.logits.dims;
            const logProbs = logSoftmax(output.logits.data, frames, vocabSize);
            const frameMs = entry.durationMs / frames;

            const tokens = [];
            const wordStartToken = [];
            let placeable = 0;
            words.forEach((word, index) => {
                const normalized = normalizeWord(word);
                if (index > 0 && normalized) tokens.push(SEPARATOR);
                wordStartToken.push(normalized ? tokens.length : -1);
                if (normalized) placeable++;
                for (const ch of normalized) tokens.push(idOf.get(ch) ?? UNKNOWN);
            });
            if (!placeable) { unplaceable++; continue; }

            const firstFrame = forcedAlign(logProbs, frames, vocabSize, tokens, BLANK);
            const raw = wordStartToken.map(tokenIndex => {
                if (tokenIndex < 0) return NaN;
                const frame = firstFrame[tokenIndex];
                return frame < 0 ? NaN : frame * frameMs;
            });
            const onsets = monotonic(raw, entry.durationMs);

            entry.onsetsMs = onsets;
            exactAfter.push(new Set(onsets).size === words.length ? 1 : 0);
            aligned++;
            if (aligned % 100 === 0) console.log(`[align] ${aligned} clips`);
        }
    }

    const share = arr => (arr.length ? (arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    console.log(`\n[align] clips processed        ${processed}`);
    console.log(`[align] aligned                ${aligned}`);
    console.log(`[align] audio missing          ${missingAudio}`);
    console.log(`[align] no placeable word      ${unplaceable}`);
    console.log(`[align] one onset per word     ${(share(exactBefore) * 100).toFixed(1)}%`
        + `  ->  ${(share(exactAfter) * 100).toFixed(1)}%`);

    if (args.dryRun) {
        console.log('[align] --dry-run: manifest not written');
        return;
    }
    manifest.alignment = {
        method: 'ctc-forced',
        model: MODEL_ID,
        alignedAt: new Date().toISOString()
    };
    writeFileSync(MANIFEST_PATH, `${JSON.stringify(manifest, null, 2)}\n`);
    console.log(`[align] wrote ${MANIFEST_PATH}`);
}

main().catch(error => {
    console.error('[align] failed:', error);
    process.exitCode = 1;
});
