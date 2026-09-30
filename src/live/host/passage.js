/**
 * What can be said about the passage the reader is in, in words.
 *
 * Three things, each kept honest:
 *
 *  - its intended condition: what the passage is meant to be like, from the
 *    closed list, in coarse words (low, medium, high) because the numbers are
 *    intent and not measurement. Never a statement about the reader.
 *  - its sources: where each came from (provided, retrieved, or proposed by
 *    the model and not checked), what it is, where in it, and the words it
 *    supports. A source is shown as a link only if it is a plain https address;
 *    anything else is shown as text. If there are none, that is said, because
 *    a missing source that is not mentioned looks like one that is there.
 *  - its depth: notes written with the answer (stable depth, the same for every
 *    reader) as against a question asked now (generative depth, written for
 *    this reader, and marked as the model's).
 *
 * This builds a description and draws nothing; the controls draw it, with
 * textContent only.
 */

const LABELS = Object.freeze({
    tension: 'Tension',
    warmth: 'Warmth',
    expansiveness: 'Expansiveness',
    perceptualDensity: 'Density',
    motionEnergy: 'Motion',
    solemnity: 'Solemnity',
    novelty: 'Novelty',
    uncertainty: 'Uncertainty',
    intimacy: 'Intimacy',
    arousal: 'Arousal'
});

export const KIND_LABELS = Object.freeze({
    supplied: 'Provided with the answer',
    retrieved: 'Retrieved',
    'model-proposed': 'Proposed by the model, not checked'
});

const coarse = level => (level < 0.34 ? 'low' : level < 0.67 ? 'medium' : 'high');

/** A plain https address with nothing after the host that could run: else null. */
export function safeHref(uri) {
    if (typeof uri !== 'string' || !/^https:\/\/[^\s"'<>\\]+$/u.test(uri)) return null;
    try {
        const url = new URL(uri);
        return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
    } catch {
        return null;
    }
}

const quote = (text, span) => (span && span.toCharacter <= text.length ? text.slice(span.fromCharacter, span.toCharacter) : null);

/**
 * @param {{segments: Array<object>}|null} view a reducer snapshot
 * @param {string|null} segmentId the passage the reader is in
 */
export function describePassage(view, segmentId) {
    const segment = view?.segments?.find(item => item.id === segmentId);
    if (!segment) return null;
    const condition = Object.keys(LABELS)
        .filter(name => typeof segment.state?.[name] === 'number')
        .map(name => ({ name, label: LABELS[name], word: coarse(segment.state[name]) }));
    const sources = (segment.evidence ?? []).map(item => ({
        id: item.id,
        kind: item.kind,
        kindLabel: KIND_LABELS[item.kind] ?? 'Source',
        title: item.title,
        location: item.location ?? null,
        href: safeHref(item.uri),
        uri: item.uri ?? null,
        supports: quote(segment.text, item.supports)
    }));
    const notes = (segment.dives ?? []).map(item => ({
        id: item.id,
        text: item.text,
        about: quote(segment.text, item.anchor)
    }));
    return { segmentId, condition, sources, notes };
}

/** Where a side Current came from, in a sentence. */
export function describeOrigin(origin) {
    if (!origin) return '';
    const who = origin.provider ? `${origin.name} (${origin.provider})` : origin.name;
    return origin.kind === 'model'
        ? `Written when you asked, by ${who}. It does not change what you left.`
        : `From ${who}.`;
}
