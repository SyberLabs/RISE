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
 * Is this atom structural silence (a pause/marker) rather than content?
 * The chunker mints marker atoms with empty content and a tag.
 *
 * NOTE: this asks about SILENCE, not about text. A non-text atom is
 * content the Page must carry, not something to drop — treating every
 * modality but text as silence is what once discarded image, symbol,
 * and composite atoms from the spatial projection while the Stream
 * played them (red-team #5).
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
 * DEFERRED UNTIL THE PAGE PAGINATES (PAGE-MODE-SPEC v4).
 *
 * The machinery is built and tested — `pageCollectionId` above,
 * `sampleWorkEngine` in work-engines.js, and the Chamber's resolver —
 * and turning it on is this one line. It is off because of what the
 * Page currently IS rather than anything wrong with it.
 *
 * §199 and §250 of the spec: "v1 scrolls; pagination is v4". A Journey
 * is 23,000 words, so its page is one continuous column of some 2,800
 * atoms, and adding a sampled engine still at every figure adds render
 * cost to a document that is already the largest thing this projection
 * has been asked to typeset. Pagination is what makes that tractable —
 * it divides the reading into bounded units, and a bounded unit can
 * afford its own imagery.
 *
 * Until then a Journey's procedural movements typeset as text, which
 * §1.5 names explicitly: "an unillustrated passage is a valid scored
 * state." The Homeric movement's museum works are unaffected — they are
 * ordinary images on the ordinary path, and they arrive now that the
 * source coordinate space is read at all.
 */
const PROCEDURAL_FIGURES = false;

/**
 * A cue's sourced collections, or [] for stillness. A works-less episode
 * is sanctioned stillness (§5) — it yields no ImagePlacement at all.
 */
function collectionsOf(cue) {
    if (!cue) return [];
    const collections = Array.isArray(cue.collections)
        ? cue.collections.filter(Boolean) : [];
    if (cue.kind === 'sourced') return collections;

    // A PROCEDURAL CUE PLACES A FIGURE TOO — ON THE AUTHORED PATH.
    //
    // Worth being exact about the scope, because it is narrower than it
    // looks. An UNSCHEDULED reading never reaches here: compileFlow
    // sends it to placeCollectionFigures with its chosen collections,
    // which is why an ordinary Chamber session has always been able to
    // put Genesis and the attractor on a page. Only a reading with an
    // authored program comes through this function, and that program is
    // "never second-guessed" — so the fallback is deliberately skipped.
    //
    // Which made this Journey-specific. The Chapel's pericope cues are
    // all `sourced`, so `kind !== 'sourced'` was true of nothing that
    // existed until Journeys introduced procedural cues. The result was
    // that the one kind of reading whose imagery is most deliberately
    // placed got no figures at all, while a session that chose the same
    // engines from the orbital got them.
    //
    // The SHAPE is still the one this codebase keeps paying for: a
    // vocabulary that learned `sourced` and never learned the other
    // word, silent when it failed. applyCue and the gallery allowlist
    // were the same, and were also introduced by the same work.
    //
    // A figure names its own engine, so the id carries both. The format
    // belongs to work-engines.js and is written by nobody else.
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
 * Prose CHARACTERS below which a derived figure would overwhelm the page.
 * Measured in characters, not blocks: a coordinate-less reading merges
 * its whole body into one run, so counting blocks would see "1" for a
 * novel and place nothing.
 */
const MIN_PROSE_FOR_FIGURE = 700;
/**
 * Roughly one derived figure per this much prose. Tuned against real
 * chunker output so an ILLUMINATED reader actually feels illuminated: at
 * ~1100 chars a short reading earns one or two plates and a long one is
 * illustrated throughout, while the ceiling still keeps it a book rather
 * than a gallery wall. (The first pass used 2400, which gave a
 * thirty-paragraph reading a single figure — too austere to read as
 * illustrated at all.)
 */
const PROSE_PER_FIGURE = 1100;
/** A ceiling so a very long reading stays a book, not a gallery wall. */
const MAX_DERIVED_FIGURES = 14;

/**
 * A reading with NO authored program but WITH chosen collections still
 * deserves its imagery: the reader picked those sources, and the Stream
 * would draw from them. Without this, a Gospel chapter typeset with
 * plates while an Atrium or Library reading with the very same
 * collections rendered as a bare column (red-team #5).
 *
 * The placement rule is deliberately modest, and deliberately NOT the
 * attunement compiler (TEXT-ATTUNED-IMAGERY-SPEC), which will supersede
 * it with real segmentation and scoring: figures are spaced evenly
 * through the prose on a density budget, so a long reading breathes and
 * a short one is not swamped. Restraint is the default — a book, not a
 * feed.
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
            // Derived figures VARY in weight rather than all whispering.
            // Hardcoding every one to 'inset' meant a derived page could
            // never show a full plate, only small inline figures — timid,
            // and visibly poorer than an authored page. The first asks to
            // be a plate and they alternate from there; the compositor
            // still has final say, and its bleed-debt rule stops stacking.
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

        // An AUTHORED image: the reading supplied this work itself, so it
        // needs no collection and no provider — its URL is already known.
        // It is placed exactly where the author put it in the stream.
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

        // TWO COORDINATE SPACES, AND THIS FILE KNEW ONE.
        //
        // Every consultation of the program below was gated on `coord`,
        // which is chapter-and-verse — so a Journey, whose atoms carry a
        // sourceId and no verse, never reached cueForAtom at all. Not one
        // authored cue was read; the page fell through to the end of the
        // loop with `program` set, which also skips the unscheduled
        // fallback. That is why a Journey's page came out as bare text
        // while an ordinary session's did not.
        //
        // cueForAtom already understands both spaces — it is the same
        // oracle the Stream asks, and it was answering correctly. The
        // question was never put to it.
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

        // THE SHARED BINDING: ask the same oracle the Stream asks.
        // A coordinate-less atom holds the active episode (structural
        // silence never changes the scene — the scheduler's own law).
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

    // A reading whose imagery was AUTHORED (a pericope program) is never
    // second-guessed: the domain already said where every plate belongs.
    // Only an unscheduled reading falls back to its own chosen sources.
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

    // The reading's MODE decides what its imagery is. Reading only
    // `interlocution` made a Genesis or attractor reading fall through to
    // whatever happened to sit in interlocution.procedural — which is why
    // both rendered fractal flame instead of themselves.
    const mode = visual?.visualMode;

    // A PERSISTENT FIELD is dynamic, so a single still would misrepresent
    // it. Its honest translation into a spatial medium is a SEQUENCE:
    // the same system sampled at successive states, the last being its
    // settled form. The cortex renders those samples; the compositor
    // places them like any other figures.
    if (mode === 'genesis') return ['genesis'];
    if (mode === 'attractor') return ['attractor'];
    // A focal is a single held glyph, not a series — it is shown once at
    // the head of the page (see focalOf), never placed through the body.
    if (mode === 'focals') return [];

    // PROCEDURAL families count as chosen imagery too. A reading set to
    // fractal or Klee selected its visuals just as deliberately as one
    // that picked a museum collection — reading only `sourced` made the
    // Page silently blank for every procedural reader. The cortex renders
    // these as stills; the Page places them like any other figure.
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
