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
import { oneLine, perceive } from '../perception.js';

/** @returns {{phase: 'idle'|'asking'|'reading'|'ended', provider: string, held: boolean, question: string, turns: {question: string}[], error: string|null}} */
export function initialVenue({ provider = 'mock' } = {}) {
    return { phase: 'idle', provider, held: false, question: '', turns: [], error: null };
}

/** Why a question cannot be asked now, in the reader's words; null when it can. */
function refusal(state, { question, connected, hasKey, voice, hasVoiceKey }, providers) {
    if (!question) return 'Ask something first.';
    const entry = providers.find(item => item.id === state.provider);
    if (!entry) return 'Choose a provider first.';
    if (!entry.adapter) return `${entry.label.replace(/ \(.*\)$/u, '')} is coming soon. Choose another provider.`;
    if (entry.credential === 'openrouter' && connected !== true) return 'Connect OpenRouter first, or choose the demo.';
    if (entry.credential === 'key' && hasKey !== true) return `Enter your ${entry.keyName} key to use this provider.`;
    // The voice's key is the same posture as a provider's (voices/elevenlabs.js): asked before a question spends it.
    if (voice === 'elevenlabs' && hasVoiceKey !== true) return 'Enter your ElevenLabs key to hear that voice, or choose your device’s voice.';
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
 * What RISE's face is doing (docs/plans/LIVE-CURRENT.md §22, §23), from what the room is doing: at arrival before a
 * question, listening while the reader types or speaks one, thinking from the ask until the reading's first words
 * are shown (the request is out; no timer stands in for it), speaking while the reading plays (she never leaves the
 * room: the eye, or the frame she holds a visual in), at rest in place while the reader holds it, listening and
 * thinking in place for an interjection, and at rest once a reading has ended or a question failed.
 * @param {{phase: string, held?: boolean, interjection?: 'none'|'held'|'asking'|'answering', wordsShown?: boolean, typing?: boolean, failed?: boolean}} room
 * @returns {'arrival'|'listening'|'thinking'|'speaking'|'rest'}
 */
export function faceStateOf({ phase, held = false, interjection = 'none', wordsShown = false, typing = false, failed = false }) {
    if (phase === 'idle') return typing ? 'listening' : failed ? 'rest' : 'arrival';
    if (phase === 'asking') return 'thinking';
    if (phase === 'ended') return typing ? 'listening' : 'rest';
    if (interjection === 'held') return 'listening';
    if (interjection === 'asking') return 'thinking';
    if (interjection === 'answering') return 'speaking';
    if (held) return typing ? 'listening' : 'rest';
    return wordsShown ? 'speaking' : 'thinking';
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

/** Text as it may be quoted: one line, with no quotation mark of its own (perception.js oneLine); '' when nothing is left. */
const flat = value => oneLine(value, Number.MAX_SAFE_INTEGER);

/** Quotable text clipped to `max` by keeping its start and its end, joined by an ellipsis. */
function fit(value, max) {
    const text = flat(value);
    if (text.length <= max) return text;
    const head = Math.ceil((max - 3) / 2);
    const tail = Math.floor((max - 3) / 2);
    return `${text.slice(0, head).trimEnd()} … ${text.slice(text.length - tail).trimStart()}`;
}

/** An interjection's answer, as the graft names its passages (graft.js pieceKey): i<n+1>-beat-<k>. */
const ASIDE_KEY = /^i(\d+)-beat-\d+$/u;

/** What a picture RISE drew is said as, by the medium it was drawn in; a cue to its own imagery is not a picture. */
const DRAWN = Object.freeze({ figure: 'a figure', scene: 'a moving scene' });

const joined = passages => passages.map(passage => flat(passage.text)).join(' ');

/**
 * One earlier turn as it goes up: the question, and once its reading was let go, what RISE said in it up to the
 * furthest passage the reader reached (the reading's place when let go, or a place they went back from), the
 * interjections inside it, the scenes it started and the pictures it drew, and `cut` when the reader cut it off.
 */
function turnSaid({ question, journal, passages = [], reached = null }) {
    const turn = { asked: fit(question, OPEN_LIMITS.earlierText) };
    if (!turn.asked) return null;
    if (!Array.isArray(journal)) return turn;
    const ended = type => journal.some(entry => entry?.type === type && entry.role === 'main');
    const finished = ended('run.finished');
    const order = new Map(passages.map((passage, index) => [passage.key ?? passage.segmentId, index]));
    let last = finished ? passages.length - 1 : Number.isInteger(reached) ? reached : -1;
    for (const entry of journal) {
        if ((entry?.type === 'seek' || entry?.type === 'replay') && entry.reason === 'reader') last = Math.max(last, order.get(entry.fromKey ?? entry.from) ?? -1);
    }
    const heard = passages.slice(0, last + 1).filter(passage => passage.spoken !== false && flat(passage.text));
    const own = heard.filter(passage => !ASIDE_KEY.test(passage.key ?? ''));
    if (own.length) turn.said = fit(joined(own), OPEN_LIMITS.earlierText);
    const words = new Map(journal.filter(entry => entry?.type === 'interjection.answering' && Number.isInteger(entry.n) && flat(entry.words)).map(entry => [entry.n, entry.words]));
    const asides = new Map();
    for (const passage of heard) {
        const n = Number(ASIDE_KEY.exec(passage.key ?? '')?.[1]) - 1;
        if (words.has(n)) asides.set(n, [...(asides.get(n) ?? []), passage]);
    }
    const interjections = [...asides].slice(-OPEN_LIMITS.earlierAsides)
        .map(([n, answer]) => ({ asked: fit(words.get(n), OPEN_LIMITS.earlierAsideAsked), said: fit(joined(answer), OPEN_LIMITS.earlierAsideSaid) }));
    if (interjections.length) turn.interjections = interjections;
    const scenes = [...new Set(heard.map(passage => passage.scene).filter(scene => typeof scene === 'string' && flat(scene)))].map(scene => `the scene ${scene}`);
    const drawn = journal.filter(entry => entry?.type === 'illustrated' && Object.hasOwn(DRAWN, entry.medium) && typeof entry.brief === 'string' && flat(entry.brief))
        .map(entry => `${DRAWN[entry.medium]}: ${entry.brief}`);
    const showed = [...scenes, ...drawn].slice(0, OPEN_LIMITS.earlierShown).map(item => fit(item, OPEN_LIMITS.earlierShownText));
    if (showed.length) turn.showed = showed;
    if (!finished && !ended('run.failed')) turn.cut = true;
    return turn;
}

const sizeOf = turn => [turn.asked, turn.said, ...(turn.interjections ?? []).flatMap(aside => [aside.asked, aside.said]), ...(turn.showed ?? [])]
    .reduce((sum, text) => sum + (text?.length ?? 0), 0);

/**
 * What was said earlier in this room, to send up with the question being asked (the last turn), which is never in it:
 * the last OPEN_LIMITS.earlier turns before it, oldest first, the oldest let go whole until the rest fit within
 * OPEN_LIMITS.earlierTotal; null when nothing was asked before. Built from what the venue keeps of each reading, in
 * memory only, and forgotten when the reader leaves.
 * @param {{question: string, journal?: object[], passages?: {segmentId: string, key?: string, text: string, spoken?: boolean, scene?: string}[], reached?: number|null}[]} turns
 * @returns {object[] | null}
 */
export function earlierFor(turns) {
    const made = turns.slice(0, -1).map(turnSaid).filter(Boolean).slice(-OPEN_LIMITS.earlier);
    let size = made.reduce((sum, turn) => sum + sizeOf(turn), 0);
    while (made.length && size > OPEN_LIMITS.earlierTotal) size -= sizeOf(made.shift());
    return made.length ? made : null;
}

/** How many earlier turns went up with the question on screen, for the About panel; empty when none did. */
export function earlierLine(count) {
    return count > 0 ? `earlier in this room: ${count} turn${count === 1 ? '' : 's'}, sent with this question` : '';
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

/** What a reading has cost the reader so far: no requests, no tokens (docs/plans/LIVE-CURRENT.md §19). */
export function emptyUsage() {
    return { requests: { answer: 0, interject: 0, illustrate: 0, dive: 0 }, promptTokens: 0, completionTokens: 0, totalTokens: 0, cost: 0, reported: false };
}

/** A request the room opened, by its intent, or what the provider reported one cost, added to the reading's usage. */
export function addUsage(usage, { intent, report } = {}) {
    const next = { ...usage, requests: { ...usage.requests } };
    if (intent && Object.hasOwn(next.requests, intent)) next.requests[intent] += 1;
    if (report) {
        for (const field of ['promptTokens', 'completionTokens', 'totalTokens', 'cost']) {
            if (Number.isFinite(report[field]) && report[field] >= 0) next[field] += report[field];
        }
        next.reported = true;
    }
    return next;
}

const KIND_SAID = Object.freeze({ answer: 'answer', interject: 'interjection', illustrate: 'illustrator', dive: 'Dive' });
const count = n => n.toLocaleString('en-US');

/**
 * The reading's cost, for the About panel: every request it made, by kind (the composer's answer, an interjection, the
 * illustrator), and the tokens and money the provider reported; the demo spends nothing and says so. Empty before any.
 */
export function usageLine(usage, { demo = false } = {}) {
    const kinds = Object.entries(usage?.requests ?? {}).filter(([, n]) => n > 0);
    const total = kinds.reduce((sum, [, n]) => sum + n, 0);
    if (total === 0) return '';
    const requests = `requests: ${total} (${kinds.map(([kind, n]) => `${n} ${KIND_SAID[kind]}`).join(', ')})`;
    if (!usage.reported) return `${requests}, tokens: none reported${demo ? ' (the demo spends nothing)' : ''}`;
    const tokens = usage.totalTokens || usage.promptTokens + usage.completionTokens;
    const money = usage.cost > 0 ? `, $${usage.cost.toFixed(4)}` : '';
    return `${requests}, tokens: ${count(tokens)} (${count(usage.promptTokens)} in, ${count(usage.completionTokens)} out)${money}`;
}
