/**
 * The scene runtime: the Chamber's side of one generated scene
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §7, §12–13).
 *
 * It owns the worker's life and the scene's time. Frames are sent on the
 * display's clock only while the reading plays, so scene time stops with the
 * voice; a frame is not sent until the last is answered. A hold the scene is
 * running ends at its ms, or, for a scene that declared `reportsCompletion`,
 * when the scene says done (never sooner than SCENE_LIMITS.earliestDoneMs and
 * never later than maxMs).
 *
 * Everything the worker says is data: a message it does not know is dropped,
 * and one it knows is read field by field. A frame over budget, an error, or
 * silence ends the worker; the host is told once (onFailure) and any open hold
 * runs on its ms. A scene the flash gate stops is frozen instead: its last
 * frame stays and its holds run on their ms.
 */
import {
  CONTROL_PATTERN, EMIT_REFUSALS, SCENE_INPUTS, SCENE_LIMITS, SCENE_LISTENS, SCENE_PROTOCOL_VERSION, SCENE_WIDGETS, TO_HOST, TO_WORKER,
  emitValue, knownMessage, sceneKey
} from './scene-protocol.js';

const MESSAGE_LIMIT = 300;
const PHASES = ['load', 'init', 'frame', 'cue', 'input'];
const MAX_STEP_MS = 100;
/** Inputs waiting behind the pointer's rate, at most; a press or a release is never the one let go. */
const POINTER_QUEUE = 16;
/** Refusal notes one scene may cause, at most: each control and reason once. */
const REFUSAL_NOTES = 16;

const clamp = (value, low, high) => Math.min(high, Math.max(low, value));
const oneLine = text => text.replace(/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/gu, ' ').replace(/\s+/gu, ' ').trim();

/** What a running generated scene takes through the visual-control path: a cue, by name. */
export const SCENE_VISUAL_MANIFEST = Object.freeze({
  surface: 'scene',
  parameters: Object.freeze({ cue: Object.freeze({ type: 'name', cueable: true }) })
});

const wallClock = Object.freeze({
  now: () => performance.now(),
  setTimer: (fn, ms) => { const id = setTimeout(fn, ms); return () => clearTimeout(id); }
});

/**
 * @param {object} options
 * @param {() => Worker | Promise<Worker>} options.createWorker
 * @param {{transferControlToOffscreen: () => OffscreenCanvas}} options.canvas the layer's canvas, given to the worker
 * @param {{now: () => number, setTimer: (fn: Function, ms: number) => Function}} [options.clock] what holds and the silence watch wait on
 * @param {object} [options.theme] the reading's colours
 * @param {boolean} [options.reducedMotion]
 * @param {object} [options.library] the reading's style's library defaults (src/core/styles.js)
 * @param {(diagnostic: {sceneId: string, phase: string, message: string, where: string|null}) => void} [options.onFailure]
 * @param {(value: number, t: number) => void} [options.onLuma] a brightness sample 0..1 at scene time t
 * @param {(kinds: {pointer: boolean, keys: boolean}) => void} [options.onListen] the ready scene listens (docs/plans/LIVE-CURRENT.md §20)
 * @param {(told: {control: string, value: number|boolean|string, label: string|null}) => void} [options.onInput] what the reader set
 * @param {(told: {control: string|null, reason: string}) => void} [options.onInputRefused] an emit dropped, once per control and reason
 * @param {(widgets: object[]) => void} [options.onWidgets] the scene's widgets, read field by field, for the mirror and the touch regions
 */
export function createSceneRuntime({
  createWorker, canvas, clock = wallClock, theme = {}, reducedMotion = false, library = {}, onFailure = () => {}, onLuma = () => {},
  onListen = () => {}, onInput = () => {}, onInputRefused = () => {}, onWidgets = () => {},
  requestFrame = callback => requestAnimationFrame(callback), cancelFrame = id => cancelAnimationFrame(id)
}) {
  let worker = null;
  let sceneId = null;
  let size = { width: 300, height: 150, dpr: 1 };
  let ready = false;
  let reportsCompletion = false;
  let playing = false;
  let failed = false;
  let frozen = false;
  let disposed = false;
  let frameId = null;
  let lastStamp = null;
  let t = 0;
  let pending = false;
  let stopSilence = null;
  let slow = [];
  const queued = [];
  const holds = new Set();
  // What the ready scene listens to (null: nothing, and it is given nothing), and the reader's input on its way in.
  let listening = null;
  let lastInputAt = -Infinity;
  const pointerQueue = [];
  let pointerAt = -Infinity;
  let stopPointer = null;
  let keyAt = -Infinity;
  // What the reader set, on its way out: each control's rate, the controls seen, the refusals noted, the widgets' labels.
  const gates = new Map();
  const controls = new Set();
  const noted = new Set();
  let labels = new Map();

  const post = message => { try { worker?.postMessage(message); } catch { /* a worker that is gone answers nothing, which the silence watch sees */ } };
  const live = () => worker !== null && !failed && !frozen && !disposed;

  /** A frame to the worker, and the watch for its answer. */
  function sendFrame(dt) {
    pending = true;
    post({ type: TO_WORKER.frame, t, dt });
    stopSilence = clock.setTimer(() => fail('frame', 'The scene stopped answering'), SCENE_LIMITS.silenceMs);
  }

  /** One input to the worker. While paused, the scene draws it at once, at the same scene time. */
  function deliver(message) {
    post(message);
    lastInputAt = clock.now();
    if (!playing && !pending && live()) sendFrame(0);
  }

  function pumpPointer() {
    if (stopPointer || pointerQueue.length === 0) return;
    const wait = pointerAt + 1000 / SCENE_LIMITS.inputPointerPerSecond - clock.now();
    if (wait > 0) {
      stopPointer = clock.setTimer(() => { stopPointer = null; pumpPointer(); }, wait);
      return;
    }
    pointerAt = clock.now();
    deliver(pointerQueue.shift());
    pumpPointer();
  }

  function queuePointer(message) {
    if (message.kind === 'pointermove' && pointerQueue.at(-1)?.kind === 'pointermove') pointerQueue[pointerQueue.length - 1] = message;
    else pointerQueue.push(message);
    if (pointerQueue.length > POINTER_QUEUE) {
      const move = pointerQueue.findIndex(item => item.kind === 'pointermove');
      pointerQueue.splice(move < 0 ? 0 : move, 1);
    }
    pumpPointer();
  }

  /** An emit dropped: told once per control and reason, at most REFUSAL_NOTES a scene. */
  function refuse(control, reason) {
    const key = `${control}|${reason}`;
    if (noted.has(key) || noted.size >= REFUSAL_NOTES) return;
    noted.add(key);
    onInputRefused({ control, reason });
  }

  const tell = (control, value) => onInput({ control, value, label: labels.get(control) ?? null });

  /** At most emitPerSecond a control; inside the gap the latest value waits, and is told when the gap ends. */
  function gate(control, value) {
    const held = gates.get(control) ?? { at: -Infinity, value: undefined, stop: null };
    gates.set(control, held);
    const now = clock.now();
    const every = 1000 / SCENE_LIMITS.emitPerSecond;
    if (!held.stop && now - held.at >= every) {
      held.at = now;
      tell(control, value);
      return;
    }
    held.value = value;
    held.stop ??= clock.setTimer(() => { held.stop = null; held.at = clock.now(); tell(control, held.value); }, Math.max(0, held.at + every - now));
  }

  /** The values still waiting are the reader's: told now, as the scene goes. */
  function settleEmits() {
    for (const [control, held] of gates) {
      if (!held.stop) continue;
      held.stop();
      held.stop = null;
      tell(control, held.value);
    }
    stopPointer?.();
    stopPointer = null;
  }

  /** What the worker says the reader set, read again as untrusted. */
  function emitted({ changes, refused }) {
    if (Array.isArray(refused)) {
      for (const item of refused.slice(0, REFUSAL_NOTES)) {
        if (!Array.isArray(item) || !EMIT_REFUSALS.includes(item[1])) continue;
        refuse(typeof item[0] === 'string' && CONTROL_PATTERN.test(item[0]) ? item[0] : null, item[1]);
      }
    }
    if (!Array.isArray(changes)) return;
    const prompted = clock.now() - lastInputAt <= SCENE_LIMITS.emitAfterInputMs;
    for (const item of changes.slice(0, SCENE_LIMITS.emitControls)) {
      if (!Array.isArray(item)) continue;
      const [control, value] = item;
      if (typeof control !== 'string' || !CONTROL_PATTERN.test(control)) { refuse(null, 'control'); continue; }
      if (!emitValue(value)) { refuse(control, 'value'); continue; }
      if (!prompted) { refuse(control, 'unprompted'); continue; }
      if (!controls.has(control)) {
        if (controls.size >= SCENE_LIMITS.emitControls) { refuse(control, 'controls'); continue; }
        controls.add(control);
      }
      gate(control, value);
    }
  }

  /** One widget as the worker described it, or null: its region clamped to the canvas, its label one short line. */
  function readWidget(item) {
    if (!item || typeof item !== 'object') return null;
    const { id, kind, label, value, rect } = item;
    if (typeof id !== 'string' || !CONTROL_PATTERN.test(id) || !SCENE_WIDGETS.includes(kind) || !emitValue(value)) return null;
    if (!Array.isArray(rect) || rect.length !== 4 || !rect.every(Number.isFinite)) return null;
    const [x, y, w, h] = rect;
    const [x0, y0] = [clamp(x, 0, size.width), clamp(y, 0, size.height)];
    const [x1, y1] = [clamp(x + w, 0, size.width), clamp(y + h, 0, size.height)];
    const said = typeof label === 'string' ? oneLine(label).slice(0, SCENE_LIMITS.labelLength) : '';
    return { id, kind, label: said || id, value, rect: [x0, y0, x1 - x0, y1 - y0] };
  }

  function mirrored(widgets) {
    if (!Array.isArray(widgets)) return;
    const list = widgets.slice(0, SCENE_LIMITS.emitControls).map(readWidget).filter(Boolean);
    labels = new Map(list.map(widget => [widget.id, widget.label]));
    onWidgets(list);
  }

  function stopFrames() {
    if (frameId !== null) cancelFrame(frameId);
    frameId = null;
    lastStamp = null;
  }

  function loop() {
    if (frameId === null && playing && ready && live()) frameId = requestFrame(tick);
  }

  function tick(stamp) {
    frameId = null;
    if (!playing || !ready || !live()) return;
    if (!pending) {
      const dt = lastStamp === null ? 0 : Math.min(MAX_STEP_MS, Math.max(0, stamp - lastStamp));
      lastStamp = stamp;
      t += dt;
      sendFrame(dt);
    }
    loop();
  }

  /** Every open hold runs on its ms from where it began, the scene no longer deciding. */
  function holdsOnMs() {
    for (const hold of holds) hold.toMs();
  }

  function fail(phase, message, where = null) {
    if (failed || disposed) return;
    failed = true;
    stopFrames();
    stopSilence?.();
    try { worker?.terminate(); } catch { /* already gone */ }
    holdsOnMs();
    settleEmits();
    onFailure({ sceneId, phase, message: String(message).slice(0, MESSAGE_LIMIT), where });
  }

  function answered(data) {
    if (!Number.isFinite(data.t) || !Number.isFinite(data.ms)) return;
    pending = false;
    stopSilence?.();
    stopSilence = null;
    if (data.ms > SCENE_LIMITS.frameHardMs) {
      fail('frame', `A frame took ${Math.round(data.ms)} ms`);
      return;
    }
    if (data.ms > SCENE_LIMITS.frameSoftMs) {
      slow = [...slow.filter(at => data.t - at < 1000), data.t];
      if (slow.length >= SCENE_LIMITS.frameSoftCount) fail('frame', `The scene drew too slowly: ${slow.length} frames over ${SCENE_LIMITS.frameSoftMs} ms in one second`);
    }
  }

  function receive(data) {
    if (!knownMessage(data, TO_HOST) || failed || disposed) return;
    switch (data.type) {
      case TO_HOST.ready:
        if (ready) return;
        ready = true;
        reportsCompletion = data.reportsCompletion === true;
        if (Array.isArray(data.listens) && SCENE_LISTENS.some(kind => data.listens.includes(kind))) {
          listening = new Set(SCENE_LISTENS.filter(kind => data.listens.includes(kind)));
          onListen({ pointer: listening.has('pointer'), keys: listening.has('keys') });
        }
        for (const message of queued.splice(0)) post(message);
        loop();
        return;
      case TO_HOST.emit:
        emitted(data);
        return;
      case TO_HOST.widgets:
        if (listening) mirrored(data.widgets);
        return;
      case TO_HOST.frameDone:
        answered(data);
        return;
      case TO_HOST.done:
        if (reportsCompletion && !frozen) for (const hold of holds) hold.done();
        return;
      case TO_HOST.luma:
        if (!frozen && Number.isFinite(data.value) && data.value >= 0 && data.value <= 1 && Number.isFinite(data.t)) onLuma(data.value, data.t);
        return;
      case TO_HOST.error:
        fail(PHASES.includes(data.phase) ? data.phase : 'frame',
          typeof data.message === 'string' && data.message ? data.message : 'The scene failed',
          typeof data.where === 'string' ? data.where.slice(0, 120) : null);
        return;
      default:
    }
  }

  return {
    /** Make the worker, give it the canvas and the code. */
    async start(scene) {
      sceneId = scene.id;
      let made;
      try {
        made = await createWorker();
      } catch (error) {
        if (!disposed) fail('load', `The scene could not start: ${error?.message ?? error}`);
        return;
      }
      if (disposed) { try { made.terminate(); } catch { /* never started */ } return; }
      worker = made;
      worker.onmessage = event => receive(event.data);
      worker.onerror = () => fail('load', 'The scene could not run');
      try {
        const offscreen = canvas.transferControlToOffscreen();
        worker.postMessage({
          type: TO_WORKER.init, version: SCENE_PROTOCOL_VERSION, code: scene.code, ...size, theme, reducedMotion, library, canvas: offscreen
        }, [offscreen]);
      } catch (error) {
        fail('load', `The scene could not start: ${error?.message ?? error}`);
      }
    },

    play() { playing = true; loop(); },

    pause() { playing = false; stopFrames(); },

    /**
     * One of the reader's inputs (the scene layer's plain object, never the DOM event), to a ready scene that listens to
     * its kind: rebuilt from its own numbers, the pointer clamped to the canvas, at the rates SCENE_LIMITS sets.
     */
    input(event) {
      if (!listening || !ready || !live()) return;
      const kind = event?.type;
      const family = typeof kind === 'string' && Object.hasOwn(SCENE_INPUTS, kind) ? SCENE_INPUTS[kind] : null;
      if (!family || !listening.has(family)) return;
      const held = event.modifiers ?? {};
      const modifiers = { shift: held.shift === true, alt: held.alt === true, ctrl: held.ctrl === true, meta: held.meta === true };
      if (family === 'keys') {
        const now = clock.now();
        if (!sceneKey(event.key) || now - keyAt < 1000 / SCENE_LIMITS.inputKeysPerSecond) return;
        keyAt = now;
        deliver({ type: TO_WORKER.input, kind, x: null, y: null, buttons: 0, key: event.key, modifiers });
        return;
      }
      if (!Number.isFinite(event.x) || !Number.isFinite(event.y)) return;
      queuePointer({
        type: TO_WORKER.input, kind,
        x: clamp(event.x, 0, size.width), y: clamp(event.y, 0, size.height),
        buttons: Number.isInteger(event.buttons) ? clamp(event.buttons, 0, 31) : 0,
        key: null, modifiers
      });
    },

    cue(name, { instant = false } = {}) {
      if (failed || disposed) return;
      const message = { type: TO_WORKER.cue, name, instant: instant === true };
      if (ready) post(message);
      else queued.push(message);
    },

    resize(width, height, dpr = 1) {
      if (![width, height, dpr].every(Number.isFinite)) return;
      size = { width, height, dpr: Math.min(SCENE_LIMITS.maxDpr, Math.max(1, dpr)) };
      if (worker && live()) post({ type: TO_WORKER.resize, ...size });
    },

    /** A hold of this scene: resolved { reason: 'ended' } by its ms, the scene's done, or its maxMs. */
    hold({ ms, maxMs }) {
      return new Promise(resolve => {
        const began = clock.now();
        let cancel = null;
        const hold = {
          end() { cancel?.(); holds.delete(hold); resolve({ reason: 'ended' }); },
          at(due) { cancel?.(); cancel = clock.setTimer(() => hold.end(), Math.max(0, began + due - clock.now())); },
          toMs() { hold.at(ms); },
          done() { hold.at(Math.min(Math.max(clock.now() - began, SCENE_LIMITS.earliestDoneMs), maxMs ?? ms)); }
        };
        holds.add(hold);
        if (reportsCompletion && live()) hold.at(maxMs ?? ms);
        else hold.toMs();
      });
    },

    /** Stop drawing and keep the last frame: what the flash gate asks for. */
    freeze() {
      if (frozen) return;
      frozen = true;
      stopFrames();
      holdsOnMs();
    },

    dispose() {
      if (disposed) return;
      stopFrames();
      stopSilence?.();
      post({ type: TO_WORKER.dispose });
      try { worker?.terminate(); } catch { /* already gone */ }
      disposed = true;
      holdsOnMs();
      settleEmits();
    }
  };
}

/**
 * Turn a scene's brightness samples into flashes for a VisualFlashGate: a
 * flash is a pair of opposing changes of at least a tenth of full brightness
 * where the darker state is below 0.8 (the general flash threshold). Returns
 * a function of (value, t) that is true once the gate refuses a flash.
 */
export function createFlashWatch(gate) {
  let last = null;
  let open = 0;
  return (value, t) => {
    const previous = last;
    last = value;
    if (previous === null) return false;
    const change = value - previous;
    if (Math.abs(change) < 0.1 || Math.min(value, previous) >= 0.8) return false;
    const direction = Math.sign(change);
    if (open === -direction) {
      open = 0;
      if (!gate.canAllow(t)) return true;
      gate.commit(t);
    } else {
      open = direction;
    }
    return false;
  };
}
