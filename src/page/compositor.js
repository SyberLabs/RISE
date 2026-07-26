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
 * Choose a placement for an image block.
 * `plate` (an episode head) reads full-bleed; anything else insets.
 * A margin plate is reserved for low-emphasis marks, kept for the grid
 * engine to exploit later.
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
export function compose(flow, options = {}) {
    const blocks = Array.isArray(flow?.blocks) ? flow.blocks : [];
    const maxBleedRun = Number.isFinite(options.maxBleedRun) ? options.maxBleedRun : 1;

    const items = [];
    let bleedRun = 0;
    let sinceImageText = 0;   // text blocks since the last image
    let stillPending = false; // an episode break with no image followed

    const push = (item) => items.push(item);

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

        if (block.kind === BLOCK.IMAGE) {
            let placement = placementFor(block);
            // Restraint: a bleed is earned by intervening prose, not by a
            // scene change alone. Without this, a chapter of short
            // episodes (Matthew 27's seven Passion pericopes) would render
            // as seven stacked full-bleed plates — a reel, not a book.
            if (placement === PLACEMENT.BLEED) {
                const earned = items.length === 0 || sinceImageText >= BLEED_TEXT_DEBT;
                if (!earned || bleedRun >= maxBleedRun) placement = PLACEMENT.INSET;
                else bleedRun += 1;
            } else {
                bleedRun = 0;
            }
            push({
                type: 'figure',
                collections: block.collections,
                episodeId: block.episodeId,
                placement,
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
                chapter: block.chapter ?? null,
                verse: block.verse ?? null,
                weight: block.weight ?? 0,
                tags: block.tags || [],
                episodeId: block.episodeId ?? null,
                rhythm: tightToFigure ? RHYTHM.TIGHT
                    : stillPending ? RHYTHM.STILL
                        : RHYTHM.NORMAL
            });
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
