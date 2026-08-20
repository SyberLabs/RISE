/**
 * RISE Chunker Test Suite
 * Tests for text chunking and atomization
 */

import { describe, it, expect } from 'vitest';
import { chunkText, countWords, estimateDuration, detectVerseLineation } from './chunker.js';

describe('chunkText', () => {
  describe('word mode', () => {
    it('splits simple text into word atoms', () => {
      const atoms = chunkText('The way that can be told', { mode: 'word' });

      expect(atoms.length).toBe(6);
      expect(atoms[0].content).toBe('The');
      expect(atoms[1].content).toBe('way');
      expect(atoms[5].content).toBe('told');
    });

    it('preserves punctuation attached to words', () => {
      const atoms = chunkText('Hello, world!', { mode: 'word' });

      expect(atoms[0].content).toBe('Hello,');
      expect(atoms[1].content).toBe('world!');
    });

    it('respects WPM setting', () => {
      const atomsFast = chunkText('word', { wpm: 400 });
      const atomsSlow = chunkText('word', { wpm: 100 });

      // Faster WPM = shorter duration
      expect(atomsFast[0].duration).toBeLessThan(atomsSlow[0].duration);
    });

    it('applies length modifier for longer words', () => {
      const shortWord = chunkText('a', { wpm: 220 })[0];
      const longWord = chunkText('consciousness', { wpm: 220 })[0];

      // Longer words get more time
      expect(longWord.duration).toBeGreaterThan(shortWord.duration);
    });

    it('applies punctuation modifier', () => {
      const noPunctuation = chunkText('word', { wpm: 220 })[0];
      const withPeriod = chunkText('word.', { wpm: 220 })[0];
      const withQuestion = chunkText('word?', { wpm: 220 })[0];

      expect(withPeriod.duration).toBeGreaterThan(noPunctuation.duration);
      expect(withQuestion.duration).toBeGreaterThan(noPunctuation.duration);
    });

    it('sets correct modality', () => {
      const atoms = chunkText('test', { mode: 'word' });

      expect(atoms[0].modality).toBe('text');
    });

    it('assigns source identifier', () => {
      const atoms = chunkText('test', { source: 'tao-te-ching' });

      expect(atoms[0].source).toBe('tao-te-ching');
    });

    it('assigns sequential positions', () => {
      const atoms = chunkText('one two three', { mode: 'word' });

      expect(atoms[0].position).toBe(0);
      expect(atoms[1].position).toBe(1);
      expect(atoms[2].position).toBe(2);
    });
  });

  describe('phrase mode', () => {
    it('splits text into phrase chunks', () => {
      const atoms = chunkText('The way that can be told, is not the eternal way.', { mode: 'phrase' });

      expect(atoms.length).toBeGreaterThan(1);
      expect(atoms[0].content).toContain('The way');
    });

    it('calculates duration based on word count', () => {
      const atoms = chunkText('One two three, four five.', { mode: 'phrase', wpm: 220 });

      // Phrases with more words should have longer durations
      const wordCount = atoms[0].content.split(/\s+/).length;
      expect(wordCount).toBeGreaterThan(1);
    });
  });

  describe('sentence mode', () => {
    it('splits text into sentence chunks', () => {
      const text = 'First sentence. Second sentence. Third one here.';
      const atoms = chunkText(text, { mode: 'sentence' });

      expect(atoms.length).toBe(3);
      expect(atoms[0].content).toBe('First sentence.');
      expect(atoms[1].content).toBe('Second sentence.');
    });

    it('handles question marks and exclamations', () => {
      const text = 'Is this working? Yes it is! Great news.';
      const atoms = chunkText(text, { mode: 'sentence' });

      expect(atoms.length).toBe(3);
    });
  });

  describe('paragraph mode', () => {
    it('keeps paragraphs intact', () => {
      const text = 'First paragraph here.\n\nSecond paragraph here.';
      const atoms = chunkText(text, { mode: 'paragraph' });

      expect(atoms.length).toBe(2);
      expect(atoms[0].content).toBe('First paragraph here.');
      expect(atoms[1].content).toBe('Second paragraph here.');
    });
  });

  describe('special markers', () => {
    it('handles [PAUSE] marker', () => {
      const atoms = chunkText('before\n\n[PAUSE]\n\nafter', { mode: 'word' });

      const pauseAtom = atoms.find(a => a.tags.includes('PAUSE'));
      expect(pauseAtom).toBeDefined();
      expect(pauseAtom.duration).toBe(2000);
      expect(pauseAtom.content).toBe('');
    });

    it('handles [FLASH] marker', () => {
      const atoms = chunkText('word\n\n[FLASH]\n\nword', { mode: 'word' });

      const flashAtom = atoms.find(a => a.tags.includes('FLASH'));
      expect(flashAtom).toBeDefined();
      expect(flashAtom.duration).toBe(50);
    });

    it('handles [HOLD] marker', () => {
      const atoms = chunkText('text\n\n[HOLD]\n\nmore', { mode: 'word' });

      const holdAtom = atoms.find(a => a.tags.includes('HOLD'));
      expect(holdAtom).toBeDefined();
      expect(holdAtom.duration).toBe(3000);
    });

    it('marker case insensitive', () => {
      const atoms = chunkText('a\n\n[pause]\n\nb', { mode: 'word' });

      const pauseAtom = atoms.find(a => a.tags.includes('PAUSE'));
      expect(pauseAtom).toBeDefined();
    });

    // Markers are authored choreography: they are structural tokens,
    // not prose, and must survive EVERY chunking mode identically.
    // (Regression: inline markers used to survive Word by tokenization
    // luck and were silently destroyed in Phrase/Sentence/Paragraph.)
    it.each(['word', 'phrase', 'sentence', 'paragraph'])(
      'preserves inline markers in %s mode',
      (mode) => {
        const atoms = chunkText('Alpha | [PAUSE] | omega.', { mode });

        const pauseAtom = atoms.find(a => a.tags.includes('PAUSE'));
        expect(pauseAtom).toBeDefined();
        expect(pauseAtom.duration).toBe(2000);

        const textAtoms = atoms.filter(a => a.content.length > 0);
        expect(textAtoms.map(a => a.content)).toEqual(['Alpha', 'omega.']);

        // Text before and after the marker stays in order around it
        const pauseIndex = atoms.indexOf(pauseAtom);
        expect(atoms.indexOf(textAtoms[0])).toBeLessThan(pauseIndex);
        expect(atoms.indexOf(textAtoms[1])).toBeGreaterThan(pauseIndex);
      }
    );

    it.each(['word', 'phrase', 'sentence', 'paragraph'])(
      'preserves multiple mixed inline markers in %s mode',
      (mode) => {
        const atoms = chunkText('one [FLASH] two three. Four [HOLD] five.', { mode });

        expect(atoms.some(a => a.tags.includes('FLASH'))).toBe(true);
        expect(atoms.some(a => a.tags.includes('HOLD'))).toBe(true);
        // Token conservation: every word of prose still arrives
        const prose = atoms.map(a => a.content).join(' ').split(/\s+/).filter(Boolean);
        expect(prose.join(' ')).toBe('one two three. Four five.');
      }
    );

    it('inline marker replaces (not stacks with) the paragraph pause', () => {
      // Word mode historically emitted no paragraph-break around an
      // inline marker; promotion to paragraph must not add one.
      const atoms = chunkText('Alpha [PAUSE] omega.', { mode: 'word' });
      expect(atoms.some(a => a.tags.includes('paragraph-break'))).toBe(false);
    });
  });

  describe('paragraph breaks', () => {
    it('adds paragraph break atoms between paragraphs', () => {
      const atoms = chunkText('Para one.\n\nPara two.', { mode: 'word' });

      const breakAtom = atoms.find(a => a.tags.includes('paragraph-break'));
      expect(breakAtom).toBeDefined();
      expect(breakAtom.content).toBe('');
    });

    it('removes trailing paragraph break', () => {
      const atoms = chunkText('Single paragraph.', { mode: 'word' });

      const lastAtom = atoms[atoms.length - 1];
      expect(lastAtom.tags).not.toContain('paragraph-break');
    });
  });

  describe('edge cases', () => {
    it('handles empty string', () => {
      const atoms = chunkText('', { mode: 'word' });

      expect(atoms).toEqual([]);
    });

    it('handles whitespace only', () => {
      const atoms = chunkText('   \n\n   ', { mode: 'word' });

      expect(atoms).toEqual([]);
    });

    it('handles single word', () => {
      const atoms = chunkText('word', { mode: 'word' });

      expect(atoms.length).toBe(1);
      expect(atoms[0].content).toBe('word');
    });

    it('handles multiple spaces between words', () => {
      const atoms = chunkText('one    two     three', { mode: 'word' });

      expect(atoms.length).toBe(3);
    });
  });
});

describe('countWords', () => {
  it('counts words correctly', () => {
    expect(countWords('one two three')).toBe(3);
    expect(countWords('hello')).toBe(1);
    expect(countWords('')).toBe(0);
  });

  it('handles multiple whitespace', () => {
    expect(countWords('one   two\n\nthree')).toBe(3);
  });

  it('handles leading/trailing whitespace', () => {
    expect(countWords('  one two  ')).toBe(2);
  });
});

describe('estimateDuration', () => {
  it('calculates duration based on word count and WPM', () => {
    // 220 words at 220 WPM = 1 minute = 60000ms
    const duration = estimateDuration('word '.repeat(220), 220);

    expect(duration).toBeCloseTo(60000, -2); // Within 100ms
  });

  it('faster WPM gives shorter duration', () => {
    const text = 'one two three four five';
    const slow = estimateDuration(text, 100);
    const fast = estimateDuration(text, 400);

    expect(fast).toBeLessThan(slow);
  });

  it('returns 0 for empty text', () => {
    expect(estimateDuration('', 220)).toBe(0);
  });
});

describe('scripture verse anchoring (PERICOPE-IMAGERY-SPEC §4)', () => {
  // The shape prepareScripture emits: anchors keyed by non-empty
  // paragraph ordinal, sentinels already stripped from the text.
  const scriptureHints = anchors => ({ scripture: { verseAnchors: anchors } });

  it('stamps each atom with the verse of its paragraph', () => {
    const text = 'In the beginning was the Word.\n\nAnd the Word was God.';
    const atoms = chunkText(text, {
      mode: 'sentence',
      hints: scriptureHints([
        { paragraph: 0, chapter: 1, verse: 1 },
        { paragraph: 1, chapter: 1, verse: 2 }
      ])
    });
    const worded = atoms.filter(a => a.content.trim());
    expect(worded[0].chapter).toBe(1);
    expect(worded[0].verse).toBe(1);
    expect(worded[worded.length - 1].verse).toBe(2);
  });

  it('a paragraph with no anchor inherits the last verse in force', () => {
    // verse text wrapping across the chunker's paragraph split: only
    // the first paragraph carries an anchor
    const text = 'First line of the verse.\n\nSecond line, same verse.';
    const atoms = chunkText(text, {
      mode: 'sentence',
      hints: scriptureHints([{ paragraph: 0, chapter: 3, verse: 16 }])
    });
    const worded = atoms.filter(a => a.content.trim());
    expect(worded.every(a => a.chapter === 3 && a.verse === 16)).toBe(true);
  });

  it('structural silence (paragraph breaks) carries no verse', () => {
    const text = 'Verse one text.\n\nVerse two text.';
    const atoms = chunkText(text, {
      mode: 'word',
      hints: scriptureHints([
        { paragraph: 0, chapter: 1, verse: 1 },
        { paragraph: 1, chapter: 1, verse: 2 }
      ])
    });
    const breaks = atoms.filter(a => a.tags.includes('paragraph-break'));
    expect(breaks.length).toBeGreaterThan(0);
    expect(breaks.every(a => a.chapter === undefined && a.verse === undefined)).toBe(true);
  });

  it('is inert without scripture hints — no atom is stamped', () => {
    const atoms = chunkText('Plain prose, no scripture.', { mode: 'word' });
    expect(atoms.every(a => a.chapter === undefined && a.verse === undefined)).toBe(true);
  });
});

describe('the phrase floor', () => {
    // Phrase mode had a ceiling and nothing underneath it, so a
    // comma-separated list — one thought — became one screen per item.
    // Book VI measured 27% fragments and 95 stutter runs before this.
    const floorOn = text => chunkText(text, { mode: 'phrase', wpm: 200, phraseFloor: true })
        .map(a => a.content);
    // EXPLICIT `false` from 2026-08-06: the floor is the default now, so
    // "off" has to be asked for. A helper that relied on the default to
    // mean off would silently start testing the same thing twice.
    const floorOff = text => chunkText(text, { mode: 'phrase', wpm: 200, phraseFloor: false })
        .map(a => a.content);

    it('rejoins fragments into the thought they were cut from', () => {
        const marcus = 'I shall encounter meddling, ungrateful, violent, '
            + 'treacherous, envious, unsociable people.';
        expect(floorOff(marcus).length).toBeGreaterThan(5);
        const merged = floorOn(marcus);
        expect(merged.length).toBeLessThan(4);
        for (const atom of merged) {
            expect(atom.split(/\s+/).length).toBeGreaterThan(2);
        }
    });

    it('is ON unless a caller declines — reversed 2026-08-06', () => {
        // It was opt-in on the reasoning that it "damages text whose short
        // phrases are authored". Measured paired across 24 works, it does
        // not: verse comes out byte-identical and unprofiled dialogue goes
        // from three stranded speaker labels to none. CV falls 0.227,
        // d = 2.92, 23 of 24 works improve. See PHRASE-CHUNKING-STUDY §7b.
        const text = 'One, two, three, four, five, six, seven, eight.';
        const byDefault = chunkText(text, { mode: 'phrase', wpm: 200 }).map(a => a.content);
        expect(byDefault).toEqual(floorOn(text));
        expect(floorOff(text).length).toBeGreaterThan(byDefault.length);
    });

    it('never joins one sentence to the next', () => {
        const text = 'He stopped. Then, slowly, he turned and walked away.';
        for (const atom of floorOn(text)) {
            // A period inside an atom, with more text after it, is two
            // thoughts sharing one breath.
            expect(atom).not.toMatch(/[.!?]\s+\S/);
        }
    });

    it('never merges away an authored boundary', () => {
        // The Vault's sequences carry hand-placed `|` marks. By every
        // metric here they look like the defect — short pieces, many of
        // them — because they are short BY DESIGN. That is the phrasing
        // an author asked for, and it is the one thing the floor may not
        // touch. Content authors; the runtime follows.
        const authored = 'This is a new approach | to writing songs '
            + '| that requires minimal | to no musical training.';
        expect(floorOn(authored)).toEqual(floorOff(authored));
        expect(floorOn(authored).length).toBe(4);
    });

    it('never exceeds the ceiling it was given', () => {
        const long = Array.from({ length: 40 }, (_, i) => `word${i},`).join(' ');
        for (const atom of floorOn(long)) {
            expect(atom.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(16);
        }
    });

    it('leaves a one-word sentence standing alone', () => {
        // Three survivors in the study were one-word sentences, and they
        // should stay that way.
        const atoms = floorOn('Enough. The rest of this is a longer clause entirely.');
        expect(atoms[0]).toBe('Enough.');
    });

    it('touches no other mode', () => {
        const text = 'One, two, three, four, five, six, seven, eight.';
        for (const mode of ['word', 'sentence', 'paragraph']) {
            const on = chunkText(text, { mode, wpm: 200, phraseFloor: true }).map(a => a.content);
            const off = chunkText(text, { mode, wpm: 200 }).map(a => a.content);
            expect(on, mode).toEqual(off);
        }
    });
});

describe('verse lineation, detected rather than declared', () => {
    const verse = (lines) => lines.join('\n');
    const miltonic = verse([
        'All night the dreadless Angel, unpursued,',
        'Through Heaven\'s wide champain held his way; till Morn,',
        'Waked by the circling Hours, with rosy hand',
        'Unbarred the gates of light. There is a cave',
        'Within the mount of God, fast by his throne,',
        'Where light and darkness in perpetual round',
        'Lodge and dislodge by turns, which makes through Heaven',
        'Grateful vicissitude, like day and night;',
        'Light issues forth, and at the other door',
        'Obsequious darkness enters, till her hour'
    ]);

    it('recognises a text that still carries its lines', () => {
        const found = detectVerseLineation(miltonic);
        expect(found.lineated).toBe(true);
        expect(found.medianWords).toBeLessThanOrEqual(12);
    });

    it('refuses a poem whose edition lost its lineation', () => {
        // Our Dickinson and Leaves of Grass are set as running prose:
        // median line 19-20 words, more than half over the ceiling. A
        // manifest saying `structure: "verse"` would be true about the
        // poem and false about the file, and the chunker can only act on
        // the file.
        const runTogether = verse([
            'If I can stop one heart from breaking, I shall not live in vain; '
            + 'if I can ease one life the aching, or cool one pain,',
            'or help one fainting robin unto his nest again, I shall not live in vain. '
            + 'And this is all there is to say of it, at length and over.',
            'A wounded deer leaps highest, I have heard the hunter tell; '
            + 'it is but the ecstasy of death, and then the brake is still.',
            'The smitten rock that gushes, the trampled steel that springs, '
            + 'a cheek is always redder just where the hectic stings.',
            'Mirth is the mail of anguish, in which it caution arm, '
            + 'lest anybody spy the blood and you be looking on.',
            'I like a look of agony, because I know it is true; '
            + 'men do not sham convulsion, nor simulate a throe.',
            'The eyes glaze once, and that is death, impossible to feign '
            + 'the beads upon the forehead by homely anguish strung.',
            'Heart, we will forget him, you and I, tonight! '
            + 'You must forget the warmth he gave, I will forget the light.',
            'When you have done, pray tell me, that I my thoughts may dim; '
            + 'haste, lest while you are lagging, I may remember him.'
        ]);
        expect(detectVerseLineation(runTogether).lineated).toBe(false);
    });

    it('refuses hard-wrapped prose, which by word count looks identical', () => {
        // Gutenberg wraps at a fixed column, so Moby-Dick, Karamazov,
        // Swann's Way and the prose Odyssey all have short lines with
        // none over the ceiling. A wrap point is not an authored
        // boundary. The tell is crowding: those files put 82-89% of
        // their lines against the column; Milton and Dante sit at 40%.
        const wrapped = verse(Array.from({ length: 20 }, () =>
            'and it was upon that morning that he came down to the harbour side'));
        const found = detectVerseLineation(wrapped);
        expect(found.crowding).toBeGreaterThan(0.6);
        expect(found.lineated).toBe(false);
    });

    it('gives one atom per line where the lines are real', () => {
        const atoms = chunkText(miltonic, { mode: 'phrase', wpm: 200, verseLines: true })
            .map(a => a.content);
        expect(atoms).toHaveLength(10);
        expect(atoms[0]).toBe('All night the dreadless Angel, unpursued,');
        // Without it, his commas are obeyed instead of his lines. The
        // floor is declined here so the comparison is lines-vs-commas and
        // not lines-vs-floored-commas.
        const split = chunkText(miltonic, { mode: 'phrase', wpm: 200, phraseFloor: false })
            .map(a => a.content);
        expect(split.length).toBeGreaterThan(atoms.length);
        expect(split).toContain('unpursued,');
    });

    it('sends an over-long line to the punctuation splitter', () => {
        // A line above the ceiling is not a verse line; it is prose in a
        // lineated file, or a line the edition ran together.
        const mixed = verse([
            'A short and ordinary line of verse,',
            'and now a line which runs on far past any reasonable ceiling '
            + 'for a single breath, continuing well beyond sixteen words, '
            + 'and further still, and further.',
            'Another short and ordinary line.'
        ]);
        const atoms = chunkText(mixed, { mode: 'phrase', wpm: 200, verseLines: true })
            .map(a => a.content);
        expect(atoms.length).toBeGreaterThan(3);
        for (const atom of atoms) {
            expect(atom.split(/\s+/).filter(Boolean).length).toBeLessThanOrEqual(16);
        }
    });

    it('carries a too-short line FORWARD, not back', () => {
        // Verse runs forward: a running head or half-line belongs to
        // what follows it. This is the opposite direction from the prose
        // floor, and deliberately so.
        const atoms = chunkText(verse([
            'Book VI',
            'All night the dreadless Angel, unpursued,',
            'Through Heaven\'s wide champain held his way; till Morn,',
            'Waked by the circling Hours, with rosy hand',
            'Unbarred the gates of light. There is a cave',
            'Within the mount of God, fast by his throne,'
        ]), { mode: 'phrase', wpm: 200, verseLines: true }).map(a => a.content);
        expect(atoms[0]).toBe('Book VI All night the dreadless Angel, unpursued,');
    });

    it('still floors a PROSE paragraph inside a verse reading', () => {
        // Found by the chunk contact sheet on its first run. Wordsworth
        // prefaces The Complaint of a Forsaken Indian Woman with a 152-word
        // prose headnote; it is one paragraph of one line, and the verse
        // splitter handed a single-line paragraph straight to the punctuation
        // splitter without the floor. The reader met "from sickness," and
        // "food," on screens of their own — the 2026-07 behaviour the floor
        // exists to fix, surviving inside a work that had been declared verse.
        const headnote = 'When a Northern Indian, from sickness, is unable to '
            + 'continue his journey with his companions, he is left behind, '
            + 'covered over with Deer-skins, and is supplied with water, food, '
            + 'and fuel, if the situation of the place will afford it.';
        const atoms = chunkText(headnote,
            { mode: 'phrase', wpm: 200, verseLines: true }).map(a => a.content);
        for (const atom of atoms) {
            expect(atom.split(/\s+/).filter(Boolean).length).toBeGreaterThan(2);
        }
    });

    it('does not apply the prose floor to a verse line', () => {
        // A poet's line is already a chosen unit; growing it into the
        // next one would be the floor overruling the author.
        const withFloor = chunkText(miltonic,
            { mode: 'phrase', wpm: 200, verseLines: true, phraseFloor: true }).map(a => a.content);
        const without = chunkText(miltonic,
            { mode: 'phrase', wpm: 200, verseLines: true }).map(a => a.content);
        expect(withFloor).toEqual(without);
    });
});

describe('phrase mode and the marks that end a thought', () => {
    const phrase = (text) => chunkText(text, { mode: 'phrase', phraseFloor: true })
        .filter(a => a.modality === 'text')
        .map(a => a.content);

    it('breaks at a question mark', () => {
        // Phrase mode must break on `?` and `!`, not only `, ; : — – | .`.
        expect(phrase('Who goes there? He asked again. Nobody answered at all.'))
            .toEqual(['Who goes there?', 'He asked again.', 'Nobody answered at all.']);
    });

    it('breaks at a question even when the sentence continues in lower case', () => {
        // Marcus Aurelius, Book VI. The capital-letter guard belongs to
        // the full stop, where "Dr. Smith" needs it; no abbreviation ends
        // in a question mark, and this corpus continues in lower case —
        // so requiring a capital would have missed the motivating case.
        expect(phrase('and why should they resolve to do me hurt? for what profit unto them.'))
            .toEqual(['and why should they resolve to do me hurt?', 'for what profit unto them.']);
    });

    it('breaks at a question closed by a quotation mark', () => {
        // “You have a house in town, I conclude?” — the mark is not
        // adjacent to the space. `applyPhraseFloor` already allowed for
        // this in `closesSentence`; the splitter had not, so the two
        // disagreed about where a sentence ended.
        expect(phrase('“You have a house in town, I conclude?” The gentleman bowed to her.'))
            .toEqual(['“You have a house in town, I conclude?”', 'The gentleman bowed to her.']);
    });

    it('lets an exclamation stand as its own utterance', () => {
        // "What is truth!" is three words and under the floor, but the
        // floor refuses to merge across a sentence end — so it survives
        // rather than being glued to what follows.
        expect(phrase('What is truth! said jesting Pilate, and would not stay for an answer.'))
            .toEqual(['What is truth!', 'said jesting Pilate, and would not stay for an answer.']);
    });
});

describe('a parenthetical is one breath', () => {
    const phrase = (text) => chunkText(text, { mode: 'phrase', phraseFloor: true })
        .filter(a => a.modality === 'text')
        .map(a => a.content);

    it('never splits inside a parenthetical', () => {
        // Splitting on the comma INSIDE the aside is what left
        // "(which indeed is very irreligious" open and ", nor pray)"
        // closed by nothing. Measured over eight works, edge-splitting
        // with a protected interior took unbalanced atoms from 24 to 4
        // in Paradise Lost and 12 to 2 in the Meditations.
        const atoms = phrase(
            'The merchant spoke at length of it (a thing of gold, silver, and iron) '
            + 'to every one of us who had gathered there.');
        expect(atoms).toContain('(a thing of gold, silver, and iron)');
    });

    it('separates the aside from the sentence around it', () => {
        // THE ASIDE ITSELF must also clear the five-word floor, or the
        // floor will quite correctly have it absorb what follows — a
        // short piece takes its neighbour, which is the whole reason the
        // floor exists. This tests the SPLITTER, so it leaves the floor
        // nothing to do on either side.
        const atoms = phrase(
            'The ancient tree fell without a sound (as all great trees eventually do) '
            + 'upon the quiet road below.');
        expect(atoms[0]).toBe('The ancient tree fell without a sound');
        expect(atoms[1]).toBe('(as all great trees eventually do)');
    });

    it('leaves a balanced atom behind', () => {
        const atoms = phrase(
            'He came into the city, saw what there was (and conquered it all), '
            + 'then departed from the field before evening.');
        for (const atom of atoms) {
            const open = (atom.match(/\(/g) || []).length;
            const close = (atom.match(/\)/g) || []).length;
            expect(open, `unbalanced: ${atom}`).toBe(close);
        }
    });

    it('adds no boundary of its own to an authored paragraph', () => {
        // The Vault's sequences carry hand-placed pipes. The floor
        // already declines to MERGE across one; adding a break inside
        // one is the same overreach from the other direction. If an
        // author wrote "said nothing (at all)" as a phrase, they have
        // answered the question this code exists to answer.
        expect(phrase('The captain | said nothing (at all) | and the sea was calm.'))
            .toEqual(['The captain', 'said nothing (at all)', 'and the sea was calm.']);
    });
});

describe('an enumerator leads the phrase it labels', () => {
    const phrases = text => chunkText(text, { mode: 'phrase' })
        .filter(a => a.content).map(a => a.content);

    it('joins a roman numeral to what follows it', () => {
        // Vitruvius numbers every clause, and the splitter was handing each
        // numeral its own beat: a reader met a lone "II." for four hundred
        // milliseconds and then the sentence it belonged to.
        expect(phrases('II. Of the choice of a site for the walls of a city.'))
            .toEqual(['II. Of the choice of a site for the walls of a city.']);
        expect(phrases('I. On the natural properties of the site, and the aspects proper to it.'))
            .toEqual(['I. On the natural properties of the site,', 'and the aspects proper to it.']);
    });

    it('does the same for the arabic markers in the same texts', () => {
        // Reported for roman numerals; the numeric clause markers beside
        // them broke identically and would have been the next report.
        expect(phrases('1. After insuring the healthfulness of the city, we come to the walls.'))
            .toEqual(['1. After insuring the healthfulness of the city,', 'we come to the walls.']);
    });

    // A clause ending in a numeral is not a label; only a bare ordinal is.
    it('leaves a real sentence ending in a numeral alone', () => {
        expect(phrases('He was certain the culprit was I. Then the room fell silent.'))
            .toEqual(['He was certain the culprit was I.', 'Then the room fell silent.']);
    });

    it('validates roman numerals rather than spelling them from the alphabet', () => {
        // A naive [IVXLCDM]+ also matches CIVIL, DID and MIMIC — which in
        // an all-capital heading would be swallowed into the next phrase.
        expect(phrases('DID. The question stood unanswered.'))
            .toEqual(['DID.', 'The question stood unanswered.']);
        expect(phrases('CIVIL. The word had lost its meaning.'))
            .toEqual(['CIVIL.', 'The word had lost its meaning.']);
    });

    it('does not overrule an author who marked their own phrasing', () => {
        // The same deference applyPhraseFloor shows: a pipe means the
        // phrasing was decided by a person.
        expect(phrases('II. | Of the choice of a site.'))
            .toEqual(['II.', 'Of the choice of a site.']);
    });

    it('never swallows the last piece, having nothing to lead', () => {
        expect(phrases('The chapter ended. IV.')).toEqual(['The chapter ended.', 'IV.']);
    });
});

describe('a connective opens a clause; it does not close one', () => {
    const phrases = text => chunkText(text, { mode: 'phrase' })
        .filter(a => a.content).map(a => a.content);

    it('leads with the connective instead of stranding it', () => {
        // splitLongChunk used a lookBEHIND and cut AFTER the word, so the
        // hinge ended the phrase it was there to introduce. Measured on
        // Dow's Composition: 21 of 171 phrases ended on a connective.
        const long = 'The many different acts and processes combined in a work '
            + 'of art may be attacked and subdued one at a time by the student.';
        for (const piece of phrases(long)) {
            expect(piece, 'a phrase ends on a connective').not.toMatch(/\b(and|but|or|that|with|which)$/i);
        }
    });

    it('never leaves a connective alone, however many are adjacent', () => {
        // Two in a row each got stranded, and the second was the whole
        // phrase: "…in other ways and" / "with" / "better examples."
        const text = 'The principles of art teaching here outlined might be '
            + 'illustrated in other ways and with better examples for the reader.';
        expect(phrases(text)).not.toContain('with');
        expect(phrases(text)).not.toContain('and');
    });

    // Speaker-label / colon boundary: see chunk-profiles.test.js
    // (dialogue profile). A bare colon is already a PHRASE_BOUNDARY;
    // the connective guard's `(?<!:)` lookbehind belongs there.

    it('does not treat a word that merely begins with a connective as one', () => {
        const text = 'The android walked past the organ and the orchard beyond '
            + 'it, and nobody thought anything of the matter at all that day.';
        expect(phrases(text).some(p => /^android/i.test(p.trim()))).toBe(false);
        expect(phrases(text).some(p => /^organ\b/i.test(p.trim()))).toBe(false);
    });
});

describe('an enumerator must actually be one', () => {
    it('does not accept an empty numeral', () => {
        // Every group in the standard-form Roman pattern is optional, so
        // the pattern matched the EMPTY string and the enumerator branch
        // accepted a bare "." or ")" as a numeral with a terminator. The
        // rule claimed only a genuine enumerator moves forward; it did
        // not check that one was there.
        const ROMAN = '(?=[MDCLXVI])M{0,3}(?:CM|CD|D?C{0,3})(?:XC|XL|L?X{0,3})(?:IX|IV|V?I{0,3})';
        const re = new RegExp(`^${ROMAN}$`);
        expect(re.test('')).toBe(false);
        for (const good of ['I', 'II', 'IV', 'XIV', 'MIX']) expect(re.test(good), good).toBe(true);
        for (const bad of ['DID', 'CIVIL', 'MIMIC']) expect(re.test(bad), bad).toBe(false);
    });
});
