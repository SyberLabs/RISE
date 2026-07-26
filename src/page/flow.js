/**
 * The Flow compiler — Page Mode, Layer 1 (PAGE-MODE-SPEC §3.1).
 *
 * Turns a compiled session (atoms + visualProgram) into an ordered list
 * of BLOCKS: the "story" in InDesign's sense, before any layout decision
 * is made. This is the only Page stage that knows what a verse or a
 * pericope *means*.
 *
 * THE BINDING TRUTH IS SHARED. Image↔passage binding comes from
 * `cueForAtom` — the same function the Stream's scheduler uses — so the
 * Page and the Stream can never disagree about which work belongs to
 * which passage. One binding, two projections (§8).
 *
 * Pure: no DOM, no fetch, no clock. Unit-testable with fake atoms.
 */

import { cueForAtom } from '../core/visual-scheduler.js';

/** Block kinds the compositor understands. */
export const BLOCK = Object.freeze({
    TEXT: 'text',
    IMAGE: 'image',
    MARK: 'mark'
});

/** Structural mark kinds. */
export const MARK = Object.freeze({
    CHAPTER_OPEN: 'chapter-open',
    EPISODE_BREAK: 'episode-break',
    PAUSE: 'pause'
});

const FALLBACK_CUE_ID = '__fallback__';

/**
 * Is this atom structural silence (a pause/marker) rather than reading
 * text? The chunker mints marker atoms with empty content and a tag.
 */
function isStructuralSilence(atom) {
    return !atom
        || atom.modality !== 'text'
        || typeof atom.content !== 'string'
        || atom.content.trim() === '';
}

/**
 * A cue's sourced collections, or [] for stillness. A works-less episode
 * is sanctioned stillness (§5) — it yields no ImagePlacement at all.
 */
function collectionsOf(cue) {
    if (!cue || cue.kind !== 'sourced') return [];
    return Array.isArray(cue.collections) ? cue.collections.filter(Boolean) : [];
}

/**
 * Compile a session into a Flow.
 *
 * @param {Object} session - { atoms, visualProgram }
 * @param {Object} [options]
 *   - includeVerseMarks: stamp verse coordinates on text blocks (default true)
 * @returns {{ blocks: Array, coordinateSpace: string|null, episodes: number }}
 */
export function compileFlow(session, options = {}) {
    const atoms = Array.isArray(session?.atoms) ? session.atoms : [];
    const program = session?.visualProgram || null;
    const coordinateSpace = program?.coordinateSpace || null;
    const includeVerseMarks = options.includeVerseMarks !== false;

    const blocks = [];
    let activeCueId = null;       // the episode currently in force
    let episodeCount = 0;
    let lastChapter = null;
    let pendingPause = false;

    // A run accumulates consecutive text atoms sharing one coordinate,
    // so a verse reads as one typeset paragraph rather than word confetti.
    let run = null;

    const flushRun = () => {
        if (!run) return;
        const text = run.parts.join(' ').replace(/\s+/g, ' ').trim();
        if (text) {
            blocks.push({
                kind: BLOCK.TEXT,
                text,
                chapter: run.chapter,
                verse: run.verse,
                weight: run.weightMax,
                tags: run.tags.length ? [...new Set(run.tags)] : [],
                episodeId: run.episodeId
            });
        }
        run = null;
    };

    for (const atom of atoms) {
        // Structural silence closes the current run and may mark a pause.
        if (isStructuralSilence(atom)) {
            flushRun();
            pendingPause = true;
            continue;
        }

        const coord = (Number.isInteger(atom.chapter) && Number.isInteger(atom.verse))
            ? { chapter: atom.chapter, verse: atom.verse }
            : null;

        // A chapter opening is a structural mark (the drop cap moment).
        if (coord && coord.chapter !== lastChapter) {
            flushRun();
            blocks.push({ kind: BLOCK.MARK, mark: MARK.CHAPTER_OPEN, chapter: coord.chapter });
            lastChapter = coord.chapter;
            pendingPause = false;
        }

        // THE SHARED BINDING: ask the same oracle the Stream asks.
        // A coordinate-less atom holds the active episode (structural
        // silence never changes the scene — the scheduler's own law).
        let cueId = activeCueId;
        let cue = null;
        if (program && coord) {
            const resolved = cueForAtom(program, atom);
            cueId = resolved.id;
            cue = resolved.cue;
        }

        // An episode boundary: close the run, mark the break, and place
        // the incoming episode's imagery at its head.
        if (program && coord && cueId !== activeCueId) {
            flushRun();
            if (activeCueId !== null) {
                blocks.push({ kind: BLOCK.MARK, mark: MARK.EPISODE_BREAK, episodeId: cueId });
            }
            const collections = collectionsOf(cue);
            if (collections.length) {
                blocks.push({
                    kind: BLOCK.IMAGE,
                    collections,
                    episodeId: cueId,
                    // The head of an episode is its plate: the strongest
                    // placement. The compositor decides what that means.
                    emphasis: cueId === FALLBACK_CUE_ID ? 'inset' : 'plate',
                    at: { chapter: coord.chapter, verse: coord.verse }
                });
            }
            // A works-less episode yields NO image block — stillness,
            // never a substitute (§5).
            activeCueId = cueId;
            episodeCount += 1;
            pendingPause = false;
        }

        if (pendingPause) {
            // Only mark a pause between real text, never at the very top.
            if (blocks.length) blocks.push({ kind: BLOCK.MARK, mark: MARK.PAUSE });
            pendingPause = false;
        }

        // Start or extend the current run. A new verse starts a new run
        // so each verse becomes its own typeset unit.
        const sameCoord = run
            && run.chapter === (coord?.chapter ?? null)
            && run.verse === (coord?.verse ?? null);
        if (!sameCoord) {
            flushRun();
            run = {
                parts: [],
                chapter: includeVerseMarks ? (coord?.chapter ?? null) : null,
                verse: includeVerseMarks ? (coord?.verse ?? null) : null,
                weightMax: 0,
                tags: [],
                episodeId: activeCueId
            };
        }
        run.parts.push(atom.content.trim());
        if (Number.isFinite(atom.weight)) run.weightMax = Math.max(run.weightMax, atom.weight);
        if (Array.isArray(atom.tags) && atom.tags.length) run.tags.push(...atom.tags);
    }

    flushRun();

    return {
        blocks,
        coordinateSpace,
        episodes: episodeCount
    };
}

/**
 * The distinct collections a flow references, in first-appearance order.
 * The renderer uses this to warm pools before scrolling begins.
 */
export function flowCollections(flow) {
    const seen = [];
    for (const block of flow?.blocks || []) {
        if (block.kind !== BLOCK.IMAGE) continue;
        for (const id of block.collections) {
            if (!seen.includes(id)) seen.push(id);
        }
    }
    return seen;
}
