/**
 * The RISE Figure Kit (docs/plans/RISE-CHANGES.md, The figure kit; the approved study is
 * docs/assets/changes/figure-kit-study.html): six kinds of figure RISE draws with its own code from data a model
 * supplies, so a label can neither collide nor say what the data does not. The study drew four; `list` (a set of rules,
 * what something is checked for) and `compare` (what was so before a change and after it) follow its house style.
 *
 *   renderFigure(spec, { theme })  the figure as an SVG string, or a throw naming what figureProblems refuses
 *   renderFigure(spec, { brand })  the same figure in a company's three colors, on its own ground
 *   figureProblems(spec)           plain sentences, empty when the kit can draw the spec
 *   brandProblems(brand)           plain sentences, empty when the kit can draw in the brand
 *
 * The house style: one accent (the reading theme's, jev-palette.js) for what changed; hairlines at a third of the ink
 * instead of boxes; serif titles and system-sans labels, since a figure is an image and cannot load a web font. The
 * viewBox is 800 × 500: labels 25 units, titles 40, values 34, column names 30, so the smallest is 12.2 pixels on a
 * phone 390 pixels wide. Every slot is measured before anything is drawn, with the advance widths the layout check
 * uses (textAdvance, quality/svg-layout.js), widened for the reader's fonts and for bold: a label that does not fit is refused
 * with its slot's budget, never shrunk or cut. Numbers are printed exactly as given; nothing is computed into text.
 * A brand is data, never a program: a name and three #RRGGBB colors, ground, ink and accent. The geometry, the type
 * sizes and the six kinds stay the kit's; the brand's name is its wordmark, set as any label is, above the title. A
 * brand sets every label in its ink at full strength, where a theme softens some: a company's ink is chosen for its
 * ground, not for the kit's tints. A brand whose words would fall under the layout check's contrast is refused with its
 * ratio; nothing is tinted to make it pass.
 * Pure and deterministic, and it imports nothing from the live layer.
 */
import { MIN_CONTRAST, contrastRatio, parseColour, seenOn, textAdvance } from '../quality/svg-layout.js';
import { jevPalette } from '../jev-palette.js';

export const FIGURE_KINDS = Object.freeze(['bars', 'flow', 'columns', 'stack', 'list', 'compare', 'system']);
export const FIGURE_BOUNDS = Object.freeze({
  bars: Object.freeze({ items: Object.freeze([2, 4]) }),
  flow: Object.freeze({ steps: Object.freeze([2, 7]) }),
  columns: Object.freeze({ columns: Object.freeze([2, 4]), items: Object.freeze([1, 6]) }),
  stack: Object.freeze({ zones: Object.freeze([2, 5]) }),
  list: Object.freeze({ items: Object.freeze([2, 6]) }),
  compare: Object.freeze({ rows: Object.freeze([2, 4]) }),
  system: Object.freeze({ nodes: Object.freeze([3, 8]), links: Object.freeze([2, 10]), states: Object.freeze([2, 3]) })
});
const GLYPHS = Object.freeze(['eye', 'shell', 'full', 'dot']);
const SHAPES = Object.freeze(['circle', 'lines', 'bar', 'ticks']);
const DEFAULT_THEME = 'cobalt';

const W = 800;
const H = 500;
const MARGIN = 56;
const SERIF = "Georgia, 'Iowan Old Style', 'Times New Roman', serif";
const SANS = "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif";
const SIZE = Object.freeze({ label: 25, title: 40, value: 34, column: 30 });
/**
 * How much wider than the Helvetica widths the estimate uses a reader's fonts may set: Georgia for the serif, and for
 * the system sans the widest a reader or the weekly job's Linux runner is likely to have (DejaVu Sans).
 */
const SERIF_WIDTH = 1.12;
const SANS_WIDTH = 1.1;
const BOLD_WIDTH = 1.08;
const AVERAGE_EM = 0.56;
const LABEL_MAX = 120;
/** The accent's tint behind a changed flow step, whose label is set in the accent on it. */
const CHANGED_TINT = 0.14;
const BRAND_KEYS = Object.freeze(['name', 'ground', 'ink', 'accent']);
/** The wordmark's baseline: the brand's name, at label size above the title, clear of it and of every kind's body. */
const WORDMARK_Y = 30;
const HEX = /^#[0-9A-Fa-f]{6}$/u;

const KEYS = Object.freeze({
  bars: ['kind', 'title', 'note', 'max', 'items'],
  flow: ['kind', 'title', 'steps', 'changed', 'loop'],
  columns: ['kind', 'title', 'columns'],
  stack: ['kind', 'title', 'zones', 'changed', 'dock'],
  list: ['kind', 'title', 'items', 'changed'],
  compare: ['kind', 'title', 'headers', 'rows'],
  system: ['kind', 'title', 'states', 'nodes', 'links']
});

// ─── geometry ──────────────────────────────────────────────────────────

/** Bar width and gap for 2, 3 and 4 bars: the study's two, and as many as fit the same baseline. */
const BAR_GEOMETRY = { 2: [150, 110], 3: [140, 70], 4: [120, 48] };
const BAR_BASE = 430;
const BAR_HEIGHT = 240;
const FLOW_TOP = 124;
const FLOW_BOTTOM = 496;
const FLOW_NODE_WIDTH = 380;
const COLUMN_SIDE = 17.5;
const COLUMN_PAD = 12;
const STACK_FRAME = { x: 90, y: 122, width: 250, height: 352 };
const STACK_INSIDE = { top: 138, bottom: 458 };
const STACK_CENTRE = 215;
const STACK_LABEL_X = 418;
const STACK_LEADER_END = 404;
const STACK_DOCK_X = 128;

/**
 * A list's rows, from a fixed baseline under the title as a flow's steps start under it: a hairline (or, for what
 * changed, the accent's dot), the label, its detail.
 */
const LIST_TOP = 158;
const LIST_PITCH = 56;
const LIST_MARK = MARGIN;
const LIST_LABEL_X = MARGIN + 40;
const LIST_GAP = 32;
/** The widest a list's label column grows when its items carry details; without details a label has the whole width. */
const LIST_LABEL_COLUMN = 330;
/** A compare: headers over two cells a row, before at the left, after at the right, a hairline arrow between. */
const COMPARE_HEADER = 146;
const COMPARE_RULE = 162;
const COMPARE_TOP = 176;
const COMPARE_BOTTOM = 488;
const COMPARE_PITCH = 104;
const COMPARE_ARROW = Object.freeze({ from: 384, to: 416 });
const COMPARE_AFTER_X = 428;
const COMPARE_CELL = W / 2 - 28 - MARGIN;
const COMPARE_HEADERS = Object.freeze({ before: 'Before', after: 'After' });

function barGeometry(count) {
  const [barW, gap] = BAR_GEOMETRY[count];
  const total = count * barW + (count - 1) * gap;
  return { barW, gap, total, x0: W / 2 - total / 2, slot: barW + gap - 12 };
}

function flowGeometry(count) {
  const nodeH = count <= 6 ? 42 : 38;
  const gap = Math.min(24, (FLOW_BOTTOM - FLOW_TOP - count * nodeH) / (count - 1));
  return { nodeH, gap, x: W / 2 - FLOW_NODE_WIDTH / 2, slot: FLOW_NODE_WIDTH - 40 };
}
const LOOP_LABEL_X = W / 2 + FLOW_NODE_WIDTH / 2 + 74;

function columnGeometry(count) {
  const width = (W - 2 * COLUMN_SIDE) / count;
  return { width, centres: Array.from({ length: count }, (_, i) => COLUMN_SIDE + width * (i + 0.5)), slot: width - 2 * COLUMN_PAD };
}

/** Each zone's centre and room, bottom to top: a circle takes two shares of the frame's inside, any other shape one. */
function stackGeometry(zones) {
  const weights = zones.map(zone => (zone.shape === 'circle' ? 2 : 1));
  const unit = (STACK_INSIDE.bottom - STACK_INSIDE.top) / weights.reduce((sum, weight) => sum + weight, 0);
  let below = 0;
  return zones.map((zone, i) => {
    const centre = STACK_INSIDE.bottom - (below + weights[i] / 2) * unit;
    below += weights[i];
    return { centre, room: weights[i] * unit };
  });
}

/** Each row's baseline, and where a detail starts and how much room it has: after the widest label, when any item has one. */
function listGeometry(items) {
  const baselines = items.map((_, i) => LIST_TOP + i * LIST_PITCH);
  const detailed = items.some(item => item.detail !== undefined);
  return { baselines, detailed, labelSlot: detailed ? LIST_LABEL_COLUMN : W - MARGIN - LIST_LABEL_X };
}

function detailColumn(items, changed) {
  const column = Math.max(...items.map(item => width(item.label, SIZE.label, { bold: item.label === changed })));
  const x = LIST_LABEL_X + column + LIST_GAP;
  return { x, slot: W - MARGIN - x };
}

function compareGeometry(count) {
  const pitch = Math.min(COMPARE_PITCH, (COMPARE_BOTTOM - COMPARE_TOP) / count);
  return Array.from({ length: count }, (_, i) => {
    const top = COMPARE_TOP + i * pitch;
    return { subject: top + 28, cells: top + 64 };
  });
}

// A system: parts set on a grid of up to four columns and three rows, the paths between them, and the states it
// passes through.
/** Each row's centre for one, two and three rows: under the title, over the legend of states. */
const SYSTEM_ROWS = Object.freeze({ 1: [276], 2: [208, 344], 3: [160, 282, 404] });
const SYSTEM_SHAPES = Object.freeze(['service', 'queue', 'store']);
/** A part is a box around its label: this much room either side of the label, and this tall. */
const SYSTEM_PAD = 20;
const SYSTEM_BOX = 50;
/** Two parts in neighbouring columns keep at least this much ground between their boxes. */
const SYSTEM_APART = 12;
/** A service is a soft box, a queue a capsule, a store a box with a shelf under its top edge. */
const SYSTEM_RADIUS = Object.freeze({ service: 10, queue: 25, store: 4 });
const SYSTEM_SHELF = 8;
/** A link stops this far short of the boxes it joins; a link marked many is three strands this far apart. */
const SYSTEM_GAP = 8;
const SYSTEM_STRANDS = Object.freeze([-8, 0, 8]);
const SYSTEM_DOT = 5;
/** Two links between the same parts, one each way, run in lanes this far either side of the line between them. */
const SYSTEM_LANE = 10;
const SYSTEM_STATE_SECONDS = 3.2;
const SYSTEM_ID = /^[a-z][a-z0-9-]{0,23}$/u;
const SYSTEM_LEGEND = 476;
const SYSTEM_LEGEND_GAP = 56;
const systemSlot = count => (W - 2 * MARGIN) / count;
/** The widest a part's label may be with `count` columns: its box, padded, leaves its neighbour room. */
const systemLabelRoom = count => systemSlot(count) - SYSTEM_APART - 2 * SYSTEM_PAD;

/** A system's columns: as many as its rightmost part needs, two at least, sharing the frame's inside. */
function systemColumns(spec) {
  const count = Math.max(2, ...spec.nodes.map(node => node.at[0] + 1));
  const slot = systemSlot(count);
  return { count, slot, x: column => MARGIN + slot * (column + 0.5) };
}

/** A label's box, [left, top, right, bottom], from where it is set and its measured width. */
function labelBox(x, y, value, { anchor = 'middle', italic = false, bold = false } = {}) {
  const wide = width(value, SIZE.label, { bold }) * (italic ? 1.02 : 1);
  const left = anchor === 'middle' ? x - wide / 2 : anchor === 'end' ? x - wide : x;
  return [left, y - SIZE.label * 0.8, left + wide, y + SIZE.label * 0.25];
}
const overlaps = (a, b) => a[0] < b[2] && b[0] < a[2] && a[1] < b[3] && b[1] < a[3];
const grown = (box, by) => [box[0] - by, box[1] - by, box[2] + by, box[3] + by];

/** Whether the segment from p to q passes through `box` (Liang-Barsky). */
function crosses([x1, y1], [x2, y2], [left, top, right, bottom]) {
  let lo = 0;
  let hi = 1;
  const dx = x2 - x1;
  const dy = y2 - y1;
  for (const [p, q] of [[-dx, x1 - left], [dx, right - x1], [-dy, y1 - top], [dy, bottom - y1]]) {
    if (p === 0) {
      if (q < 0) return false;
      continue;
    }
    const r = q / p;
    if (p < 0) lo = Math.max(lo, r);
    else hi = Math.min(hi, r);
    if (lo > hi) return false;
  }
  return true;
}

/** How far along the segment from `p` (inside `box`) by (dx, dy) it leaves the box, SYSTEM_GAP clear of it. */
function leaves(p, dx, dy, box) {
  const [left, top, right, bottom] = grown(box, SYSTEM_GAP);
  return Math.min(dx > 0 ? (right - p[0]) / dx : dx < 0 ? (left - p[0]) / dx : Infinity, dy > 0 ? (bottom - p[1]) / dy : dy < 0 ? (top - p[1]) / dy : Infinity);
}

/**
 * Every position the drawing and the check share: each part's box and label, each link's ends, strands and arrowhead,
 * and where each link's label sits. A link's label takes the first of its places that is in the frame and clear of
 * every box, strand and label already placed: beside its middle, on the side away from a link running the other way,
 * then the other side, then beside a third of the way along and two thirds. Pure, so the check measures what is drawn.
 */
function systemLayout(spec) {
  const { x } = systemColumns(spec);
  const ys = SYSTEM_ROWS[Math.max(...spec.nodes.map(node => node.at[1] + 1))];
  const nodes = new Map(spec.nodes.map(node => {
    const cx = x(node.at[0]);
    const cy = ys[node.at[1]];
    const half = width(node.label, SIZE.label, { bold: node.changed === true }) / 2 + SYSTEM_PAD;
    return [node.id, { node, shape: node.shape ?? 'service', cx, cy, box: [cx - half, cy - SYSTEM_BOX / 2, cx + half, cy + SYSTEM_BOX / 2], baseline: cy + 9 }];
  }));
  const links = spec.links.map(link => {
    const a = nodes.get(link.from);
    const b = nodes.get(link.to);
    const dx = b.cx - a.cx;
    const dy = b.cy - a.cy;
    const length = Math.hypot(dx, dy);
    // The normal pointing up, or right for an upright link, whichever way the link runs.
    let [nx, ny] = [-dy / length, dx / length];
    if (ny > 1e-9 || (Math.abs(ny) <= 1e-9 && nx < 0)) [nx, ny] = [-nx, -ny];
    const paired = spec.links.some(other => other.from === link.to && other.to === link.from);
    const side = paired && link.from > link.to ? -1 : 1;
    const lane = paired ? side * SYSTEM_LANE : 0;
    // Each strand runs beside the line between the centres, and stops where it meets either box.
    const strand = offset => {
      const from = [a.cx + nx * (lane + offset), a.cy + ny * (lane + offset)];
      const to = [b.cx + nx * (lane + offset), b.cy + ny * (lane + offset)];
      const out = leaves(from, dx, dy, a.box);
      const into = 1 - leaves(to, -dx, -dy, b.box);
      return [[from[0] + dx * out, from[1] + dy * out], [from[0] + dx * into, from[1] + dy * into]];
    };
    const [start, end] = strand(0);
    const strands = (link.many ? SYSTEM_STRANDS : [0]).map(strand);
    return { link, start, end, nx, ny, side, strands };
  });
  const placedLabels = [...nodes.values()].map(placed => labelBox(placed.cx, placed.baseline, placed.node.label, { bold: placed.node.changed === true }));
  const clean = (box, own) => box[0] >= 8 && box[2] <= W - 8 && box[1] >= 96 && box[3] <= SYSTEM_LEGEND - SIZE.label * 0.8 - 8
    && [...nodes.values()].every(placed => !overlaps(box, grown(placed.box, 4)))
    && links.every((other, k) => !other.strands.some(([p, q]) => crosses(p, q, grown(box, k === own ? SYSTEM_DOT + 4 : 4))))
    && placedLabels.every(other => !overlaps(box, grown(other, 4)));
  links.forEach((placed, i) => {
    const { link, start, end, nx, ny, side } = placed;
    if (link.label === undefined) return;
    const wide = width(link.label, SIZE.label) * 1.02;
    const tall = SIZE.label * 1.05;
    const clear = (link.many ? 8 : 0) + SYSTEM_DOT + 8 + Math.abs(nx) * wide / 2 + Math.abs(ny) * tall / 2;
    const spots = [0.5, 1 / 3, 2 / 3].flatMap(along => [side, -side].map(away => {
      const cx = start[0] + (end[0] - start[0]) * along + nx * away * clear;
      const cy = start[1] + (end[1] - start[1]) * along + ny * away * clear;
      return { x: cx, y: cy + tall / 2 - SIZE.label * 0.25 };
    }));
    const boxes = spots.map(spot => labelBox(spot.x, spot.y, link.label, { italic: true }));
    const at = Math.max(0, boxes.findIndex(box => clean(box, i)));
    placed.label = { ...spots[at], box: boxes[at], clean: clean(boxes[at], i) };
    placedLabels.push(boxes[at]);
  });
  return { nodes, links };
}

// ─── measuring ─────────────────────────────────────────────────────────

const round1 = value => Math.round(value * 10) / 10;
const width = (text, size, { serif = false, bold = false } = {}) => textAdvance(text) * size * (serif ? SERIF_WIDTH : SANS_WIDTH) * (bold ? BOLD_WIDTH : 1);

/** The width of an average character at `size` (AVERAGE_EM, widened as the measure is): what a budget in characters counts. */
const perCharacter = (size, options = {}) => size * AVERAGE_EM * (options.serif ? SERIF_WIDTH : SANS_WIDTH) * (options.bold ? BOLD_WIDTH : 1);
/** How many average characters `slot` units hold at `size`: the budget a refusal names and the composer is told. */
const budget = (slot, size, options = {}) => Math.floor(slot / perCharacter(size, options));

/** A sentence when `text` set at `size` is wider than `slot` units, naming both in characters. */
function fit(path, text, size, slot, options = {}) {
  const wide = width(text, size, options);
  if (wide <= slot) return [];
  return [`${path} "${text}" is ${round1(wide / perCharacter(size, options))} characters wide at ${size} units; its slot holds ${budget(slot, size, options)} characters. Shorten it: the kit never shrinks or cuts a label`];
}

/**
 * Each slot's budget in average characters, from the same geometry and measure the refusals use, so what the composer
 * is told cannot drift from what the kit accepts. `least` is the budget in the most crowded figure of its kind (the
 * most bars or columns, or a list whose items carry details), `most` in the least crowded; a slot that can hold what
 * changed is counted in bold. Letters wider than average (W, M) fit fewer; narrower ones (i, l, t) more.
 */
export const KIT_BUDGETS = Object.freeze({
  title: budget(W - 2 * MARGIN, SIZE.title, { serif: true }),
  bars: Object.freeze({
    note: budget(W - 2 * MARGIN, SIZE.label),
    label: Object.freeze({ least: budget(barGeometry(FIGURE_BOUNDS.bars.items[1]).slot, SIZE.label), most: budget(barGeometry(FIGURE_BOUNDS.bars.items[0]).slot, SIZE.label) }),
    value: Object.freeze({ least: budget(barGeometry(FIGURE_BOUNDS.bars.items[1]).slot, SIZE.value, { bold: true }), most: budget(barGeometry(FIGURE_BOUNDS.bars.items[0]).slot, SIZE.value, { bold: true }) })
  }),
  flow: Object.freeze({
    step: budget(flowGeometry(FIGURE_BOUNDS.flow.steps[1]).slot, SIZE.label, { bold: true }),
    loop: budget(W - 8 - LOOP_LABEL_X, SIZE.label, { serif: true })
  }),
  columns: Object.freeze({
    name: Object.freeze({ least: budget(columnGeometry(FIGURE_BOUNDS.columns.columns[1]).slot, SIZE.column, { serif: true }), most: budget(columnGeometry(FIGURE_BOUNDS.columns.columns[0]).slot, SIZE.column, { serif: true }) }),
    item: Object.freeze({ least: budget(columnGeometry(FIGURE_BOUNDS.columns.columns[1]).slot, SIZE.label), most: budget(columnGeometry(FIGURE_BOUNDS.columns.columns[0]).slot, SIZE.label) })
  }),
  stack: Object.freeze({ label: budget(W - 24 - STACK_LABEL_X, SIZE.label, { bold: true }) }),
  list: Object.freeze({
    label: Object.freeze({ least: budget(LIST_LABEL_COLUMN, SIZE.label, { bold: true }), most: budget(W - MARGIN - LIST_LABEL_X, SIZE.label, { bold: true }) }),
    detail: budget(W - MARGIN - (LIST_LABEL_X + LIST_LABEL_COLUMN + LIST_GAP), SIZE.label)
  }),
  compare: Object.freeze({
    subject: budget(W - 2 * MARGIN, SIZE.label, { serif: true }),
    cell: budget(COMPARE_CELL, SIZE.label, { bold: true }),
    header: budget(COMPARE_CELL, SIZE.label)
  }),
  system: Object.freeze({
    node: Object.freeze({ least: budget(systemLabelRoom(4), SIZE.label, { bold: true }), three: budget(systemLabelRoom(3), SIZE.label, { bold: true }), most: budget(systemLabelRoom(2), SIZE.label, { bold: true }) }),
    state: budget((W - 2 * MARGIN - 2 * SYSTEM_LEGEND_GAP) / 3, SIZE.label, { bold: true })
  })
});

// ─── checking ──────────────────────────────────────────────────────────

const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const isLabel = value => typeof value === 'string' && value.trim().length > 0 && value.length <= LABEL_MAX && !/[\u0000-\u001f\u007f]/u.test(value);
const labelProblem = (path, value) => (isLabel(value) ? [] : [`${path} is a label of 1 or more characters, at most ${LABEL_MAX}, on one line`]);
const keysProblem = (path, value, allowed, required) => {
  if (!isObject(value)) return [`${path} is an object`];
  const extra = Object.keys(value).filter(key => !allowed.includes(key));
  const missing = required.filter(key => !Object.hasOwn(value, key));
  return [...extra, ...missing].length ? [`${path} takes ${allowed.join(', ')}${missing.length ? ` and needs ${missing.join(', ')}` : ''}`] : [];
};
const countProblem = (path, list, [low, high], noun) =>
  (Array.isArray(list) && list.length >= low && list.length <= high ? [] : [`${path} has ${low} to ${high} ${noun}`]);

function headerProblems(spec, { note = false } = {}) {
  const problems = [];
  if (spec.title !== undefined) problems.push(...labelProblem('title', spec.title), ...(isLabel(spec.title) ? fit('title', spec.title, SIZE.title, W - 2 * MARGIN, { serif: true }) : []));
  if (note && spec.note !== undefined) problems.push(...labelProblem('note', spec.note), ...(isLabel(spec.note) ? fit('note', spec.note, SIZE.label, W - 2 * MARGIN) : []));
  return problems;
}

function barsProblems(spec) {
  const problems = headerProblems(spec, { note: true });
  if (typeof spec.max !== 'number' || !Number.isFinite(spec.max) || spec.max <= 0) problems.push('max is a number above 0: the value the tallest bar would reach');
  problems.push(...countProblem('items', spec.items, FIGURE_BOUNDS.bars.items, 'items'));
  if (problems.some(line => line.startsWith('items has'))) return problems;
  const { slot } = barGeometry(spec.items.length);
  spec.items.forEach((item, i) => {
    const path = `items[${i}]`;
    const shape = keysProblem(path, item, ['label', 'value', 'changed'], ['label', 'value']);
    if (shape.length) { problems.push(...shape); return; }
    problems.push(...labelProblem(`${path}.label`, item.label));
    if (isLabel(item.label)) problems.push(...fit(`${path}.label`, item.label, SIZE.label, slot));
    if (typeof item.value !== 'number' || !Number.isFinite(item.value)) problems.push(`${path}.value is a number, as a pull request states it`);
    else {
      if (item.value < 0 || (typeof spec.max === 'number' && item.value > spec.max)) problems.push(`${path}.value is 0 to max (${spec.max})`);
      problems.push(...fit(`${path}.value`, String(item.value), SIZE.value, slot, { bold: true }));
    }
    if (item.changed !== undefined && typeof item.changed !== 'boolean') problems.push(`${path}.changed is true or false`);
  });
  if (spec.items.filter(item => item?.changed === true).length > 1) problems.push('items marks one item changed at most: one accent per figure');
  return problems;
}

function flowProblems(spec) {
  const problems = headerProblems(spec);
  problems.push(...countProblem('steps', spec.steps, FIGURE_BOUNDS.flow.steps, 'steps'));
  if (problems.some(line => line.startsWith('steps has'))) return problems;
  const { slot } = flowGeometry(spec.steps.length);
  const seen = new Set();
  spec.steps.forEach((step, i) => {
    const path = `steps[${i}]`;
    problems.push(...labelProblem(path, step));
    if (!isLabel(step)) return;
    if (seen.has(step)) problems.push(`${path} "${step}" is given twice; each step is named once`);
    seen.add(step);
    problems.push(...fit(path, step, SIZE.label, slot, { bold: step === spec.changed }));
  });
  if (spec.changed !== undefined && !spec.steps.includes(spec.changed)) problems.push(`changed "${String(spec.changed).slice(0, 40)}" is not one of the steps`);
  if (spec.steps.length === 2 && spec.changed === undefined && spec.loop === undefined) {
    problems.push('a flow of two steps with no changed step and no loop explains nothing a sentence does not; say it in words, mark the step that changed, or add a step');
  }
  if (spec.loop !== undefined) {
    const shape = keysProblem('loop', spec.loop, ['from', 'to', 'label'], ['from', 'to', 'label']);
    if (shape.length) return [...problems, ...shape];
    const { from, to, label } = spec.loop;
    if (!spec.steps.includes(from) || !spec.steps.includes(to) || from === to) problems.push('loop goes between two different steps, each named as in steps');
    problems.push(...labelProblem('loop.label', label));
    if (isLabel(label)) problems.push(...fit('loop.label', label, SIZE.label, W - 8 - LOOP_LABEL_X, { serif: true }));
  }
  return problems;
}

function columnsProblems(spec) {
  const problems = headerProblems(spec);
  problems.push(...countProblem('columns', spec.columns, FIGURE_BOUNDS.columns.columns, 'columns'));
  if (problems.some(line => line.startsWith('columns has'))) return problems;
  const { slot } = columnGeometry(spec.columns.length);
  if (spec.columns.filter(column => Array.isArray(column?.items) && column.items.length >= 2).length < 2) {
    problems.push('these columns are too sparse for columns; say it in words or use a flow: at least two columns list two items or more');
  }
  spec.columns.forEach((column, i) => {
    const path = `columns[${i}]`;
    const shape = keysProblem(path, column, ['name', 'glyph', 'items'], ['name', 'items']);
    if (shape.length) { problems.push(...shape); return; }
    problems.push(...labelProblem(`${path}.name`, column.name));
    if (isLabel(column.name)) problems.push(...fit(`${path}.name`, column.name, SIZE.column, slot, { serif: true }));
    if (column.glyph !== undefined && !GLYPHS.includes(column.glyph)) problems.push(`${path}.glyph is eye, shell, full or dot`);
    const count = countProblem(`${path}.items`, column.items, FIGURE_BOUNDS.columns.items, 'items');
    if (count.length) { problems.push(...count); return; }
    column.items.forEach((item, k) => {
      problems.push(...labelProblem(`${path}.items[${k}]`, item));
      if (isLabel(item)) problems.push(...fit(`${path}.items[${k}]`, item, SIZE.label, slot));
    });
  });
  return problems;
}

function stackProblems(spec) {
  const problems = headerProblems(spec);
  problems.push(...countProblem('zones', spec.zones, FIGURE_BOUNDS.stack.zones, 'zones, bottom to top'));
  if (problems.some(line => line.startsWith('zones has'))) return problems;
  const seen = new Set();
  spec.zones.forEach((zone, i) => {
    const path = `zones[${i}]`;
    const shape = keysProblem(path, zone, ['label', 'shape'], ['label', 'shape']);
    if (shape.length) { problems.push(...shape); return; }
    problems.push(...labelProblem(`${path}.label`, zone.label));
    if (isLabel(zone.label)) {
      if (seen.has(zone.label)) problems.push(`${path}.label "${zone.label}" is given twice; each zone is named once`);
      seen.add(zone.label);
      problems.push(...fit(`${path}.label`, zone.label, SIZE.label, W - 24 - STACK_LABEL_X, { bold: zone.label === spec.changed }));
    }
    if (!SHAPES.includes(zone.shape)) problems.push(`${path}.shape is circle, lines, bar or ticks`);
  });
  const named = label => spec.zones.find(zone => zone?.label === label);
  if (spec.changed !== undefined && !named(spec.changed)) problems.push(`changed "${String(spec.changed).slice(0, 40)}" is not one of the zones`);
  if (spec.dock !== undefined) {
    const zone = named(spec.dock);
    if (!zone) problems.push(`dock "${String(spec.dock).slice(0, 40)}" is not one of the zones`);
    else if (zone.shape === 'ticks') problems.push(`dock "${spec.dock}" sits beside a zone that is not ticks: the ticks run under it`);
  }
  return problems;
}

function listProblems(spec) {
  const problems = headerProblems(spec);
  problems.push(...countProblem('items', spec.items, FIGURE_BOUNDS.list.items, 'items'));
  if (problems.some(line => line.startsWith('items has'))) return problems;
  const shapes = spec.items.map((item, i) => keysProblem(`items[${i}]`, item, ['label', 'detail'], ['label']));
  if (shapes.some(shape => shape.length)) return [...problems, ...shapes.flat()];
  const { labelSlot } = listGeometry(spec.items);
  const seen = new Set();
  spec.items.forEach((item, i) => {
    const path = `items[${i}]`;
    problems.push(...labelProblem(`${path}.label`, item.label));
    if (isLabel(item.label)) {
      if (seen.has(item.label)) problems.push(`${path}.label "${item.label}" is given twice; each item is named once`);
      seen.add(item.label);
      problems.push(...fit(`${path}.label`, item.label, SIZE.label, labelSlot, { bold: item.label === spec.changed }));
    }
    if (item.detail !== undefined) problems.push(...labelProblem(`${path}.detail`, item.detail));
  });
  if (spec.changed !== undefined && !spec.items.some(item => item.label === spec.changed)) problems.push(`changed "${String(spec.changed).slice(0, 40)}" is not one of the items`);
  if (spec.items.length === 2 && spec.changed === undefined && spec.items.every(item => item.detail === undefined)) {
    problems.push('a list of two items with no changed item and no detail explains nothing a sentence does not; say it in words, mark the item that changed, or give each a detail');
  }
  // A detail's room is what the widest label leaves, so it is measured only once every label fits.
  if (problems.length === 0) {
    const { slot } = detailColumn(spec.items, spec.changed);
    spec.items.forEach((item, i) => { if (item.detail !== undefined) problems.push(...fit(`items[${i}].detail`, item.detail, SIZE.label, slot)); });
  }
  return problems;
}

function compareProblems(spec) {
  const problems = headerProblems(spec);
  if (spec.headers !== undefined) {
    const shape = keysProblem('headers', spec.headers, ['before', 'after'], ['before', 'after']);
    problems.push(...shape);
    if (!shape.length) {
      for (const side of ['before', 'after']) {
        problems.push(...labelProblem(`headers.${side}`, spec.headers[side]));
        if (isLabel(spec.headers[side])) problems.push(...fit(`headers.${side}`, spec.headers[side], SIZE.label, COMPARE_CELL));
      }
    }
  }
  problems.push(...countProblem('rows', spec.rows, FIGURE_BOUNDS.compare.rows, 'rows'));
  if (problems.some(line => line.startsWith('rows has'))) return problems;
  spec.rows.forEach((row, i) => {
    const path = `rows[${i}]`;
    const shape = keysProblem(path, row, ['subject', 'before', 'after'], ['subject', 'before', 'after']);
    if (shape.length) { problems.push(...shape); return; }
    problems.push(...labelProblem(`${path}.subject`, row.subject));
    if (isLabel(row.subject)) problems.push(...fit(`${path}.subject`, row.subject, SIZE.label, W - 2 * MARGIN, { serif: true }));
    for (const side of ['before', 'after']) {
      problems.push(...labelProblem(`${path}.${side}`, row[side]));
      if (isLabel(row[side])) problems.push(...fit(`${path}.${side}`, row[side], SIZE.label, COMPARE_CELL, { bold: side === 'after' }));
    }
    if (isLabel(row.before) && row.before === row.after) problems.push(`${path} says "${row.before}" before and after; a compare shows what changed`);
  });
  return problems;
}

/**
 * What keeps the kit from drawing in `brand`, one plain sentence each; empty when it can. Every color a label is set in,
 * on what it is set on, must clear the layout check's contrast: the ink on the ground, the accent on the ground and on
 * its own tint behind a changed step.
 */
export function brandProblems(brand) {
  const shape = keysProblem('brand', brand, BRAND_KEYS, BRAND_KEYS);
  if (shape.length) return shape;
  const problems = labelProblem('brand.name', brand.name);
  if (isLabel(brand.name)) problems.push(...fit('brand.name', brand.name, SIZE.label, W - 2 * MARGIN, { bold: true }));
  for (const key of ['ground', 'ink', 'accent']) {
    if (typeof brand[key] !== 'string' || !HEX.test(brand[key])) problems.push(`brand.${key} is a color written #RRGGBB`);
  }
  if (problems.length) return problems;
  const [ground, ink, accent] = [brand.ground, brand.ink, brand.accent].map(parseColour);
  const tint = seenOn(accent, CHANGED_TINT, ground);
  const pairs = [
    [`ink ${brand.ink} on ground ${brand.ground}`, contrastRatio(ink, ground)],
    [`accent ${brand.accent} on ground ${brand.ground}`, contrastRatio(accent, ground)],
    [`accent ${brand.accent} on its own tint behind a changed step`, contrastRatio(accent, tint)]
  ];
  for (const [what, ratio] of pairs) {
    if (ratio < MIN_CONTRAST) problems.push(`${what} is ${Math.floor(ratio * 10) / 10}:1; the kit needs ${MIN_CONTRAST}:1. Choose colors further apart: nothing is tinted to make a brand pass`);
  }
  return problems;
}

/** The states a part is drawn in: those it names, or every state. */
const statesOf = (part, spec) => part.in ?? spec.states ?? [];

function systemProblems(spec) {
  const problems = headerProblems(spec);
  const { nodes: nodeBounds, links: linkBounds, states: stateBounds } = FIGURE_BOUNDS.system;
  if (spec.states !== undefined) {
    problems.push(...countProblem('states', spec.states, stateBounds, 'states, in order'));
    if (Array.isArray(spec.states)) {
      spec.states.forEach((state, i) => problems.push(...labelProblem(`states[${i}]`, state)));
      if (new Set(spec.states).size !== spec.states.length) problems.push('states names each state once');
    }
  }
  problems.push(...countProblem('nodes', spec.nodes, nodeBounds, 'nodes'));
  problems.push(...countProblem('links', spec.links, linkBounds, 'links'));
  if (problems.length) return problems;
  const states = spec.states ?? [];
  const inProblems = (path, part) => {
    if (part.in === undefined) return [];
    if (!states.length) return [`${path}.in names states, and this system has none`];
    if (!Array.isArray(part.in) || part.in.length === 0 || part.in.some(state => !states.includes(state)) || new Set(part.in).size !== part.in.length) {
      return [`${path}.in lists the states it is in, each named as in states`];
    }
    return [];
  };
  const ids = new Set();
  const places = new Set();
  spec.nodes.forEach((node, i) => {
    const path = `nodes[${i}]`;
    const shape = keysProblem(path, node, ['id', 'label', 'at', 'shape', 'in', 'changed'], ['id', 'label', 'at']);
    if (shape.length) return void problems.push(...shape);
    if (typeof node.id !== 'string' || !SYSTEM_ID.test(node.id)) problems.push(`${path}.id is a short lower-case name: letters, digits and hyphens`);
    else if (ids.has(node.id)) problems.push(`${path}.id "${node.id}" is given twice`);
    ids.add(node.id);
    problems.push(...labelProblem(`${path}.label`, node.label));
    const at = node.at;
    if (!Array.isArray(at) || at.length !== 2 || !Number.isInteger(at[0]) || !Number.isInteger(at[1]) || at[0] < 0 || at[0] > 3 || at[1] < 0 || at[1] > 2) {
      problems.push(`${path}.at is [column, row]: a column 0 to 3, left to right, and a row 0 to 2, top to bottom`);
    } else if (places.has(at.join())) problems.push(`${path}.at [${at.join(', ')}] is taken by another node`);
    else places.add(at.join());
    if (node.shape !== undefined && !SYSTEM_SHAPES.includes(node.shape)) problems.push(`${path}.shape is service, queue or store`);
    if (node.changed !== undefined && typeof node.changed !== 'boolean') problems.push(`${path}.changed is true or false`);
    problems.push(...inProblems(path, node));
  });
  if (problems.length) return problems;
  const byId = new Map(spec.nodes.map(node => [node.id, node]));
  spec.links.forEach((link, i) => {
    const path = `links[${i}]`;
    const shape = keysProblem(path, link, ['from', 'to', 'label', 'many', 'in', 'changed'], ['from', 'to']);
    if (shape.length) return void problems.push(...shape);
    if (!byId.has(link.from) || !byId.has(link.to) || link.from === link.to) return void problems.push(`${path} joins two different nodes, each named by its id`);
    if (link.label !== undefined) problems.push(...labelProblem(`${path}.label`, link.label));
    for (const key of ['many', 'changed']) if (link[key] !== undefined && typeof link[key] !== 'boolean') problems.push(`${path}.${key} is true or false`);
    const states = inProblems(path, link);
    problems.push(...states);
    if (!states.length) {
      for (const end of [link.from, link.to]) {
        if (statesOf(link, spec).some(state => !statesOf(byId.get(end), spec).includes(state))) problems.push(`${path} runs in a state where node ${end} is not`);
      }
    }
  });
  spec.links.forEach((link, i) => spec.links.slice(i + 1).forEach((other, k) => {
    if (link.from !== other.from || link.to !== other.to) return;
    const a = statesOf(link, spec);
    const b = statesOf(other, spec);
    if (!a.length || a.some(state => b.includes(state))) problems.push(`links[${i}] and links[${i + k + 1}] join the same nodes in the same state; give each its own states`);
  }));
  if (!states.length && ![...spec.nodes, ...spec.links].some(part => part.changed === true)) {
    problems.push('a system with no states and nothing changed shows no change; mark what changed, or give it two or three states');
  }
  if (problems.length) return problems;
  // Every label measured where it is drawn: each part's in its box, each link's beside it, all in the frame and apart.
  const { count } = systemColumns(spec);
  spec.nodes.forEach((node, i) => problems.push(...fit(`nodes[${i}].label`, node.label, SIZE.label, systemLabelRoom(count), { bold: node.changed === true })));
  if (problems.length) return problems;
  const { nodes, links } = systemLayout(spec);
  links.forEach(({ link, start, end, strands, label }, i) => {
    if (Math.hypot(end[0] - start[0], end[1] - start[1]) < 28) problems.push(`links[${i}] is too short to draw between its nodes; move them apart`);
    for (const [id, other] of nodes) {
      if (id !== link.from && id !== link.to && strands.some(([p, q]) => crosses(p, q, grown(other.box, 4)))) problems.push(`links[${i}] runs through node ${id}; move the nodes so it goes around`);
    }
    if (label && !label.clean) problems.push(`links[${i}].label "${link.label}" has no place beside its link clear of the frame's edge, the nodes, the other links and labels; shorten it or move the nodes`);
  });
  if (states.length) {
    const across = states.reduce((sum, state, i) => sum + width(state, SIZE.label, { bold: i === states.length - 1 }), 0) + (states.length - 1) * SYSTEM_LEGEND_GAP;
    if (across > W - 2 * MARGIN) problems.push(`the states read ${Math.round(across)} units across in the legend, and ${W - 2 * MARGIN} fit; shorten their names`);
  }
  return problems;
}

const CHECKS = { bars: barsProblems, flow: flowProblems, columns: columnsProblems, stack: stackProblems, list: listProblems, compare: compareProblems, system: systemProblems };

/** What keeps the kit from drawing `spec`, one plain sentence each; empty when it can. */
export function figureProblems(spec) {
  if (!isObject(spec) || !FIGURE_KINDS.includes(spec.kind)) return [`kind is one of ${FIGURE_KINDS.join(', ')}`];
  const extra = Object.keys(spec).filter(key => !KEYS[spec.kind].includes(key));
  if (extra.length) return [`a ${spec.kind} takes ${KEYS[spec.kind].join(', ')}; not ${extra.join(', ')}`];
  return CHECKS[spec.kind](spec);
}

// ─── drawing ───────────────────────────────────────────────────────────

const number = value => String(Math.round(value * 100) / 100);
const escape = value => String(value).replace(/[&<>"]/gu, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[character]));

function text(x, y, value, { size = SIZE.label, family = SANS, fill, opacity = 1, anchor = 'start', weight = 400, italic = false, nums = false }) {
  return `<text x="${number(x)}" y="${number(y)}" font-family="${family}" font-size="${size}" fill="${fill}"${opacity < 1 ? ` fill-opacity="${opacity}"` : ''} text-anchor="${anchor}"${weight !== 400 ? ` font-weight="${weight}"` : ''}${italic ? ' font-style="italic"' : ''}${nums ? ' font-variant-numeric="tabular-nums"' : ''}>${escape(value)}</text>`;
}

function hair(x1, y1, x2, y2, ink, opacity = 0.35, strokeWidth = 1.5) {
  return `<line x1="${number(x1)}" y1="${number(y1)}" x2="${number(x2)}" y2="${number(y2)}" stroke="${ink}" stroke-opacity="${opacity}" stroke-width="${strokeWidth}" stroke-linecap="round"/>`;
}

function header(spec, t, { note = false } = {}) {
  return (spec.title === undefined ? '' : text(MARGIN, 70, spec.title, { size: SIZE.title, family: SERIF, fill: t.text }))
    + (note && spec.note !== undefined ? text(MARGIN, 108, spec.note, { fill: t.text, opacity: t.soft(0.6) }) : '');
}

function bars(spec, t) {
  const { barW, gap, total, x0 } = barGeometry(spec.items.length);
  const scale = BAR_HEIGHT / spec.max;
  let body = header(spec, t, { note: true });
  spec.items.forEach((item, i) => {
    const x = x0 + i * (barW + gap);
    const h = item.value * scale;
    const y = BAR_BASE - h;
    body += `<rect x="${number(x)}" y="${number(y)}" width="${barW}" height="${number(h)}" rx="3" fill="${item.changed ? t.accent : t.text}"${item.changed ? '' : ' fill-opacity="0.34"'}/>`;
    body += text(x + barW / 2, y - 16, String(item.value), { size: SIZE.value, anchor: 'middle', weight: 600, fill: item.changed ? t.accent : t.text, opacity: item.changed ? 1 : t.soft(0.75), nums: true });
    body += text(x + barW / 2, BAR_BASE + 42, item.label, { anchor: 'middle', fill: t.text, opacity: t.soft(0.7) });
  });
  return body + hair(x0 - 34, BAR_BASE, x0 + total + 34, BAR_BASE, t.text);
}

function flow(spec, t) {
  const { nodeH, gap, x } = flowGeometry(spec.steps.length);
  const ys = spec.steps.map((_, i) => FLOW_TOP + i * (nodeH + gap));
  let body = header(spec, t);
  spec.steps.forEach((step, i) => {
    const y = ys[i];
    const changed = step === spec.changed;
    const cy = y + nodeH / 2;
    body += `<rect x="${number(x)}" y="${number(y)}" width="${FLOW_NODE_WIDTH}" height="${nodeH}" rx="${nodeH / 2}" fill="${changed ? t.accent : 'none'}"${changed ? ` fill-opacity="${CHANGED_TINT}"` : ''} stroke="${changed ? t.accent : t.text}" stroke-opacity="${changed ? 1 : 0.35}" stroke-width="${changed ? 2.5 : 1.5}"/>`;
    body += text(W / 2, cy + 9, step, { anchor: 'middle', fill: changed ? t.accent : t.text, weight: changed ? 600 : 400 });
    if (i < spec.steps.length - 1) {
      const a = y + nodeH + 4;
      const b = ys[i + 1] - 4;
      body += hair(W / 2, a, W / 2, b, t.text, 0.55)
        + `<path d="M${number(W / 2 - 7)} ${number(b - 8)} L${number(W / 2)} ${number(b)} L${number(W / 2 + 7)} ${number(b - 8)}" fill="none" stroke="${t.text}" stroke-opacity="0.55" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`;
    }
  });
  if (spec.loop !== undefined) {
    const y1 = ys[spec.steps.indexOf(spec.loop.from)] + nodeH / 2;
    const y2 = ys[spec.steps.indexOf(spec.loop.to)] + nodeH / 2;
    const xr = x + FLOW_NODE_WIDTH;
    body += `<path d="M${number(xr + 4)} ${number(y1)} C${number(xr + 78)} ${number(y1)} ${number(xr + 78)} ${number(y2)} ${number(xr + 10)} ${number(y2)}" fill="none" stroke="${t.accent}" stroke-width="1.5" stroke-dasharray="5 5"/>`;
    const toward = y2 > y1 ? -1 : 1;
    body += `<path d="M${number(xr + 17)} ${number(y2 - 5 * toward)} L${number(xr + 10)} ${number(y2)} L${number(xr + 17)} ${number(y2 + 5 * toward)}" fill="none" stroke="${t.accent}" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`;
    body += text(LOOP_LABEL_X, (y1 + y2) / 2 + 9, spec.loop.label, { family: SERIF, italic: true, fill: t.accent });
  }
  return body;
}

function glyph(kind, cx, cy, t) {
  if (kind === 'eye') return `<circle cx="${number(cx)}" cy="${cy}" r="22" fill="none" stroke="${t.text}" stroke-opacity="0.45" stroke-width="1.5"/><circle cx="${number(cx)}" cy="${cy}" r="8" fill="${t.accent}"/>`;
  if (kind === 'shell') return `<circle cx="${number(cx)}" cy="${cy}" r="22" fill="none" stroke="${t.accent}" stroke-width="2.5" stroke-dasharray="4 3"/><circle cx="${number(cx)}" cy="${cy}" r="13" fill="${t.text}" fill-opacity="0.14"/>`;
  if (kind === 'dot') return `<circle cx="${number(cx)}" cy="${cy}" r="8" fill="${t.accent}"/>`;
  const points = Array.from({ length: 9 }, (_, k) => {
    const angle = (k / 9) * Math.PI * 2 - Math.PI / 2;
    return `${(cx + 25 * Math.cos(angle)).toFixed(1)},${(cy + 25 * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${points}" fill="none" stroke="${t.accent}" stroke-width="2"/>`;
}

function columns(spec, t) {
  const { width: columnWidth, centres } = columnGeometry(spec.columns.length);
  let body = header(spec, t);
  for (let i = 1; i < spec.columns.length; i += 1) {
    const x = COLUMN_SIDE + columnWidth * i;
    body += hair(x, 140, x, 466, t.text, 0.2);
  }
  spec.columns.forEach((column, i) => {
    const cx = centres[i];
    if (column.glyph !== undefined) body += glyph(column.glyph, cx, 168, t);
    body += text(cx, 236, column.name, { size: SIZE.column, family: SERIF, anchor: 'middle', fill: t.text });
    column.items.forEach((item, k) => { body += text(cx, 284 + k * 38, item, { anchor: 'middle', fill: t.text, opacity: t.soft(0.8) }); });
  });
  return body;
}

function stack(spec, t) {
  const ink = t.text;
  const accent = t.accent;
  const rows = stackGeometry(spec.zones);
  let body = header(spec, t);
  body += `<rect x="${STACK_FRAME.x}" y="${STACK_FRAME.y}" width="${STACK_FRAME.width}" height="${STACK_FRAME.height}" rx="26" fill="none" stroke="${ink}" stroke-opacity="0.35" stroke-width="1.5"/>`;
  spec.zones.forEach((zone, i) => {
    const { centre: cy, room } = rows[i];
    const changed = zone.label === spec.changed;
    let from;
    if (zone.shape === 'circle') {
      const r = Math.min(62, room / 2 - 2);
      body += changed
        ? `<circle cx="${STACK_CENTRE}" cy="${number(cy)}" r="${number(r)}" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-width="2.5"/>`
        : `<circle cx="${STACK_CENTRE}" cy="${number(cy)}" r="${number(r)}" fill="${ink}" fill-opacity="0.06" stroke="${ink}" stroke-opacity="0.45" stroke-width="1.5"/>`;
      from = STACK_CENTRE + r + 3;
    } else if (zone.shape === 'lines') {
      body += hair(150, cy - 9, 280, cy - 9, changed ? accent : ink, changed ? 1 : 0.45, 6) + hair(170, cy + 9, 260, cy + 9, changed ? accent : ink, changed ? 1 : 0.45, 6);
      from = 285;
    } else if (zone.shape === 'bar') {
      body += changed
        ? `<rect x="150" y="${number(cy - 15)}" width="168" height="30" rx="15" fill="${accent}" fill-opacity="0.12" stroke="${accent}" stroke-width="2.5"/>`
        : `<rect x="150" y="${number(cy - 15)}" width="168" height="30" rx="15" fill="none" stroke="${ink}" stroke-opacity="0.45" stroke-width="1.5"/>`;
      from = 322;
    } else {
      body += hair(112, cy, 318, cy, changed ? accent : ink, changed ? 1 : 0.35) + [140, 190, 240, 290].map(x => hair(x, cy - 6, x, cy + 6, changed ? accent : ink, changed ? 1 : 0.35)).join('');
      from = 322;
    }
    if (zone.label === spec.dock) body += `<circle cx="${STACK_DOCK_X}" cy="${number(cy)}" r="11" fill="${accent}"/>`;
    body += hair(from + 6, cy, STACK_LEADER_END, cy, changed ? accent : ink, changed ? 1 : 0.3);
    body += text(STACK_LABEL_X, cy + 9, zone.label, { fill: changed ? accent : ink, opacity: changed ? 1 : t.soft(0.8), weight: changed ? 600 : 400 });
  });
  return body;
}

function list(spec, t) {
  const { baselines, detailed } = listGeometry(spec.items);
  const detail = detailed ? detailColumn(spec.items, spec.changed) : null;
  let body = header(spec, t);
  spec.items.forEach((item, i) => {
    const y = baselines[i];
    const changed = item.label === spec.changed;
    body += changed
      ? `<circle cx="${LIST_MARK + 10}" cy="${number(y - 9)}" r="7" fill="${t.accent}"/>`
      : hair(LIST_MARK, y - 9, LIST_MARK + 20, y - 9, t.text);
    body += text(LIST_LABEL_X, y, item.label, { fill: changed ? t.accent : t.text, opacity: changed ? 1 : t.soft(0.8), weight: changed ? 600 : 400 });
    if (item.detail !== undefined) body += text(detail.x, y, item.detail, { fill: changed ? t.accent : t.text, opacity: changed ? 1 : t.soft(0.6) });
  });
  return body;
}

function compare(spec, t) {
  const headers = spec.headers ?? COMPARE_HEADERS;
  let body = header(spec, t);
  body += text(MARGIN, COMPARE_HEADER, headers.before, { fill: t.text, opacity: t.soft(0.6) });
  body += text(COMPARE_AFTER_X, COMPARE_HEADER, headers.after, { fill: t.accent });
  body += hair(MARGIN, COMPARE_RULE, W - MARGIN, COMPARE_RULE, t.text, 0.2);
  compareGeometry(spec.rows.length).forEach(({ subject, cells }, i) => {
    const row = spec.rows[i];
    body += text(MARGIN, subject, row.subject, { family: SERIF, italic: true, fill: t.text, opacity: t.soft(0.6) });
    body += text(MARGIN, cells, row.before, { fill: t.text, opacity: t.soft(0.8) });
    const y = cells - 9;
    body += hair(COMPARE_ARROW.from, y, COMPARE_ARROW.to, y, t.text, 0.55)
      + `<path d="M${COMPARE_ARROW.to - 8} ${number(y - 7)} L${COMPARE_ARROW.to} ${number(y)} L${COMPARE_ARROW.to - 8} ${number(y + 7)}" fill="none" stroke="${t.text}" stroke-opacity="0.55" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`;
    body += text(COMPARE_AFTER_X, cells, row.after, { fill: t.accent, weight: 600 });
  });
  return body;
}

/**
 * A system: its parts, the paths between them and what changed. The still drawing is the last state, with what only an
 * earlier state had drawn dashed. Where SMIL runs, the figure steps through its states in turn, each part showing only
 * while its states last, and dots run along every path (a dot to each strand of a link marked many).
 */
function system(spec, t) {
  const states = spec.states ?? [];
  const last = states.at(-1);
  const { nodes, links } = systemLayout(spec);
  const cycle = number(states.length * SYSTEM_STATE_SECONDS);
  const keyTimes = states.map((_, i) => number(i / states.length)).join(';');
  const step = (attribute, values) => `<animate attributeName="${attribute}" values="${values.join(';')}" keyTimes="${keyTimes}" calcMode="discrete" dur="${cycle}s" repeatCount="indefinite"/>`;
  // A part shown in its own states and faint in the others. In the still drawing, which is the last state, a part
  // that state does without is dashed and a path it does without carries no dot; where SMIL runs, both follow the states.
  const gone = part => part.in !== undefined && !part.in.includes(last);
  const live = part => states.length >= 2 && part.in !== undefined;
  const timeline = part => (live(part) ? step('opacity', states.map(state => (part.in.includes(state) ? 1 : 0.12))) + step('stroke-dasharray', states.map(state => (part.in.includes(state) ? 'none' : '6 6'))) : '');
  const group = part => `<g${gone(part) ? ' stroke-dasharray="6 6"' : ''}>${timeline(part)}`;
  let body = header(spec, t);
  for (const { link, start, end, nx, ny, strands, label } of links) {
    const ink = link.changed ? t.accent : t.text;
    const strength = link.changed ? 1 : 0.6;
    const seconds = link.many ? 1.2 : 1.8;
    let g = group(link);
    strands.forEach(([p, q], k) => {
      // Each strand's dot starts its own share of the way along, so the dots of a link marked many never sit abreast.
      const along = (k + 0.5) / strands.length;
      const at = [p[0] + (q[0] - p[0]) * along, p[1] + (q[1] - p[1]) * along];
      const run = `M${number(p[0] - at[0])} ${number(p[1] - at[1])} L${number(q[0] - at[0])} ${number(q[1] - at[1])}`;
      g += `<line x1="${number(p[0])}" y1="${number(p[1])}" x2="${number(q[0])}" y2="${number(q[1])}" stroke="${ink}" stroke-opacity="${strength}" stroke-width="2" stroke-linecap="round"/>`
        + `<circle cx="${number(at[0])}" cy="${number(at[1])}" r="${link.many ? 4 : SYSTEM_DOT}" fill="${ink}"${gone(link) ? ' opacity="0"' : ''}>`
        + `<animateMotion path="${run}" dur="${seconds}s" begin="${number(-along * seconds)}s" repeatCount="indefinite"/>`
        + (live(link) ? step('opacity', states.map(state => (link.in.includes(state) ? 1 : 0))) : '') + '</circle>';
    });
    // The arrowhead, on the middle strand.
    const length = Math.hypot(end[0] - start[0], end[1] - start[1]);
    const [ux, uy] = [(end[0] - start[0]) / length, (end[1] - start[1]) / length];
    const wing = sign => `${number(end[0] - ux * 11 + nx * sign * 8)} ${number(end[1] - uy * 11 + ny * sign * 8)}`;
    g += `<path d="M${wing(1)} L${number(end[0])} ${number(end[1])} L${wing(-1)}" fill="none" stroke="${ink}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>`;
    if (label) g += text(label.x, label.y, link.label, { anchor: 'middle', italic: true, fill: ink });
    body += `${g}</g>`;
  }
  for (const { node, shape, cx, box, baseline } of nodes.values()) {
    const ink = node.changed ? t.accent : t.text;
    const [x0, y0, x1, y1] = box;
    let g = group(node) + `<rect x="${number(x0)}" y="${number(y0)}" width="${number(x1 - x0)}" height="${number(y1 - y0)}" rx="${SYSTEM_RADIUS[shape]}" ${node.changed ? `fill="${ink}" fill-opacity="${CHANGED_TINT}"` : 'fill="none"'} stroke="${ink}" stroke-opacity="${node.changed ? 1 : 0.6}" stroke-width="2"/>`;
    if (shape === 'store') g += hair(x0 + 6, y0 + SYSTEM_SHELF, x1 - 6, y0 + SYSTEM_SHELF, ink, node.changed ? 1 : 0.6);
    g += text(cx, baseline, node.label, { anchor: 'middle', fill: ink, weight: node.changed ? 600 : 400 });
    body += `${g}</g>`;
  }
  if (!states.length) return body;
  // The states in order along the foot, and a bar under the one showing, stepping along with them where SMIL runs.
  let x = MARGIN;
  const spans = states.map((state, i) => {
    const span = { x, wide: width(state, SIZE.label, { bold: i === states.length - 1 }) };
    x += span.wide + SYSTEM_LEGEND_GAP;
    return span;
  });
  states.forEach((state, i) => {
    body += text(spans[i].x, SYSTEM_LEGEND, state, { fill: t.text, weight: i === states.length - 1 ? 600 : 400 });
    if (i === states.length - 1) return;
    const ax = spans[i].x + spans[i].wide + 15;
    body += hair(ax, SYSTEM_LEGEND - 9, ax + 26, SYSTEM_LEGEND - 9, t.text, 0.55)
      + `<path d="M${number(ax + 19)} ${SYSTEM_LEGEND - 15} L${number(ax + 26)} ${SYSTEM_LEGEND - 9} L${number(ax + 19)} ${SYSTEM_LEGEND - 3}" fill="none" stroke="${t.text}" stroke-opacity="0.55" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round"/>`;
  });
  const shown = spans.at(-1);
  return body + `<rect x="${number(shown.x)}" y="${SYSTEM_LEGEND + 10}" width="${number(shown.wide)}" height="4" rx="2" fill="${t.accent}">`
    + step('x', spans.map(span => number(span.x))) + step('width', spans.map(span => number(span.wide))) + '</rect>';
}

const DRAW = { bars, flow, columns, stack, list, compare, system };

/** The words a figure's <title> says when its spec gives no title: what it shows, from its own labels. */
function describe(spec) {
  if (spec.kind === 'bars') return spec.items.map(item => `${item.label} ${item.value}`).join(', ');
  if (spec.kind === 'flow') return spec.steps.join(', then ');
  if (spec.kind === 'columns') return spec.columns.map(column => `${column.name}: ${column.items.join(', ')}`).join('; ');
  if (spec.kind === 'list') return spec.items.map(item => (item.detail === undefined ? item.label : `${item.label}, ${item.detail}`)).join('; ');
  if (spec.kind === 'compare') return spec.rows.map(row => `${row.subject}: ${row.before}, then ${row.after}`).join('; ');
  if (spec.kind === 'system') {
    const label = new Map(spec.nodes.map(node => [node.id, node.label]));
    return spec.links.map(link => `${label.get(link.from)} to ${label.get(link.to)}${link.in ? ` (${link.in.join(', ')})` : ''}`).join('; ');
  }
  return `bottom to top: ${spec.zones.map(zone => zone.label).join(', ')}`;
}

/**
 * The figure the kit draws for `spec`, in the reading theme `theme` (a jev-palette.js id; cobalt when none or unknown),
 * or in `brand`'s ink and accent on a ground of its own. Throws with figureProblems' or brandProblems' sentences when
 * the kit cannot draw it, and when given both a theme and a brand.
 */
export function renderFigure(spec, { theme, brand } = {}) {
  const problems = figureProblems(spec);
  if (problems.length) throw new Error(`The figure kit cannot draw this ${isObject(spec) && typeof spec.kind === 'string' ? spec.kind : 'figure'}: ${problems.slice(0, 5).join('; ')}`);
  if (brand !== undefined) {
    if (theme !== undefined) throw new Error('The figure kit draws in a theme or a brand, not both');
    const refused = brandProblems(brand);
    if (refused.length) throw new Error(`The figure kit cannot draw in this brand: ${refused.slice(0, 5).join('; ')}`);
  }
  const palette = brand === undefined ? jevPalette(theme) ?? jevPalette(DEFAULT_THEME) : null;
  const t = brand === undefined
    ? { text: palette.text, accent: palette.accent, soft: opacity => opacity }
    : { text: brand.ink, accent: brand.accent, soft: () => 1 };
  const ground = brand === undefined ? ''
    : `<rect width="${W}" height="${H}" fill="${brand.ground}"/>${text(MARGIN, WORDMARK_Y, brand.name, { fill: brand.ink, weight: 600 })}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}"><title>${escape(spec.title ?? describe(spec))}</title>${ground}${DRAW[spec.kind](spec, t)}</svg>`;
}
