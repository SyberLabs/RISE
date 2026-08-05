/**
 * The Compositor — Page Mode, Layer 2 (PAGE-MODE-SPEC §3.2).
 *
 * Flow → Composition. This is where the typesetting intelligence lives:
 * placement, rhythm, restraint. It is deliberately DOMAIN-AGNOSTIC — it
 * knows blocks, emphasis and aesthetics, never pericopes or verses. And
 * it is renderer-agnostic: the Composition is plain data, so the grid
 * engine (§9) can grow underneath it without a rewrite.
 *
 * Pure: no DOM, no fetch, no clock. Unit-testable with a fake flow.
 */

import { BLOCK, MARK } from './flow.js';

/** How an image sits in the column. */
export const PLACEMENT = Object.freeze({
    /** Edge-to-edge band: the episode's plate. */
    BLEED: 'bleed',
    /** A figure inset in the measure, with caption. */
    INSET: 'inset',
    /** A small plate riding the margin. */
    MARGIN: 'margin'
});

/** Rhythm slots the renderer turns into spacing. */
export const RHYTHM = Object.freeze({
    TIGHT: 'tight',
    NORMAL: 'normal',
    OPEN: 'open',
    /** Deliberate breathing room — a works-less episode's stillness. */
    STILL: 'still'
});

/** A short text run should not be stranded alone under a plate. */
const WIDOW_CHARS = 42;

/**
 * A full-bleed plate must be EARNED by intervening prose. Two plates
 * separated only by a scene change (or a verse or two) would read as a
 * slideshow; a book breathes between its plates. Below this many text
 * blocks since the last bleed, the next plate insets instead.
 */
const BLEED_TEXT_DEBT = 4;

/**
 * A wrapped (margin) figure only earns its place when there is enough
 * prose beside it to actually wrap. A float with one short verse next to
 * it leaves a ragged hole in the column and pushes the figure past the
 * measure — the failure the reader caught. These are the thresholds a
 * human typesetter applies by eye.
 */
const WRAP_MIN_BLOCKS = 3;     // paragraphs that must follow the figure
const WRAP_MIN_CHARS = 340;    // and the prose they must amount to

/**
 * How much uninterrupted prose follows this image block? Only TEXT
 * counts, and only until the next figure or structural break — text
 * after a break belongs to the next scene and cannot wrap this figure.
 */
function proseAfter(blocks, index) {
    let count = 0;
    let chars = 0;
    for (let i = index + 1; i < blocks.length; i++) {
        const b = blocks[i];
        if (b.kind === BLOCK.TEXT) {
            count += 1;
            chars += (b.text || '').length;
            continue;
        }
        if (b.kind === BLOCK.MARK && b.mark === MARK.PAUSE) continue;
        break;   // a figure, a chapter, or an episode break ends the run
    }
    return { count, chars };
}

/**
 * Choose a placement for an image block.
 * `plate` (an episode head) reads full-bleed; anything else insets — and
 * an inset MAY be promoted to a wrapped margin figure when the prose that
 * follows can genuinely flow beside it (decided in compose(), which can
 * see the blocks around it).
 */
function placementFor(block) {
    if (block.emphasis === 'plate') return PLACEMENT.BLEED;
    if (block.emphasis === 'margin') return PLACEMENT.MARGIN;
    return PLACEMENT.INSET;
}

/**
 * Compose a Flow into a Composition.
 *
 * @param {Object} flow - from compileFlow
 * @param {Object} [options]
 *   - maxBleedRun: consecutive bleeds allowed before demoting to inset,
 *     so a dense episode sequence does not become a slideshow (default 1)
 * @returns {{ items: Array, stats: Object }}
 */

/**
 * Does this paragraph read as a HEADING rather than as prose?
 *
 * Many public-domain editions carry their structure inline: Vitruvius
 * has "CHAPTER I" and "THE EDUCATION OF THE ARCHITECT" as ordinary
 * paragraphs, indistinguishable from the sentences around them once the
 * text is atomised. The flow has no chapter mark to raise, so the
 * compositor was setting them at prose rhythm and they arrived crammed
 * between two paragraphs with nothing to breathe.
 *
 * The test is deliberately narrow, because a false positive puts a gulf
 * in the middle of a sentence: short, no lowercase letters at all, and
 * not punctuated as a sentence. "CHAPTER I" passes. "I HAVE DRAWN UP
 * DEFINITE RULES." does not, because of the full stop; a shouted line
 * of prose stays prose.
 */
function readsAsHeading(text) {
    const t = String(text || '').trim();
    if (!t || t.length > 64) return false;
    if (/[a-z]/.test(t)) return false;
    if (!/[A-Z]/.test(t)) return false;          // numerals or marks alone are not headings
    if (/[.!?,;:]$/.test(t)) return false;       // a sentence, merely shouted

    // AND NOT AN APPARATUS FRAGMENT. Public-domain scans carry the
    // editorial apparatus inline — marginalia, sigla, footnote tails —
    // and it arrives as short all-caps scraps with orphaned brackets:
    // "ATHENS]", "ROME]", "Giocondo, Venice, 1511)]". Split one per
    // atom, "ATHENS]" is indistinguishable from a heading by every test
    // above, and Vitruvius Book I duly grew three of them.
    //
    // A heading does not carry a bracket. This does not repair the text
    // — those fragments should not be in a reading at all, which is a
    // separate matter for the text audit — but it stops the compositor
    // from promoting damage into structure.
    if (/[[\]()]/.test(t)) return false;
    // Nor a bare siglum or numeral. A heading has at least one WORD in
    // it; "IV" and "A" are references, and a Roman numeral alone is how
    // a scan labels a plate.
    if (!/[A-Z]{3}/.test(t)) return false;
    return true;
}

/**
 * Is the block at `from` the continuation of a heading — i.e. does a
 * heading follow immediately, with nothing but marks between?
 */
function headingRunAhead(blocks, from) {
    const next = blocks[from];
    if (!next) return false;
    if (next.kind === BLOCK.MARK && next.mark === MARK.CHAPTER_OPEN) return true;
    if (next.kind === BLOCK.TEXT && readsAsHeading(next.text)) return true;
    return false;
}

export function compose(flow, options = {}) {
    const blocks = Array.isArray(flow?.blocks) ? flow.blocks : [];
    const maxBleedRun = Number.isFinite(options.maxBleedRun) ? options.maxBleedRun : 1;

    const items = [];
    let bleedRun = 0;
    let sinceImageText = 0;   // text blocks since the last image
    let stillPending = false; // an episode break with no image followed
    let wrapSide = 'left';    // alternates, so wrapped figures read as a spread
    let held = null;          // a figure waiting for a title to finish

    const push = (item) => items.push(item);

    // A figure held out of a title is emitted the moment the title is
    // complete: directly beneath it, centred on the full measure.
    const releaseHeld = () => {
        if (!held) return;
        push({
            type: 'figure',
            collections: held.collections,
            url: held.url,
            title: held.title,
            derived: held.derived,
            episodeId: held.episodeId,
            placement: PLACEMENT.INSET,
            wrapBlocks: 0,
            side: null,
            at: held.at,
            rhythm: RHYTHM.OPEN
        });
        held = null;
    };

    for (let i = 0; i < blocks.length; i++) {
        const block = blocks[i];

        if (block.kind === BLOCK.MARK) {
            if (block.mark === MARK.CHAPTER_OPEN) {
                push({
                    type: 'chapter',
                    chapter: block.chapter,
                    rhythm: RHYTHM.OPEN
                });
                bleedRun = 0;
                releaseHeld();
                continue;
            }
            if (block.mark === MARK.EPISODE_BREAK) {
                // A scene change. If the next block is NOT an image, this
                // episode is stillness and earns deliberate space (§3.2).
                const next = blocks[i + 1];
                const isStill = !next || next.kind !== BLOCK.IMAGE;
                push({
                    type: 'break',
                    episodeId: block.episodeId,
                    rhythm: isStill ? RHYTHM.STILL : RHYTHM.OPEN
                });
                stillPending = isStill;
                // NOTE: a scene change does NOT reset the bleed debt. Only
                // prose earns the next full-bleed plate (BLEED_TEXT_DEBT).
                continue;
            }
            if (block.mark === MARK.PAUSE) {
                // Collapse a pause that lands next to a stronger break.
                const prev = items[items.length - 1];
                if (prev && (prev.type === 'break' || prev.type === 'chapter' || prev.type === 'figure')) continue;
                push({ type: 'pause', rhythm: RHYTHM.NORMAL });
                continue;
            }
            continue;
        }

        // A symbol the reading authored: a glyph standing on its own,
        // neither prose nor figure. It reads as a mark in the column.
        if (block.kind === BLOCK.SYMBOL) {
            push({
                type: 'symbol',
                symbol: block.symbol,
                episodeId: block.episodeId ?? null,
                rhythm: RHYTHM.OPEN
            });
            bleedRun = 0;
            stillPending = false;
            continue;
        }

        if (block.kind === BLOCK.IMAGE) {
            let placement = placementFor(block);
            // Restraint: a bleed is earned by intervening prose, not by a
            // scene change alone. Without this, a chapter of short
            // episodes (Matthew 27's seven Passion pericopes) would render
            // as seven stacked full-bleed plates — a reel, not a book.
            if (placement === PLACEMENT.BLEED) {
                // "First" means no PROSE has run yet — not an empty
                // composition. A real chapter opens with its numeral, so
                // testing items.length silently demoted every opening
                // plate (the chapter mark alone made it look owed).
                const noProseYet = !items.some(it => it.type === 'text');
                const earned = noProseYet || sinceImageText >= BLEED_TEXT_DEBT;
                if (!earned || bleedRun >= maxBleedRun) placement = PLACEMENT.INSET;
                else bleedRun += 1;
            } else {
                bleedRun = 0;
            }

            // Promote an inset to a WRAPPED margin figure only when real
            // prose follows it — enough paragraphs, and enough of them, to
            // flow down its side. Otherwise the float strands itself with
            // a ragged hole beside it. `wrapBlocks` tells the renderer how
            // many following paragraphs share the figure's band, so the
            // wrap can be scoped instead of leaking down the whole column.
            let wrapBlocks = 0;
            if (placement === PLACEMENT.INSET) {
                const prose = proseAfter(blocks, i);
                if (prose.count >= WRAP_MIN_BLOCKS && prose.chars >= WRAP_MIN_CHARS) {
                    placement = PLACEMENT.MARGIN;
                    // Give the float ALL the prose of its scene, so the
                    // text reliably outlasts the image's height instead of
                    // running out beside it and leaving a ragged hole.
                    wrapBlocks = prose.count;
                }
            }

            // ── A FIGURE BESIDE A TITLE DOES NOT WRAP ──
            //
            // Book practice: a heading is a symmetrical object on the
            // page, and the space beneath it belongs to it. A figure
            // floated into that space turns the opening into a
            // shop-window — the Vitruvius page where a wrapped plate sat
            // level with CHAPTER I and pushed "THE EDUCATION OF THE
            // ARCHITECT" into two lines is exactly the fault.
            //
            // Adjacent to a heading, a figure becomes a CENTRED plate on
            // the full measure. It keeps the symmetry the heading
            // establishes instead of competing with it.
            const lastItem = items[items.length - 1];
            const nextBlock = blocks[i + 1];
            const nearAHeading =
                (lastItem && (lastItem.type === 'chapter'
                    || (lastItem.type === 'text' && lastItem.heading === true)))
                || (nextBlock && nextBlock.kind === BLOCK.MARK
                    && nextBlock.mark === MARK.CHAPTER_OPEN)
                || (nextBlock && nextBlock.kind === BLOCK.TEXT
                    && readsAsHeading(nextBlock.text));
            if (nearAHeading && placement === PLACEMENT.MARGIN) {
                placement = PLACEMENT.INSET;
                wrapBlocks = 0;
            }

            // ── NOTHING STANDS INSIDE A TITLE ──
            //
            // "CHAPTER I" and "THE EDUCATION OF THE ARCHITECT" are two
            // blocks and one heading. A figure cued between them lands
            // in the middle of a title — centred or not, it separates a
            // chapter number from the chapter's name, which no book
            // does. The heading group is atomic; the figure waits and
            // is emitted directly beneath it.
            //
            // This DOES move a figure, which R5 was refused for. The
            // difference is what it moves across: R5 slid a plate past
            // PROSE, to a passage that did not summon it. This moves it
            // past the remaining half of a heading — the same juncture,
            // the same passage, on the far side of a title rather than
            // inside one. The binding is unchanged; only the title is
            // left whole.
            if (headingRunAhead(blocks, i + 1)) {
                held = {
                    collections: block.collections,
                    url: block.url || null,
                    title: block.title || '',
                    derived: block.derived === true,
                    episodeId: block.episodeId,
                    at: block.at || null
                };
                sinceImageText = 0;
                stillPending = false;
                continue;
            }

            push({
                type: 'figure',
                collections: block.collections,
                // An authored image carries its own URL and needs no
                // collection resolution at all.
                url: block.url || null,
                title: block.title || '',
                derived: block.derived === true,
                episodeId: block.episodeId,
                placement,
                wrapBlocks,
                // Alternate the side so a chapter of wrapped figures reads
                // as a spread, not a right-hand gutter.
                side: placement === PLACEMENT.MARGIN
                    ? (wrapSide = wrapSide === 'right' ? 'left' : 'right')
                    : null,
                at: block.at || null,
                rhythm: RHYTHM.OPEN
            });
            sinceImageText = 0;
            stillPending = false;
            continue;
        }

        if (block.kind === BLOCK.TEXT) {
            const prev = items[items.length - 1];
            // Widow restraint: a very short run directly under a figure
            // is pulled tight to it rather than left floating alone.
            const tightToFigure = prev
                && prev.type === 'figure'
                && block.text.length < WIDOW_CHARS;
            push({
                type: 'text',
                text: block.text,
                // Editions that carry their structure inline get the air a
                // heading earns, even though the flow had no mark to raise.
                heading: readsAsHeading(block.text),
                chapter: block.chapter ?? null,
                verse: block.verse ?? null,
                weight: block.weight ?? 0,
                tags: block.tags || [],
                episodeId: block.episodeId ?? null,
                rhythm: tightToFigure ? RHYTHM.TIGHT
                    : stillPending ? RHYTHM.STILL
                        : RHYTHM.NORMAL
            });
            // A title is complete when a heading block is not followed by
            // another; only then may a held figure appear beneath it.
            if (readsAsHeading(block.text) && !headingRunAhead(blocks, i + 1)) {
                releaseHeld();
            }
            stillPending = false;
            // Prose pays down the bleed debt: enough of it re-earns a
            // full-bleed plate, and clears the consecutive-bleed run.
            sinceImageText += 1;
            if (sinceImageText >= BLEED_TEXT_DEBT) bleedRun = 0;
            continue;
        }
    }

    // Trim leading/trailing rhythm-only items — a page never opens or
    // closes on empty space.
    while (items.length && items[0].type !== 'text' && items[0].type !== 'figure' && items[0].type !== 'chapter') {
        items.shift();
    }
    while (items.length) {
        const last = items[items.length - 1];
        if (last.type === 'text' || last.type === 'figure') break;
        items.pop();
    }

    releaseHeld();

    return {
        items,
        stats: {
            text: items.filter(i => i.type === 'text').length,
            figures: items.filter(i => i.type === 'figure').length,
            bleeds: items.filter(i => i.type === 'figure' && i.placement === PLACEMENT.BLEED).length,
            breaks: items.filter(i => i.type === 'break').length
        }
    };
}
