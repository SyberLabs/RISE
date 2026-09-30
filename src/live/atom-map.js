/**
 * Which words of which segment each atom is.
 *
 * The voice speaks a segment; the Player shows atoms. To let the voice be the
 * clock, an atom needs an answer to "where in the segment's speech does this
 * atom end?". The compiled Session already says which segment an atom came
 * from (`sourceId`) and puts an empty seam atom between segments. This reads
 * the atoms' words back against the segment text to give each one a character
 * range.
 *
 * Ranges inside one segment are contiguous: an atom ends where the next one
 * begins, the first begins at 0, the last ends at the segment's length. So an
 * atom is over when the voice reaches the first word of the next one, which is
 * also when a listener would say it had moved on.
 *
 * If an atom's words cannot be found in the text (a compiler that normalised
 * them), its boundary falls back to proportion by length. Timing then
 * approximates instead of failing.
 */

/**
 * @param {Array<{content: string, sourceId?: string, seam?: object}>} atoms
 * @param {Array<{id: string, text: string}>} segments
 * @returns {Array<{index: number, segmentId: string|null, seam: boolean, start: number, end: number}>}
 *   one entry per atom, in order. A seam belongs to the segment it precedes.
 */
export function mapAtoms(atoms, segments) {
    const byId = new Map(segments.map(segment => [segment.id, segment]));
    const entries = atoms.map((atom, index) => ({
        index,
        segmentId: atom.seam ? null : (atom.sourceId || null),
        seam: Boolean(atom.seam),
        start: 0,
        end: 0
    }));

    // A seam waits for the segment that follows it.
    for (let i = entries.length - 1, following = null; i >= 0; i -= 1) {
        if (entries[i].seam) entries[i].segmentId = following;
        else following = entries[i].segmentId;
    }

    // Group the words of each segment, in order.
    const groups = new Map();
    entries.forEach(entry => {
        if (entry.seam || !entry.segmentId) return;
        if (!groups.has(entry.segmentId)) groups.set(entry.segmentId, []);
        groups.get(entry.segmentId).push(entry);
    });

    for (const [segmentId, group] of groups) {
        const text = byId.get(segmentId)?.text ?? '';
        const contents = group.map(entry => atoms[entry.index].content ?? '');
        const starts = locate(text, contents);
        group.forEach((entry, i) => {
            entry.start = starts[i];
            entry.end = i + 1 < group.length ? starts[i + 1] : text.length;
        });
    }
    return entries;
}

/** Where each piece of a segment begins: found in the text, else in proportion to its length. */
function locate(text, pieces) {
    const starts = [];
    let cursor = 0;
    let found = true;
    for (const piece of pieces) {
        const at = found && piece ? text.indexOf(piece, cursor) : -1;
        if (at < 0) { found = false; break; }
        starts.push(at);
        cursor = at + piece.length;
    }
    if (found && starts.length === pieces.length && starts[0] <= 3) {
        starts[0] = 0;
        return starts;
    }
    const total = pieces.reduce((sum, piece) => sum + Math.max(piece.length, 1), 0);
    let taken = 0;
    return pieces.map(piece => {
        const at = Math.round((taken / total) * text.length);
        taken += Math.max(piece.length, 1);
        return at;
    });
}
