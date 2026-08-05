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
 * THE SECOND PROOF: repetition inside one division.
 *
 * The positional proof needs the text after the furniture to resume in
 * LOWER CASE, and an entire genre cannot supply that. The Shahnama is
 * verse — 74.2% of its lines begin with a capital because every line of
 * poetry does — so not one of its 1,055 candidates was provable, while
 * `KAI KHUSRAU` appeared 220 times with 220 different page numbers.
 *
 * What separates a header from a heading is not position but FREQUENCY
 * WITHIN A DIVISION. A chapter title appears once, at the head of the
 * division it names. A running head appears at the top of every page of
 * it. Measured across the shelf, the two do not overlap at all:
 *
 *     Mahabharata   "BOOK"                      1 per division  → heading
 *     I Ching       "APPENDIX III."             5               → header
 *     Hermetica     "THE MYSTERIES OF ISIS…"   24               → header
 *     Shahnama      "MINUCHIHR"                42               → header
 *
 * Three is the threshold, and the case it must protect scores one.
 */
export const MIN_REPEATS_IN_DIVISION = 3;

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
            // Filled in below, once the whole division has been read.
            provenByRepetition: false,
            rejoin: unfinished ? ' ' : '\n\n'
        });
    }

    // THE SECOND PROOF, applied once the division has been read whole:
    // a stem carrying three or more DIFFERENT page numbers here is the
    // header of these pages, not the title of this division.
    const seen = new Map();
    for (const f of out) {
        if (!seen.has(f.stem)) seen.set(f.stem, new Set());
        seen.get(f.stem).add(f.text);
    }
    for (const f of out) {
        f.provenByRepetition = seen.get(f.stem).size >= MIN_REPEATS_IN_DIVISION;
    }
    return out;
}

/** Either proof is enough to delete without a reviewer. */
export const isProven = (f) => Boolean(f && (f.proven || f.provenByRepetition));

/**
 * `[Illustration]` markers that carry NOTHING — the stub alone on its
 * line, 205 of them across eleven works.
 *
 * These mark a plate the printed edition had and this one does not.
 * Rendered, the reader is shown the literal text "[Illustration]", which
 * is a broken frame written in words — the exact thing reverent
 * degradation forbids. A work that will not resolve is absent, never a
 * broken frame.
 *
 * ONLY THE BARE ONES. `[Illustration: “I'm the tallest”]` carries a
 * caption, and `[Illustration] BUTTERFLY DANCE` has its caption sitting
 * outside the bracket — deleting that marker would strand an all-capital
 * line between two paragraphs, which the compositor would then read as a
 * title. Removing furniture in a way that manufactures a heading is not
 * an improvement; it is R11's fault arriving by another door.
 */
export function illustrationStubsIn(content) {
    const lines = String(content || '').split('\n');
    const at = [];
    let cursor = 0;
    for (const line of lines) { at.push(cursor); cursor += line.length + 1; }

    const out = [];
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].trim() !== '[Illustration]') continue;

        let p = i - 1; while (p >= 0 && !lines[p].trim()) p--;
        let n = i + 1; while (n < lines.length && !lines[n].trim()) n++;

        out.push({
            start: p >= 0 ? at[p] + lines[p].replace(/\s+$/, '').length : 0,
            end: n < lines.length ? at[n] : String(content).length,
            text: '[Illustration]',
            // It stands BETWEEN paragraphs, never inside a sentence, so
            // the break it sat in is the break that stays.
            rejoin: '\n\n'
        });
    }
    return out;
}

/** A span that is nothing but a bare illustration stub. */
export function isIllustrationStub(span) {
    return String(span || '').replace(/\s+/g, ' ').trim() === '[Illustration]';
}

/**
 * ORPHANED PLATE CAPTIONS — a short line standing alone between two
 * paragraphs, ending in a `]` that nothing ever opened.
 *
 * Vitruvius carries 33: `ATHENS]`, `ROME]`, `EXAMPLE OF OPUS INCERTUM.
 * THE CIRCULAR TEMPLE AT TIVOLI]`, `(From his edition of Vitruvius,
 * Venice, 1511)]`. They are the illustration apparatus of the 1914
 * Harvard edition — captions and credits for plates this text does not
 * carry — and the scan folded them into Morgan's prose. It is §2c's
 * `[Illustration]` case one step further along: not a marker for an
 * absent plate but the plate's CAPTION, left behind.
 *
 * THREE CONSTRAINTS, EACH LOAD-BEARING.
 *
 * STANDING ALONE, because `in a]l` and `And al] the ground` in the
 * Metamorphoses are OCR misreads of the letter l, sitting inside
 * sentences. Removing that bracket would be a REPAIR, which §4 forbids
 * outright.
 *
 * BUT THE STANDALONE RULE IS NOT WHAT PROTECTS THEM, and the first
 * version of this comment said it was. A misread on a SHORT LINE OF ITS
 * OWN would pass every test here — which a unit test demonstrated the
 * moment it was written. What actually protects the Metamorphoses is
 * that this class runs against an ALLOWLIST of works whose orphan lines
 * have been read (`ORPHAN_CAPTION_WORKS` in corpus-cleanse.mjs). The
 * shape rules narrow the question; the allowlist is the guarantee.
 *
 * NOTHING OPEN, because a stage direction spans lines and its closing
 * line looks unbalanced while being perfectly matched.
 *
 * AND BY WORK, because the class is not one class. The Little Clay
 * Cart's 80 are footnote anchors (`P. 4.7]`); Pride and Prejudice's are
 * chapter marks and a copyright line. A rule that cannot tell those from
 * a plate caption does not get to delete any of them.
 */
export function orphanCaptionsIn(content) {
    const lines = String(content || '').split('\n');
    const at = [];
    let cursor = 0;
    for (const line of lines) { at.push(cursor); cursor += line.length + 1; }

    const out = [];
    let depth = 0;
    for (let i = 0; i < lines.length; i++) {
        const t = lines[i].trim();
        if (!t) { depth = 0; continue; }
        const opens = (t.match(/\[/g) || []).length;
        const closes = (t.match(/\]/g) || []).length;

        const alone = (i === 0 || !lines[i - 1].trim())
            && (i === lines.length - 1 || !lines[i + 1].trim());

        if (alone && !depth && closes > opens && t.length <= 60) {
            let p = i - 1; while (p >= 0 && !lines[p].trim()) p--;
            let n = i + 1; while (n < lines.length && !lines[n].trim()) n++;
            out.push({
                start: p >= 0 ? at[p] + lines[p].replace(/\s+$/, '').length : 0,
                end: n < lines.length ? at[n] : String(content).length,
                text: t,
                // It stands BETWEEN paragraphs; the break it sat in stays.
                rejoin: '\n\n'
            });
        }
        depth = Math.max(0, depth + opens - closes);
    }
    return out;
}

/** A span that is nothing but one orphaned caption line. */
export function isOrphanCaption(span) {
    const t = String(span || '').replace(/\s+/g, ' ').trim();
    if (!t || t.length > 60) return false;
    return (t.match(/\]/g) || []).length > (t.match(/\[/g) || []).length;
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
