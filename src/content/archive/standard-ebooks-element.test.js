/**
 * One element read whole: the School corpus takes a prologue, a dedication,
 * or one dialogue out of a bundle, which the part selector does not name.
 */

import { describe, expect, it } from 'vitest';
import { readStandardEbooksElement } from './standard-ebooks.js';

const parse = markup => new DOMParser().parseFromString(markup, 'text/html');

const PROLOGUE = `<html><body epub:type="bodymatter">
  <section id="prologue" epub:type="prologue">
    <h3 epub:type="title">Zarathustra’s Prologue</h3>
    <section id="prologue-1">
      <h4 epub:type="z3998:ordinal z3998:roman">I</h4>
      <p>When Zarathustra was thirty years old<a href="#n1" epub:type="noteref">1</a>, he left his home.</p>
    </section>
  </section>
  <article id="other"><h2 epub:type="title">Other</h2><p>Not this.</p></article>
</body></html>`;

describe('readStandardEbooksElement', () => {
  it('reads the file’s outermost section whole, its own heading as the title, without apparatus', () => {
    const part = readStandardEbooksElement(PROLOGUE, parse);
    expect(part.title).toBe('Zarathustra’s Prologue');
    expect(part.content).toBe('I\n\nWhen Zarathustra was thirty years old, he left his home.');
    expect(part.sourceWords).toBe(13);
  });

  it('reads the element an id names', () => {
    const part = readStandardEbooksElement(PROLOGUE, parse, 'other');
    expect(part.title).toBe('Other');
    expect(part.content).toBe('Not this.');
  });

  it('refuses an id the file does not carry', () => {
    expect(() => readStandardEbooksElement(PROLOGUE, parse, 'missing')).toThrow(/missing/u);
  });
});
