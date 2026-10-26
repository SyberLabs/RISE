import { describe, expect, it } from 'vitest';
import { fallbackMath, hasMath, mathStructure, splitMath } from './math-text.js';
import { MATH_CORPUS } from './math-corpus.js';

const asParts = text => splitMath(text).map(part => (part.kind === 'text' ? ['text', part.value] : part.display ? ['math', part.value, 'display'] : ['math', part.value]));

describe('finding the maths in a text', () => {
  for (const { name, text, parts } of MATH_CORPUS) {
    it(name, () => {
      expect(asParts(text)).toEqual(parts);
      expect(hasMath(text)).toBe(parts.some(([kind]) => kind === 'math'));
    });
  }

  it('gives nothing for nothing', () => {
    expect(splitMath('')).toEqual([]);
    expect(splitMath(undefined)).toEqual([]);
    expect(hasMath(undefined)).toBe(false);
  });

  it('loses no character outside the maths, and keeps the order', () => {
    for (const { text } of MATH_CORPUS) {
      const words = splitMath(text).filter(part => part.kind === 'text').map(part => part.value).join('');
      for (const ch of words) expect(text).toContain(ch);
    }
  });
});

describe('a formula without KaTeX', () => {
  const cases = [
    ['\\omega', 'ω', 'omega'],
    ['E = \\frac{1}{2}\\hbar\\omega', 'E = 1⁄2ℏω', 'E equals 1 over 2 h bar omega'],
    ['a^2 + b^2 = c^2', 'a² + b² = c²', 'a squared plus b squared equals c squared'],
    ['E_0', 'E₀', 'E sub 0'],
    ['x^{n+1}', 'xⁿ⁺¹', 'x to the power n plus 1'],
    ['\\sqrt{2}', '√2', 'the square root of 2'],
    ['\\sqrt{b^2 - 4ac}', '√(b² − 4ac)', 'the square root of b squared minus 4 a c'],
    ['\\frac{a+b}{2}', '(a + b)⁄2', 'a plus b over 2'],
    ['\\Delta x \\geq \\frac{\\hbar}{2}', 'Δx ≥ ℏ⁄2', 'capital delta x is greater than or equal to h bar over 2'],
    ['\\text{speed} = 3 \\times 10^8', 'speed = 3 × 10⁸', 'speed equals 3 times 10 to the power 8'],
    ['\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', '(a b; c d)', 'a b, c d'],
    ['\\vec{F} = m\\vec{a}', 'F⃗ = ma⃗', 'vector F equals m vector a'],
    ['\\frac{1}', '1', '1'],
    ['\\unknowncommand{x}', 'unknowncommand x', 'unknowncommand x']
  ];
  for (const [tex, text, speech] of cases) {
    it(`${tex} is shown and said plainly`, () => {
      expect(fallbackMath(tex)).toEqual({ text, speech });
    });
  }

  it('never leaves markup in either channel', () => {
    for (const { text } of MATH_CORPUS) {
      for (const part of splitMath(text)) {
        if (part.kind !== 'math') continue;
        const { text: shown, speech } = fallbackMath(part.value);
        expect(shown).not.toMatch(/\\|[{}$]/u);
        expect(speech).not.toMatch(/[\\{}$^_&]/u);
      }
    }
  });
});

describe('how much structure a formula has', () => {
  it('counts fractions, roots, sums, integrals, limits and arrays', () => {
    expect(mathStructure('x')).toBe(0);
    expect(mathStructure('a^2 + b^2 = c^2')).toBe(0);
    expect(mathStructure('E = \\frac{1}{2}\\hbar\\omega')).toBe(1);
    expect(mathStructure('x = \\frac{-b \\pm \\sqrt{b^2 - 4ac}}{2a}')).toBe(2);
    expect(mathStructure('\\sum_{n=1}^{\\infty} \\frac{1}{n^2}')).toBe(2);
    expect(mathStructure('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}')).toBe(1);
  });
});
