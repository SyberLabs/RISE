/**
 * What a reader said, as what they meant the Current to do.
 *
 * A closed, deterministic grammar and nothing cleverer. The words come from a
 * speech recogniser, so they are untrusted text: they are only ever matched
 * against a short list of patterns and clipped, never evaluated, and whatever
 * they contain is shown as words. Five things can come out:
 *
 *   surface   "surface", "go back", "come back", "return"
 *   resume    "resume", "continue", "carry on", "go on", "keep going"
 *   hold      "wait", "hold on", "hang on", "pause", "stop" (the whole utterance)
 *   dive      an unmistakable question about the place: "dive on the event
 *             horizon", "go deeper into it", "what is the event horizon?",
 *             "wait, why does light not escape"; the question is what was said,
 *             without the interjection in front of it
 *   other     anything else: it is NOT acted on. The reading is held, the words
 *             are put where the reader can see and change them, and asking is
 *             left to the reader, because a misheard word must not cost them
 *             their place or spend a question.
 *
 * There is no intent for ending the session. Stopping is a button.
 */

export const HEARD_LIMIT = 500;

const INTERJECTION = /^(?:(?:um+|uh+|er+|erm|okay|ok|so|please|hey|oh)(?:[\s,]+|$))*/u;
const HOLD_LEAD = /^(?:wait|hold on|hang on|one moment|just a moment|just a second|stop)[\s,]+/u;

const SURFACE = /^(?:surface|resurface|go back|come back|return)(?:\s|$)/u;
const RESUME = /^(?:resume|continue|carry on|go on|keep going|keep reading)(?:\s|$)/u;
const HOLD = /^(?:wait|hold on|hang on|pause|stop|one moment|just a moment|just a second)$/u;
const DIVE_VERB = /^(?:dive|go deeper|drill down|look deeper)(?:\s+(?:on|into|in|about|to|at))?(?:\s+(.+))?$/u;
const QUESTION = /^(?:what|why|how|who|when|where|which|whose|can|could|does|do|did|is|are|was|were|will|would|tell me|explain|say more)\b/u;

/** The words as text to match: lower case, without quotes or end punctuation, spaces collapsed. */
function normalise(text) {
    return String(text ?? '')
        .normalize('NFKC')
        .replace(/[“”‘’"`]/gu, '')
        .replace(/[\p{Cc}\p{Cf}]/gu, ' ')
        .toLowerCase()
        // A dash between two thoughts is a comma to the ear.
        .replace(/\s*[–—]\s*/gu, ', ')
        .replace(/[.!?;:]+$/u, '')
        .replace(/\s+/gu, ' ')
        .trim();
}

/** What the reader said, cleaned of controls and clipped, for showing and for asking with. */
export function cleanHeard(text) {
    return String(text ?? '').normalize('NFKC').replace(/[\p{Cc}\p{Cf}]/gu, ' ').replace(/\s+/gu, ' ').trim().slice(0, HEARD_LIMIT);
}

/**
 * @param {unknown} text a transcript
 * @returns {{intent: 'none'|'surface'|'resume'|'hold'|'dive'|'other', heard: string, question?: string}}
 */
export function interpret(text) {
    const heard = cleanHeard(text);
    if (!heard) return { intent: 'none', heard: '' };
    const said = normalise(heard).replace(INTERJECTION, '');
    if (!said) return { intent: 'none', heard };

    if (SURFACE.test(said)) return { intent: 'surface', heard };
    if (RESUME.test(said)) return { intent: 'resume', heard };
    if (HOLD.test(said)) return { intent: 'hold', heard };

    const rest = said.replace(HOLD_LEAD, '');
    const verb = DIVE_VERB.exec(rest);
    if (verb) {
        // "dive on" and nothing after it asks about nothing: it is held, not asked.
        if (!verb[1]) return { intent: 'other', heard };
        return { intent: 'dive', heard, question: without(heard) };
    }
    if (QUESTION.test(rest)) return { intent: 'dive', heard, question: without(heard) };
    return { intent: 'other', heard };
}

/** The reader's own words with a leading interjection and hold word removed, in their own case. */
function without(heard) {
    let text = heard;
    let before;
    do {
        before = text;
        text = text
            .replace(/^(?:(?:um+|uh+|er+|erm|okay|ok|so|please|hey|oh)[\s,]+)+/iu, '')
            .replace(/^(?:wait|hold on|hang on|one moment|just a moment|just a second|stop)[\s,.—-]+/iu, '');
    } while (text !== before);
    return text.trim() || heard;
}
