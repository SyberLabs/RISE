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
import { SCENE_LIMITS, TO_HOST, TO_WORKER, knownMessage } from './scene-protocol.js';
import { createSceneLibrary } from './scene-library.js';
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
const PHASES = ['load', 'init', 'frame', 'cue'];

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

  function luma() {
    try {
      sampler ??= new OffscreenCanvas(8, 8).getContext('2d', { willReadFrequently: true });
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
        lib ??= createSceneLibrary({ ctx: rise.ctx, size, theme: rise.theme, reducedMotion: rise.reducedMotion, defaults: data.library });
        return lib;
      },
      done() { post({ type: TO_HOST.done }); }
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
    post({ type: TO_HOST.ready, reportsCompletion: module.reportsCompletion === true });
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
    if (t - lastLuma >= SCENE_LIMITS.lumaEveryMs) {
      lastLuma = t;
      const value = luma();
      if (value !== null) post({ type: TO_HOST.luma, value, t });
    }
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
  }

  async function handle(data) {
    if (!knownMessage(data, TO_WORKER)) return;
    if (data.type === TO_WORKER.init) {
      if (canvas === null) await init(data);
    } else if (data.type === TO_WORKER.frame) frame(data);
    else if (data.type === TO_WORKER.cue) cue(data);
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
