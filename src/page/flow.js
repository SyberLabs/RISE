/**
 * Flow compiler — Page Mode Layer 1 (PAGE-MODE-SPEC §3.1).
 *
 * Session → ordered blocks before layout. Image↔passage binding uses
 * `cueForAtom` (same as Stream) — one binding, two projections (§8).
 * Pure: no DOM, fetch, or clock.
 */

import { cueForAtom } from '../core/visual-scheduler.js';
import { pageCollectionId } from '../visuals/work-engines.js';

/** Block kinds the compositor understands. */
export const BLOCK = Object.freeze({
    TEXT: 'text',
    IMAGE: 'image',
    /** A glyph or sigil the reading itself authored (a symbol atom). */
    SYMBOL: 'symbol',
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
 * Structural silence (empty marker), not "non-text". Image/symbol/
 * composite atoms are content the Page must carry.
 */
function isStructuralSilence(atom) {
    if (!atom) return true;
    if (atom.modality === 'image') return !(atom.url || atom.content);
    if (atom.modality === 'symbol' || atom.modality === 'composite') {
        return typeof atom.content !== 'string' || atom.content.trim() === '';
    }
    if (atom.modality === 'audio') return true;   // nothing to typeset
    return typeof atom.content !== 'string' || atom.content.trim() === '';
}

/** An atom the Page renders as a figure in its own right. */
function isAuthoredImage(atom) {
    return atom?.modality === 'image' && !!(atom.url || atom.content);
}

/** An atom the Page renders as a standalone mark (a glyph, a sigil). */
function isSymbol(atom) {
    return (atom?.modality === 'symbol' || atom?.modality === 'composite')
        && typeof atom.content === 'string'
        && atom.content.trim() !== '';
}

/**
 * Procedural cues place figures when pagination makes the cost tractable.
 * Unresolved engines yield stillness (§1.5), never a broken frame.
 */
const PROCEDURAL_FIGURES = true;

/**
 * A cue's sourced collections, or [] for stillness. A works-less episode
 * is sanctioned stillness (§5) — it yields no ImagePlacement at all.
 */
function collectionsOf(cue) {
    if (!cue) return [];
    const collections = Array.isArray(cue.collections)
        ? cue.collections.filter(Boolean) : [];
    if (cue.kind === 'sourced') return collections;

    // Authored procedural cues only (unscheduled readings use
    // placeCollectionFigures). Id format: pageCollectionId(family, engine).
    if (cue.kind === 'procedural' && collections.length && PROCEDURAL_FIGURES) {
        const engines = Array.isArray(cue.engines) ? cue.engines.filter(Boolean) : [];
        if (!engines.length) return collections.map(family => pageCollectionId(family));
        // One figure per named engine, per family it belongs to.
        return collections.flatMap(family =>
            engines.map(engine => pageCollectionId(family, engine)));
    }
    return [];
}

/**
 * Min prose characters before derived figures; measured in chars, not
 * blocks (a merged body is one run).
 */
const MIN_PROSE_FOR_FIGURE = 700;
/** Roughly one derived figure per this much prose. */
const PROSE_PER_FIGURE = 1100;
/** Ceiling so a long reading stays a book, not a gallery. */
const MAX_DERIVED_FIGURES = 14;

/**
 * Unscheduled readings with chosen collections: space derived figures
 * evenly by prose volume (modest density; not the attunement compiler).
 *
 * @param {Array} blocks - the compiled flow blocks (mutated: figures inserted)
 * @param {Array<string>} collections - the reading's chosen sources
 */
function placeCollectionFigures(blocks, collections) {
    if (!collections.length) return 0;

    // Walk the text blocks, accumulating prose so figures can be placed at
    // even intervals BY VOLUME rather than by block count.
    const textPoints = [];   // { index, cumulativeChars }
    let total = 0;
    for (let i = 0; i < blocks.length; i++) {
        if (blocks[i].kind !== BLOCK.TEXT) continue;
        total += (blocks[i].text || '').length;
        textPoints.push({ index: i, at: total });
    }
    if (total < MIN_PROSE_FOR_FIGURE || textPoints.length === 0) return 0;

    const budget = Math.max(
        1,
        Math.min(MAX_DERIVED_FIGURES, Math.floor(total / PROSE_PER_FIGURE))
    );

    // Space the figures through the body, each landing on the block
    // boundary nearest its share of the prose. A page opens on prose, so
    // the first figure sits after the first interval, never at the head.
    const points = [];
    for (let n = 1; n <= budget; n++) {
        const target = (total * n) / (budget + 1);
        const spot = textPoints.find(p => p.at >= target) || textPoints[textPoints.length - 1];
        // Insert AFTER that block so the figure follows prose it belongs to.
        const at = spot.index + 1;
        if (!points.includes(at)) points.push(at);
    }

    // Splice from the end so earlier indices stay valid — but decide each
    // figure's weight by its position in DOCUMENT order, so the rhythm
    // reads forwards the way the page does.
    for (let n = points.length - 1; n >= 0; n--) {
        blocks.splice(points[n], 0, {
            kind: BLOCK.IMAGE,
            collections: [...collections],
            episodeId: null,
            // Alternate plate/inset; compositor still applies bleed debt.
            emphasis: n % 2 === 0 ? 'plate' : 'inset',
            at: null,
            derived: true
        });
    }
    return points.length;
}

/**
 * Compile a session into a Flow.
 *
 * @param {Object} session - { atoms, visualProgram, visualConfig }
 * @param {Object} [options]
 *   - includeVerseMarks: stamp verse coordinates on text blocks (default true)
 *   - collections: override the reading's sourced collections
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

        // Authored image: URL known, placed where the author put it.
        if (isAuthoredImage(atom)) {
            flushRun();
            pendingPause = false;
            blocks.push({
                kind: BLOCK.IMAGE,
                // An authored image resolves by URL, never by collection.
                collections: [],
                url: atom.url || atom.content,
                title: typeof atom.name === 'string' ? atom.name : '',
                episodeId: activeCueId,
                emphasis: 'plate',
                at: null
            });
            continue;
        }

        // A SYMBOL/sigil the reading authored — a glyph, not prose and
        // not a figure. It stands alone on its own line.
        if (isSymbol(atom)) {
            flushRun();
            pendingPause = false;
            blocks.push({
                kind: BLOCK.SYMBOL,
                symbol: atom.content.trim(),
                episodeId: activeCueId
            });
            continue;
        }

        const coord = (Number.isInteger(atom.chapter) && Number.isInteger(atom.verse))
            ? { chapter: atom.chapter, verse: atom.verse }
            : null;

        // Placeable in either coordinate space: verse coords or sourceId.
        const placeable = coord || (typeof atom.sourceId === 'string' && atom.sourceId
            ? { sourceId: atom.sourceId }
            : null);

        // A chapter opening is a structural mark (the drop cap moment).
        if (coord && coord.chapter !== lastChapter) {
            flushRun();
            blocks.push({ kind: BLOCK.MARK, mark: MARK.CHAPTER_OPEN, chapter: coord.chapter });
            lastChapter = coord.chapter;
            pendingPause = false;
        }

        // Shared binding with Stream via cueForAtom. Coordinate-less atoms
        // hold the active episode (silence does not change the scene).
        let cueId = activeCueId;
        let cue = null;
        if (program && placeable) {
            const resolved = cueForAtom(program, atom);
            cueId = resolved.id;
            cue = resolved.cue;
        }

        // An episode boundary: close the run, mark the break, and place
        // the incoming episode's imagery at its head.
        if (program && placeable && cueId !== activeCueId) {
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
                    // Scripture readings locate a plate by chapter and
                    // verse; a Journey has neither and does not need one.
                    ...(coord ? { at: { chapter: coord.chapter, verse: coord.verse } } : {})
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

    // Authored programs are never second-guessed; only unscheduled
    // readings fall back to chosen sources.
    let derived = 0;
    if (!program) {
        const chosen = Array.isArray(options.collections)
            ? options.collections.filter(Boolean)
            : sourcedCollectionsOf(session);
        derived = placeCollectionFigures(blocks, chosen);
    }

    return {
        blocks,
        coordinateSpace,
        episodes: episodeCount,
        derivedFigures: derived
    };
}

/**
 * The collections this reading chose, as the panel recorded them. This is
 * the reader's own selection — the Page places it, never picks it.
 */
function sourcedCollectionsOf(session) {
    const visual = session?.visualConfig;
    const clean = (list) => Array.isArray(list)
        ? list.filter(id => typeof id === 'string' && id.length > 0)
        : [];

    // Mode selects imagery; genesis/attractor are sequences, not one still.
    const mode = visual?.visualMode;

    if (mode === 'genesis') return ['genesis'];
    if (mode === 'attractor') return ['attractor'];
    // Focal: shown once at head (focalOf), never placed through the body.
    if (mode === 'focals') return [];

    // Both sourced and procedural families are chosen imagery.
    const interlocution = visual?.interlocution;
    return [...clean(interlocution?.sourced), ...clean(interlocution?.procedural)];
}

/**
 * The focal a reading holds, if any — a glyph, a Chapel icon, or the
 * rose. It is shown ONCE at the head of the page rather than placed
 * through the body: a focal is a thing to rest on, not a series.
 */
export function focalOf(session) {
    const visual = session?.visualConfig;
    if (visual?.visualMode !== 'focals') return null;
    const focals = visual.focals || {};
    return {
        type: focals.type || 'standard',
        glyph: focals.standardGlyph || null,
        iconId: focals.iconId || null,
        image: focals.personalImage || null,
        roseMode: focals.roseMode || null
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
