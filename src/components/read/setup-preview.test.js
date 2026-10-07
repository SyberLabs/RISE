/**
 * The live preview on Reader setup's first screen (RDR-021).
 *
 * The chosen look's field in its colour, through the Visual Navigator's live
 * stage, with the reading's first unit over it. It draws only while it may be
 * seen, holds one still frame when motion is unwelcome, and under
 * `?measure=1` keeps a record of what its frames cost.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createSetupPreview, firstUnit } from './setup-preview.js';

const STILL = 'https://rise.test/still.webp';
const MORNING = 'Begin the morning by saying to thyself, I shall meet with the busy-body. The rest follows.';

let host = null;
let preview = null;
let built = [];

const factories = {
  attractor: async (_host, style) => {
    const record = { style, destroyed: false };
    record.destroy = () => { record.destroyed = true; };
    built.push(record);
    return record;
  }
};
const living = () => built.filter(record => !record.destroyed);
const settle = async (ms = 0) => {
  await vi.advanceTimersByTimeAsync(ms);
  await Promise.resolve();
};
const scene = (overrides = {}) => ({
  engine: 'attractor', style: { system: 'aizawa' },
  ground: '#08090F', ink: '#F4EEE4', unit: 'Begin the morning', ...overrides
});
const still = () => host.querySelector('.setup-preview-still').style.backgroundImage;
const setHidden = hidden => {
  Object.defineProperty(document, 'visibilityState', { configurable: true, value: hidden ? 'hidden' : 'visible' });
  document.dispatchEvent(new Event('visibilitychange'));
};

beforeEach(() => {
  vi.useFakeTimers();
  built = [];
  host = document.createElement('div');
  document.body.appendChild(host);
});

afterEach(() => {
  preview?.destroy();
  preview = null;
  host.remove();
  document.documentElement.classList.remove('reduced-motion', 'photosensitivity-mode');
  setHidden(false);
  vi.useRealTimers();
});

describe('what the preview shows', () => {
  it('lays the unit over the look\'s ground in the look\'s ink', () => {
    preview = createSetupPreview(host, { factories, loadStill: async () => STILL });
    preview.show(scene());

    expect(host.querySelector('.setup-preview-unit').textContent).toBe('Begin the morning');
    expect(host.style.getPropertyValue('--preview-ground')).toBe('#08090F');
    expect(host.style.getPropertyValue('--preview-ink')).toBe('#F4EEE4');
  });

  it('draws the field live after a dwell, over a still of the same engine', async () => {
    const loadStill = vi.fn(async () => STILL);
    preview = createSetupPreview(host, { factories, loadStill });
    preview.show(scene());
    await settle(0);
    expect(loadStill).toHaveBeenCalledWith('attractor');
    expect(still()).toContain(STILL);

    await settle(600);
    expect(living()).toHaveLength(1);
    expect(living()[0].style).toEqual({ system: 'aizawa' });
  });

  it('draws no field for a look without one, only the ground and the unit', async () => {
    const loadStill = vi.fn(async () => STILL);
    preview = createSetupPreview(host, { factories, loadStill });
    preview.show(scene({ engine: null, unit: 'Plainly' }));
    await settle(1000);

    expect(built).toHaveLength(0);
    expect(loadStill).not.toHaveBeenCalled();
    expect(still()).toBe('');
    expect(host.querySelector('.setup-preview-unit').textContent).toBe('Plainly');
  });

  it('changing the field drops the old still and the old engine', async () => {
    const loadStill = vi.fn(async id => (id === 'turrell' ? 'https://rise.test/turrell.webp' : STILL));
    preview = createSetupPreview(host, { factories, loadStill });
    preview.show(scene());
    await settle(600);
    expect(living()).toHaveLength(1);

    preview.show(scene({ engine: 'turrell' }));
    await settle(1000);
    expect(living()).toHaveLength(0);
    expect(still()).toContain('turrell.webp');

    preview.show(scene({ engine: null }));
    await settle(0);
    expect(still()).toBe('');
  });

  it('a still that arrives after the field changed is not painted', async () => {
    let release;
    const loadStill = vi.fn(id => (id === 'turrell'
      ? new Promise(resolve => { release = () => resolve('https://rise.test/turrell.webp'); })
      : Promise.resolve(null)));
    preview = createSetupPreview(host, { factories, loadStill });
    preview.show(scene({ engine: 'turrell' }));
    preview.show(scene({ engine: null }));
    release();
    await settle(0);
    expect(still()).toBe('');
  });
});

describe('one still frame when motion is unwelcome', () => {
  it('under reduced motion it paints the still and never mounts the engine', async () => {
    document.documentElement.classList.add('reduced-motion');
    preview = createSetupPreview(host, { factories, loadStill: async () => STILL });
    preview.show(scene());
    await settle(1000);
    expect(built).toHaveLength(0);
    expect(still()).toContain(STILL);
  });

  it('under photosensitivity mode it does the same', async () => {
    document.documentElement.classList.add('photosensitivity-mode');
    preview = createSetupPreview(host, { factories, loadStill: async () => STILL });
    preview.show(scene());
    await settle(1000);
    expect(built).toHaveLength(0);
    expect(still()).toContain(STILL);
  });
});

describe('drawing only while it may be seen', () => {
  it('a hidden tab releases the engine and a visible one brings it back', async () => {
    preview = createSetupPreview(host, { factories, loadStill: async () => STILL });
    preview.show(scene());
    await settle(600);
    setHidden(true);
    expect(living()).toHaveLength(0);
    setHidden(false);
    await settle(600);
    expect(living()).toHaveLength(1);
  });

  it('a suspension holds until its own reason is lifted, and keeps the still', async () => {
    preview = createSetupPreview(host, { factories, loadStill: async () => STILL });
    preview.show(scene());
    await settle(600);
    preview.suspend('sheet');
    expect(living()).toHaveLength(0);
    expect(still()).toContain(STILL);
    preview.show(scene({ unit: 'Another' }));
    await settle(1000);
    expect(living()).toHaveLength(0);
    preview.resume('sheet');
    await settle(600);
    expect(living()).toHaveLength(1);
  });

  it('destroy releases the engine and nothing comes back', async () => {
    preview = createSetupPreview(host, { factories, loadStill: async () => STILL });
    preview.show(scene());
    await settle(600);
    expect(living()).toHaveLength(1);
    preview.destroy();
    preview.show(scene());
    preview.resume('sheet');
    await settle(1000);
    expect(living()).toHaveLength(0);
  });
});

describe('the measurement record', () => {
  const frameWindow = search => {
    const queue = [];
    return {
      location: { search },
      requestAnimationFrame: vi.fn(callback => queue.push(callback)),
      cancelAnimationFrame: vi.fn(),
      frame(now) {
        queue.splice(0).forEach(callback => callback(now));
      }
    };
  };

  it('is kept when the page was opened with ?measure=1 and the router has since dropped the query', async () => {
    const win = { ...frameWindow(''), document: { documentElement: { dataset: { riseMeasure: '' } } } };
    preview = createSetupPreview(host, { factories, loadStill: async () => STILL, win });
    expect(win.__riseSetupPreview).toBeDefined();
  });

  it('is not kept, and no frame is watched, without ?measure=1', async () => {
    const win = frameWindow('');
    preview = createSetupPreview(host, { factories, loadStill: async () => STILL, win });
    preview.show(scene());
    await settle(600);
    expect(win.__riseSetupPreview).toBeUndefined();
    expect(win.requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('counts the frames drawn while the field is live, the longest, and the share over 16.7 and 33 ms', async () => {
    const win = frameWindow('?measure=1');
    preview = createSetupPreview(host, { factories, loadStill: async () => STILL, win });
    preview.show(scene());
    win.frame(0);
    win.frame(100);
    const record = win.__riseSetupPreview;
    expect(record.frames).toBe(0);

    await settle(600);
    win.frame(1000);
    win.frame(1016);
    win.frame(1050);
    win.frame(1060);

    expect(record.frames).toBe(3);
    expect(record.longestFrameMs).toBe(34);
    expect(record.shareOver16_7ms).toBeCloseTo(1 / 3);
    expect(record.shareOver33ms).toBeCloseTo(1 / 3);
    expect(() => { record.frames = 0; }).toThrow(TypeError);
  });

  it('does not count the gap across a suspension as a frame', async () => {
    const win = frameWindow('?measure=1');
    preview = createSetupPreview(host, { factories, loadStill: async () => STILL, win });
    preview.show(scene());
    await settle(600);
    win.frame(0);
    win.frame(16);
    preview.suspend('sheet');
    win.frame(5000);
    preview.resume('sheet');
    await settle(600);
    win.frame(9000);
    win.frame(9010);

    expect(win.__riseSetupPreview.frames).toBe(2);
    expect(win.__riseSetupPreview.longestFrameMs).toBe(16);
  });
});

describe('the first unit', () => {
  it('is cut in the chosen rhythm, as the session compiler cuts it', () => {
    expect(firstUnit({ text: MORNING, chunkMode: 'phrase' })).toBe('Begin the morning by saying to thyself,');
    expect(firstUnit({ text: MORNING, chunkMode: 'sentence' }))
      .toBe('Begin the morning by saying to thyself, I shall meet with the busy-body.');
    expect(firstUnit({ text: MORNING, chunkMode: 'word' })).toBe('Begin');
  });

  it('reads the first source where the reading has several', () => {
    const sources = [
      { id: 'a', name: 'A', type: 'text', data: 'First of all, the first.' },
      { id: 'b', name: 'B', type: 'text', data: 'Second.' }
    ];
    expect(firstUnit({ text: 'ignored', sources, chunkMode: 'word' })).toBe('First');
  });

  it('is found in a text longer than a session may hold', () => {
    const text = `${MORNING} ${'more '.repeat(2_000_000)}`;
    expect(firstUnit({ text, chunkMode: 'phrase' })).toBe('Begin the morning by saying to thyself,');
  });

  it('is empty without a text', () => {
    expect(firstUnit({ text: null, chunkMode: 'phrase' })).toBe('');
  });
});
