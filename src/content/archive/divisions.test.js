/**
 * Divisions — the contract that keeps invented chapters off the shelf.
 *
 * The failure this guards against is not a crash. It is a reader being
 * shown "part. Anna Pávlovna Schérer on the contrary, despite her forty
 * years," as the title of a chapter of War and Peace, which is what
 * rendering the ingest's own section names produces. Every assertion
 * here is about REFUSING to divide rather than about dividing well.
 */
import { describe, expect, it } from 'vitest';
import {
    romanValue, parseHeading, schemeFromNames, splitLongDivision, divideSections, headingVocabulary, isContentsPage } from './divisions.js';

describe('roman numerals', () => {
    it('reads the forms these editions actually use', () => {
        expect(romanValue('I')).toBe(1);
        expect(romanValue('IV')).toBe(4);
        expect(romanValue('XI')).toBe(11);
        expect(romanValue('XLII')).toBe(42);
        expect(romanValue('MCMXCIV')).toBe(1994);
    });

    it('refuses anything that is not one', () => {
        expect(romanValue('CHAPTER')).toBeNaN();
        expect(romanValue('')).toBeNaN();
        expect(romanValue(null)).toBeNaN();
    });
});

describe('heading parsing', () => {
    it('reads a division word with either numeral style', () => {
        expect(parseHeading('CHAPTER I')).toMatchObject({ word: 'chapter', ordinal: 1 });
        expect(parseHeading('Chapter 12')).toMatchObject({ word: 'chapter', ordinal: 12 });
        expect(parseHeading('Canto XI. The Broken Rocks.'))
            .toMatchObject({ word: 'canto', ordinal: 11, title: 'The Broken Rocks.' });
    });

    it('keeps the numeral as the edition wrote it', () => {
        // Dante's cantos are XI, not 11. Rendering every division in
        // arabic is a small unfaithfulness applied thousands of times.
        expect(parseHeading('Canto XI').numeral).toBe('XI');
        expect(parseHeading('Chapter 11').numeral).toBe('11');
    });

    it('rejects prose the ingest mistook for a heading', () => {
        // The actual corrupt names, from the generated corpus.
        expect(parseHeading(
            'part. Anna Pávlovna Schérer on the contrary, despite her forty years,')).toBeNull();
        expect(parseHeading('Day was departing, and the embrowned air')).toBeNull();
        expect(parseHeading(
            'book called Drona, the leaves; the book called Karna, the fair flowers;')).toBeNull();
    });

    it('does not mistake the pronoun "I" for a numeral', () => {
        expect(parseHeading('I went down to the river that morning')).toBeNull();
    });

    it('recognises unnumbered matter', () => {
        expect(parseHeading('Front matter')).toMatchObject({ kind: 'matter' });
        expect(parseHeading('Epilogue')).toMatchObject({ kind: 'matter' });
    });
});

describe('a scheme must prove itself', () => {
    it('accepts a repeating, ascending run', () => {
        const s = schemeFromNames(['CHAPTER I', 'CHAPTER II', 'CHAPTER III', 'CHAPTER IV']);
        expect(s.word).toBe('chapter');
        expect(s.items).toHaveLength(4);
    });

    it('rejects a lone heading — one division divides nothing', () => {
        expect(schemeFromNames(['CHAPTER I', 'some prose', 'more prose'])).toBeNull();
    });

    it('rejects headings that do not ascend', () => {
        // Coincidence produces heading-shaped lines; it does not
        // produce counting.
        expect(schemeFromNames(['Book 4', 'Book 4', 'Book 2', 'Book 9', 'Book 1'])).toBeNull();
    });

    it('tolerates the corrupt names between real ones', () => {
        // War and Peace's actual shape: true chapters interleaved with
        // prose fragments. The scheme must survive them.
        const s = schemeFromNames([
            'CHAPTER I',
            'part. Anna Pávlovna Schérer on the contrary, despite her forty years,',
            'CHAPTER II', 'CHAPTER III', 'CHAPTER IV'
        ]);
        expect(s.word).toBe('chapter');
        expect(s.items.map(i => i.i)).toEqual([0, 2, 3, 4]);
    });

    it('prefers the scheme with the most evidence', () => {
        const s = schemeFromNames([
            'Book 1', 'Book 2', 'Book 3',
            'Chapter I', 'Chapter II', 'Chapter III', 'Chapter IV', 'Chapter V', 'Chapter VI'
        ]);
        expect(s.word).toBe('chapter');
    });
});

describe('splitting an oversized division', () => {
    const para = (n, w) => Array.from({ length: n }, () =>
        Array.from({ length: w }, () => 'word').join(' ')).join('\n\n');

    it('leaves a short division alone', () => {
        const text = para(3, 100);
        expect(splitLongDivision(text, { maxWords: 4000 })).toHaveLength(1);
    });

    it('splits a long one into comparable parts', () => {
        const parts = splitLongDivision(para(40, 500), { maxWords: 4000 });
        expect(parts.length).toBeGreaterThan(1);
        for (const p of parts) {
            expect(p.split(/\s+/).filter(Boolean).length).toBeLessThan(6000);
        }
    });

    it('never cuts inside a paragraph', () => {
        // The paragraph is the author's unit; the character offset is
        // ours. A slightly long part reads better than a severed
        // sentence.
        const text = para(20, 400);
        const parts = splitLongDivision(text, { maxWords: 1000 });
        expect(parts.join('\n\n').replace(/\s+/g, ' ').trim())
            .toBe(text.replace(/\s+/g, ' ').trim());
    });

    it('cannot split a single enormous paragraph, and says so by returning it whole', () => {
        const one = Array.from({ length: 9000 }, () => 'word').join(' ');
        expect(splitLongDivision(one, { maxWords: 4000 })).toHaveLength(1);
    });

    describe('structure outranks balance', () => {
        // A part must not end by starting the next chapter.
        const chapter = (n, title, paragraphs, w = 500) => [
            `CHAPTER ${n}`, title,
            ...Array.from({ length: paragraphs }, (_, i) =>
                `${i + 1}. ` + Array.from({ length: w }, () => 'word').join(' '))
        ].join('\n\n');

        const shaped = (a, b, c) => [
            chapter('I', 'THE EDUCATION OF THE ARCHITECT', a),
            chapter('II', 'THE FUNDAMENTAL PRINCIPLES OF ARCHITECTURE', b),
            chapter('III', 'THE DEPARTMENTS OF ARCHITECTURE', c)
        ].join('\n\n');
        const book = shaped(5, 9, 4);

        const looksLikeHeading = (p) =>
            /^CHAPTER /.test(p) ||
            (p === p.toUpperCase() && /[A-Z]{3}/.test(p) && !/[.!?,;:]$/.test(p));

        /** Does this part finish by STARTING a chapter it barely contains? */
        const endsByStarting = (part, target) => {
            const paras = part.trim().split(/\n\s*\n/).map(s => s.trim());
            let after = 0;
            for (let i = paras.length - 1; i >= 0; i--) {
                if (looksLikeHeading(paras[i])) return after < target * 0.25;
                after += paras[i].split(/\s+/).filter(Boolean).length;
            }
            return false;
        };

        it('never ends a part by starting the next chapter', () => {
            // The invariant as a reader states it. NOT "every part opens
            // on a chapter" — a chapter longer than the target has to be
            // cut somewhere, and there is no joint to use.
            const parts = splitLongDivision(book, { maxWords: 3200 });
            expect(parts.length).toBeGreaterThan(1);
            const total = book.split(/\s+/).filter(Boolean).length;
            const target = Math.ceil(total / parts.length);
            for (const part of parts) {
                expect(endsByStarting(part, target),
                    `a part ends by starting a chapter: …${part.trim().slice(-60)}`).toBe(false);
            }
        });

        it('holds across every shape of book, not just the one I picked', () => {
            // The first fixture written for this passed under the OLD
            // code too, because equal chapters put the arithmetic target
            // on a joint by luck. Sweeping the shapes is what proved the
            // rule: the previous splitter committed this fault in 901 of
            // these 288 × 3 cases.
            let offences = 0, cases = 0;
            for (let a = 3; a <= 8; a++) for (let b = 3; b <= 8; b++) for (let c = 3; c <= 8; c++) {
                const text = shaped(a, b, c);
                const total = text.split(/\s+/).filter(Boolean).length;
                for (const maxWords of [2000, 3200, 4000]) {
                    cases++;
                    const parts = splitLongDivision(text, { maxWords });
                    const target = Math.ceil(total / parts.length);
                    if (parts.some(p => endsByStarting(p, target))) offences++;
                }
            }
            expect(cases).toBeGreaterThan(500);
            expect(offences).toBe(0);
        });

        it('never ends a part on a heading', () => {
            // A title belongs to what follows it. Left at the end, the
            // reading announces a chapter it does not contain.
            const parts = splitLongDivision(book, { maxWords: 3200 });
            for (const part of parts) {
                const last = part.trim().split(/\n\s*\n/).pop().trim();
                expect(looksLikeHeading(last),
                    `a part ends on the heading "${last.slice(0, 40)}"`).toBe(false);
            }
        });

        it('does not let a joint override the reading length it was asked for', () => {
            // A heading every few hundred words must not turn each one
            // into its own part: the joint is preferred NEAR the target,
            // not everywhere.
            const many = Array.from({ length: 30 }, (_, i) =>
                chapter(String(i + 1), `TITLE ${i + 1}`, 1, 200)).join('\n\n');
            const parts = splitLongDivision(many, { maxWords: 2000 });
            const words = parts.map(p => p.split(/\s+/).filter(Boolean).length);
            for (const w of words) expect(w).toBeGreaterThan(600);
        });

        it('loses nothing, whichever boundary it chooses', () => {
            const parts = splitLongDivision(book, { maxWords: 3200 });
            expect(parts.join('\n\n').replace(/\s+/g, ' ').trim())
                .toBe(book.replace(/\s+/g, ' ').trim());
        });
    });
});

describe('dividing a work', () => {
    const sec = (name, words) => ({
        name, content: Array.from({ length: words }, () => 'word').join(' ')
    });

    it('rebuilds chapters the ingest cut apart', () => {
        // THE CENTRAL CASE. The ingest strips the heading from the
        // content and then splits again on a prose line, so a chapter
        // arrives as several sections of which only the first is named.
        // Everything after a real heading belongs to it.
        const work = divideSections([
            sec('CHAPTER I', 600),
            sec('part. Anna Pávlovna Schérer on the contrary,', 1400),
            sec('CHAPTER II', 1300),
            sec('CHAPTER III', 1400),
            sec('CHAPTER IV', 9000)
        ], { minWords: 100 });

        expect(work.divided).toBe(true);
        expect(work.noun).toBe('Chapter');
        // Four chapters, not five sections — and none named after prose.
        const labels = work.entries.map(e => e.label);
        expect(labels[0]).toBe('Chapter I');
        expect(labels[1]).toBe('Chapter II');
        for (const l of labels) expect(l).not.toContain('Anna');
        // Chapter I absorbed the fragment that followed it.
        expect(work.entries[0].words).toBe(2000);
    });

    it('names divisions in the work\'s own tradition', () => {
        const cantos = divideSections(
            [sec('Canto I', 500), sec('Canto II', 500), sec('Canto III', 500)],
            { minWords: 100 });
        expect(cantos.noun).toBe('Canto');

        const essays = divideSections(
            [sec('Essay 1', 500), sec('Essay 2', 500), sec('Essay 3', 500)],
            { minWords: 100 });
        expect(essays.noun).toBe('Essay');
    });

    it('reads a short work whole rather than inventing chapters for it', () => {
        const w = divideSections([sec('CHAPTER I', 100), sec('CHAPTER II', 100)]);
        expect(w.divided).toBe(false);
        expect(w.reason).toBe('short');
        expect(w.entries).toHaveLength(1);
    });

    it('falls back to measured readings when no scheme verifies', () => {
        // Le Morte d'Arthur's names are 97% prose. There is no honest
        // way to call these chapters, so they are not called chapters —
        // the reader is told they are readings, which is what they are.
        const w = divideSections(
            Array.from({ length: 30 }, (_, i) => sec(`some prose fragment ${i}`, 1000)),
            { minWords: 100 });
        expect(w.divided).toBe(true);
        expect(w.noun).toBe('Reading');
        expect(w.reason).toBe('measured');
        expect(w.entries.every(e => /^Reading \d+$/.test(e.label))).toBe(true);
    });

    it('loses no text, whichever path it takes', () => {
        // A division scheme is a view over the work. A view that drops
        // prose is not a view, it is damage.
        const sections = [
            sec('CHAPTER I', 500), sec('stray prose', 500),
            sec('CHAPTER II', 500), sec('CHAPTER III', 12000)
        ];
        const w = divideSections(sections, { minWords: 100 });
        const before = sections.map(s => s.content).join(' ').split(/\s+/).filter(Boolean).length;
        const after = w.entries.map(e => e.content).join(' ').split(/\s+/).filter(Boolean).length;
        expect(after).toBe(before);
    });

    it('survives an empty or malformed work', () => {
        expect(divideSections([]).divided).toBe(false);
        expect(divideSections(null).divided).toBe(false);
        expect(divideSections([{ }, { content: '' }]).divided).toBe(false);
    });
});

describe('no division exists only because the arithmetic said so', () => {
    it('folds a stranded tail back into the part it was cut from', () => {
        // Found by the archive suite: Vitruvius offered "Book III
        // (3 of 3)" containing 164 characters, because a greedy fill
        // flushes on overshoot and whatever is left becomes its own
        // part. A reader should never be given a division that is a
        // closing sentence.
        const body = Array.from({ length: 12 }, () =>
            Array.from({ length: 700 }, () => 'word').join(' ')).join('\n\n');
        const parts = splitLongDivision(`${body}\n\nAnd so it ends.`, { maxWords: 4000 });
        const words = parts.map(p => p.split(/\s+/).filter(Boolean).length);
        expect(Math.min(...words)).toBeGreaterThan(200);
        expect(parts.at(-1)).toContain('And so it ends.');
    });

    it('does not strand a short OPENING paragraph as its own part', () => {
        // Paradise Lost gave "Book I (1 of 2)" containing 91
        // characters: the book opens with a brief argument before its
        // first long verse paragraph, and a greedy fill flushed that
        // argument alone. The floor has to apply at the head as well
        // as the tail — merging the tail was only the special case.
        const BREAK = '\n\n';
        const short = 'A brief argument.';
        const long = Array.from({ length: 10 }, () =>
            Array.from({ length: 900 }, () => 'word').join(' ')).join(BREAK);
        const parts = splitLongDivision(short + BREAK + long, { maxWords: 4000 });
        const words = parts.map(p => p.split(/\s+/).filter(Boolean).length);
        expect(Math.min(...words)).toBeGreaterThan(200);
        expect(parts[0]).toContain('A brief argument.');
    });

    it('keeps a genuinely short work as one part rather than padding it', () => {
        expect(splitLongDivision('a b c', { maxWords: 4000 })).toEqual(['a b c']);
    });
});

describe('a pattern inside a work is not the work\'s scheme', () => {
    const BREAK = '\n\n';
    const para = (w) => Array.from({ length: w }, () => 'word').join(' ');

    it('refuses a scheme that begins most of the way through the work', () => {
        // The Mahabharata's prose carries 263 bare ascending numerals —
        // footnote markers — and they pass every local test: they
        // repeat, they count up, each sits on its own line. Taken as
        // headings they produced a "front matter" of 1,294,418 words
        // followed by scraps. Coverage is what separates a division
        // scheme from a pattern that merely occurs inside one.
        const body = Array.from({ length: 30 }, () => para(1000)).join(BREAK);
        const markers = ['1', '2', '3', '4', '5']
            .map(n => `${n}${BREAK}${para(50)}`).join(BREAK);
        const w = divideSections([{ name: 'x', content: `${body}${BREAK}${markers}` }],
            { minWords: 100 });
        // Falls through to measured readings rather than one vast lump.
        expect(w.noun).toBe('Reading');
        expect(Math.max(...w.entries.map(e => e.words))).toBeLessThan(9000);
    });

    it('gives front matter the same ceiling as any other division', () => {
        // An entry with no upper bound is how 1.29 million words reached
        // a reader as a single "reading".
        // Front matter must stay under the coverage gate's 30% share, or
        // the scheme is (correctly) rejected for beginning too late.
        const front = Array.from({ length: 10 }, () => para(900)).join(BREAK);
        const chapters = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII']
            .map(n => `Chapter ${n}${BREAK}${para(4000)}`).join(BREAK);
        const w = divideSections([{ name: 'x', content: `${front}${BREAK}${chapters}` }],
            { minWords: 100 });
        const matter = w.entries.filter(e => e.label.startsWith('Front matter'));
        expect(matter.length).toBeGreaterThan(1);
        for (const e of matter) expect(e.words).toBeLessThan(9000);
    });

    it('does not divide a book on its own table of contents', () => {
        // Dante's "Canto I…Canto C" appear consecutively in the contents
        // listing and nowhere in the body. Consecutive lines are a list;
        // a heading stands alone.
        const contents = Array.from({ length: 20 }, (_, i) =>
            `Canto ${i + 1}. Some descriptive title.`).join('\n');
        const body = Array.from({ length: 20 }, () => para(900)).join(BREAK);
        const w = divideSections([{ name: 'x', content: `Contents${BREAK}${contents}${BREAK}${body}` }],
            { minWords: 100 });
        expect(w.noun).not.toBe('Canto');
    });
});

describe('the division index agrees with the works it describes', () => {
    it('names every ingested work, with a count that matches', async () => {
        // The index is generated (scripts/build-division-index.mjs) and
        // is what every card reads. A stale one mis-states the shelf
        // silently — the card says 365 chapters, the sheet opens 92 —
        // so an ingest that forgets to regenerate must fail here rather
        // than in front of a reader.
        const { default: index } = await import('./division-index.json');
        const { INGESTED_META } = await import('./index.js');

        for (const meta of INGESTED_META) {
            const entry = index[meta.id];
            expect(entry, `${meta.id} is missing from division-index.json`).toBeTruthy();
            expect(entry.count).toBeGreaterThan(0);
            // A divided work names its divisions one of two ways: with a
            // counting word ("Book VI") or with titles ("Guillemont").
            // The second has no noun, and demanding one would push the
            // divider back into inventing "Chapter" for a work that
            // never said it.
            // A third way, and the best one: the EDITION named them. A
            // declared scheme has no noun because none was invented for it.
            if (entry.divided) {
                expect(entry.noun || entry.titled || entry.reason === 'declared').toBeTruthy();
            }
            expect(typeof entry.reason === 'string' && entry.reason.length > 0,
                `${meta.id} is missing division reason`).toBe(true);
            expect(entry.authored).toBe(entry.reason !== 'measured');
        }
    });

    it('carries no payload that is on no shelf', async () => {
        // The index is built from the works DIRECTORY and the catalogue
        // is written by hand, so the two can drift apart in silence.
        // They had: five Indigenous ingests sat in the corpus with
        // complete metadata and rights bases while appearing on no
        // shelf, two of them under an explicit caveat to consult the
        // community before release. A book nobody can reach is not
        // held back, it is merely lost, and the difference was
        // invisible until something compared the two lists.
        //
        // They were removed on 2026-07-30. Git keeps them, so the
        // decision stays reversible; the shelf does not pretend.
        //
        // A WITHHELD work is the one permitted exception, and only
        // because it is declared. The Cambridge Shakespeares are off the
        // shelf on purpose — 39% critical apparatus — and their payloads
        // stay on disk so a re-ingest can be compared against them. What
        // this still forbids is a payload that is off the shelf and
        // nobody said why.
        // BOTH FILES, or this asks the served shelf whether it contains
        // anything unserved and is answered no by construction. The index is
        // split by shelf state so that eighty withheld works stop riding into
        // every reader's bundle; the drift it was written to catch is between
        // the works DIRECTORY and the catalogue, and that lives in the union.
        const index = {
            ...(await import('./division-index.json')).default,
            ...(await import('./division-index.withheld.json')).default
        };
        const { INGESTED_META, WITHHELD_WORKS } = await import('./index.js');
        const registered = new Set(INGESTED_META.map(m => m.id));
        expect(Object.keys(index).length)
            .toBe(registered.size + Object.keys(WITHHELD_WORKS).length);
        const unshelved = Object.keys(index)
            .filter(id => !registered.has(id) && !Object.hasOwn(WITHHELD_WORKS, id));
        expect(unshelved, `${unshelved.join(', ')} are ingested but on no shelf`).toEqual([]);

        // AND THE SERVED FILE HOLDS ONLY SERVED WORKS. This is the half that
        // reaches a reader; a withheld id here is 49 KiB of metadata for a
        // book nobody can name, shipped behind a runtime filter that cannot
        // remove it (a static import IS the dependency).
        const served = Object.keys((await import('./division-index.json')).default);
        expect(served.filter(id => !registered.has(id)),
            'withheld works in the shipped index').toEqual([]);
        expect(served.length).toBe(registered.size);

        // And every withholding states its reason, so the shelf never
        // goes quiet about something it is holding back.
        for (const [id, reason] of Object.entries(WITHHELD_WORKS)) {
            expect(typeof reason === 'string' && reason.length > 20,
                `${id} is withheld without a stated reason`).toBe(true);
        }
    });

    it('lets nothing that ships import the withheld record', async () => {
        // THE 82 MB LESSON, restated at 49 KiB: a runtime filter cannot remove
        // a build-time dependency, because the static import IS the
        // dependency. `buildLibraryCatalogue` has always dropped the withheld
        // works, and all eighty of them shipped anyway.
        //
        // A test may read the withheld record — the hard front-matter and
        // division cases live there. Nothing a bundler follows may.
        const { readdirSync, readFileSync, statSync } = await import('node:fs');
        const { join } = await import('node:path');

        const offenders = [];
        const walk = (dir) => {
            for (const name of readdirSync(dir)) {
                const path = join(dir, name);
                if (statSync(path).isDirectory()) {
                    walk(path);
                    continue;
                }
                if (!/\.(?:js|mjs|ts)$/u.test(name)) continue;
                if (/\.test\.[jt]s$/u.test(name)) continue;
                if (readFileSync(path, 'utf8').includes('division-index.withheld.json')) {
                    offenders.push(path);
                }
            }
        };
        walk(join(process.cwd(), 'src'));

        // The guard is worth its reach: it has to be able to see the string
        // it is looking for.
        expect(readFileSync(
            join(process.cwd(), 'src/content/archive/front-matter.test.js'), 'utf8'
        )).toContain('division-index.withheld.json');

        expect(offenders, `${offenders.join(', ')} would ship the withheld record`)
            .toEqual([]);
        // A SWEEP NEEDS A SWEEP'S BUDGET. This reads every module under src/
        // synchronously, which is comfortable alone and not comfortable while
        // every other fork is doing its own work — it timed out at the default
        // 5s in a full run and passed twice in isolation immediately after.
        // The budget is widened rather than the pool narrowed, for the same
        // reason furniture.test.js was: a guard that goes red on contention
        // teaches people to re-run rather than to read.
    }, 30_000);
});

describe('a misnamed head does not open the work', () => {
    const sec = (name, words) => ({
        name, content: Array.from({ length: words }, () => 'word').join(' ')
    });

    it('drops a front-matter section named after the contents page', () => {
        // The Odyssey's title page arrives named "BOOK XXIV.", because
        // the ingest names a section after a heading found inside it and
        // the contents list ends at Book XXIV. Ordinals read 24, 1, 2, 3
        // — which passes an ascent test and then opens Homer at Book 24.
        const w = divideSections([
            sec('BOOK XXIV.', 1800),
            sec('BOOK I', 4100), sec('BOOK II', 3000),
            sec('BOOK III', 3000), sec('BOOK IV', 3000)
        ], { minWords: 100 });

        expect(w.entries[0].label).toBe('Front matter');
        expect(w.entries[1].label).toBe('Book I');
        expect(w.entries.some(e => e.label === 'Book XXIV')).toBe(false);
    });

    it('keeps a work whose numbering merely skips a number', () => {
        // THE MISTAKE THIS RULE HAD TO BE NARROWED TO AVOID. Trimming to
        // the longest CONSECUTIVE run instead buried Moby-Dick's first
        // sixteen chapters in front matter, because its chapters skip
        // from 16 to 18 and the run after the gap was longer. A scheme
        // starts at its lowest number; irregularity later is normal.
        const sections = [];
        for (const n of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 18, 19, 20, 21, 22]) {
            sections.push(sec(`CHAPTER ${n}`, 800));
        }
        const w = divideSections(sections, { minWords: 100 });
        expect(w.entries[0].label).toBe('Chapter 1');
        expect(w.entries.filter(e => e.label.startsWith('Front matter'))).toHaveLength(0);
        expect(w.entries).toHaveLength(21);
    });
});

describe('a work is read in the vocabulary it was written in', () => {
    const sec = (name, words) => ({
        name, content: Array.from({ length: words }, () => 'word').join(' ')
    });

    it('parses the division words the ingest already writes', () => {
        // The acquisition list has always contained RUNE and ADVENTURE,
        // so the Kalevala's runes and the Nibelungenlied's adventures
        // were found and named correctly in the payload — and then
        // arrived on the shelf as anonymous "Readings", because this
        // module's list could not read the names the other one wrote.
        for (const [word, noun] of [['RUNE', 'Rune'], ['ADVENTURE', 'Adventure'], ['POEM', 'Poem']]) {
            const w = divideSections(
                [1, 2, 3, 4].map(n => sec(`${word} ${n}`, 900)), { minWords: 100 });
            expect(w.noun, `${word} should divide`).toBe(noun);
            expect(w.entries).toHaveLength(4);
        }
    });
});

describe('a declared vocabulary is a hint, not an authority', () => {
    it('reads the division noun out of a curator\'s prose', () => {
        expect(headingVocabulary({ readingUnit: 'one runo', levels: ['50 runos'] }))
            .toEqual(['runo']);
        expect(headingVocabulary({ readingUnit: 'one book, with speech blocks retained' }))
            .toEqual(['book']);
        // "a route of 10–20 laisses, while each laisse remains addressable"
        expect(headingVocabulary({ readingUnit: 'a route of 10-20 laisses, while each laisse remains addressable' }))
            .toContain('laisse');
    });

    it('yields nothing for a unit that names no heading', () => {
        // "one numbered narrative" describes a division without naming
        // one. A vocabulary of "narrative" would search a text for a
        // word it never uses and find no structure at all, so the
        // caller must be told there is nothing to try.
        expect(headingVocabulary({ readingUnit: 'one numbered narrative' })).toEqual([]);
        expect(headingVocabulary({ readingUnit: 'one editorially mapped movement' })).toEqual([]);
        expect(headingVocabulary({})).toEqual([]);
    });

    it('does not widen a work\'s search back out through its levels', () => {
        // Levels are consulted only when the reading unit gave nothing.
        // Adding them always would put "trilogy", "choral" and "frame"
        // into the search, which is the opposite of scoping it.
        const v = headingVocabulary({
            readingUnit: 'one play for ordinary reading, one scene for RSVP',
            levels: ['trilogy > play > choral/scene blocks']
        });
        expect(v).toEqual(['play', 'scene']);
        expect(v).not.toContain('trilogy');
    });
});

describe('a heading with no body is a contents line', () => {
    it('folds a repeated contents table into the work it describes', () => {
        // Editions that print a table of acts or chapters before the
        // text repeat every heading, and the repeats survived as entries
        // holding nothing but themselves — The Little Clay Cart offered
        // "Act I" containing 34 characters, and 22 acts for a play that
        // has 10. The floor is 200 characters because that is the bar
        // archive.test.js has always used for "suspiciously short".
        const body = (n) => `ACT ${n}\n\n${Array.from({ length: 400 }, () => 'word').join(' ')}`;
        const sections = [
            // The contents table: heading lines with a one-line gloss.
            { name: 'ACT I', content: 'ACT I\n\nThe gems are stolen.' },
            { name: 'ACT II', content: 'ACT II\n\nThe gambler flees.' },
            { name: 'ACT III', content: 'ACT III\n\nThe cart is taken.' },
            // The play itself.
            { name: 'ACT I', content: body('I') },
            { name: 'ACT II', content: body('II') },
            { name: 'ACT III', content: body('III') }
        ];
        const w = divideSections(sections, { minWords: 100 });
        expect(w.noun).toBe('Act');
        // Three acts, not six, and every one of them has a body.
        expect(w.entries).toHaveLength(3);
        for (const e of w.entries) expect(e.content.length).toBeGreaterThan(200);
    });

    it('keeps the folded text rather than discarding it', () => {
        // A contents line is not part of the reading, but throwing it
        // away would make the divider lossy, and a view that drops
        // prose is not a view.
        const sections = [
            { name: 'ACT I', content: 'ACT I\n\nA gloss.' },
            { name: 'ACT I', content: `ACT I\n\n${Array.from({ length: 400 }, () => 'w').join(' ')}` },
            { name: 'ACT II', content: `ACT II\n\n${Array.from({ length: 400 }, () => 'w').join(' ')}` }
        ];
        const w = divideSections(sections, { minWords: 100 });
        expect(w.entries.map(e => e.content).join(' ')).toContain('A gloss.');
    });
});

describe('a contents page is not a reading', () => {
    /**
     * War and Peace opened on 802 words reading "WAR AND PEACE By Leo
     * Tolstoy Contents BOOK ONE: 1805 CHAPTER I CHAPTER II" and onward
     * for three hundred and sixty-five more. A reader who chose the
     * first reading of Tolstoy got the index.
     *
     * This is the Odyssey's "BOOK XXIV" a second time: there the
     * contents page was mistaken for a division, here it was correctly
     * identified as front matter and then offered as something to read.
     */
    const contents = (noun, n) => `${noun.toUpperCase()} I `
        + Array.from({ length: n }, (_, i) => `${noun.toUpperCase()} ${i + 2}`).join(' ');

    it('knows an index by the one thing prose never does', () => {
        // A contents page says the division's name once per division.
        expect(isContentsPage(contents('chapter', 60), 'Chapter')).toBe(true);
        expect(isContentsPage(contents('canto', 60), 'Canto')).toBe(true);
    });

    it('judges against the noun the scheme actually derived', () => {
        // A work divided by Canto must be judged on "Canto". Guessing
        // "chapter" would clear an index of cantos.
        expect(isContentsPage(contents('canto', 60), 'Chapter')).toBe(false);
        expect(isContentsPage(contents('canto', 60), 'Canto')).toBe(true);
    });

    it('leaves prose alone, however much front matter it is', () => {
        // Fifteen works open on a preamble and most of them should: The
        // Scarlet Letter's is The Custom-House, which is Hawthorne's,
        // and the Shahnama's is its translator's introduction. Measured,
        // no genuine preamble in the Archive exceeds 0.2%.
        const prose = 'It is a truth universally acknowledged that a single man in '
            + 'possession of a good fortune must be in want of a wife. However little '
            + 'known the feelings or views of such a man may be on his first entering '
            + 'a neighbourhood, this truth is so well fixed in the minds of the '
            + 'surrounding families that he is considered as the rightful property.';
        expect(isContentsPage(prose, 'Chapter')).toBe(false);
        // Even when the word appears — a preface may discuss chapters.
        expect(isContentsPage(`${prose} See Chapter I and Chapter II.`, 'Chapter')).toBe(false);
    });

    it('refuses to judge something too short to have a pattern', () => {
        expect(isContentsPage('Chapter I Chapter II', 'Chapter')).toBe(false);
        expect(isContentsPage('', 'Chapter')).toBe(false);
        expect(isContentsPage(null, 'Chapter')).toBe(false);
    });

    it('needs a noun to judge against', () => {
        expect(isContentsPage(contents('chapter', 60), null)).toBe(false);
        expect(isContentsPage(contents('chapter', 60), '')).toBe(false);
    });

    it('no work on the shelf still opens on its own index', async () => {
        const { ingestedArchiveTexts } = await import('./index.js');
        const offenders = [];
        for (const work of ingestedArchiveTexts()) {
            const divisions = await work.getDivisions();
            if (!divisions?.divided) continue;
            const first = divisions.entries[0];
            if (first && isContentsPage(first.content, divisions.noun)) {
                offenders.push(work.id);
            }
        }
        expect(offenders, `${offenders.join(', ')} open on a contents page`).toEqual([]);
    }, 240000);

    it('keeps front matter that is the author\u2019s own', async () => {
        // Moby-Dick's preamble is an index, and then Etymology and
        // Extracts, which are MELVILLE'S and belong to the book. Measured
        // whole the index is diluted below the threshold and nothing is
        // dropped; measured whole and dropped, Etymology goes with it.
        // Each split piece answers for itself.
        //
        // 2026-08-06: the index went, and Melville's part stayed \u2014 which
        // is the whole point of this test and is now visible in the label.
        // The division had been called "Epilogue", because the ingest's
        // heading detector took the last line of the contents list; the
        // real Epilogue is a different division and is last. So the
        // assertion is on the CONTENT rather than on a label the ingest
        // got wrong, plus the name it should have had all along.
        // Moby-Dick is withheld with the rest of the corpus, and withheld is
        // not deleted — the payload is read straight so the rule this guards
        // survives the canon decision.
        const mod = await import('./works/moby-dick-or-the-whale.js');
        const sections = mod[Object.keys(mod).find(k => k.endsWith('_SECTIONS'))];
        const divisions = divideSections(sections);
        // The LABEL is the divisions layer's own ("Front matter"), and it
        // is right: this is the book's front matter and it is Melville's.
        // The assertion is on what the division HOLDS, which is the thing
        // that must not be lost.
        expect(divisions.entries[0].content).toMatch(/Jonas-in-the-Whale|set sail from the Elbe/);
        expect(divisions.entries[0].content).toMatch(/ETYMOLOGY/);
        // \u2026and the index that shared the division with it is gone.
        expect(divisions.entries[0].content).not.toMatch(/Original Transcriber/i);
        // AND THE ENDING COMES AFTER THE BEGINNING. Asserting it is LAST
        // would be asserting the wrong thing twice over: getDivisions
        // splits oversized divisions, so the final entry is a fragment of
        // Chapter 135. What matters is the order, which the ingest had
        // wrong — it labelled Melville's Etymology "Epilogue", taking the
        // last line of the contents list as a heading, and the real
        // Epilogue sat elsewhere under the same name.
        const epilogue = divisions.entries.findIndex(e => /The drama.s done/i.test(e.content));
        expect(epilogue).toBeGreaterThan(0);
    }, 240000);
});
