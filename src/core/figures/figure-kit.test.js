import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { admitSvg } from '../svg-admission.js';
import { JEV_PALETTES } from '../jev-palette.js';
import { ROOM, svgLayoutProblems } from '../quality/svg-layout.js';
import { FIGURE_BOUNDS, FIGURE_KINDS, KIT_BUDGETS, figureProblems, renderFigure } from './figure-kit.js';
import { STUDY, boundSpecs } from './fixtures/specs.js';

// A Windows checkout may give the goldens CRLF; the kit writes LF.
const golden = name => readFileSync(resolve(process.cwd(), 'src/core/figures/fixtures', name), 'utf8').replace(/\r\n/g, '\n').trimEnd();

describe('renderFigure', () => {
  for (const kind of FIGURE_KINDS) {
    for (const theme of ['cobalt', 'ember']) {
      it(`draws the study's ${kind} in ${theme} exactly as the golden`, () => {
        expect(renderFigure(STUDY[kind], { theme })).toBe(golden(`${kind}-${theme}.svg`));
      });
    }
  }

  it('keeps the study’s geometry', () => {
    const bars = renderFigure(STUDY.bars, { theme: 'cobalt' });
    expect(bars).toContain('<rect x="195" y="403.76" width="150" height="26.24" rx="3"');
    expect(bars).toContain('<rect x="455" y="199.76" width="150" height="230.24" rx="3" fill="#58B8FF"/>');
    const flow = renderFigure(STUDY.flow, { theme: 'cobalt' });
    expect(flow).toContain('<rect x="210" y="124" width="380" height="42" rx="21"');
    expect(flow).toContain('<rect x="210" y="454" width="380" height="42" rx="21"');
    const columns = renderFigure(STUDY.columns, { theme: 'cobalt' });
    for (const x of [145, 400, 655]) expect(columns).toContain(`<text x="${x}" y="236"`);
    const stack = renderFigure(STUDY.stack, { theme: 'cobalt' });
    expect(stack).toContain('<rect x="90" y="122" width="250" height="352" rx="26"');
    expect(stack).toContain('<circle cx="128"');
  });

  it('inks what changed in the theme’s accent, and nothing else', () => {
    for (const [theme, { accent }] of Object.entries(JEV_PALETTES)) {
      const svg = renderFigure(STUDY.bars, { theme });
      expect(svg).toContain(`fill="${accent}"`);
    }
  });

  it('marks a list’s changed item with the accent’s dot and label, and every other item with a hairline', () => {
    const { accent, text: ink } = JEV_PALETTES.cobalt;
    const svg = renderFigure(STUDY.list, { theme: 'cobalt' });
    expect(svg.match(new RegExp(`<circle [^>]*fill="${accent}"`, 'g'))).toHaveLength(1);
    expect(svg).toMatch(new RegExp(`fill="${accent}"[^>]*font-weight="600">${STUDY.list.changed}<`));
    expect(svg.match(new RegExp(`<line [^>]*stroke="${ink}" stroke-opacity="0.35"`, 'g'))).toHaveLength(STUDY.list.items.length - 1);
  });

  it('heads a compare Before and After unless given, and inks every after cell in the accent', () => {
    const { accent } = JEV_PALETTES.cobalt;
    const svg = renderFigure(STUDY.compare, { theme: 'cobalt' });
    expect(svg).toContain('>Before</text>');
    expect(svg).toContain('>After</text>');
    for (const row of STUDY.compare.rows) expect(svg).toMatch(new RegExp(`fill="${accent}"[^>]*>${row.after}<`));
    const headed = renderFigure({ ...STUDY.compare, headers: { before: 'Was', after: 'Now' } }, { theme: 'cobalt' });
    expect(headed).toContain('>Was</text>');
    expect(headed).not.toContain('>Before</text>');
  });

  it('starts a list’s rows a fixed distance under the title, however few they are', () => {
    const first = svg => Number(/<text x="96" y="([\d.]+)"/.exec(svg)[1]);
    const two = renderFigure({ kind: 'list', title: 'Two', items: [{ label: 'a' }, { label: 'b' }], changed: 'b' }, { theme: 'cobalt' });
    const six = renderFigure({ kind: 'list', title: 'Six', items: Array.from({ length: 6 }, (_, i) => ({ label: `i${i}` })) }, { theme: 'cobalt' });
    expect(first(two)).toBe(158);
    expect(first(six)).toBe(158);
  });

  it('escapes what it is given', () => {
    const svg = renderFigure({ kind: 'flow', steps: ['a <b> & "c"', 'd'], changed: 'd' }, { theme: 'cobalt' });
    expect(svg).toContain('a &lt;b&gt; &amp; &quot;c&quot;');
    expect(admitSvg(svg).ok).toBe(true);
  });

  it('refuses to draw a spec the kit refuses', () => {
    expect(() => renderFigure({ kind: 'bars', max: 1, items: [] }, { theme: 'cobalt' })).toThrow(/2 to 4 items/);
  });
});

describe('every figure the kit draws is admitted and layout-clean by construction', () => {
  const specs = [...Object.values(STUDY), ...boundSpecs()];
  for (const theme of Object.keys(JEV_PALETTES)) {
    it(`in ${theme}, on the room’s ground and the theme’s own`, () => {
      for (const spec of specs) {
        const svg = renderFigure(spec, { theme });
        expect(admitSvg(svg)).toEqual({ ok: true });
        for (const ground of [ROOM.ground, JEV_PALETTES[theme].background]) {
          const { problems, notes } = svgLayoutProblems(svg, { ground });
          expect({ kind: spec.kind, problems, notes }).toEqual({ kind: spec.kind, problems: [], notes: [] });
        }
      }
    });
  }

  it('holds every label at 25 units or more, titles at 40, values at 34 and column names at 30', () => {
    const sizes = kind => [...renderFigure(STUDY[kind], { theme: 'cobalt' }).matchAll(/font-size="(\d+)"/g)].map(match => Number(match[1]));
    expect(Math.min(...FIGURE_KINDS.flatMap(sizes))).toBe(25);
    expect(sizes('bars')).toContain(40);
    expect(sizes('bars')).toContain(34);
    expect(sizes('columns')).toContain(30);
  });
});

describe('figureProblems', () => {
  const cases = [
    ['an unknown kind', { kind: 'pie' }, /kind is one of bars, flow, columns, stack, list, compare/],
    ['a key the kind does not take', { ...STUDY.flow, colour: 'red' }, /flow takes/],
    ['one bar', { kind: 'bars', max: 1, items: [{ label: 'a', value: 1 }] }, /2 to 4 items/],
    ['five bars', { kind: 'bars', max: 1, items: Array.from({ length: 5 }, () => ({ label: 'a', value: 1 })) }, /2 to 4 items/],
    ['a value over max', { kind: 'bars', max: 10, items: [{ label: 'a', value: 11 }, { label: 'b', value: 1 }] }, /0 to max \(10\)/],
    ['a value that is not a number', { kind: 'bars', max: 10, items: [{ label: 'a', value: '5' }, { label: 'b', value: 1 }] }, /a number/],
    ['two changed bars', { kind: 'bars', max: 10, items: [{ label: 'a', value: 1, changed: true }, { label: 'b', value: 2, changed: true }] }, /one item/],
    ['no max', { kind: 'bars', items: [{ label: 'a', value: 1 }, { label: 'b', value: 2 }] }, /max/],
    ['eight steps', { kind: 'flow', steps: Array.from({ length: 8 }, (_, i) => `s${i}`) }, /2 to 7 steps/],
    ['a step twice', { kind: 'flow', steps: ['a', 'a'] }, /twice/],
    ['a changed step that is not a step', { kind: 'flow', steps: ['a', 'b'], changed: 'c' }, /changed "c" is not one of the steps/],
    ['a loop to itself', { kind: 'flow', steps: ['a', 'b'], loop: { from: 'a', to: 'a', label: 'x' } }, /two different steps/],
    ['five columns', { kind: 'columns', columns: Array.from({ length: 5 }, (_, i) => ({ name: `c${i}`, items: ['x'] })) }, /2 to 4 columns/],
    ['seven items', { kind: 'columns', columns: [{ name: 'a', items: Array.from({ length: 7 }, () => 'x') }, { name: 'b', items: ['y'] }] }, /1 to 6 items/],
    ['an unknown glyph', { kind: 'columns', columns: [{ name: 'a', glyph: 'star', items: ['x'] }, { name: 'b', items: ['y'] }] }, /eye, shell, full or dot/],
    ['six zones', { kind: 'stack', zones: Array.from({ length: 6 }, (_, i) => ({ label: `z${i}`, shape: 'bar' })) }, /2 to 5 zones/],
    ['an unknown shape', { kind: 'stack', zones: [{ label: 'a', shape: 'star' }, { label: 'b', shape: 'bar' }] }, /circle, lines, bar or ticks/],
    ['a dock beside ticks', { kind: 'stack', zones: [{ label: 'a', shape: 'ticks' }, { label: 'b', shape: 'bar' }], dock: 'a' }, /dock .* beside a zone that is not ticks/],
    ['an empty label', { kind: 'flow', steps: ['', 'b'] }, /1 or more characters/],
    ['columns of one word each', { kind: 'columns', columns: [{ name: 'Bars', items: ['measure'] }, { name: 'Flow', items: ['sequence'] }, { name: 'Columns', items: ['sorting'] }] }, /too sparse for columns; say it in words or use a flow/],
    ['columns with only one full column', { kind: 'columns', columns: [{ name: 'a', items: ['x', 'y'] }, { name: 'b', items: ['z'] }] }, /too sparse for columns/],
    ['a flow of two steps that marks nothing', { kind: 'flow', steps: ['Before', 'After'] }, /a flow of two steps with no changed step and no loop explains nothing a sentence does not/],
    ['a list of one item', { kind: 'list', items: [{ label: 'a' }], changed: 'a' }, /2 to 6 items/],
    ['a list of seven items', { kind: 'list', items: Array.from({ length: 7 }, (_, i) => ({ label: `i${i}` })) }, /2 to 6 items/],
    ['a list item that is not { label, detail? }', { kind: 'list', items: [{ label: 'a', note: 'x' }, { label: 'b' }], changed: 'b' }, /items\[0\] takes label, detail/],
    ['a list item named twice', { kind: 'list', items: [{ label: 'a' }, { label: 'a' }, { label: 'b' }] }, /items\[1\]\.label "a" is given twice/],
    ['a changed item that is not an item', { kind: 'list', items: [{ label: 'a' }, { label: 'b' }], changed: 'c' }, /changed "c" is not one of the items/],
    ['a list of two items that marks nothing and details nothing', { kind: 'list', items: [{ label: 'a' }, { label: 'b' }] }, /a list of two items with no changed item and no detail explains nothing a sentence does not/],
    ['a compare of one row', { kind: 'compare', rows: [{ subject: 'a', before: 'b', after: 'c' }] }, /2 to 4 rows/],
    ['a compare of five rows', { kind: 'compare', rows: Array.from({ length: 5 }, (_, i) => ({ subject: `s${i}`, before: 'b', after: 'c' })) }, /2 to 4 rows/],
    ['a row without its after', { kind: 'compare', rows: [{ subject: 'a', before: 'b' }, { subject: 'd', before: 'e', after: 'f' }] }, /rows\[0\] takes subject, before, after and needs after/],
    ['a row the same before and after', { kind: 'compare', rows: [{ subject: 'a', before: 'b', after: 'b' }, { subject: 'd', before: 'e', after: 'f' }] }, /rows\[0\] says "b" before and after; a compare shows what changed/],
    ['headers that are not { before, after }', { kind: 'compare', headers: { before: 'Was' }, rows: [{ subject: 'a', before: 'b', after: 'c' }, { subject: 'd', before: 'e', after: 'f' }] }, /headers takes before, after and needs after/]
  ];
  for (const [name, spec, pattern] of cases) {
    it(`refuses ${name}`, () => {
      const problems = figureProblems(spec);
      expect(problems.length).toBeGreaterThan(0);
      expect(problems.join('\n')).toMatch(pattern);
    });
  }

  it('names a label that does not fit, the size it is set at, and its slot’s budget in characters', () => {
    const spec = { kind: 'columns', columns: [
      { name: 'a', items: ['x', 'x2'] }, { name: 'b', items: ['y', 'y2'] }, { name: 'c', items: ['z'] },
      { name: 'An extremely long column name', items: ['w'] }
    ] };
    const [problem] = figureProblems(spec);
    expect(problem).toMatch(/^columns\[3\]\.name "An extremely long column name" is [\d.]+ characters wide at 30 units; its slot holds \d+ characters\. Shorten it/);
  });

  it('never shrinks or truncates: the same label fits a wider slot', () => {
    const label = 'Outer shell visuals';
    expect(figureProblems({ kind: 'columns', columns: [{ name: label, items: ['x', 'x2'] }, { name: 'b', items: ['y', 'y2'] }] })).toEqual([]);
    expect(figureProblems({ kind: 'columns', columns: [{ name: label, items: ['x', 'x2'] }, { name: 'b', items: ['y', 'y2'] }, { name: 'c', items: ['z'] }, { name: 'd', items: ['w'] }] }).join('\n')).toMatch(/Outer shell visuals/);
  });

  it('accepts a flow of two steps that marks the change, and columns with two full columns', () => {
    expect(figureProblems({ kind: 'flow', steps: ['Before', 'After'], changed: 'After' })).toEqual([]);
    expect(figureProblems({ kind: 'flow', steps: ['Ask', 'Answer'], loop: { from: 'Answer', to: 'Ask', label: 'again' } })).toEqual([]);
    expect(figureProblems({ kind: 'columns', columns: [{ name: 'a', items: ['x', 'y'] }, { name: 'b', items: ['z', 'w'] }, { name: 'c', items: ['v'] }] })).toEqual([]);
  });

  it('names the slot of a list’s detail and a compare’s cell when a label does not fit', () => {
    const list = figureProblems({ kind: 'list', items: [{ label: 'Overlap', detail: 'no two labels ever touch, at any width, on any ground at all' }, { label: 'Outside' }], changed: 'Outside' });
    expect(list.join('\n')).toMatch(/^items\[0\]\.detail "no two labels ever touch, at any width, on any ground at all" is [\d.]+ characters wide at 25 units; its slot holds \d+ characters\. Shorten it/);
    const compare = figureProblems({ kind: 'compare', rows: [{ subject: 'A change no beat cites', before: 'Repaired by the composer, every time', after: 'Left out' }, { subject: 'b', before: 'c', after: 'd' }] });
    expect(compare.join('\n')).toMatch(/^rows\[0\]\.before "Repaired by the composer, every time" is [\d.]+ characters wide at 25 units; its slot holds \d+ characters/);
  });

  it('gives a list’s labels the whole width when no item carries a detail', () => {
    const label = 'Every label is measured before it is drawn';
    expect(figureProblems({ kind: 'list', items: [{ label }, { label: 'b' }], changed: 'b' })).toEqual([]);
    expect(figureProblems({ kind: 'list', items: [{ label }, { label: 'b', detail: 'x' }], changed: 'b' }).join('\n')).toMatch(/items\[0\]\.label/);
  });

  it('accepts a list of two items that marks one or details them, and a compare under its own headers', () => {
    expect(figureProblems({ kind: 'list', items: [{ label: 'a' }, { label: 'b' }], changed: 'b' })).toEqual([]);
    expect(figureProblems({ kind: 'list', items: [{ label: 'a', detail: 'x' }, { label: 'b' }] })).toEqual([]);
    expect(figureProblems({ kind: 'compare', headers: { before: 'Was', after: 'Now' }, rows: [{ subject: 'a', before: 'b', after: 'c' }, { subject: 'd', before: 'e', after: 'f' }] })).toEqual([]);
  });

  it('states each slot’s budget in characters, as its own refusals count them', () => {
    const holds = spec => Number(/its slot holds (\d+) characters/.exec(figureProblems(spec).join('\n'))[1]);
    const long = 'W'.repeat(60);
    const bars = (count, label) => ({ kind: 'bars', max: 1, items: Array.from({ length: count }, (_, i) => ({ label: i === 0 ? label : `b${i}`, value: 1 })) });
    const columns = (count, at) => ({ kind: 'columns', columns: Array.from({ length: count }, (_, i) => ({ name: at === 'name' && i === 0 ? long : `c${i}`, items: [at === 'item' && i === 0 ? long : 'x', 'y'] })) });
    expect(holds({ kind: 'flow', title: long, steps: ['a', 'b'], changed: 'b' })).toBe(KIT_BUDGETS.title);
    expect(holds({ ...bars(2, 'a'), note: long })).toBe(KIT_BUDGETS.bars.note);
    expect(holds(bars(4, long))).toBe(KIT_BUDGETS.bars.label.least);
    expect(holds(bars(2, long))).toBe(KIT_BUDGETS.bars.label.most);
    expect(holds({ kind: 'flow', steps: [long, 'b'], changed: long })).toBe(KIT_BUDGETS.flow.step);
    expect(holds({ kind: 'flow', steps: ['a', 'b'], loop: { from: 'a', to: 'b', label: long } })).toBe(KIT_BUDGETS.flow.loop);
    expect(holds(columns(4, 'name'))).toBe(KIT_BUDGETS.columns.name.least);
    expect(holds(columns(2, 'name'))).toBe(KIT_BUDGETS.columns.name.most);
    expect(holds(columns(4, 'item'))).toBe(KIT_BUDGETS.columns.item.least);
    expect(holds(columns(2, 'item'))).toBe(KIT_BUDGETS.columns.item.most);
    expect(holds({ kind: 'stack', zones: [{ label: long, shape: 'bar' }, { label: 'b', shape: 'lines' }], changed: long })).toBe(KIT_BUDGETS.stack.label);
    expect(holds({ kind: 'list', items: [{ label: long, detail: 'd' }, { label: 'b' }], changed: long })).toBe(KIT_BUDGETS.list.label.least);
    expect(holds({ kind: 'list', items: [{ label: `${long}${long}` }, { label: 'b' }], changed: `${long}${long}` })).toBe(KIT_BUDGETS.list.label.most);
    expect(holds({ kind: 'compare', rows: [{ subject: `${long}${long}`, before: 'b', after: 'c' }, { subject: 'd', before: 'e', after: 'f' }] })).toBe(KIT_BUDGETS.compare.subject);
    expect(holds({ kind: 'compare', rows: [{ subject: 'a', before: 'b', after: long }, { subject: 'd', before: 'e', after: 'f' }] })).toBe(KIT_BUDGETS.compare.cell);
    expect(holds({ kind: 'compare', headers: { before: long, after: 'Now' }, rows: [{ subject: 'a', before: 'b', after: 'c' }, { subject: 'd', before: 'e', after: 'f' }] })).toBe(KIT_BUDGETS.compare.header);
    // A detail has what the widest label leaves: beside the widest label the kit accepts, its budget.
    const label = 'n'.repeat(KIT_BUDGETS.list.label.least);
    expect(figureProblems({ kind: 'list', items: [{ label, detail: 'n'.repeat(KIT_BUDGETS.list.detail) }, { label: 'b' }] })).toEqual([]);
  });

  it('accepts the study', () => {
    for (const spec of Object.values(STUDY)) expect(figureProblems(spec)).toEqual([]);
  });

  it('exposes its bounds', () => {
    expect(FIGURE_BOUNDS).toEqual({ bars: { items: [2, 4] }, flow: { steps: [2, 7] }, columns: { columns: [2, 4], items: [1, 6] }, stack: { zones: [2, 5] }, list: { items: [2, 6] }, compare: { rows: [2, 4] } });
  });
});
