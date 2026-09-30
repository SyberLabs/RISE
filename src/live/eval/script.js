/**
 * The fixed answer, cut for each way of presenting it.
 *
 * Every condition gives the same words, the same sources and the same side
 * answer at the same place. Only the medium differs. This is the one place
 * that says what "the same" means, so the presenters cannot drift apart.
 */

import { BLACK_HOLES } from '../fixtures/black-holes.js';
import { INTERRUPTION_AFTER, SIDE_ANSWER, SIDE_QUESTION } from './study.js';

export const PROMPT = 'Explain black holes with RISE.';

/** What is said about a source, in a sentence. */
export const cite = evidence => `${evidence.title}${evidence.location ? `, ${evidence.location}` : ''}`;

/**
 * The answer as an ordered list of parts: passages, the sources of a passage,
 * and the side answer where it belongs.
 *
 * @returns {Array<{kind: 'passage'|'source'|'side-question'|'side-answer'|'return', id: string, text: string}>}
 */
export function scriptParts() {
    const parts = [];
    for (const segment of BLACK_HOLES.segments) {
        parts.push({ kind: 'passage', id: segment.id, text: segment.text });
        for (const evidence of segment.evidence ?? []) parts.push({ kind: 'source', id: evidence.id, text: cite(evidence) });
        if (segment.id === INTERRUPTION_AFTER) {
            parts.push({ kind: 'side-question', id: 'side-question', text: SIDE_QUESTION });
            for (const side of SIDE_ANSWER.segments) parts.push({ kind: 'side-answer', id: side.id, text: side.text });
            parts.push({ kind: 'return', id: 'return', text: 'That was the side answer. The main answer carries on.' });
        }
    }
    return parts;
}

/** What a voice is asked to say, in order, for the spoken conditions. */
export function spokenLines() {
    return scriptParts().map(part => {
        if (part.kind === 'source') return { ...part, text: `Source: ${part.text}.` };
        if (part.kind === 'side-question') return { ...part, text: 'A side question was asked about the event horizon.' };
        return part;
    });
}
