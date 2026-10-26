import { afterEach, describe, expect, it, vi } from 'vitest';
import { Chamber } from './Chamber.js';
import { buildJevVisualProgram } from '../../core/jev-sequence.js';
import { visualCortex } from '../../visuals/visual-cortex.js';

const atoms = [
  { content: 'First', duration: 1000, sourceId: 'primary', sourceProgress: 0 },
  { content: 'Second', duration: 1000, sourceId: 'primary', sourceProgress: 0.2 },
  { content: 'Third', duration: 1000, sourceId: 'primary', sourceProgress: 0.8 }
];

function session(overrides = {}) {
  return {
    title: 'A Jev reading', atoms, totalDuration: 3000, wpm: 200,
    origin: { view: 'home', experience: 'jev' },
    visualConfig: { visualMode: 'interlocution', interlocution: { presentation: 'continuous' } },
    visualProgram: buildJevVisualProgram({
      visualArc: 'dual', arcSplit: '70', visualEngine: 'klee',
      middleEngine: 'turrell', finaleEngine: 'fractal',
      colorTheme: 'classic', middleTheme: 'amethyst', finaleTheme: 'prism'
    }),
    ...overrides
  };
}

function mount(reading) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const chamber = new Chamber(container, { session: reading, player: null });
  chamber.player = { state: 'playing' };
  return { chamber, container };
}

afterEach(() => {
  document.body.replaceChildren();
  document.documentElement.classList.remove('reduced-motion', 'photosensitivity-mode');
  vi.restoreAllMocks();
});

describe('reader steering of a Jev visual arc', () => {
  it('brings Jev’s next admitted scene forward while holding text, place, and pace', () => {
    const reading = session();
    const { chamber, container } = mount(reading);
    vi.spyOn(visualCortex, 'isCuePrepared').mockReturnValue(true);
    const cue = vi.spyOn(chamber, 'applyScheduledVisualCue').mockReturnValue(true);
    const button = container.querySelector('#jev-next-scene');
    expect(button).not.toBeNull();

    chamber._updateJevSceneControl(atoms[1]);
    expect(button.disabled).toBe(false);
    button.click();

    expect(reading.visualProgram.segments.map(item => item.match.toProgress)).toEqual([0.2, 1]);
    expect(cue).toHaveBeenCalledWith(
      expect.objectContaining({ kind: 'procedural', collections: ['fractal'] }),
      expect.any(Object)
    );
    expect(reading.atoms).toBe(atoms);
    expect(chamber.currentWpm).toBe(200);
    expect(button.disabled).toBe(true);
    expect(reading.jevSceneShifted).toBe(true);
    expect(container.querySelector('#jev-scene-status').textContent).toContain('selected');

    // The chosen timing persists in the in-memory session across a Chamber recreation.
    chamber.destroy();
    const reopened = mount(reading);
    expect(reopened.chamber._visualSchedule.program.segments[0].match.toProgress).toBe(0.2);
    reopened.chamber._updateJevSceneControl(atoms[1]);
    expect(reopened.container.querySelector('#jev-next-scene').disabled).toBe(true);
    reopened.chamber.destroy();
  });

  it('allows only one shift even when a Jev arc has three scenes', async () => {
    const reading = session({ visualProgram: buildJevVisualProgram({
      visualArc: 'triple', arcSplit: '50', visualEngine: 'klee',
      middleEngine: 'turrell', finaleEngine: 'fractal',
      colorTheme: 'classic', middleTheme: 'amethyst', finaleTheme: 'prism'
    }) });
    const { chamber, container } = mount(reading);
    vi.spyOn(visualCortex, 'isCuePrepared').mockReturnValue(true);
    vi.spyOn(chamber, 'applyScheduledVisualCue').mockReturnValue(true);
    chamber._updateJevSceneControl(atoms[1]);
    expect(await chamber.advanceJevScene()).toBe(true);
    chamber._updateJevSceneControl({ ...atoms[1], sourceProgress: 0.4 });
    expect(container.querySelector('#jev-next-scene').disabled).toBe(true);
    chamber.destroy();
  });

  it('offers Shift only during playing and reveals controls on touch', async () => {
    const reading = session();
    const { chamber, container } = mount(reading);
    const button = container.querySelector('#jev-next-scene');
    chamber._updateJevSceneControl(atoms[1]);
    expect(button.disabled).toBe(false);
    chamber.player.state = 'paused';
    chamber._updateJevSceneControl(atoms[1]);
    expect(button.disabled).toBe(true);
    expect(await chamber.advanceJevScene()).toBe(false);
    chamber.player.state = 'playing';
    chamber._updateJevSceneControl(atoms[1]);
    expect(button.disabled).toBe(false);
    chamber.toggleRhythmicVisuals(false);
    expect(button.disabled).toBe(true);
    chamber.toggleRhythmicVisuals(true);
    expect(button.disabled).toBe(false);
    const touch = new Event('pointerdown', { bubbles: true });
    Object.defineProperty(touch, 'pointerType', { value: 'touch' });
    container.querySelector('#chamber-display').dispatchEvent(touch);
    expect(container.querySelector('#chamber-controls').style.opacity).toBe('1');
    chamber.destroy();
  });

  it('keeps the original arc when the next scene cannot be prepared', async () => {
    const reading = session();
    const original = reading.visualProgram;
    const { chamber, container } = mount(reading);
    vi.spyOn(visualCortex, 'isCuePrepared').mockReturnValue(false);
    vi.spyOn(visualCortex, 'prepareCue').mockResolvedValue(false);
    chamber._updateJevSceneControl(atoms[1]);

    expect(await chamber.advanceJevScene()).toBe(false);
    expect(reading.visualProgram).toBe(original);
    expect(container.querySelector('#jev-scene-status').textContent)
      .toContain('could not be prepared');
    chamber.destroy();
  });

  it('retains the outgoing field when an admitted Astronomy image cannot decode in the card', async () => {
    const { chamber } = mount(session());
    const director = { applyCue: vi.fn() };
    chamber._visualFieldDirector = director;
    // A host's image policy rejection reaches the same decode failure as an unreachable image.
    const originalDecode = HTMLImageElement.prototype.decode;
    const decode = vi.fn().mockRejectedValue(new DOMException('Image blocked by policy', 'EncodingError'));
    HTMLImageElement.prototype.decode = decode;
    vi.spyOn(visualCortex, 'resolveCollectionWorks').mockResolvedValue([{
      name: 'Astronomy work', data: { url: 'https://cdn.esahubble.org/archives/images/screen/heic2017a.jpg' }
    }]);
    vi.spyOn(visualCortex, 'applyCue').mockImplementation(() => {});
    const present = vi.spyOn(visualCortex, 'presentPreparedCue');
    const cue = { kind: 'sourced', collections: ['sci-astronomy'] };
    try {
      expect(chamber._presentScheduledVisualCue(cue)).toBe(false);
      expect(await visualCortex.prepareCue(cue)).toBe(false);
      await Promise.resolve();
      expect(decode).toHaveBeenCalled();
      expect(visualCortex.isCuePrepared(cue)).toBe(false);
      expect(present).not.toHaveBeenCalled();
      expect(director.applyCue).not.toHaveBeenCalled();
    } finally {
      if (originalDecode) HTMLImageElement.prototype.decode = originalDecode;
      else delete HTMLImageElement.prototype.decode;
      chamber._visualFieldDirector = null;
      chamber.destroy();
    }
  });

  it('ignores a prepared scene if the reader moved into Page before it arrived', async () => {
    const reading = session();
    const original = reading.visualProgram;
    const { chamber } = mount(reading);
    vi.spyOn(visualCortex, 'isCuePrepared').mockReturnValue(false);
    let finishPreparation;
    vi.spyOn(visualCortex, 'prepareCue').mockReturnValue(new Promise(resolve => {
      finishPreparation = resolve;
    }));
    chamber._updateJevSceneControl(atoms[1]);
    const pending = chamber.advanceJevScene();
    chamber.pageModeActive = true;
    finishPreparation(true);

    expect(await pending).toBe(false);
    expect(reading.visualProgram).toBe(original);
    chamber.destroy();
  });

  it('keeps the control out of ordinary, single-scene, and safety-limited readings', () => {
    for (const reading of [
      session({ origin: { view: 'home' } }),
      session({ visualProgram: null }),
      session({ projection: 'page' }),
      session({ visualConfig: { visualMode: 'interlocution', interlocution: { presentation: 'behind-stream' } } })
    ]) {
      const { chamber, container } = mount(reading);
      expect(container.querySelector('#jev-next-scene')).toBeNull();
      chamber.destroy();
    }

    document.documentElement.classList.add('photosensitivity-mode');
    const { chamber, container } = mount(session());
    chamber._updateJevSceneControl(atoms[1]);
    expect(container.querySelector('#jev-next-scene').disabled).toBe(true);
    document.documentElement.classList.remove('photosensitivity-mode');
    chamber.pageModeActive = true;
    chamber._updateJevSceneControl(atoms[1]);
    expect(container.querySelector('#jev-next-scene').disabled).toBe(true);
    chamber.destroy();
  });
});
