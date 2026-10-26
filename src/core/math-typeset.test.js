// @vitest-environment node
// SRE's ClearSpeak rules are XPath conditions, and jsdom's XPath misreads them ("a raised to the 2 power");
// in Node SRE parses with xmldom, as a browser's own XPath reads them. e2e/live-math.spec.js hears Chromium.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MATH_CORPUS } from './math-corpus.js';
import { hasMath, loadMath, mathReady, renderMath, resetMathForTests, speakable, splitMath, typeset } from './math-typeset.js';

// The stylesheet is the browser's concern; here only the code loads.
vi.mock('katex/dist/katex.min.css', () => ({}));

afterEach(() => resetMathForTests());

describe('finding the maths in a text', () => {
  it('is math-text.js, passed through', () => {
    expect(hasMath('Its length is $\\sqrt{x^2+y^2}$.')).toBe(true);
    expect(hasMath('It costs $5 and $6.')).toBe(false);
    expect(splitMath('Length $\\sqrt{2}$.')).toEqual([
      { kind: 'text', value: 'Length ' }, { kind: 'math', value: '\\sqrt{2}', display: false }, { kind: 'text', value: '.' }
    ]);
  });
});

describe('before the typesetter has loaded', () => {
  it('shows a plain reading in the reading face, never the source, and says it plainly', () => {
    expect(mathReady()).toBe(false);
    expect(renderMath('x<\\omega')).toBe('<span class="atom-math is-fallback">x &lt; ω</span>');
    expect(typeset('\\omega').speech).toBe('omega');
  });
});

describe('once it has loaded', () => {
  it('typesets once, for the eye with MathML beside it for a screen reader, and for the ear', { timeout: 30_000 }, async () => {
    await loadMath();
    expect(mathReady()).toBe(true);
    const { html, speech } = typeset('E = \\frac{1}{2}\\hbar\\omega');
    expect(html).toContain('class="katex"');
    expect(html).toContain('<math');
    expect(html).not.toContain('<script');
    expect(speech).toBe('E equals one half h bar omega');
    expect(renderMath('E = mc^2', { display: true })).toContain('katex-display');
  });

  it('says the formulas a reader meets as a person would', { timeout: 30_000 }, async () => {
    await loadMath();
    const said = tex => typeset(tex).speech;
    expect(said('a^2 + b^2 = c^2')).toBe('a squared plus b squared equals c squared');
    expect(said('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}'))
      .toBe('x equals the fraction with numerator negative b plus or minus the square root of b squared minus 4 a c and denominator 2 a');
    expect(said('\\Delta x \\, \\Delta p \\geq \\frac{\\hbar}{2}')).toBe('Delta x Delta p is greater than or equal to h bar over 2');
    expect(said('\\sum_{n=1}^{\\infty} \\frac{1}{n^2}')).toBe('the sum from n equals 1 to infinity of the fraction with numerator 1 and denominator n squared');
    expect(said('\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1')).toBe('the limit as x approaches 0 of sine x over x equals 1');
  });

  it('says a bracket, a del, a partial and a unit as they are read aloud', { timeout: 30_000 }, async () => {
    await loadMath();
    const said = tex => typeset(tex).speech;
    expect(said('E_n = \\hbar\\omega\\left(n + \\tfrac{1}{2}\\right)')).toBe('E sub n equals h bar omega times the quantity n plus one half');
    expect(said('2(a+b)')).toBe('2 times the quantity a plus b');
    expect(said('(a+b)^2')).toBe('the quantity a plus b, squared');
    expect(said('f(x, y)')).toBe('f of x comma y');
    expect(said('\\nabla \\cdot \\mathbf{E} = \\frac{\\rho}{\\varepsilon_0}')).toMatch(/^del dot bold E equals /u);
    expect(said('\\nabla \\times \\mathbf{B}')).toBe('del cross bold B');
    expect(said('\\frac{\\partial f}{\\partial x}')).toBe('the fraction with numerator partial f and denominator partial x');
    expect(said('v = 3 \\times 10^8 \\text{ m/s}')).toBe('v equals 3 times 10 to the eighth power meters per second');
    expect(said('a \\cdot b')).toBe('a times b');
    expect(said('|x - 1| < \\epsilon')).toBe('the absolute value of x minus 1 is less than epsilon');
    expect(said('\\left| x \\right|')).toBe('the absolute value of x');
    expect(said('f(x) = (x - 1)(x + 2)')).toBe('f of x equals the quantity x minus 1, times the quantity x plus 2');
  });

  it('shows a formula KaTeX cannot read as a plain reading, and says that', { timeout: 30_000 }, async () => {
    await loadMath();
    const { html, speech } = typeset('\\frac{1}');
    expect(html).toBe('<span class="atom-math is-fallback">1</span>');
    expect(speech).toBe('1');
  });

  it('never lets markup reach the voice', { timeout: 30_000 }, async () => {
    await loadMath();
    for (const { text } of MATH_CORPUS) {
      for (const part of splitMath(text)) {
        if (part.kind === 'math') expect(typeset(part.value, { display: part.display }).speech, part.value).not.toMatch(/[\\{}$^_&]/u);
      }
      if (hasMath(text)) expect(speakable(text).text, text).not.toMatch(/\$\$|\\[A-Za-z([]/u);
    }
  });

  it('gives a passage as it is said', { timeout: 30_000 }, async () => {
    await loadMath();
    expect(speakable('The ground state has energy $E_0 = \\frac{1}{2}\\hbar\\omega$.').text)
      .toBe('The ground state has energy E sub 0 equals one half h bar omega.');
  });
});

describe('one formula, one reading', () => {
  it('says a formula the same way all session, even once the typesetter has loaded after it was first said', { timeout: 30_000 }, async () => {
    const before = typeset('\\omega').speech;
    await loadMath();
    expect(typeset('\\omega').speech).toBe(before);
  });
});
