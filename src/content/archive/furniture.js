/**
 * Page furniture — what the printed page left behind in the text.
 *
 * ONE VOCABULARY, ONE PLACE. The detector was written twice within a day
 * — once to build reviewer jobs and once to apply trims — and the two
 * copies had already begun to disagree. That is this codebase's oldest
 * and most expensive failure shape: a word that only one copy learns.
 * The job builder, the cleanser and the tests all read from here.
 *
 * What this knows is defined in `docs/specs/ARCHIVE-CLEANSING-SPEC` §2b.
 * It identifies; it never edits. Deciding what to do with a span belongs
 * to the caller, and deletion belongs to the cleanser alone.
 */

/**
 * A running head: a short line of capitals ending in a page number.
 *
 * The stem must carry three consecutive capitals. Without that the class
 * is met by things that are plainly not headings — Hamlet's `I  2` and
 * the Shahnama's `V, 82`, where the "stem" was two spaces and a comma —
 * and the strict-deletion check duly refused both works. Refusing was
 * correct; being asked at all was the defect.
 */
export const RUNNING_HEAD = /^(?=[A-Z'’ .,\-]*[A-Z]{3})([A-Z][A-Z'’ .,\-]{2,44}?)\s+(\d{1,4})$/;

/** A line that is nothing but a page number — the verso half. */
export const BARE_NUMERAL = /^\d{1,4}$/;

/** A finished sentence says so. Closing quotes and brackets count. */
export const ENDS_A_SENTENCE = /[.!?…][")'\]]*$/;

/** A stem seen once is not a header, it is a line. */
export const MIN_REPEATS = 3;

/**
 * What a proven span may contain, and nothing else: an optional verso
 * numeral and one running head. The last gate before a deletion.
 */
export const FURNITURE_ONLY =
    /^(\d{1,4} )?(?=[A-Z'’ .,\-]*[A-Z]{3})[A-Z][A-Z'’ .,\-]{2,44}? \d{1,4}$/;

/** Every running-head stem in a work, so "repeats" is judged work-wide. */
export function stemsOf(sections) {
    const stems = new Map();
    for (const section of sections) {
        for (const line of String(section?.content || '').split('\n')) {
            const m = line.trim().match(RUNNING_HEAD);
            if (m) stems.set(m[1], (stems.get(m[1]) || 0) + 1);
        }
    }
    return stems;
}

/**
 * Every furniture candidate in one section's content.
 *
 * A candidate's SPAN runs from the end of the last real line of text to
 * the start of the next one, swallowing the blank lines and any adjacent
 * bare numeral — a printed opening leaves both numbers behind, and
 * removing half the furniture looks exactly as broken as removing none.
 *
 * `proven` is the §2b positional test and licenses deletion with no
 * reviewer: the clause before did not end and the word after continues
 * in lower case. `rejoin` asks less — only whether the sentence had
 * ended — because joining two paragraphs that were always separate would
 * be an edit rather than a deletion.
 *
 * @param {string} content
 * @param {Map<string, number>} stems - from stemsOf(), work-wide
 * @returns {Array<{start, end, text, proven, rejoin}>} in document order
 */
export function furnitureIn(content, stems) {
    const lines = String(content || '').split('\n');
    const at = [];
    let cursor = 0;
    for (const line of lines) { at.push(cursor); cursor += line.length + 1; }

    const out = [];
    for (let i = 0; i < lines.length; i++) {
        const raw = lines[i].trim();
        const m = raw.match(RUNNING_HEAD);
        if (!m || (stems.get(m[1]) || 0) < MIN_REPEATS) continue;

        let first = i;
        let p = i - 1;
        while (p >= 0 && !lines[p].trim()) p--;
        if (p >= 0 && BARE_NUMERAL.test(lines[p].trim())) { first = p; p--; }
        while (p >= 0 && !lines[p].trim()) p--;

        let n = i + 1;
        while (n < lines.length && !lines[n].trim()) n++;

        const unfinished = p >= 0 && !ENDS_A_SENTENCE.test(lines[p].trim());
        const resumes = n < lines.length && /^[a-z]/.test(lines[n].trim());

        out.push({
            start: p >= 0 ? at[p] + lines[p].replace(/\s+$/, '').length : 0,
            end: n < lines.length ? at[n] : String(content).length,
            text: lines.slice(first, i + 1).map(l => l.trim()).filter(Boolean).join('\n'),
            stem: m[1],
            proven: unfinished && resumes,
            rejoin: unfinished ? ' ' : '\n\n'
        });
    }
    return out;
}

/**
 * Is this span safe to delete? Whatever it covers, collapsed to one
 * line, must BE the furniture and nothing else.
 *
 * This is the last gate and it is deliberately blunt: a span it cannot
 * prove is a span nobody takes. It never narrows or repairs one.
 */
export function isStrictlyFurniture(span) {
    return FURNITURE_ONLY.test(String(span || '').replace(/\s+/g, ' ').trim());
}
