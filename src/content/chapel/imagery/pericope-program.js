/**
 * Compile the Gospel pericope concordance into a GENERIC visual
 * program (PERICOPE-IMAGERY-SPEC §6). This module is the ONLY place
 * that knows both the concordance and the Chamber's visual-program
 * contract; downstream, a generic scheduler follows coordinates and
 * the cortex renders cues, neither knowing a pericope exists.
 *
 * The law: content domains author schedules; the runtime follows
 * them; the cortex renders cues.
 */

import { GOSPEL_PERICOPES } from './pericopes.js';

/** A collection id the cortex can resolve, minted per pericope. */
export function pericopeCollectionId(pericopeId) {
    return `chapel-gospel-${pericopeId}`;
}

/**
 * The pericope collections a Gospel chapter needs, as
 * { id → { works: [{source, id}] } }. Only pericopes WITH admitted
 * works appear; empty ones are stillness (no collection). The chapel
 * pinned provider registers these so the cortex can resolve them by
 * id, exactly as it resolves painted collections — the cortex never
 * learns they are pericopes.
 */
export function pericopeCollectionsForChapter(bookId, chapter) {
    const out = {};
    for (const p of GOSPEL_PERICOPES) {
        if (p.works.length === 0) continue;
        if (!p.ranges.some(r => r.book === bookId && r.chapter === chapter)) continue;
        out[pericopeCollectionId(p.id)] = { works: p.works.map(w => ({ ...w })) };
    }
    return out;
}

/**
 * Flatten the (possibly overlapping) pericope ranges intersecting one
 * chapter into a DISJOINT, ordered list of executable segments
 * (spec §6.2). Narrowest-wins: at any verse, the segment is the
 * narrowest pericope range covering it. The concordance is never
 * mutated — only this session schedule is disjoint.
 *
 * @returns {Array<{id, match:{chapter,verseStart,verseEnd}, cue}>}
 */
export function compileChapterSegments(bookId, chapter) {
    // Gather this chapter's ranges, tagged with pericope + span width.
    const ranges = [];
    for (const p of GOSPEL_PERICOPES) {
        for (const r of p.ranges) {
            if (r.book !== bookId || r.chapter !== chapter) continue;
            ranges.push({
                pericope: p,
                verseStart: r.verseStart,
                // Infinity means "to the chapter's end"; cap it for the
                // sweep at a high sentinel so boundaries stay comparable
                verseEnd: r.verseEnd === Infinity ? MAX_VERSE : r.verseEnd,
                span: (r.verseEnd === Infinity ? MAX_VERSE : r.verseEnd) - r.verseStart
            });
        }
    }
    if (ranges.length === 0) return [];

    // The boundaries at which the winning pericope can change: every
    // range start and (end + 1). Sweep verse by verse between them,
    // choosing the narrowest covering range, then coalesce runs of the
    // same winner into one segment.
    const hi = Math.max(...ranges.map(r => r.verseEnd));
    const segments = [];
    let runStart = null;
    let runWinner = null;

    const winnerAt = (v) => {
        let best = null;
        for (const r of ranges) {
            if (v < r.verseStart || v > r.verseEnd) continue;
            if (!best || r.span < best.span) best = r;
        }
        return best ? best.pericope : null;
    };

    for (let v = 1; v <= hi; v++) {
        const w = winnerAt(v);
        if (w === runWinner) continue;
        if (runWinner) {
            segments.push(makeSegment(runWinner, chapter, runStart, v - 1));
        }
        runWinner = w;
        runStart = w ? v : null;
    }
    if (runWinner) segments.push(makeSegment(runWinner, chapter, runStart, hi));

    return segments;
}

const MAX_VERSE = 200; // no Gospel chapter approaches this; a safe cap

function makeSegment(pericope, chapter, verseStart, verseEnd) {
    const hasWorks = pericope.works.length > 0;
    return {
        id: pericope.id,
        match: {
            chapter,
            verseStart,
            // a range that ran to the chapter's end reports Infinity
            // again in the executable form, so a chapter with more
            // verses than the concordance knew still matches
            verseEnd: verseEnd >= MAX_VERSE ? Infinity : verseEnd
        },
        cue: hasWorks
            // a mapped episode with works → activate its collection
            ? { kind: 'sourced', collections: [pericopeCollectionId(pericope.id)] }
            // a mapped episode with NO admitted works → explicit
            // stillness (a GAP the reader is inside, not the fallback):
            // still, per "stillness outranks substitution"
            : { kind: 'still' }
    };
}

/**
 * The complete generic visual program for a Gospel chapter reading,
 * or null when the chapter has no mapped pericopes (the caller then
 * keeps its ordinary chapter/rose/still config). The `fallback` cue
 * governs the unmapped stretches between segments.
 *
 * @param {string} bookId
 * @param {number} chapter
 * @param {Object} fallbackCue - the cue for unmapped verses
 *   (e.g. { kind: 'still' } or { kind: 'focal', focal }).
 * @param {boolean} enabled - false locks the program off (chosen icon)
 */
export function compileVisualProgram(bookId, chapter, fallbackCue, enabled = true) {
    const segments = compileChapterSegments(bookId, chapter);
    if (segments.length === 0) return null;
    return {
        coordinateSpace: 'scripture',
        enabled,
        segments,
        fallback: fallbackCue || { kind: 'still' }
    };
}
