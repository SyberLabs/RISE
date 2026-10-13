/**
 * The canvas a generated scene draws on, behind the reading
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §4, §7).
 *
 * DOM only. The canvas is transferred to the scene's worker, after which its
 * pixel size belongs to the worker; this layer only measures the canvas's
 * own box and says so, and the runtime passes the size on. The box is the
 * field's, less any room the page keeps along its edges (a host's bar).
 *
 * A scene that listens (docs/plans/LIVE-CURRENT.md §20) is given the reader's
 * pointer and keys through `listen`, as plain numbers in the canvas's own CSS
 * pixels: never the event, never an element. Keys reach it only while the
 * canvas has the focus, and never the instrument's (scene-protocol.js
 * sceneKey; the stage takes those first). Its widgets are mirrored in a
 * hidden list for assistive technology, and each gets a region over the
 * canvas that holds touch for its drag; everywhere else a swipe still
 * scrolls the page around a card. Until a scene listens, the canvas is
 * hidden, unfocusable and lets every press through, as it always was.
 */
import { sceneKey } from '../../scenes/scene-protocol.js';

let mirrors = 0;

export function mountSceneLayer({ field, insertBehindReading, onResize = () => {} }) {
  const doc = field.ownerDocument ?? document;
  const canvas = doc.createElement('canvas');
  canvas.className = 'chamber-scene';
  canvas.setAttribute('aria-hidden', 'true');
  insertBehindReading(field, canvas);
  let hits = null;
  let mirror = null;
  let forward = null;
  let keys = false;

  /** The region the widgets' touch areas lie in: the canvas's own box, wherever the page put it. */
  function place() {
    Object.assign(hits.style, {
      left: `${canvas.offsetLeft}px`, top: `${canvas.offsetTop}px`, width: `${canvas.clientWidth}px`, height: `${canvas.clientHeight}px`
    });
  }

  const resize = () => {
    const size = { width: canvas.clientWidth, height: canvas.clientHeight };
    onResize(size);
    if (hits) place();
    return size;
  };
  const observer = typeof ResizeObserver === 'function' ? new ResizeObserver(() => resize()) : null;
  observer?.observe(canvas);

  const modifiers = event => ({ shift: event.shiftKey === true, alt: event.altKey === true, ctrl: event.ctrlKey === true, meta: event.metaKey === true });

  /** A press, move or release on the canvas or a widget's region, in the canvas's CSS pixels, however the page scales it. */
  function pointed(event) {
    const box = canvas.getBoundingClientRect();
    // A box with no size has no scale to undo.
    const x = (event.clientX - box.left) * (box.width ? canvas.clientWidth / box.width : 1);
    const y = (event.clientY - box.top) * (box.height ? canvas.clientHeight / box.height : 1);
    forward?.({ type: event.type, x, y, buttons: event.buttons ?? 0, key: null, modifiers: modifiers(event) });
  }

  function capture(node, event) {
    try { node.setPointerCapture?.(event.pointerId); } catch { /* a press with no live pointer has nothing to capture */ }
  }

  function pressRegion(event) {
    // The press is the widget's: no selection, no focus left on the region, the drag captured until release.
    event.preventDefault();
    capture(event.currentTarget, event);
    if (keys) canvas.focus({ preventScroll: true });
    pointed(event);
  }

  return {
    canvas,
    node: canvas,
    resize,

    /** The scene listens: the reader's pointer, keys or both reach `onInput`, and the canvas says it can be used. */
    listen({ pointer = false, keys: listensToKeys = false, onInput }) {
      keys = listensToKeys;
      canvas.dataset.listens = [pointer && 'pointer', keys && 'keys'].filter(Boolean).join(' ');
      mirror = doc.createElement('ul');
      mirrors += 1;
      mirror.id = `chamber-scene-controls-${mirrors}`;
      mirror.className = 'chamber-scene-controls';
      mirror.setAttribute('aria-live', 'off');
      mirror.setAttribute('aria-label', 'What can be moved in the scene');
      canvas.after(mirror);
      if (pointer) {
        forward = onInput;
        canvas.addEventListener('pointerdown', event => capture(canvas, event));
        for (const type of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel']) canvas.addEventListener(type, pointed);
      }
      if (!keys) return;
      canvas.tabIndex = 0;
      canvas.removeAttribute('aria-hidden');
      canvas.setAttribute('role', 'application');
      canvas.setAttribute('aria-roledescription', 'interactive scene');
      canvas.setAttribute('aria-label', 'Interactive scene. The arrow keys move the control chosen; the number keys choose another; Escape returns to the reading controls.');
      canvas.setAttribute('aria-describedby', mirror.id);
      for (const type of ['keydown', 'keyup']) {
        canvas.addEventListener(type, event => {
          if (event.ctrlKey || event.altKey || event.metaKey || !sceneKey(event.key)) return;
          event.preventDefault();
          onInput({ type: event.type, x: null, y: null, buttons: 0, key: event.key, modifiers: modifiers(event) });
        });
      }
    },

    /** The scene's widgets, as its runtime read them: the hidden list, and a touch region over each. */
    widgets(list) {
      if (!mirror) return;
      mirror.replaceChildren(...list.map(({ label, kind, value }) => {
        const item = doc.createElement('li');
        item.textContent = `${label}, ${kind}: ${value}`;
        return item;
      }));
      if (!forward) return;
      if (!hits) {
        hits = doc.createElement('div');
        hits.className = 'chamber-scene-hits';
        mirror.after(hits);
      }
      place();
      hits.replaceChildren(...list.map(({ id, kind, rect: [x, y, w, h] }) => {
        const region = doc.createElement('div');
        region.className = 'chamber-scene-hit';
        region.dataset.control = id;
        region.dataset.kind = kind;
        Object.assign(region.style, { left: `${x}px`, top: `${y}px`, width: `${w}px`, height: `${h}px` });
        region.addEventListener('pointerdown', pressRegion);
        for (const type of ['pointermove', 'pointerup', 'pointercancel']) region.addEventListener(type, pointed);
        return region;
      }));
    },

    destroy() {
      observer?.disconnect();
      forward = null;
      canvas.remove();
      mirror?.remove();
      hits?.remove();
    }
  };
}
