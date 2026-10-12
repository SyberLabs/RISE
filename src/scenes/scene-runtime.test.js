/**
 * The scene runtime: the Chamber's side of a generated scene
 * (docs/superpowers/specs/2026-10-08-creative-control-design.md §7, §12–13).
 *
 * The worker is a fake that records what it is sent and says what the test
 * makes it say; frames are a hand-cranked requestAnimationFrame; holds and
 * the silence watch run on the live layer's virtual clock.
 */
import { describe, expect, it } from 'vitest';
import { createVirtualClock } from '../live/clock.js';
import { VisualFlashGate } from '../core/visual-safety.js';
import { SCENE_LIMITS, SCENE_PROTOCOL_VERSION, TO_HOST, TO_WORKER } from './scene-protocol.js';
import { createFlashWatch, createSceneRuntime } from './scene-runtime.js';

function fakeWorker() {
  return {
    sent: [], transfers: [], terminated: false, onmessage: null, onerror: null,
    postMessage(message, transfer) { this.sent.push(message); if (transfer) this.transfers.push(...transfer); },
    terminate() { this.terminated = true; },
    say(data) { this.onmessage?.({ data }); },
    of(type) { return this.sent.filter(message => message.type === type); }
  };
}

function frames() {
  let callbacks = new Map();
  let next = 1;
  return {
    request: callback => { const id = next; next += 1; callbacks.set(id, callback); return id; },
    cancel: id => callbacks.delete(id),
    run(timestamp) { const due = callbacks; callbacks = new Map(); for (const callback of due.values()) callback(timestamp); },
    get pending() { return callbacks.size; }
  };
}

const SCENE = { id: 'vector', code: 'export default () => ({ frame() {} })' };

function setup(options = {}) {
  const clock = createVirtualClock();
  const worker = fakeWorker();
  const raf = frames();
  const failures = [];
  const lumas = [];
  const listened = [];
  const inputs = [];
  const refused = [];
  const mirrored = [];
  const offscreen = { offscreen: true };
  const canvas = { transferControlToOffscreen: () => offscreen };
  const runtime = createSceneRuntime({
    createWorker: options.createWorker ?? (() => worker),
    canvas, clock, theme: { accent: '#ff0000' }, reducedMotion: false, ...(options.library ? { library: options.library } : {}),
    onFailure: diagnostic => failures.push(diagnostic),
    onLuma: (value, t) => lumas.push([value, t]),
    onListen: kinds => listened.push(kinds),
    onInput: told => inputs.push(told),
    onInputRefused: told => refused.push(told),
    onWidgets: list => mirrored.push(list),
    requestFrame: raf.request, cancelFrame: raf.cancel
  });
  return { clock, worker, raf, failures, lumas, listened, inputs, refused, mirrored, offscreen, runtime };
}

/** Started, ready, playing. */
async function running(options) {
  const parts = setup(options);
  await parts.runtime.start(SCENE);
  parts.worker.say({ type: TO_HOST.ready, reportsCompletion: options?.reportsCompletion === true });
  parts.runtime.play();
  return parts;
}

/** One frame sent at `timestamp` and answered in `ms`. */
function frame(parts, timestamp, ms = 2) {
  parts.raf.run(timestamp);
  const last = parts.worker.of(TO_WORKER.frame).at(-1);
  parts.worker.say({ type: TO_HOST.frameDone, t: last.t, ms });
  return last;
}

describe('starting a scene', () => {
  it('transfers the canvas to a new worker and sends it the code, size, theme and motion setting', async () => {
    const { runtime, worker, offscreen } = setup();
    runtime.resize(400, 300, 3);
    await runtime.start(SCENE);
    expect(worker.of(TO_WORKER.init)).toEqual([{
      type: TO_WORKER.init, version: SCENE_PROTOCOL_VERSION, code: SCENE.code, width: 400, height: 300, dpr: SCENE_LIMITS.maxDpr,
      theme: { accent: '#ff0000' }, reducedMotion: false, library: {}, canvas: offscreen
    }]);
    expect(worker.transfers).toEqual([offscreen]);
  });

  it('sends the style’s library defaults with the code', async () => {
    const { runtime, worker } = setup({ library: { stroke: 2.5, ease: 'smooth' } });
    await runtime.start(SCENE);
    expect(worker.of(TO_WORKER.init)[0].library).toEqual({ stroke: 2.5, ease: 'smooth' });
  });

  it('waits for a worker that is made asynchronously, and fails at load when none can be made', async () => {
    const worker = fakeWorker();
    const made = setup({ createWorker: () => Promise.resolve(worker) });
    await made.runtime.start(SCENE);
    expect(worker.of(TO_WORKER.init)).toHaveLength(1);
    const refused = setup({ createWorker: () => Promise.reject(new Error('fetch refused')) });
    await refused.runtime.start(SCENE);
    expect(refused.failures).toEqual([{ sceneId: 'vector', phase: 'load', message: 'The scene could not start: fetch refused', where: null }]);
  });

  it('fails at load when the worker cannot run at all', async () => {
    const { runtime, worker, failures } = setup();
    await runtime.start(SCENE);
    worker.onerror({ message: 'Script error' });
    expect(failures[0]).toMatchObject({ phase: 'load' });
    expect(worker.terminated).toBe(true);
  });
});

describe('time', () => {
  it('sends frames only while playing and ready, with scene time that stops on pause', async () => {
    const parts = setup();
    await parts.runtime.start(SCENE);
    parts.runtime.play();
    parts.raf.run(0);
    expect(parts.worker.of(TO_WORKER.frame)).toEqual([]);
    parts.worker.say({ type: TO_HOST.ready, reportsCompletion: false });
    frame(parts, 1000);
    frame(parts, 1016);
    parts.runtime.pause();
    expect(parts.raf.pending).toBe(0);
    parts.runtime.play();
    frame(parts, 5000);
    frame(parts, 5016);
    expect(parts.worker.of(TO_WORKER.frame).map(({ t, dt }) => [t, dt])).toEqual([[0, 0], [16, 16], [16, 0], [32, 16]]);
  });

  it('caps a step at 100 ms and waits for the worker to answer before sending another frame', async () => {
    const parts = await running();
    frame(parts, 0);
    parts.raf.run(500);
    parts.raf.run(516);
    const sent = parts.worker.of(TO_WORKER.frame);
    expect(sent.map(({ t, dt }) => [t, dt])).toEqual([[0, 0], [100, 100]]);
  });
});

describe('cues and size', () => {
  it('sends a cue, and keeps cues that come before the scene is ready until it is', async () => {
    const { runtime, worker } = setup();
    await runtime.start(SCENE);
    runtime.cue('draw', { instant: true });
    expect(worker.of(TO_WORKER.cue)).toEqual([]);
    worker.say({ type: TO_HOST.ready, reportsCompletion: false });
    runtime.cue('rotate');
    expect(worker.of(TO_WORKER.cue)).toEqual([
      { type: TO_WORKER.cue, name: 'draw', instant: true },
      { type: TO_WORKER.cue, name: 'rotate', instant: false }
    ]);
  });

  it('passes a resize on once started, with the pixel ratio capped', async () => {
    const { runtime, worker } = setup();
    await runtime.start(SCENE);
    runtime.resize(200, 100, 4);
    expect(worker.of(TO_WORKER.resize)).toEqual([{ type: TO_WORKER.resize, width: 200, height: 100, dpr: SCENE_LIMITS.maxDpr }]);
  });
});

describe('holds', () => {
  const settled = () => {
    const state = { result: null };
    return { state, record: promise => promise.then(result => { state.result = result; }) };
  };

  it('ends a hold at its ms when the scene does not report completion, whatever it says', async () => {
    const parts = await running();
    const { state, record } = settled();
    record(parts.runtime.hold({ ms: 3000, maxMs: 8000 }));
    await parts.clock.advance(1000);
    parts.worker.say({ type: TO_HOST.done });
    await parts.clock.advance(1900);
    expect(state.result).toBeNull();
    await parts.clock.advance(100);
    expect(state.result).toEqual({ reason: 'ended' });
  });

  it('ends a hold when a reporting scene says done, but not sooner than the earliest a hold may end', async () => {
    const parts = await running({ reportsCompletion: true });
    const { state, record } = settled();
    record(parts.runtime.hold({ ms: 6000, maxMs: 8000 }));
    await parts.clock.advance(50);
    parts.worker.say({ type: TO_HOST.done });
    await parts.clock.advance(100);
    expect(state.result).toBeNull();
    await parts.clock.advance(SCENE_LIMITS.earliestDoneMs - 150);
    expect(state.result).toEqual({ reason: 'ended' });
  });

  it('ends a reporting scene’s hold at maxMs at the latest, and at ms when there is no maxMs', async () => {
    const parts = await running({ reportsCompletion: true });
    const late = settled();
    late.record(parts.runtime.hold({ ms: 2000, maxMs: 5000 }));
    await parts.clock.advance(4999);
    expect(late.state.result).toBeNull();
    await parts.clock.advance(1);
    expect(late.state.result).toEqual({ reason: 'ended' });
    const plain = settled();
    plain.record(parts.runtime.hold({ ms: 2000 }));
    await parts.clock.advance(2000);
    expect(plain.state.result).toEqual({ reason: 'ended' });
  });

  it('takes no done from before the hold began', async () => {
    const parts = await running({ reportsCompletion: true });
    parts.worker.say({ type: TO_HOST.done });
    const { state, record } = settled();
    record(parts.runtime.hold({ ms: 1000, maxMs: 4000 }));
    await parts.clock.advance(1000);
    expect(state.result).toBeNull();
    await parts.clock.advance(3000);
    expect(state.result).toEqual({ reason: 'ended' });
  });
});

describe('budgets and the kill switch', () => {
  async function failsWith(act, phase, message) {
    const parts = await running({ reportsCompletion: true });
    const hold = { result: null };
    parts.runtime.hold({ ms: 3000, maxMs: 8000 }).then(result => { hold.result = result; });
    await act(parts);
    expect(parts.failures).toHaveLength(1);
    expect(parts.failures[0]).toMatchObject({ sceneId: 'vector', phase });
    expect(parts.failures[0].message).toMatch(message);
    expect(parts.worker.terminated).toBe(true);
    // No more frames, and the open hold runs on its ms.
    parts.raf.run(99_999);
    expect(parts.raf.pending).toBe(0);
    await parts.clock.advance(3000 - parts.clock.now());
    expect(hold.result).toEqual({ reason: 'ended' });
    return parts;
  }

  it('fails a frame over the hard limit', async () => {
    await failsWith(async parts => { frame(parts, 0, SCENE_LIMITS.frameHardMs + 1); }, 'frame', /took/u);
  });

  it('fails three slow frames in one second of scene time, and forgives two', async () => {
    const parts = await running();
    frame(parts, 0, 30);
    frame(parts, 50, 30);
    for (let at = 100; at < 1200; at += 50) frame(parts, at, 5);
    frame(parts, 1200, 30);
    expect(parts.failures).toEqual([]);
    await failsWith(async other => {
      frame(other, 0, 30);
      frame(other, 16, 30);
      frame(other, 32, 30);
    }, 'frame', /slow/u);
  });

  it('fails on any error the worker reports, keeping its phase, message and where, bounded', async () => {
    const parts = await failsWith(async other => {
      other.worker.say({ type: TO_HOST.error, phase: 'cue', message: 'TypeError: x'.padEnd(900, '!'), where: 'scene.js:3:9' });
    }, 'cue', /^TypeError: x/u);
    expect(parts.failures[0].message.length).toBeLessThanOrEqual(300);
    expect(parts.failures[0].where).toBe('scene.js:3:9');
  });

  it('fails a worker that stops answering frames', async () => {
    await failsWith(async parts => {
      parts.raf.run(0);
      await parts.clock.advance(SCENE_LIMITS.silenceMs);
    }, 'frame', /stopped answering/u);
  });

  it('reports once, and a hold asked for after a failure runs on its ms', async () => {
    const parts = await running({ reportsCompletion: true });
    parts.worker.say({ type: TO_HOST.error, phase: 'frame', message: 'one', where: null });
    parts.worker.say({ type: TO_HOST.error, phase: 'frame', message: 'two', where: null });
    expect(parts.failures).toHaveLength(1);
    const hold = { result: null };
    parts.runtime.hold({ ms: 500, maxMs: 4000 }).then(result => { hold.result = result; });
    parts.worker.say({ type: TO_HOST.done });
    await parts.clock.advance(499);
    expect(hold.result).toBeNull();
    await parts.clock.advance(1);
    expect(hold.result).toEqual({ reason: 'ended' });
  });

  it('treats what the worker says as data: unknown messages and malformed fields are ignored', async () => {
    const parts = await running();
    for (const data of [null, 'scene/done', [], { type: 'scene/eval' }, { type: TO_HOST.frameDone, t: 'x', ms: 'y' }, { type: TO_HOST.luma, value: 7, t: 0 }]) parts.worker.say(data);
    expect(parts.failures).toEqual([]);
    expect(parts.lumas).toEqual([]);
    parts.worker.say({ type: TO_HOST.error, phase: 'shell', message: { toString: () => 'boom' }, where: 42 });
    expect(parts.failures[0]).toMatchObject({ phase: 'frame', where: null });
    expect(typeof parts.failures[0].message).toBe('string');
  });
});

describe('the flash gate and freezing', () => {
  it('passes the worker’s brightness samples to the host with their scene time', async () => {
    const parts = await running();
    parts.worker.say({ type: TO_HOST.luma, value: 0.4, t: 100 });
    expect(parts.lumas).toEqual([[0.4, 100]]);
  });

  it('freezes on the last frame: no more frames, done ignored, holds on their ms, and no failure', async () => {
    const parts = await running({ reportsCompletion: true });
    frame(parts, 0);
    const hold = { result: null };
    parts.runtime.hold({ ms: 1000, maxMs: 5000 }).then(result => { hold.result = result; });
    parts.runtime.freeze();
    parts.raf.run(16);
    expect(parts.worker.of(TO_WORKER.frame)).toHaveLength(1);
    parts.worker.say({ type: TO_HOST.luma, value: 0.9, t: 100 });
    expect(parts.lumas).toEqual([]);
    parts.worker.say({ type: TO_HOST.done });
    await parts.clock.advance(999);
    expect(hold.result).toBeNull();
    await parts.clock.advance(1);
    expect(hold.result).toEqual({ reason: 'ended' });
    await parts.clock.advance(5000);
    expect(parts.failures).toEqual([]);
    expect(parts.worker.terminated).toBe(false);
  });

  it('trips on more than three flashes in a second, and never on steady or slow change', () => {
    const watch = () => createFlashWatch(new VisualFlashGate({ minIntervalMs: 0, burstWindowMs: 1000, maxBurst: 3 }));
    const steady = watch();
    for (let t = 0; t < 5000; t += 100) expect(steady(0.5 + (t / 5000) * 0.4, t)).toBe(false);
    const slow = watch();
    for (let t = 0; t < 5000; t += 100) expect(slow(Math.floor(t / 500) % 2 ? 0.9 : 0.1, t)).toBe(false);
    const fast = watch();
    let tripped = false;
    for (let t = 0; t < 1000 && !tripped; t += 100) tripped = fast((t / 100) % 2 ? 0.95 : 0.05, t);
    expect(tripped).toBe(true);
  });
});

describe('disposing', () => {
  it('tells the worker, ends it, stops the frames and lets any hold run on its ms', async () => {
    const parts = await running({ reportsCompletion: true });
    const hold = { result: null };
    parts.runtime.hold({ ms: 800, maxMs: 4000 }).then(result => { hold.result = result; });
    parts.runtime.dispose();
    expect(parts.worker.of(TO_WORKER.dispose)).toHaveLength(1);
    expect(parts.worker.terminated).toBe(true);
    expect(parts.raf.pending).toBe(0);
    await parts.clock.advance(800);
    expect(hold.result).toEqual({ reason: 'ended' });
    expect(parts.failures).toEqual([]);
  });

  it('ends a worker that arrives after the scene was disposed', async () => {
    const worker = fakeWorker();
    let give;
    const parts = setup({ createWorker: () => new Promise(resolve => { give = resolve; }) });
    const started = parts.runtime.start(SCENE);
    parts.runtime.dispose();
    give(worker);
    await started;
    expect(worker.terminated).toBe(true);
    expect(worker.of(TO_WORKER.init)).toEqual([]);
  });
});

describe('a scene that listens (docs/plans/LIVE-CURRENT.md §20)', () => {
  const NONE = { shift: false, alt: false, ctrl: false, meta: false };
  const at = (type, x, y, buttons = 1) => ({ type, x, y, buttons, key: null, modifiers: NONE });
  const key = (type, name) => ({ type, x: null, y: null, buttons: 0, key: name, modifiers: NONE });

  /** Started, sized 400 by 300, ready with what it listens to, playing. */
  async function listening(listens = ['pointer', 'keys']) {
    const parts = setup();
    parts.runtime.resize(400, 300, 1);
    await parts.runtime.start(SCENE);
    parts.worker.say({ type: TO_HOST.ready, reportsCompletion: false, listens });
    parts.runtime.play();
    return parts;
  }
  const sentInputs = parts => parts.worker.of(TO_WORKER.input);

  it('gives nothing to a scene that did not declare, and asks for no listening', async () => {
    const parts = await running();
    parts.runtime.input(at('pointerdown', 10, 10));
    parts.runtime.input(key('keydown', 'a'));
    expect(sentInputs(parts)).toEqual([]);
    expect(parts.listened).toEqual([]);
  });

  it('says once what a ready scene listens to, and ignores what it cannot listen to', async () => {
    const parts = await listening(['keys', 'mouse']);
    expect(parts.listened).toEqual([{ pointer: false, keys: true }]);
    const odd = setup();
    await odd.runtime.start(SCENE);
    odd.worker.say({ type: TO_HOST.ready, reportsCompletion: false, listens: 'pointer' });
    expect(odd.listened).toEqual([]);
  });

  it('builds each input from the event’s own numbers, clamped to the canvas, and sends only the kinds it listens to', async () => {
    const parts = await listening(['pointer']);
    parts.runtime.input({ ...at('pointerdown', -20, 900, 99), target: { nodeName: 'CANVAS' }, modifiers: { shift: true, ctrl: 'yes' } });
    parts.runtime.input(key('keydown', 'a'));
    parts.runtime.input(at('click', 1, 1));
    expect(sentInputs(parts)).toEqual([{
      type: TO_WORKER.input, kind: 'pointerdown', x: 0, y: 300, buttons: 31, key: null, modifiers: { shift: true, alt: false, ctrl: false, meta: false }
    }]);
  });

  it('coalesces pointer moves to at most inputPointerPerSecond, the latest kept, and never drops a press or a release', async () => {
    const parts = await listening();
    parts.runtime.input(at('pointerdown', 10, 10));
    for (let x = 11; x < 20; x += 1) parts.runtime.input(at('pointermove', x, 10));
    parts.runtime.input(at('pointerup', 20, 10, 0));
    await parts.clock.advance(100);
    expect(sentInputs(parts).map(({ kind, x }) => [kind, x])).toEqual([['pointerdown', 10], ['pointermove', 19], ['pointerup', 20]]);
    const before = sentInputs(parts).length;
    for (let ms = 0; ms < 1000; ms += 1) {
      parts.runtime.input(at('pointermove', ms % 400, 10));
      await parts.clock.advance(1);
    }
    expect(sentInputs(parts).length - before).toBeLessThanOrEqual(SCENE_LIMITS.inputPointerPerSecond + 1);
  });

  it('keeps a discrete burst larger than the move queue in order at the pointer delivery rate', async () => {
    const parts = await listening(['pointer']);
    const wanted = Array.from({ length: 20 }, (_, x) => [x % 2 ? 'pointerup' : 'pointerdown', x]);
    wanted.push(['pointercancel', 20]);
    for (const [kind, x] of wanted) parts.runtime.input(at(kind, x, 10, kind === 'pointerdown' ? 1 : 0));
    expect(sentInputs(parts).map(({ kind, x }) => [kind, x])).toEqual(wanted.slice(0, 1));
    await parts.clock.advance(1000 / SCENE_LIMITS.inputPointerPerSecond - 0.01);
    expect(sentInputs(parts)).toHaveLength(1);
    await parts.clock.advance(0.02);
    expect(sentInputs(parts)).toHaveLength(2);
    await parts.clock.advance(200);
    expect(sentInputs(parts).map(({ kind, x }) => [kind, x])).toEqual(wanted);
    expect(parts.failures).toEqual([]);
  });

  it('evicts coalescible moves before a discrete input when the queue fills', async () => {
    const parts = await listening(['pointer']);
    const wanted = [];
    for (let x = 0; x < 24; x += 1) {
      const kind = x % 2 ? 'pointerup' : 'pointerdown';
      wanted.push([kind, x]);
      parts.runtime.input(at(kind, x, 10, kind === 'pointerup' ? 0 : 1));
      parts.runtime.input(at('pointermove', x, 10));
    }
    await parts.clock.advance(500);
    expect(sentInputs(parts).filter(({ kind }) => kind !== 'pointermove').map(({ kind, x }) => [kind, x])).toEqual(wanted);
    expect(parts.failures).toEqual([]);
  });

  it('keeps the latest coalesced move before its release behind a long discrete burst', async () => {
    const parts = await listening(['pointer']);
    const wanted = Array.from({ length: 19 }, (_, x) => [x % 2 ? 'pointerup' : 'pointerdown', x]);
    for (const [kind, x] of wanted) parts.runtime.input(at(kind, x, 10, kind === 'pointerup' ? 0 : 1));
    for (let x = 50; x < 100; x += 1) parts.runtime.input(at('pointermove', x, 10));
    parts.runtime.input(at('pointerup', 100, 10, 0));
    await parts.clock.advance(250);
    expect(sentInputs(parts).map(({ kind, x }) => [kind, x])).toEqual([...wanted, ['pointermove', 99], ['pointerup', 100]]);
  });

  it('ends an overloaded scene instead of dropping a discrete input or growing the backlog without bound', async () => {
    const parts = await listening(['pointer']);
    parts.worker.say({ type: TO_HOST.ready, reportsCompletion: true, listens: ['pointer'] });
    let held = null;
    parts.runtime.hold({ ms: 500, maxMs: 5000 }).then(result => { held = result; });
    for (let x = 0; x < SCENE_LIMITS.inputPointerPerSecond + 1; x += 1) {
      parts.runtime.input(at(x % 2 ? 'pointerup' : 'pointerdown', x, 10, x % 2 ? 0 : 1));
    }
    expect(parts.failures).toEqual([]);
    parts.runtime.input(at('pointerup', 200, 10, 0));
    expect(parts.failures).toEqual([{ sceneId: SCENE.id, phase: 'input', message: 'The scene received too many queued pointer inputs', where: null }]);
    expect(parts.worker.terminated).toBe(true);
    const delivered = sentInputs(parts).length;
    await parts.clock.advance(499);
    expect(sentInputs(parts)).toHaveLength(delivered);
    expect(held).toBeNull();
    await parts.clock.advance(1);
    expect(held).toEqual({ reason: 'ended' });
    parts.runtime.input(at('pointerdown', 1, 1));
    await parts.clock.advance(1000);
    expect(sentInputs(parts)).toHaveLength(delivered);
    expect(parts.failures).toHaveLength(1);
  });

  it('drops keys beyond inputKeysPerSecond, and never sends the instrument’s keys', async () => {
    const parts = await listening(['keys']);
    for (const name of [' ', 'r', 'F', '-', '=', '[', ']', 'Escape', 'Tab', 'Enter']) parts.runtime.input(key('keydown', name));
    expect(sentInputs(parts)).toEqual([]);
    for (let ms = 0; ms < 1000; ms += 5) {
      parts.runtime.input(key('keydown', 'ArrowRight'));
      await parts.clock.advance(5);
    }
    expect(sentInputs(parts).length).toBeLessThanOrEqual(SCENE_LIMITS.inputKeysPerSecond);
    expect(sentInputs(parts).length).toBeGreaterThanOrEqual(SCENE_LIMITS.inputKeysPerSecond - 1);
  });

  it('draws one frame at the same scene time for an input while paused, and none while playing', async () => {
    const parts = await listening();
    frame(parts, 0);
    frame(parts, 40);
    parts.runtime.pause();
    parts.runtime.input(at('pointerdown', 5, 5));
    parts.runtime.input(key('keydown', 'a'));
    expect(parts.worker.of(TO_WORKER.frame).map(({ t, dt }) => [t, dt])).toEqual([[0, 0], [40, 40], [40, 0]]);
    parts.worker.say({ type: TO_HOST.frameDone, t: 40, ms: 2 });
    await parts.clock.advance(50);
    parts.runtime.input(key('keydown', 'b'));
    expect(parts.worker.of(TO_WORKER.frame)).toHaveLength(4);
    parts.worker.say({ type: TO_HOST.frameDone, t: 40, ms: 2 });
    parts.runtime.play();
    parts.runtime.input(key('keydown', 'c'));
    expect(parts.worker.of(TO_WORKER.frame)).toHaveLength(4);
  });

  it('tells what the reader set, with its widget’s label, only within a second of an input it delivered', async () => {
    const parts = await listening();
    parts.worker.say({ type: TO_HOST.widgets, widgets: [{ id: 'mass', kind: 'slider', label: 'Mass', value: 0.5, rect: [90, 34, 220, 32] }] });
    parts.worker.say({ type: TO_HOST.emit, changes: [['mass', 0.6]], refused: [] });
    expect(parts.inputs).toEqual([]);
    expect(parts.refused).toEqual([{ control: 'mass', reason: 'unprompted' }]);
    parts.runtime.input(at('pointerdown', 200, 50));
    parts.worker.say({ type: TO_HOST.emit, changes: [['mass', 0.7]], refused: [] });
    expect(parts.inputs).toEqual([{ control: 'mass', value: 0.7, label: 'Mass' }]);
    await parts.clock.advance(SCENE_LIMITS.emitAfterInputMs + 1);
    parts.worker.say({ type: TO_HOST.emit, changes: [['mass', 0.9]], refused: [] });
    expect(parts.inputs).toHaveLength(1);
  });

  it('holds each control to emitPerSecond, keeps the trailing value, and gives it on dispose', async () => {
    const parts = await listening();
    for (let i = 1; i <= 30; i += 1) {
      parts.runtime.input(key('keydown', 'ArrowRight'));
      parts.worker.say({ type: TO_HOST.emit, changes: [['mass', i]], refused: [] });
      await parts.clock.advance(34);
    }
    const told = parts.inputs.map(({ value }) => value);
    expect(told.length).toBeLessThanOrEqual(SCENE_LIMITS.emitPerSecond + 1);
    expect(told[0]).toBe(1);
    await parts.clock.advance(200);
    expect(parts.inputs.at(-1).value).toBe(30);
    parts.runtime.input(key('keydown', 'ArrowRight'));
    parts.worker.say({ type: TO_HOST.emit, changes: [['mass', 31]], refused: [] });
    parts.worker.say({ type: TO_HOST.emit, changes: [['mass', 32]], refused: [] });
    parts.runtime.dispose();
    expect(parts.inputs.at(-1).value).toBe(32);
  });

  it('reads an emit again as untrusted: a bad id, a bad value, too many controls, the worker’s own refusals, each noted once', async () => {
    const parts = await listening();
    parts.runtime.input(key('keydown', 'a'));
    const many = Array.from({ length: 70 }, (_, i) => [`c${i}`, i]);
    parts.worker.say({ type: TO_HOST.emit, changes: [['Bad', 1], ['ok', { a: 1 }], ['long', 'x'.repeat(81)], ...many], refused: [['note', 'value'], ['x', 'nonsense'], 'junk'] });
    parts.worker.say({ type: TO_HOST.emit, changes: [['Bad', 1], ['ok', { a: 1 }]], refused: [['note', 'value']] });
    // A message is read to emitControls changes at most: the first 64 here, three of them refused.
    expect(parts.inputs.map(({ control }) => control)).toEqual(many.slice(0, 61).map(([control]) => control));
    parts.worker.say({ type: TO_HOST.emit, changes: many.slice(61), refused: [] });
    expect(parts.inputs).toHaveLength(SCENE_LIMITS.emitControls);
    expect(parts.refused).toEqual(expect.arrayContaining([
      { control: null, reason: 'control' }, { control: 'ok', reason: 'value' }, { control: 'long', reason: 'value' }, { control: 'note', reason: 'value' },
      { control: 'c64', reason: 'controls' }
    ]));
    expect(parts.refused.filter(({ control, reason }) => control === 'ok' && reason === 'value')).toHaveLength(1);
    expect(parts.refused.length).toBeLessThanOrEqual(16);
  });

  it('mirrors its widgets, read field by field: a label clipped and made one line, a region inside the canvas, the rest dropped', async () => {
    const parts = await listening();
    parts.worker.say({
      type: TO_HOST.widgets,
      widgets: [
        { id: 'mass', kind: 'slider', label: `Mass\n${'m'.repeat(60)}`, value: 0.5, rect: [-10, 280, 220, 32] },
        { id: 'weird', kind: 'dial', label: 'x', value: 1, rect: [0, 0, 1, 1] },
        { id: 'p', kind: 'point', label: 'P', value: '0.1, 0.2', rect: [0, 0, Number.NaN, 1] },
        'junk'
      ]
    });
    expect(parts.mirrored).toEqual([[{ id: 'mass', kind: 'slider', label: `Mass ${'m'.repeat(35)}`, value: 0.5, rect: [0, 280, 210, 20] }]]);
  });
});
