/**
 * Chunker awareness — the study harness.
 *
 * Two hypotheses, measured before either is built:
 *
 *   LITERARY AWARENESS — that works differ enough in prose shape for a
 *   per-work chunking profile to be worth having, and that the
 *   differences are derivable from the text rather than hand-declared.
 *
 *   LINGUISTIC AWARENESS — that the chunker's remaining defects are
 *   grammatical rather than metric, and specifically that a subject is
 *   being cut from its predicate by an interrupting clause:
 *
 *       "I, who have seen things, believe that seeing is believing."
 *        ^^                       the chunker stops here
 *
 * Nothing here proposes a change. Reproduce with `npm run study:awareness`.
 */

import { ingestedArchiveTexts } from '../src/content/archive/index.js';
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

/** A deliberately wide sample: verse, drama, aphorism, and four prose centuries. */
const SAMPLE = [
    ['paradise-lost', 'verse'],
    ['literary-poems-dickinson', 'verse'],
    ['hamlet', 'drama'],
    ['literary-meditations', 'aphorism'],
    ['literary-walden', 'essay'],
    ['pride-and-prejudice', 'prose'],
    ['moby-dick-or-the-whale', 'prose'],
    ['the-brothers-karamazov', 'prose'],
    ['mrs-dalloway', 'modernist'],
    ['swann-s-way', 'modernist'],
    ['ulysses', 'modernist'],
    ['the-storm-of-steel', 'modern']
];

const CHARS_PER_WORK = 120_000;
const RELATIVE = /^(who|which|that|whom|whose|where|when)\b/i;

const words = s => s.trim().split(/\s+/).filter(Boolean).length;
const mean = a => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0);
const quantile = (sorted, q) => sorted.length
    ? sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * q))] : 0;

function sentenceLengths(text) {
    return text
        .split(/(?<=[.!?])[\s"'”’)\]]+/)
        .map(words)
        .filter(n => n > 0);
}

/**
 * The defect, counted at the atom level.
 *
 * An atom that ends on a comma whose SUCCESSOR opens with a relative
 * pronoun is a subject cut from the clause that qualifies it. Counting
 * it this way needs no parser and no part-of-speech tags — it is a
 * property of the atom boundary itself, which is the thing under test.
 */
function strandedSubjects(atoms) {
    let short = 0;
    let long = 0;
    for (let i = 0; i < atoms.length - 1; i += 1) {
        const here = atoms[i].trim();
        if (!here.endsWith(',')) continue;
        if (!RELATIVE.test(atoms[i + 1].trim())) continue;
        // Split by whether a word floor could have rescued it. A floor
        // merges a piece only while the piece is BELOW the floor, so a
        // subject long enough to clear it survives as its own atom.
        if (words(here) < 5) short += 1; else long += 1;
    }
    return { short, long, total: short + long };
}

function profile(text) {
    const lengths = sentenceLengths(text);
    const sorted = [...lengths].sort((a, b) => a - b);
    const avg = mean(lengths);
    const sd = Math.sqrt(mean(lengths.map(n => (n - avg) ** 2)));
    const totalWords = words(text);
    const newlines = (text.match(/\n/g) || []).length;
    const count = ch => (text.split(ch).length - 1);

    return {
        words: totalWords,
        sentences: lengths.length,
        medianSentence: quantile(sorted, 0.5),
        p95Sentence: quantile(sorted, 0.95),
        maxSentence: sorted.at(-1) || 0,
        // Dispersion, NOT a multifractal analysis — a proxy for how
        // unevenly a writer distributes sentence length.
        dispersion: avg ? sd / avg : 0,
        burst: quantile(sorted, 0.5) ? quantile(sorted, 0.95) / quantile(sorted, 0.5) : 0,
        commas: (count(',') / totalWords) * 100,
        semicolons: (count(';') / totalWords) * 100,
        // Verse prints many lines per sentence; prose wraps.
        linesPerSentence: lengths.length ? newlines / lengths.length : 0
    };
}

function chunkMetrics(text, phraseFloor) {
    const atoms = chunkText(text, { mode: 'phrase', wpm: 200, phraseFloor })
        .map(a => a.content)
        .filter(c => c && c.trim());
    const lengths = atoms.map(words);
    const sorted = [...lengths].sort((a, b) => a - b);
    let stutter = 0;
    let run = 0;
    for (const n of lengths) {
        if (n <= 3) { run += 1; if (run === 3) stutter += 1; } else run = 0;
    }
    return {
        atoms: atoms.length,
        median: quantile(sorted, 0.5),
        fragments: (lengths.filter(n => n <= 2).length / atoms.length) * 100,
        stutter,
        stranded: strandedSubjects(atoms)
    };
}

const pct = n => `${n.toFixed(1)}%`;
const pad = (v, n) => String(v).padStart(n);

const works = ingestedArchiveTexts();
const rows = [];

for (const [id, genre] of SAMPLE) {
    const work = works.find(w => w.id === id);
    if (!work) { console.warn(`missing: ${id}`); continue; }
    const divisions = await work.getDivisions();
    const entries = divisions?.entries || [];
    // Skip the front matter entry: it is a table of contents, not prose.
    let text = entries.slice(1).map(e => e.content || '').join('\n\n');
    if (!text.trim()) text = entries.map(e => e.content || '').join('\n\n');
    text = text.slice(0, CHARS_PER_WORK);

    rows.push({
        id, genre,
        p: profile(text),
        off: chunkMetrics(text, false),
        on: chunkMetrics(text, true)
    });
}

console.log('\n=== LITERARY SHAPE (is a per-work profile justified?) ===\n');
console.log('work                 genre      medS  p95S  maxS  disp burst  com%  semi%  ln/sent');
for (const r of rows) {
    const p = r.p;
    console.log(
        `${r.id.slice(0, 20).padEnd(20)} ${r.genre.padEnd(10)}`
        + ` ${pad(p.medianSentence, 4)} ${pad(p.p95Sentence, 5)} ${pad(p.maxSentence, 5)}`
        + ` ${pad(p.dispersion.toFixed(2), 5)} ${pad(p.burst.toFixed(1), 5)}`
        + ` ${pad(p.commas.toFixed(1), 5)} ${pad(p.semicolons.toFixed(2), 6)}`
        + ` ${pad(p.linesPerSentence.toFixed(1), 8)}`
    );
}

console.log('\n=== CHUNKER OUTCOME, phrase mode, floor off → on ===\n');
console.log('work                 atoms off→on    median  frag off→on      stutter off→on');
for (const r of rows) {
    console.log(
        `${r.id.slice(0, 20).padEnd(20)} ${pad(r.off.atoms, 5)}→${pad(r.on.atoms, 5)}`
        + `    ${pad(r.off.median, 2)}→${pad(r.on.median, 2)}`
        + `   ${pad(pct(r.off.fragments), 6)}→${pad(pct(r.on.fragments), 6)}`
        + `     ${pad(r.off.stutter, 5)}→${pad(r.on.stutter, 5)}`
    );
}

console.log('\n=== THE INTERRUPTED SUBJECT (subject cut from its predicate) ===\n');
console.log('An atom ending on a comma whose successor opens with a relative');
console.log('pronoun. "short" = subject under the 5-word floor, so a floor can');
console.log('rescue it. "long" = subject clears the floor, so no floor can.\n');
console.log('work                 floor off          floor on           rescued  survives');
let totalShortOff = 0, totalLongOff = 0, totalShortOn = 0, totalLongOn = 0;
for (const r of rows) {
    const o = r.off.stranded;
    const n = r.on.stranded;
    totalShortOff += o.short; totalLongOff += o.long;
    totalShortOn += n.short; totalLongOn += n.long;
    console.log(
        `${r.id.slice(0, 20).padEnd(20)} ${pad(o.total, 4)} (${pad(o.short, 3)}s/${pad(o.long, 3)}l)`
        + `   ${pad(n.total, 4)} (${pad(n.short, 3)}s/${pad(n.long, 3)}l)`
        + `   ${pad(o.total - n.total, 6)}  ${pad(n.total, 8)}`
    );
}
console.log(`\nTOTAL  floor off: ${totalShortOff + totalLongOff}`
    + ` (${totalShortOff} short, ${totalLongOff} long)`);
console.log(`       floor on : ${totalShortOn + totalLongOn}`
    + ` (${totalShortOn} short, ${totalLongOn} long)`);

console.log('\n=== WORKED EXAMPLE ===\n');
const specimen = 'I, who have seen things, believe that seeing is believing.';
const long = 'The philosopher and teacher Socrates, who taught Plato in Athens, '
    + 'spoke of the examined life.';
for (const [label, text] of [['short subject', specimen], ['long subject', long]]) {
    console.log(`${label}: ${text}`);
    for (const floor of [false, true]) {
        const atoms = chunkText(text, { mode: 'phrase', wpm: 200, phraseFloor: floor })
            .map(a => a.content);
        console.log(`  floor ${floor ? 'on ' : 'off'} → ${JSON.stringify(atoms)}`);
    }
    console.log('');
}
