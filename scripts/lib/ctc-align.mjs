/**
 * Forced alignment: where each word is spoken, in audio we already have the
 * words for.
 *
 * ONE COPY OF THE VITERBI. Two scripts need it — the voice pack, whose
 * clips RISE synthesised, and a narration recording, which somebody read
 * aloud — and a second copy is how one of them learns something the other
 * never hears. That is the first defect this codebase names.
 *
 * A character-level CTC model gives a per-frame distribution over the
 * alphabet. Viterbi over that lattice, constrained to the transcript we
 * already hold, returns the frame at which each word begins. It is not a
 * guess corrected by a model — it is the alignment.
 *
 * Validated against an independent arbiter rather than against itself:
 * greedy CTC decoding uses no alignment algorithm at all, and where it
 * reproduced the transcript exactly the two agreed to the frame — p50 0ms,
 * p90 0ms, max 0ms over 106 clips.
 */

import { readFileSync } from 'node:fs';

/** Character-level CTC, so the lattice is over the alphabet the text is in. */
export const MODEL_ID = 'Xenova/wav2vec2-base-960h';

/** What the model was trained at. Everything is resampled to it. */
export const MODEL_RATE = 16000;

/** One frame of the model's output, which is the resolution of an answer. */
export const FRAME_MS = 20;

/** The transcript, in the alphabet the model emits. */
export const normalizeWord = word => String(word ?? '')
    .toUpperCase()
    .replace(/[‘’ʼ´`]/g, "'")
    .replace(/[^A-Z']/g, '');

/**
 * Read a RIFF WAVE file. The voice pack is 32-bit IEEE float (fmt tag 3);
 * anything arriving from ffmpeg is whatever we asked ffmpeg for.
 */
export function readWav(file) {
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
 * Adequate, and proven so rather than assumed: the output is a frame index
 * at 20ms resolution, and the aliasing linear interpolation introduces at
 * 24k -> 16k sits far above the formant energy the model reads. Alignment
 * agrees with greedy decoding on the same resampled audio to the frame.
 */
export function resample(src, from, to) {
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

/** Per-frame log-softmax, so scores can be summed along a path. */
export function logSoftmax(raw, frames, vocab) {
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
 * either stays — emitting a blank, or repeating the token it is already on,
 * which is how CTC represents a held phoneme — or advances by emitting the
 * next token. Every frame is consumed and every token is emitted, so the
 * result is the single most likely way this audio could have produced this
 * text.
 *
 * THE TRELLIS IS WHY LONG AUDIO MUST BE CHUNKED. It is frames x tokens: ten
 * minutes against fifteen hundred words is 2.5GB, and thirty seconds
 * against a hundred and fifty words is 13MB. Callers align windows.
 *
 * @returns {Int32Array} the frame at which each token was emitted
 */
export function forcedAlign(logProbs, frames, vocab, tokens, blank, { partial = false } = {}) {
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
    // WHOLE, OR AS MUCH AS THE AUDIO SUPPORTS.
    //
    // A clip is aligned against its own transcript, so the path must end
    // having emitted every token. A WINDOW of a long recording is offered
    // more words than it can contain — the caller cannot know in advance
    // how many were spoken in thirty seconds — so it ends wherever the
    // evidence ran out, and the words past that point are left for the
    // next window.
    //
    // Comparing end states is fair because every path is exactly `frames`
    // terms long whatever j it reached: a path that stopped too early has
    // to emit blanks over real speech, and one that ran too far has to
    // emit letters over silence. Both score worse than the truth.
    let j = L;
    if (partial) {
        let best = -Infinity;
        for (let k = 0; k <= L; k++) {
            const at = score[frames * (L + 1) + k];
            if (at > best) { best = at; j = k; }
        }
    }
    for (let t = frames; t > 0 && j > 0; t--) {
        if (advanced[t * (L + 1) + j] === 1) {
            firstFrame[j - 1] = t - 1;
            j--;
        }
    }
    return firstFrame;
}

/** The model, its tokenizer, and the two ids the lattice is built from. */
export async function loadAligner() {
    // transformers.js arrives with kokoro-js and is a build-time dependency
    // only; nothing in this import reaches the browser bundle.
    const { AutoModelForCTC, AutoTokenizer, Tensor } = await import('@huggingface/transformers');
    const model = await AutoModelForCTC.from_pretrained(MODEL_ID, { dtype: 'fp32' });
    const tokenizer = await AutoTokenizer.from_pretrained(MODEL_ID);
    const vocab = tokenizer.model.vocab;
    const idOf = new Map(vocab.map((token, index) => [token, index]));
    return {
        vocab,
        idOf,
        BLANK: idOf.get('<pad>'),
        SEPARATOR: idOf.get('|'),
        UNKNOWN: idOf.get('<unk>'),
        /** Emissions for one span of audio, already at MODEL_RATE. */
        async emissions(audio) {
            const output = await model({
                input_values: new Tensor('float32', audio, [1, audio.length])
            });
            const [, frames, vocabSize] = output.logits.dims;
            return {
                frames,
                vocabSize,
                logProbs: logSoftmax(output.logits.data, frames, vocabSize)
            };
        }
    };
}

/**
 * Tokens for a run of words, and where each word starts in that run.
 *
 * A word the alphabet cannot carry — punctuation alone, a numeral — gets no
 * token and is marked -1. It still occupies a place, because the caller has
 * to return one timing per word or the count stops matching the text.
 */
export function tokensForWords(words, { idOf, SEPARATOR, UNKNOWN }) {
    const tokens = [];
    const wordStart = [];
    for (const [index, word] of words.entries()) {
        const normalized = normalizeWord(word);
        if (index > 0 && normalized) tokens.push(SEPARATOR);
        wordStart.push(normalized ? tokens.length : -1);
        for (const ch of normalized) tokens.push(idOf.get(ch) ?? UNKNOWN);
    }
    return { tokens, wordStart };
}
