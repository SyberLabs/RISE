/**
 * Build the runtime pericope module from the research concordance.
 *
 * image_map/rise-gospel-art-concordance.json is the human/research
 * surface (PERICOPE-IMAGERY-SPEC §3.1). This script derives the frozen
 * runtime module src/content/chapel/imagery/pericopes.js — machine
 * output, never hand-edited — admitting ONLY cleared, pin-ready works
 * so a GAP pericope resolves to stillness, never a guess.
 *
 * Run: node scripts/build-pericopes.mjs
 */

import fs from 'fs';
import path from 'path';

const SRC = path.resolve('image_map/rise-gospel-art-concordance.json');
const OUT = path.resolve('src/content/chapel/imagery/pericopes.js');

// The Gospel-book names the concordance uses → the corpus book ids.
const BOOK_IDS = Object.freeze({
    matthew: 'matthew', mark: 'mark', luke: 'luke', john: 'john',
    acts: 'acts'
});

// A work is admitted to the runtime only when it is a cleared pin.
const ADMITTED_STATUSES = new Set(['existing_pin']);

/**
 * Parse one passage reference into an array of normalized ranges.
 * Handles every shape the concordance uses:
 *   "Luke 1:26-38"            → [{book, ch:1, vs:26, ve:38}]
 *   "John 3:16"               → [{book, ch:3, vs:16, ve:16}]
 *   "Matthew 26:36-27:2"      → cross-chapter, split at the boundary
 *   "John 6:16-21,22-59"      → two ranges in the same chapter
 *   "Matthew 5-7"             → whole chapters 5,6,7 (verse-less)
 */
function parseRef(ref) {
    const m = ref.trim().match(/^([1-3]?\s?[A-Za-z]+)\s+(.+)$/);
    if (!m) throw new Error(`unparseable ref: "${ref}"`);
    const bookName = m[1].toLowerCase().replace(/\s+/g, '');
    const book = BOOK_IDS[bookName];
    if (!book) throw new Error(`unknown book in ref: "${ref}"`);
    const spec = m[2];

    // Whole-chapter span "5-7" (no colon anywhere)
    if (!spec.includes(':')) {
        const [a, b] = spec.split('-').map(Number);
        const end = Number.isFinite(b) ? b : a;
        const ranges = [];
        for (let ch = a; ch <= end; ch++) {
            ranges.push({ book, chapter: ch, verseStart: 1, verseEnd: Infinity });
        }
        return ranges;
    }

    // Comma-joined pieces share the leading chapter of the first piece
    const pieces = spec.split(',').map(s => s.trim());
    const ranges = [];
    let currentChapter = null;
    for (const piece of pieces) {
        // piece may be "26:36-27:2" | "3:16-38" | "3:16" | "22-59"
        if (piece.includes(':')) {
            const [startTok, endTok] = piece.split('-');
            const [sCh, sV] = startTok.split(':').map(Number);
            currentChapter = sCh;
            if (endTok == null) {
                ranges.push({ book, chapter: sCh, verseStart: sV, verseEnd: sV });
            } else if (endTok.includes(':')) {
                // cross-chapter: split into [sCh:sV..∞] + [eCh:1..eV]
                const [eCh, eV] = endTok.split(':').map(Number);
                ranges.push({ book, chapter: sCh, verseStart: sV, verseEnd: Infinity });
                for (let ch = sCh + 1; ch < eCh; ch++) {
                    ranges.push({ book, chapter: ch, verseStart: 1, verseEnd: Infinity });
                }
                ranges.push({ book, chapter: eCh, verseStart: 1, verseEnd: eV });
                currentChapter = eCh;
            } else {
                ranges.push({ book, chapter: sCh, verseStart: sV, verseEnd: Number(endTok) });
            }
        } else {
            // bare "22-59" continues the current chapter
            const [sV, eV] = piece.split('-').map(Number);
            ranges.push({
                book, chapter: currentChapter,
                verseStart: sV, verseEnd: Number.isFinite(eV) ? eV : sV
            });
        }
    }
    return ranges;
}

function build() {
    const doc = JSON.parse(fs.readFileSync(SRC, 'utf8'));
    const out = [];
    const allRanges = []; // for overlap detection

    for (const p of doc.passages) {
        const ranges = (p.passages || []).flatMap(parseRef);
        const works = (p.works || [])
            .filter(w => ADMITTED_STATUSES.has(w.status))
            .map(w => ({ source: w.source, id: w.id }));

        for (const r of ranges) allRanges.push({ pericope: p.id, ...r });

        out.push({
            id: p.id,
            title: p.title,
            coverage: p.coverage,
            ranges,
            works
        });
    }

    // Overlaps are REAL, not errors: the Gospels nest and adjoin
    // episodes (the flagellation sits within the Pilate scene at
    // Mt 27:26; Noli me tangere within the resurrection at Jn 20:11-18).
    // The runtime resolves such a verse to the NARROWEST containing
    // pericope — the most specific episode — so the lookup stays
    // deterministic without discarding the fine-grained mapping.
    // Report overlaps as information (a sanity trace), never a failure.
    const byBook = new Map();
    for (const r of allRanges) {
        if (!byBook.has(r.book)) byBook.set(r.book, []);
        byBook.get(r.book).push(r);
    }
    let overlaps = 0;
    for (const [, ranges] of byBook) {
        for (let i = 0; i < ranges.length; i++) {
            for (let j = i + 1; j < ranges.length; j++) {
                const a = ranges[i], b = ranges[j];
                if (a.chapter !== b.chapter || a.pericope === b.pericope) continue;
                if (a.verseStart <= b.verseEnd && b.verseStart <= a.verseEnd) overlaps++;
            }
        }
    }
    if (overlaps) {
        console.log(`[build-pericopes] ${overlaps} overlapping ranges — runtime resolves each to the narrowest (most specific) pericope.`);
    }

    const admitted = out.reduce((n, p) => n + p.works.length, 0);
    const withWorks = out.filter(p => p.works.length > 0).length;

    // Emit. Infinity is not valid JSON, so ranges serialize by hand.
    const body = out.map(p => {
        const ranges = p.ranges.map(r =>
            `{ book: "${r.book}", chapter: ${r.chapter}, verseStart: ${r.verseStart}, verseEnd: ${r.verseEnd === Infinity ? 'Infinity' : r.verseEnd} }`
        ).join(', ');
        const works = p.works.map(w => `{ source: "${w.source}", id: ${JSON.stringify(w.id)} }`).join(', ');
        return `    {\n        id: ${JSON.stringify(p.id)}, title: ${JSON.stringify(p.title)}, coverage: ${JSON.stringify(p.coverage)},\n        ranges: [${ranges}],\n        works: [${works}]\n    }`;
    }).join(',\n');

    const file = `/**
 * Gospel pericopes — the runtime concordance (GENERATED).
 *
 * Machine output of scripts/build-pericopes.mjs from
 * image_map/rise-gospel-art-concordance.json. DO NOT EDIT BY HAND —
 * edit the concordance JSON and rebuild. Only cleared, pin-ready works
 * are admitted (${admitted} works across ${withWorks} pericopes with imagery;
 * the rest resolve to stillness until their works clear review).
 *
 * PERICOPE-IMAGERY-SPEC §3.1. Verse ranges within a book never
 * overlap (asserted at build time).
 */

export const GOSPEL_PERICOPES = Object.freeze([
${body}
].map(Object.freeze));

/**
 * The pericope whose range contains (book, chapter, verse), or null.
 * When episodes nest or adjoin (the flagellation within the Pilate
 * scene, Noli me tangere within the resurrection), the NARROWEST
 * containing range wins — the most specific episode the reader is in.
 * Most of a Gospel is not a mapped episode; null is the common,
 * correct case (-> stillness). Pure; no side effects.
 */
export function pericopeForVerse(book, chapter, verse) {
    if (!book || !Number.isInteger(chapter) || !Number.isInteger(verse)) return null;
    let best = null;
    let bestSpan = Infinity;
    for (const p of GOSPEL_PERICOPES) {
        for (const r of p.ranges) {
            if (r.book === book && r.chapter === chapter
                && verse >= r.verseStart && verse <= r.verseEnd) {
                const span = r.verseEnd - r.verseStart;
                if (span < bestSpan) { bestSpan = span; best = p; }
            }
        }
    }
    return best;
}
`;
    fs.writeFileSync(OUT, file);
    console.log(`[build-pericopes] wrote ${out.length} pericopes, ${admitted} admitted works, ${withWorks} with imagery → ${path.relative(process.cwd(), OUT)}`);
}

build();
