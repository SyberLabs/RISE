/**
 * Phrase-mode chunking study — MEASUREMENT ONLY.
 *
 * This script changes nothing. It exists to establish what phrase mode
 * actually does to real prose before anyone proposes a fix, because the
 * obvious hypothesis was already wrong once: the complaint is that
 * clauses get chopped ("yada yada, and"), which sounds like connectives
 * being stranded at the END of an atom. Measuring showed zero of those —
 * a connective lands at the HEAD of the next atom instead, and the
 * visible defect is something else entirely.
 *
 * So: report the distribution, name the patterns, and let the numbers
 * choose the experiment.
 *
 * WHAT IT MEASURES, AND WHY EACH
 * ──────────────────────────────
 * Phrase mode splits after , ; : — – | and after a sentence period
 * (chunker.js splitPhrases). It has a CEILING — splitLongChunk breaks
 * anything over MAX_CHUNK_WORDS — but no FLOOR. Nothing ever merges a
 * short piece into its neighbour. That asymmetry is the structural
 * suspicion this study is built to confirm or refute:
 *
 *   1. FRAGMENTS      atoms of 1–2 words. A whole screen for "then,".
 *   2. ORPHAN HEADS   atoms BEGINNING with a connective (and, but,
 *                     which, that…). The clause was severed from what
 *                     it modifies; the reader meets the join first.
 *   3. DANGLING TAILS atoms ENDING with a connective. The complaint's
 *                     literal shape — measured to see if it happens.
 *   4. DURATION FLOOR atoms whose computed duration is so short the
 *                     text cannot be read before it is replaced.
 *
 * WHY THERE IS NOW A SECOND CORPUS, AND A FLOOR SWEEP.
 *
 * This study was written before the floor existed and never updated. It
 * reads LITERARY_DEEP and the Vault — and ALL THIRTY LITERARY_DEEP
 * sequences contain `|`, exactly like the Vault. `applyPhraseFloor`
 * returns early on any paragraph containing a pipe, so the floor cannot
 * fire on either corpus. Running with the floor on and with the floor
 * off produced byte-identical output: 658 atoms, 118 fragments, median
 * 4, 30 stutter runs, both ways.
 *
 * The study's stated CONTROL was therefore the same condition as its
 * experimental group, and it concluded from that comparison that a floor
 * cannot be applied unconditionally. Meanwhile chunker.js carried a
 * comment asserting that "floors of 4/5/6 all clear fragments and
 * stutter runs completely" against Book VI, Iliad XXII and Guillemont —
 * three texts no script in this repository has ever measured.
 *
 * So: the ARCHIVE corpus below is pipe-free prose, which is what an
 * actual reader opens from the Library, and the FLOOR SWEEP runs it at
 * floors 0/4/5/6 so the constant can be defended or changed by a number
 * rather than by a sentence. The pipe fraction of every corpus is now
 * printed, so this collapse cannot recur silently.
 *
 * Run:  npm run study:chunking
 *       npm run study:chunking -- --json
 *       npm run study:chunking -- --examples 40
 */

import { LITERARY_DEEP } from '../src/sources/text/data/literary_deep.js';
import { ingestedArchiveTexts } from '../src/content/archive/index.js';
import { VAULT_A_SEQUENCES } from '../src/content/personalized/vault-a.js';
import { chunkText } from '../src/core/chunker.js';
import { installContentPlaneFetch } from './lib/content-plane-fetch.mjs';
// A Node process has no origin, so `/content/...` is not a URL it can fetch.
// Installed at the entry rather than inside the store: the store fetches a URL
// and checks the bytes against the digest that URL names, and teaching it about
// a filesystem would give the corpus a second code path where the point of this
// seam is that there is one. `_fetch` is read at call time, so installing after
// ESM has hoisted every import is in time — provided no import did the reading
// itself. See release-voice-evidence.mjs for the one that did.
installContentPlaneFetch();

const argv = process.argv.slice(2);
const json = argv.includes('--json');
const exampleCount = (() => {
    const i = argv.indexOf('--examples');
    return i >= 0 ? Number(argv[i + 1]) || 20 : 20;
})();

// Connectives and relativisers: words that JOIN. A phrase that begins
// with one has been cut from what it attaches to; a phrase that ends
// with one is left hanging. Kept deliberately small and uncontroversial
// — this is a measurement, not a grammar.
const CONNECTIVES = new Set([
    'and', 'but', 'or', 'nor', 'yet', 'so', 'for',
    'which', 'that', 'who', 'whom', 'whose',
    'because', 'although', 'though', 'while', 'whereas',
    'if', 'when', 'where', 'since', 'unless', 'until',
    'as', 'than', 'nor', 'not'
]);

const FRAGMENT_WORDS = 2;
const WPM = 250;

const words = s => s.split(/\s+/).filter(Boolean);
const bare = s => s.toLowerCase().replace(/^[^\p{L}]+|[^\p{L}]+$/gu, '');

function collectAtoms() {
    const rows = [];
    for (const [workId, work] of Object.entries(LITERARY_DEEP)) {
        for (const seq of work.sequences || []) {
            const text = seq.content || seq.text || '';
            if (!text.trim()) continue;
            // The REAL chunker, at the real default pace — a study that
            // reimplements the thing it studies measures nothing.
            const atoms = chunkText(text, { mode: 'phrase', wpm: WPM });
            for (const atom of atoms) {
                if (atom.modality !== 'text') continue;
                const content = (atom.content || '').trim();
                if (!content) continue;          // markers carry no text
                rows.push({
                    work: workId,
                    author: work.author,
                    seq: seq.id,
                    content,
                    words: words(content).length,
                    duration: atom.duration,
                    tags: atom.tags || []
                });
            }
        }
    }
    return rows;
}

const atoms = collectAtoms();

// The CONTROL. Vault sequences carry hand-placed `|` boundaries, so
// their short atoms are authored breath, not a splitter artefact. If the
// metrics below cannot tell this corpus from the Literary one, they are
// measuring punctuation rather than readability — which is exactly what
// the study found, and why a floor cannot be applied unconditionally.
function collectAuthored() {
    const rows = [];
    for (const seq of VAULT_A_SEQUENCES) {
        const produced = chunkText(seq.content, { mode: 'phrase', wpm: seq.wpm || WPM });
        for (const atom of produced) {
            if (atom.modality !== 'text') continue;
            const content = (atom.content || '').trim();
            if (content) rows.push({ content, words: words(content).length });
        }
    }
    return rows;
}

/**
 * THE CORPUS THE FLOOR ACTUALLY GOVERNS.
 *
 * Pipe-free prose from the ingested Archive — the text a reader opens
 * from the Library, where no author has marked their own phrasing and
 * the splitter is therefore the only thing deciding breath units.
 */
const ARCHIVE_SAMPLE = [
    'literary-walden', 'pride-and-prejudice', 'moby-dick-or-the-whale',
    'the-brothers-karamazov', 'literary-meditations', 'the-storm-of-steel'
];
const CHARS_PER_WORK = 60_000;

async function collectArchive() {
    const rows = [];
    const shelf = ingestedArchiveTexts();
    for (const id of ARCHIVE_SAMPLE) {
        const work = shelf.find(text => text.id === id);
        if (!work) continue;
        const divisions = await work.getDivisions();
        let budget = CHARS_PER_WORK;
        for (const entry of divisions.entries) {
            if (budget <= 0) break;
            const text = (entry.content || '').slice(0, budget);
            if (!text.trim()) continue;
            budget -= text.length;
            rows.push({ id, text });
        }
    }
    return rows;
}

/** Fraction of a corpus the floor cannot touch, because a pipe is present. */
const pipeFraction = texts => texts.filter(t => t.includes('|')).length / (texts.length || 1);

/** Run one corpus at one floor and report what a reader would meet. */
function sweepOnce(rows, floorOpts) {
    const lengths = [];
    let fragments = 0, runs = 0, run = 0;
    for (const { text } of rows) {
        for (const atom of chunkText(text, { mode: 'phrase', wpm: WPM, ...floorOpts })) {
            if (atom.modality !== 'text') continue;
            const content = (atom.content || '').trim();
            if (!content) continue;
            const n = words(content).length;
            lengths.push(n);
            if (n <= FRAGMENT_WORDS) fragments += 1;
            if (n <= 3) run += 1; else { if (run >= 3) runs += 1; run = 0; }
        }
    }
    if (run >= 3) runs += 1;
    const sorted = [...lengths].sort((a, b) => a - b);
    return {
        atoms: lengths.length,
        fragments,
        fragmentPct: lengths.length ? 100 * fragments / lengths.length : 0,
        median: sorted[Math.floor(sorted.length / 2)] || 0,
        stutterRuns: runs
    };
}

const archive = await collectArchive();

const fragments = atoms.filter(a => a.words <= FRAGMENT_WORDS);
const orphanHeads = atoms.filter(a => CONNECTIVES.has(bare(words(a.content)[0] || '')));
const danglingTails = atoms.filter(a => {
    const w = words(a.content);
    return w.length > 1 && CONNECTIVES.has(bare(w[w.length - 1]));
});
// Below this a reader cannot finish the words before the atom is gone.
// 250wpm is 240ms/word; two words in under 400ms is not reading.
const tooFast = atoms.filter(a => a.duration < a.words * 200);

const histogram = {};
for (const a of atoms) {
    const bucket = a.words <= 2 ? a.words : a.words <= 4 ? '3-4'
        : a.words <= 8 ? '5-8' : a.words <= 12 ? '9-12'
            : a.words <= 16 ? '13-16' : '17+';
    histogram[bucket] = (histogram[bucket] || 0) + 1;
}

const pct = n => `${(100 * n / atoms.length).toFixed(1)}%`;

if (json) {
    console.log(JSON.stringify({
        atoms: atoms.length,
        works: new Set(atoms.map(a => a.work)).size,
        histogram,
        fragments: fragments.length,
        orphanHeads: orphanHeads.length,
        danglingTails: danglingTails.length,
        tooFast: tooFast.length,
        examples: {
            fragments: fragments.slice(0, exampleCount).map(a => a.content),
            orphanHeads: orphanHeads.slice(0, exampleCount).map(a => a.content),
            danglingTails: danglingTails.slice(0, exampleCount).map(a => a.content)
        }
    }, null, 2));
} else {
    console.log(`\nPHRASE-MODE CHUNKING STUDY`);
    console.log(`${atoms.length} text atoms from ${new Set(atoms.map(a => a.work)).size} works (${WPM} wpm)\n`);

    console.log('LENGTH DISTRIBUTION');
    for (const bucket of ['1', '2', '3-4', '5-8', '9-12', '13-16', '17+']) {
        const n = histogram[bucket] || 0;
        if (!n) continue;
        const bar = '█'.repeat(Math.max(1, Math.round(60 * n / atoms.length)));
        console.log(`  ${String(bucket).padStart(5)} words  ${String(n).padStart(4)}  ${pct(n).padStart(6)}  ${bar}`);
    }

    console.log(`\nPATTERNS`);
    console.log(`  fragments (≤${FRAGMENT_WORDS} words)      ${String(fragments.length).padStart(4)}  ${pct(fragments.length)}`);
    console.log(`  orphan heads (begins w/ join) ${String(orphanHeads.length).padStart(4)}  ${pct(orphanHeads.length)}`);
    console.log(`  dangling tails (ends w/ join) ${String(danglingTails.length).padStart(4)}  ${pct(danglingTails.length)}`);
    console.log(`  below reading speed           ${String(tooFast.length).padStart(4)}  ${pct(tooFast.length)}`);

    const show = (label, list) => {
        if (!list.length) { console.log(`\n${label}: none`); return; }
        console.log(`\n${label} (${list.length}, showing ${Math.min(exampleCount, list.length)}):`);
        for (const a of list.slice(0, exampleCount)) {
            console.log(`  ${String(a.duration + 'ms').padStart(7)}  ${JSON.stringify(a.content)}   — ${a.author}`);
        }
    };
    // ── FLOOR SWEEP ────────────────────────────────────────────────
    // The measurement chunker.js's PHRASE_FLOOR_WORDS comment claims to
    // rest on. Run it before changing that constant, and paste the table
    // into the comment rather than a sentence.
    if (archive.length) {
        const texts = archive.map(r => r.text);
        console.log(`\nFLOOR SWEEP — pipe-free Archive prose (${archive.length} divisions, ${(100 * pipeFraction(texts)).toFixed(1)}% contain a pipe)`);
        console.log('  floor    atoms  fragments        median  stutter runs');
        // Sweep past both edges of the flat region, or the table cannot
        // show that 4/5/6 are the same answer.
        const rows = [
            ['off', { phraseFloor: false }],
            ['2', { phraseFloor: 2 }],
            ['4', { phraseFloor: 4 }],
            ['5 (shipped)', { phraseFloor: 5 }],
            ['6', { phraseFloor: 6 }],
            ['8', { phraseFloor: 8 }],
            ['12', { phraseFloor: 12 }]
        ];
        for (const [label, opts] of rows) {
            const r = sweepOnce(archive, opts);
            console.log(`  ${label.padEnd(12)}${String(r.atoms).padStart(5)}   ${String(r.fragments).padStart(4)} (${r.fragmentPct.toFixed(1)}%)`
                + `${String(r.median).padStart(9)}${String(r.stutterRuns).padStart(14)}`);
        }
    }

    const authored = collectAuthored();
    const authoredFrags = authored.filter(a => a.words <= FRAGMENT_WORDS).length;
    console.log(`
CONTROL — authored \`|\` boundaries (Vault, ${authored.length} atoms)`);
    console.log(`  fragments  ${String(authoredFrags).padStart(4)}  ${(100 * authoredFrags / authored.length).toFixed(1)}%`);
    console.log('  These are DELIBERATE breath units, not defects. A floor that');
    console.log('  merged them would destroy the authored phrasing — which is why');
    console.log('  boundary provenance must come before any merge rule.');
    const litTexts = [];
    for (const work of Object.values(LITERARY_DEEP)) {
        for (const seq of work.sequences || []) litTexts.push(seq.content || seq.text || '');
    }
    console.log(`\n  NOTE: the LITERARY corpus above is ${(100 * pipeFraction(litTexts)).toFixed(0)}% pipe-authored too, so the`);
    console.log('  floor never fires on it either. The two are the SAME condition.');
    console.log('  Read the FLOOR SWEEP for the floor; read this for the splitter.');

    show('FRAGMENTS', fragments);
    show('ORPHAN HEADS', orphanHeads);
    show('DANGLING TAILS', danglingTails);

    // The reader's experience is a SEQUENCE, so show the worst runs:
    // consecutive short atoms are where the reading actually stutters.
    const runs = [];
    let run = [];
    for (const a of atoms) {
        if (a.words <= 3) run.push(a);
        else { if (run.length >= 3) runs.push(run); run = []; }
    }
    if (run.length >= 3) runs.push(run);
    runs.sort((a, b) => b.length - a.length);
    if (runs.length) {
        console.log(`\nSTUTTER RUNS (3+ consecutive atoms of ≤3 words) — ${runs.length} found:`);
        for (const r of runs.slice(0, 8)) {
            console.log(`  ${r.length} atoms · ${r[0].author}: ${r.map(a => JSON.stringify(a.content)).join(' → ')}`);
        }
    }
}
