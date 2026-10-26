import { describe, expect, it } from 'vitest';
import { hasMath, joinMath, mathStructure, splitMath, spokenWith } from './math-text.js';
import { MATH_DWELL, fallbackMath, mathDwellMs } from './math-reading.js';
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

describe('writing the parts back', () => {
  it('gives a text that splits into the same parts', () => {
    for (const { text } of MATH_CORPUS) expect(splitMath(joinMath(splitMath(text)))).toEqual(splitMath(text));
  });

  it('writes dollars where they read back, and the other delimiters where they would not', () => {
    expect(joinMath(splitMath('So `E = m \\cdot c^2` holds.'))).toBe('So $E = m \\cdot c^2$ holds.');
    expect(joinMath(splitMath('Newton wrote \\[F = ma\\] once.'))).toBe('Newton wrote $$F = ma$$ once.');
    expect(joinMath([{ kind: 'math', value: '\\omega', display: false }, { kind: 'text', value: '2 times' }])).toBe('\\(\\omega\\)2 times');
    expect(joinMath([{ kind: 'text', value: 'paid $' }, { kind: 'math', value: 'x', display: false }])).toBe('paid $\\(x\\)');
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

describe('a text as it is said', () => {
  const speak = tex => `<${tex}>`;

  it('says each formula in its place, and pauses after one with structure or on a line of its own', () => {
    expect(spokenWith('So $x$ holds.', speak).text).toBe('So <x> holds.');
    expect(spokenWith('With $\\frac{a}{b}$ and more.', speak).text).toBe('With <\\frac{a}{b}>, and more.');
    expect(spokenWith('With $\\frac{a}{b}$, and more.', speak).text).toBe('With <\\frac{a}{b}>, and more.');
    expect(spokenWith('The levels are $$E$$ and they are even.', speak).text).toBe('The levels are <E>, and they are even.');
    expect(spokenWith('The levels are $$E$$ Then more.', speak).text).toBe('The levels are <E>. Then more.');
    expect(spokenWith('Take $$E$$', speak).text).toBe('Take <E>.');
    expect(spokenWith('No maths.', speak).text).toBe('No maths.');
  });

  it('says where each written place is in what is said', () => {
    const written = 'Solve $\\frac{a}{b}$ and you are done.';
    const { text, at } = spokenWith(written, speak);
    expect(text).toBe('Solve <\\frac{a}{b}>, and you are done.');
    expect(at(0)).toBe(0);
    expect(at(written.indexOf('$'))).toBe(text.indexOf('<'));
    expect(text.slice(at(written.indexOf('and')))).toBe('and you are done.');
    expect(at(written.length)).toBe(text.length);
    expect(at(written.indexOf('$') + 3)).toBe(text.indexOf('<'));
  });
});

describe('how long a shown formula stays', () => {
  it('is its saying time and 300 ms a structure, the structure’s share at most 2.5 s, and nothing for words', () => {
    expect(mathDwellMs('No maths.')).toBe(0);
    expect(mathDwellMs('So $\\omega$.')).toBe('omega'.length * MATH_DWELL.msPerSpokenChar);
    const nested = '\\frac{\\frac{\\frac{\\frac{\\frac{\\frac{\\frac{\\frac{\\frac{1}{2}}{3}}{4}}{5}}{6}}{7}}{8}}{9}}{10}';
    expect(mathDwellMs(`$${nested}$`)).toBe(fallbackMath(nested).speech.length * MATH_DWELL.msPerSpokenChar + MATH_DWELL.maxStructureMs);
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
