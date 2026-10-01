/**
 * What can be said, in words, about the Dives the reader has taken (the
 * undercurrent, docs/plans/LIVE-UNDERCURRENT.md): where they are, where each
 * was taken from, and how each question ended.
 *
 * This builds descriptions and draws nothing; the controls draw them, with
 * textContent only. The questions are the reader's words and the answers the
 * model's: both are only ever text.
 */

const clip = (text, length) => (text.length <= length ? text : `${text.slice(0, length - 1).trimEnd()}…`);
const quoted = text => `“${text}”`;

/** Where the reader is, while they are in a Dive, and where Surface goes back to. */
export function describeCrumb(dive, dives) {
    const entry = dive ? dives.find(item => item.id === dive.id) : null;
    if (!entry) return null;
    const latest = entry.turns.at(-1)?.question ?? '';
    return {
        trail: `Main › Dive ${entry.number}: ${quoted(clip(latest, 80))}`,
        returnsTo: entry.anchor.quote ? `Surface returns to: ${quoted(entry.anchor.quote)}` : 'Surface returns to where you left the reading.'
    };
}

/** The Dives taken from each passage, in the order of the places in it: for markers in the transcript. */
export function forksBySegment(dives) {
    const forks = new Map();
    const ordered = [...dives].sort((a, b) => a.anchor.atCharacter - b.anchor.atCharacter || a.number - b.number);
    for (const dive of ordered) {
        const list = forks.get(dive.anchor.segmentId) ?? [];
        list.push({ id: dive.id, label: `Dive ${dive.number}: ${quoted(clip(dive.turns[0]?.question ?? '', 80))}` });
        forks.set(dive.anchor.segmentId, list);
    }
    return forks;
}

export function describeDive(dive) {
    const count = dive.turns.length;
    return {
        title: `Dive ${dive.number}: ${quoted(clip(dive.turns[0]?.question ?? '', 80))}`,
        place: dive.anchor.quote ? `Taken from ${quoted(dive.anchor.quote)}` : 'Taken from where the reading was',
        count: `${count} question${count === 1 ? '' : 's'}`
    };
}

/** How a question ended, in a sentence; nothing for one that was simply answered. */
export function describeTurn(turn) {
    switch (turn.status) {
        case 'answering':
            return 'Being written…';
        case 'cut-short':
            return 'Cut short. What was written is kept.';
        case 'failed':
            return `Could not be answered${turn.error ? `: ${String(turn.error).replace(/\.+$/u, '')}` : ''}.`;
        default:
            return '';
    }
}
