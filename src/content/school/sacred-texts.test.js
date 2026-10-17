/**
 * The sacred-texts reader takes the site's chapter pages apart along the
 * lines a recipe declares, once the site's own chrome is gone.
 *
 * The fixtures copy the markup of a sacred-texts.com page: the navigation
 * set in CENTER above and below the text, the green line naming the book
 * "at sacred-texts.com", page numbers as named anchors, footnote anchors and
 * the Footnotes list, and "[paragraph continues]" where a page turn split a
 * paragraph.
 */
import { describe, expect, it } from 'vitest';
import { readSacredTexts } from './sacred-texts.js';

const parse = markup => new DOMParser().parseFromString(markup, 'text/html');

const page = (body, previous = 'th201.htm', next = 'th203.htm') => `<HTML><HEAD><TITLE>Corpus Hermeticum</TITLE></HEAD>
 <BODY>
 <CENTER>
 <A HREF="../../index.htm">Sacred Texts</A>&nbsp;
 <A HREF="index.htm">Index</A>&nbsp;
 <A HREF="${previous}">Previous</A>&nbsp;
 <A HREF="${next}">Next</A>&nbsp;
 <HR><A HREF="https://www.amazon.com/">Buy this Book at Amazon.com</A></CENTER>
 <HR>
 <P ALIGN="CENTER"><FONT SIZE="-1" COLOR="GREEN"><A HREF="index.htm"><IMG SRC="img/tease.jpg"></A><BR><I>Thrice-Greatest Hermes, Vol. 2</I>, by G.R.S. Mead, [1906], at sacred-texts.com</FONT></P><HR></p>
${body}
 <p><HR>
 <CENTER>
 <A HREF="${next}">Next: The General Sermon</A></CENTER>
<HR>
<nav role="navigation"><CENTER><p><A HREF="../../index.htm">Sacred Texts</A> | <A HREF="../index.htm">Gnosticism</A></p></CENTER></nav>
</body></html>`;

const words = text => String(text).split(/\s+/u).filter(Boolean).length;

const POEMANDRES = page(`<p><a name="page_1"><font size="1" color="green">p. 1</font></A></p>
 <p><h3 align="center">P&#338;MANDRES, THE SHEPHERD OF MEN</h3></p>
 <p>2. And I do say: Who art thou?</p>
 <p>He saith: I am Man-Shepherd,&nbsp;<A NAME="fr_2"></A><A HREF="#fn_2"><FONT SIZE="1">3</FONT></A> Mind of all-</p>
 <p>
 </p>
 <p><a name="page_4"><font size="1" color="green">p. 4</font></A></p>
 <p>masterhood; I know what thou desirest and I&#146;m with thee everywhere.</p>
 <p><a name="page_5"><font size="1" color="green">p. 5</font></A></p>
 <p><span class="contnote"><FONT SIZE=-2 COLOR=GREEN>[paragraph continues]</FONT></span> And he answered back to me: Hold in thy mind all thou wouldst know.</p>
 <HR>
 <H3 ALIGN="CENTER">Footnotes</H3>
 <P><A NAME="fn_2"></A><A HREF="th202.htm#fr_2">3:1</A> Poemandres; that is, the Shepherd of Men.</P>`);

describe('readSacredTexts', () => {
  it('drops the navigation, the site line, page numbers, footnotes and their markers, and joins a paragraph a page turn split', () => {
    const read = readSacredTexts([POEMANDRES], parse, { units: 'whole', name: 'I. Poemandres, the Shepherd of Men' });
    expect(read.parts[0].content.split('\n\n')).toEqual([
      'PŒMANDRES, THE SHEPHERD OF MEN',
      '2. And I do say: Who art thou?',
      'He saith: I am Man-Shepherd, Mind of all-masterhood; I know what thou desirest and I’m with thee everywhere. And he answered back to me: Hold in thy mind all thou wouldst know.'
    ]);
    expect(read.dropped).toMatchObject({ 'page numbers': 6, 'footnote markers': 1, footnotes: 9, 'continuation notes': 2 });
    expect(read.dropped.navigation).toBeGreaterThan(0);
    expect(read.dropped['site notes']).toBe(words('Thrice-Greatest Hermes, Vol. 2, by G.R.S. Mead, [1906], at sacred-texts.com'));
    expect(read.sourceWords).toBe(read.importedWords);
  });

  it('reads several chapter pages as one document, a unit spanning pages up to the next named heading', () => {
    const first = page(`<h1 align="center">KHÂNDOGYA-UPANISHAD.</h1><h2 align="center">FIRST PRAPÂTHAKA.</h2>
<h3 align="center">FIRST KHANDA</h3><p>1. LET a man meditate on the syllable Om.</p>`);
    const second = page('<h3 align="center">SECOND KHANDA</h3><p>1. When the Devas and Asuras struggled together.</p>');
    const third = page('<h1 align="center">TALAVAKÂRA-UPANISHAD.</h1><h3 align="center">FIRST KHANDA</h3><p>1. The pupil asks: At whose wish does the mind sent forth proceed?</p>');
    const read = readSacredTexts([first, second, third], parse, {
      units: [
        { heading: 'KHÂNDOGYA-UPANISHAD.', name: 'The Khândogya-Upanishad' },
        { heading: 'TALAVAKÂRA-UPANISHAD.', name: 'The Talavakâra-Upanishad' }
      ]
    });
    expect(read.parts.map(part => part.name)).toEqual(['The Khândogya-Upanishad', 'The Talavakâra-Upanishad']);
    expect(read.parts[0].content).toBe('FIRST PRAPÂTHAKA.\n\nFIRST KHANDA\n\n1. LET a man meditate on the syllable Om.\n\n'
      + 'SECOND KHANDA\n\n1. When the Devas and Asuras struggled together.');
    expect(read.sourceWords).toBe(read.importedWords);
  });
});
