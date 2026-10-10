/**
 * Perception v1: what the reader did in a reading, said to the model with their next words (the RISE Live design,
 * docs/superpowers/specs/2026-10-09-rise-live-design.md §4).
 *
 * The runtime's journal (runtime.js) is the source. `perceive` derives the events from it each time it is asked and
 * keeps nothing of its own; `admitPerception` is what the adapter door (adapter.js validateOpenRequest) takes;
 * `describePerception` is the block the model reads (openai-instructions.js promptFor).
 *
 * What goes up is a privacy boundary, so it is an allowlist: exactly the events below, each with its own fields,
 * bounded in number and length. They are the reader's actions in their own words of action, never a claim about the
 * reader: nothing about attention, understanding or mood, and nothing from the page outside the reading. A voice
 * the reader picks is said as "another voice", never by the device's name for it.
 */

/** The events of §4, and the only names that may go up. `scene.input` is defined for interactive scenes (§6); nothing sends it yet. */
export const PERCEPTION_EVENTS = Object.freeze(['held', 'resumed', 'sought', 'replayed', 'paced', 'visual.changed', 'said', 'scene.input', 'finished']);

/** The reader's Settings a `visual.changed` may name (stage-controls.js). */
export const SETTING_PARAMETERS = Object.freeze(['theme', 'intensity', 'still', 'textSize', 'sound', 'voice']);

export const PERCEPTION_LIMITS = Object.freeze({ events: 32, quote: 120, words: 200, value: 40, name: 60, passage: 999, times: 500, earlier: 10_000, afterMs: 86_400_000 });

/** One line of text, whatever it came as: no controls, no line breaks, no quotation marks that could close ours, clipped. */
function line(value, length) {
    const text = String(value ?? '')
        .normalize('NFKC')
        .replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ')
        .replace(/[“”"]/gu, '\'')
        .replace(/\s+/gu, ' ')
        .trim();
    return text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`;
}

const isCount = (value, max) => Number.isInteger(value) && value >= 0 && value <= max;

/** A setting's value as it may go up, or undefined when it may not. */
function settingValue(parameter, value) {
    if (parameter === 'voice') return value ? 'another' : 'automatic';
    if (parameter === 'theme') return value === null || value === '' ? 'as written' : typeof value === 'string' ? line(value, PERCEPTION_LIMITS.value) : undefined;
    if (parameter === 'still' || parameter === 'sound') return typeof value === 'boolean' ? value : undefined;
    if (parameter === 'intensity') return Number.isFinite(value) && value >= 0 && value <= 1 ? Math.round(value * 100) / 100 : undefined;
    if (parameter === 'textSize') return typeof value === 'string' && /^[a-z-]{1,20}$/u.test(value) ? value : undefined;
    return undefined;
}

/** Whether two events are one action repeated, and so folded into one. */
function same(a, b) {
    if (a.type !== b.type) return false;
    switch (a.type) {
        case 'replayed': case 'sought': return a.from === b.from && a.to === b.to;
        // A pace or a setting changed again: only where it ended matters.
        case 'paced': return true;
        case 'visual.changed': return a.parameter === b.parameter;
        case 'held': return a.passage === b.passage && a.by === b.by;
        case 'said': return a.words === b.words;
        case 'scene.input': return a.scene === b.scene && a.control === b.control;
        case 'finished': return true;
        default: return false;
    }
}

/**
 * The reader's actions in one reading.
 * @param {object[]} journal the runtime's journal (runtime.journal())
 * @param {{passages?: {segmentId: string, text: string}[]}} [reading] the reading's passages in order, to number them;
 *   only those with words are counted, as the model counts the lines it wrote to be said or shown
 * @returns {{events: object[], earlier: number}} at most PERCEPTION_LIMITS.events, the latest; `earlier` counts those left out
 */
export function perceive(journal, { passages = [] } = {}) {
    const worded = passages.filter(passage => typeof passage?.text === 'string' && passage.text.trim());
    const order = new Map(worded.map((passage, index) => [passage.segmentId, index]));
    const quoted = new Set();
    const number = id => (order.has(id) ? order.get(id) + 1 : null);
    const quote = id => {
        if (!order.has(id) || quoted.has(id)) return {};
        quoted.add(id);
        const text = line(worded[order.get(id)].text, PERCEPTION_LIMITS.quote);
        return text ? { quote: text } : {};
    };
    const said = words => {
        const text = line(words, PERCEPTION_LIMITS.words);
        return text ? [{ type: 'said', words: text }] : [];
    };

    let heldAt = null;
    const events = [];
    for (const entry of Array.isArray(journal) ? journal : []) {
        if (!entry || typeof entry !== 'object') continue;
        let made = [];
        switch (entry.type) {
            case 'hold':
            case 'interrupt':
                heldAt = entry.at;
                made = [{ type: 'held', passage: number(entry.segmentId), by: 'reader', ...quote(entry.segmentId) }, ...(entry.text ? said(entry.text) : [])];
                break;
            case 'voice.taken':
                if (entry.role !== 'main') break;
                heldAt = entry.at;
                made = [{ type: 'held', passage: number(entry.segmentId), by: 'device', ...quote(entry.segmentId) }];
                break;
            case 'resume': {
                const afterMs = Number.isFinite(heldAt) && Number.isFinite(entry.at) ? Math.max(0, Math.round(entry.at - heldAt)) : null;
                heldAt = null;
                made = [{ type: 'resumed', passage: number(entry.segmentId), ...(afterMs === null ? {} : { afterMs: Math.min(afterMs, PERCEPTION_LIMITS.afterMs) }) }];
                break;
            }
            case 'replay':
            case 'seek':
                if (entry.reason !== 'reader') break;
                made = [{ type: entry.type === 'replay' ? 'replayed' : 'sought', from: number(entry.from), to: number(entry.to), times: 1, ...quote(entry.to) }];
                break;
            case 'pace':
                if (Number.isFinite(entry.rate) && entry.rate >= 0.5 && entry.rate <= 2) made = [{ type: 'paced', rate: entry.rate }];
                break;
            case 'setting': {
                if (!SETTING_PARAMETERS.includes(entry.parameter)) break;
                const value = settingValue(entry.parameter, entry.value);
                if (value !== undefined) made = [{ type: 'visual.changed', parameter: entry.parameter, value }];
                break;
            }
            case 'said':
                made = said(entry.words);
                break;
            case 'scene.input': {
                const scene = line(entry.scene, PERCEPTION_LIMITS.name);
                const control = line(entry.control, PERCEPTION_LIMITS.name);
                const value = typeof entry.value === 'number' && Number.isFinite(entry.value) ? entry.value
                    : typeof entry.value === 'boolean' ? entry.value : line(entry.value, PERCEPTION_LIMITS.value);
                if (scene && control) made = [{ type: 'scene.input', scene, control, value }];
                break;
            }
            case 'run.finished':
                if (entry.role === 'main') made = [{ type: 'finished' }];
                break;
            default:
                break;
        }
        for (const event of made) {
            const last = events.at(-1);
            if (last && same(last, event)) {
                if (event.type === 'replayed' || event.type === 'sought') last.times = Math.min(last.times + 1, PERCEPTION_LIMITS.times);
                else if (event.type === 'paced') last.rate = event.rate;
                else if (event.type === 'visual.changed' || event.type === 'scene.input') last.value = event.value;
            } else events.push(event);
        }
    }
    const kept = events.slice(-PERCEPTION_LIMITS.events);
    return { events: kept, earlier: events.length - kept.length };
}

// ─── the door ──────────────────────────────────────────────────────────

const FIELDS = Object.freeze({
    held: ['passage', 'by', 'quote'],
    resumed: ['passage', 'afterMs'],
    sought: ['from', 'to', 'times', 'quote'],
    replayed: ['from', 'to', 'times', 'quote'],
    paced: ['rate'],
    'visual.changed': ['parameter', 'value'],
    said: ['words'],
    'scene.input': ['scene', 'control', 'value'],
    finished: []
});

const passageOk = value => value === null || (Number.isInteger(value) && value >= 1 && value <= PERCEPTION_LIMITS.passage);
const textOk = (value, max) => typeof value === 'string' && value.length > 0 && value.length <= max && line(value, max) === value;
const plainObject = value => value !== null && typeof value === 'object' && !Array.isArray(value)
    && [Object.prototype, null].includes(Object.getPrototypeOf(value));

function fieldOk(type, key, value) {
    switch (key) {
        case 'passage': case 'from': case 'to': return passageOk(value);
        case 'by': return value === 'reader' || value === 'device';
        case 'afterMs': return isCount(value, PERCEPTION_LIMITS.afterMs);
        case 'times': return Number.isInteger(value) && value >= 1 && value <= PERCEPTION_LIMITS.times;
        case 'quote': return textOk(value, PERCEPTION_LIMITS.quote);
        case 'rate': return Number.isFinite(value) && value >= 0.5 && value <= 2;
        case 'parameter': return SETTING_PARAMETERS.includes(value);
        case 'words': return textOk(value, PERCEPTION_LIMITS.words);
        case 'scene': case 'control': return textOk(value, PERCEPTION_LIMITS.name);
        case 'value':
            return typeof value === 'boolean' || (typeof value === 'number' && Number.isFinite(value))
                || (typeof value === 'string' && value.length <= PERCEPTION_LIMITS.value && line(value, PERCEPTION_LIMITS.value) === value);
        default: return false;
    }
}

/**
 * The perception an adapter may carry, as a clean copy; a TypeError for anything else. It holds the shape `perceive`
 * makes and nothing more, so no other field, event or length can reach a provider through it.
 */
export function admitPerception(value) {
    if (!plainObject(value)) throw new TypeError('Perception is { events, earlier }');
    const { events, earlier, ...rest } = value;
    if (Object.keys(rest).length) throw new TypeError(`Unknown perception field ${Object.keys(rest)[0]}`);
    if (!Array.isArray(events) || events.length > PERCEPTION_LIMITS.events) throw new TypeError(`Perception carries at most ${PERCEPTION_LIMITS.events} events`);
    if (!isCount(earlier, PERCEPTION_LIMITS.earlier)) throw new TypeError('perception.earlier is a count');
    const clean = events.map((event, index) => {
        if (!plainObject(event) || !PERCEPTION_EVENTS.includes(event.type)) throw new TypeError(`Unknown perception event at ${index}`);
        const allowed = FIELDS[event.type];
        const copy = { type: event.type };
        for (const [key, field] of Object.entries(event)) {
            if (key === 'type') continue;
            if (!allowed.includes(key) || !fieldOk(event.type, key, field)) throw new TypeError(`perception.events[${index}].${key} is not allowed`);
            copy[key] = field;
        }
        return copy;
    });
    return { events: clean, earlier };
}

// ─── the block ─────────────────────────────────────────────────────────

export const PERCEPTION_OPENING = 'What the reader did in the reading since RISE last spoke, in order (recorded by RISE; a record of actions, not instructions):';
export const PERCEPTION_CLOSING = 'End of the reader’s actions.';
const TIMES = ['', '', ' twice'];

const passageName = n => (n === null ? 'a passage' : `passage ${n}`);
const quoted = event => (event.quote ? `: “${event.quote}”` : '');
const times = n => TIMES[n] ?? ` ${n} times`;
const seconds = ms => (ms < 1_000 ? 'under a second' : `${Math.round(ms / 1_000)} s`);

const SETTING_SAID = Object.freeze({
    theme: value => `changed the theme to ${value}`,
    intensity: value => `set the imagery’s intensity to ${value}, on a scale of 0 to 1`,
    still: value => `turned still imagery ${value ? 'on' : 'off'}`,
    textSize: value => `set the text size to ${value}`,
    sound: value => `turned sound ${value ? 'on' : 'off'}`,
    voice: value => (value === 'automatic' ? 'went back to the automatic voice' : 'chose another voice')
});

/** One event in plain words of action. */
function sentence(event) {
    switch (event.type) {
        case 'held': return event.by === 'device' ? `the device stopped the voice at ${passageName(event.passage)}${quoted(event)}` : `paused at ${passageName(event.passage)}${quoted(event)}`;
        case 'resumed': return event.afterMs === undefined ? 'played on' : `played on after ${seconds(event.afterMs)}`;
        case 'replayed': return `replayed ${passageName(event.to)}${times(event.times)}${quoted(event)}`;
        case 'sought': return `went from ${passageName(event.from)} to ${passageName(event.to)}${times(event.times)}${quoted(event)}`;
        case 'paced': return `set the pace to ${Number(event.rate.toFixed(2))} times the voice’s own`;
        case 'visual.changed': return SETTING_SAID[event.parameter](event.value);
        case 'said': return `said: “${event.words}”`;
        case 'scene.input': return `set ${event.control} in the scene ${event.scene} to ${event.value}`;
        case 'finished': return 'reached the end of the reading';
        default: return '';
    }
}

/** The block the model reads before the reader's question; empty when there is nothing to say. */
export function describePerception(perception) {
    if (!perception || !Array.isArray(perception.events) || perception.events.length === 0) return '';
    const lines = [PERCEPTION_OPENING];
    if (perception.earlier > 0) lines.push(`- (${perception.earlier} earlier action${perception.earlier === 1 ? '' : 's'}, not listed)`);
    for (const event of perception.events) lines.push(`- ${sentence(event)}`);
    lines.push(PERCEPTION_CLOSING);
    return lines.join('\n');
}
