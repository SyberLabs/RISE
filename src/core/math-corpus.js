/**
 * Texts with maths as models write them, and where the maths in each is
 * (math-text.js). Both channels are tested against these: what is shown
 * (math-text.test.js, math-typeset.test.js) and what is said.
 *
 * `parts`: the expected split, each `[kind, value]` or `['math', value, 'display']`.
 */

const M = (value, display) => (display ? ['math', value, 'display'] : ['math', value]);
const T = value => ['text', value];

export const MATH_CORPUS = Object.freeze([
  { name: 'inline dollars', text: 'The ground state has energy $E_0 = \\frac{1}{2}\\hbar\\omega$.', parts: [T('The ground state has energy '), M('E_0 = \\frac{1}{2}\\hbar\\omega'), T('.')] },
  { name: 'display dollars', text: 'The levels are $$E_n = \\hbar\\omega\\left(n + \\tfrac{1}{2}\\right)$$ and they are evenly spaced.', parts: [T('The levels are '), M('E_n = \\hbar\\omega\\left(n + \\tfrac{1}{2}\\right)', true), T(' and they are evenly spaced.')] },
  { name: 'inline parentheses', text: 'In another notation \\(E_n\\) climbs evenly.', parts: [T('In another notation '), M('E_n'), T(' climbs evenly.')] },
  { name: 'display brackets', text: 'Newton wrote \\[F = ma\\] once.', parts: [T('Newton wrote '), M('F = ma', true), T(' once.')] },
  { name: 'tex in backticks', text: 'The energy of the lowest state is `E = \\frac{1}{2}\\hbar\\omega`.', parts: [T('The energy of the lowest state is '), M('E = \\frac{1}{2}\\hbar\\omega'), T('.')] },
  { name: 'dollars in backticks', text: 'So `$a^2 + b^2 = c^2$` holds.', parts: [T('So '), M('a^2 + b^2 = c^2'), T(' holds.')] },
  { name: 'code in backticks is not maths', text: 'Run `npm test` first.', parts: [T('Run `npm test` first.')] },
  { name: 'a bare command', text: 'It grows with \\omega, the frequency of the spring.', parts: [T('It grows with '), M('\\omega'), T(', the frequency of the spring.')] },
  { name: 'a bare structure', text: 'Half of it, \\frac{1}{2}\\hbar\\omega_0, is left.', parts: [T('Half of it, '), M('\\frac{1}{2}\\hbar\\omega_0'), T(', is left.')] },
  { name: 'currency', text: 'It costs $5 and $10 to ship.', parts: [T('It costs $5 and $10 to ship.')] },
  { name: 'currency beside maths', text: 'It costs $5, but $x$ is free.', parts: [T('It costs $5, but '), M('x'), T(' is free.')] },
  { name: 'a price range', text: 'Tickets run $20-$30 a night.', parts: [T('Tickets run $20-$30 a night.')] },
  { name: 'a lone dollar', text: 'A lone $ sign.', parts: [T('A lone $ sign.')] },
  { name: 'a windows path', text: 'Open C:\\Users\\name\\notes.txt now.', parts: [T('Open C:\\Users\\name\\notes.txt now.')] },
  { name: 'an escaped newline', text: 'Write \\n for a new line.', parts: [T('Write \\n for a new line.')] },
  { name: 'nested fractions', text: 'Simplify $\\frac{\\frac{1}{x}}{1+\\frac{1}{y}}$ first.', parts: [T('Simplify '), M('\\frac{\\frac{1}{x}}{1+\\frac{1}{y}}'), T(' first.')] },
  { name: 'a matrix', text: 'Take $$\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$$', parts: [T('Take '), M('\\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}', true)] },
  { name: 'aligned equations', text: '$$\\begin{aligned} x &= 1 \\\\ y &= 2 \\end{aligned}$$', parts: [M('\\begin{aligned} x &= 1 \\\\ y &= 2 \\end{aligned}', true)] },
  { name: 'two formulas', text: 'Both $a$ and $b$ are real.', parts: [T('Both '), M('a'), T(' and '), M('b'), T(' are real.')] },
  { name: 'a formula with commas and spaces', text: 'Here $f(x, y) = x^2 + y^2$, a bowl.', parts: [T('Here '), M('f(x, y) = x^2 + y^2'), T(', a bowl.')] },
  { name: 'an absolute value', text: 'Its size is $\\vert x \\vert$.', parts: [T('Its size is '), M('\\vert x \\vert'), T('.')] },
  { name: 'malformed tex', text: 'This $\\frac{1}$ is broken.', parts: [T('This '), M('\\frac{1}'), T(' is broken.')] },
  { name: 'unicode maths is words', text: 'So ω = 2πf, always.', parts: [T('So ω = 2πf, always.')] },
  { name: 'an unclosed display', text: 'Then $$x = 1 and nothing more.', parts: [T('Then $$x = 1 and nothing more.')] }
]);
