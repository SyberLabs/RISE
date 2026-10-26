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

  it('marks the field as holding a picture when it mounts, and not when admission refuses it', async () => {
    const refused = makeChamber();
    refused.chamber.applyScheduledVisualCue(BAD, { transitionMs: 0 });
    await settle();
    expect(refused.container.querySelector('#chamber-field').dataset.picture).toBeUndefined();
    refused.chamber.destroy();
    const { chamber, container } = makeChamber();
    chamber.applyScheduledVisualCue(FIGURE, { transitionMs: 0 });
    expect(container.querySelector('#chamber-field').dataset.picture).toBe('figure');
    chamber.destroy();
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

describe('a change of visual under the Live venue’s shut eye (docs/plans/LIVE-CURRENT.md §23)', () => {
  const quiet = chamber => vi.spyOn(chamber._visualFieldDirector, 'applyCue').mockImplementation(() => {});

  it('crossfades as it always has unless the venue asks otherwise: the Reader and the card are unchanged', () => {
    const { chamber } = makeChamber();
    const applied = quiet(chamber);
    chamber.applyScheduledVisualCue(FALLBACK, { transitionMs: 1200 });
    expect(applied).toHaveBeenCalledTimes(1);
    expect(applied).toHaveBeenCalledWith(FALLBACK, { transitionMs: 1200 });
    expect(chamber.visualSwapHeld()).toBe(false);
    chamber.destroy();
  });

  it('asked to, holds the change until the venue says the eye is shut, then swaps at once, with no crossfade', () => {
    const { chamber } = makeChamber();
    const applied = quiet(chamber);
    chamber.setVisualSwapAtShut(true);
    chamber.applyScheduledVisualCue(FALLBACK, { transitionMs: 1200 });
    // The venue sees the new visual at once, so it can shut the eye over the old one.
    expect(chamber.visualCue()).toBe(FALLBACK);
    expect(applied).not.toHaveBeenCalled();
    expect(chamber.visualSwapHeld()).toBe(true);
    chamber.releaseVisualSwap({ shut: true });
    expect(applied).toHaveBeenCalledWith(FALLBACK, { transitionMs: 0 });
    expect(chamber.visualSwapHeld()).toBe(false);
    chamber.releaseVisualSwap({ shut: true });
    expect(applied).toHaveBeenCalledTimes(1);
    chamber.destroy();
  });

  it('released with the eye open (the same visual, a look laid over it), keeps its own crossfade', () => {
    const { chamber } = makeChamber();
    const applied = quiet(chamber);
    chamber.setVisualSwapAtShut(true);
    chamber.applyScheduledVisualCue(FALLBACK, { transitionMs: 1200 });
    chamber.releaseVisualSwap({ shut: false });
    expect(applied).toHaveBeenCalledWith(FALLBACK, { transitionMs: 1200 });
    chamber.destroy();
  });

  it('turning visuals Off, clears the field only when the venue says the eye is shut; by default at once, with its cross-fade', () => {
    const asked = makeChamber();
    quiet(asked.chamber);
    const cleared = vi.spyOn(asked.chamber._visualFieldDirector, 'clear').mockImplementation(() => {});
    asked.chamber.setVisualSwapAtShut(true);
    asked.chamber._stopVisualWork(1200);
    expect(cleared).not.toHaveBeenCalled();
    asked.chamber.releaseVisualSwap({ shut: true });
    expect(cleared).toHaveBeenCalledWith({ transitionMs: 0 });
    asked.chamber.destroy();
    const plain = makeChamber();
    quiet(plain.chamber);
    const plainCleared = vi.spyOn(plain.chamber._visualFieldDirector, 'clear').mockImplementation(() => {});
    plain.chamber._stopVisualWork(1200);
    expect(plainCleared).toHaveBeenCalledWith({ transitionMs: 1200 });
    plain.chamber.destroy();
  });

  it('let go of, makes a change it was holding at once, and holds nothing after', () => {
    const { chamber } = makeChamber();
    const applied = quiet(chamber);
    chamber.setVisualSwapAtShut(true);
    chamber.applyScheduledVisualCue(FALLBACK, { transitionMs: 1200 });
    chamber.setVisualSwapAtShut(false);
    expect(applied).toHaveBeenCalledWith(FALLBACK, { transitionMs: 1200 });
    chamber.applyScheduledVisualCue({ kind: 'field', renderer: 'attractor', config: {} }, { transitionMs: 1200 });
    expect(applied).toHaveBeenCalledTimes(2);
    expect(chamber.visualSwapHeld()).toBe(false);
    chamber.destroy();
  });
});

describe('the visual on screen, as the Live venue reads it (docs/plans/LIVE-CURRENT.md §23)', () => {
  it('says which cue is on screen, null before any and after its fallback replaced it, and only reads', async () => {
    const { chamber, container } = makeChamber();
    expect(chamber.visualCue()).toBeNull();
    chamber.applyScheduledVisualCue(FIGURE, { transitionMs: 0 });
    await settle();
    const field = container.querySelector('#chamber-field');
    const record = chamber._visualFieldDirector.active;
    const before = field.outerHTML;
    expect(chamber.visualCue()).toBe(FIGURE);
    expect(chamber.visualCue()).toBe(FIGURE);
    expect(field.outerHTML).toBe(before);
    expect(chamber._visualFieldDirector.active).toBe(record);
    chamber.applyScheduledVisualCue(BAD, { transitionMs: 0 });
    await settle();
    expect(chamber.visualCue()).toBe(FALLBACK);
    chamber.destroy();
  });

  it('leaves the Reader’s and the card’s field as it was: no layer is moved, scaled or masked by the Chamber', async () => {
    const { chamber, container } = makeChamber();
    chamber.applyScheduledVisualCue(FIGURE, { transitionMs: 0 });
    await settle();
    const field = container.querySelector('#chamber-field');
    expect(document.documentElement.hasAttribute('data-live-frame')).toBe(false);
    expect(field.getAttribute('style')).toBeNull();
    for (const layer of field.children) expect(layer.style.transform).toBe('');
    chamber.destroy();
  });
});

describe('the ink of a figure in a reading that names no theme', () => {
  it('is the words’ own colour, so a figure drawn in currentColor is never dark on the dark ground', async () => {
    const { chamber, container } = makeChamber();
    container.querySelector('#atom-display').style.color = 'rgb(238, 240, 255)';
    chamber.applyScheduledVisualCue(FIGURE, { transitionMs: 0 });
    await settle();
    const text = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blobs[0]); });
    expect(text).toContain('<svg color="#eef0ff" ');
    chamber.destroy();
  });
});

describe('a figure in a host’s own room (the Live venue’s light room)', () => {
  it('is drawn in the room’s ink with its dark in the room’s dark, over the theme’s and the words’', async () => {
    const { chamber, container } = makeChamber();
    container.querySelector('#atom-display').style.color = 'rgb(238, 240, 255)';
    const field = container.querySelector('#chamber-field');
    field.style.setProperty('--room-ink', 'rgb(23, 42, 79)');
    field.style.setProperty('--room-dark', 'rgb(14, 27, 54)');
    chamber.applyScheduledVisualCue({ ...FIGURE, svg: `<svg ${NS} viewBox="0 0 4 3"><circle class="dark" cx="2" cy="1" r="1"/></svg>` }, { transitionMs: 0 });
    await settle();
    const text = await new Promise(resolve => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.readAsText(blobs[0]); });
    expect(text).toContain('<svg color="#172a4f" ');
    expect(text).toContain('.dark{fill:#0e1b36}');
    chamber.destroy();
  });
});
