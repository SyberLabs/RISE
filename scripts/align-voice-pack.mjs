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
import {
    forcedAlign,
    loadAligner,
    MODEL_ID,
    MODEL_RATE,
    readWav,
    resample,
    tokensForWords
} from './lib/ctc-align.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const MANIFEST_PATH = resolve(ROOT, 'src/audio/voice-pack.manifest.json');
const PUBLIC_ROOT = resolve(ROOT, 'public');

/**
 * The acoustic model. Character-level CTC, so its lattice is over the
 * same alphabet the transcript is written in and no lexicon is needed.
 */
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

    console.log(`[align] loading ${MODEL_ID}`);
    const aligner = await loadAligner();

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
            const { frames, vocabSize, logProbs } = await aligner.emissions(audio);
            const frameMs = entry.durationMs / frames;

            const { tokens, wordStart: wordStartToken } = tokensForWords(words, aligner);
            if (wordStartToken.every(at => at < 0)) { unplaceable++; continue; }

            const firstFrame = forcedAlign(logProbs, frames, vocabSize, tokens, aligner.BLANK);
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
