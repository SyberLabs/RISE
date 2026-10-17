/**
 * The TEI reader takes an EEBO-TCP transcription apart along the lines a
 * recipe declares. The fixture copies A26565's markup: books and chapters
 * as typed divs with their heads, page breaks and forme work, line-end
 * hyphens as <g ref="char:EOLhyphen"/>, illegible letters as gaps, verse as
 * <l> inside <q>, and the CC0 availability statement in the header.
 */
import { describe, expect, it } from 'vitest';
import { readTei, teiAvailability } from './tei.js';

const parse = markup => new DOMParser().parseFromString(markup, 'text/html');
const parseXml = markup => new DOMParser().parseFromString(markup, 'application/xml');

const AGRIPPA = `<?xml version="1.0" encoding="UTF-8"?>
<TEI xmlns="http://www.tei-c.org/ns/1.0"><teiHeader><fileDesc><publicationStmt>
<availability><p>This Phase I text is available for reuse, according to the terms of <ref target="https://creativecommons.org/publicdomain/zero/1.0/">Creative
 Commons 0 1.0 Universal</ref>. The text can be copied.</p></availability></publicationStmt></fileDesc></teiHeader>
<text><front><div type="title_page"><p>THREE BOOKS OF Occult Philosophy</p></div></front>
<body>
<div n="1" type="book">
<pb n="1" facs="tcp:52070:15"/>
<head>Three Books of Occult Philosophy, Written by <hi>Agrippa,</hi> Knight.</head>
<head type="sub">BOOK I.</head>
<div n="1" type="chapter">
<head>CHAP. I. <hi>How Magicians Collect vertues from the three-fold World.</hi></head>
<p>Seeing there is a three f<gap reason="illegible" extent="1 letter">
   <desc>•</desc>
</gap>ld World, Ele<g ref="char:EOLhyphen"/>mentary, Celestiall, and intellectuall, the very original Worker doth con<g ref="char:EOLhyphen"/>
<pb n="2" facs="tcp:52070:16"/>
<fw type="catch">vey</fw>
vey from himself the vertues of his Omnipotency.
<q>
<l>The Number and the Nature of those things,</l>
<l>Cal d Elements, what Fire, Earth, Aire forth brings:</l>
</q>
All these things doth naturall Philosophy contain.</p>
<note place="margin">A marginal note.</note>
</div>
</div>
<div n="2" type="book">
<head>BOOK II.</head>
<div n="1" type="chapter">
<head>CHAP. I. <hi>Of the necessity of Mathematicall learning.</hi></head>
<p>The Doctrines of Mathematicks are so necessary to, and have such an affinity with Magick.</p>
</div>
</div>
</body><back><div type="index"><p>An index.</p></div></back></text></TEI>`;

describe('readTei', () => {
  it('reads the body only, chapters as units under their book, hyphens joined, page furniture and notes dropped, verse kept', () => {
    const read = readTei(AGRIPPA, parseXml, parse, { units: 'headings', level: 3, group: 2, groupPrefix: true });
    expect(read.parts.map(part => part.name)).toEqual([
      'Book I · CHAP. I. How Magicians Collect vertues from the three-fold World',
      'Book II · CHAP. I. Of the necessity of Mathematicall learning'
    ]);
    expect(read.parts[0].content.split('\n\n')).toEqual([
      'Three Books of Occult Philosophy, Written by Agrippa, Knight.',
      'BOOK I.',
      'Seeing there is a three f•ld World, Elementary, Celestiall, and intellectuall, the very original Worker doth convey from himself the vertues of his Omnipotency.',
      'The Number and the Nature of those things,\nCal d Elements, what Fire, Earth, Aire forth brings:',
      'All these things doth naturall Philosophy contain.'
    ]);
    expect(read.dropped).toEqual({ 'forme work': 1, notes: 3 });
    expect(read.sourceWords).toBe(read.importedWords);
  });

  it('reads the CC0 statement from the header', () => {
    expect(teiAvailability(AGRIPPA, parseXml)).toBe('This Phase I text is available for reuse, according to the terms of Creative Commons 0 1.0 Universal. The text can be copied.');
  });
});
