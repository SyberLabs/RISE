/**
 * A figure's labels as a phone shows them, judged without a DOM (docs/plans/RISE-CHANGES.md, Quality gates). The
 * figure is read by the tokenizer that admits it (svgTree, svg-admission.js), so a figure admission refuses is not
 * judged here. Pure and deterministic: the same text gives the same answer, and nothing is drawn or measured.
 *
 * Each label is a box estimated from its x, y, dx, dy, font-size (16 when none is set), font-weight, text-anchor,
 * dominant-baseline and textLength, under every ancestor translate and scale:
 *   width   Helvetica's advance for each character (Arial's are the same), 0.56 em for one outside that table, 0.6 em
 *           in a monospace family, and 8% wider when bold. A flat 0.56 em per character was tried first and wrongly
 *           refused two published labels ("validators", "Refused: keeps the scene before"), narrow letters both.
 *   height  0.8 em above the baseline and 0.2 em below it, the em box, moved for a middle, central, hanging or
 *           text-top baseline.
 * A shape is held by what it draws: a rect, circle or ellipse by its bounding box, whose edge a label may not
 * straddle; a line, polyline, polygon or path by its segments (curves as eight chords each), which a label may not
 * touch, so the empty corner of a connector's bounding box is not mistaken for ink. A stroke widens both by half its
 * width, and a label keeps 0.05 em clear of it, the estimate's own margin on a short word.
 *
 * What it cannot place it does not guess: text or a shape under any other transform, a figure with a <style> sheet, a
 * path with an arc, a <use>, a <textPath>, a nested <svg> and a length in units it cannot resolve are skipped, each
 * with a note saying so. The rendered check (scripts/changes/render-check.mjs) measures what this one estimates.
 */
import { svgTree } from '../svg-admission.js';

/** The room a digest's figure is seen in: a phone's width, its near-black ground, and the words' ink for currentColor. */
export const ROOM = Object.freeze({ width: 390, ground: '#0a0a0f', ink: '#eef0ff' });
export const MIN_PIXELS = 12;
const MIN_CONTRAST = 4.5;
export const LAYOUT_RULES = Object.freeze(['text-overlap', 'text-crosses-shape', 'text-outside', 'text-too-small', 'text-low-contrast']);

const MAX_PROBLEMS = 10;
const ASCENT = 0.8;
const DESCENT = 0.2;
const FALLBACK_EM = 0.56;
const MONO_EM = 0.6;
const BOLD = 1.08;
const CURVE_CHORDS = 8;
const CLEARANCE_EM = 0.05;
const EPSILON = 0.01;
const LABEL = 40;

/** Helvetica's advance widths, per 1,000 units of the em, for the characters a label is made of. */
const ADVANCE = new Map(Object.entries({
  ' ': 278, '!': 278, '"': 355, '#': 556, $: 556, '%': 889, '&': 667, "'": 191, '(': 333, ')': 333, '*': 389, '+': 584,
  ',': 278, '-': 333, '.': 278, '/': 278, ':': 278, ';': 278, '<': 584, '=': 584, '>': 584, '?': 556, '@': 1015,
  '[': 278, '\\': 278, ']': 278, '^': 469, _: 556, '`': 333, '{': 334, '|': 260, '}': 334, '~': 584,
  A: 667, B: 667, C: 722, D: 722, E: 667, F: 611, G: 778, H: 722, I: 278, J: 500, K: 667, L: 556, M: 833, N: 722,
  O: 778, P: 667, Q: 778, R: 722, S: 667, T: 611, U: 722, V: 667, W: 944, X: 667, Y: 667, Z: 611,
  a: 556, b: 556, c: 500, d: 556, e: 556, f: 278, g: 556, h: 556, i: 222, j: 222, k: 500, l: 222, m: 833, n: 556,
  o: 556, p: 556, q: 556, r: 333, s: 500, t: 278, u: 556, v: 500, w: 722, x: 500, y: 500, z: 500,
  '‘': 222, '’': 222, '“': 333, '”': 333, '–': 556, '—': 1000, '…': 1000, '×': 584, '·': 278
}));
for (const digit of '0123456789') ADVANCE.set(digit, 556);

/** A label's natural width in em: Helvetica's advance per character, 0.56 em for one it has no width for. */
export function textAdvance(text) {
  let em = 0;
  for (const character of text) em += (ADVANCE.get(character) ?? FALLBACK_EM * 1000) / 1000;
  return em;
}

/** Elements that draw nothing where they stand: what they hold is drawn only by reference, or never. */
const NOT_DRAWN = new Set(['defs', 'clipPath', 'mask', 'pattern', 'marker', 'symbol', 'title', 'desc', 'linearGradient',
  'radialGradient', 'filter', 'style', 'animate', 'animateTransform', 'animateMotion', 'set', 'mpath']);
const SHAPES = new Set(['rect', 'circle', 'ellipse', 'line', 'polyline', 'polygon', 'path']);
const NOT_MODELLED = { use: 'a <use>', textPath: 'a <textPath>', svg: 'a nested <svg>' };
/** Properties a child takes from its parent when it sets none. */
const INHERITED = ['fill', 'fill-opacity', 'color', 'font-size', 'font-weight', 'font-family', 'text-anchor',
  'dominant-baseline', 'stroke', 'stroke-width', 'letter-spacing', 'visibility'];

const NAMED_COLOURS = {
  black: '#000000', white: '#ffffff', gray: '#808080', grey: '#808080', silver: '#c0c0c0', lightgray: '#d3d3d3',
  lightgrey: '#d3d3d3', darkgray: '#a9a9a9', darkgrey: '#a9a9a9', dimgray: '#696969', dimgrey: '#696969',
  gainsboro: '#dcdcdc', whitesmoke: '#f5f5f5', red: '#ff0000', green: '#008000', blue: '#0000ff', yellow: '#ffff00',
  orange: '#ffa500', gold: '#ffd700', cyan: '#00ffff', aqua: '#00ffff', magenta: '#ff00ff', fuchsia: '#ff00ff',
  purple: '#800080', navy: '#000080', teal: '#008080', lime: '#00ff00', maroon: '#800000', olive: '#808000', pink: '#ffc0cb'
};

const round = value => String(Math.round(value * 10) / 10);
const clipLabel = text => {
  const flat = text.replace(/[\u0000-\u001f\u007f"]/gu, ' ').trim();
  return flat.length <= LABEL ? flat : `${flat.slice(0, LABEL - 1)}…`;
};

/** A number with no unit or px, in user units; null for anything else. */
function plainNumber(value) {
  const match = /^\s*([-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?)(?:px)?\s*$/iu.exec(String(value));
  return match ? Number(match[1]) : null;
}

/** A coordinate: a number, or a percentage of the viewBox's `extent`; null for anything else. */
function coordinate(value, extent) {
  const percent = /^\s*([-+]?(?:\d+\.?\d*|\.\d+))%\s*$/u.exec(String(value));
  return percent ? (Number(percent[1]) / 100) * extent : plainNumber(value);
}

/** A font-size against its parent's: a number, px, pt, em or a percentage; null for a keyword or another unit. */
function fontSize(value, parent) {
  const match = /^\s*((?:\d+\.?\d*|\.\d+))(px|pt|em|%)?\s*$/iu.exec(String(value));
  if (!match) return null;
  const size = Number(match[1]);
  const unit = (match[2] ?? 'px').toLowerCase();
  return unit === 'px' ? size : unit === 'pt' ? (size * 4) / 3 : unit === 'em' ? size * parent : (size / 100) * parent;
}

/** `style="a: b; c: d"` as a map; the attribute's own value is overridden by it. */
function declarations(style) {
  const map = new Map();
  for (const part of String(style ?? '').split(';')) {
    const colon = part.indexOf(':');
    if (colon > 0) map.set(part.slice(0, colon).trim().toLowerCase(), part.slice(colon + 1).trim());
  }
  return map;
}

/**
 * An axis-aligned transform, `{ a, d, e, f }` (x' = a x + e, y' = d y + f), or null when the list holds anything but
 * translate, scale and an axis-aligned matrix.
 */
function parseTransform(text) {
  let matrix = { a: 1, d: 1, e: 0, f: 0 };
  const list = /\s*([a-zA-Z]+)\s*\(([^)]*)\)\s*,?/gy;
  let match;
  let read = 0;
  while ((match = list.exec(text)) !== null) {
    read = list.lastIndex;
    const args = match[2].trim().split(/[\s,]+/u).filter(Boolean).map(Number);
    if (args.some(Number.isNaN)) return null;
    let own;
    if (match[1] === 'translate' && (args.length === 1 || args.length === 2)) own = { a: 1, d: 1, e: args[0], f: args[1] ?? 0 };
    else if (match[1] === 'scale' && (args.length === 1 || args.length === 2)) own = { a: args[0], d: args[1] ?? args[0], e: 0, f: 0 };
    else if (match[1] === 'matrix' && args.length === 6 && args[1] === 0 && args[2] === 0) own = { a: args[0], d: args[3], e: args[4], f: args[5] };
    else return null;
    matrix = compose(matrix, own);
  }
  return read === text.length || text.slice(read).trim() === '' ? matrix : null;
}

const compose = (outer, inner) => ({ a: outer.a * inner.a, d: outer.d * inner.d, e: outer.a * inner.e + outer.e, f: outer.d * inner.f + outer.f });
const apply = (m, x, y) => [m.a * x + m.e, m.d * y + m.f];
const boxUnder = (m, box) => {
  const [x0, y0] = apply(m, box.x0, box.y0);
  const [x1, y1] = apply(m, box.x1, box.y1);
  return { x0: Math.min(x0, x1), y0: Math.min(y0, y1), x1: Math.max(x0, x1), y1: Math.max(y0, y1) };
};

/** An sRGB colour `{ r, g, b, alpha }` from hex, rgb(), rgba() or a common name; null for anything else. */
function parseColour(value) {
  const text = String(value).trim().toLowerCase();
  const named = NAMED_COLOURS[text];
  if (named) return parseColour(named);
  const hex = /^#([0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/u.exec(text);
  if (hex) {
    const digits = hex[1].length <= 4 ? [...hex[1]].map(digit => digit + digit).join('') : hex[1];
    const at = index => parseInt(digits.slice(index * 2, index * 2 + 2), 16);
    return { r: at(0), g: at(1), b: at(2), alpha: digits.length === 8 ? at(3) / 255 : 1 };
  }
  const rgb = /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*(?:,\s*((?:\d+\.?\d*|\.\d+)))?\s*\)$/u.exec(text);
  if (rgb) return { r: Math.min(255, Number(rgb[1])), g: Math.min(255, Number(rgb[2])), b: Math.min(255, Number(rgb[3])), alpha: rgb[4] === undefined ? 1 : Math.min(1, Number(rgb[4])) };
  return null;
}

const fillOpacity = props => Math.min(1, Math.max(0, plainNumber(props['fill-opacity'] ?? 1) ?? 1));

/** A colour at `alpha` (times its own) laid over `under`, as the eye sees it. */
function seenOn(colour, alpha, under) {
  const a = colour.alpha * alpha;
  return { r: colour.r * a + under.r * (1 - a), g: colour.g * a + under.g * (1 - a), b: colour.b * a + under.b * (1 - a), alpha: 1 };
}

const hexOf = ({ r, g, b }) => `#${[r, g, b].map(part => Math.round(part).toString(16).padStart(2, '0')).join('')}`;

/** WCAG 2's relative luminance of an sRGB colour. */
function luminance({ r, g, b }) {
  const linear = part => {
    const c = part / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * linear(r) + 0.7152 * linear(g) + 0.0722 * linear(b);
}

function contrastRatio(one, other) {
  const [light, dark] = [luminance(one), luminance(other)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

const COMMAND = new Set('MmLlHhVvCcSsQqTtAaZz');

/** The points a path's data draws through, one list per subpath; `{ arc: true }` for an arc, null for data it cannot read. */
function pathPoints(d) {
  const tokens = String(d).match(/[MmLlHhVvCcSsQqTtAaZz]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gu) ?? [];
  const counts = { m: 2, l: 2, h: 1, v: 1, c: 6, s: 4, q: 4, t: 2, a: 7, z: 0 };
  const paths = [];
  let current = null;
  let x = 0;
  let y = 0;
  let start = [0, 0];
  let control = null;
  let command = null;
  let index = 0;
  const curve = (points, order) => {
    const [p0, ...rest] = [[x, y], ...points];
    for (let step = 1; step <= CURVE_CHORDS; step += 1) {
      const t = step / CURVE_CHORDS;
      const u = 1 - t;
      const at = order === 3
        ? [0, 1].map(k => u * u * u * p0[k] + 3 * u * u * t * rest[0][k] + 3 * u * t * t * rest[1][k] + t * t * t * rest[2][k])
        : [0, 1].map(k => u * u * p0[k] + 2 * u * t * rest[0][k] + t * t * rest[1][k]);
      current.push(at);
    }
  };
  while (index < tokens.length) {
    if (COMMAND.has(tokens[index])) command = tokens[index++];
    else if (command === null) return null;
    const lower = command.toLowerCase();
    if (lower === 'a') return { arc: true };
    if (lower === 'z') {
      if (current) current.push([...start]);
      [x, y] = start;
      control = null;
      command = null;
      continue;
    }
    const count = counts[lower];
    if (index + count > tokens.length) return null;
    const args = new Array(count);
    for (let at = 0; at < count; at += 1) {
      args[at] = COMMAND.has(tokens[index + at]) ? NaN : Number(tokens[index + at]);
      if (Number.isNaN(args[at])) return null;
    }
    index += count;
    const relative = command !== command.toUpperCase();
    const point = (px, py) => (relative ? [x + px, y + py] : [px, py]);
    if (lower === 'm') {
      [x, y] = point(args[0], args[1]);
      start = [x, y];
      current = [[x, y]];
      paths.push(current);
      // Pairs after a moveto are linetos.
      command = relative ? 'l' : 'L';
      control = null;
      continue;
    }
    if (current === null) return null;
    if (lower === 'l' || lower === 't') {
      const end = point(args[0], args[1]);
      if (lower === 't') {
        const reflected = control?.order === 2 ? [2 * x - control.point[0], 2 * y - control.point[1]] : [x, y];
        curve([reflected, end], 2);
        control = { order: 2, point: reflected };
      } else {
        current.push(end);
        control = null;
      }
      [x, y] = end;
    } else if (lower === 'h' || lower === 'v') {
      if (lower === 'h') x = relative ? x + args[0] : args[0];
      else y = relative ? y + args[0] : args[0];
      current.push([x, y]);
      control = null;
    } else if (lower === 'c') {
      const points = [point(args[0], args[1]), point(args[2], args[3]), point(args[4], args[5])];
      curve(points, 3);
      control = { order: 3, point: points[1] };
      [x, y] = points[2];
    } else if (lower === 's') {
      const first = control?.order === 3 ? [2 * x - control.point[0], 2 * y - control.point[1]] : [x, y];
      const points = [first, point(args[0], args[1]), point(args[2], args[3])];
      curve(points, 3);
      control = { order: 3, point: points[1] };
      [x, y] = points[2];
    } else if (lower === 'q') {
      const points = [point(args[0], args[1]), point(args[2], args[3])];
      curve(points, 2);
      control = { order: 2, point: points[0] };
      [x, y] = points[1];
    }
  }
  return paths;
}

/** Whether the segment from p to q passes through the box (Liang–Barsky). */
function segmentMeetsBox([px, py], [qx, qy], box) {
  let low = 0;
  let high = 1;
  const dx = qx - px;
  const dy = qy - py;
  for (const [p, q] of [[-dx, px - box.x0], [dx, box.x1 - px], [-dy, py - box.y0], [dy, box.y1 - py]]) {
    if (p === 0) {
      if (q < 0) return false;
    } else {
      const r = q / p;
      if (p < 0) low = Math.max(low, r);
      else high = Math.min(high, r);
      if (low > high) return false;
    }
  }
  return true;
}

const grow = (box, by) => ({ x0: box.x0 - by, y0: box.y0 - by, x1: box.x1 + by, y1: box.y1 + by });
const meets = (one, other) => Math.min(one.x1, other.x1) - Math.max(one.x0, other.x0) > EPSILON
  && Math.min(one.y1, other.y1) - Math.max(one.y0, other.y0) > EPSILON;
const within = (inner, outer) => inner.x0 >= outer.x0 - EPSILON && inner.y0 >= outer.y0 - EPSILON
  && inner.x1 <= outer.x1 + EPSILON && inner.y1 <= outer.y1 + EPSILON;

/**
 * What a phone would show wrong in a figure's labels.
 * @param {string} svg an admitted figure
 * @param {{roomWidth?: number, ground?: string, maxWork?: number}} [room] the width it is seen at, in CSS pixels, the
 *   colour behind it, and the most comparisons (each label against each label and each shape's edge or segment) the
 *   caller will spend: reading the figure is linear in its length, comparing it is not
 * @returns {{problems: Array<{rule: string, line: number, message: string}>, notes: string[], work: number}} each
 *   problem a sentence a model can act on, naming the text and where it is; each note something it did not check, and
 *   why; `work` the comparisons the figure takes
 */
export function svgLayoutProblems(svg, { roomWidth = ROOM.width, ground = ROOM.ground, maxWork = Infinity } = {}) {
  const notes = new Set();
  const root = svgTree(svg);
  if (root === null) return { problems: [], notes: ['the figure is not admitted; its layout is not checked'], work: 0 };
  const breaks = [];
  for (let at = svg.indexOf('\n'); at >= 0; at = svg.indexOf('\n', at + 1)) breaks.push(at);
  /** The line an offset is on, counted from one: the line breaks before it, plus one. */
  const lineOf = offset => {
    let low = 0;
    let high = breaks.length;
    while (low < high) {
      const middle = (low + high) >> 1;
      if (breaks[middle] < offset) low = middle + 1;
      else high = middle;
    }
    return low + 1;
  };
  const groundColour = parseColour(ground) ?? parseColour(ROOM.ground);
  const viewBox = String(root.attributes.viewBox ?? '').trim().split(/[\s,]+/u).map(Number);
  if (viewBox.length !== 4 || viewBox.some(Number.isNaN) || viewBox[2] <= 0 || viewBox[3] <= 0) {
    return { problems: [], notes: ['the figure’s viewBox is not four numbers with a positive width and height; its layout is not checked'], work: 0 };
  }
  const [minX, minY, width, height] = viewBox;
  const frame = { x0: minX, y0: minY, x1: minX + width, y1: minY + height };
  const hasSheet = node => node.name === 'style' || node.children.some(child => typeof child !== 'string' && hasSheet(child));
  if (hasSheet(root)) return { problems: [], notes: ['the figure has a <style> sheet, which is not read; its layout is not checked'], work: 0 };

  const labels = [];
  const shapes = [];

  const styles = new Map();
  const styleOf = node => {
    if (!styles.has(node)) styles.set(node, declarations(node.attributes.style));
    return styles.get(node);
  };
  /** An element's own value for a property: its style first, then its attribute. */
  const own = (node, name) => styleOf(node).get(name) ?? node.attributes[name];

  /** The inherited properties of `node` under `parent`'s. */
  function propsOf(node, parent) {
    const props = { ...parent };
    for (const name of INHERITED) {
      const value = own(node, name);
      if (value === undefined || value.trim() === 'inherit') continue;
      if (name === 'font-size') props[name] = fontSize(value, parent[name]);
      else props[name] = value.trim();
    }
    return props;
  }

  function colourOf(value, props) {
    if (/^currentcolor$/iu.test(value)) return parseColour(props.color === undefined || /^currentcolor$/iu.test(props.color) ? ROOM.ink : props.color);
    return parseColour(value);
  }

  function walk(node, props, matrix, opacity) {
    if (own(node, 'display')?.trim() === 'none' || NOT_DRAWN.has(node.name)) return;
    const line = lineOf(node.offset);
    if (NOT_MODELLED[node.name] && node !== root) {
      notes.add(`${NOT_MODELLED[node.name]} on line ${line} is not modelled; what it draws is not checked`);
      return;
    }
    const transform = node.attributes.transform;
    if (styleOf(node).has('transform')) {
      notes.add(`the element on line ${line} has a CSS transform, which is not modelled; what it draws is not checked`);
      return;
    }
    let here = matrix;
    if (transform !== undefined && matrix.unresolved === undefined) {
      const parsed = parseTransform(transform);
      here = parsed === null ? { unresolved: clipLabel(transform) } : compose(matrix, parsed);
    }
    const nextProps = propsOf(node, props);
    const groupOpacity = opacity * (plainNumber(own(node, 'opacity') ?? 1) ?? 1);
    if (node.name === 'text') return void text(node, nextProps, here, groupOpacity, line);
    if (SHAPES.has(node.name)) return void shape(node, nextProps, here, line, groupOpacity);
    for (const child of node.children) if (typeof child !== 'string') walk(child, nextProps, here, groupOpacity);
  }

  function shape(node, props, matrix, line, opacity) {
    if (matrix?.unresolved !== undefined) {
      notes.add(`the <${node.name}> on line ${line} is under a transform other than translate and scale (${matrix.unresolved}); it is not checked against the text`);
      return;
    }
    const filled = node.name !== 'line' && (props.fill ?? 'black').toLowerCase() !== 'none';
    const strokeWidth = plainNumber(props['stroke-width'] ?? 1) ?? 1;
    const stroked = props.stroke !== undefined && props.stroke.toLowerCase() !== 'none' && strokeWidth > 0;
    if (!filled && !stroked) return;
    const scale = Math.sqrt(Math.abs(matrix.a * matrix.d));
    const half = stroked ? (strokeWidth / 2) * scale : 0;
    const a = name => coordinate(node.attributes[name] ?? 0, /x|width|rx/u.test(name) ? width : height);
    if (node.name === 'rect' || node.name === 'circle' || node.name === 'ellipse') {
      const values = node.name === 'rect' ? [a('x'), a('y'), a('width'), a('height')]
        : node.name === 'circle' ? [a('cx'), a('cy'), plainNumber(node.attributes.r ?? 0), 0]
          : [a('cx'), a('cy'), a('rx'), a('ry')];
      if (values.some(value => value === null)) {
        notes.add(`the <${node.name}> on line ${line} has a length in a unit that is not modelled; it is not checked against the text`);
        return;
      }
      const [x, y, w, h] = values;
      const box = node.name === 'rect' ? { x0: x, y0: y, x1: x + w, y1: y + h }
        : node.name === 'circle' ? { x0: x - w, y0: y - w, x1: x + w, y1: y + w }
          : { x0: x - w, y0: y - h, x1: x + w, y1: y + h };
      // A filled rect is the ground of a label drawn wholly on it.
      const fill = node.name === 'rect' && filled ? colourOf(props.fill ?? 'black', props) : null;
      const backdrop = fill && seenOn(fill, opacity * fillOpacity(props), groundColour);
      shapes.push({ name: node.name, line, box: boxUnder(matrix, box), half, where: box, ...(backdrop ? { backdrop } : {}) });
      return;
    }
    let paths;
    if (node.name === 'line') {
      const ends = [a('x1'), a('y1'), a('x2'), a('y2')];
      if (ends.some(value => value === null)) return void notes.add(`the <line> on line ${line} has a length in a unit that is not modelled; it is not checked against the text`);
      paths = [[[ends[0], ends[1]], [ends[2], ends[3]]]];
    } else if (node.name === 'path') {
      const read = pathPoints(node.attributes.d ?? '');
      if (read?.arc) return void notes.add(`the <path> on line ${line} draws an arc, which is not modelled; it is not checked against the text`);
      if (read === null) return void notes.add(`the <path> on line ${line} has data that is not read; it is not checked against the text`);
      paths = read;
    } else {
      const numbers = String(node.attributes.points ?? '').trim().split(/[\s,]+/u).filter(Boolean).map(Number);
      if (numbers.length % 2 || numbers.some(Number.isNaN)) return void notes.add(`the <${node.name}> on line ${line} has points that are not read; it is not checked against the text`);
      const points = [];
      for (let at = 0; at < numbers.length; at += 2) points.push([numbers[at], numbers[at + 1]]);
      if (node.name === 'polygon' && points.length) points.push(points[0]);
      paths = [points];
    }
    shapes.push({ name: node.name, line, half, paths: paths.map(points => points.map(([x, y]) => apply(matrix, x, y))) });
  }

  function text(node, props, matrix, opacity, line) {
    const chunks = [];
    let chunk = null;
    let penX = 0;
    let penY = 0;
    let skipped = null;
    const begin = (x, y, anchor, at) => {
      chunk = { x, y, anchor, line: at, runs: [], gap: 0 };
      chunks.push(chunk);
    };
    const visit = (element, inherited, at) => {
      const elementProps = element === node ? inherited : propsOf(element, inherited);
      if (own(element, 'display')?.trim() === 'none') return;
      const position = name => {
        const value = element.attributes[name];
        if (value === undefined) return undefined;
        if (value.trim().split(/[\s,]+/u).length > 1) { skipped = `a list of positions in ${name}`; return undefined; }
        const resolved = coordinate(value, /x/u.test(name) ? width : height);
        if (resolved === null) skipped = `a length in a unit that is not modelled in ${name}`;
        return resolved ?? undefined;
      };
      const [x, y, dx, dy] = ['x', 'y', 'dx', 'dy'].map(position);
      // A line placed by y alone starts where the text before it ends, which is known only once it is laid out.
      if (x === undefined && y !== undefined && chunk?.runs.some(run => run.text.trim())) skipped = 'a line placed by y without x';
      if (x !== undefined) penX = x;
      if (y !== undefined) penY = y;
      if (dy !== undefined) penY += dy;
      if (x !== undefined || y !== undefined || chunk === null) {
        penX += dx ?? 0;
        begin(penX, penY, elementProps['text-anchor'] ?? 'start', at);
      } else if (dx !== undefined) chunk.gap += dx;
      if (element.attributes.textLength !== undefined) {
        if (element === node) chunk.textLength = plainNumber(element.attributes.textLength);
        else notes.add(`textLength on the <tspan> on line ${at} is not modelled; its natural width is estimated`);
      }
      for (const child of element.children) {
        if (typeof child === 'string') {
          chunk.runs.push({ text: child.replace(/\s+/gu, ' '), props: elementProps, y: penY, gap: chunk.gap });
          chunk.gap = 0;
        } else if (child.name === 'tspan') visit(child, elementProps, lineOf(child.offset));
        else if (NOT_MODELLED[child.name]) skipped = NOT_MODELLED[child.name];
      }
    };
    visit(node, props, line);
    const content = chunks.flatMap(item => item.runs.map(run => run.text)).join('').trim();
    if (!content) return;
    if (skipped) return void notes.add(`the text "${clipLabel(content)}" on line ${line} has ${skipped}, which is not modelled; it is not checked`);
    if (matrix?.unresolved !== undefined) {
      notes.add(`the text "${clipLabel(content)}" on line ${line} is under a transform other than translate and scale (${matrix.unresolved}); it is not checked`);
      return;
    }
    let leading = true;
    for (const item of chunks) {
      // Whitespace collapses across runs, and a text's first and last spaces are not drawn.
      for (const run of item.runs) {
        if (leading) run.text = run.text.trimStart();
        if (run.text) leading = run.text.endsWith(' ');
      }
    }
    const lastRun = chunks.flatMap(item => item.runs).filter(run => run.text).at(-1);
    if (lastRun) lastRun.text = lastRun.text.trimEnd();
    for (const item of chunks) layOut(item, matrix, opacity);
  }

  function layOut(chunk, matrix, opacity) {
    const runs = chunk.runs.filter(run => run.text);
    if (!runs.length) return;
    const words = runs.map(run => run.text).join('');
    for (const run of runs) {
      const size = run.props['font-size'];
      if (size === null || size === undefined) {
        notes.add(`the text "${clipLabel(words)}" on line ${chunk.line} has a font-size that is not modelled; it is not checked`);
        return;
      }
      if (size <= 0 || run.props.visibility === 'hidden' || (run.props.fill ?? 'black').toLowerCase() === 'none') return;
      const family = String(run.props['font-family'] ?? '').toLowerCase();
      const weight = String(run.props['font-weight'] ?? 'normal').toLowerCase();
      const em = /mono|courier/u.test(family) ? [...run.text].length * MONO_EM : textAdvance(run.text);
      const spacing = plainNumber(run.props['letter-spacing'] ?? 0) ?? 0;
      run.width = em * size * (weight === 'bold' || weight === 'bolder' || Number(weight) >= 600 ? BOLD : 1) + spacing * [...run.text].length;
      run.size = size;
    }
    const natural = runs.reduce((sum, run) => sum + run.gap + run.width, 0);
    const total = chunk.textLength ?? natural;
    const stretch = natural > 0 ? total / natural : 1;
    const shift = chunk.anchor === 'middle' ? -total / 2 : chunk.anchor === 'end' ? -total : 0;
    let x = chunk.x + shift;
    let box = null;
    let size = 0;
    for (const run of runs) {
      x += run.gap * stretch;
      const baseline = run.props['dominant-baseline'] ?? 'auto';
      const [above, below] = /^(?:middle|central|mathematical)$/u.test(baseline) ? [0.5, 0.5]
        : /^(?:hanging|text-before-edge|text-top)$/u.test(baseline) ? [0, 1]
          : /^(?:text-after-edge|text-bottom|ideographic)$/u.test(baseline) ? [1, 0] : [ASCENT, DESCENT];
      const piece = { x0: x, x1: x + run.width * stretch, y0: run.y - above * run.size, y1: run.y + below * run.size };
      box = box === null ? piece : { x0: Math.min(box.x0, piece.x0), y0: Math.min(box.y0, piece.y0), x1: Math.max(box.x1, piece.x1), y1: Math.max(box.y1, piece.y1) };
      x = piece.x1;
      size = Math.max(size, run.size);
    }
    const [atX, atY] = apply(matrix, chunk.x, chunk.y);
    labels.push({
      words: clipLabel(words),
      line: chunk.line,
      where: `x ${round(atX)}, y ${round(atY)}`,
      box: boxUnder(matrix, box),
      size,
      scale: Math.abs(matrix.d),
      ink: inkOf(runs[0].props, opacity, words, chunk.line),
      painted: shapes.length
    });
  }

  function inkOf(props, opacity, words, line) {
    const fill = props.fill ?? 'black';
    const colour = colourOf(fill, props);
    if (colour === null) {
      notes.add(`the text "${clipLabel(words)}" on line ${line} is filled with ${clipLabel(fill)}, which is not modelled; its contrast is not checked`);
      return null;
    }
    return { colour, alpha: opacity * fillOpacity(props) };
  }

  walk(root, { 'font-size': 16, color: ROOM.ink }, { a: 1, d: 1, e: 0, f: 0 }, 1);
  const edges = shapes.reduce((sum, shape) => sum + (shape.box ? 1 : shape.paths.reduce((count, points) => count + points.length, 0)), 0);
  const work = labels.length * (labels.length + edges);
  if (work > maxWork) {
    return { problems: [], notes: [`the figure has ${work} comparisons to make, more than the ${maxWork} this check was given; its layout is not checked`], work };
  }

  const problems = [];
  const say = (rule, label, message) => { if (problems.length < MAX_PROBLEMS) problems.push({ rule, line: label.line, message: `the text "${label.words}" at ${label.where} ${message}` }); };
  const where = shape => (shape.where ? ` (x ${round(shape.where.x0)}, y ${round(shape.where.y0)}, ${round(shape.where.x1 - shape.where.x0)} by ${round(shape.where.y1 - shape.where.y0)})` : '');
  labels.forEach((label, index) => {
    if (!within(label.box, frame)) {
      const sides = [label.box.x0 < frame.x0 - EPSILON && 'the left', label.box.x1 > frame.x1 + EPSILON && 'the right',
        label.box.y0 < frame.y0 - EPSILON && 'the top', label.box.y1 > frame.y1 + EPSILON && 'the bottom'].filter(Boolean);
      say('text-outside', label, `runs outside the viewBox (${root.attributes.viewBox.trim()}) on ${sides.join(' and ')}; move it inside, or use fewer words`);
    }
    const pixels = (label.size * label.scale * roomWidth) / width;
    if (pixels < MIN_PIXELS) {
      const least = Math.ceil(((MIN_PIXELS * width) / roomWidth / label.scale) * 10) / 10;
      say('text-too-small', label, `is ${round(pixels)} pixels tall on a phone ${roomWidth} pixels wide; make it at least ${MIN_PIXELS} pixels, a font-size of at least ${least} in this viewBox`);
    }
    if (label.ink) {
      const under = shapes.slice(0, label.painted).findLast(shape => shape.backdrop && within(label.box, shape.box));
      const behind = under?.backdrop ?? groundColour;
      const ratio = contrastRatio(seenOn(label.ink.colour, label.ink.alpha, behind), behind);
      const alpha = label.ink.colour.alpha * label.ink.alpha;
      if (ratio < MIN_CONTRAST) {
        say('text-low-contrast', label, `is ${hexOf(label.ink.colour)}${alpha < 1 ? ` at opacity ${round(alpha)}` : ''} on ${under ? `the <rect> on line ${under.line} (${hexOf(behind)})` : `the room’s ground ${hexOf(behind)}`}, a contrast of ${Math.floor(ratio * 10) / 10}:1; ink it in currentColor or a light colour, at least ${MIN_CONTRAST}:1`);
      }
    }
    const clearance = CLEARANCE_EM * label.size * label.scale;
    for (const shape of shapes) {
      const crosses = shape.box
        ? meets(label.box, grow(shape.box, shape.half + clearance)) && !within(label.box, grow(shape.box, -shape.half - clearance))
        : shape.paths.some(points => points.some((point, at) => at > 0 && segmentMeetsBox(points[at - 1], point, grow(label.box, shape.half + clearance))));
      if (crosses) say('text-crosses-shape', label, `crosses the ${shape.box ? 'edge of the ' : ''}<${shape.name}> on line ${shape.line}${where(shape)}; place the text wholly inside or wholly outside it, or use fewer words`);
    }
    for (const earlier of labels.slice(0, index)) {
      if (meets(label.box, earlier.box)) say('text-overlap', label, `overlaps the text "${earlier.words}" at ${earlier.where}; move one clear of the other, or use fewer words`);
    }
  });
  return { problems, notes: [...notes], work };
}
