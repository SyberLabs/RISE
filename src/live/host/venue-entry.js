/**
 * The Live venue's entry, as a pure state machine: idle → asking → reading → ended → asking again.
 *
 * One room holds many turns. A question is asked from the entry (idle), after a reading has ended, or
 * while one is held; never while one plays, and never twice at once. The provider is chosen before the
 * first question, from the registry (src/live/adapters/registry.js), and stays for the room, so every
 * question goes to the same adapter. Words heard by the microphone are put in the field and asked only
 * when the reader asks: a misheard word must not spend a question on the reader's key.
 *
 * The state never holds a key. Whether the reader has typed one, or is connected to OpenRouter, is told
 * to `ask` as a yes or no.
 */

import { OPEN_LIMITS } from '../adapter.js';
import { LIVE_PROVIDERS } from '../adapters/registry.js';
import { perceive } from '../perception.js';

/** @returns {{phase: 'idle'|'asking'|'reading'|'ended', provider: string, held: boolean, question: string, turns: {question: string}[], error: string|null}} */
export function initialVenue({ provider = 'mock' } = {}) {
    return { phase: 'idle', provider, held: false, question: '', turns: [], error: null };
}

/** Why a question cannot be asked now, in the reader's words; null when it can. */
function refusal(state, { question, connected, hasKey }, providers) {
    if (!question) return 'Ask something first.';
    const entry = providers.find(item => item.id === state.provider);
    if (!entry) return 'Choose a provider first.';
    if (!entry.adapter) return `${entry.label.replace(/ \(.*\)$/u, '')} is coming soon. Choose another provider.`;
    if (entry.credential === 'openrouter' && connected !== true) return 'Connect OpenRouter first, or choose the demo.';
    if (entry.credential === 'key' && hasKey !== true) return `Enter your ${entry.keyName} key to use this provider.`;
    return null;
}

/**
 * The next state.
 * @param {object} state
 * @param {object} event  choose {provider} | ask {question, connected, hasKey} | opened | status {status, message?} |
 *                        failed {message} | heard {text} | leave
 * @param {readonly object[]} [providers] the registry
 */
export function venueStep(state, event, providers = LIVE_PROVIDERS) {
    switch (event?.type) {
        case 'choose':
            if (state.phase !== 'idle' || state.turns.length > 0) return state;
            return providers.some(entry => entry.id === event.provider) ? { ...state, provider: event.provider, error: null } : state;
        case 'ask': {
            const resting = state.phase === 'idle' || state.phase === 'ended' || (state.phase === 'reading' && state.held);
            if (!resting) return state;
            const question = String(event.question ?? '').trim().slice(0, OPEN_LIMITS.prompt);
            const refused = refusal(state, { ...event, question }, providers);
            if (refused) return { ...state, error: refused };
            return { ...state, phase: 'asking', held: false, question: '', error: null, turns: [...state.turns, { question }] };
        }
        case 'opened':
            return state.phase === 'asking' ? { ...state, phase: 'reading', held: false } : state;
        case 'failed': {
            if (state.phase !== 'asking') return state;
            const turns = state.turns.slice(0, -1);
            return { ...state, phase: turns.length > 0 ? 'ended' : 'idle', turns, error: String(event.message ?? 'It could not be asked.') };
        }
        case 'status':
            // An ended reading played again from its start (the stage's Play again) reads again; nothing is asked.
            if (state.phase === 'ended' && event.status === 'live') return { ...state, phase: 'reading', held: false };
            if (state.phase !== 'reading') return state;
            if (event.status === 'interrupted') return { ...state, held: true };
            if (event.status === 'live') return { ...state, held: false };
            if (event.status === 'ended') return { ...state, phase: 'ended', held: false };
            if (event.status === 'failed') return { ...state, phase: 'ended', held: false, error: String(event.message ?? 'The reading failed.') };
            return state;
        case 'heard':
            // Already cleaned and clipped by the microphone's interpret (src/live/mic/interpret.js cleanHeard).
            return { ...state, question: String(event.text ?? '') };
        case 'leave':
            return initialVenue({ provider: state.provider });
        default:
            return state;
    }
}

/** Words as compared, not as shown: case, spacing and end punctuation set aside. */
const plainWords = text => String(text ?? '').toLowerCase().replace(/[.!?…]+$/u, '').replace(/\s+/gu, ' ').trim();

/**
 * The reader's actions to send up with the question being asked (the last turn): what they did in the reading
 * before it, rebuilt from that reading's journal each time (perception.js, design §4), or null when there is
 * nothing to send. Words the reader said to the microphone and then asked with are the question, not said twice.
 * @param {{question: string, journal?: object[], passages?: {segmentId: string, text: string}[]}[]} turns
 * @returns {{events: object[], earlier: number} | null}
 */
export function perceptionFor(turns) {
    const before = turns.at(-2);
    if (!before?.journal) return null;
    const asked = plainWords(turns.at(-1)?.question);
    const made = perceive(before.journal, { passages: before.passages ?? [] });
    const events = made.events.filter(event => !(event.type === 'said' && plainWords(event.words) === asked));
    return events.length ? { events, earlier: made.earlier } : null;
}

/**
 * The reader's actions to send up with an interjection (docs/plans/LIVE-CURRENT.md §17): what they did in the reading
 * playing now since RISE last spoke (its start, or its last answer to them), without the words they are asking with;
 * null when there is nothing to send.
 * @param {object[]} journal the reading's journal (runtime.journal())
 * @param {{segmentId: string, text: string}[]} passages the reading's passages as it is read now (runtime.passages())
 * @param {string} words what the reader is asking
 */
export function interjectionPerception(journal, passages, words) {
    const since = journal.findLastIndex(entry => entry?.type === 'interjection.answered');
    const asked = plainWords(words);
    const made = perceive(journal.slice(since + 1), { passages });
    const events = made.events.filter(event => !(event.type === 'said' && plainWords(event.words) === asked));
    return events.length ? { events, earlier: made.earlier } : null;
}

/** Who is speaking, for the About panel (design §1 item 7): RISE, through the model and service the Current names. */
export function originLine(origin) {
    if (!origin) return '';
    if (origin.provider === 'RISE') return `${origin.name}: a script in this page, with no model and no key`;
    return `RISE, speaking through ${origin.name} via ${origin.provider}, on your key`;
}
