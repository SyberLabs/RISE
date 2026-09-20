/**
 * Does the long-form aligner actually put the words where they are said?
 *
 * NOT A UNIT TEST, because proving this needs a real acoustic model and a
 * real recording minutes long, and a stub would only prove we can satisfy
 * our own stub. It is kept runnable instead, so the claim in
 * `align-narration.mjs` can be re-checked rather than believed.
 *
 * GROUND TRUTH WITHOUT A HUMAN IN THE LOOP. The voice pack's clips are
 * already aligned to the frame and verified against an independent greedy
 * decode, so concatenating a run of them builds a recording several minutes
 * long whose every word timing is known in advance — pauses, breaths and
 * sentence boundaries included. The long-form aligner is then asked to
 * recover what the per-clip aligner already established.
 *
 * It is not a substitute for a human reading, which has accents, dropped
 * words and a narrator who skips a line. It is the floor: an aligner that
 * cannot recover known timings will not survive one.
 *
 *   node scripts/verify-narration-alignment.mjs [--clips N]
 */

import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadAligner, MODEL_RATE, readWav, resample } from './lib/ctc-align.mjs';
import { alignNarration } from './align-narration.mjs';
import { assertWordsInsideSpan, validateNarrationWords } from '../src/core/narration.js';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

/** How far off a word may land before it counts as misplaced. */
const TOLERANCE_MS = 50;

const quantile = (values, p) => {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))];
};

async function main() {
    const clipCount = Number(process.argv.includes('--clips')
        ? process.argv[process.argv.indexOf('--clips') + 1]
        : 24) || 24;

    const manifest = JSON.parse(
        readFileSync(resolve(ROOT, 'src/audio/voice-pack.manifest.json'), 'utf8'));
    const entries = Object.values(manifest.voices)[0].entries;
    // Consecutive keys, so the assembled text reads as one passage.
    const keys = Object.keys(entries).sort().slice(0, clipCount);

    const chunks = [];
    const texts = [];
    const truth = [];
    let cursorMs = 0;
    for (const key of keys) {
        const entry = entries[key];
        const file = join(ROOT, 'public', entry.asset.replace(/^\/+/u, ''));
        if (!existsSync(file)) continue;
        const wav = readWav(file);
        if (!wav) continue;
        chunks.push(resample(wav.samples, wav.rate, MODEL_RATE));
        const words = entry.text.trim().split(/\s+/u);
        entry.onsetsMs.forEach((at, index) => truth.push({
            text: words[index], atMs: cursorMs + at
        }));
        texts.push(entry.text.trim());
        cursorMs += entry.durationMs;
    }
    if (!chunks.length) {
        console.error('[verify] no pack audio on disk');
        process.exitCode = 1;
        return;
    }

    const total = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const recording = new Float32Array(total);
    let offset = 0;
    for (const chunk of chunks) { recording.set(chunk, offset); offset += chunk.length; }
    const text = texts.join(' ');

    console.log(`[verify] ${(total / MODEL_RATE).toFixed(1)}s assembled from `
        + `${chunks.length} clips, ${truth.length} words of known timing`);

    const aligner = await loadAligner();
    const startedAt = Date.now();
    const result = await alignNarration(recording, MODEL_RATE, text, aligner);
    console.log(`[verify] aligned in ${((Date.now() - startedAt) / 1000).toFixed(1)}s`);

    // The lane's own proofs, not this script's opinion of them.
    validateNarrationWords(result.words);
    assertWordsInsideSpan(result.words, 0, text.length, text);
    console.log('[verify] narration lane: words inside span, every text the source slice');

    if (result.words.length !== truth.length) {
        console.error(`[verify] word count ${result.words.length} != ${truth.length}`);
        process.exitCode = 1;
        return;
    }

    const errors = truth.map((word, index) => Math.abs(result.startedAtMs[index] - word.atMs));
    const misplaced = errors.filter(error => error > TOLERANCE_MS).length;
    const within = ms => `${((errors.filter(e => e <= ms).length / errors.length) * 100).toFixed(1)}%`;

    console.log(`[verify] |err| p50 ${quantile(errors, 0.5)}ms  `
        + `p90 ${quantile(errors, 0.9)}ms  max ${Math.max(...errors)}ms`);
    console.log(`[verify] within 50ms ${within(50)}  100ms ${within(100)}`);
    console.log(`[verify] placed by audio ${result.alignedWords}/${result.words.length}`);

    if (misplaced) {
        console.error(`[verify] ${misplaced} word(s) beyond ${TOLERANCE_MS}ms`);
        for (const [index, error] of errors.entries()) {
            if (error > TOLERANCE_MS) {
                console.error(`         #${index} "${result.words[index].text}" `
                    + `got ${result.startedAtMs[index]} want ${truth[index].atMs} (${error}ms)`);
            }
        }
        process.exitCode = 1;
        return;
    }
    console.log(`[verify] every word within ${TOLERANCE_MS}ms of where it is said`);
}

main().catch(error => {
    console.error(`[verify] ${error?.message || error}`);
    process.exitCode = 1;
});
