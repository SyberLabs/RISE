/**
 * The plain HTML reader reads pages by the selectors a recipe names. The
 * fixture copies a Victorian Web chapter page: a header with the title and
 * breadcrumbs, a navigation column of credits and contents, the text in
 * div#main with page numbers set inline in brackets, and notes.
 */
import { describe, expect, it } from 'vitest';
import { readHtml } from './html.js';

const parse = markup => new DOMParser().parseFromString(markup, 'text/html');

const chapter = (title, text) => `<html><body><div id="whole-page">
<div id="header"><h2>${title}</h2><h4>Charles Babbage</h4><p class="bc">[<a href="../../index.html">Victorian Web Home</a> &mdash;&gt; <a href="b2.htm">Next</a>]</p></div>
<div id="nav"><h3>Credits</h3><p>John van Wyhe digitized and converted to html.</p></div>
<div id="main"><h2>${title}</h2>${text}</div>
<div id="footer"><p>Last modified 2008</p></div>
</div></body></html>`;

describe('readHtml', () => {
  it('reads only the named element of each page, dropping what the recipe names and striking inline page numbers', () => {
    const one = chapter('Chapter I. Nature of the Argument', '<p class="one">THE notions we acquire of contrivance and design arise from comparing our observations; we are liable to impress upon the [24]  notion of Deity thus shadowed out [24/25] our own imperfections.</p><p class="credit">Victorian Web Overview</p>');
    const two = chapter('Chapter II. Argument in favour of Design', '<p>It is a condition of our race that we must ever wade through error.</p>');
    const read = readHtml([one, two], parse, {
      body: '#main', drops: { 'site notes': 'p.credit' }, strike: { pattern: '\\[\\d+(?:/\\d+)?\\]', kind: 'page numbers' },
      units: 'headings', level: 2
    });
    expect(read.parts.map(part => [part.name, part.content])).toEqual([
      ['Chapter I. Nature of the Argument', 'THE notions we acquire of contrivance and design arise from comparing our observations; we are liable to impress upon the notion of Deity thus shadowed out our own imperfections.'],
      ['Chapter II. Argument in favour of Design', 'It is a condition of our race that we must ever wade through error.']
    ]);
    expect(read.dropped).toEqual({ 'site notes': 3, 'page numbers': 2 });
    expect(read.sourceWords).toBe(read.importedWords);
  });

  it('refuses a page with nothing where the recipe says the text is', () => {
    expect(() => readHtml(['<html><body><p>No main.</p></body></html>'], parse, { body: '#main', units: 'whole', name: 'x' })).toThrow(/#main/u);
  });
});
