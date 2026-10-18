/**
 * The Wikisource reader takes the parsed HTML the MediaWiki API returns for
 * one or more pages and reads it as the Gutenberg reader reads an edition,
 * once Wikisource's own furniture is gone.
 *
 * The fixtures copy the markup the API's `action=parse` returns: the header
 * template (`.wst-header`, `#ws-data`, marked `ws-noexport`), the licence
 * banner, sister-project boxes, edit links, page numbers from the
 * transcluded scan, reference markers and the references list, and one
 * `.prp-pages-output` per scan page.
 */
import { describe, expect, it } from 'vitest';
import { readWikisource } from './wikisource.js';

const parse = markup => new DOMParser().parseFromString(markup, 'text/html');

const page = body => `<div class="mw-content-ltr mw-parser-output" lang="en" dir="ltr">
<div class="ws-noexport"><style>.wst-header{}</style></div>
<div class="ws-header wst-header-structure wst-header ws-noexport noprint"><span class="wst-header-title">Nature (1836)</span>
<div class="wst-header-notes"><ul class="plainSister"><li class="sisitem"><a href="/wiki/Special:SiteMatrix">sister projects</a>: Wikipedia article</li></ul></div>
<div class="ws-noexport" id="ws-data"><span id="ws-author">Ralph Waldo Emerson</span><span id="ws-year">1836</span></div></div>
${body}
<div class="licenseContainer licenseBanner"><p>This work is in the <b>public domain</b> in the <b>United States</b> because it was published before January 1, 1931.</p></div>
</div>`;

const words = text => String(text).split(/\s+/u).filter(Boolean).length;

describe('readWikisource', () => {
  it('drops the header, licence, sister boxes, edit links, page numbers and references, and counts them', () => {
    const chapter = page(`<div class="prp-pages-output" lang="en">
<h2><span class="mw-headline">CHAPTER I.</span><span class="mw-editsection">[<a href="/w/index.php?action=edit">edit</a>]</span></h2>
<p><span class="pagenum ws-pagenum" id="9" data-page-number="9" title="Page:Nature (1836).djvu/13"></span>To go into solitude, a man needs to retire as much from his chamber as from society.<sup id="cite_ref-1" class="reference"><a href="#cite_note-1">[1]</a></sup> I am not solitary whilst I read and write, though nobody is with me.</p>
<div class="mw-references-wrap"><ol class="references"><li id="cite_note-1">An editor's note on solitude.</li></ol></div>
</div>`);
    const read = readWikisource([chapter], parse, { units: 'whole', name: 'Chapter I: Nature' });
    expect(read.parts.map(part => [part.name, part.content])).toEqual([[
      'Chapter I: Nature',
      'CHAPTER I.\n\nTo go into solitude, a man needs to retire as much from his chamber as from society. '
        + 'I am not solitary whilst I read and write, though nobody is with me.'
    ]]);
    expect(read.dropped).toMatchObject({ 'footnote markers': 1, footnotes: 5, 'edit links': 1 });
    expect(read.dropped['header and licence']).toBeGreaterThan(0);
    expect(read.parts[0].content).not.toMatch(/public domain|sister projects|Emerson/u);
    expect(read.sourceWords).toBe(read.importedWords);
  });

  it('joins a paragraph a scan page broke mid-sentence, and keeps a page that opens a new one', () => {
    const blake = page(`<div class="prp-pages-output" lang="en"><p>I saw a mighty Devil folded in black clouds, hovering on the sides of the rock, with  </p></div>
<div class="prp-pages-output" lang="en"><p><span></span>corroding fires he wrote the following sentence now perceived by the minds of men.</p>
<p>Know that after Christs death, he became Jehovah.</p></div>
<div class="prp-pages-output" lang="en"><p>But in Milton; the Father is Destiny.</p></div>`);
    const read = readWikisource([blake], parse, { units: 'whole', name: 'Plates 5 and 6' });
    expect(read.parts[0].content.split('\n\n')).toEqual([
      'I saw a mighty Devil folded in black clouds, hovering on the sides of the rock, with corroding fires he wrote the following sentence now perceived by the minds of men.',
      'Know that after Christs death, he became Jehovah.',
      'But in Milton; the Father is Destiny.'
    ]);
    expect(read.sourceWords).toBe(read.importedWords);
  });

  it('reads several pages as one document, with units by the headings the recipe names, verse kept from <br>', () => {
    const plates = page(`<div class="prp-pages-output"><div class="wst-center tiInherit"><p>The Argument.</p></div>
<p>Rintrah roars &amp; shakes his fires in the burdend air;<br>
Hungry clouds swag on the deep</p></div>`);
    const fancy = page(`<div class="prp-pages-output"><div class="wst-center tiInherit"><p><span>A Memorable Fancy.</span></p></div>
<p>As I was walking among the fires of hell, delighted with the enjoyments of Genius.</p></div>`);
    const read = readWikisource([plates, fancy], parse, {
      headings: 'div.wst-center',
      units: [{ heading: 'The Argument.', name: 'The Argument' }, { heading: 'A Memorable Fancy.', name: 'A Memorable Fancy' }]
    });
    expect(read.parts.map(part => [part.name, part.verse, part.lines])).toEqual([['The Argument', true, 2], ['A Memorable Fancy', false, 0]]);
    expect(read.parts[0].content).toBe('Rintrah roars & shakes his fires in the burdend air;\nHungry clouds swag on the deep');
    expect(read.sourceWords).toBe(read.importedWords);
    expect(words(read.parts[1].content)).toBe(15);
  });
});
