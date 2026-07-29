/**
 * Archive ingest — public-domain works into Library payload modules.
 *
 * Sibling to scripts/chapel-ingest.mjs, which ingests ONE source of
 * known shape. The Archive is the opposite problem: many sources, each
 * with its own structure, arriving over time. So the per-work knowledge
 * lives in a WORKS table below and the machinery is shared.
 *
 * THE CONTRACT (LIBRARY-SPEC §4, SOL acquisitions dossier)
 * ────────────────────────────────────────────────────────
 * Every ingested work carries, in the generated module and in the
 * manifest this prints:
 *
 *   the exact edition   translator/editor, publisher, year
 *   the source artifact URL, retrieval date, and SHA-256 of the file
 *                       AS FETCHED — before any of our processing
 *   the rights basis    one of PD_BASIS, with evidence naming the
 *                       edition rather than the author
 *   a payload checksum  over the exact string a session receives
 *
 * The source digest and the payload checksum are different promises.
 * The first says "this is the file the world served us"; the second
 * says "this is what we made of it". Losing either makes the other
 * unverifiable.
 *
 * WHY THE SOURCE DIGEST MATTERS HERE
 * ──────────────────────────────────
 * On 2026-07-28 six works were withheld because their recorded
 * translator was invented rather than read. A digest cannot prevent
 * that, but it makes the claim falsifiable: anyone can re-fetch the
 * artifact and check whether the edition we cite is the edition we
 * processed. Provenance that cannot be checked is not provenance.
 *
 * Usage:
 *   node scripts/archive-ingest.mjs --list
 *   node scripts/archive-ingest.mjs vitruvius
 *   node scripts/archive-ingest.mjs vitruvius --dry-run
 *
 * Sources are cached in .ingest-cache/ (gitignored). Delete to re-fetch.
 */

import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CACHE = resolve(ROOT, '.ingest-cache');
const OUT = resolve(ROOT, 'src/content/archive/works');

// ── The works ───────────────────────────────────────────────────────
// Each entry states its edition and rights BEFORE its parsing, because
// the rights are the reason we may parse it at all.

const WORKS = {
    dow: {
        id: 'dow-composition',
        title: 'Composition',
        author: 'Arthur Wesley Dow',
        shelf: 'form',
        edition: { publisher: 'Doubleday, Page & Co.', year: 1913, note: 'ninth edition, revised and enlarged' },
        source: { url: 'https://www.gutenberg.org/cache/epub/45410/pg45410.txt', label: 'Project Gutenberg #45410', file: 'dow-composition-45410.txt' },
        rights: {
            basis: 'pre-1930-us',
            evidence: 'Artifact names Arthur W. Dow and the Doubleday, Page & Co. printing; the work first appeared 1899 and this revised edition is pre-1930, outside the 1909 Act renewal regime. Dow died 1922.'
        },
        // Dow's headings are bare capitalised phrases rather than
        // numbered chapters, and the contents list them once before the
        // body repeats them — hence skipTo:'half'.
        parse: raw => chaptered(raw, {
            heading: /^(BEGINNINGS|THE THREE ELEMENTS|LINE DRAWING|PRINCIPLES OF COMPOSITION|NOTAN|COLOR|THE STUDY OF COLOR|SYNTHETIC METHOD|APPLICATIONS)\.?$/,
            skipTo: 'half',
            until: /^(INDEX|APPENDIX|BIBLIOGRAPHY)\b/
        })
    },

    ross: {
        id: 'ross-pure-design',
        title: 'A Theory of Pure Design',
        author: 'Denman Waldo Ross',
        shelf: 'form',
        edition: { publisher: 'Houghton, Mifflin & Co.', year: 1907 },
        source: { url: 'https://www.gutenberg.org/cache/epub/74765/pg74765.txt', label: 'Project Gutenberg #74765', file: 'ross-pure-design-74765.txt' },
        rights: {
            basis: 'pre-1930-us',
            evidence: 'Artifact names Denman Waldo Ross and the 1907 Houghton, Mifflin imprint; pre-1930 and outside the renewal regime. Ross died 1935.'
        },
        // Ross's own preface argues the book's thesis and is kept.
        parse: raw => chaptered(raw, {
            heading: /^(INTRODUCTION|THE ORDER OF HARMONY|THE ORDER OF BALANCE|THE ORDER OF RHYTHM)\.?$/,
            skipTo: 'half',
            keepPreface: true,
            // His front matter carries the preface AND an introduction
            // that the body headings do not cover — "Preface" alone
            // would understate what the section holds.
            prefaceName: 'Preface & Introduction',
            // #74765 closes with an unlabelled recapitulation — every
            // numbered proposition with its page, "1, p. 1. The Meaning
            // of Design." There is no header to stop at, so the shape
            // is the signal. Without this the last chapter absorbs a
            // few thousand lines of index and the reading ends on a
            // page reference.
            until: /^(PARAGRAPH INDEX|\d+,\s+p\.\s+\d+\.)/
        })
    },

    crane_line: {
        id: 'crane-line-and-form',
        title: 'Line and Form',
        author: 'Walter Crane',
        shelf: 'form',
        edition: { publisher: 'George Bell & Sons', year: 1900 },
        source: { url: 'https://www.gutenberg.org/cache/epub/25290/pg25290.txt', label: 'Project Gutenberg #25290', file: 'crane-line-form-25290.txt' },
        rights: {
            basis: 'author-death-70',
            evidence: 'Artifact reproduces the 1900 George Bell & Sons edition and names Crane, who died 1915 — 111 years. No later translator or editor intervenes.'
        },
        parse: raw => chaptered(raw, {
            heading: /^CHAPTER [IVX]+\.?$/,
            skipTo: 'half',
            until: /^(INDEX|APPENDIX)\b/,
            name: (h, n) => `Chapter ${n + 1}`
        })
    },

    kandinsky: {
        id: 'kandinsky-spiritual-in-art',
        title: 'Concerning the Spiritual in Art',
        author: 'Wassily Kandinsky',
        shelf: 'form',
        edition: { translator: 'Michael T. H. Sadler', publisher: 'Constable & Co.', year: 1914 },
        source: { url: 'https://www.gutenberg.org/cache/epub/5321/pg5321.txt', label: 'Project Gutenberg #5321', file: 'kandinsky-spiritual-5321.txt' },
        rights: {
            basis: 'pre-1930-us',
            evidence: 'The text\'s own title page reads "BY WASSILY KANDINSKY [TRANSLATED BY MICHAEL T. H. SADLER]" and the translator signs "MICHAEL T. H. SADLER" at the end of his introduction. Note the Gutenberg metadata field says "Michael Sadleir" — his later legal name — but the EDITION names Sadler, and the edition is what the rights attach to. First English translation 1914, pre-1930.'
        },
        // Numbered roman headings under two PART banners.
        parse: raw => chaptered(raw, {
            heading: /^[IVX]+\.\s+[A-Z][A-Z ,'-]+$/,
            skipTo: 'half',
            until: /^(INDEX|APPENDIX|FOOTNOTES)\b/
        })
    },

    dresser: {
        id: 'dresser-decorative-design',
        title: 'Principles of Decorative Design',
        author: 'Christopher Dresser',
        shelf: 'form',
        edition: { publisher: 'Cassell, Petter & Galpin', year: 1873, note: 'fourth edition' },
        source: { url: 'https://www.gutenberg.org/cache/epub/39749/pg39749.txt', label: 'Project Gutenberg #39749', file: 'dresser-decorative-39749.txt' },
        rights: {
            basis: 'pre-1930-us',
            evidence: 'Artifact carries the fourth-edition title matter and the 1873 London/New York Cassell, Petter & Galpin imprint; pre-1930. Dresser died 1904.'
        },
        parse: raw => chaptered(raw, {
            heading: /^CHAPTER [IVX]+\.?$/,
            skipTo: 'half',
            until: /^(INDEX|APPENDIX)\b/,
            name: (h, n) => `Chapter ${n + 1}`
        })
    },

    vitruvius: {
        id: 'vitruvius-architecture',
        title: 'The Ten Books on Architecture',
        author: 'Vitruvius',
        shelf: 'form',

        edition: {
            translator: 'Morris Hicky Morgan',
            publisher: 'Harvard University Press',
            year: 1914
        },
        source: {
            url: 'https://www.gutenberg.org/cache/epub/20239/pg20239.txt',
            label: 'Project Gutenberg #20239',
            file: 'vitruvius-20239.txt'
        },
        rights: {
            basis: 'pre-1930-us',
            evidence: 'The text\'s own title page reads "TRANSLATED BY MORRIS HICKY MORGAN, PH.D., LL.D.", Harvard University Press, 1914 — verified in the fetched artifact at line 50, not from the Gutenberg landing page, which does not name a translator. Published 1914, so pre-1930 and outside the 1909 Act renewal regime entirely. Vitruvius is ancient; Morgan died 1910.'
        },

        /**
         * #20239 is plain-text with a clean hierarchy:
         *
         *   BOOK I            book header (own line, roman numeral)
         *   PREFACE           section header
         *   CHAPTER I         section header
         *   1. While your…    numbered paragraph — the reading unit
         *
         * The front matter (title page, translator's preface, contents)
         * and the trailing INDEX are apparatus, not the work. Morgan's
         * footnotes are likewise excluded from the reading stream: they
         * are scholarship ABOUT the text, and interleaving them would
         * make the RSVP stream unreadable. They belong to a future
         * study surface, exactly as Challoner's annotations do.
         */
        parse(raw) {
            const lines = raw.split(/\r?\n/);
            // The body begins at the SECOND "BOOK I" — the first is the
            // table of contents. The index closes it.
            const bookLine = /^BOOK ([IVX]+)\s*$/;
            const starts = lines
                .map((l, i) => (bookLine.test(l) ? i : -1))
                .filter(i => i >= 0);
            if (starts.length < 20) {
                throw new Error(`expected 20 BOOK headers (contents + body), found ${starts.length}`);
            }
            const bodyStart = starts[10];       // first body header
            // The work ends before the editorial apparatus, not at the
            // index. #20239 appends H. L. Warren's "NOTE ON SCAMILLI
            // IMPARES" between Book X and the index — scholarship about
            // Vitruvius, signed by Morgan's editor. Ending at the index
            // would close the reading on someone else's essay, which a
            // spot-check of the LAST characters caught and a check of
            // only the beginning would have missed.
            const stopAt = lines.findIndex((l, i) =>
                i > bodyStart && /^(SCAMILLI IMPARES|INDEX)\b/.test(l.trim()));
            const end = stopAt > 0 ? stopAt : lines.length;

            const books = [];
            // Collected across all books so the manifest can report how
            // many plates this edition has that we cannot show.
            const captions = this._captions = [];
            const bodyHeads = starts.filter(i => i >= bodyStart && i < end);
            for (let n = 0; n < bodyHeads.length; n++) {
                const from = bodyHeads[n];
                const to = n + 1 < bodyHeads.length ? bodyHeads[n + 1] : end;
                const numeral = lines[from].match(bookLine)[1];
                books.push({
                    name: `Book ${numeral}`,
                    content: sectionText(lines.slice(from + 1, to), captions)
                });
            }
            return books;
        }
    }
};

// ── Shared machinery ────────────────────────────────────────────────

/**
 * Reflow a run of hard-wrapped lines into paragraphs.
 *
 * Gutenberg wraps at ~72 columns, which is a property of the FILE and
 * not of the text. Preserving those breaks would make every line a
 * phrase boundary the author never wrote — and the chunker cannot yet
 * tell an authored boundary from a derived one
 * (PHRASE-CHUNKING-STUDY.md §4), so a false break here would be
 * indistinguishable from a real one downstream.
 */
function sectionText(lines, captions = []) {
    const paras = [];
    let buf = [];
    const flush = () => {
        if (!buf.length) return;
        paras.push(buf.join(' ').replace(/\s+/g, ' ').trim());
        buf = [];
    };
    for (const line of lines) {
        let t = line.trim();
        if (!t) { flush(); continue; }
        // Section headers become their own paragraph so the reading
        // keeps its architecture; they are short and all-caps.
        if (/^(PREFACE|CHAPTER [IVX]+|INTRODUCTION)\s*$/.test(t)) {
            flush();
            paras.push(t);
            continue;
        }
        // PLATE CAPTIONS are apparatus wearing the shape of prose.
        // "[Illustration: Photo. H. B. Warren CARYATIDES OF THE
        // ERECHTHEUM AT ATHENS]" read aloud in an RSVP stream is noise,
        // and the plate it names is not in a text-only artifact anyway.
        // SOL's dossier requires that a page-dependent work fail ingest
        // if its canonical asset is text-only; recording the count here
        // is how we know how much is missing.
        if (/^\[Illustration/i.test(t)) { flush(); captions.push(t); continue; }
        // Typographic furniture from the printed page. "FINIS" and rule
        // lines are the book's binding, not its prose.
        // Also: a printer's colophon ("The Riverside Press, CAMBRIDGE")
        // belongs to the physical book, not the argument.
        if (/^(FINIS|THE END|\*\s*\*[\s*]*)\.?$/i.test(t)) { flush(); continue; }
        if (/^_?(The [A-Z][a-z]+ Press)_?/.test(t) || /^(CAMBRIDGE|BOSTON|LONDON)\s*[·.]/.test(t)) {
            flush(); continue;
        }
        // Footnote MARKERS are Morgan's apparatus — textual variants
        // and manuscript readings, not Vitruvius. Strip the marker and
        // keep the sentence it interrupts.
        t = t.replace(/\[\d+\]/g, '').replace(/\s{2,}/g, ' ').trim();
        if (t) buf.push(t);
    }
    flush();
    return paras.filter(Boolean).join('\n\n');
}

function sha256(s) {
    return createHash('sha256').update(s, 'utf8').digest('hex');
}

/**
 * The common case: a Gutenberg plain text whose body is divided by a
 * repeating heading (CHAPTER I, PART 1:, and so on).
 *
 * Every one of these files states the same three things in a different
 * way, so a work declares WHAT its headings look like and this handles
 * the rest:
 *
 *   heading    /^CHAPTER [IVX]+/ — the divider
 *   from       skip past front matter; the body usually begins at the
 *              SECOND occurrence, the first being the table of contents
 *   until      a trailing marker that ends the work (INDEX, APPENDIX,
 *              a signed editorial note)
 *
 * Everything before the first body heading is front matter: title page,
 * translator's preface, contents. It is apparatus and is dropped — with
 * one deliberate exception, `keepPreface`, for works where the author's
 * own preface IS part of the argument.
 */
function chaptered(raw, opts) {
    const { heading, until, skipTo = 1, keepPreface = false, name } = opts;
    const lines = raw.split(/\r?\n/);

    // Gutenberg's own wrapper is never part of any work.
    const startMark = lines.findIndex(l => /^\*\*\* START OF/.test(l));
    const endMark = lines.findIndex(l => /^\*\*\* END OF/.test(l));
    const lo = startMark >= 0 ? startMark + 1 : 0;
    const hi = endMark > 0 ? endMark : lines.length;

    const hits = [];
    for (let i = lo; i < hi; i++) if (heading.test(lines[i].trim())) hits.push(i);
    if (hits.length < 2) {
        throw new Error(`heading ${heading} matched ${hits.length} lines — check the pattern against the artifact`);
    }

    // Find where the BODY starts.
    //
    // A table of contents is CONTIGUOUS — its headings sit within a few
    // lines of each other because there is no prose between them. Body
    // headings are far apart because chapters intervene. Counting was
    // the obvious approach and it is wrong: Dow's contents list six
    // headings while his body has eight, so halving landed mid-contents
    // and produced four fragments of a table.
    //
    // So: walk from the first hit, and take the body as beginning at
    // the first heading followed by real distance.
    const GAP = 25;
    let bodyFrom = hits[0];
    if (skipTo === 'half') {
        for (let i = 0; i < hits.length - 1; i++) {
            if (hits[i + 1] - hits[i] >= GAP) { bodyFrom = hits[i + 1]; break; }
        }
        // A contents block whose last entry is the body's first heading
        // leaves bodyFrom pointing at the contents; step past any hit
        // that is immediately followed by another.
        while (bodyFrom !== hits.at(-1)) {
            const at = hits.indexOf(bodyFrom);
            if (hits[at + 1] - bodyFrom >= GAP) break;
            bodyFrom = hits[at + 1];
        }
    }
    let stop = hi;
    if (until) {
        const s = lines.findIndex((l, i) => i > bodyFrom && until.test(l.trim()));
        if (s > 0) stop = s;
    }

    const body = hits.filter(i => i >= bodyFrom && i < stop);
    const captions = [];
    const sections = [];
    for (let n = 0; n < body.length; n++) {
        const from = body[n];
        const to = n + 1 < body.length ? body[n + 1] : stop;
        sections.push({
            name: name ? name(lines[from].trim(), n) : lines[from].trim(),
            content: sectionText(lines.slice(from + 1, to), captions)
        });
    }

    if (keepPreface && bodyFrom > lo) {
        // A transcriber's note sits INSIDE Gutenberg's START marker but
        // is not part of any edition — it is the digitiser describing
        // their own choices. Begin the preface after it, or the reading
        // opens on a note about hyphenation.
        let preFrom = lo;
        const note = lines.findIndex((l, i) =>
            i >= lo && i < bodyFrom && /transcriber.?s? note/i.test(l));
        if (note >= 0) {
            const resumes = lines.findIndex((l, i) =>
                i > note && i < bodyFrom && /^(PREFACE|INTRODUCTION|CONTENTS)\b/i.test(l.trim()));
            preFrom = resumes > 0 ? resumes : bodyFrom;
        }
        const pre = sectionText(lines.slice(preFrom, bodyFrom), captions);
        // Named by the work, not by us: Ross's front matter carries his
        // preface AND an introduction that his body headings do not
        // cover, so calling it "Preface" would understate what it holds.
        if (pre.length > 400) sections.unshift({ name: opts.prefaceName || 'Preface', content: pre });
    }
    return { sections, captions };
}

async function fetchSource(work) {
    mkdirSync(CACHE, { recursive: true });
    const path = resolve(CACHE, work.source.file);
    if (!existsSync(path)) {
        process.stderr.write(`fetching ${work.source.url}\n`);
        const res = await fetch(work.source.url);
        if (!res.ok) throw new Error(`${res.status} fetching ${work.source.url}`);
        writeFileSync(path, await res.text(), 'utf8');
    }
    return readFileSync(path, 'utf8');
}

function moduleFor(work, sections, digests) {
    const constName = work.id.toUpperCase().replace(/-/g, '_');
    const total = sections.reduce((n, s) => n + s.content.length, 0);
    return `/**
 * ${work.title} — ${work.author}.
 *
 * EDITION   trans. ${work.edition.translator}, ${work.edition.publisher}, ${work.edition.year}
 * SOURCE    ${work.source.label}
 *           ${work.source.url}
 *           retrieved ${digests.retrieved}
 *           sha256(source) ${digests.source}
 * RIGHTS    ${work.rights.basis}
 *           ${work.rights.evidence.replace(/\n/g, '\n *           ')}
 *
 * GENERATED by scripts/archive-ingest.mjs — do not hand-edit.
 * sha256(payload) ${digests.payload}
 *
 * The source digest says this is the file the world served us; the
 * payload digest says this is what we made of it. Both are the
 * integrity contract.
 *
 * Editorial: front matter, the translator's preface, and the trailing
 * index are apparatus and are not part of the reading stream. Morgan's
 * footnotes are scholarship about the text and are likewise excluded.
 * Gutenberg's hard line wraps are a property of the file, not the
 * prose, and are reflowed away — a false line break would reach the
 * chunker as a phrase boundary nobody authored.
 */

export const ${constName}_SECTIONS = ${JSON.stringify(sections, null, 4)};

export const ${constName}_META = Object.freeze({
    id: ${JSON.stringify(work.id)},
    title: ${JSON.stringify(work.title)},
    author: ${JSON.stringify(work.author)},
    shelf: ${JSON.stringify(work.shelf)},
    edition: ${JSON.stringify(work.edition)},
    source: ${JSON.stringify({ ...work.source, retrieved: digests.retrieved, sha256: digests.source })},
    rights: ${JSON.stringify(work.rights)},
    chars: ${total},
    payloadChecksum: ${JSON.stringify(digests.payload)}
});
`;
}

// ── Run ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const dryRun = argv.includes('--dry-run');
const key = argv.find(a => !a.startsWith('--'));

if (argv.includes('--list') || !key) {
    console.log('works:');
    for (const [k, w] of Object.entries(WORKS)) {
        console.log(`  ${k.padEnd(14)} ${w.title} — ${w.author} [${w.shelf}]`);
    }
    process.exit(key ? 0 : 1);
}

const work = WORKS[key];
if (!work) {
    console.error(`unknown work '${key}'. Try --list.`);
    process.exit(2);
}

const raw = await fetchSource(work);
const sourceDigest = sha256(raw);
const parsed = work.parse(raw);
const sections = Array.isArray(parsed) ? parsed : parsed.sections;
if (!Array.isArray(parsed) && parsed.captions?.length) work._captions = parsed.captions;

if (!sections.length) throw new Error('parse produced no sections');
for (const s of sections) {
    if (!s.content || s.content.length < 200) {
        throw new Error(`section '${s.name}' is suspiciously short (${s.content?.length ?? 0} chars) — check the parser against the scan`);
    }
}

const payload = sections.map(s => s.content).join('\n\n');
const digests = {
    source: sourceDigest,
    payload: sha256(payload),
    retrieved: new Date().toISOString().slice(0, 10)
};

console.log(`${work.title}`);
console.log(`  edition   trans. ${work.edition.translator}, ${work.edition.year}`);
console.log(`  source    ${work.source.label}  sha256 ${sourceDigest.slice(0, 16)}…`);
console.log(`  rights    ${work.rights.basis}`);
console.log(`  sections  ${sections.length}`);
for (const s of sections) {
    console.log(`    ${s.name.padEnd(12)} ${String(s.content.length).padStart(7)} chars`);
}
console.log(`  payload   ${payload.length} chars  sha256 ${digests.payload.slice(0, 16)}…`);
if (work._captions?.length) {
    // Stated rather than silently dropped. A diagram-dependent work read
    // as text alone is a partial reading, and the reader is owed that.
    console.log(`  plates    ${work._captions.length} illustration captions removed — this edition is`);
    console.log(`            diagram-dependent and the text artifact carries no images`);
}

if (dryRun) {
    console.log('\n--dry-run: nothing written');
    console.log('\nfirst 300 chars of section 1:\n');
    console.log(sections[0].content.slice(0, 300));
} else {
    mkdirSync(OUT, { recursive: true });
    const path = resolve(OUT, `${work.id}.js`);
    writeFileSync(path, moduleFor(work, sections, digests), 'utf8');
    console.log(`\nwrote ${path}`);
}
