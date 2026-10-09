/**
 * A figure in the Chamber (CC-009): admitted again before anything is drawn,
 * shown as an image behind the reading, mounted and retired by the director
 * like any scene, and, when it is refused or cannot be drawn, giving way to
 * the reading's fallback with a diagnostic kept. No scene worker is involved.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const workers = [];
vi.mock('../../scenes/create-scene-worker.js', () => ({
  createSceneWorker: () => {
    const worker = { sent: [], postMessage(message) { this.sent.push(message); }, terminate() {} };
    workers.push(worker);
    return worker;
  }
}));

const { Chamber } = await import('./Chamber.js');

const NS = 'xmlns="http://www.w3.org/2000/svg"';
const SVG = `<svg ${NS} viewBox="0 0 4 3"><path d="M0,3 L4,3 L4,0 z" fill="currentColor"/></svg>`;
const FIGURE = { kind: 'scene', sceneId: 'triangle', svg: SVG };
const BAD = { kind: 'scene', sceneId: 'triangle', svg: `<svg ${NS} viewBox="0 0 4 3">\n  <script>alert(1)</script>\n</svg>` };
const FALLBACK = { kind: 'field', renderer: 'genesis', config: {} };
const blobs = [];

beforeEach(() => {
  workers.length = 0;
  blobs.length = 0;
  vi.stubGlobal('URL', Object.assign(class extends URL {}, {
    createObjectURL: blob => { blobs.push(blob); return `blob:figure/${blobs.length}`; },
    revokeObjectURL: () => {}
  }));
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

function makeChamber() {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const session = {
    title: 'A triangle', atoms: [], totalDuration: 0, atomCount: 0,
    visualConfig: { visualMode: 'off' },
    visualProgram: { coordinateSpace: 'source', enabled: true, segments: [], fallback: FALLBACK }
  };
  const chamber = new Chamber(container, { session, player: null, autoStart: false });
  return { chamber, container };
}

const settle = async () => { for (let i = 0; i < 5; i += 1) await new Promise(resolve => setTimeout(resolve, 0)); };

describe('a figure in the Chamber', () => {
  it('is shown as an image of a blob: URL behind the reading, with no scene worker', async () => {
    const { chamber, container } = makeChamber();
    chamber.applyScheduledVisualCue(FIGURE, { transitionMs: 0 });
    await settle();
    const record = chamber._visualFieldDirector.active;
    expect(record.renderer).toBe('figure');
    expect(record.sceneId).toBe('triangle');
    const img = container.querySelector('#chamber-field img.chamber-figure');
    expect(img).toBe(record.node);
    expect(img.getAttribute('src')).toBe('blob:figure/1');
    expect(blobs[0].type).toBe('image/svg+xml');
    expect(workers).toHaveLength(0);
    chamber.destroy();
    expect(img.isConnected).toBe(false);
  });

  it('runs its holds on their ms: a figure ends no hold early', async () => {
    const { chamber } = makeChamber();
    chamber.applyScheduledVisualCue(FIGURE, { transitionMs: 0 });
    await settle();
    expect(chamber.holdScene({ hold: { ms: 2000, maxMs: 5000, sceneId: 'triangle' } })).toBeNull();
    chamber.destroy();
  });

  it('is refused before anything is mounted when the card’s admission refuses it, says why, and gives way to the fallback', async () => {
    const heard = [];
    const listen = event => heard.push(event.detail);
    window.addEventListener('rise-scene-diagnostic', listen);
    const { chamber, container } = makeChamber();
    const applied = vi.spyOn(chamber, 'applyScheduledVisualCue');
    chamber.applyScheduledVisualCue(BAD, { transitionMs: 0 });
    await settle();
    window.removeEventListener('rise-scene-diagnostic', listen);
    expect(blobs).toHaveLength(0);
    expect(container.querySelector('img.chamber-figure')).toBeNull();
    expect(heard).toEqual([{ sceneId: 'triangle', phase: 'admission', message: 'line 2, column 3: <script> is not an element a figure may use', where: null }]);
    expect(chamber.sceneDiagnostics).toEqual(heard);
    expect(applied).toHaveBeenCalledWith(FALLBACK, expect.anything());
    expect(chamber._visualFieldDirector.active?.renderer).not.toBe('figure');
    chamber.destroy();
  });

  it('gives way to the fallback when the image cannot be drawn, and is not tried again', async () => {
    const { chamber, container } = makeChamber();
    chamber.applyScheduledVisualCue(FIGURE, { transitionMs: 0 });
    await settle();
    const applied = vi.spyOn(chamber, 'applyScheduledVisualCue');
    container.querySelector('img.chamber-figure').dispatchEvent(new Event('error'));
    expect(chamber.sceneDiagnostics).toEqual([{ sceneId: 'triangle', phase: 'image', message: 'the figure could not be drawn as an image', where: null }]);
    expect(applied).toHaveBeenCalledWith(FALLBACK, expect.anything());
    chamber.applyScheduledVisualCue(FIGURE, { transitionMs: 0 });
    await settle();
    expect(blobs).toHaveLength(1);
    expect(chamber._visualFieldDirector.active?.renderer).not.toBe('figure');
    chamber.destroy();
  });

  it('is taken down when the next scene starts', async () => {
    const { chamber, container } = makeChamber();
    chamber.applyScheduledVisualCue(FIGURE, { transitionMs: 0 });
    await settle();
    const img = container.querySelector('img.chamber-figure');
    chamber.applyScheduledVisualCue({ kind: 'scene', sceneId: 'square', svg: SVG.replace('L4,0', 'L0,0') }, { transitionMs: 0 });
    await settle();
    expect(img.isConnected).toBe(false);
    expect(chamber._visualFieldDirector.active.sceneId).toBe('square');
    expect(container.querySelectorAll('img.chamber-figure')).toHaveLength(1);
    chamber.destroy();
  });
});
