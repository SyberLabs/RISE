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

/**
 * The reader's actions to send up with the next question: the hook perception fills (design §4, §8 stage 4)
 * from the journals the room carries. Today nothing goes up; the adapter is asked the question alone.
 * @param {{question: string, journal?: object[]}[]} turns
 * @returns {object[]}
 */
export function perceptionFor(turns) {
    void turns;
    return [];
}
