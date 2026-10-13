/**
 * The scene worker: the one place a model's scene code runs
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §7–8, §13).
 *
 * It holds the canvas the Chamber transferred, loads the admitted code as a
 * module from a `blob:` URL, and draws when the host sends a frame. Before
 * the code is loaded every name a scene may not use is replaced on the scope
 * by a stub that throws and cannot be put back, so a bypass of the static
 * admission still fails loudly. Time comes only from `frame` messages.
 *
 * After the build this file must stand alone: in a host's card it is fetched
 * as text and started from a `blob:` URL (create-scene-worker.js), where no
 * other chunk can be imported. It may import only modules Vite inlines.
 */
import {
  CONTROL_PATTERN, SCENE_INPUTS, SCENE_LIMITS, SCENE_LISTENS, TO_HOST, TO_WORKER, emitValue, knownMessage, sceneKey
} from './scene-protocol.js';
import { createSceneLibrary } from './scene-library.js';
import { createWidgets } from './scene-widgets.js';
import { SHADOWED_GLOBALS } from './scene-bans.js';

/** Names a scene may not reach (§8); postMessage too, so a scene cannot speak for the worker. */
export const BANNED_GLOBALS = SHADOWED_GLOBALS;

/**
 * The worker's channel, locked with the banned names once the worker's own listener is attached. The parse
 * admits these names (a local `close` is ordinary), but the scope reaches a scene without being named, as a
 * listener's `this` or `currentTarget`, and through it no listener may be taken, added or dropped.
 */
const CHANNEL_GLOBALS = Object.freeze(['addEventListener', 'removeEventListener', 'onmessage', 'onerror', 'close']);

/** Names locked as a getter and a setter that throw, not as a stub to call. */
const ACCESSED = new Set(['navigator', 'indexedDB', 'caches', 'self', 'globalThis', 'onmessage', 'onerror']);

const MESSAGE_LIMIT = 300;
const PHASES = ['load', 'init', 'frame', 'cue', 'input'];
/** Refusals one emit message carries, at most: the host notes each control and reason once. */
const REFUSALS_A_MESSAGE = 8;

/** The reader's input as the scene sees it, from a message read field by field; null for anything else. */
function readInput(data) {
  const family = Object.hasOwn(SCENE_INPUTS, data.kind) ? SCENE_INPUTS[data.kind] : null;
  const held = data.modifiers;
  if (!family || !held || typeof held !== 'object') return null;
  const modifiers = Object.freeze({ shift: held.shift === true, alt: held.alt === true, ctrl: held.ctrl === true, meta: held.meta === true });
  if (family === 'pointer') {
    if (!Number.isFinite(data.x) || !Number.isFinite(data.y) || !Number.isInteger(data.buttons) || data.buttons < 0 || data.buttons > 31) return null;
    return Object.freeze({ type: data.kind, x: data.x, y: data.y, buttons: data.buttons, key: null, modifiers });
  }
  if (!sceneKey(data.key)) return null;
  return Object.freeze({ type: data.kind, x: null, y: null, buttons: 0, key: data.key, modifiers });
}

/** Where in the scene's own module an error was thrown, as `scene.js:line:column`, or null. */
export function whereIn(error, url) {
  const stack = typeof error?.stack === 'string' ? error.stack : '';
  const line = stack.split('\n').find(item => item.includes(url));
  if (!line) return null;
  const at = /:(\d+):(\d+)\)?\s*$/u.exec(line);
  return at ? `scene.js:${at[1]}:${at[2]}` : 'scene.js';
}

/** Replace every banned name and the channel on the scope; true only if every one was replaced. */
function shadow(scope) {
  let sealed = true;
  for (const name of [...BANNED_GLOBALS, ...CHANNEL_GLOBALS]) {
    const refuse = () => { throw new ReferenceError(`${name} is not available to a scene`); };
    const descriptor = ACCESSED.has(name)
      ? { get: refuse, set: refuse, configurable: false }
      : { value: refuse, writable: false, configurable: false };
    try { Object.defineProperty(scope, name, descriptor); } catch { sealed = false; }
  }
  return sealed;
}

/** The prototypes whose `constructor` is Function, AsyncFunction, GeneratorFunction or AsyncGeneratorFunction. */
export const realmFunctionPrototypes = () => [
  Function.prototype,
  Object.getPrototypeOf(async function () {}),
  Object.getPrototypeOf(function* () {}),
  Object.getPrototypeOf(async function* () {})
];

const sealedPrototypes = new WeakSet();

/**
 * Make `[].constructor.constructor(...)`, `(async () => {}).constructor(...)` and their kin throw: the
 * parse cannot see a route to Function that names nothing. Each prototype's own `constructor` becomes a
 * stub that throws and cannot be put back. Neither the worker nor the scene library reads a function's
 * `.constructor`. Sealing is once per prototype; true only if every one is sealed.
 */
export function sealFunctionConstructors(prototypes) {
  let sealed = true;
  for (const proto of prototypes) {
    if (sealedPrototypes.has(proto)) continue;
    const refuse = () => { throw new ReferenceError('Function is not available to a scene'); };
    try {
      Object.defineProperty(proto, 'constructor', { value: refuse, writable: false, configurable: false });
      sealedPrototypes.add(proto);
    } catch { sealed = false; }
  }
  return sealed;
}

const defaultUrl = code => URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
const defaultLoad = url => import(/* @vite-ignore */ url);

/**
 * Install the scene protocol on a worker scope.
 * @param {object} scope the worker's global scope (a fake in tests)
 * @param {{toUrl?: (code: string) => string, load?: (url: string) => Promise<object>, functionPrototypes?: object[]}} [options]
 * @returns {{handle: (data: unknown) => Promise<void>}}
 */
export function attachSceneWorker(scope, { toUrl = defaultUrl, load = defaultLoad, functionPrototypes = realmFunctionPrototypes() } = {}) {
  const post = scope.postMessage.bind(scope);
  const close = scope.close?.bind(scope);
  let canvas = null;
  let size = null;
  let scene = null;
  let lib = null;
  let url = '';
  let started = false;
  let lastLuma = -Infinity;
  let sampler = null;
  // What the scene listens to (docs/plans/LIVE-CURRENT.md §20): with nothing, it is given nothing and says nothing new.
  const listens = new Set();
  // True only while the scene handles the reader's input: an emit at any other time is not the reader's doing.
  let handling = false;
  const pending = new Map();
  const refusals = new Map();
  const controls = new Set();
  let widgetSet = null;
  let lastWidgets = '';

  const report = (phase, error) => {
    post({
      type: TO_HOST.error,
      phase: PHASES.includes(phase) ? phase : 'frame',
      message: String(error?.name && error?.message ? `${error.name}: ${error.message}` : error?.message ?? error).slice(0, MESSAGE_LIMIT),
      where: whereIn(error, url)
    });
  };

  function fit() {
    canvas.width = Math.round(size.width * size.dpr);
    canvas.height = Math.round(size.height * size.dpr);
  }

  /** A dropped emit, said once a message; the host notes each control and reason once a scene. */
  function refuse(control, reason) {
    const key = `${control}|${reason}`;
    if (refusals.size < REFUSALS_A_MESSAGE && !refusals.has(key)) refusals.set(key, [control, reason]);
  }

  /** What the scene says the reader set: kept, the latest per control, only while it handles their input. */
  function emit(control, value) {
    const named = typeof control === 'string' && CONTROL_PATTERN.test(control);
    if (!handling) return refuse(named ? control : null, 'unprompted');
    if (!named) return refuse(null, 'control');
    if (!emitValue(value)) return refuse(control, 'value');
    if (!controls.has(control)) {
      if (controls.size >= SCENE_LIMITS.emitControls) return refuse(control, 'controls');
      controls.add(control);
    }
    pending.set(control, value);
    return undefined;
  }

  /** After each thing the scene handled: what the reader set, in one message, and its widgets when they changed. */
  function flush() {
    if (pending.size || refusals.size) {
      post({ type: TO_HOST.emit, changes: [...pending], refused: [...refusals.values()] });
      pending.clear();
      refusals.clear();
    }
    if (!listens.size || !widgetSet?.count) return;
    const widgets = widgetSet.describe();
    const said = JSON.stringify(widgets);
    if (said === lastWidgets) return;
    lastWidgets = said;
    post({ type: TO_HOST.widgets, widgets });
  }

  function luma() {
    try {
      // Accelerated, so the picture is shrunk on the GPU and 64 pixels come back. A CPU sampler (willReadFrequently)
      // reads the whole picture back first, and waits behind everything the GPU has queued.
      sampler ??= new OffscreenCanvas(8, 8).getContext('2d');
      sampler.clearRect(0, 0, 8, 8);
      sampler.drawImage(canvas, 0, 0, 8, 8);
      const { data } = sampler.getImageData(0, 0, 8, 8);
      let sum = 0;
      for (let i = 0; i < data.length; i += 4) {
        sum += ((0.2126 * data[i] + 0.7152 * data[i + 1] + 0.0722 * data[i + 2]) * data[i + 3]) / 255;
      }
      return sum / ((data.length / 4) * 255);
    } catch {
      return null;
    }
  }

  async function init(data) {
    canvas = data.canvas;
    size = { width: data.width, height: data.height, dpr: data.dpr };
    fit();
    let mode = null;
    let ctx = null;
    let gl = null;
    const rise = {
      size,
      theme: data.theme ?? {},
      reducedMotion: data.reducedMotion === true,
      // Fonts in workers are out of scope for this stage: labels draw in the system's faces.
      fonts: [],
      get ctx() {
        if (mode === null) { mode = '2d'; ctx = canvas.getContext('2d'); }
        return ctx;
      },
      get gl() { return gl; },
      use(kind) {
        if (kind !== 'webgl2') throw new Error('rise.use takes "webgl2"');
        if (started) throw new Error('rise.use is called before the first frame');
        if (mode === '2d') throw new Error('This scene already draws in 2D');
        if (!gl) {
          gl = canvas.getContext('webgl2');
          if (!gl) throw new Error('WebGL2 is not available here');
          mode = 'webgl2';
        }
        return gl;
      },
      get lib() {
        lib ??= createSceneLibrary({
          ctx: rise.ctx, size, theme: rise.theme, reducedMotion: rise.reducedMotion, defaults: data.library,
          widgets: kit => (widgetSet = createWidgets({ ...kit, emit }))
        });
        return lib;
      },
      done() { post({ type: TO_HOST.done }); },
      /** Says the scene listens to the reader's pointer, keys, or both; before the first frame only. */
      listen(...kinds) {
        if (started) throw new Error('rise.listen is called before the first frame');
        for (const kind of kinds.flat()) {
          if (!SCENE_LISTENS.includes(kind)) throw new TypeError('rise.listen takes "pointer" or "keys"');
          listens.add(kind);
        }
      },
      /** What the reader set, while the scene handles their input: a control id and a number, a boolean or short text. */
      emit(control, value) { emit(control, value); }
    };

    let module;
    try {
      // A name the scope will not let go of stays reachable, so the code is not run at all.
      if (!shadow(scope) || !sealFunctionConstructors(functionPrototypes)) throw new Error('The scene could not be isolated in this browser');
      url = toUrl(String(data.code));
      module = await load(url);
    } catch (error) {
      report('load', error);
      return;
    } finally {
      if (url.startsWith('blob:')) try { URL.revokeObjectURL(url); } catch { /* the module is loaded or failed either way */ }
    }
    let made;
    try {
      if (typeof module?.default !== 'function') throw new TypeError('A scene is an ES module with a default export function');
      made = module.default(rise);
      if (!made || typeof made.frame !== 'function') throw new TypeError('A scene returns { frame(t, dt) } from its default export');
      const declared = module.listens;
      if (Array.isArray(declared) && declared.every(kind => SCENE_LISTENS.includes(kind))) for (const kind of declared) listens.add(kind);
    } catch (error) {
      report('init', error);
      return;
    }
    try {
      started = true;
      made.frame(0, 0);
    } catch (error) {
      report('frame', error);
      return;
    }
    scene = made;
    const heard = SCENE_LISTENS.filter(kind => listens.has(kind));
    post({ type: TO_HOST.ready, reportsCompletion: module.reportsCompletion === true, ...(heard.length ? { listens: heard } : {}) });
    flush();
  }

  /** The reader's input, to a scene that listens to its kind: its widgets first, then its own `input`. */
  function input(data) {
    const event = scene && listens.size ? readInput(data) : null;
    if (!event || !listens.has(SCENE_INPUTS[event.type])) return;
    handling = true;
    try {
      widgetSet?.dispatch(event);
      scene.input?.(event);
    } catch (error) {
      scene = null;
      report('input', error);
      return;
    } finally {
      handling = false;
    }
    flush();
  }

  function frame({ t, dt }) {
    if (!scene || !Number.isFinite(t) || !Number.isFinite(dt)) return;
    const begun = performance.now();
    try {
      lib?.tick(dt);
      scene.frame(t, dt);
    } catch (error) {
      scene = null;
      report('frame', error);
      return;
    }
    post({ type: TO_HOST.frameDone, t, ms: performance.now() - begun });
    // A listening scene's frame with no step is one drawn for the reader's input while paused: sampled too, so a scene
    // cannot flash under a drag where scene time stands still.
    if (t - lastLuma >= SCENE_LIMITS.lumaEveryMs || (listens.size && dt === 0)) {
      lastLuma = t;
      const value = luma();
      if (value !== null) post({ type: TO_HOST.luma, value, t });
    }
    flush();
  }

  function cue({ name, instant }) {
    if (!scene || typeof name !== 'string') return;
    try {
      const result = scene.cue?.(name, { instant: instant === true });
      if (result && typeof result.then === 'function') result.then(undefined, error => report('cue', error));
    } catch (error) {
      report('cue', error);
    }
    post({ type: TO_HOST.cued, name });
    flush();
  }

  async function handle(data) {
    if (!knownMessage(data, TO_WORKER)) return;
    if (data.type === TO_WORKER.init) {
      if (canvas === null) await init(data);
    } else if (data.type === TO_WORKER.frame) frame(data);
    else if (data.type === TO_WORKER.cue) cue(data);
    else if (data.type === TO_WORKER.input) input(data);
    else if (data.type === TO_WORKER.resize) {
      if (!size || ![data.width, data.height, data.dpr].every(Number.isFinite)) return;
      Object.assign(size, { width: data.width, height: data.height, dpr: Math.min(SCENE_LIMITS.maxDpr, data.dpr) });
      fit();
    } else if (data.type === TO_WORKER.dispose) {
      scene = null;
      close?.();
    }
  }

  scope.addEventListener('message', event => { void handle(event.data); });
  return { handle };
}

if (typeof WorkerGlobalScope !== 'undefined' && globalThis instanceof WorkerGlobalScope) attachSceneWorker(globalThis);
