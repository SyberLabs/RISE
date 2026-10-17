/**
 * The Gutenberg reader takes a Project Gutenberg HTML edition apart along
 * the lines a recipe declares, never along lines it guesses.
 *
 * The fixtures copy the markup Project Gutenberg's HTML editions carry: the
 * header and footer sections that hold the START and END markers, page
 * numbers as spans, footnote anchors, footnote blocks, `<pre>` and
 * line-broken paragraphs for verse.
 */
import { describe, expect, it } from 'vitest';
import { readGutenberg, titleCase } from './gutenberg.js';

const parse = markup => new DOMParser().parseFromString(markup, 'text/html');

const edition = body => `<!DOCTYPE html><html><body>
<header class="pg-boilerplate pgheader" id="pg-header"><h2 id="pg-header-heading">The Project Gutenberg eBook of A Book</h2>
<div>This eBook is for the use of anyone anywhere in the United States</div>
<p><strong>Credits</strong>: Produced by A Volunteer and the Online Distributed Proofreading Team</p>
<div id="pg-start-separator"><span>*** START OF THE PROJECT GUTENBERG EBOOK A BOOK ***</span></div></header>
${body}
<footer class="pg-boilerplate pgheader" id="pg-footer"><div id="pg-end-separator"><span>*** END OF THE PROJECT GUTENBERG EBOOK A BOOK ***</span></div>
<h2 id="pg-footer-heading">THE FULL PROJECT GUTENBERG LICENSE</h2></footer>
</body></html>`;

const words = text => String(text).split(/\s+/u).filter(Boolean).length;

const ESSAYS = edition(`
<h1>ESSAYS</h1>
<h2>CONTENTS</h2>
<p class="toc"><a href="#c1">CHAPTER I</a></p>
<h2><span class="pagenum"><a id="Page_1">[Pg 1]</a></span>CHAPTER I<br>OF TRUTH</h2>
<p>What is truth? said jesting Pilate,<a class="fnanchor" href="#Footnote_1">[1]</a> and would not stay for an answer.</p>
<h3>A SECOND THOUGHT</h3>
<p>Certainly there be that delight in giddiness[2] and count it a bondage to fix a belief.</p>
<h2>CHAPTER II<br>OF DEATH</h2>
<p>Men fear death, as children fear to go in the dark;<span class="pagenum">[Pg 2]</span> and as that natural fear in children is increased with tales.</p>
<div class="footnote"><p><a id="Footnote_1" href="#FNanchor_1" class="label">[1]</a> John xviii. 38.</p></div>
<p class="noindent">[2] A second note, set as a paragraph.</p>
<h2>INDEX</h2>
<p>Truth, 1; Death, 2.</p>`);

describe('the Gutenberg reader', () => {
  it('refuses an edition without its START and END markers', () => {
    expect(() => readGutenberg('<html><body><h2>A</h2><p>Text</p></body></html>', parse,
      { units: [{ heading: 'A' }] })).toThrow(/START/u);
  });

  it('reads exactly the units the recipe names, inside the span it cuts, and reconciles every word', () => {
    const read = readGutenberg(ESSAYS, parse, {
      extract: { from: 'CHAPTER I OF TRUTH', to: 'INDEX' },
      units: [{ heading: 'CHAPTER I OF TRUTH' }, { heading: 'CHAPTER II OF DEATH', name: 'Of Death' }]
    });
    expect(read.parts.map(part => part.name)).toEqual(['Chapter I: Of Truth', 'Of Death']);
    expect(read.parts[0].content).toBe('What is truth? said jesting Pilate, and would not stay for an answer.\n\n'
      + 'A SECOND THOUGHT\n\nCertainly there be that delight in giddiness and count it a bondage to fix a belief.');
    expect(read.parts[1].content).toBe('Men fear death, as children fear to go in the dark; and as that natural fear in children is increased with tales.');
    expect(read.parts.every(part => !part.verse)).toBe(true);
    expect(read.sourceWords).toBe(read.importedWords);
    const served = read.parts.reduce((total, part) => total + words(part.sourceTitle) + words(part.content), 0);
    expect(read.importedWords).toBe(served);
    expect(read.dropped).toMatchObject({ 'footnote markers': 2, 'page numbers': 4 });
    expect(read.dropped.footnotes).toBeGreaterThanOrEqual(10);
  });

  it('serves no distributor matter, no footnote and no index from outside the span', () => {
    const read = readGutenberg(ESSAYS, parse, {
      extract: { from: 'CHAPTER I OF TRUTH', to: 'INDEX' },
      units: 'headings', level: 2
    });
    const all = read.parts.map(part => `${part.name}\n${part.content}`).join('\n');
    expect(all).not.toMatch(/Gutenberg|Produced by|John xviii|second note|\[\d\]|Pg \d|Truth, 1/u);
    expect(read.parts.map(part => part.name)).toEqual(['Chapter I: Of Truth', 'Chapter II: Of Death']);
  });

  it('ends a span at a paragraph the recipe names, and drops what the recipe names as not the work', () => {
    const tail = edition(`<h2>Fifth Dialogue.</h2><p>Tans. So be it.</p>
<p class="style1">PRINTED BY BALLANTYNE, HANSON AND CO.</p>
<p class="center"><strong>THE APOLOGY OF THE NOLAN</strong></p><p>O lovely, graceful nymphs of England!</p>
<p>Transcribers Notes:</p><p>Page 162: Original source said 34</p>`);
    const read = readGutenberg(tail, parse, {
      headings: 'p.center > strong', drop: 'p.style1',
      extract: { from: 'Fifth Dialogue.', to: 'Transcribers Notes:' },
      units: [{ heading: 'Fifth Dialogue.' }, { heading: 'THE APOLOGY OF THE NOLAN' }]
    });
    expect(read.parts.map(part => [part.name, part.content])).toEqual([
      ['Fifth Dialogue', 'Tans. So be it.'],
      ['The Apology of the Nolan', 'O lovely, graceful nymphs of England!']
    ]);
    expect(read.dropped.recipe).toBe(6);
    expect(read.sourceWords).toBe(read.importedWords);
  });

  it('reads a table a row to a line', () => {
    const table = edition('<h2>NOTE D.</h2><table><tr><th>Number of Operation.</th><th>Nature.</th></tr><tr><td>1</td><td>×</td></tr><tr><td>2</td><td>×</td></tr></table>');
    const read = readGutenberg(table, parse, { units: [{ heading: 'NOTE D.', name: 'Note D' }] });
    expect(read.parts[0].content).toBe(['Number of Operation. Nature.', '1 ×', '2 ×'].join(String.fromCharCode(10)));
    expect(read.parts[0].verse).toBe(false);
  });

  it('counts a word the markup splits across elements once, on both sides', () => {
    const essay = edition('<h3>Darwin Among the Machines</h3><p>“<i>Darwin Among the Machines</i>” appeared in the <span class="smcap">Press</span>, 13 <i>June</i>, 1863.</p><div><p>Sir,</p>There is no security.</div>');
    const read = readGutenberg(essay, parse, { units: [{ heading: 'Darwin Among the Machines' }] });
    expect(read.parts[0].content).toBe('“Darwin Among the Machines” appeared in the Press, 13 June, 1863.\n\nSir,\n\nThere is no security.');
    expect(read.sourceWords).toBe(read.importedWords);
    expect(read.sourceWords).toBe(20);
  });

  it('removes an [FN#n] marker wherever it stands, and keeps a bracketed year set after a space', () => {
    const gita = edition('<h3>CHAPTER VIII</h3><p class="poem">and seen! . . . . [FN#14]<br>Richer than holy fruit on Vedas growing,[FN#15]<br>the year of the world [3553].</p>');
    const read = readGutenberg(gita, parse, { units: [{ heading: 'CHAPTER VIII' }] });
    expect(read.parts[0].content).toBe('and seen! . . . .|Richer than holy fruit on Vedas growing,|the year of the world [3553].'.replaceAll('|', String.fromCharCode(10)));
    expect(read.dropped['footnote markers']).toBe(2);
  });

  it('refuses a unit heading the edition does not print, or prints twice in the span', () => {
    expect(() => readGutenberg(ESSAYS, parse, { units: [{ heading: 'CHAPTER III' }] })).toThrow(/CHAPTER III/u);
    const twice = edition('<h2>I.</h2><p>One.</p><h2>I.</h2><p>Two.</p>');
    expect(() => readGutenberg(twice, parse, { units: [{ heading: 'I.' }] })).toThrow(/2 headings/u);
  });

  it('refuses text in the span that no unit holds', () => {
    expect(() => readGutenberg(ESSAYS, parse, {
      extract: { from: 'CHAPTER I OF TRUTH', to: 'INDEX' },
      units: [{ heading: 'CHAPTER II OF DEATH' }]
    })).toThrow(/before the first unit/u);
  });

  it('keeps every line of verse, from <pre>, from a poem block and from line-broken paragraphs', () => {
    const verse = edition(`
<h2>HYMNS.</h2>
<h3>I.</h3>
<pre>
   Before all the wondrous shows
   Of the widespread space around him,

   What living, sentient thing
   Loves not the all-joyous light?
</pre>
<h3>II.</h3>
<div class="poem"><div class="stanza"><span class="i0">Must the morning always come?<br></span><span class="i0">Will the despot earth ne'er end?<br></span></div>
<div class="stanza"><span class="i0">Unholy business swallows up<br></span><span class="i0">The angel-visit of the Night.</span></div></div>
<p class="poem">Sanjaya.<br>  Him, filled with such compassion and such grief,<br>  The Driver thus addressed:<br></p>
<h2>SONGS.</h2>`);
    const read = readGutenberg(verse, parse, {
      extract: { from: 'HYMNS.', to: 'SONGS.' },
      units: [{ heading: 'I.', name: 'Hymn I' }, { heading: 'II.', name: 'Hymn II' }]
    });
    expect(read.parts[0]).toMatchObject({ name: 'Hymn I', verse: true, lines: 4 });
    expect(read.parts[0].content).toBe('Before all the wondrous shows\nOf the widespread space around him,\n\n'
      + 'What living, sentient thing\nLoves not the all-joyous light?');
    expect(read.parts[1]).toMatchObject({ verse: true, lines: 7 });
    expect(read.parts[1].content).toBe('Must the morning always come?\nWill the despot earth ne\'er end?\n\n'
      + 'Unholy business swallows up\nThe angel-visit of the Night.\n\n'
      + 'Sanjaya.\nHim, filled with such compassion and such grief,\nThe Driver thus addressed:');
    expect(read.sourceWords).toBe(read.importedWords);
  });

  it('reads units by heading level between two headings, inclusive, and opens each group with its banner', () => {
    const parts = edition(`
<h2>CONTENTS.</h2><p>Part I. Chapter I. Chapter II.</p>
<h2>PART I. THE STATE AS A WORK OF ART.</h2>
<h3>CHAPTER I. INTRODUCTION.</h3><p>In the wonderful language of Dante the state is a work of art.</p>
<h3>CHAPTER II. THE TYRANNY.</h3><p>The tyrants of the fourteenth century were many and cruel.</p>
<h2>PART II. THE INDIVIDUAL.</h2><p>A word before the chapters.</p>
<h3>CHAPTER I. THE STATE AND THE INDIVIDUAL.</h3><p>In the character of these states the individual is free.</p>
<h3>INDEX.</h3><p>Dante, 1.</p>`);
    const read = readGutenberg(parts, parse, {
      units: 'headings', level: 3, group: 2, groupPrefix: true,
      from: 'CHAPTER I. INTRODUCTION.', to: 'CHAPTER I. THE STATE AND THE INDIVIDUAL.',
      extract: { from: 'PART I. THE STATE AS A WORK OF ART.', to: 'INDEX.' }
    });
    expect(read.parts.map(part => part.name)).toEqual([
      'Part I · Chapter I. Introduction', 'Part I · Chapter II. The Tyranny', 'Part II · Chapter I. The State and the Individual'
    ]);
    expect(read.parts[0].content).toBe('PART I. THE STATE AS A WORK OF ART.\n\nIn the wonderful language of Dante the state is a work of art.');
    expect(read.parts[2].content).toBe('PART II. THE INDIVIDUAL.\n\nA word before the chapters.\n\nIn the character of these states the individual is free.');
    expect(read.groups).toEqual(['PART I. THE STATE AS A WORK OF ART.', 'PART II. THE INDIVIDUAL.']);
    expect(read.sourceWords).toBe(read.importedWords);
  });

  it('opens a group at a banner the recipe names by its text, at the level of the units', () => {
    const einstein = edition(`<h3>PREFACE</h3><p>In the present book I have tried to give an exact insight.</p>
<h3>PART I: THE SPECIAL THEORY OF RELATIVITY</h3>
<h3>I. PHYSICAL MEANING OF GEOMETRICAL PROPOSITIONS</h3><p>In your schooldays most of you who read this book made acquaintance with geometry.</p>`);
    const read = readGutenberg(einstein, parse, { units: 'headings', level: 3, groups: ['PART I: THE SPECIAL THEORY OF RELATIVITY'] });
    expect(read.parts.map(part => part.name)).toEqual(['Preface', 'I. Physical Meaning of Geometrical Propositions']);
    expect(read.parts[1].content).toBe('PART I: THE SPECIAL THEORY OF RELATIVITY\n\nIn your schooldays most of you who read this book made acquaintance with geometry.');
    expect(read.groups).toEqual(['PART I: THE SPECIAL THEORY OF RELATIVITY']);
  });

  it('takes a subtitle the recipe names into the unit name, and treats extra elements as headings when told to', () => {
    const giles = edition(`
<h2>CHAPTER I.</h2><p class="ph3"><span class="smcap">Transcendental Bliss.</span></p><p>In the northern ocean there is a fish, called the Leviathan.</p>
<h2>CHAPTER II.</h2><p class="ph3">The Identity of Contraries.</p><p>Tzu Chi of Nan-kuo sat leaning on a table.</p>`);
    const read = readGutenberg(giles, parse, { units: 'headings', level: 2, subtitle: 'p.ph3' });
    expect(read.parts.map(part => part.name)).toEqual(['Chapter I: Transcendental Bliss', 'Chapter II: The Identity of Contraries']);
    expect(read.parts[0].content).toBe('In the northern ocean there is a fish, called the Leviathan.');

    const burnet = edition(`
<h2>CHAPTER III <br> HERAKLEITOS OF EPHESOS</h2>
<div class="sidenote">Life of Herakleitos.</div><p>63. Herakleitos of Ephesos, son of Blyson.</p>
<div class="sidenote">The fragments.</div><p>65. I give a version of the fragments.</p><p>(1) It is wise to hearken.</p>
<h2>CHAPTER IV</h2>`);
    const fragments = readGutenberg(burnet, parse, {
      headings: 'div.sidenote', units: 'headings', level: 'div.sidenote',
      extract: { from: 'CHAPTER III HERAKLEITOS OF EPHESOS', to: 'CHAPTER IV' }
    });
    expect(fragments.parts.map(part => [part.name, part.content])).toEqual([
      ['Life of Herakleitos', '63. Herakleitos of Ephesos, son of Blyson.'],
      ['The fragments', '65. I give a version of the fragments.\n\n(1) It is wise to hearken.']
    ]);
    expect(fragments.title).toBe('CHAPTER III HERAKLEITOS OF EPHESOS');
  });

  it('reads an equation the edition set as an image by the text it gives for it', () => {
    const memoir = edition('<h2>NOTE G.</h2><p>The numbers <img alt="{B}_{1}" data-tex="\mathrm{B}_1" src="images/1.svg"> are found <img src="images/figure.png" alt="Figure 1"> thus.</p>');
    const read = readGutenberg(memoir, parse, { units: [{ heading: 'NOTE G.', name: 'Note G' }] });
    expect(read.parts[0].content).toBe('The numbers {B}_{1} are found thus.');
    expect(read.sourceWords).toBe(read.importedWords);
  });

  it('opens a unit at an element the recipe names, takes the nth of a doubled heading, and sets verse for every unit', () => {
    const bruno = edition(`<h2>BOOK ONE.</h2><h3>ARGUMENT.</h3><p>What the first book holds, in brief.</p><h2>BOOK ONE.</h2>
<p><a id="First"></a><b>First Dialogue.</b></p><p>Tansillo. The enthusiasts rise.</p><p>Cicada. And fall again.</p>
<p><a id="Second"></a><b>Second Dialogue.</b></p><p>Tansillo. The second day begins.</p>`);
    const read = readGutenberg(bruno, parse, {
      headings: 'a#First, a#Second', verse: true,
      units: [{ heading: 'BOOK ONE.', nth: 1, name: 'Book One' }, { heading: 'First Dialogue.' }, { heading: 'Second Dialogue.' }]
    });
    expect(read.parts.map(part => [part.name, part.verse])).toEqual([['Book One', true], ['First Dialogue', true], ['Second Dialogue', true]]);
    expect(read.parts[0].content).toBe('ARGUMENT.\n\nWhat the first book holds, in brief.\n\nBOOK ONE.');
    expect(read.parts[1].content).toBe('Tansillo. The enthusiasts rise.\n\nCicada. And fall again.');
    expect(() => readGutenberg(bruno, parse, { units: [{ heading: 'BOOK ONE.' }] })).toThrow(/2 headings/u);
  });

  it('marks a unit verse by the recipe, and prose by the recipe, over the markup', () => {
    const scene = edition('<h2>I</h2><p>NIGHT</p><p>I’ve studied now Philosophy</p><p>And Jurisprudence, Medicine</p>');
    const read = readGutenberg(scene, parse, { units: [{ heading: 'I', name: 'Scene I: Night', verse: true }] });
    expect(read.parts[0]).toMatchObject({ verse: true, lines: 3 });
  });
});

describe('titleCase', () => {
  it('sets a shouted heading in title case and keeps its numerals', () => {
    expect(titleCase('PART II. ON THE NATURE AND ORIGIN OF THE MIND')).toBe('Part II. On the Nature and Origin of the Mind');
    expect(titleCase('CHAPTER XIV ON LEAF-ARRANGEMENT, OR PHYLLOTAXIS')).toBe('Chapter XIV on Leaf-Arrangement, or Phyllotaxis');
    expect(titleCase('The Song Celestial')).toBe('The Song Celestial');
    expect(titleCase('I')).toBe('I');
  });
});
