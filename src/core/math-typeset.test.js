import { afterEach, describe, expect, it, vi } from 'vitest';
import { hasMath, loadMath, mathReady, renderMath, resetMathForTests, splitMath } from './math-typeset.js';

// The stylesheet is the browser's concern; here only the code loads.
vi.mock('katex/dist/katex.min.css', () => ({}));

afterEach(() => resetMathForTests());

describe('finding the maths in a text', () => {
  it('knows a text with a formula from one without', () => {
    expect(hasMath('Its length is $\\sqrt{x^2+y^2}$.')).toBe(true);
    expect(hasMath('It costs $5 and $6.')).toBe(true);
    expect(hasMath('No maths here.')).toBe(false);
    expect(hasMath('A lone $ sign.')).toBe(false);
    expect(hasMath(undefined)).toBe(false);
  });

  it('splits words and formulas in order, inline and display', () => {
    expect(splitMath('Length $\\sqrt{2}$, then $$E = mc^2$$ ends.')).toEqual([
      { kind: 'text', value: 'Length ' },
      { kind: 'math', value: '\\sqrt{2}', display: false },
      { kind: 'text', value: ', then ' },
      { kind: 'math', value: 'E = mc^2', display: true },
      { kind: 'text', value: ' ends.' }
    ]);
    expect(splitMath('plain')).toEqual([{ kind: 'text', value: 'plain' }]);
    expect(splitMath('')).toEqual([]);
  });
});

describe('typesetting', () => {
  it('shows the escaped source until KaTeX has loaded, and KaTeX’s HTML after', async () => {
    expect(mathReady()).toBe(false);
    expect(renderMath('x<y')).toBe('<span class="atom-math is-source">x&lt;y</span>');
    await loadMath();
    expect(mathReady()).toBe(true);
    const html = renderMath('\\sqrt{x^2+y^2}');
    expect(html).toContain('class="katex"');
    expect(html).not.toContain('<script');
    expect(renderMath('E = mc^2', { display: true })).toContain('katex-display');
  });

  it('never throws on a wrong formula: the source shows, for the author to repair', async () => {
    await loadMath();
    expect(() => renderMath('\\frac{1}')).not.toThrow();
    expect(renderMath('\\frac{1}')).toContain('katex');
  });
});
