import { describe, expect, it } from 'vitest';
import { countWords } from './chunker.js';
import { LIBRARY_LOAD_REFUSAL } from './experience-program-io.js';
import { resolveLibrarySourceIds } from './scriptorium-resolve.js';
import {
  EXTENT_MIN_WORDS,
  EXTENT_OVERSHOOT_LIMIT,
  EXTENT_REFUSAL,
  extentNominalWords,
  extentReadingBound,
  extentReadsWholeDivision,
  extentSourceName,
  libraryExtentId,
  parseLibraryExtent,
  sentenceAlignedPrefix
} from './library-extent.js';

const sentences = (n, wordsEach = 10) => Array.from({ length: n }, (_, i) =>
  `${['Alpha', 'Beta', 'Gamma', 'Delta'][i % 4]} ${Array.from({ length: wordsEach - 2 },
    (_, w) => `w${i}x${w}`).join(' ')} end${i}.`).join(' ');

describe('an extent rides in the source id', () => {
  it('reads a whole work, a division, and a division opening', () => {
    expect(parseLibraryExtent('montaigne-essays'))
      .toEqual({ workId: 'montaigne-essays', division: null, words: null, refusal: null });
    expect(parseLibraryExtent('montaigne-essays#42'))
      .toEqual({ workId: 'montaigne-essays', division: 42, words: null, refusal: null });
    expect(parseLibraryExtent('montaigne-essays#42:200'))
      .toEqual({ workId: 'montaigne-essays', division: 42, words: 200, refusal: null });
  });

  it('round-trips', () => {
    for (const id of ['w', 'w#1', 'w#42:200']) {
      const { workId, division, words } = parseLibraryExtent(id);
      expect(libraryExtentId(workId, division, words)).toBe(id);
    }
  });

  it('refuses an id that names an extent badly, rather than passing it on', () => {
    // Passing it on was the defect: `spoon-river-anthology#50:37` came back
    // with the whole string as its workId, missed in the registry, and told
    // the reader the room does not hold Spoon River — which it does. A
    // nonsense ordinal must not silently become division one either.
    for (const id of ['w#0', 'w#abc']) {
      expect(parseLibraryExtent(id)).toMatchObject({
        division: null, words: null, refusal: EXTENT_REFUSAL.GRAMMAR
      });
    }
    // The floor is about the CUT, so the work and the division are still
    // legible and the refusal can name them.
    for (const words of [0, 1, EXTENT_MIN_WORDS - 1]) {
      expect(parseLibraryExtent(`spoon-river-anthology#50:${words}`)).toEqual({
        workId: 'spoon-river-anthology', division: 50, words: null,
        refusal: EXTENT_REFUSAL.FLOOR
      });
    }
  });

  it('leaves a bare work id alone, hash or no hash', () => {
    // An id with no `#` is not an extent and not an error.
    expect(parseLibraryExtent('montaigne-essays').refusal).toBeNull();
    expect(parseLibraryExtent('a-file-the-reader-pasted').refusal).toBeNull();
  });
});

/**
 * A SUB-FLOOR ASK IS A FACT ABOUT A CUT, NOT ABOUT A SHELF.
 *
 * `parseLibraryExtent` reads a string. It can see that `:39` is below the
 * floor and it cannot see whether the work exists, whether the division
 * exists, or whether that division holds any text — so a caller that treats
 * FLOOR as a verdict lets a fact about the cut SHADOW the question of
 * existence, and the refusal then states facts nobody established:
 *
 *   sacred-tao-te-ching#900:39  refused below-floor, and told the curator to
 *                               name `sacred-tao-te-ching#900` — a chapter of
 *                               eighty-one that does not exist, and following
 *                               the advice earned a second refusal
 *   no-such-work-at-all#5:20    refused below-floor, for a work that is not on
 *                               this build's shelf at all — while the SAME id
 *                               spelled `:200` was correctly absent
 *   oedipus-rex#2:20            refused below-floor, for a work whose own
 *                               prompt calls it undivided
 *
 * and the wording that reads a carried FLOOR reason says "The division itself
 * is here and has text", which was false of all three.
 *
 * §13's four extent statuses exist so a script can tell "this build does not
 * hold that work" from "the curator asked wrongly"; which one it learned
 * turned on the `:N`. So the resolver asks the shelf FIRST, and the floor is
 * judged last — where every fact its sentence asserts has been established.
 */
describe('existence is established before the floor is judged', () => {
  /** What the resolver decided about one id: absent, a reason, or loaded. */
  const verdictFor = async (id) => {
    const { missing, refused, reasons } = await resolveLibrarySourceIds([id]);
    if (missing.includes(id)) return 'absent';
    if (refused.includes(id)) return reasons[id];
    return 'loaded';
  };

  /**
   * THE ASSERTION IN ONE LINE: an id whose work or division does not exist is
   * refused for that, and it is refused for that whatever `:N` it carries.
   * The sub-floor spelling and the ordinary one must reach the same verdict,
   * because the thing that is wrong with them is the same thing.
   */
  const NOT_ON_THE_SHELF = Object.freeze([
    ['no-such-work-at-all#5', 'absent'],
    ['sacred-tao-te-ching#900', LIBRARY_LOAD_REFUSAL.NO_DIVISION],
    ['oedipus-rex#2', LIBRARY_LOAD_REFUSAL.NO_DIVISION]
  ]);

  for (const [base, expected] of NOT_ON_THE_SHELF) {
    it(`reaches the same verdict for ${base} at :20 as at :200`, async () => {
      const belowTheFloor = await verdictFor(`${base}:20`);
      const aboveIt = await verdictFor(`${base}:200`);
      expect(aboveIt, `${base}:200`).toBe(expected);
      expect(
        belowTheFloor,
        `${base}:20 was refused ${belowTheFloor} where ${base}:200 was ${aboveIt}. A `
        + 'sub-floor ask is shadowing the question of existence, and the floor\'s '
        + 'wording asserts three facts about a division nothing looked for.'
      ).toBe(expected);
    });
  }

  it('still refuses the floor where the division is really there', async () => {
    // The other half, or the fix above would be "stop refusing the floor".
    // Spoon River has ninety-some poems, division 50 holds text, and 37 words
    // of it is a fragment — every fact the floor's sentence states is true
    // here, which is the only place it is now reached.
    expect(await verdictFor('spoon-river-anthology#50:37'))
      .toBe(LIBRARY_LOAD_REFUSAL.FLOOR);
    expect(await verdictFor('sacred-tao-te-ching#41:39'))
      .toBe(LIBRARY_LOAD_REFUSAL.FLOOR);
    // And the same division at a legal ask reads.
    expect(await verdictFor('spoon-river-anthology#50:200')).toBe('loaded');
  }, 60_000);

  it('judges the grammar before the shelf, because a broken id names no work', () => {
    // The one verdict that may precede the lookup: `workId` is the whole
    // unparsed string, so there is nothing to look up. This is the ordering
    // the fix above must not have flattened.
    expect(parseLibraryExtent('sacred-tao-te-ching#0').workId)
      .toBe('sacred-tao-te-ching#0');
    expect(parseLibraryExtent('sacred-tao-te-ching#0').refusal)
      .toBe(EXTENT_REFUSAL.GRAMMAR);
  });

  it('reports a grammar refusal for a work nobody has, not an absence', async () => {
    expect(await verdictFor('no-such-work-at-all#0040'))
      .toBe(LIBRARY_LOAD_REFUSAL.GRAMMAR);
  });
});

describe('an opening is cut at a real boundary', () => {
  it('takes the boundary nearest the asked-for length, not the one before it', () => {
    const text = sentences(20, 10);
    const cut = sentenceAlignedPrefix(text, 96);
    // 100 words (ten sentences) is nearer to 96 than 90 is.
    expect(cut.words).toBe(100);
    expect(cut.boundary).toBe('sentence');
    expect(cut.text.endsWith('end9.')).toBe(true);
  });

  it('never cuts inside a sentence', () => {
    const text = sentences(30, 10);
    for (const target of [40, 55, 70, 130, 199]) {
      const cut = sentenceAlignedPrefix(text, target);
      expect(cut.words % 10).toBe(0);
      expect(text.startsWith(cut.text)).toBe(true);
    }
  });

  it('returns the whole thing when it already fits', () => {
    const text = sentences(3, 10);
    expect(sentenceAlignedPrefix(text, 500)).toMatchObject({ words: 30, boundary: 'whole' });
  });

  it('falls to a stanza break where verse has no full stops', () => {
    const stanza = Array.from({ length: 8 },
      (_, s) => Array.from({ length: 4 },
        (_, l) => `line ${s} ${l} word word word`).join('\n')).join('\n\n');
    const cut = sentenceAlignedPrefix(stanza, 60);
    expect(cut.boundary).toBe('paragraph');
    expect(cut.text.includes('\n\n')).toBe(true);
    // A stanza is not split down its middle.
    expect(cut.text.trimEnd().endsWith('word')).toBe(true);
  });

  it('will not return a whole division because it held no boundary', () => {
    // The cap is what stops "round to the nearest sentence" from meaning
    // "read all eleven thousand words of it".
    const unbroken = Array.from({ length: 3000 }, (_, i) => `w${i}`).join(' ');
    const cut = sentenceAlignedPrefix(unbroken, 200);
    expect(cut.words).toBeLessThanOrEqual(Math.round(200 * EXTENT_OVERSHOOT_LIMIT));
    expect(cut.words).toBeGreaterThanOrEqual(EXTENT_MIN_WORDS);
  });

  it('refuses when the first honest boundary lies past the cap', () => {
    // One enormous opening sentence: there is no honest cut before it ends.
    // The cap used to give way here, because it could only reject a
    // candidate once a better one had been found — so `ulysses#18:200`
    // returned 5,714 words, Molly's soliloquy to its first full stop.
    //
    // Two wrong things were on offer, a passage of a wildly different length
    // or nothing, and RISE chooses nothing: a thing that will not resolve is
    // absent, never a substitute.
    const long = `${Array.from({ length: 400 }, (_, i) => `w${i}`).join(' ')}. Next one here.`;
    expect(sentenceAlignedPrefix(long, 200)).toBeNull();
    // 400 words is within reach of a 300-word ask, and out of reach of 200 —
    // the two asks are chosen FROM the exported multiple rather than typed
    // beside it, so a change to EXTENT_OVERSHOOT_LIMIT moves this test's
    // inputs instead of leaving it asserting against a number that has gone.
    expect(Math.round(200 * EXTENT_OVERSHOOT_LIMIT)).toBeLessThan(400);
    expect(Math.round(300 * EXTENT_OVERSHOOT_LIMIT)).toBeGreaterThanOrEqual(400);
    expect(sentenceAlignedPrefix(long, 300)).toMatchObject({ words: 400, boundary: 'sentence' });
  });

  it('says "whole" when the nearest boundary is the end of the text', () => {
    // The last candidate the loop is offered is the end of the body. Taking
    // it is taking the division entire, and calling that an opening put a
    // ", opening" on the name of a reading that was the whole thing.
    // 45 words, and its only full stops fall at 10, 20 and 30 — all below the
    // floor. The nearest candidate left is the end of the text.
    const text = `${sentences(4, 10)} tail words with no stop`;
    expect(countWords(text)).toBe(45);
    expect(sentenceAlignedPrefix(text, 41)).toEqual({ text, words: 45, boundary: 'whole' });
  });

  it('counts words the way the library reports them', () => {
    const text = sentences(5, 10);
    expect(countWords(text)).toBe(50);
    expect(countWords('')).toBe(0);
  });
});

describe('a budget spends what an extent can cost at most', () => {
  it('never promises less than the cut can take', () => {
    // The gate measures with nothing but the catalogue in hand, so the bound
    // has to hold for every text the cutter might later be handed. An input
    // that makes this fail is a score admitted longer than the reader asked
    // for — which is the whole of what the budget is there to prevent.
    for (const wordsEach of [3, 7, 40, 137]) {
      for (const count of [1, 2, 5, 30]) {
        const text = sentences(count, wordsEach);
        const total = countWords(text);
        for (const asked of [40, 55, 200, 900]) {
          const cut = sentenceAlignedPrefix(text, asked);
          if (!cut) continue;
          expect(cut.words).toBeLessThanOrEqual(extentReadingBound(total, asked));
        }
      }
    }
  });

  it('charges a whole division its own length, and says nothing it cannot', () => {
    expect(extentReadingBound(38, null)).toBe(38);
    // Shorter than the ask: the division is read whole and costs what it is.
    expect(extentReadingBound(38, 200)).toBe(38);
    // Longer: the cut may overshoot to the sentence, and no further.
    expect(extentReadingBound(10_000, 200)).toBe(Math.round(200 * EXTENT_OVERSHOOT_LIMIT));
    expect(extentReadingBound(null, 200)).toBeNull();
    expect(extentReadingBound(undefined, null)).toBeNull();
  });
});

/**
 * THE OTHER NUMBER, WHICH THE BOUND WAS BEING MADE TO ANSWER FOR.
 *
 * `extentReadingBound` is the most a cut can be handed and the reader's length
 * was being spent at that ceiling — so a 2,000-word sitting composed of
 * openings delivered 1,254 words, and the size of the shortfall depended on
 * whether the divisions happened to be longer than the ask. `extentNominalWords`
 * is what the extent NAMES, which is what the reader's length is about.
 */
describe('a rung spends what the extent names, not the most it could read', () => {
  it('names a whole work or a whole division its own length', () => {
    expect(extentNominalWords(38, null)).toBe(38);
    expect(extentNominalWords(10_321, null)).toBe(10_321);
    // A division shorter than the ask is read whole, so it names its own
    // length rather than the ask — this is the case the bound got right and
    // the case a naive `min(ask, …)` would get wrong.
    expect(extentNominalWords(extentReadingBound(38, 200), 200)).toBe(38);
  });

  it('names an opening what it asked for, where the bound charges 1.6x it', () => {
    const bound = extentReadingBound(10_000, 200);
    expect(bound).toBe(320);
    expect(extentNominalWords(bound, 200)).toBe(200);
  });

  it('says nothing about a length it does not know', () => {
    expect(extentNominalWords(null, 200)).toBeNull();
    expect(extentNominalWords(undefined, null)).toBeNull();
    // Null exactly where the bound is null, so a source is measurable for the
    // ceiling and the length together or for neither. A budget that could
    // count a source the ceiling could not would be two partitions of one set.
    for (const [division, asked] of [[null, null], [null, 200], [undefined, 40]]) {
      expect(extentNominalWords(extentReadingBound(division, asked), asked)).toBeNull();
    }
  });

  /**
   * THE IDENTITY THE GATE DEPENDS ON, MEASURED RATHER THAN ARGUED.
   *
   * The gate holds the BOUND — `createCuratorSourceReader` reports it — and
   * not the division's length, so `extentNominalWords` derives the nominal
   * from the bound. That is only sound while `min(bound, ask)` equals
   * `min(divisionWords, ask)`, which is true because a division longer than
   * the ask is charged more than the ask by construction. Two derivations of
   * one quantity is exactly the drift this codebase keeps paying for, so the
   * second one is checked against the first over the whole travel.
   */
  it('agrees with the division it was derived from, at every ask', () => {
    const fromDivision = (divisionWords, asked) => (asked
      ? Math.min(divisionWords, Math.max(EXTENT_MIN_WORDS, Math.round(asked)))
      : divisionWords);
    for (const divisionWords of [0, 1, 39, 40, 41, 79, 199, 200, 201, 319, 320, 321,
      897, 5_000, 315_261]) {
      expect(extentNominalWords(extentReadingBound(divisionWords, null), null))
        .toBe(divisionWords);
      // Below EXTENT_MIN_WORDS as well. `parseLibraryExtent` refuses such an
      // ask, so nothing reaches these two through an id — but both are
      // exported and both take a raw number, and the floor is the reason they
      // agree about it. Without it a 20-word ask names 20 where the bound
      // charges 40, and `extentReadsWholeDivision` would then call a 40-word
      // division a cut of itself.
      for (const asked of [1, 20, 39, 40, 41, 79, 100, 199, 200, 201, 320, 500,
        2_000, 20_000]) {
        expect(
          extentNominalWords(extentReadingBound(divisionWords, asked), asked),
          `${divisionWords} words at :${asked}`
        ).toBe(fromDivision(divisionWords, asked));
      }
    }
  });

  /**
   * THE ENVELOPE, WHICH IS WHY NO SECOND CEILING IS CHECKED.
   *
   * A score inside the reader's length by nominal cannot read past
   * OVERSHOOT_LIMIT × that length, because the relation holds per extent and
   * sums. If this ever fails, the gate needs a bound check of its own and the
   * comment in assertSourcesWithinBudget is wrong.
   */
  it('bounds the most an extent can read by the overshoot of what it names', () => {
    for (const divisionWords of [1, 40, 79, 200, 320, 897, 5_000, 315_261]) {
      for (const asked of [null, 40, 79, 200, 500, 2_000]) {
        const bound = extentReadingBound(divisionWords, asked);
        const nominal = extentNominalWords(bound, asked);
        expect(
          bound,
          `${divisionWords} words at :${asked}: bound ${bound} against nominal ${nominal}`
        ).toBeLessThanOrEqual(Math.round(nominal * EXTENT_OVERSHOOT_LIMIT));
      }
    }
  });
});

/**
 * TWO SPELLINGS OF ONE PASSAGE, told apart from two different passages.
 *
 * `#12:79` on a 79-word division is `#12`. The gate folds them together and
 * refuses the score; this is the arithmetic it folds them by, and the half of
 * it that must NOT fold — two openings inside a long division land where the
 * catalogue cannot see, so they are two passages as far as anything here can
 * prove.
 */
describe('an ask that covers its division names the division', () => {
  const wholeAt = (divisionWords, asked) =>
    extentReadsWholeDivision(extentReadingBound(divisionWords, asked), asked);

  it('reads whole when the ask reaches the division\'s own length', () => {
    expect(wholeAt(79, 79)).toBe(true);
    expect(wholeAt(79, 80)).toBe(true);
    expect(wholeAt(79, 3_000)).toBe(true);
    // No ask at all is the division entire by definition.
    expect(wholeAt(79, null)).toBe(true);
    expect(wholeAt(5_000, null)).toBe(true);
  });

  it('claims nothing about an ask that really cuts', () => {
    expect(wholeAt(5_000, 200)).toBe(false);
    // Even where the overshoot could swallow the division: 300 words at a
    // 200-word ask MIGHT come back whole, and where the sentences fall is not
    // in any catalogue. Not provable, so not claimed.
    expect(wholeAt(300, 200)).toBe(false);
    expect(wholeAt(80, 79)).toBe(false);
  });

  it('claims nothing about a length it does not know', () => {
    expect(extentReadsWholeDivision(null, 200)).toBe(false);
    expect(extentReadsWholeDivision(undefined, null)).toBe(false);
  });
});

describe('the name says which part', () => {
  it('locates a division, titled or numbered, and marks an opening', () => {
    expect(extentSourceName({ workTitle: 'Essays' })).toBe('Essays');
    expect(extentSourceName({ workTitle: 'Essays', noun: 'Essay', ordinal: 42 }))
      .toBe('Essays · Essay 42');
    expect(extentSourceName({ workTitle: 'Essays', noun: 'Essay', ordinal: 42, opening: true }))
      .toBe('Essays · Essay 42, opening');
    expect(extentSourceName({
      workTitle: 'The Book of Tea', ordinal: 1, divisionTitle: 'The Cup of Humanity'
    })).toBe('The Book of Tea · The Cup of Humanity');
  });
});
