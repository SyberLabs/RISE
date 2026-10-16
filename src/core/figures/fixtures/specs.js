/**
 * The figure kit's test specs: the approved study's four figures and one of each later kind, and specs at every bound (the most items, each slot's
 * longest label the kit accepts), shared by the kit's tests and the rendered check's.
 */
import { FIGURE_BOUNDS, figureProblems } from '../figure-kit.js';

/**
 * The study's four figures (docs/assets/changes/figure-kit-study.html), the room given bottom to top, and one figure of
 * each kind added after it: a list (what a figure is checked for) and a compare (what became of a change no beat cites).
 */
export const STUDY = Object.freeze({
  bars: { kind: 'bars', title: 'The swarm, frames per second', note: '1440 × 900, outer shell', max: 150, items: [{ label: 'Before', value: 16.4 }, { label: 'After', value: 143.9, changed: true }] },
  flow: { kind: 'flow', title: 'How a digest is made', steps: ['Merged pull requests', 'Router', 'Composer', 'Illustrator', 'RISE admission', 'Published'], changed: 'Illustrator', loop: { from: 'RISE admission', to: 'Illustrator', label: 'repair' } },
  columns: { kind: 'columns', title: 'Where each visual opens', columns: [
    { name: 'Inner eye', glyph: 'eye', items: ['harmonograph', 'ostensoria', 'apparitio'] },
    { name: 'Outer shell', glyph: 'shell', items: ['attractor', 'living flame', 'turrell'] },
    { name: 'Full frame', glyph: 'full', items: ['figures', 'genesis', 'fractal', 'neural', 'rock garden'] }
  ] },
  stack: { kind: 'stack', title: 'The room, bottom to top', zones: [
    { label: 'Controls', shape: 'ticks' },
    { label: 'Ask bar, Sophia at left', shape: 'bar' },
    { label: 'Spoken words', shape: 'lines' },
    { label: 'The picture', shape: 'circle' }
  ], changed: 'Ask bar, Sophia at left', dock: 'Ask bar, Sophia at left' },
  list: { kind: 'list', title: 'What a figure is checked for', items: [
    { label: 'Overlap', detail: 'no two labels touch' },
    { label: 'Crossing', detail: 'no label over a line' },
    { label: 'Outside', detail: 'nothing past the edge' },
    { label: 'Too small', detail: 'none under 12 pixels' },
    { label: 'Rendered', detail: 'measured in a browser' }
  ], changed: 'Rendered' },
  compare: { kind: 'compare', title: 'A change no beat cites', rows: [
    { subject: 'The reading', before: 'Repaired to cite it', after: 'Left out' },
    { subject: 'The page', before: 'Says nothing', after: 'Lists it as unspoken' },
    { subject: 'The run', before: 'A repair', after: 'A note' }
  ] }
});

/** The longest label a slot takes: `make(n)` is the spec with an n-character label there; the kit's own answer decides. */
function longest(make, from = 1) {
  let n = from;
  if (figureProblems(make(n)).length) throw new Error(`no label of ${n} characters fits: ${figureProblems(make(n))[0]}`);
  while (figureProblems(make(n + 1)).length === 0 && n < 400) n += 1;
  return make(n);
}
const word = n => 'Wm'.repeat(Math.ceil(n / 2)).slice(0, n);

/** Specs at every bound: the most items, each slot's longest label. */
export function boundSpecs() {
  const { flow, columns, list, compare } = FIGURE_BOUNDS;
  return [
    longest(n => ({ kind: 'bars', title: word(n), note: 'note', max: 100, items: [{ label: 'a', value: 1 }, { label: 'b', value: 100, changed: true }] })),
    longest(n => ({ kind: 'bars', title: 'T', note: word(n), max: 100, items: [{ label: 'a', value: 1 }, { label: 'b', value: 100 }] })),
    ...[2, 3, 4].map(count => longest(n => ({ kind: 'bars', title: 'Bars', max: 9999.5, items: Array.from({ length: count }, (_, i) => ({ label: word(n), value: i === 0 ? 9999.5 : 0.25, changed: i === count - 1 })) }))),
    longest(n => ({ kind: 'flow', title: 'Steps', steps: Array.from({ length: flow.steps[1] }, (_, i) => `${word(n)}${i}`), changed: `${word(n)}${flow.steps[1] - 1}`, loop: { from: `${word(n)}6`, to: `${word(n)}0`, label: 'back' } })),
    longest(n => ({ kind: 'flow', steps: ['one', 'two', 'three'], loop: { from: 'three', to: 'one', label: word(n) } })),
    ...[2, 3, 4].map(count => longest(n => ({ kind: 'columns', title: 'Columns', columns: Array.from({ length: count }, (_, i) => ({ name: word(n), glyph: ['eye', 'shell', 'full', 'dot'][i], items: Array.from({ length: columns.items[1] }, () => word(Math.max(1, n - 2))) })) }))),
    ...[2, 3, 4, 5].map(count => longest(n => ({ kind: 'stack', title: 'Stack', zones: Array.from({ length: count }, (_, i) => ({ label: `${word(n)}${i}`, shape: ['bar', 'lines', 'ticks', 'circle', 'bar'][i] })), changed: `${word(n)}0`, dock: `${word(n)}0` }))),
    longest(n => ({ kind: 'stack', zones: [{ label: 'a', shape: 'circle' }, { label: 'b', shape: 'circle' }, { label: 'c', shape: 'circle' }, { label: 'd', shape: 'circle' }, { label: word(n), shape: 'circle' }], changed: 'a' })),
    longest(n => ({ kind: 'list', title: 'List', items: Array.from({ length: list.items[1] }, (_, i) => ({ label: `${word(n)}${i}`, detail: 'd' })), changed: `${word(n)}${list.items[1] - 1}` })),
    longest(n => ({ kind: 'list', items: Array.from({ length: list.items[1] }, (_, i) => ({ label: `L${i}`, detail: `${word(n)}${i}` })), changed: 'L0' })),
    longest(n => ({ kind: 'list', items: Array.from({ length: list.items[1] }, (_, i) => ({ label: `${word(n)}${i}` })), changed: `${word(n)}0` })),
    ...[2, 3, 4].map(count => longest(n => ({ kind: 'compare', title: 'Compare', rows: Array.from({ length: count }, (_, i) => ({ subject: `${word(n)}${i}`, before: `${word(n)}${i}b`, after: `${word(n)}${i}a` })) }))),
    longest(n => ({ kind: 'compare', headers: { before: word(n), after: `${word(n)}a` }, rows: Array.from({ length: compare.rows[1] }, (_, i) => ({ subject: `s${i}`, before: 'b', after: 'a' })) })),
    { kind: 'bars', max: 1, items: [{ label: 'x', value: 0 }, { label: 'y', value: 1 }] },
    { kind: 'flow', steps: ['a', 'b'], changed: 'b' },
    { kind: 'columns', columns: [{ name: 'a', items: ['x', 'x2'] }, { name: 'b', items: ['y', 'y2'] }] },
    { kind: 'stack', zones: [{ label: 'a', shape: 'ticks' }, { label: 'b', shape: 'lines' }] },
    { kind: 'list', items: [{ label: 'a' }, { label: 'b' }], changed: 'b' },
    { kind: 'compare', rows: [{ subject: 'a', before: 'b', after: 'c' }, { subject: 'd', before: 'e', after: 'f' }] }
  ];
}
