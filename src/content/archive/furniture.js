/**
 * Page furniture — what the printed page left behind in the text.
 *
 * Single detector vocabulary for job builder, cleanser, and tests.
 * Spec: `docs/specs/ARCHIVE-CLEANSING-SPEC` §2b. Identifies only; never
 * edits. Callers decide what to do with a span; only the cleanser deletes.
 */

/**
 * A running head: a short line of capitals ending in a page number.
 *
 * Stem must carry three consecutive capitals so shapes like Hamlet's
 * `I  2` or Shahnama's `V, 82` are not treated as headings.
 */
export const RUNNING_HEAD = /^(?=[A-Z'’ .,\-]*[A-Z]{3})([A-Z][A-Z'’ .,\-]{2,44}?)\s+(\d{1,4})$/;

/** A line that is nothing but a page number — the verso half. */
export const BARE_NUMERAL = /^\d{1,4}$/;

/** A finished sentence says so. Closing quotes and brackets count. */
export const ENDS_A_SENTENCE = /[.!?…][")'\]]*$/;

/**
 * A stem seen once is a line, not a header. Three work-wide repeats
 * before a candidate is considered; the heading case scores one.
 */
export const MIN_REPEATS = 3;

/**
 * Repetition proof inside one division.
 *
 * Positional proof needs a lower-case continuation after the furniture;
 * verse often cannot supply that. Frequency within a division separates
 * header from heading: a chapter title appears once; a running head
 * repeats with different page numbers. Threshold is three; a true
 * heading scores one.
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
 * the start of the next one, swallowing blank lines and any adjacent
 * bare numeral — a printed opening leaves both numbers behind.
 *
 * `proven` is the §2b positional test (clause before unfinished; word
 * after continues lower case) and licenses deletion without a reviewer.
 * `rejoin` asks only whether the sentence had ended — joining separate
 * paragraphs would be an edit, not a deletion.
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
            // Filled once the whole division has been read.
            provenByRepetition: false,
            rejoin: unfinished ? ' ' : '\n\n'
        });
    }

    // Repetition proof: a stem with three or more different page numbers
    // in this division is a header of these pages, not the division title.
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
 * Bare `[Illustration]` stubs — marker alone on its line.
 *
 * Marks a plate the printed edition had and this one does not. Showing
 * the literal text is a broken frame; absent plates stay absent.
 *
 * Only bare stubs. Captioned forms (`[Illustration: …]` or a caption
 * outside the bracket) must stay — removing the marker would strand an
 * all-caps line the compositor would treat as a title.
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
            // Between paragraphs; keep that break.
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
 * Orphaned plate captions — a short standalone line ending in `]` with
 * no matching open bracket (scan leftovers from absent plates).
 *
 * Shape rules (alone, nothing open, length ≤ 60) narrow candidates;
 * deletion is gated by an allowlist of works whose orphan lines have
 * been read (`ORPHAN_CAPTION_WORKS` in corpus-cleanse.mjs). Standalone
 * alone is not enough — OCR misreads on short lines can match the shape.
 * Per-work because the class is not one class (footnote anchors,
 * chapter marks, etc. look similar).
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
                // Between paragraphs; keep that break.
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
 * Is this span safe to delete? Collapsed to one line, it must be the
 * furniture and nothing else. Last gate: unproven spans are never taken.
 */
export function isStrictlyFurniture(span) {
    return FURNITURE_ONLY.test(String(span || '').replace(/\s+/g, ' ').trim());
}
