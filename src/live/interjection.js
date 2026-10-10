/**
 * The interjection: the reader speaks while the reading plays, and RISE answers inside the room (the RISE Live design,
 * docs/superpowers/specs/2026-10-09-rise-live-design.md §6.1; docs/plans/LIVE-CURRENT.md §17).
 *
 *   none ──begin──▶ held ──ask──▶ asking ──answer──▶ answering ──end──▶ none
 *                    └─cancel─▶ none   └─cancel, fail─▶ none   └─fail─▶ none
 *
 * Pure. The runtime steps it (runtime.js) and shows it in its snapshot; an event a state does not take changes nothing.
 * An answer already playing is not cancelled: it is part of the reading, under the reader's controls.
 */

/** How the held reading goes on, as the model names it (`@then …`, segment-parser.js). */
export const INTERJECTION_ENDINGS = Object.freeze(['resume', 'replace', 'end']);

const MOVES = Object.freeze({
    none: Object.freeze({ begin: 'held' }),
    held: Object.freeze({ ask: 'asking', cancel: 'none' }),
    asking: Object.freeze({ answer: 'answering', cancel: 'none', fail: 'none' }),
    answering: Object.freeze({ end: 'none', fail: 'none' })
});

/**
 * @param {'none'|'held'|'asking'|'answering'} state
 * @param {{type: 'begin'|'ask'|'answer'|'end'|'cancel'|'fail'}} event
 * @returns {'none'|'held'|'asking'|'answering'}
 */
export function interjectionStep(state, event) {
    const from = Object.hasOwn(MOVES, state) ? state : 'none';
    const type = event?.type;
    return typeof type === 'string' && Object.hasOwn(MOVES[from], type) ? MOVES[from][type] : from;
}

/** The ending the model named, or `resume` when it named none it may. */
export function endingOf(named) {
    return INTERJECTION_ENDINGS.includes(named) ? named : 'resume';
}
