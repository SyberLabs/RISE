import { describe, expect, it } from 'vitest';
import { splitWords, revealSchedule, revealBudget } from '../core/recitation.js';
import manifest from './voice-pack.manifest.json';

/**
 * THE VOICE IS THE CLOCK, AND THIS IS WHERE THAT IS TRUE OR NOT.
 *
 * `revealSchedule` has two paths. When the pack reports one onset per
 * word it uses them directly — word i begins at onset i — and the reveal
 * is the voice's own rhythm. When it does not, it interpolates between
 * whatever anchors it has and corrects with the rest, which is a model of
 * the phrase rather than a measurement of it.
 *
 * The pack used to take the second path for 83% of its clips, because
 * `speechOnsets` finds silences and connected speech does not leave one
 * between every word. Measured against CTC forced alignment, what shipped
 * ran a median of 346ms from the voice, p90 1523ms, worst 4189ms, with
 * only 22% of words landing within 60ms. One clip placed "trivial" at
 * 2020ms and "influence" at 2060ms — forty milliseconds apart.
 *
 * `scripts/align-voice-pack.mjs` replaced those onsets with a real
 * alignment: p50 0ms, p90 30ms, worst 60ms, 100% within 60ms.
 *
 * This file is the ratchet. Regenerating the pack rewrites `onsetsMs`
 * from the energy detector again, so a build that forgets to re-align
 * would quietly undo all of it — no error, no crash, just the reveal
 * drifting half a second off the voice. Nothing else would notice.
 */

const entries = Object.values(manifest.voices || {})
    .flatMap(voice => Object.entries(voice.entries || {}));

describe('the shipped voice pack is aligned to its own audio', () => {
    it('ships a pack at all', () => {
        expect(entries.length).toBeGreaterThan(100);
    });

    it('records how the onsets were derived', () => {
        // A pack that cannot say where its timings came from is a pack
        // nobody can tell has regressed.
        expect(manifest.alignment?.method).toBe('ctc-forced');
        expect(manifest.alignment?.model).toBeTruthy();
    });

    it('gives every word exactly one onset', () => {
        // The whole of the fast path is this equality. Anything else and
        // the runtime silently starts guessing again.
        const wrong = [];
        for (const [key, entry] of entries) {
            const words = splitWords(entry.spokenText || entry.text).length;
            const onsets = entry.onsetsMs?.length ?? 0;
            if (onsets !== words) wrong.push(`${key}: ${onsets} onsets for ${words} words`);
        }
        expect(wrong.slice(0, 5), `${wrong.length} clips off`).toEqual([]);
    });

    it('keeps them strictly increasing, so none is deduplicated away', () => {
        // revealSchedule puts the onsets through a Set BEFORE comparing
        // their count to the word count. Two words sharing a millisecond
        // would drop the phrase back onto the interpolating path without
        // anything reporting it.
        const bad = [];
        for (const [key, entry] of entries) {
            const onsets = entry.onsetsMs || [];
            if (new Set(onsets).size !== onsets.length) { bad.push(`${key}: duplicate`); continue; }
            for (let i = 1; i < onsets.length; i++) {
                if (onsets[i] <= onsets[i - 1]) { bad.push(`${key}: ${onsets[i - 1]} -> ${onsets[i]}`); break; }
            }
        }
        expect(bad.slice(0, 5), `${bad.length} clips off`).toEqual([]);
    });

    it('never places a word outside its own recording', () => {
        const bad = [];
        for (const [key, entry] of entries) {
            const last = entry.onsetsMs?.[entry.onsetsMs.length - 1] ?? 0;
            if (!(last < entry.durationMs)) bad.push(`${key}: ${last} >= ${entry.durationMs}`);
            if ((entry.onsetsMs?.[0] ?? 0) < 0) bad.push(`${key}: negative first onset`);
        }
        expect(bad.slice(0, 5), `${bad.length} clips off`).toEqual([]);
    });

    it('takes the voice-is-the-clock path for the whole pack', () => {
        // The property that matters is not the shape of the data but what
        // revealSchedule does with it: every word revealed on its own
        // measured onset, never on an interpolation between two.
        let exact = 0;
        for (const [, entry] of entries) {
            const words = splitWords(entry.spokenText || entry.text);
            const budget = revealBudget(entry.durationMs) || 1;
            const schedule = revealSchedule(words, budget, entry.onsetsMs);
            const onsets = entry.onsetsMs;
            // The first word waits for the voice; each later one leads its
            // own onset by a fixed step and by nothing else.
            const leads = schedule.map((at, i) => onsets[i] - at);
            const uniform = leads.slice(1).every(lead => lead === leads[1]);
            if (leads[0] === 0 && uniform) exact++;
        }
        expect(exact).toBe(entries.length);
    });
});
