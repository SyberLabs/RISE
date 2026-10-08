/**
 * A generated scene in the Chamber: mounted by the director like a field, cued
 * through the visual-control path, holding the beats it runs under, and, when
 * it fails, giving way to the reading's fallback with a diagnostic kept.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { TO_HOST, TO_WORKER } from '../../scenes/scene-protocol.js';

const workers = [];
vi.mock('../../scenes/create-scene-worker.js', () => ({
  createSceneWorker: () => {
    const worker = {
      sent: [], terminated: false, onmessage: null, onerror: null,
      postMessage(message) { this.sent.push(message); },
      terminate() { this.terminated = true; },
      say(data) { this.onmessage?.({ data }); },
      of(type) { return this.sent.filter(message => message.type === type); }
    };
    workers.push(worker);
    return worker;
  }
}));

const { Chamber } = await import('./Chamber.js');

const CODE = 'export const reportsCompletion = true; export default () => ({ frame() {} });';
const SCENE = { kind: 'scene', sceneId: 'vector', code: CODE };
const FALLBACK = { kind: 'field', renderer: 'genesis', config: {} };

beforeEach(() => {
  workers.length = 0;
  HTMLCanvasElement.prototype.transferControlToOffscreen = function transfer() { return { offscreen: true }; };
});

afterEach(() => {
  delete HTMLCanvasElement.prototype.transferControlToOffscreen;
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function makeChamber() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const session = {
    title: 'A vector', atoms: [], totalDuration: 0, atomCount: 0,
    visualConfig: { visualMode: 'off' },
    visualProgram: { coordinateSpace: 'source', enabled: true, segments: [], fallback: FALLBACK }
  };
  const chamber = new Chamber(container, { session, player: null, autoStart: false });
  return { chamber, container };
}

/** Let the lazily imported worker factory resolve and the scene start. */
const settle = async () => { for (let i = 0; i < 10; i += 1) await new Promise(resolve => setTimeout(resolve, 0)); };

async function mounted() {
  const { chamber, container } = makeChamber();
  chamber._visualFieldDirector.applyCue(SCENE, { transitionMs: 0 });
  await settle();
  const [worker] = workers;
  worker.say({ type: TO_HOST.ready, reportsCompletion: true });
  return { chamber, container, worker, record: chamber._visualFieldDirector.active };
}

describe('a generated scene in the Chamber', () => {
  it('draws on a canvas behind the reading, given to a worker with the code', async () => {
    const { chamber, container, worker, record } = await mounted();
    expect(record.renderer).toBe('scene');
    expect(container.querySelector('#chamber-field canvas.chamber-scene')).toBe(record.node);
    expect(worker.of(TO_WORKER.init)[0]).toMatchObject({ code: CODE, reducedMotion: false });
    chamber.destroy();
    expect(worker.terminated).toBe(true);
  });

  it('takes a cue by name through the visual-control path', async () => {
    const { chamber, worker } = await mounted();
    vi.spyOn(chamber, 'visualShown').mockReturnValue(true);
    expect(chamber.discoverVisual().manifest.surface).toBe('scene');
    expect(chamber.controlVisual({ surface: 'scene', parameter: 'cue', value: 'rotate' }))
      .toEqual({ status: 'accepted', surface: 'scene', parameter: 'cue', requested: 'rotate', effective: 'rotate' });
    expect(worker.of(TO_WORKER.cue)).toEqual([{ type: TO_WORKER.cue, name: 'rotate', instant: false }]);
    expect(chamber.controlVisual({ surface: 'scene', parameter: 'cue', value: 'two words' }).status).toBe('refused');
    chamber.destroy();
  });

  it('holds a beat of its own scene, and no other', async () => {
    const { chamber, worker } = await mounted();
    expect(chamber.holdScene({ hold: { ms: 2000, maxMs: 5000, sceneId: 'other' } })).toBeNull();
    expect(chamber.holdScene({ content: 'words' })).toBeNull();
    const held = chamber.holdScene({ hold: { ms: 2000, maxMs: 5000, sceneId: 'vector' } });
    let result = null;
    held.then(value => { result = value; });
    await new Promise(resolve => setTimeout(resolve, 250));
    worker.say({ type: TO_HOST.done });
    await settle();
    expect(result).toEqual({ reason: 'ended' });
    chamber.destroy();
  });

  it('gives way to the reading’s fallback when the scene fails, keeps the diagnostic, and does not try that scene again', async () => {
    const { chamber, worker } = await mounted();
    const applied = vi.spyOn(chamber, 'applyScheduledVisualCue');
    worker.say({ type: TO_HOST.error, phase: 'frame', message: 'TypeError: v.draw is not a function', where: 'scene.js:3:9' });
    expect(worker.terminated).toBe(true);
    expect(chamber.sceneDiagnostics).toEqual([{ sceneId: 'vector', phase: 'frame', message: 'TypeError: v.draw is not a function', where: 'scene.js:3:9' }]);
    expect(applied).toHaveBeenCalledWith(FALLBACK, expect.anything());
    expect(chamber._visualFieldDirector.active.renderer).not.toBe('scene');
    // The next beat under the same scene draws the fallback, not the scene again.
    chamber.applyScheduledVisualCue(SCENE, { transitionMs: 0 });
    expect(workers).toHaveLength(1);
    expect(chamber._visualFieldDirector.active?.renderer).not.toBe('scene');
    chamber.destroy();
  });

  it('tells the page of each diagnostic it keeps, so a host can report it (CC-006)', async () => {
    const heard = [];
    const listen = event => heard.push(event.detail);
    window.addEventListener('rise-scene-diagnostic', listen);
    const { chamber, worker } = await mounted();
    worker.say({ type: TO_HOST.error, phase: 'init', message: 'Error: no', where: null });
    expect(heard).toEqual([{ sceneId: 'vector', phase: 'init', message: 'Error: no', where: null }]);
    window.removeEventListener('rise-scene-diagnostic', listen);
    chamber.destroy();
  });

  it('freezes a scene that would flash, and says so', async () => {
    const { chamber, worker } = await mounted();
    chamber._visualFieldDirector.active.resume();
    for (let t = 0; t <= 1000; t += 100) worker.say({ type: TO_HOST.luma, value: (t / 100) % 2 ? 0.95 : 0.05, t });
    expect(chamber.sceneDiagnostics.map(item => item.phase)).toEqual(['flash']);
    expect(worker.terminated).toBe(false);
    chamber.destroy();
  });
});
