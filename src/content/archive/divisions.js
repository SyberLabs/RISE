/**
 * Divisions — where a long work naturally breaks.
 *
 * A book is not one reading. The Mahabharata is 2.9 million words;
 * handed to the Chamber whole it is not a text but a wall. So a reader
 * enters at a division — a chapter, a canto, a night, an essay — and
 * the work presents itself the way its own tradition divides it.
 *
 * WHY THIS DOES NOT TRUST THE INGEST
 * ──────────────────────────────────
 * Each generated work already carries a `sections` array, and it would
 * be far less code to render those. They cannot be shown to a reader.
 * The ingest's heading detector fires on any line that looks vaguely
 * like a title, so 27% of the corpus's 9,212 section names are prose
 * caught mid-sentence — War and Peace alternates real chapters with
 * "part. Anna Pávlovna Schérer on the contrary, despite her forty
 * years," and the Divine Comedy has four Cantos followed by 36,331
 * words called "Day was departing, and the embrowned air".
 *
 * The discipline here is the Chapel's (handoff.js): a division is a
 * DISPLAY-SIDE SELECTION over the work's own text, and a boundary that
 * cannot be verified is refused rather than approximated. A work whose
 * divisions do not survive verification is offered whole, honestly,
 * instead of being cut at invented seams.
 *
 * WHAT MAKES A DIVISION SCHEME REAL
 * ─────────────────────────────────
 * One heading-shaped line proves nothing; a SCHEME proves itself. A
 * genuine one repeats, is numbered, and ascends. "CHAPTER I" followed
 * by "CHAPTER II" followed by "CHAPTER III" is a structure. A single
 * capitalised line in the middle of a paragraph is not, however much
 * it resembles a title. That is the test the ingest never applied and
 * the reason its output cannot be shown.
 */

/**
 * Division vocabularies, in the tradition of the work itself.
 *
 * Dante has cantos, Scheherazade has nights, Montaigne has essays. A
 * reader browsing the Decameron should not be told it has "chapters" —
 * the word is part of the work, and flattening every division to the
 * same noun is the kind of small wrongness that accumulates into a
 * generic product.
 */
const DIVISION_WORDS = [
    'chapter', 'canto', 'book', 'section', 'part', 'act', 'scene',
    'essay', 'tale', 'night', 'letter', 'psalm', 'hymn', 'ode',
    'fable', 'story', 'sonnet', 'idyll', 'fytte', 'lecture',
    // THE INGEST KNEW THESE AND THE READER DID NOT. The acquisition
    // list has always contained RUNE, ADVENTURE, POEM, DAY and VOLUME,
    // so the Kalevala's fifty runes and the Nibelungenlied's thirty-nine
    // adventures were found, cut, and named correctly in the payload —
    // and then arrived on the shelf as anonymous "Readings", because
    // THIS list could not parse the names the other one had written.
    // Two vocabularies for one job, and only one of them was maintained.
    'rune', 'runo', 'adventure', 'poem', 'day', 'volume'
];

/** Roman numerals, strictly — `I` through `MMMCMXCIX`, and not "I" the pronoun. */
const ROMAN = '(?=[MDCLXVI])M{0,4}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})';

/**
 * A numbered heading: a division word, then an ordinal, then optionally
 * a title. Anchored to the start of a line and case-insensitive on the
 * word because editions differ ("CHAPTER I", "Chapter 1", "Canto XI.").
 */
const NUMBERED = new RegExp(
    `^\\s*(${DIVISION_WORDS.join('|')})\\s+(${ROMAN}|\\d{1,4})\\b\\s*[.:—–-]?\\s*(.*)$`,
    'i'
);

/** A bare ordinal on its own line — common in poetry and collections. */
const BARE_ORDINAL = new RegExp(`^\\s*(${ROMAN}|\\d{1,4})\\s*[.:]?\\s*$`);

/** Named front and back matter, which are divisions but carry no number. */
const MATTER = /^\s*(front\s+matter|contents|preface|foreword|introduction|prologue|epilogue|afterword|appendix|notes|glossary|index|dedication|colophon)\b/i;

/** Roman numeral → integer. Returns NaN for anything malformed. */
export function romanValue(text) {
    const s = String(text || '').toUpperCase();
    if (!/^[MDCLXVI]+$/.test(s)) return NaN;
    const V = { M: 1000, D: 500, C: 100, L: 50, X: 10, V: 5, I: 1 };
    let total = 0;
    for (let i = 0; i < s.length; i++) {
        const here = V[s[i]];
        const next = V[s[i + 1]];
        total += next > here ? -here : here;
    }
    return total;
}

/** The ordinal a heading carries, as a number. NaN when it carries none. */
function ordinalOf(token) {
    if (token == null) return NaN;
    const t = String(token).trim();
    if (/^\d+$/.test(t)) return parseInt(t, 10);
    return romanValue(t);
}

/**
 * Every heading-shaped line in the text, with where it sits.
 *
 * "Shaped like" is all this claims. Whether these lines constitute a
 * real scheme is decided by `schemesIn`, which is the part that
 * matters — this is deliberately permissive so the evidence exists to
 * judge, and deliberately line-anchored so prose mid-paragraph cannot
 * qualify however it is capitalised.
 */
export function headingCandidates(text) {
    if (typeof text !== 'string' || !text) return [];
    const out = [];
    const lines = text.split('\n');
    let offset = 0;

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const raw = line.trim();
        const start = offset;
        offset += line.length + 1;

        if (!raw || raw.length > 90) continue;
        // A heading stands alone. Requiring blank space above it is what
        // keeps a sentence that merely begins with "Book" from counting.
        const blankAbove = i === 0 || !lines[i - 1].trim();
        if (!blankAbove) continue;

        const numbered = raw.match(NUMBERED);
        if (numbered) {
            const ordinal = ordinalOf(numbered[2]);
            if (Number.isFinite(ordinal) && titleIsPlausible(numbered[3])) {
                out.push({
                    index: start,
                    word: numbered[1].toLowerCase(),
                    ordinal,
                    // The numeral AS THE EDITION WROTE IT. Dante's
                    // cantos are XI, not 11; rendering every division
                    // in arabic would be a small unfaithfulness applied
                    // several thousand times.
                    numeral: numbered[2].trim(),
                    title: numbered[3].trim(),
                    text: raw,
                    kind: 'numbered'
                });
                continue;
            }
        }

        const bare = raw.match(BARE_ORDINAL);
        if (bare) {
            const ordinal = ordinalOf(bare[1]);
            if (Number.isFinite(ordinal)) {
                out.push({
                    index: start, word: null, ordinal,
                    numeral: bare[1].trim(), title: '', text: raw, kind: 'bare'
                });
                continue;
            }
        }

        if (MATTER.test(raw)) {
            out.push({ index: start, word: null, ordinal: NaN, title: raw, text: raw, kind: 'matter' });
        }
    }
    return out;
}

/**
 * Drop a misnamed head from a run of headings.
 *
 * The ingest names a section after a heading found INSIDE it, and for
 * front matter that heading is whatever the contents page happened to
 * list last. So the Odyssey's title page arrives named "BOOK XXIV." and
 * the ordinals read 24, 1, 2, 3 … — which passes an ascent test,
 * because everything after the first item ascends perfectly, and then
 * opens the work at Book XXIV.
 *
 * A book's numbering STARTS AT ITS LOWEST NUMBER. That is the whole
 * rule, and it has to be exactly this narrow: the first attempt kept
 * the longest consecutive run instead, and since Moby-Dick's chapters
 * skip from 16 to 18, the longest run began at 18 and buried the first
 * sixteen chapters in front matter. Irregularity inside a work is
 * normal and already tolerated; only the head is trimmed.
 */
function trimToRun(items) {
    if (items.length < 2) return items;
    let lowestAt = 0;
    for (let i = 1; i < items.length; i++) {
        if (items[i].ordinal < items[lowestAt].ordinal) lowestAt = i;
    }
    return items.slice(lowestAt);
}

/**
 * Is what follows the numeral a TITLE, or the rest of a sentence?
 *
 * The Odyssey's sections include "Book i., is continued to the end of
 * Book iv., and not resumed till" — a cross-reference from an editor's
 * note, which opens exactly like a heading and then keeps talking. The
 * numeral is real; the line is not a division.
 *
 * A title begins. It does not continue: it never opens with a comma or
 * a conjunction, and an edition that titles its chapters capitalises
 * them. Anything else is the middle of a sentence that happened to
 * start with the word "Book".
 */
function titleIsPlausible(title) {
    const t = String(title || '').trim();
    if (!t) return true;                       // a bare heading is fine
    if (/^[,;:)\]]/.test(t)) return false;      // continues a clause
    return /^["'“‘(\[]?[A-Z0-9]/.test(t);
}

/**
 * Does this run of ordinals look like a book's numbering?
 *
 * A BARE number on its own line is the weakest evidence in the file:
 * it is also how a date, a page number, or a footnote marker appears.
 * "Strange Stories from a Chinese Studio" was divided into "Part 1880"
 * and "Part 1881" because its notes cite years, each on its own line,
 * ascending. Nothing local distinguishes those from divisions — but a
 * book's numbering starts at its beginning and does not reach four
 * digits, and a year does both.
 *
 * Named schemes ("Chapter 12") carry their own evidence in the word and
 * are held to the looser bound.
 */
function plausibleNumbering(word, items) {
    const ordinals = items.map(i => i.ordinal);
    const first = Math.min(...ordinals);
    const last = Math.max(...ordinals);
    if (!word) return first <= 3 && last < 1000;
    return first <= 5;
}

/** How many of a run's ordinals ascend by one from their predecessor. */
function ascendingRatio(items) {
    if (items.length < 2) return 0;
    let steps = 0;
    for (let i = 1; i < items.length; i++) {
        if (items[i].ordinal === items[i - 1].ordinal + 1) steps++;
    }
    return steps / (items.length - 1);
}

/**
 * The division schemes a text actually contains.
 *
 * Candidates are grouped by their division word and judged as a group.
 * A scheme must repeat (a lone "Chapter I" divides nothing), must
 * mostly ascend (real numbering counts up; coincidence does not), and
 * must not be so sparse that it leaves most of the work in one piece.
 *
 * Returned strongest first, so a work using both books and chapters
 * offers the finer of the two.
 */
export function schemesIn(text, { minCount = 3, minAscending = 0.6 } = {}) {
    const candidates = headingCandidates(text).filter(c => Number.isFinite(c.ordinal));
    const byWord = new Map();
    for (const c of candidates) {
        const key = c.word || '#';
        if (!byWord.has(key)) byWord.set(key, []);
        byWord.get(key).push(c);
    }

    const schemes = [];
    for (const [word, items] of byWord) {
        if (items.length < minCount) continue;
        if (!plausibleNumbering(word === '#' ? null : word, items)) continue;
        const ascending = ascendingRatio(items);
        if (ascending < minAscending) continue;
        schemes.push({
            word: word === '#' ? null : word,
            count: items.length,
            ascending,
            items: trimToRun(items)
        });
    }
    schemes.sort((a, b) => (b.ascending * b.count) - (a.ascending * a.count));
    return schemes;
}

/** Words in a string, counted the way the reading pace counts them. */
const wordsIn = (s) => (s ? s.split(/\s+/).filter(Boolean).length : 0);

/**
 * A division that outgrew its own heading is split at paragraph breaks.
 *
 * Montaigne's largest section is 82,000 words and Cherokee Myths' is
 * 57,000 — an hour of reading with nowhere to stop. Splitting happens
 * ONLY at blank lines, because a paragraph boundary is the author's
 * and a character offset is ours. The parts are numbered rather than
 * named: inventing a title for a fragment its author never titled
 * would be a claim about the text, and the Archive does not make
 * claims about texts it has only measured.
 */
export function splitLongDivision(content, { maxWords = 4000 } = {}) {
    const total = wordsIn(content);
    if (total <= maxWords) return [content];

    const paragraphs = content.split(/\n\s*\n/);
    // Aim for equal parts rather than filling each to the brim, so the
    // last one is not a stub.
    const parts = Math.ceil(total / maxWords);
    const target = Math.ceil(total / parts);

    // NO PART MAY BE A STUB, wherever it falls.
    //
    // A plain greedy fill flushes the moment the next paragraph would
    // overshoot, which strands whatever happens to be in the buffer.
    // That produced Vitruvius's "Book III (3 of 3)" at 164 characters
    // — a runt at the tail — and then Paradise Lost's "Book I (1 of 2)"
    // at 91, a runt at the HEAD, because the book opens with a short
    // argument before its first long verse paragraph. A floor on every
    // part is the general fix; merging the tail afterwards was only
    // ever the special case of it.
    const floor = Math.max(200, target / 3);

    const out = [];
    let buffer = [];
    let count = 0;
    for (const paragraph of paragraphs) {
        const w = wordsIn(paragraph);
        // Keep a paragraph whole even when it overshoots: an author's
        // unit survives intact, and a slightly long part reads better
        // than a sentence cut in half.
        if (count >= floor && count + w > target) {
            out.push(buffer.join('\n\n'));
            buffer = [];
            count = 0;
        }
        buffer.push(paragraph);
        count += w;
    }
    if (buffer.length) out.push(buffer.join('\n\n'));

    const parted = out.filter(part => part.trim());
    // The final part answers to no overshoot test, so it is the one
    // place the floor cannot be enforced during the walk.
    if (parted.length > 1 && wordsIn(parted[parted.length - 1]) < floor) {
        parted[parted.length - 2] += `\n\n${parted.pop()}`;
    }
    return parted;
}

/**
 * A HEADING WITH NO BODY IS A CONTENTS LINE, NOT A DIVISION.
 *
 * Editions that print a table of acts or chapters before the text
 * repeat every heading, and the repeats survive as entries holding
 * nothing but themselves — The Little Clay Cart offered "Act I"
 * containing thirty-four characters, and twenty-two acts for a play
 * that has ten.
 *
 * Folded FORWARD, because a contents table precedes the work it
 * describes; a stray heading at the very end has nothing after it and
 * folds back instead. Shared by both division paths, since the first
 * fix went into only one of them and the work took the other.
 */
function foldEmptyDivisions(entries, minBodyChars = 200) {
    const kept = [];
    for (let i = 0; i < entries.length; i++) {
        const entry = entries[i];
        // 200 characters is not a number chosen here: it is the bar
        // archive.test.js has always used for "suspiciously short",
        // i.e. the Archive's own standing definition of a reading unit
        // that stands alone. Using anything else would be two answers
        // to one question.
        const body = entry.content.length - entry.label.length;
        if (body >= minBodyChars) {
            kept.push(entry);
            continue;
        }
        const next = entries[i + 1];
        if (next) {
            next.content = `${entry.content}

${next.content}`;
            next.words += entry.words;
        } else if (kept.length) {
            const prev = kept[kept.length - 1];
            prev.content += `

${entry.content}`;
            prev.words += entry.words;
        }
    }
    kept.forEach((entry, i) => { entry.id = i; });
    return kept;
}

/** Title Case for a division word, for display. */
const capitalise = (w) => w ? w[0].toUpperCase() + w.slice(1) : w;

/**
 * Divide a work into readable entries.
 *
 * Returns `{ divided, noun, entries }`. When no scheme verifies,
 * `divided` is false and the work is returned as a single entry — the
 * reverent outcome, and the honest one. A caller must never present an
 * undivided work as though it had chapters.
 *
 * @param {string} text the work's full text
 * @param {{maxWords?: number, minWords?: number}} [opts]
 */
export function divide(text, { maxWords = 4000, minWords = 12000 } = {}) {
    const whole = () => ({
        divided: false,
        noun: null,
        entries: [{ id: 1, label: 'Complete text', title: null, content: text, words: wordsIn(text) }]
    });

    if (typeof text !== 'string' || !text.trim()) return whole();
    // Short works are read whole. Dividing a 6,000-word essay into
    // chapters serves nobody.
    if (wordsIn(text) < minWords) return whole();

    const [scheme] = schemesIn(text);
    if (!scheme) return whole();

    const total = wordsIn(text);
    const noun = capitalise(scheme.word || 'Part');
    const marks = scheme.items;
    const entries = [];

    // Everything before the first heading is front matter when it is
    // substantial, and discarded whitespace when it is not.
    const preamble = text.slice(0, marks[0].index).trim();
    const preambleWords = wordsIn(preamble);

    // A SCHEME THAT BEGINS TOO LATE IS NOT THE WORK'S SCHEME.
    //
    // The Mahabharata's prose contains 263 bare ascending numerals —
    // footnote markers, not divisions — and they pass every local test:
    // they repeat, they count up, they sit on their own lines. Taken as
    // headings they yield a "front matter" of 1,294,418 words followed
    // by scraps, because the first of them appears 44% of the way in.
    // Coverage is what distinguishes a division scheme from a pattern
    // that merely occurs inside one.
    if (preambleWords > total * 0.3) return whole();

    if (preambleWords > 200) {
        // Front matter is a division like any other and obeys the same
        // ceiling; leaving it whole was how an unbounded entry reached
        // the reader in the first place.
        for (const part of splitLongDivision(preamble, { maxWords })) {
            entries.push({
                id: entries.length, label: 'Front matter', title: null,
                content: part, words: wordsIn(part)
            });
        }
        if (entries.length > 1) {
            entries.forEach((e, k) => { e.label = `Front matter (${k + 1} of ${entries.length})`; });
        }
    }

    for (let i = 0; i < marks.length; i++) {
        const from = marks[i].index;
        const to = i + 1 < marks.length ? marks[i + 1].index : text.length;
        const body = text.slice(from, to).trim();
        if (!body) continue;

        const label = `${noun} ${marks[i].numeral ?? marks[i].ordinal}`;
        const parts = splitLongDivision(body, { maxWords });
        parts.forEach((part, k) => {
            entries.push({
                id: entries.length,
                label: parts.length > 1 ? `${label} (${k + 1} of ${parts.length})` : label,
                title: marks[i].title || null,
                ordinal: marks[i].ordinal,
                content: part,
                words: wordsIn(part)
            });
        });
    }

    const kept = foldEmptyDivisions(entries);
    if (kept.length < 2) return whole();
    return { divided: true, noun, entries: kept };
}

/**
 * Parse a single heading string — a section NAME rather than a line of
 * body text. Returns null when the string is not a heading.
 */
export function parseHeading(name) {
    // A MULTI-VOLUME WORK PREFIXES ITS OWN DIVISIONS. The ingest names
    // sections "Volume 1 — CHAPTER XII…" when an acquisition spans
    // several files, and the prefix belongs to the edition rather than
    // to the heading.
    const raw = String(name || '').trim().replace(/^Volume\s+\d+\s*[—–-]\s*/i, '');
    if (!raw) return null;

    const numbered = raw.match(NUMBERED);
    if (numbered) {
        // THE LENGTH GUARD IS ABOUT PROSE, NOT ABOUT TITLES. Rejecting
        // any name over 90 characters also rejected Malory, whose
        // chapters are titled "CHAPTER XII. How King Pellinore rode
        // after the lady and the knight" — so Le Morte d'Arthur's names
        // parsed as nothing, the divider fell through to scanning the
        // prose, and found all 507 chapters twice: once in the
        // chapter-summary table Malory's edition prints before each
        // book, and once in the book itself.
        //
        // A line that opens with a division word, an ordinal, and a
        // capitalised title has already proved it is a heading. Length
        // is the wrong thing to disqualify it on; the guard stays for
        // the unnumbered forms below, where shape is all there is.
        const ordinal = ordinalOf(numbered[2]);
        if (raw.length <= 200 && Number.isFinite(ordinal) && titleIsPlausible(numbered[3])) {
            return {
                word: numbered[1].toLowerCase(), ordinal,
                numeral: numbered[2].trim(), title: numbered[3].trim(), kind: 'numbered'
            };
        }
    }
    // The unnumbered forms have only their shape to go on, so the
    // length guard still applies to them.
    if (raw.length > 90) return null;

    const bare = raw.match(BARE_ORDINAL);
    if (bare) {
        const ordinal = ordinalOf(bare[1]);
        if (Number.isFinite(ordinal)) {
            return { word: null, ordinal, numeral: bare[1].trim(), title: '', kind: 'bare' };
        }
    }
    if (MATTER.test(raw)) {
        return { word: null, ordinal: NaN, numeral: null, title: raw, kind: 'matter' };
    }
    return null;
}

/**
 * The dominant division scheme across a work's section names.
 *
 * Same evidence standard as schemesIn: a word that repeats and whose
 * ordinals ascend. Applied to names because THE INGEST STRIPS HEADINGS
 * FROM CONTENT — section "CHAPTER II" holds no occurrence of the words
 * "CHAPTER II" — so the name is the only witness to where a division
 * begins, and it is a witness that lies 27% of the time.
 */
export function schemeFromNames(names, { minCount = 3, minAscending = 0.5 } = {}) {
    const parsed = names.map((n, i) => ({ i, h: parseHeading(n) }));
    const byWord = new Map();
    for (const { i, h } of parsed) {
        if (!h || !Number.isFinite(h.ordinal)) continue;
        const key = h.word || '#';
        if (!byWord.has(key)) byWord.set(key, []);
        byWord.get(key).push({ i, ...h });
    }

    let best = null;
    for (const [word, items] of byWord) {
        if (items.length < minCount) continue;
        if (!plausibleNumbering(word === '#' ? null : word, items)) continue;
        const ascending = ascendingRatio(items);
        if (ascending < minAscending) continue;
        const score = ascending * items.length;
        if (!best || score > best.score) {
            best = {
                word: word === '#' ? null : word,
                items: trimToRun(items), ascending, score
            };
        }
    }
    return best;
}

/**
 * Divide a work from its generated sections.
 *
 * This is the entry point the Library uses. Sections whose names carry
 * the work's scheme OPEN a division; every section after one — the
 * prose fragments the ingest mistook for headings — is appended to it,
 * which is what reassembles War and Peace's chapters out of the 445
 * pieces the ingest left.
 *
 * @param {{name?: string, content?: string}[]} sections
 * @param {{maxWords?: number, minWords?: number}} [opts]
 * @returns {{divided: boolean, noun: string|null, entries: object[]}}
 */
export function divideSections(sections, { maxWords = 4000, minWords = 12000 } = {}) {
    const list = Array.isArray(sections) ? sections : [];
    const text = list.map(s => s?.content || '').join('\n\n');
    const total = wordsIn(text);

    const whole = (reason) => ({
        divided: false, noun: null, reason,
        entries: [{ id: 0, label: 'Complete text', title: null, content: text, words: total }]
    });

    if (!total) return whole('empty');
    if (total < minWords) return whole('short');

    const scheme = schemeFromNames(list.map(s => s?.name));
    if (!scheme) {
        // THE NAMES ARE NOT THE ONLY WITNESS. The ingest strips a
        // heading only where it chose to cut, so every heading it
        // MISSED is still sitting in the prose. Dante's names yield
        // four cantos out of a hundred; his text yields twenty-three,
        // which is a scheme, and twenty-three cantos read better than
        // ten anonymous readings of equal length.
        const inline = divide(text, { maxWords, minWords });
        if (inline.divided) return { ...inline, reason: 'inline' };

        // No verifiable scheme anywhere. A long work still needs
        // somewhere to stop, so it is cut at paragraph boundaries and
        // labelled as the measured thing it is — never as chapters it
        // does not have.
        if (total > maxWords * 2) {
            const parts = splitLongDivision(text, { maxWords });
            return {
                divided: true, noun: 'Reading', reason: 'measured',
                entries: parts.map((content, k) => ({
                    id: k, label: `Reading ${k + 1}`, title: null,
                    content, words: wordsIn(content)
                }))
            };
        }
        return whole('no-scheme');
    }

    const opens = new Map(scheme.items.map(it => [it.i, it]));
    const groups = [];
    for (let i = 0; i < list.length; i++) {
        const head = opens.get(i);
        if (head || !groups.length) {
            groups.push({ head: head || null, parts: [] });
        }
        const body = list[i]?.content || '';
        if (body.trim()) groups[groups.length - 1].parts.push(body);
    }

    const noun = capitalise(scheme.word || 'Part');
    const entries = [];
    for (const g of groups) {
        const content = g.parts.join('\n\n').trim();
        if (!content) continue;
        const label = g.head
            ? `${noun} ${g.head.numeral ?? g.head.ordinal}`
            : 'Front matter';
        const pieces = splitLongDivision(content, { maxWords });
        pieces.forEach((piece, k) => {
            entries.push({
                id: entries.length,
                label: pieces.length > 1 ? `${label} (${k + 1}/${pieces.length})` : label,
                title: g.head?.title || null,
                ordinal: g.head?.ordinal,
                content: piece,
                words: wordsIn(piece)
            });
        });
    }

    const substantial = foldEmptyDivisions(entries);
    if (substantial.length < 2) return whole('too-few');
    return { divided: true, noun, reason: 'scheme', entries: substantial };
}

/**
 * The division vocabulary a work DECLARES for itself.
 *
 * Every dossier entry carries a `structure / reading unit / bounds`
 * line written by a curator — "50 runos with verse lines; one runo;
 * runo heading to next" — and until now the ingest copied it into the
 * metadata and parsed with a fixed global word list instead.
 *
 * That list has twenty entries and contains neither `runo` nor `laisse`
 * nor `adventure`, so the Kalevala's fifty runos arrived as 36 anonymous
 * readings, the Nibelungenlied's thirty-nine adventures as 27, and the
 * Song of Roland's laisses as 291 "Parts" — the right count under the
 * wrong word.
 *
 * Widening the global list is the wrong fix: `runo` would then be
 * matchable in all seventy-four works, buying four books at the cost of
 * false positives everywhere. Scoping the vocabulary PER WORK does the
 * opposite — the Kalevala looks for runos and nothing else, Hamlet for
 * scenes and nothing else — so the search space shrinks from twenty
 * words to one and false positives collapse with it.
 *
 * A declaration is a hint, not an authority. It is prose written for a
 * human, so extraction is imperfect by construction, and several units
 * ("one numbered narrative", "one editorially mapped movement") name no
 * heading that appears in any text. Callers must therefore treat an
 * empty result — and a declared vocabulary that finds nothing — as a
 * reason to fall back, never as a reason to refuse.
 *
 * @param {{levels?: string[], readingUnit?: string}} structure
 * @returns {string[]} candidate division nouns, singular and lowercased
 */
export function declaredVocabulary(structure) {
    const out = [];
    const add = (word) => {
        if (!word) return;
        const w = String(word).toLowerCase().replace(/[^a-z]/g, '');
        if (w.length < 3) return;
        // Naive de-pluralisation is enough for this vocabulary; none of
        // these nouns has an irregular plural. A cleverer "-ses" rule
        // turned "laisses" into "laiss".
        const singular = w.endsWith('s') ? w.slice(0, -1) : w;
        if (!out.includes(singular)) out.push(singular);
    };

    const unit = String(structure?.readingUnit || '');
    // "one book", "one runo", "one scene/ode", "one play or scene"
    for (const m of unit.matchAll(/\b(?:one|each)\s+([a-z]+)/gi)) add(m[1]);
    // "a route of 10–20 laisses" — a count and a plural, no "one".
    for (const m of unit.matchAll(/\b\d+\s+([a-z]+s)\b/gi)) add(m[1]);
    // "one scene/ode" — the alternative after a slash.
    for (const m of unit.matchAll(/\/([a-z]+)/gi)) add(m[1]);

    // The levels are consulted ONLY when the reading unit yielded
    // nothing. Adding them unconditionally widens each work's search
    // straight back out — "trilogy", "choral", "frame", "machine",
    // "detectable" — which is the opposite of the point of scoping it.
    if (!out.length) {
        for (const level of structure?.levels || []) {
            for (const m of String(level).matchAll(/\b([a-z]{3,})\b/gi)) add(m[1]);
        }
    }
    return out;
}

/**
 * Words that describe a unit without ever appearing as a heading.
 * Kept out of a work's vocabulary so a declaration cannot narrow the
 * search to a term the text never uses.
 */
const NON_HEADING = new Set([
    'one', 'each', 'complete', 'declared', 'editorially', 'mapped', 'named',
    'curated', 'numbered', 'route', 'while', 'with', 'and', 'the', 'its',
    'pair', 'cluster', 'variant', 'variants', 'metadata', 'teller', 'day',
    'riddle', 'return', 'present', 'where', 'beat', 'marked', 'editor',
    'ordinary', 'reading', 'rsvp', 'nested', 'addressable', 'remains',
    'narrative', 'movement', 'tradition', 'entry', 'arc', 'blocks',
    'retained', 'speech', 'lines', 'verse', 'containing', 'titled'
]);

/** A work's declared vocabulary, filtered to words that can be headings. */
export function headingVocabulary(structure) {
    return declaredVocabulary(structure).filter(w => !NON_HEADING.has(w));
}
