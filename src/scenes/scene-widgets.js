/**
 * The widget set of `rise.lib` (docs/plans/LIVE-CURRENT.md §20; the RISE Live design §6): a slider, a draggable point
 * and a step-through, the closed catalog VISION §2.5 asked for, written once and the same in every scene.
 *
 * A scene makes its widgets once and draws each in `frame()` with `draw()`. The worker hands the set the reader's
 * inputs (`dispatch`), already bounded by the host; a widget under a press takes the drag until release, a focused
 * scene's arrows adjust the widget last pointed at (or the first in `focusable` order), and the number keys 1 to 9
 * choose another. A change the reader makes is emitted once, as the reader would say it; a value the scene sets is
 * not the reader's and emits nothing. `describe` is what the host mirrors for assistive technology and for the touch
 * regions: plain data, never a function. Nothing here animates, so reduced motion changes nothing.
 *
 * Plain canvas, no imports but the protocol's data, so the built scene worker stays one file.
 */
import { CONTROL_PATTERN, SCENE_LIMITS } from './scene-protocol.js';

/** What each arrow is: a step back or on, and for a point its direction. */
const ARROWS = Object.freeze({ ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, 1], ArrowDown: [0, -1] });
/** How near a press must be to a point, in CSS pixels. */
const POINT_REACH = 16;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const inside = ([x, y, w, h], px, py) => px >= x && px <= x + w && py >= y && py <= y + h;
/** A number as the reader would read it: to `places` decimals, with no float noise and no "-0". */
const tidy = (value, places) => Number(value.toFixed(places)) + 0;
const placesOf = unit => clamp(Math.max((String(unit).split('.')[1] ?? '').length, Math.ceil(-Math.log10(unit))), 0, 10);

/**
 * @param {object} kit
 * @param {CanvasRenderingContext2D} kit.ctx the scene's own context
 * @param {{width: number, height: number, dpr: number}} kit.size in CSS pixels, and the ratio drawn at
 * @param {object} kit.palette the reading's colours, by name
 * @param {string} [kit.font] the style's label font
 * @param {number} [kit.stroke] the style's stroke width
 * @param {(control: string, value: number|string) => void} [kit.emit] told each change the reader makes
 */
export function createWidgets({ ctx, size, palette, font = '14px sans-serif', stroke = 2, emit = () => {} }) {
  const made = [];
  let order = null;
  let active = null;
  let pointed = null;
  // A key chose the widget: it is ringed until the reader presses again.
  let keyboard = false;
  const px = value => value * size.dpr;

  function add(widget) {
    if (typeof widget.id !== 'string' || !CONTROL_PATTERN.test(widget.id)) {
      throw new TypeError(`A widget's id is 1 to ${SCENE_LIMITS.controlLength} characters of a-z, 0-9 and -`);
    }
    if (made.some(item => item.id === widget.id)) throw new TypeError(`Two widgets are called "${widget.id}"`);
    if (made.length >= SCENE_LIMITS.emitControls) throw new RangeError(`A scene has at most ${SCENE_LIMITS.emitControls} widgets`);
    made.push(widget);
    return widget.api;
  }

  /** Do what the reader asked of a widget, and emit its value once if it changed. */
  function act(widget, change) {
    const before = widget.said();
    change();
    const after = widget.said();
    if (after !== before) emit(widget.id, after);
  }

  const ordered = () => order ?? made;

  // ─── drawing, in device pixels ─────────────────────────────────────

  function text(words, x, y, { align = 'left', baseline = 'alphabetic', color = palette.text } = {}) {
    ctx.save();
    ctx.fillStyle = color;
    ctx.font = font.replace(/(\d+)px/u, (_, n) => `${px(Number(n))}px`);
    ctx.textAlign = align;
    ctx.textBaseline = baseline;
    ctx.fillText(words, px(x), px(y));
    ctx.restore();
  }

  function ring(widget, x, y, radius) {
    if (!keyboard || pointed !== widget) return;
    ctx.save();
    ctx.strokeStyle = palette.text;
    ctx.lineWidth = px(1.5);
    ctx.beginPath();
    ctx.arc(px(x), px(y), px(radius), 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  function knob(x, y) {
    ctx.save();
    ctx.fillStyle = palette.highlight;
    ctx.beginPath();
    ctx.arc(px(x), px(y), px(7), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  // ─── the widgets ───────────────────────────────────────────────────

  /** A horizontal slider at CSS pixels: `.value` is its number, to its step. */
  function slider({ id, x, y, w, min, max, value = min, step = null, label = id } = {}) {
    if (![x, y, w, min, max].every(Number.isFinite) || !(w > 0) || !(min < max)) {
      throw new TypeError('A slider has finite x, y, a width w above 0, and min below max');
    }
    if (step !== null && !(Number.isFinite(step) && step > 0)) throw new TypeError('A slider’s step is a number above 0');
    const unit = step ?? (max - min) / 100;
    const places = placesOf(unit);
    const fit = v => {
      const kept = clamp(v, min, max);
      return step === null ? kept : clamp(Number((min + Math.round((kept - min) / step) * step).toFixed(10)), min, max);
    };
    let current = fit(Number.isFinite(value) ? value : min);
    const at = cx => fit(min + ((cx - x) / w) * (max - min));
    const widget = {
      id, kind: 'slider', label: String(label),
      takes: true,
      said: () => tidy(current, places),
      rect: () => [x - 10, y - 16, w + 20, 32],
      press(cx) { current = at(cx); },
      drag(cx) { current = at(cx); },
      key(dx, dy) { current = fit(current + (dx || dy) * unit); },
      draw() {
        const k = (current - min) / (max - min);
        ctx.save();
        ctx.lineCap = 'round';
        ctx.lineWidth = px(stroke);
        ctx.strokeStyle = palette.muted;
        ctx.beginPath();
        ctx.moveTo(px(x), px(y));
        ctx.lineTo(px(x + w), px(y));
        ctx.stroke();
        ctx.strokeStyle = palette.accent;
        ctx.beginPath();
        ctx.moveTo(px(x), px(y));
        ctx.lineTo(px(x + w * k), px(y));
        ctx.stroke();
        ctx.restore();
        knob(x + w * k, y);
        ring(widget, x + w * k, y, 11);
        text(`${widget.label}  ${widget.said()}`, x, y - 12);
      }
    };
    widget.api = Object.freeze({
      id, kind: 'slider',
      get value() { return current; },
      set value(next) { if (Number.isFinite(next)) current = fit(next); },
      draw: () => widget.draw()
    });
    return add(widget);
  }

  /** A draggable point, in a frame's units (`lib.axes`) or else CSS pixels: `.value` is [x, y]. */
  function point({ id, x, y, draggable = true, label = id, frame = null } = {}) {
    if (![x, y].every(Number.isFinite)) throw new TypeError('A point has a finite x and y');
    const framed = frame !== null && typeof frame?.toX === 'function' && typeof frame?.toY === 'function'
      && [frame.x0, frame.x1, frame.y0, frame.y1].every(Number.isFinite);
    if (frame !== null && !framed) throw new TypeError('A point’s frame is one lib.axes returned');
    const box = framed
      ? { x0: Math.min(frame.x0, frame.x1), x1: Math.max(frame.x0, frame.x1), y0: Math.min(frame.y0, frame.y1), y1: Math.max(frame.y0, frame.y1) }
      : { x0: 0, x1: size.width, y0: 0, y1: size.height };
    const css = (ux, uy) => (framed ? [frame.toX(ux) / size.dpr, frame.toY(uy) / size.dpr] : [ux, uy]);
    const units = (cx, cy) => {
      if (!framed) return [cx, cy];
      const across = (c, a, b, to) => a + ((px(c) - to(a)) / (to(b) - to(a))) * (b - a);
      return [across(cx, frame.x0, frame.x1, frame.toX), across(cy, frame.y0, frame.y1, frame.toY)];
    };
    let at = [clamp(x, box.x0, box.x1), clamp(y, box.y0, box.y1)];
    const place = ([ux, uy]) => { at = [clamp(ux, box.x0, box.x1), clamp(uy, box.y0, box.y1)]; };
    const widget = {
      id, kind: 'point', label: String(label),
      takes: draggable !== false,
      said: () => `${tidy(at[0], 2)}, ${tidy(at[1], 2)}`,
      rect: () => { const [cx, cy] = css(...at); return [cx - POINT_REACH, cy - POINT_REACH, 2 * POINT_REACH, 2 * POINT_REACH]; },
      press(cx, cy) { place(units(cx, cy)); },
      drag(cx, cy) { place(units(cx, cy)); },
      key(dx, dy) { place([at[0] + (dx * (box.x1 - box.x0)) / 50, at[1] + (dy * (box.y1 - box.y0)) / 50]); },
      draw() {
        const [cx, cy] = css(...at);
        knob(cx, cy);
        ring(widget, cx, cy, 11);
        text(widget.label, cx + 12, cy - 10);
      }
    };
    widget.api = Object.freeze({
      id, kind: 'point',
      get value() { return [...at]; },
      set value(next) { if (Array.isArray(next) && next.length === 2 && next.every(Number.isFinite)) place(next); },
      get x() { return at[0]; },
      get y() { return at[1]; },
      draw: () => widget.draw()
    });
    return add(widget);
  }

  /** A step-through: back and on targets either side of its label, or the arrows; `.value` is the index. */
  function step({ id, steps, index = 0, label = id, x = size.width / 2, y = 28 } = {}) {
    const names = Array.isArray(steps) ? steps.map(item => String(item).slice(0, SCENE_LIMITS.valueLength)) : null;
    const count = names ? names.length : steps;
    if (!Number.isInteger(count) || count < 2 || count > SCENE_LIMITS.emitControls) {
      throw new TypeError(`A step-through has 2 to ${SCENE_LIMITS.emitControls} steps: a count, or a list of labels`);
    }
    if (![x, y].every(Number.isFinite)) throw new TypeError('A step-through has a finite x and y');
    let current = clamp(Math.round(Number.isFinite(index) ? index : 0), 0, count - 1);
    const go = by => { current = clamp(current + by, 0, count - 1); };
    const widget = {
      id, kind: 'step', label: String(label),
      takes: true,
      said: () => (names ? names[current] : `${current + 1} / ${count}`),
      rect: () => [x - 120, y - 18, 240, 36],
      press(cx) { if (cx < x - 40) go(-1); else if (cx > x + 40) go(1); },
      drag() {},
      key(dx, dy) { go(dx || dy); },
      draw() {
        text('‹', x - 104, y, { align: 'center', baseline: 'middle', color: current > 0 ? palette.highlight : palette.muted });
        text('›', x + 104, y, { align: 'center', baseline: 'middle', color: current < count - 1 ? palette.highlight : palette.muted });
        text(`${widget.label}: ${widget.said()}`, x, y, { align: 'center', baseline: 'middle' });
        ring(widget, x, y, 22);
      }
    };
    widget.api = Object.freeze({
      id, kind: 'step',
      get value() { return current; },
      set value(next) { if (Number.isFinite(next)) current = clamp(Math.round(next), 0, count - 1); },
      draw: () => widget.draw()
    });
    return add(widget);
  }

  /** The order the number keys choose widgets in, and the first the arrows adjust; those left out follow, as made. */
  function focusable(...apis) {
    const listed = apis.flat().map(api => made.find(widget => widget.api === api)).filter(Boolean);
    order = [...new Set([...listed, ...made])];
  }

  // ─── the worker's side ─────────────────────────────────────────────

  /** One of the reader's inputs, as the worker was given it. */
  function dispatch(event) {
    if (event.type === 'pointerdown') {
      keyboard = false;
      active = [...made].reverse().find(widget => widget.takes && inside(widget.rect(), event.x, event.y)) ?? null;
      if (active) {
        pointed = active;
        const widget = active;
        act(widget, () => widget.press(event.x, event.y));
      }
    } else if (event.type === 'pointermove') {
      if (!active) return;
      if (!event.buttons) { active = null; return; }
      const widget = active;
      act(widget, () => widget.drag(event.x, event.y));
    } else if (event.type === 'pointerup' || event.type === 'pointercancel') {
      active = null;
    } else if (event.type === 'keydown') {
      const takes = ordered().filter(widget => widget.takes);
      if (/^[1-9]$/u.test(event.key)) {
        const chosen = takes[Number(event.key) - 1];
        if (chosen) { pointed = chosen; keyboard = true; }
        return;
      }
      const arrow = ARROWS[event.key];
      const widget = pointed ?? takes[0];
      if (!arrow || !widget) return;
      pointed = widget;
      keyboard = true;
      act(widget, () => widget.key(...arrow));
    }
  }

  /** The widgets as the host mirrors them: id, kind, label, the value as emitted, and the hit region in CSS pixels. */
  function describe() {
    return made.map(widget => ({
      id: widget.id,
      kind: widget.kind,
      label: widget.label.slice(0, SCENE_LIMITS.labelLength),
      value: widget.said(),
      rect: widget.rect().map(n => Math.round(n * 10) / 10)
    }));
  }

  return { slider, point, step, focusable, dispatch, describe, get count() { return made.length; } };
}
