/**
 * Binding a Journey passage to the text it claims.
 *
 * JOURNEYS-SPEC §1.3 requires a passage to preserve its exact edition
 * and translator, its exact locator and excerpt bounds, its payload
 * checksum, its language, and its editorial role. §1.4 adds the rule
 * that makes those possible to honour:
 *
 *   "A reading unit is the smallest stable authored or source-defined
 *    division that can stand alone."
 *
 * So a passage does not carry text. It carries a LOCATOR — a work and
 * one of that work's own divisions — and this module resolves it
 * against the Archive at launch. The text of Paradise Lost Book VI
 * lives in exactly one place, and a Journey citing it holds a reference
 * rather than a copy.
 *
 * WHY NOT STORE THE EXCERPT
 * ─────────────────────────
 * A stored copy is a second thing to keep true, and this Archive has
 * already been burned by exactly that: a provenance record that drifted
 * from the text it described, and a shelf that served Conrad Aiken
 * under Aeschylus's name for want of anything comparing the two. A
 * resolved reference cannot drift, because there is only one text.
 *
 * The checksum therefore verifies the binding rather than transporting
 * it: a passage records what it resolved to when it was authored, and
 * a mismatch at launch is a refusal (§1.5, reverent degradation). A
 * Journey whose sources have changed underneath it is not a Journey
 * with slightly different words; it is an argument about a text that no
 * longer exists.
 */

import { ingestedArchiveTexts } from '../archive/index.js';

export class PassageResolutionError extends Error {
    constructor(code, message, details = {}) {
        super(message);
        this.name = 'PassageResolutionError';
        this.code = code;
        this.details = details;
    }
}

/** SHA-256 of a string, hex. Available in browsers and Node 20+. */
async function sha256Hex(text) {
    if (!globalThis.crypto?.subtle) {
        throw new PassageResolutionError('NO_CRYPTO', 'SHA-256 is unavailable in this runtime.');
    }
    const digest = await globalThis.crypto.subtle.digest(
        'SHA-256', new TextEncoder().encode(text));
    return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * The entries of a work that belong to one named division.
 *
 * A division may arrive split — the Iliad's Book II is long enough that
 * the divider offers it as "Book II (1/3)" through "(3/3)" — and a
 * passage citing "Book II" means the book, not a third of it. Matching
 * the label and its parenthesised parts keeps the citation editorial
 * rather than an artefact of how long the book happened to be.
 */
export function entriesForDivision(entries, division) {
    const wanted = String(division || '').trim();
    if (!wanted) return [];
    return entries.filter(entry => {
        const label = entry.label || '';
        return label === wanted || label.startsWith(`${wanted} (`);
    });
}

/**
 * Resolve one passage against the Archive.
 *
 * @param {{id: string, workId: string, division: string}} passage
 * @returns {Promise<{id, workId, division, text, words, checksum, edition, title}>}
 */
/**
 * A DISCLOSED ROUTE THROUGH A READING UNIT (JOURNEYS-SPEC §1.4).
 *
 * The spec permits an excerpt and states the condition exactly: a
 * Journey "may use a disclosed route through a reading unit, but it may
 * not silently store or present an excerpt as though it were the
 * complete holding." So the route is a LOCATOR like everything else
 * here — never stored text — and the passage says openly which part of
 * the division it takes.
 *
 * BY QUOTATION, NOT BY OFFSET. The obvious primitive is a character or
 * line range, and it is the wrong one for this Archive. Our Iliad is a
 * prose translation hard-wrapped at 71 columns, so its "lines" are an
 * artefact of the file rather than anything Homer or the translator
 * chose, and an offset is a number nobody can check by reading. An
 * anchor is the text itself:
 *
 *     from: 'So spake Hector of the glancing helm and departed'
 *
 * An editor can verify that against a printed page; it survives
 * whitespace normalisation; and when it stops matching it says so
 * rather than sliding quietly to a different scene. Same principle as
 * the passage checksum, and the same one the Experience Program's
 * quoteStart/quoteEnd anchors are specified to use.
 *
 * Refusal, not approximation: an anchor that cannot be found is an
 * error. Falling back to the whole division would present a route as
 * the holding, which is the one thing §1.4 forbids.
 */
function applyExcerpt(text, excerpt, context) {
    if (!excerpt || typeof excerpt !== 'object') return text;
    const from = typeof excerpt.from === 'string' ? excerpt.from.trim() : '';
    const to = typeof excerpt.to === 'string' ? excerpt.to.trim() : '';
    if (!from && !to) return text;

    // Anchors match against whitespace-flattened text, so a line break
    // inside a quoted phrase cannot defeat it. `offsets` maps each
    // flattened character back to the original, which keeps the
    // excerpt's own paragraphing intact.
    const flatten = (value) => value.replace(/\s+/g, ' ');
    let flat = '';
    const offsets = [];
    let previousWasSpace = false;
    for (let i = 0; i < text.length; i += 1) {
        const isSpace = /\s/.test(text[i]);
        if (isSpace) {
            if (previousWasSpace || flat.length === 0) continue;
            flat += ' ';
        } else {
            flat += text[i];
        }
        offsets.push(i);
        previousWasSpace = isSpace;
    }

    const openAt = from ? flat.indexOf(flatten(from)) : 0;
    if (openAt < 0) {
        throw new PassageResolutionError('EXCERPT_ANCHOR_NOT_FOUND',
            `The opening anchor was not found in ${context.division}.`,
            { ...context, anchor: from });
    }
    const closing = to ? flatten(to) : '';
    const closeAt = to ? flat.indexOf(closing, openAt + 1) : -1;
    if (to && closeAt < 0) {
        throw new PassageResolutionError('EXCERPT_ANCHOR_NOT_FOUND',
            `The closing anchor was not found after the opening one in ${context.division}.`,
            { ...context, anchor: to });
    }

    const start = offsets[openAt] ?? 0;
    const end = to
        ? (offsets[closeAt + closing.length - 1] ?? text.length - 1) + 1
        : text.length;
    const route = text.slice(start, end).trim();
    if (!route) {
        throw new PassageResolutionError('EXCERPT_EMPTY',
            `The route through ${context.division} resolved to nothing.`, context);
    }
    return route;
}

export async function resolvePassage(passage, texts = null) {
    const id = passage?.id;
    const workId = passage?.workId;
    if (!id || !workId) {
        throw new PassageResolutionError('PASSAGE_MALFORMED',
            'A passage needs an id and a workId.', { id, workId });
    }

    const work = (texts || ingestedArchiveTexts()).find(t => t.id === workId);
    if (!work) {
        throw new PassageResolutionError('WORK_NOT_FOUND',
            `The Archive holds no work called ${workId}.`, { id, workId });
    }

    const divisions = await work.getDivisions();
    const entries = entriesForDivision(divisions.entries, passage.division);
    if (!entries.length) {
        // Refusal, not approximation: offering a neighbouring division
        // would change the argument without saying so.
        throw new PassageResolutionError('DIVISION_NOT_FOUND',
            `${workId} has no division called "${passage.division}".`,
            { id, workId, division: passage.division, noun: divisions.noun });
    }

    const whole = entries.map(entry => entry.content).join('\n\n');
    // The excerpt is applied BEFORE the checksum, because the checksum
    // must describe what a reader actually reads. A digest of the whole
    // division would verify a text the Journey never presents.
    const text = applyExcerpt(whole, passage.excerpt,
        { id, workId, division: passage.division });
    const excerpted = text.length !== whole.length;
    const words = excerpted
        ? text.split(/\s+/).filter(Boolean).length
        : entries.reduce((n, entry) => n + entry.words, 0);
    const checksum = await sha256Hex(text);

    return {
        id,
        workId,
        division: passage.division,
        label: passage.label || entries[0].label,
        role: passage.role || null,
        language: passage.language || 'en',
        title: work.title,
        author: work.author,
        edition: work.tradition,
        provenance: work.provenance || null,
        parts: entries.length,
        // DISCLOSURE, carried with the passage rather than left implicit.
        // §1.4: an excerpt may never be presented as the whole holding,
        // so every surface showing a credit can say which this is.
        excerpted,
        excerptNote: excerpted ? (passage.excerpt?.note || null) : null,
        wholeWords: entries.reduce((n, entry) => n + entry.words, 0),
        words,
        checksum,
        text
    };
}

/**
 * Resolve every passage a Journey names, in reading order.
 *
 * Reports rather than throws, so a caller can show which passages are
 * ready and which are not.
 */
export async function resolveJourneyPassages(passages, texts = null) {
    const resolved = [];
    const failures = [];
    const pool = texts || ingestedArchiveTexts();

    for (const passage of passages || []) {
        try {
            resolved.push(await resolvePassage(passage, pool));
        } catch (error) {
            failures.push({
                passageId: passage?.id || null,
                code: error.code || 'UNKNOWN',
                message: error.message
            });
        }
    }
    return { resolved, failures, ready: failures.length === 0 };
}

/**
 * Check resolved passages against the checksums recorded when they were
 * authored.
 *
 * An unrecorded checksum is not a failure — a passage may be authored
 * before its binding is pinned — but a MISMATCH is, because it means
 * the text moved under an argument written about it.
 */
export function verifyPassageChecksums(resolvedPassages, expected = {}) {
    const drifted = [];
    for (const passage of resolvedPassages) {
        const want = expected[passage.id];
        if (!want) continue;
        if (want !== passage.checksum) {
            drifted.push({ passageId: passage.id, expected: want, actual: passage.checksum });
        }
    }
    return { drifted, intact: drifted.length === 0 };
}
