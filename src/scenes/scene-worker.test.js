/**
 * The scene worker: what runs the model's code, and the only thing that does
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §7–8, §13).
 *
 * Tested against a fake worker scope: the listener `attachSceneWorker`
 * installs is driven with the protocol's messages, and what it posts back is
 * read. The model's module is handed in already loaded, since a blob import
 * is the browser's to run (e2e/live-mcp.spec.js runs it).
 */
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { SCENE_LIMITS, TO_HOST, TO_WORKER } from './scene-protocol.js';
import { attachSceneWorker, BANNED_GLOBALS, sealFunctionConstructors, whereIn } from './scene-worker.js';

/** A 2D context that records nothing and answers every call. */
const fakeContext = () => new Proxy({}, { get: (target, key) => (key in target ? target[key] : (target[key] = vi.fn())), set: (target, key, value) => { target[key] = value; return true; } });

function fakeCanvas() {
  const contexts = {};
  return { width: 300, height: 150, contexts, getContext: kind => (contexts[kind] ??= fakeContext()) };
}

/** An 8×8 sampler whose pixels the test sets. */
let samplerPixels;
class FakeOffscreenCanvas {
  constructor(width, height) { this.width = width; this.height = height; }
  getContext() {
    return { clearRect() {}, drawImage() {}, getImageData: () => ({ data: samplerPixels }) };
  }
}
const grey = level => Uint8ClampedArray.from({ length: 64 * 4 }, (_, i) => (i % 4 === 3 ? 255 : level));

function fakeScope() {
  const listeners = [];
  const posted = [];
  const scope = {
    fetch: () => 'network', XMLHttpRequest: class {}, WebSocket: class {}, importScripts: () => {}, indexedDB: {}, caches: {},
    navigator: { userAgent: 'x' }, FontFace: class {}, setTimeout: () => 1, setInterval: () => 1, requestAnimationFrame: () => 1,
    addEventListener: (type, fn) => { if (type === 'message') listeners.push(fn); },
    postMessage: message => posted.push(message),
    close: vi.fn()
  };
  return { scope, posted, listeners };
}

/**
 * A fresh JavaScript realm with its own Function, AsyncFunction and generator
 * prototypes. The worker seals those for good, so a test seals a realm's and
 * never the one vitest itself runs in; `run` evaluates source inside it.
 */
function freshRealm() {
  const context = vm.createContext({});
  const run = source => vm.runInContext(source, context);
  const functionPrototypes = run(`[Function.prototype, Object.getPrototypeOf(async function () {}),
    Object.getPrototypeOf(function* () {}), Object.getPrototypeOf(async function* () {})]`);
  return { run, functionPrototypes };
}

function setup(module, { reducedMotion = false, library, realm = freshRealm() } = {}) {
  const { scope, posted, listeners } = fakeScope();
  const worker = attachSceneWorker(scope, {
    toUrl: () => 'blob:rise/scene-1',
    load: async () => (typeof module === 'function' ? module() : module),
    functionPrototypes: realm.functionPrototypes
  });
  const canvas = fakeCanvas();
  const init = () => worker.handle({
    type: TO_WORKER.init, version: 1, code: 'export default () => ({ frame() {} })', width: 400, height: 300, dpr: 2,
    theme: { accent: '#ff0000' }, reducedMotion, canvas, ...(library ? { library } : {})
  });
  const of = type => posted.filter(message => message.type === type);
  return { scope, posted, listeners, worker, canvas, init, of, realm };
}

beforeEach(() => {
  samplerPixels = grey(0);
  vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas);
});
afterEach(() => vi.unstubAllGlobals());

describe('starting a scene', () => {
  it('listens on the scope it is given', () => {
    const { listeners } = setup({ default: () => ({ frame() {} }) });
    expect(listeners).toHaveLength(1);
  });

  it('shadows every banned global before the code runs, so a bypass fails loudly', async () => {
    let seen = null;
    const { scope, init } = setup({
      default: () => {
        seen = {};
        for (const name of BANNED_GLOBALS) {
          try { const value = scope[name]; if (typeof value === 'function') value(); seen[name] = 'reached'; } catch { seen[name] = 'refused'; }
        }
        return { frame() {} };
      }
    });
    await init();
    for (const name of ['fetch', 'XMLHttpRequest', 'WebSocket', 'importScripts', 'indexedDB', 'caches', 'navigator', 'setTimeout', 'setInterval', 'requestAnimationFrame', 'postMessage', 'FontFace']) {
      expect(seen[name], name).toBe('refused');
    }
    // And the code cannot put them back.
    expect(() => { 'use strict'; scope.fetch = () => 'again'; }).toThrow();
  });

  it('gives the code its canvas, size, theme, motion setting, library, done and no fonts, then runs a dry frame before it says ready', async () => {
    const calls = [];
    let rise = null;
    const { init, of, posted } = setup({
      default: given => { rise = given; calls.push('init'); return { frame: (t, dt) => calls.push(['frame', t, dt]) }; },
      reportsCompletion: true
    });
    await init();
    expect(rise.size).toEqual({ width: 400, height: 300, dpr: 2 });
    expect(rise.theme).toEqual({ accent: '#ff0000' });
    expect(rise.reducedMotion).toBe(false);
    expect(rise.fonts).toEqual([]);
    expect(typeof rise.lib.tween).toBe('function');
    expect(rise.ctx).toBeTruthy();
    expect(calls).toEqual(['init', ['frame', 0, 0]]);
    expect(of(TO_HOST.ready)).toEqual([{ type: TO_HOST.ready, reportsCompletion: true }]);
    expect(posted.at(-1).type).toBe(TO_HOST.ready);
  });

  it('builds the library with the style’s defaults it was sent', async () => {
    let rise = null;
    const { init } = setup({ default: given => { rise = given; return { frame() {} }; } }, { library: { stroke: 3 } });
    await init();
    rise.lib.line(rise.lib.axes({ x: [0, 1], y: [0, 1] }, { labels: false }), [0, 0], [1, 1]);
    expect(rise.ctx.lineWidth).toBe(6);
  });

  it('sizes the canvas in device pixels', async () => {
    const { init, canvas } = setup({ default: () => ({ frame() {} }) });
    await init();
    expect([canvas.width, canvas.height]).toEqual([800, 600]);
  });

  it('does not let a scene end a hold unless it says it will', async () => {
    const { init, of } = setup({ default: () => ({ frame() {} }) });
    await init();
    expect(of(TO_HOST.ready)).toEqual([{ type: TO_HOST.ready, reportsCompletion: false }]);
  });

  it('gives WebGL2 instead of 2D when asked before the first frame, and refuses it after', async () => {
    let rise = null;
    const { init, worker, of } = setup({ default: given => { rise = given; given.use('webgl2'); return { frame() {} }; } });
    await init();
    expect(rise.gl).toBeTruthy();
    expect(rise.ctx).toBeNull();
    expect(of(TO_HOST.ready)).toHaveLength(1);
    await worker.handle({ type: TO_WORKER.frame, t: 16, dt: 16 });
    expect(() => rise.use('webgl2')).toThrow(/before the first frame/u);
  });

  const failsAt = async (module, phase, message) => {
    const { init, of } = setup(module);
    await init();
    expect(of(TO_HOST.ready)).toEqual([]);
    const [error] = of(TO_HOST.error);
    expect(error).toMatchObject({ phase });
    expect(error.message).toMatch(message);
    return error;
  };

  it('reports a module that will not load, at load', async () => {
    await failsAt(() => { throw new SyntaxError('Unexpected token'); }, 'load', /Unexpected token/u);
  });

  it('reports a module without a default function, or one that throws or returns no frame, at init', async () => {
    await failsAt({ scene: () => ({}) }, 'init', /default export/u);
    await failsAt({ default: () => { throw new TypeError('nope'); } }, 'init', /nope/u);
    await failsAt({ default: () => ({ cue() {} }) }, 'init', /frame/u);
  });

  it('reports a dry frame that throws, at frame, with where the code broke', async () => {
    const error = new TypeError('v.draw is not a function');
    error.stack = 'TypeError: v.draw is not a function\n    at frame (blob:rise/scene-1:14:5)\n    at handle (https://rise.syberlabs.io/assets/scene-worker.js:1:200)';
    const reported = await failsAt({ default: () => ({ frame() { throw error; } }) }, 'frame', /v\.draw is not a function/u);
    expect(reported.where).toBe('scene.js:14:5');
  });

  it('keeps a message short', async () => {
    const reported = await failsAt({ default: () => { throw new Error('x'.repeat(1000)); } }, 'init', /x/u);
    expect(reported.message.length).toBeLessThanOrEqual(300);
  });
});

describe('the routes to Function that name nothing', () => {
  const routes = {
    'a constructor of a constructor': '[].constructor.constructor("return 1")()',
    'an async arrow function': '(async () => {}).constructor("return 1")()',
    'a generator function': '(function* () {}).constructor("return 1")()',
    'an async generator function': '(async function* () {}).constructor("return 1")()',
    'the prototype chain': 'Object.getPrototypeOf(async function () {}).constructor("return 1")()'
  };

  it('can be walked to Function in a realm that has not been sealed (the control)', () => {
    const { run } = freshRealm();
    for (const [route, source] of Object.entries(routes)) expect(() => run(source), route).not.toThrow();
  });

  for (const [route, source] of Object.entries(routes)) {
    it(`refuses ${route} while the scene starts`, async () => {
      const realm = freshRealm();
      const { init, of } = setup(realm.run(`({ default: () => { ${source}; return { frame() {} }; } })`), { realm });
      await init();
      expect(of(TO_HOST.ready)).toEqual([]);
      const [error] = of(TO_HOST.error);
      expect(error).toMatchObject({ phase: 'init' });
      expect(error.message).toMatch(/ReferenceError: Function is not available to a scene/u);
    });
  }

  it('refuses it at a frame as well, and a scene that never reaches for Function runs', async () => {
    const realm = freshRealm();
    const late = setup(realm.run('({ default: () => ({ frame(t) { if (t > 0) [].constructor.constructor("return 1")(); } }) })'), { realm });
    await late.init();
    expect(late.of(TO_HOST.ready)).toHaveLength(1);
    await late.worker.handle({ type: TO_WORKER.frame, t: 16, dt: 16 });
    expect(late.of(TO_HOST.error)).toMatchObject([{ phase: 'frame' }]);

    const plain = setup(realm.run('({ default: () => ({ frame() {} }) })'));
    await plain.init();
    expect(plain.of(TO_HOST.ready)).toHaveLength(1);
    expect(plain.of(TO_HOST.error)).toEqual([]);
  });

  it('does not let the scene put the constructor back', async () => {
    const realm = freshRealm();
    const { init, of } = setup(realm.run(`({ default: () => {
      Object.defineProperty(Function.prototype, 'constructor', { value: Function, configurable: true });
      return { frame() {} };
    } })`), { realm });
    await init();
    expect(of(TO_HOST.error)).toMatchObject([{ phase: 'init', message: expect.stringMatching(/TypeError/u) }]);
  });

  it('seals a realm once: a second call leaves it sealed and says so', () => {
    const { functionPrototypes } = freshRealm();
    expect(sealFunctionConstructors(functionPrototypes)).toBe(true);
    const sealed = functionPrototypes.map(proto => Object.getOwnPropertyDescriptor(proto, 'constructor').value);
    expect(sealFunctionConstructors(functionPrototypes)).toBe(true);
    expect(functionPrototypes.map(proto => Object.getOwnPropertyDescriptor(proto, 'constructor').value)).toEqual(sealed);
    expect(functionPrototypes.map(proto => Object.getOwnPropertyDescriptor(proto, 'constructor').configurable)).toEqual([false, false, false, false]);
  });
});

describe('frames', () => {
  it('advances the library’s tweens by the step, draws, and says how long it took', async () => {
    let rise = null;
    let target = null;
    const seen = [];
    const { init, worker, of } = setup({
      default: given => {
        rise = given;
        target = { x: 0 };
        given.lib.tween(target, { x: 1 }, { ms: 100, ease: t => t });
        return { frame: t => seen.push([t, target.x]) };
      }
    });
    await init();
    await worker.handle({ type: TO_WORKER.frame, t: 50, dt: 50 });
    expect(seen.at(-1)).toEqual([50, 0.5]);
    const [done] = of(TO_HOST.frameDone);
    expect(done.t).toBe(50);
    expect(done.ms).toBeGreaterThanOrEqual(0);
    expect(rise).not.toBeNull();
  });

  it('samples its own picture on the flash gate’s cadence and reports its brightness', async () => {
    const { init, worker, of } = setup({ default: () => ({ frame() {} }) });
    await init();
    samplerPixels = grey(255);
    for (let t = 16; t <= 320; t += 16) await worker.handle({ type: TO_WORKER.frame, t, dt: 16 });
    const lumas = of(TO_HOST.luma);
    expect(lumas.length).toBe(3);
    expect(lumas[0].value).toBeCloseTo(1, 5);
    for (let i = 1; i < lumas.length; i += 1) expect(lumas[i].t - lumas[i - 1].t).toBeGreaterThanOrEqual(SCENE_LIMITS.lumaEveryMs);
  });

  it('reports a frame that throws once, and draws no more', async () => {
    let count = 0;
    const { init, worker, of } = setup({ default: () => ({ frame: t => { count += 1; if (t > 0) throw new Error('broke'); } }) });
    await init();
    await worker.handle({ type: TO_WORKER.frame, t: 16, dt: 16 });
    await worker.handle({ type: TO_WORKER.frame, t: 32, dt: 16 });
    expect(of(TO_HOST.error)).toHaveLength(1);
    expect(of(TO_HOST.error)[0].phase).toBe('frame');
    expect(count).toBe(2);
  });

  it('ignores a frame before the scene is ready, and anything that is not a message it knows', async () => {
    const { worker, posted } = setup({ default: () => ({ frame() {} }) });
    await worker.handle({ type: TO_WORKER.frame, t: 16, dt: 16 });
    await worker.handle({ type: 'scene/other' });
    await worker.handle('scene/frame');
    expect(posted).toEqual([]);
  });
});

describe('cues, done, resize and dispose', () => {
  it('hands a cue to the scene with whether it should land at once, and says it was handled', async () => {
    const cues = [];
    const { init, worker, of } = setup({ default: () => ({ frame() {}, cue: (name, options) => cues.push([name, options]) }) });
    await init();
    await worker.handle({ type: TO_WORKER.cue, name: 'draw', instant: true });
    expect(cues).toEqual([['draw', { instant: true }]]);
    expect(of(TO_HOST.cued)).toEqual([{ type: TO_HOST.cued, name: 'draw' }]);
  });

  it('reports a cue that throws or whose promise rejects, at cue', async () => {
    const { init, worker, of } = setup({
      default: () => ({ frame() {}, cue: name => { if (name === 'throw') throw new Error('bad cue'); return Promise.reject(new Error('late')); } })
    });
    await init();
    await worker.handle({ type: TO_WORKER.cue, name: 'throw', instant: false });
    await worker.handle({ type: TO_WORKER.cue, name: 'reject', instant: false });
    await Promise.resolve();
    expect(of(TO_HOST.error).map(error => [error.phase, error.message])).toEqual([['cue', 'Error: bad cue'], ['cue', 'Error: late']]);
  });

  it('a scene with no cue handler takes a cue as nothing', async () => {
    const { init, worker, of } = setup({ default: () => ({ frame() {} }) });
    await init();
    await worker.handle({ type: TO_WORKER.cue, name: 'draw', instant: false });
    expect(of(TO_HOST.error)).toEqual([]);
    expect(of(TO_HOST.cued)).toHaveLength(1);
  });

  it('passes the scene’s done to the host', async () => {
    let rise = null;
    const { init, of } = setup({ default: given => { rise = given; return { frame() {} }; } });
    await init();
    rise.done();
    expect(of(TO_HOST.done)).toEqual([{ type: TO_HOST.done }]);
  });

  it('resizes the canvas and the size the scene reads', async () => {
    let rise = null;
    const { init, worker, canvas } = setup({ default: given => { rise = given; return { frame() {} }; } });
    await init();
    await worker.handle({ type: TO_WORKER.resize, width: 200, height: 100, dpr: 1.5 });
    expect([canvas.width, canvas.height]).toEqual([300, 150]);
    expect(rise.size).toEqual({ width: 200, height: 100, dpr: 1.5 });
  });

  it('closes when disposed', async () => {
    const { init, worker, scope } = setup({ default: () => ({ frame() {} }) });
    await init();
    await worker.handle({ type: TO_WORKER.dispose });
    expect(scope.close).toHaveBeenCalled();
  });
});

describe('where an error happened', () => {
  it('names the line and column in the scene’s own code, and nothing of anyone else’s', () => {
    const url = 'blob:https://x.claudemcpcontent.com/1234';
    expect(whereIn({ stack: `Error\n    at f (https://rise.syberlabs.io/a.js:1:2)\n    at frame (${url}:3:9)` }, url)).toBe('scene.js:3:9');
    expect(whereIn({ stack: `frame@${url}:7:11\n` }, url)).toBe('scene.js:7:11');
    expect(whereIn({ stack: 'Error\n    at elsewhere (a.js:1:1)' }, url)).toBeNull();
    expect(whereIn({}, url)).toBeNull();
  });
});
