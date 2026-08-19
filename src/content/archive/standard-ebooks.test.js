/**
 * The importer reads structure; it never decides it.
 *
 * The fixtures are the real markup Standard Ebooks emits, because the whole
 * value of this path is that the edition declares what our old ingests had to
 * guess — and a fixture we invented would only prove we can parse our own
 * invention.
 */
import { describe, expect, it } from 'vitest';
import {
  readStandardEbooksFile, reconcileWords, sectionsFromParts
} from './standard-ebooks.js';

const parse = markup => new DOMParser().parseFromString(markup, 'text/html');

const SPOON = `<html xmlns:epub="http://www.idpf.org/2007/ops"><body>
  <article id="hod-putt" epub:type="z3998:poem">
    <h2 epub:type="title">Hod Putt</h2>
    <p><span>Here I lie close to the grave</span><br/>
       <span>Of Old Bill Piersol,</span></p>
    <p><span>That was my way of going into bankruptcy.</span></p>
  </article>
  <article id="ollie-mcgee" epub:type="z3998:poem">
    <h2 epub:type="title">Ollie McGee</h2>
    <p><span>Have you seen walking through the village</span></p>
  </article>
</body></html>`;

describe('a Standard Ebooks edition declares its own shape', () => {
  it('reads poems, stanzas and verse lines rather than inferring them', () => {
    const parts = readStandardEbooksFile(SPOON, parse);
    expect(parts).toHaveLength(2);
    expect(parts[0]).toMatchObject({
      id: 'hod-putt', title: 'Hod Putt', kind: 'poem', stanzas: 2, lines: 3
    });
    // The poet's line breaks survive, and a stanza break is a blank line.
    expect(parts[0].content).toBe(
      'Here I lie close to the grave\nOf Old Bill Piersol,'
      + '\n\nThat was my way of going into bankruptcy.');
  });

  it('keeps the slug, which is worth more than an ordinal', () => {
    // `spoon-river#hod-putt` says what a reader is handed; `#87` does not.
    expect(readStandardEbooksFile(SPOON, parse).map(p => p.id))
      .toEqual(['hod-putt', 'ollie-mcgee']);
  });

  it('treats a paragraph with no spans as prose', () => {
    const prose = `<html xmlns:epub="http://www.idpf.org/2007/ops"><body>
      <section id="baker-farm" epub:type="chapter">
        <h2 epub:type="title">Baker Farm</h2>
        <p>Sometimes I rambled to pine groves.</p>
        <p>Once it chanced that I stood.</p>
      </section></body></html>`;
    const [part] = readStandardEbooksFile(prose, parse);
    expect(part).toMatchObject({ kind: 'division', stanzas: 2, lines: 0 });
    expect(part.content).toBe('Sometimes I rambled to pine groves.\n\nOnce it chanced that I stood.');
  });

  it('takes the innermost part, so a container is not read as a reading', () => {
    const nested = `<html xmlns:epub="http://www.idpf.org/2007/ops"><body>
      <section epub:type="chapter" id="outer">
        <article id="inner" epub:type="z3998:poem"><p><span>a line</span></p></article>
      </section></body></html>`;
    expect(readStandardEbooksFile(nested, parse).map(p => p.id)).toEqual(['inner']);
  });

  it('returns nothing rather than guessing at markup it does not know', () => {
    expect(readStandardEbooksFile('<html><body><div>loose text</div></body></html>', parse))
      .toEqual([]);
  });
});

describe('words in must equal words out', () => {
  it('reconciles the source against what was imported', () => {
    const parts = readStandardEbooksFile(SPOON, parse);
    const { sourceWords, importedWords, lost } = reconcileWords(SPOON, parts, parse);
    expect(sourceWords).toBeGreaterThan(0);
    expect(importedWords).toBe(sourceWords);
    expect(lost).toBe(0);
  });

  it('reports a loss rather than tolerating one', () => {
    // The check that would have caught Walden's missing line the day it was
    // made: 303 words went and nothing said so.
    const parts = readStandardEbooksFile(SPOON, parse);
    const short = parts.map(p => ({ ...p, content: p.content.split('\n')[0] }));
    expect(reconcileWords(SPOON, short, parse).lost).toBeGreaterThan(0);
  });
});

describe('the shelf learns no second vocabulary', () => {
  it('emits sections in the shape every other work uses', () => {
    // `verse` is the one addition, and it is present only where the edition
    // marked the reading as verse — a prose section carries no such key, so
    // an unstructured work's sections are the same two fields they were.
    expect(sectionsFromParts(readStandardEbooksFile(SPOON, parse))).toEqual([
      { name: 'Hod Putt', verse: true, content: expect.stringContaining('Here I lie') },
      { name: 'Ollie McGee', verse: true, content: expect.stringContaining('Have you seen') }
    ]);
  });

  it('reads a verse drama down to its lines, through the table it is set in', () => {
    // Storr sets Oedipus Rex as a table — a persona cell, then a verse cell
    // whose lines are one level further down. Read at the cell, the whole
    // speech is one line of prose and every word is still there, so word
    // reconciliation cannot see the loss.
    const DRAMA = `<html xmlns:epub="http://www.idpf.org/2007/ops"><body>
      <section id="scene" epub:type="z3998:drama z3998:scene">
        <table><tbody>
          <tr>
            <td epub:type="z3998:persona">Oedipus</td>
            <td epub:type="z3998:verse"><p>
              <span>My children, latest born to Cadmus old,</span><br/>
              <span>Why sit ye here as suppliants, in your hands</span>
            </p></td>
          </tr>
        </tbody></table>
      </section>
    </body></html>`;
    const [part] = readStandardEbooksFile(DRAMA, parse);
    expect(part.lines).toBe(2);
    expect(part.verse).toBe(true);
    expect(part.content).toBe('Oedipus'
      + '\nMy children, latest born to Cadmus old,'
      + '\nWhy sit ye here as suppliants, in your hands');
  });
});
