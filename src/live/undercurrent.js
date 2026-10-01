/**
 * The undercurrent: every Dive the reader has taken, each at one place in the
 * reading, each holding its turns (docs/plans/LIVE-UNDERCURRENT.md).
 *
 * Plain data and nothing else: no timers, no provider, no screen. A Dive is flat
 * (never inside another), has one anchor, and keeps every question asked inside
 * it, with the model's answer as far as it got and how the turn ended. It is
 * bounded, and what it hands out is a frozen copy, so a host that draws it
 * cannot change it.
 *
 * The answers are the model's words. They are kept as text and drawn as text.
 */

export const UNDERCURRENT_LIMITS = Object.freeze({ dives: 50, turns: 20, quote: 120, question: 500, answer: 20_000 });

const STATUSES = Object.freeze(['answering', 'answered', 'cut-short', 'failed']);

const clip = (text, length) => String(text ?? '').slice(0, length);

/**
 * The words at a place in some text: what follows it, cut at a word and marked
 * where it was cut; or, if nothing follows, the last words before it.
 */
export function quoteOf(text, at, max) {
    const whole = String(text ?? '');
    const place = Math.min(Math.max(Number.isFinite(at) ? Math.trunc(at) : 0, 0), whole.length);
    const rest = whole.slice(place).trim();
    if (rest) {
        if (rest.length <= max) return rest;
        const cut = rest.slice(0, max - 1);
        const space = cut.lastIndexOf(' ');
        return `${(space > 0 ? cut.slice(0, space) : cut).trimEnd()}…`;
    }
    const before = whole.slice(0, place).trimEnd();
    if (before.length <= max - 1) return before;
    const tail = before.slice(-(max - 1));
    const space = tail.indexOf(' ');
    return `…${space >= 0 ? tail.slice(space + 1) : tail}`;
}

const freeze = dive => Object.freeze({
    id: dive.id,
    number: dive.number,
    anchor: Object.freeze({ ...dive.anchor }),
    turns: Object.freeze(dive.turns.map(turn => Object.freeze({ ...turn, paragraphs: Object.freeze([...turn.paragraphs]) })))
});

export function createUndercurrent() {
    let dives = [];
    let made = 0;

    const find = id => {
        const dive = dives.find(item => item.id === id);
        if (!dive) throw new RangeError(`There is no Dive ${id}`);
        return dive;
    };

    const turnOf = question => ({ question: clip(question, UNDERCURRENT_LIMITS.question), paragraphs: [], status: 'answering', error: null });

    return {
        /** Open a Dive at a place, with the reader's first question. */
        begin({ segmentId, atCharacter, quote, question }) {
            if (dives.length >= UNDERCURRENT_LIMITS.dives) throw new RangeError(`The undercurrent holds at most ${UNDERCURRENT_LIMITS.dives} Dives`);
            made += 1;
            const id = `dive-${made}`;
            dives.push({ id, number: made, anchor: { segmentId, atCharacter, quote: clip(quote, UNDERCURRENT_LIMITS.quote) }, turns: [turnOf(question)] });
            return { id, turn: 0 };
        },

        /** Another question inside a Dive. Returns its turn number. */
        follow(id, question) {
            const dive = find(id);
            if (dive.turns.length >= UNDERCURRENT_LIMITS.turns) throw new RangeError(`A Dive holds at most ${UNDERCURRENT_LIMITS.turns} questions`);
            dive.turns.push(turnOf(question));
            return dive.turns.length - 1;
        },

        /** What the answer is now, and how the turn stands. */
        update(id, turn, { paragraphs, status, error } = {}) {
            const held = find(id).turns[turn];
            if (!held) throw new RangeError(`Dive ${id} has no question ${turn}`);
            if (status !== undefined && !STATUSES.includes(status)) throw new RangeError(`Unknown status ${status}`);
            if (paragraphs !== undefined) {
                let room = UNDERCURRENT_LIMITS.answer;
                held.paragraphs = [];
                for (const paragraph of paragraphs) {
                    if (room <= 0) break;
                    const kept = clip(paragraph, room);
                    held.paragraphs.push(kept);
                    room -= kept.length;
                }
            }
            if (status !== undefined) held.status = status;
            if (error !== undefined) held.error = error === null ? null : clip(error, 300);
        },

        /** Forget a Dive: one whose first question never opened, so there is nothing of it to keep. */
        drop(id) {
            dives = dives.filter(item => item.id !== id);
        },

        list() {
            return Object.freeze(dives.map(freeze));
        }
    };
}
