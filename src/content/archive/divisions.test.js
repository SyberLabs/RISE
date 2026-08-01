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
    romanValue, parseHeading, schemeFromNames, splitLongDivision, divideSections, headingVocabulary
} from './divisions.js';

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
            if (entry.divided) expect(entry.noun || entry.titled).toBeTruthy();
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
        const { default: index } = await import('./division-index.json');
        const { INGESTED_META, WITHHELD_WORKS } = await import('./index.js');
        const registered = new Set(INGESTED_META.map(m => m.id));
        const unshelved = Object.keys(index)
            .filter(id => !registered.has(id) && !Object.hasOwn(WITHHELD_WORKS, id));
        expect(unshelved, `${unshelved.join(', ')} are ingested but on no shelf`).toEqual([]);

        // And every withholding states its reason, so the shelf never
        // goes quiet about something it is holding back.
        for (const [id, reason] of Object.entries(WITHHELD_WORKS)) {
            expect(typeof reason === 'string' && reason.length > 20,
                `${id} is withheld without a stated reason`).toBe(true);
        }
    });
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
