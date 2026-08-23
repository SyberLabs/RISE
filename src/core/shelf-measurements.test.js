/**
 * WHAT THE SHELF ACTUALLY MEASURES, and the constants and comments that stand
 * on those measurements.
 *
 * Two claims live here, both of which were made once by a throwaway probe
 * script and then cited in source as if the citation were the evidence. A
 * probe that nobody runs again is a label offered as proof; these run.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 1. THE ASSUMPTION UNDER THE READING CEILING.
 *
 * MAX_WORDS_TO_ATOMS is a claim about text that RISE does not control.
 * Everything else follows from it — MAX_SAFE_TARGET_WORDS, the slider's travel,
 * and the gate's atom-ceiling refusal — so if the claim goes stale, the gate
 * admits a score that throws at Begin and the reader is told to change a chunk
 * mode the room has no control for.
 *
 * It HAD gone stale once already: the constant was 1.05 while the Analects
 * measured 1.0624, and the whole ceiling stood on 0.43% of margin that nobody
 * was watching. Nothing in the suite could see it, because the only statement
 * of the ratio was the constant itself.
 *
 * So this measures. The left side is the real chunker over the real committed
 * bytes of the shelf; the right side is the constant. Neither is derived from
 * the other, which is the only arrangement in which a disagreement can be
 * discovered.
 *
 * WHAT "THE SHELF" HAS TO MEAN HERE (D9). This measured whole DIVISIONS, and
 * a curator may name a division's OPENING — a different string, with its own
 * ratio. Six openings on today's shelf compile denser than the constant, so
 * the guard that claimed "no division a curator may name" exceeds it was
 * proving a narrower thing than the sentence beside it. The extent grammar's
 * own units are measured below, and the bound that actually holds over them is
 * atoms per word of BUDGET rather than per word of text.
 *
 * ─────────────────────────────────────────────────────────────────────────
 * 2. WHAT REFUSING AN OVERSHOOT COSTS.
 *
 * sentenceAlignedPrefix refuses when the first honest boundary lies past the
 * overshoot cap, and library-extent.js justifies that choice with a number:
 * of every division on the shelf, two refuse at a 200-word ask and one at 500
 * or 2,000. Cheap to say, and the cost of the policy turns entirely on it —
 * if a re-ingest made it two hundred, "Ulysses is nearly alone" would be the
 * comment defending a room full of absent readings.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join, posix, relative, sep } from 'node:path';
import { pathToFileURL } from 'node:url';
import { describe, expect, it } from 'vitest';
import {
    SENTENCE_BOUNDARY,
    chunkText,
    countWords as chunkerCountWords,
    estimateDuration
} from './chunker.js';
import {
    EXTENT_MIN_WORDS,
    EXTENT_OVERSHOOT_LIMIT,
    extentReadingBound,
    sentenceAlignedPrefix
} from './library-extent.js';
import {
    MAX_SAFE_TARGET_WORDS,
    MAX_WORDS_TO_ATOMS,
    READING_LIMITS,
    WORST_MEASURED_DIVISION,
    WORST_MEASURED_OPENING
} from './reading-limits.js';
import { releaseArchiveTexts } from '../content/archive/index.js';
import { splitLongDivision } from '../content/archive/divisions.js';

const countWords = chunkerCountWords;
const ROOT = process.cwd();
const repoPath = (absolute) => relative(ROOT, absolute).split(sep).join(posix.sep);

/**
 * Every division of every served work, as the compiler will actually cut it.
 *
 * Word mode, because that is what a reading opens in and the mode that pays a
 * paragraph-break atom per paragraph. Measured once and shared.
 */
async function measureShelf() {
    const divisions = [];
    for (const work of releaseArchiveTexts()) {
        const scheme = await work.getDivisions();
        scheme.entries.forEach((entry, index) => {
            const text = String(entry.content || '').trim();
            const words = countWords(text);
            if (!words) return;
            const atoms = chunkText(text, 'word', { sourceId: work.id }).length;
            divisions.push({
                id: `${work.id}#${index + 1}`, text, words, atoms, ratio: atoms / words
            });
        });
    }
    divisions.sort((left, right) => right.ratio - left.ratio);
    return divisions;
}

const shelf = await measureShelf();

/**
 * The asks the extent grammar admits, spread across the travel it is used at.
 *
 * `EXTENT_MIN_WORDS` because that is the floor a `:N` may carry; 200 because
 * that is the slider's; the rest because an opening's ratio turns on where the
 * sentences happen to fall, and one ask would only measure one accident.
 */
const EXTENT_ASKS = Object.freeze([40, 50, 75, 100, 200, 300, 500, 2_000]);

/**
 * EVERY UNIT A CURATOR MAY NAME, cut the way the resolver cuts it.
 *
 * `work#12` is measured above. `work#12:200` is this: a different string,
 * chunked separately, charged separately. `charged` is what the gate spends
 * from the reader's length for it, which is the quantity the atom ceiling is
 * actually a bound over.
 */
function measureExtents() {
    const measured = [];
    for (const division of shelf) {
        for (const asked of EXTENT_ASKS) {
            const cut = sentenceAlignedPrefix(division.text, asked);
            if (!cut) continue;
            const atoms = chunkText(cut.text, 'word', { sourceId: division.id }).length;
            measured.push({
                id: `${division.id}:${asked}`,
                division,
                asked,
                boundary: cut.boundary,
                text: cut.text,
                words: cut.words,
                atoms,
                ratio: atoms / cut.words,
                charged: extentReadingBound(division.words, asked)
            });
        }
    }
    return measured;
}

const extents = measureExtents();
const openings = extents.filter(extent => extent.boundary !== 'whole');

/**
 * EVERY MODULE THE COUNTING VOCABULARY COULD HIDE IN, imported.
 *
 * `src/core` recursively, because a copy in `src/core/render/` walked past a
 * flat `readdirSync`; `src/components`, because a copy there did too; and the
 * archive modules, because that is where the two copies actually were and
 * where the number the budget spends is computed. `works/` is excluded: it is
 * ninety-five payload files of book text, imported nowhere but the index, and
 * loading them costs twenty seconds to sweep exports nobody has.
 */
const SWEPT_ROOTS = Object.freeze(['src/core', 'src/components', 'src/content/archive']);
const NOT_SWEPT = Object.freeze(['src/content/archive/works']);

/**
 * MODULES THIS ENVIRONMENT CANNOT OPEN, named rather than skipped.
 *
 * `chamber-paint.js` drives a real browser: it imports `vite` and
 * `playwright`, and esbuild will not load under jsdom. A module the sweep
 * cannot import proves nothing about itself, so this one is READ instead —
 * the weaker check applied to a named exception, rather than to everything.
 * The list is asserted to be exactly this long, so it cannot grow quietly
 * into the hiding place the recursion was widened to reach.
 */
const READ_NOT_IMPORTED = Object.freeze(['src/core/render/chamber-paint.js']);

function modulePathsUnder(directory) {
    const found = [];
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
        const full = join(directory, entry.name);
        if (entry.isDirectory()) {
            if (NOT_SWEPT.includes(repoPath(full))) continue;
            found.push(...modulePathsUnder(full));
            continue;
        }
        if (!entry.name.endsWith('.js') || /\.(?:test|spec)\.js$/u.test(entry.name)) continue;
        found.push(full);
    }
    return found;
}

const SWEPT = [];
const FAILED_TO_IMPORT = [];
for (const root of SWEPT_ROOTS) {
    for (const file of modulePathsUnder(join(ROOT, root))) {
        const path = repoPath(file);
        if (READ_NOT_IMPORTED.includes(path)) continue;
        try {
            const namespace = await import(pathToFileURL(file).href);
            // A namespace member can be a getter that throws; a module whose
            // exports cannot be read has not been cleared, so it is a failure
            // rather than a pass.
            SWEPT.push({ path, exports: Object.keys(namespace).map(name => [name, namespace[name]]) });
        } catch (error) {
            FAILED_TO_IMPORT.push(`${path}: ${String(error?.message).split('\n')[0]}`);
        }
    }
}

describe('the atoms-per-word assumption still holds on this shelf', () => {
    it('measured enough of the shelf to be worth believing', () => {
        // A guard that measured nothing would report every constant sound.
        expect(shelf.length).toBeGreaterThan(900);
        expect(shelf.reduce((sum, entry) => sum + entry.words, 0)).toBeGreaterThan(1_000_000);
    });

    it('has no division that compiles denser than the constant assumes', () => {
        const worst = shelf[0];
        expect(
            worst.ratio,
            `${worst.id} compiles ${worst.atoms} atoms from ${worst.words} words `
            + `(${worst.ratio.toFixed(5)} per word), above the assumed `
            + `${MAX_WORDS_TO_ATOMS}. Re-derive MAX_WORDS_TO_ATOMS from this `
            + 'division and re-check the headroom.'
        ).toBeLessThanOrEqual(MAX_WORDS_TO_ATOMS);
    });

    it('still names the densest division it was derived from', () => {
        // Not a second copy of the ratio — the recorded pair is two integers a
        // reader can go and count. If the Analects is re-ingested, or a denser
        // work lands, this says so rather than letting the derivation rot into
        // folklore.
        const worst = shelf[0];
        expect(worst.id).toBe(WORST_MEASURED_DIVISION.id);
        expect({ words: worst.words, atoms: worst.atoms }).toEqual({
            words: WORST_MEASURED_DIVISION.words,
            atoms: WORST_MEASURED_DIVISION.atoms
        });
    });

    it('keeps the worst reading a curator can compose under the atom cap', () => {
        // The failure mode itself, reproduced: fill the maximum permitted
        // length with the densest divisions the shelf holds, worst first, and
        // count what the compiler would emit.
        let words = 0;
        let atoms = 0;
        for (const division of shelf) {
            if (words >= MAX_SAFE_TARGET_WORDS) break;
            const take = Math.min(division.words, MAX_SAFE_TARGET_WORDS - words);
            words += take;
            atoms += Math.ceil(division.ratio * take);
        }
        expect(words).toBe(MAX_SAFE_TARGET_WORDS);
        expect(
            atoms,
            `a ${words.toLocaleString()}-word reading of the shelf's densest divisions `
            + `compiles to ${atoms.toLocaleString()} atoms against a cap of `
            + `${READING_LIMITS.maxAtoms.toLocaleString()}`
        ).toBeLessThanOrEqual(READING_LIMITS.maxAtoms);
    });
}, 300_000);

/**
 * D9. THE CEILING'S PROOF HAS TO COVER THE IDS THE GRAMMAR TEACHES.
 *
 * Everything above measures `work#12`. The prompt teaches `work#12:200`, the
 * resolver cuts it, and the cut is a different string: six of them on today's
 * shelf compile denser than MAX_WORDS_TO_ATOMS, so the sentence the constant
 * carried ("no division a curator may name") described a set that does not
 * include half of what a curator may name.
 *
 * The ceiling is not breached, and it is worth being exact about why, because
 * the reason is not the one reading-limits.js used to give. Atoms are bounded
 * per word of BUDGET, not per word of text: an opening asked at 50 words is
 * charged 80, so a 1.1837 ratio costs 0.72 atoms of the reader's length.
 */
describe('what the extent grammar can name fits the same ceiling (D9)', () => {
    it('measured enough of the grammar to be worth believing', () => {
        expect(extents.length).toBeGreaterThan(6_000);
        expect(openings.length).toBeGreaterThan(4_000);
        // Every ask reached something, so a typo in EXTENT_ASKS cannot quietly
        // narrow what this file covers.
        for (const asked of EXTENT_ASKS) {
            expect(extents.some(extent => extent.asked === asked), `ask ${asked}`).toBe(true);
        }
    });

    it('names the densest opening rather than counting them', () => {
        // The model library-extent.js set for the overshoot cost: named, so if
        // Ulysses' Sirens stops being the worst this says which cut took over
        // instead of going on passing with a different worst case underneath.
        const worst = openings.reduce((a, b) => (b.ratio > a.ratio ? b : a));
        expect(worst.id).toBe(WORST_MEASURED_OPENING.id);
        expect({ words: worst.words, atoms: worst.atoms }).toEqual({
            words: WORST_MEASURED_OPENING.words,
            atoms: WORST_MEASURED_OPENING.atoms
        });
        // And the fact the old claim denied: it IS above the constant.
        expect(worst.ratio).toBeGreaterThan(MAX_WORDS_TO_ATOMS);
    });

    it('charges every cut at least the words it delivers', () => {
        // Step one of the corrected proof. An extent that read more words than
        // the budget spent on it would be a score admitted longer than it
        // promised, and would also void step two.
        const overrun = extents.filter(extent => extent.words > extent.charged);
        expect(
            overrun.map(extent => `${extent.id} delivered ${extent.words} for ${extent.charged}`)
        ).toEqual([]);
    });

    it('holds MAX_WORDS_TO_ATOMS as a bound per word of budget', () => {
        // Step two, and the statement MAX_SAFE_TARGET_WORDS actually needs.
        // Per word DELIVERED this is false and the test above says so; per word
        // CHARGED it is what the ceiling stands on.
        const worst = extents.reduce((a, b) =>
            (b.atoms / b.charged > a.atoms / a.charged ? b : a));
        expect(
            worst.atoms / worst.charged,
            `${worst.id} compiles ${worst.atoms} atoms against ${worst.charged} charged `
            + `words (${(worst.atoms / worst.charged).toFixed(5)} per charged word), above `
            + `the assumed ${MAX_WORDS_TO_ATOMS}. The reading ceiling is derived from this `
            + 'bound; re-derive it before raising the slider.'
        ).toBeLessThanOrEqual(MAX_WORDS_TO_ATOMS);
    });

    it('keeps the worst reading composable out of EXTENTS under the atom cap', () => {
        // The greedy fill the divisions get, over the grammar's own units and
        // ordered by what a curator is actually spending: atoms per charged
        // word. A whole division wins that ordering, which is the conclusion
        // the corrected proof draws rather than assumes.
        const ordered = [...extents].sort((a, b) =>
            (b.atoms / b.charged) - (a.atoms / a.charged));
        let charged = 0;
        let atoms = 0;
        for (const extent of ordered) {
            if (charged >= MAX_SAFE_TARGET_WORDS) break;
            const take = Math.min(extent.charged, MAX_SAFE_TARGET_WORDS - charged);
            charged += take;
            atoms += Math.ceil((extent.atoms / extent.charged) * take);
        }
        expect(charged).toBe(MAX_SAFE_TARGET_WORDS);
        expect(
            atoms,
            `a ${charged.toLocaleString()}-word budget spent on the shelf's densest extents `
            + `compiles to ${atoms.toLocaleString()} atoms against a cap of `
            + `${READING_LIMITS.maxAtoms.toLocaleString()}`
        ).toBeLessThanOrEqual(READING_LIMITS.maxAtoms);
    });
}, 300_000);

/**
 * D. EIGHT ASKS ARE EIGHT ACCIDENTS, AND THE ALARM STOOD ON THEM.
 *
 * EXTENT_ASKS samples the travel. That is the right shape for a PIN — the
 * densest opening is a named pair a reader can go and count — and the wrong
 * shape for a BOUND, because an opening's ratio turns on where the sentences
 * happen to fall and the sample takes eight of the 2,961 places they could.
 *
 * It cost nothing today and it cost the number that matters. Over the eight
 * sampled asks the worst atoms-per-CHARGED-word is 1.05000
 * (`middlemarch#61:50`); over every ask the grammar admits it is 1.07463
 * (`confucius-analects#1:42`), and ask 42 is not one of the eight. Against a
 * cap of 1.148 the sample reported 8.5% of headroom where 6.4% is what there
 * is. The failure this file exists to catch is a ratio quietly closing on the
 * cap, and the alarm number was a third too generous.
 *
 * WHY THIS IS AFFORDABLE. Re-cutting and re-chunking 944 divisions at 2,961
 * asks is 2.8 million compilations. It is not necessary: `sentenceAlignedPrefix`
 * chooses an OFFSET, and the offsets a division has are fixed, so the choice
 * can be replicated arithmetically from one pass of boundary positions and one
 * pass of token starts. Only the cuts that could possibly be the worst — those
 * delivering a large enough share of what they are charged — are then really
 * cut and really chunked.
 *
 * THE REPLICATION IS NOT TRUSTED, IT IS CHECKED. Every candidate it selects is
 * cut again by the real `sentenceAlignedPrefix` and the two word counts must
 * agree; a replica that drifted from the cutter would be a second
 * implementation quietly grading the first.
 */
const ASK_CEILING = 3_000;
/**
 * How much of its charge a cut must deliver before it is worth chunking.
 *
 * Atoms per charged word is (atoms/word delivered) × (words delivered /
 * charged). The first factor is bounded by the densest opening on the shelf;
 * the second is what varies with the ask. A cut delivering under this share of
 * its charge cannot reach the cap even at the worst density the shelf holds,
 * so it is skipped — and the margin is checked below rather than asserted.
 */
const WORTH_CHUNKING = 0.78;

function sweepEveryAsk() {
    const candidates = new Map();
    let openings = 0;
    let worstDelivered = { share: 0 };
    for (const division of shelf) {
        const { offsets } = boundaryOffsets(division.text);
        const at = prefixWordCounter(division.text);
        const bounds = [...offsets, division.text.length]
            .map(offset => ({ offset, words: at(offset) }));
        const seen = new Set();
        for (let asked = EXTENT_MIN_WORDS; asked <= ASK_CEILING; asked += 1) {
            // At and above the division's own length every ask returns the
            // whole division, charged its own length — which is the ratio the
            // whole-division guard above already bounds.
            if (division.words <= asked) break;
            const ceiling = Math.round(asked * EXTENT_OVERSHOOT_LIMIT);
            let best = null;
            let bestDistance = Infinity;
            for (const bound of bounds) {
                if (bound.words < EXTENT_MIN_WORDS) continue;
                if (bound.words > ceiling) break;
                const distance = Math.abs(bound.words - asked);
                if (distance < bestDistance) {
                    bestDistance = distance;
                    best = bound;
                }
                if (bound.words >= asked) break;
            }
            if (!best) continue;
            if (best.offset >= division.text.length) continue;
            if (!seen.has(best.offset)) {
                seen.add(best.offset);
                openings += 1;
            }
            const charged = extentReadingBound(division.words, asked);
            const share = best.words / charged;
            if (share > worstDelivered.share) {
                worstDelivered = {
                    share, id: `${division.id}:${asked}`, words: best.words, charged
                };
            }
            if (share < WORTH_CHUNKING) continue;
            // One cut can be selected by many asks; the dearest is the one
            // charged least for it.
            const key = `${division.id}@${best.offset}`;
            const prior = candidates.get(key);
            if (!prior || charged < prior.charged) {
                candidates.set(key, { division, offset: best.offset, words: best.words, charged, asked });
            }
        }
    }

    let worst = { perCharged: 0 };
    const breaches = [];
    const disagreements = [];
    for (const candidate of candidates.values()) {
        const text = candidate.division.text.slice(0, candidate.offset).trimEnd();
        const words = countWords(text);
        const atoms = chunkText(text, 'word', { sourceId: candidate.division.id }).length;
        const perCharged = atoms / candidate.charged;
        const id = `${candidate.division.id}:${candidate.asked}`;
        if (perCharged > worst.perCharged) {
            worst = { perCharged, id, words, atoms, charged: candidate.charged, asked: candidate.asked };
        }
        if (perCharged > MAX_WORDS_TO_ATOMS) {
            breaches.push(`${id}: ${atoms} atoms against ${candidate.charged} charged`);
        }
        // THE REPLICA, GRADED BY THE THING IT REPLICATES.
        const real = sentenceAlignedPrefix(candidate.division.text, candidate.asked);
        if (!real || real.words !== words || real.boundary === 'whole') {
            disagreements.push(`${id}: replica ${words} words, cutter ${real?.words ?? 'null'}`);
        }
    }
    return {
        openings, candidates: candidates.size, worst, worstDelivered, breaches, disagreements
    };
}

/** Token starts, so a prefix's word count is a binary search rather than a scan. */
function prefixWordCounter(text) {
    const starts = [];
    for (const match of text.matchAll(/\S+/gu)) starts.push(match.index);
    return (offset) => {
        let low = 0;
        let high = starts.length;
        while (low < high) {
            const mid = (low + high) >> 1;
            if (starts[mid] < offset) low = mid + 1; else high = mid;
        }
        return low;
    };
}

/** `sentenceAlignedPrefix`'s boundary classes, in its own order of strength. */
function boundaryOffsets(text) {
    for (const finder of [
        new RegExp(SENTENCE_BOUNDARY.source, 'gu'), /\n[ \t]*\n/gu, /\n/gu, /\s+/gu
    ]) {
        const offsets = [...text.matchAll(finder)].map(match => match.index);
        if (offsets.length) return { offsets };
    }
    return { offsets: [] };
}

const swept = sweepEveryAsk();

describe('the bound holds at every ask, not at the eight that were sampled', () => {
    it('replicates the cutter it stands in for, on every cut it grades', () => {
        // The finding is only worth the replica's fidelity. Cross-checked
        // against the real cutter, and a single disagreement voids the sweep.
        expect(swept.disagreements).toEqual([]);
        expect(swept.candidates,
            'the sweep chunked almost nothing, so it graded almost nothing')
            .toBeGreaterThan(400);
    });

    it('swept every ask the grammar admits over every division', () => {
        // A sweep that narrowed would go on passing with the worst case
        // outside it, which is the defect it replaces.
        expect(ASK_CEILING).toBeGreaterThan(Math.max(...EXTENT_ASKS));
        expect(swept.openings,
            'fewer distinct openings than the grammar can name').toBeGreaterThan(40_000);
        expect(shelf.length).toBeGreaterThan(900);
    });

    it('holds MAX_WORDS_TO_ATOMS per charged word at every one of them', () => {
        expect(swept.breaches).toEqual([]);
        expect(
            swept.worst.perCharged,
            `${swept.worst.id} compiles ${swept.worst.atoms} atoms against `
            + `${swept.worst.charged} charged words `
            + `(${swept.worst.perCharged.toFixed(5)} per charged word), above the assumed `
            + `${MAX_WORDS_TO_ATOMS}. The reading ceiling is derived from this bound; `
            + 're-derive it before raising the slider.'
        ).toBeLessThanOrEqual(MAX_WORDS_TO_ATOMS);
    });

    it('keeps the skipping margin honest rather than assumed', () => {
        // WORTH_CHUNKING skips cuts that cannot reach the cap. That is only
        // true while the densest thing the grammar can name, times the share
        // skipped at, stays under the cap — so the arithmetic that justifies
        // the shortcut is checked against the shelf rather than believed.
        const densest = openings.reduce((a, b) => (b.ratio > a.ratio ? b : a)).ratio;
        expect(densest * WORTH_CHUNKING,
            `an opening compiling ${densest.toFixed(4)} atoms per word could reach the cap `
            + `from ${WORTH_CHUNKING} of its charge, so the sweep may be skipping the worst case`
        ).toBeLessThan(MAX_WORDS_TO_ATOMS);
        // And no cut delivers more than it is charged, at any ask — the same
        // claim the sampled asks make, over the whole grammar.
        expect(swept.worstDelivered.share,
            `${swept.worstDelivered.id} delivered ${swept.worstDelivered.words} words `
            + `for ${swept.worstDelivered.charged} charged`).toBeLessThanOrEqual(1);
    });

    it('reports the headroom the sample was a third too generous about', () => {
        // Not a second copy of the ratio: the sampled worst and the swept
        // worst are both measured here, and the assertion is that the sample
        // is the optimistic one. When the sample stops being optimistic the
        // sweep has found something, and this says so.
        //
        // Openings against openings — the sweep skips the cuts that come back
        // whole, because those are charged their own length and are what the
        // whole-division guard above already bounds.
        const sampled = openings.reduce((a, b) =>
            (b.atoms / b.charged > a.atoms / a.charged ? b : a));
        const sampledRatio = sampled.atoms / sampled.charged;
        expect(swept.worst.perCharged,
            `the eight sampled asks now report the true worst (${sampled.id}); `
            + 'the sweep has nothing left to add and one of them should be re-derived'
        ).toBeGreaterThan(sampledRatio);
        // The headroom the alarm is actually standing on, stated as the
        // quantity a reader would act on.
        const headroom = (MAX_WORDS_TO_ATOMS - swept.worst.perCharged) / MAX_WORDS_TO_ATOMS;
        expect(
            headroom,
            `${swept.worst.id} leaves ${(headroom * 100).toFixed(1)}% between the worst `
            + `charged-word ratio on the shelf and MAX_WORDS_TO_ATOMS. Under 3% the `
            + 'constant is being defended by rounding; re-derive it.'
        ).toBeGreaterThan(0.03);
    });

    it('keeps the worst reading composable at ANY ask under the atom cap', () => {
        // The greedy fill again, over the union of the sampled extents and
        // every cut the sweep found dense enough to matter. Ordering by atoms
        // per charged word and taking fractionally is the LP optimum, so this
        // is the worst reading that exists rather than the worst one sampled.
        const pool = [
            ...extents.map(extent => ({ perCharged: extent.atoms / extent.charged, charged: extent.charged })),
            { perCharged: swept.worst.perCharged, charged: swept.worst.charged }
        ].sort((a, b) => b.perCharged - a.perCharged);
        let charged = 0;
        let atoms = 0;
        for (const entry of pool) {
            if (charged >= MAX_SAFE_TARGET_WORDS) break;
            const take = Math.min(entry.charged, MAX_SAFE_TARGET_WORDS - charged);
            charged += take;
            atoms += Math.ceil(entry.perCharged * take);
        }
        expect(charged).toBe(MAX_SAFE_TARGET_WORDS);
        expect(
            atoms,
            `a ${charged.toLocaleString()}-word budget spent on the densest extents at any `
            + `ask compiles to ${atoms.toLocaleString()} atoms against a cap of `
            + `${READING_LIMITS.maxAtoms.toLocaleString()}`
        ).toBeLessThanOrEqual(READING_LIMITS.maxAtoms);
    });
}, 600_000);

/**
 * ONE VOCABULARY IN ONE PLACE (law 5), and there used to be THREE words for
 * "a word".
 *
 *   chunker.js:820             countWords  — strict, throws on a non-string
 *   standard-ebooks.js:183     countWords  — `String(text ?? '')`, coerces
 *   divisions.js:258           wordsIn     — coerces, and dropped the `u` flag
 *
 * The third was not incidental. `wordsIn` computed every per-division `words`
 * in `division-index.json`, which is the number the gate's budget SPENDS,
 * while the chunker's counts the text the atoms are made from — one quantity,
 * two functions, two contracts, and nothing but an import path to say which a
 * caller was holding.
 *
 * MEASURED BEFORE ANY OF THEM WAS DELETED, because "they agree" is a claim.
 * Over every division, section, paragraph, label and prefix of the committed
 * shelf — 44,839 strings, 116,650,530 characters — the three never disagreed
 * about a string. They disagreed only about what a non-string is worth: the
 * chunker's threw, `standard-ebooks`' counted `null` as 0 and `42` as 1,
 * `wordsIn` counted `null` as 0 and threw on `42`. Both copies are gone; the
 * whole corpus was re-indexed afterwards and both `division-index` artifacts
 * came out byte-identical over 95 works and 16,098,944 words.
 *
 * WHY THIS NO LONGER SCANS SOURCE TEXT.
 * ─────────────────────────────────────
 * What stood here counted `export function countWords` declarations under
 * `src/core` with a regex over `readdirSync`. A red team walked past it six
 * ways, all of which passed: `export const countWords`, `export { countWords }
 * from './chunker.js'`, a declaration in `src/core/render/` (`readdirSync` is
 * not recursive), a declaration in `src/components/`, a re-export of the
 * chunker's under the name `measureWords`, and — the worst — a caller keeping
 * the chunker's import LINE while shadowing the symbol with its own coercing
 * local, because a regex over an import statement asserts that the line
 * exists, not that the function is the one that runs.
 *
 * So the sweep below IMPORTS instead of reading: every non-test module under
 * the roots, and the assertion is about the functions themselves rather than
 * about the characters that declare them. What an import cannot see is a
 * local shadow, which is not exported — and the only thing a shadow can do
 * differently, given the measurement above, is answer for a non-string. That
 * is why `sentenceAlignedPrefix` hands its argument to the counter unrepaired,
 * and why the contract is asserted at the public entries below.
 */
describe('one countWords, and it is the chunker\'s', () => {
    it('counts the whitespace a text can carry the way it always did', () => {
        // The deleted copy's behaviour, kept as the surviving one's pin. Every
        // separator `\s` covers, plus the shapes that distinguish a
        // trailing-empty split from a filtered one.
        const expected = [
            ['', 0], [' ', 0], ['   ', 0], ['one', 1], ['one two', 2],
            ['  one two  ', 2], ['one\ttwo\nthree', 3], ['one\r\ntwo', 2],
            ['one\u00a0two', 2], ['one\u2028two\u2029three', 3], ['one\u3000two', 2],
            ['one\ufefftwo', 2], ['a  b   c', 3], ['\n\n\n', 0], ['word.', 1],
            ['—', 1], ['𝔘lysses Sirens', 2]
        ];
        for (const [text, words] of expected) {
            expect(chunkerCountWords(text), JSON.stringify(text)).toBe(words);
        }
    });

    it('has a sweep wide enough to be worth believing', () => {
        // A sweep that imported nothing would report every module clean. The
        // three shapes the old regex could not reach are each named, so a
        // narrowed root fails here rather than going quiet.
        expect(SWEPT.length).toBeGreaterThan(140);
        expect(SWEPT.map(module => module.path)).toContain('src/core/chunker.js');
        expect(SWEPT.some(module => module.path.startsWith('src/core/render/')),
            'the walk is not recursive').toBe(true);
        expect(SWEPT.some(module => module.path.startsWith('src/components/')),
            'the walk stops at src/core').toBe(true);
        expect(SWEPT.some(module => module.path.startsWith('src/content/archive/')),
            'the walk misses the module that indexes the shelf').toBe(true);
        expect(FAILED_TO_IMPORT, 'a module the sweep could not open proves nothing about it')
            .toEqual([]);
    });

    it('reads the one module it cannot import, and no more than that one', () => {
        // The exception, kept honest in both directions: the list is this
        // long, every entry is a file that is really there, and none of them
        // so much as names the word.
        expect(READ_NOT_IMPORTED).toHaveLength(1);
        for (const path of READ_NOT_IMPORTED) {
            expect(statSync(join(ROOT, path)).isFile(), `${path} is not on disk`).toBe(true);
            expect(readFileSync(join(ROOT, path), 'utf8'),
                `${path} mentions countWords and cannot be imported to prove which one`)
                .not.toMatch(/\bcountWords\b/u);
        }
    });

    it('exports one countWords, from the chunker, under that name and no other', () => {
        // Three questions of every export in the graph, because the evasions
        // answered two of them honestly each: is it CALLED countWords, IS it
        // the chunker's, and is it a function that answers to the name.
        const named = [];
        const aliased = [];
        const impostors = [];
        for (const { path, exports } of SWEPT) {
            for (const [name, value] of exports) {
                const isTheOne = path === 'src/core/chunker.js' && name === 'countWords';
                if (name === 'countWords' && !isTheOne) {
                    named.push(`${path} exports countWords`);
                }
                if (typeof value !== 'function') continue;
                if (value === chunkerCountWords && !isTheOne) {
                    aliased.push(`${path} exports the chunker's countWords as "${name}"`);
                }
                if (value.name === 'countWords' && value !== chunkerCountWords) {
                    impostors.push(`${path} exports a second countWords as "${name}"`);
                }
            }
        }
        expect(named).toEqual([]);
        expect(aliased).toEqual([]);
        expect(impostors).toEqual([]);
        // And the one that is allowed is present, so this cannot pass by
        // finding nothing anywhere.
        expect(SWEPT.find(module => module.path === 'src/core/chunker.js').exports
            .some(([name, value]) => name === 'countWords' && value === chunkerCountWords))
            .toBe(true);
    });

    it('refuses a non-string at every public entry that counts, and says which', () => {
        // THE CONTRACT, ASSERTED WHERE A CALLER MEETS IT. Coercing is
        // repairing and the repair is silent: a source of UNKNOWN length
        // counted as a source of NO length is the difference between
        // PROGRAM_IO_BUDGET_UNMEASURED and a budget that quietly balances.
        //
        // These are entries, not the function — that is the point. A module
        // that keeps `import { countWords } from './chunker.js'` and shadows
        // the symbol with its own coercing local satisfies every check that
        // reads an import line, and counts every real string identically
        // (measured above). The one thing it cannot do is refuse a non-string,
        // so each door that leads to a count is knocked on with one.
        const doors = [
            ['countWords', (value) => chunkerCountWords(value)],
            ['estimateDuration', (value) => estimateDuration(value, 220)],
            ['sentenceAlignedPrefix', (value) => sentenceAlignedPrefix(value, 200)],
            ['splitLongDivision', (value) => splitLongDivision(value, { maxWords: 4_000 })]
        ];
        for (const [door, knock] of doors) {
            for (const [value, named] of [[null, 'null'], [undefined, 'undefined'], [42, 'number']]) {
                expect(() => knock(value), `${door} answered for a ${named}`).toThrow(TypeError);
                expect(() => knock(value), `${door} threw something else`)
                    .toThrow(new RegExp(`countWords expects a string, received ${named}`, 'u'));
            }
        }
    });
}, 300_000);

/**
 * E. A GUARD THAT BINDS ONE SENTENCE BINDS ONE SENTENCE.
 *
 * These exist because §10c stated `MAX_SAFE_TARGET_WORDS` as 114,285 while
 * the code computed 104,529 — a figure kept from the old 1.05 atoms-per-word
 * assumption, in the one document a red team is told to script against.
 * `scriptorium-spec.test.js` answered that by reading each figure back out of
 * the exact sentence that states it, which is the right guard for the
 * sentence and no guard at all for the document. Six evasions walked past it:
 *
 *   - a SECOND statement of the ceiling in other words ("the slider therefore
 *     tops out at 120,000 words"), which no pattern for the first was looking
 *     for;
 *   - a fifth catalogue size spelled `91 kib`, because the unit sweep was
 *     case-sensitive;
 *   - a fifth spelled `KB` rather than `KiB`, a different quantity wearing the
 *     same claim;
 *   - a stale `12 KiB` in `src/content/archive/index.js`, which the sweep did
 *     not read because it read two files;
 *   - the ceiling written `**10,4,5,29**`, because `replaceAll(',', '')`
 *     normalises any grouping into the right number;
 *   - the overshoot restated as "a cut may run to 1.6 times the ask",
 *     defeating a negation written against the literal `1.6 ×`.
 *
 * So this sweeps for the SHAPE rather than for the sentence. Every figure in
 * the sections these measurements govern must be accounted for — read out of
 * the code, or listed here as prose with the reason it is prose — and every
 * byte-size claim in every file that names an index artifact must be one of
 * the four measured sizes, in the unit those sizes are measured in.
 *
 * The sentence-level guards stay where they are. This is the net beneath them:
 * they say the stated figure is right, and this says there is no second one.
 *
 * SPEC OWNERSHIP. `docs/vision/SCRIPTORIUM-SPEC.md` is edited elsewhere. These
 * read it; they do not write it, and a figure they cannot account for is
 * reported as spec text to change rather than changed.
 */
const SPEC = 'docs/vision/SCRIPTORIUM-SPEC.md';
const readRepo = (path) => readFileSync(join(ROOT, path), 'utf8');

/** The sections whose numbers these measurements are the authority for. */
const GOVERNED_SECTIONS = Object.freeze(['### Catalogue size', '### 10c. Part of a work']);

/** A heading and everything under it, up to the next heading of its rank or above. */
function sectionUnder(markdown, heading) {
    const start = markdown.indexOf(heading);
    if (start < 0) return '';
    const rank = heading.match(/^#+/u)[0].length;
    const after = markdown.slice(start + heading.length);
    const next = after.search(new RegExp(`^#{1,${rank}} `, 'mu'));
    return next < 0 ? after : after.slice(0, next);
}

/**
 * Every number a section states, as it is spelled.
 *
 * Code spans are dropped first: a figure inside backticks is a literal being
 * discussed — `1.6` in "this sentence carried a literal `1.6`" — rather than a
 * claim being made. ISO dates go too; a settlement date is not a measurement.
 * Decimals are taken before integers so `1.148` is one figure rather than a
 * "148" hiding inside one.
 */
function figuresStatedIn(markdown) {
    const prose = markdown
        .replaceAll(/`[^`]*`/gu, ' ')
        .replaceAll(/\b\d{4}-\d{2}-\d{2}\b/gu, ' ');
    const decimals = [...prose.matchAll(/\b\d+\.\d+\b/gu)].map(match => match[0]);
    const integers = [...prose.replaceAll(/\b\d+\.\d+\b/gu, ' ')
        .matchAll(/\b\d[\d,]{2,}\b/gu)].map(match => match[0]);
    return [...decimals, ...integers];
}

/**
 * WHAT EACH SECTION MAY SAY, AND HOW OFTEN.
 *
 * Spellings are ENUMERATED rather than normalised. That is the whole of the
 * grouping fix: stripping separators turns `10,4,5,29` into the right number,
 * whereas a figure that must be spelled one of the two ways a person writes it
 * cannot be smuggled in wearing a third.
 */
function accountedFigures() {
    const spellings = new Map();
    const account = (value, times, why) => {
        const canonical = typeof value === 'number' && Number.isInteger(value)
            ? [value.toLocaleString('en-US'), String(value)]
            : [String(value)];
        for (const spelling of canonical) spellings.set(spelling, { figure: why, times });
    };
    // Read out of the code, so a constant that moves fails here too.
    account(MAX_SAFE_TARGET_WORDS, 1, 'MAX_SAFE_TARGET_WORDS');
    account(EXTENT_OVERSHOOT_LIMIT, 1, 'EXTENT_OVERSHOOT_LIMIT');
    account(MAX_WORDS_TO_ATOMS, 1, 'MAX_WORDS_TO_ATOMS');
    account(Math.round(200 * EXTENT_OVERSHOOT_LIMIT), 1,
        'the worked example: 200 words × the overshoot');
    account(shelf.length, 1, 'divisions on the shelf');
    // Prose: measurements the section reports that no constant computes. Each
    // is a claim somebody made once, so each is listed once, by name.
    account(200, 2, "the slider's ask, in the grammar table and in the refusal cost");
    account(10321, 1, 'the shortest work on the shelf, before extents');
    account(5714, 1, 'ulysses#18 to its first full stop, as it used to be returned');
    account(28.6, 1, 'that overrun as a multiple of the ask');
    account(1.05, 1, 'the atoms-per-word constant the stale figure was kept from');
    return spellings;
}

/**
 * The sweep itself, over any text, so the failing inputs can be constructed.
 *
 * @returns {{ unaccounted: string[], restated: string[], counted: Map<string, number> }}
 */
function sweepFigures(sections) {
    const accounted = accountedFigures();
    const counted = new Map();
    const unaccounted = [];
    for (const [where, body] of sections) {
        for (const stated of figuresStatedIn(body)) {
            const known = accounted.get(stated);
            if (!known) {
                unaccounted.push(`${where} states ${stated}`);
                continue;
            }
            counted.set(known.figure, (counted.get(known.figure) || 0) + 1);
        }
    }
    const allowance = (figure) =>
        [...accounted.values()].find(entry => entry.figure === figure).times;
    const restated = [...counted]
        .filter(([figure, times]) => times > allowance(figure))
        .map(([figure, times]) => `${figure} is stated ${times} times, accounted ${allowance(figure)}`);
    return { unaccounted, restated, counted };
}

/**
 * Byte-size claims in a text that are not one of the measured index sizes.
 *
 * CASE-INSENSITIVELY, and across the whole family of units, because that is
 * what the two spellings walked past: a sweep for `KiB` cannot see `kib`, and
 * a sweep for the number cannot see the same number in `KB`.
 */
function wrongSizeClaims(where, text, measured) {
    const wrong = [];
    let claims = 0;
    for (const [claim, digits, unit] of text.matchAll(/(\d+)\s*([kmg]i?b)\b/giu)) {
        // A KiB claim in a file that names an index is a claim ABOUT an index;
        // nothing else in these files is measured in KiB.
        if (/^kib$/iu.test(unit)) {
            claims += 1;
            if (unit !== 'KiB') {
                wrong.push(`${where}: "${claim}" — the unit is KiB, spelled exactly`);
            } else if (!measured.has(digits)) {
                wrong.push(`${where}: "${claim}" — neither index measures ${digits} KiB `
                    + `(${[...measured].sort((a, b) => a - b).join(', ')} are)`);
            }
            continue;
        }
        // And an index's size restated in a unit it was not measured in: 49 KB
        // is a tenth of a per cent smaller than 49 KiB and reads as the same
        // claim.
        if (measured.has(digits)) {
            wrong.push(`${where}: "${claim}" — ${digits} is an index's size in KiB, `
                + `stated in ${unit}`);
        }
    }
    return { wrong, claims };
}

describe('the sections these measurements govern state no figure twice (E)', () => {
    const spec = readRepo(SPEC);
    const governed = () => GOVERNED_SECTIONS.map(heading => [heading, sectionUnder(spec, heading)]);

    it('found the sections it is the authority for', () => {
        // A renamed heading must fail loudly rather than sweep an empty string
        // and report the document clean.
        for (const [heading, body] of governed()) {
            expect(body.length, `${SPEC} no longer has "${heading}"`).toBeGreaterThan(400);
        }
    });

    it('accounts for every figure they state, computed or named as prose', () => {
        const { unaccounted, restated, counted } = sweepFigures(governed());
        expect(
            unaccounted,
            `${SPEC} states a figure nothing here measures or claims. Either it is a `
            + 'number the code computes — read it out of the code — or it is prose, and '
            + 'belongs in accountedFigures() with the reason it is prose.'
        ).toEqual([]);
        expect(
            restated,
            'A figure stated twice is a figure that can disagree with itself, and a '
            + 'guard that reads one sentence cannot see the other one.'
        ).toEqual([]);

        // Non-vacuous: the sweep read real numbers out of a real document.
        expect([...counted.values()].reduce((sum, times) => sum + times, 0))
            .toBeGreaterThan(8);
        expect(counted.get('MAX_SAFE_TARGET_WORDS')).toBe(1);
        expect(counted.get('EXTENT_OVERSHOOT_LIMIT')).toBe(1);
    });

    /**
     * THE FAILING INPUTS, CONSTRUCTED — the six evasions, as text.
     *
     * The sweep is only worth its wording if the things that walked past its
     * predecessor trip it, and each is tripped SEPARATELY: a counterexample
     * that violates two clauses proves only that one of the two is doing
     * something. Constructed rather than written into the spec, because the
     * spec is edited elsewhere and a guard that has to vandalise a document to
     * prove itself is a guard nobody will run twice.
     */
    const MEASURED_HERE = new Set(['40', '32', '53', '49']);

    it('sees a second statement of the ceiling in other words', () => {
        const evasion = 'The slider therefore tops out at 120,000 words.';
        expect(sweepFigures([['§10c', evasion]]).unaccounted)
            .toEqual(['§10c states 120,000']);
        // And the figure the section really states passes.
        expect(sweepFigures([['§10c',
            `is **${MAX_SAFE_TARGET_WORDS.toLocaleString('en-US')}**`]]).unaccounted).toEqual([]);
    });

    it('sees the ceiling smuggled in under a different grouping', () => {
        // `replaceAll(',', '')` normalises `10,4,5,29` into the right number,
        // which is why spellings are enumerated rather than stripped.
        expect(sweepFigures([['§10c', 'is **10,4,5,29**']]).unaccounted)
            .toEqual(['§10c states 10,4,5,29']);
        expect(sweepFigures([['§10c', `is ${MAX_SAFE_TARGET_WORDS}`]]).unaccounted).toEqual([]);
    });

    it('sees the overshoot restated in words rather than as a literal', () => {
        // The negation this replaces was written against `1.6 ×`, and "1.6
        // times the ask" is the same claim in a shape it could not match.
        const twice = `\`EXTENT_OVERSHOOT_LIMIT\` is **${EXTENT_OVERSHOOT_LIMIT}**. `
            + `A cut may run to ${EXTENT_OVERSHOOT_LIMIT} times the ask.`;
        const swept = sweepFigures([['§10c', twice]]);
        expect(swept.unaccounted).toEqual([]);
        expect(swept.restated).toEqual(['EXTENT_OVERSHOOT_LIMIT is stated 2 times, accounted 1']);
        // Once is the document as it stands.
        expect(sweepFigures([['§10c', `is **${EXTENT_OVERSHOOT_LIMIT}**`]]).restated).toEqual([]);
    });

    it('sees a catalogue size whose unit is spelled in another case', () => {
        expect(wrongSizeClaims('f', 'the withheld half is 91 kib', MEASURED_HERE).wrong)
            .toEqual(['f: "91 kib" — the unit is KiB, spelled exactly']);
    });

    it('sees a catalogue size stated in KB rather than KiB', () => {
        // Same number, different quantity, and it reads as the same claim.
        expect(wrongSizeClaims('f', 'the withheld half is 49 KB', MEASURED_HERE).wrong)
            .toEqual(['f: "49 KB" — 49 is an index\'s size in KiB, stated in KB']);
        expect(wrongSizeClaims('f', 'the withheld half is 49 KiB', MEASURED_HERE).wrong)
            .toEqual([]);
    });

    it('sees a size that is not a size either index has', () => {
        // The stale `12 KiB` — right unit, right shape, wrong file to have
        // been re-measured in.
        expect(wrongSizeClaims('f', 'about 12 KiB of it', MEASURED_HERE).wrong)
            .toEqual(['f: "12 KiB" — neither index measures 12 KiB (32, 40, 49, 53 are)']);
    });

    it('leaves a byte size that is about something else alone', () => {
        // 82 MB of payload and 627 kB of one work are real claims about other
        // quantities in the same files; a sweep that failed on them would be
        // turned off within a week.
        expect(wrongSizeClaims('f', 'cost this codebase 82 MB, and 627 kB of Walden',
            MEASURED_HERE).wrong).toEqual([]);
    });

    /**
     * THE UNIT SWEEP, over every file that names an index artifact.
     *
     * Two files were read before, and the third claim was in a third file. The
     * set is discovered rather than listed, so a new document that describes
     * the catalogue is swept the day it is written.
     */
    const INDEX_ARTIFACTS = Object.freeze([
        'src/content/archive/division-index.json',
        'src/content/archive/division-index.withheld.json'
    ]);

    /** Canonical LF bytes as committed, and as a bundler embeds it. Rounded down. */
    const measureIndex = (file) => [
        Math.floor(Buffer.byteLength(readRepo(file).replaceAll('\r\n', '\n')) / 1024),
        Math.floor(Buffer.byteLength(JSON.stringify(JSON.parse(readRepo(file)))) / 1024)
    ];

    function documentsNamingAnIndex() {
        const found = [];
        const walk = (directory) => {
            for (const entry of readdirSync(directory, { withFileTypes: true })) {
                const full = join(directory, entry.name);
                if (entry.isDirectory()) {
                    if (['node_modules', 'works', 'dist', 'coverage'].includes(entry.name)) continue;
                    walk(full);
                    continue;
                }
                if (!/\.(?:js|mjs|md)$/u.test(entry.name)) continue;
                // A test is where the history of a figure is discussed —
                // "§7 said 40 and 54 KiB" — so tests are not swept for claims.
                if (/\.(?:test|spec)\.js$/u.test(entry.name)) continue;
                const path = repoPath(full);
                const text = readRepo(path);
                if (INDEX_ARTIFACTS.some(artifact => text.includes(artifact.split('/').pop()))) {
                    found.push(path);
                }
            }
        };
        for (const root of ['src', 'scripts', 'docs']) walk(join(ROOT, root));
        return found;
    }

    it('states no size for either index that is not one of the four measured', () => {
        const measured = new Set(INDEX_ARTIFACTS.flatMap(measureIndex).map(String));
        expect(measured.size, 'the two indexes measure the same four numbers').toBeGreaterThan(2);

        const swept = documentsNamingAnIndex();
        expect(swept.length, 'nothing names an index artifact, so nothing was swept')
            .toBeGreaterThan(4);
        expect(swept, 'the sweep no longer reads the document that states the sizes')
            .toContain(SPEC);
        expect(swept).toContain('scripts/build-division-index.mjs');
        expect(swept, 'the sweep still reads only the two files it used to')
            .toContain('src/content/archive/index.js');

        const wrong = [];
        let claims = 0;
        for (const path of swept) {
            const found = wrongSizeClaims(path, readRepo(path), measured);
            wrong.push(...found.wrong);
            claims += found.claims;
        }
        expect(wrong).toEqual([]);
        expect(claims, 'no file states a catalogue size, so this proved nothing')
            .toBeGreaterThan(4);
    });
});

describe('what refusing an overshoot costs the shelf', () => {
    /** Divisions with no honest boundary within OVERSHOOT_LIMIT of the ask. */
    const refusingAt = (asked) => shelf
        .filter(division => sentenceAlignedPrefix(division.text, asked) === null)
        .map(division => `${division.id}:${asked}`)
        .sort();

    it('leaves Ulysses nearly alone, which is what the comment claims', () => {
        // Named, not counted. A count would go on passing while the two
        // became two others, and the point of the claim is that the policy
        // costs one unusual chapter and one poem rather than a shelf.
        expect(refusingAt(200)).toEqual(['lyrical-ballads#42:200', 'ulysses#18:200']);
        expect(refusingAt(500)).toEqual(['ulysses#18:500']);
        expect(refusingAt(2_000)).toEqual(['ulysses#18:2000']);
    });

    /**
     * THE OTHER HALF OF THE SAME CLAIM: an opening is refused rarely AND never
     * silently overruns when it is granted.
     *
     * What stood here was
     *
     *   expect(opening.words)
     *     .toBeLessThanOrEqual(Math.max(division.words, Math.round(200 * 1.6)))
     *
     * and it cannot fail. For any division longer than 320 words the bound IS
     * `division.words`, an opening is a prefix of that division, and both sides
     * are counted from the same string — so the assertion reads "a prefix is no
     * longer than the text it was cut from". A cutter that returned the whole
     * of Molly Bloom for a 200-word ask satisfied it.
     *
     * The claim worth asserting is the one the gate spends money on: a granted
     * cut is either the whole division, exactly, or an opening inside the
     * overshoot cap — and never a third thing. `EXTENT_OVERSHOOT_LIMIT` is read
     * from the module that governs the cut rather than typed as 1.6, which is
     * the fold-in this file was still carrying a literal against.
     */
    const boundsOfAGrantedCut = (division, asked, opening) => {
        if (opening.boundary === 'whole') {
            // Charged its own length, so it must BE its own length.
            return { words: division.words, isPrefix: true, wholeText: true };
        }
        return {
            atMost: Math.round(asked * EXTENT_OVERSHOOT_LIMIT),
            atLeast: EXTENT_MIN_WORDS,
            shorterThanTheDivision: true,
            isPrefix: true
        };
    };

    /** The assertion, over one cut, so a constructed counterexample can use it. */
    const assertGrantedCut = (division, asked, opening) => {
        const bounds = boundsOfAGrantedCut(division, asked, opening);
        const where = `${division.id}:${asked}`;
        expect(division.text.startsWith(opening.text), `${where} is not a prefix`).toBe(true);
        expect(opening.words, `${where} miscounts its own text`)
            .toBe(countWords(opening.text));
        if (bounds.wholeText) {
            expect(opening.words, `${where} says "whole" and is not`).toBe(bounds.words);
            expect(opening.text, `${where} says "whole" and is not`).toBe(division.text);
            return;
        }
        expect(opening.words, `${where} overran the ${EXTENT_OVERSHOOT_LIMIT}× cap`)
            .toBeLessThanOrEqual(bounds.atMost);
        expect(opening.words, `${where} is a fragment`).toBeGreaterThanOrEqual(bounds.atLeast);
        expect(opening.words, `${where} calls a whole division an opening`)
            .toBeLessThan(division.words);
    };

    it('cut every other division on the shelf at a real boundary', () => {
        let cut = 0;
        for (const division of shelf) {
            const opening = sentenceAlignedPrefix(division.text, 200);
            if (!opening) continue;
            assertGrantedCut(division, 200, opening);
            cut += 1;
        }
        expect(cut).toBe(shelf.length - 2);
    });

    it('would catch a cutter that overran, at every ask the grammar admits', () => {
        // Not one ask. `ulysses#18` refuses at 200 and Molly's first full stop
        // is 5,714 words in, so a cap that gave way only above some ask would
        // have gone unseen while 200 was the only length measured.
        for (const extent of extents) {
            assertGrantedCut(extent.division, extent.asked, {
                text: extent.text, words: extent.words, boundary: extent.boundary
            });
        }
        expect(extents.length).toBeGreaterThan(6_000);
    });

    /**
     * THE FAILING INPUTS, CONSTRUCTED.
     *
     * The guard above is only worth its wording if wrong answers trip it, and
     * each clause has to be tripped SEPARATELY — a counterexample that violates
     * two of them proves only that one of the two is doing something. The old
     * bound is applied to each in turn, and passes all of them, which is the
     * whole finding.
     */
    it('fails on a cut that overran the cap, which the old bound could not see', () => {
        // A real prefix, cut at a real boundary, well short of the division, and
        // 2,000 words for a 200-word ask. Only the overshoot clause can reject
        // it: it is a prefix, it counts its own words, it is not the whole
        // division, and it clears the floor.
        const division = shelf
            .filter(entry => entry.words > 6_000)
            .reduce((longest, entry) => (entry.words > longest.words ? entry : longest));
        const overrun = sentenceAlignedPrefix(division.text, 2_000);
        expect(overrun.boundary).not.toBe('whole');
        expect(overrun.words).toBeGreaterThan(Math.round(200 * EXTENT_OVERSHOOT_LIMIT));
        expect(overrun.words).toBeLessThan(division.words);
        expect(division.text.startsWith(overrun.text)).toBe(true);

        expect(() => assertGrantedCut(division, 200, overrun)).toThrow(/overran/u);
        // And the bound that used to stand here does not trip on it, because for
        // any division longer than the cap that bound IS `division.words`.
        expect(overrun.words)
            .toBeLessThanOrEqual(Math.max(division.words, Math.round(200 * 1.6)));
    });

    it('fails on a whole division presented as an opening', () => {
        const division = shelf.reduce((longest, entry) =>
            (entry.words > longest.words ? entry : longest));
        const wholeDivisionAsAnOpening = {
            text: division.text, words: division.words, boundary: 'sentence'
        };
        expect(() => assertGrantedCut(division, 200, wholeDivisionAsAnOpening))
            .toThrow(/calls a whole division an opening|overran/u);
        expect(wholeDivisionAsAnOpening.words)
            .toBeLessThanOrEqual(Math.max(division.words, Math.round(200 * 1.6)));
    });

    it('fails on a cut that is not a prefix of what it was cut from', () => {
        // A source of the right length holding the wrong words is exactly the
        // failure a word count cannot see.
        const division = shelf[0];
        const notAPrefix = {
            text: `x ${division.text.slice(2)}`,
            words: division.words,
            boundary: 'whole'
        };
        expect(() => assertGrantedCut(division, 200, notAPrefix)).toThrow(/is not a prefix/u);
    });
});
