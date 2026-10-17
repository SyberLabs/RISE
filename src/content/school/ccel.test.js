/**
 * The CCEL reader takes a CCEL plain-text file apart along the lines a
 * recipe declares. The fixture copies the shape of `cache/<name>.txt`:
 * CCEL's card above the work, its rules between sections, hard-wrapped
 * paragraphs indented three spaces, and its indexes after the work.
 */
import { describe, expect, it } from 'vitest';
import { readCcel } from './ccel.js';

const parse = markup => new DOMParser().parseFromString(markup, 'text/html');

const CLOUD = `     __________________________________________________________________

           Title: The Cloud of Unknowing
          Rights: Public Domain
     __________________________________________________________________

  Here Beginneth the Prologue


   IN the name of the Father and of the Son and of the Holy Ghost! I
   charge thee and I beseech thee.
     __________________________________________________________________

  Here Beginneth a Table of the Chapters


   THE FIRST CHAPTER

   Of four degrees of Christian men's living

  AND HERE ENDETH THE TABLE OF THE CHAPTERS


   GHOSTLY FRIEND IN GOD, I pray thee.
     __________________________________________________________________

  HERE BEGINNETH THE FIRST CHAPTER


   Of four degrees of Christian men's living.


   GHOSTLY friend in God, thou shalt well understand that I find, in my
   boisterous beholding, four degrees. [3]

   [3] A note on the degrees.
     __________________________________________________________________


   HERE BEGINNETH THE SECOND CHAPTER


   LOOK up now, weak wretch, and see what thou art.


   HERE ENDETH THE CLOUD OF UNKNOWING.
     __________________________________________________________________

                                    Indexes
     __________________________________________________________________

Index of Pages of the Print Edition

   [1]5  [2]6
`;

describe('readCcel', () => {
  it('reads the span the recipe names, cuts what it leaves out, drops the rules and the notes, and opens units at matching headings', () => {
    const read = readCcel(CLOUD, parse, {
      extract: { from: 'Here Beginneth the Prologue', to: 'Indexes' },
      cut: [{ from: 'Here Beginneth a Table of the Chapters', to: 'AND HERE ENDETH THE TABLE OF THE CHAPTERS' }],
      levels: { 2: '^(?:Here Beginneth the Prologue|HERE BEGINNETH THE .* CHAPTER)$' },
      units: 'headings',
      level: 2,
      retitle: { pattern: '^Here Beginneth the ', to: '' }
    });
    expect(read.parts.map(part => part.name)).toEqual([
      'Prologue', 'First Chapter', 'Second Chapter'
    ]);
    expect(read.parts[0].content).toBe('IN the name of the Father and of the Son and of the Holy Ghost! I charge thee and I beseech thee.\n\nGHOSTLY FRIEND IN GOD, I pray thee.');
    expect(read.parts[1].content).toBe("Of four degrees of Christian men's living.\n\nGHOSTLY friend in God, thou shalt well understand that I find, in my boisterous beholding, four degrees.");
    expect(read.parts[2].content).toBe('LOOK up now, weak wretch, and see what thou art.\n\nHERE ENDETH THE CLOUD OF UNKNOWING.');
    expect(read.dropped).toEqual({ rules: 4, recipe: 25, 'footnote markers': 1, footnotes: 6 });
    expect(read.sourceWords).toBe(read.importedWords);
  });

  it('refuses a span whose start it cannot find', () => {
    expect(() => readCcel(CLOUD, parse, { extract: { from: 'PREFACE' }, units: 'whole', name: 'x' })).toThrow(/PREFACE/u);
  });
});
