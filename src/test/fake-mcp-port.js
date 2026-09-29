/**
 * A host's model, as far as the MCP adapter can tell: it hands the app a
 * Current, and when asked for a Dive it answers, with the reference it was
 * given, after a delay on a clock the test owns.
 */
import { HORIZON_DIVE } from '../live/fixtures/black-holes.js';
import { BLACK_HOLES_CURRENT, toSealedCurrent } from './sealed-current.js';

export function createFakeMcpPort({ clock, answerAfterMs = 200, answers = {}, dive = toSealedCurrent(HORIZON_DIVE, 'dive-answer') } = {}) {
    const listeners = new Set();
    const buffered = [];
    const messages = [];
    const deliver = item => {
        if (listeners.size === 0) { buffered.push(item); return; }
        for (const listener of [...listeners]) if (listener(item) === true) return;
    };
    return {
        messages,
        listeners,
        answers,
        deliver,
        /** The host's model calls the tool: an answer, after `ms`. */
        answer(current = BLACK_HOLES_CURRENT, ms = answerAfterMs) {
            clock.setTimer(() => deliver({ current, replyTo: undefined }), ms);
        },
        onCurrent(listener) {
            listeners.add(listener);
            for (const item of buffered.splice(0)) if (listener(item) === true) break;
            return () => listeners.delete(listener);
        },
        async sendMessage(text) {
            messages.push(text);
            const reference = /replyTo "([^"]+)"/u.exec(text)?.[1];
            if (reference && answers.silent !== true) {
                clock.setTimer(() => deliver({ current: answers.current ?? dive, replyTo: answers.replyTo ?? reference }), answerAfterMs);
            }
        }
    };
}
