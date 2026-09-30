/**
 * A host's model, as far as the MCP adapter can tell: it hands the app a
 * Current, and when asked a question for a Dive it answers with the words of
 * one, after a delay on a clock the test owns.
 *
 * `answers` shapes the reply to a Dive: `silent` (never), `refuse` (the host
 * says no), `text` (these words instead of a Current), `current` (this Current).
 */
import { HORIZON_DIVE } from '../live/fixtures/black-holes.js';
import { BLACK_HOLES_CURRENT, toSealedCurrent } from './sealed-current.js';

export function createFakeMcpPort({ clock, answerAfterMs = 200, answers = {}, sampling = true, dive = toSealedCurrent(HORIZON_DIVE, 'dive-answer') } = {}) {
    const listeners = new Set();
    const buffered = [];
    const asked = [];
    const deliver = item => {
        if (listeners.size === 0) { buffered.push(item); return; }
        for (const listener of [...listeners]) if (listener(item) === true) return;
    };
    return {
        asked,
        listeners,
        answers,
        deliver,
        /** The host's model calls the tool: an answer, after `ms`. */
        answer(current = BLACK_HOLES_CURRENT, ms = answerAfterMs) {
            clock.setTimer(() => deliver({ current }), ms);
        },
        onCurrent(listener) {
            listeners.add(listener);
            for (const item of buffered.splice(0)) if (listener(item) === true) break;
            return () => listeners.delete(listener);
        },
        canSample: () => sampling,
        async complete(question) {
            asked.push(question);
            if (answers.refuse) throw new Error('the reader said no');
            if (answers.silent === true) return new Promise(() => {});
            await clock.sleep(answerAfterMs);
            return answers.text ?? JSON.stringify(answers.current ?? dive);
        }
    };
}
