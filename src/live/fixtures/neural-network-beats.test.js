/**
 * The demonstration of interactive scenes (docs/plans/LIVE-CURRENT.md §20): the neural network the reader moves, and
 * the scene that misbehaves. Each is sealed as a model's answer is and accepted by the Worker; each scene's own code
 * runs in the scene worker against a fake scope and is driven with the reader's inputs as the host sends them.
 */
import vm from 'node:vm';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { dispatch } from '../../../worker/mcp-server.mjs';
import { admitSceneCode, sceneRefusal } from '../../core/scene-admission.js';
import { SCENE_LIMITS, TO_HOST, TO_WORKER } from '../../scenes/scene-protocol.js';
import { attachSceneWorker } from '../../scenes/scene-worker.js';
import { fakeCanvasContext } from '../../test/fake-canvas-context.js';
import { createEventWriter } from '../adapter.js';
import { createSegmentParser } from '../adapters/segment-parser.js';
import { TOOL_NAME } from '../guide/index.js';
import { createCurrentStream } from '../stream.js';
import { beatsTextFor } from './black-holes-beats.js';
import { NETWORK_SCENE, NETWORK_TEXT, UNRULY_SCENE, UNRULY_TEXT } from './neural-network-beats.js';

function seal(text) {
  const writer = createEventWriter('demo');
  const stream = createCurrentStream({ admitScene: sceneRefusal });
  stream.apply(writer.next('current.open', { title: 'Demo', origin: { kind: 'model', name: 'RISE demo', provider: 'RISE' } }));
  const parser = createSegmentParser((type, body) => stream.apply(writer.next(type, body)));
  parser.push(text);
  parser.finish();
  stream.apply(writer.next('current.complete', {}));
  return stream;
}

/** The scene's module as the worker would import it: its source run as a function in a realm of its own. */
function moduleOf(code, realm) {
  const body = code.replace('export default function scene', 'return function scene');
  return { default: realm.run(`(function () { ${body} })()`) };
}

function running(code) {
  const context = vm.createContext({ Math });
  const realm = { run: source => vm.runInContext(source, context) };
  const posted = [];
  const scope = { postMessage: message => posted.push(message), addEventListener: () => {}, close: () => {} };
  const worker = attachSceneWorker(scope, {
    toUrl: () => 'blob:rise/demo',
    load: async () => moduleOf(code, realm),
    functionPrototypes: realm.run('[Function.prototype, Object.getPrototypeOf(async function () {}), Object.getPrototypeOf(function* () {}), Object.getPrototypeOf(async function* () {})]')
  });
  const canvas = { width: 0, height: 0, getContext: () => fakeCanvasContext() };
  const init = () => worker.handle({ type: TO_WORKER.init, version: 1, code, width: 800, height: 600, dpr: 1, theme: {}, reducedMotion: false, canvas });
  const NONE = { shift: false, alt: false, ctrl: false, meta: false };
  const pointer = (kind, x, y, buttons = 1) => worker.handle({ type: TO_WORKER.input, kind, x, y, buttons, key: null, modifiers: NONE });
  const key = name => worker.handle({ type: TO_WORKER.input, kind: 'keydown', x: null, y: null, buttons: 0, key: name, modifiers: NONE });
  const of = type => posted.filter(message => message.type === type);
  return { worker, init, pointer, key, of };
}

class FakeOffscreenCanvas {
  getContext() { return { clearRect() {}, drawImage() {}, getImageData: () => ({ data: new Uint8ClampedArray(256) }) }; }
}
beforeEach(() => vi.stubGlobal('OffscreenCanvas', FakeOffscreenCanvas));
afterEach(() => vi.unstubAllGlobals());

describe('the neural network the reader moves', () => {
  it('is asked for by its question, admitted, sealed whole as a model writes it, and accepted by the Worker', async () => {
    expect(beatsTextFor({ intent: 'answer', prompt: 'How does a neural network learn?' })).toBe(NETWORK_TEXT);
    expect(admitSceneCode(NETWORK_SCENE)).toEqual({ ok: true });
    const stream = seal(NETWORK_TEXT);
    expect(stream.refusedScenes).toEqual([]);
    const current = stream.toCurrent();
    expect(current.scenes).toEqual([{ id: 'network', code: NETWORK_SCENE }]);
    expect(current.beats.filter(beat => beat.hold)).toHaveLength(2);
    const response = dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: TOOL_NAME, arguments: { current } } }, 'https://rise.invalid');
    const { result } = await response.json();
    expect(result.isError, result.content?.map(item => item.text).join('\n')).not.toBe(true);
  });

  it('listens, mirrors its three widgets, and says what the reader set: a weight pressed, the input dragged, a weight by its key', async () => {
    const scene = running(NETWORK_SCENE);
    await scene.init();
    expect(scene.of(TO_HOST.error)).toEqual([]);
    expect(scene.of(TO_HOST.ready)[0].listens).toEqual(['pointer', 'keys']);
    const widgets = scene.of(TO_HOST.widgets).at(-1).widgets;
    expect(widgets.map(({ id, kind, label, value }) => [id, kind, label, value])).toEqual([
      ['w1', 'slider', 'Weight 1', 1], ['w2', 'slider', 'Weight 2', -0.5], ['input', 'point', 'Input', '0.5, 0.5']
    ]);
    // Weight 1's track runs from x 28 to 198 at y 48: three quarters along is 1.
    await scene.pointer('pointerdown', 28 + 170 * 0.25, 48);
    await scene.pointer('pointerup', 28 + 170 * 0.25, 48, 0);
    const [ix, iy, iw] = widgets[2].rect;
    await scene.pointer('pointerdown', ix + iw / 2, iy + iw / 2);
    await scene.pointer('pointermove', ix + iw / 2 - 60, iy + iw / 2 + 30);
    await scene.pointer('pointerup', ix + iw / 2 - 60, iy + iw / 2 + 30, 0);
    await scene.key('2');
    await scene.key('ArrowRight');
    const told = scene.of(TO_HOST.emit).flatMap(message => message.changes);
    expect(told[0]).toEqual(['w1', -1]);
    expect(told.filter(([control]) => control === 'input').length).toBeGreaterThanOrEqual(1);
    expect(told.at(-1)).toEqual(['w2', -0.4]);
    expect(scene.of(TO_HOST.emit).flatMap(message => message.refused)).toEqual([]);
    await scene.worker.handle({ type: TO_WORKER.frame, t: 16, dt: 16 });
    expect(scene.of(TO_HOST.error)).toEqual([]);
  });
});

describe('the scene that misbehaves', () => {
  it('is asked for by its question and admitted: what it does wrong is done while it runs', () => {
    expect(beatsTextFor({ intent: 'answer', prompt: 'Show me a scene that misbehaves' })).toBe(UNRULY_TEXT);
    expect(seal(UNRULY_TEXT).refusedScenes).toEqual([]);
  });

  it('is bounded in the worker: one message a press, the latest value, 64 controls, its junk refused by reason', async () => {
    const scene = running(UNRULY_SCENE);
    await scene.init();
    await scene.pointer('pointerdown', 10, 10);
    const [first, ...rest] = scene.of(TO_HOST.emit).slice(-1);
    expect(rest).toEqual([]);
    expect(first.changes).toHaveLength(SCENE_LIMITS.emitControls);
    expect(first.changes[0]).toEqual(['count', 1999]);
    expect(first.refused).toEqual(expect.arrayContaining([['shape', 'value'], ['note', 'value'], ['c63', 'controls']]));
    await scene.worker.handle({ type: TO_WORKER.frame, t: 16, dt: 16 });
    expect(scene.of(TO_HOST.emit).at(-1)).toEqual({ type: TO_HOST.emit, changes: [], refused: [['count', 'unprompted']] });
    expect(scene.of(TO_HOST.error)).toEqual([]);
  });
});
