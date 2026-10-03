import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { NightSky } from './NightSky.js';

// jsdom has no canvas: src/test/setup.js gives every canvas a recording 2D
// context, and here requestAnimationFrame, matchMedia and the two observers
// are stubbed so the frame loop and its listeners can be counted.

const SKY = {
  stars: [
    { workId: 'oedipus', title: 'Oedipus Rex', author: 'Sophocles', group: 'verse', x: 68, y: 40 },
    { workId: 'meditations', title: 'Meditations', author: 'Marcus Aurelius', group: 'prose', x: 77, y: 57 },
    { workId: 'iliad', title: 'The Iliad', author: 'Homer', group: 'verse', x: 55, y: 15 },
    { workId: 'tao', title: 'Tao Te Ching', author: 'Laozi', group: 'prose', x: 86, y: 50 }
  ],
  links: [[0, 2], [1, 3]],
  groups: [
    { id: 'verse', label: 'Verse', x: 50, y: 5 },
    { id: 'prose', label: 'Prose and wisdom', x: 83, y: 85 }
  ]
};

let container;
let sky;
let frames;
let observers;

function reducedMotion(on) {
  vi.stubGlobal('matchMedia', vi.fn(query => ({
    matches: on && query.includes('reduced-motion'),
    addEventListener() {},
    removeEventListener() {}
  })));
}

function mount(options = {}) {
  container = document.createElement('div');
  document.body.append(container);
  sky = new NightSky(container, { sky: SKY, onPick: vi.fn(), ...options });
  return sky;
}

function contextOf() {
  return container.querySelector('canvas').getContext('2d');
}

beforeEach(() => {
  frames = [];
  let id = 0;
  vi.stubGlobal('requestAnimationFrame', vi.fn(callback => { frames.push(callback); return ++id; }));
  vi.stubGlobal('cancelAnimationFrame', vi.fn());
  observers = [];
  const observer = kind => class {
    constructor(callback) { this.kind = kind; this.callback = callback; this.disconnect = vi.fn(); observers.push(this); }
    observe() {}
  };
  vi.stubGlobal('IntersectionObserver', observer('intersection'));
  vi.stubGlobal('ResizeObserver', observer('resize'));
  reducedMotion(false);
});

afterEach(() => {
  sky?.destroy();
  sky = null;
  document.body.replaceChildren();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe('the night sky', () => {
  it('renders one named, positioned button per star inside a labelled group', () => {
    mount();
    const group = container.querySelector('[role="group"]');
    expect(group.getAttribute('aria-label')).toBe('The Library as a star map');
    const buttons = [...group.querySelectorAll('button.sky-star')];
    expect(buttons).toHaveLength(4);
    const oedipus = group.querySelector('[data-work-id="oedipus"]');
    expect(oedipus.type).toBe('button');
    expect(oedipus.getAttribute('aria-label')).toBe('Oedipus Rex, Sophocles');
    expect(oedipus.style.left).toBe('68%');
    expect(oedipus.style.top).toBe('40%');
    expect(oedipus.textContent).toBe('Oedipus Rex');
    expect(container.querySelector('canvas').getAttribute('aria-hidden')).toBe('true');
  });

  it('puts stars in reading order: group by group, top to bottom', () => {
    mount();
    const order = [...container.querySelectorAll('.sky-star')].map(b => b.dataset.workId);
    expect(order).toEqual(['iliad', 'oedipus', 'tao', 'meditations']);
  });

  it('draws group labels as hidden decoration at their place', () => {
    mount();
    const labels = [...container.querySelectorAll('.sky-group')];
    expect(labels.map(l => l.textContent)).toEqual(['Verse', 'Prose and wisdom']);
    expect(labels[0].closest('[aria-hidden="true"]')).not.toBeNull();
    expect(labels[1].style.left).toBe('83%');
    expect(labels[1].style.top).toBe('85%');
  });

  it('calls onPick with the work when a star is activated', () => {
    const onPick = vi.fn();
    mount({ onPick });
    container.querySelector('[data-work-id="tao"]').click();
    expect(onPick).toHaveBeenCalledWith('tao');
  });

  it('marks the flared star with is-flared, moves it, and clears it with null', () => {
    mount();
    const star = id => container.querySelector(`[data-work-id="${id}"]`);
    sky.flare('oedipus');
    expect(star('oedipus').classList.contains('is-flared')).toBe(true);
    expect(container.querySelectorAll('.is-flared')).toHaveLength(1);
    sky.flare('tao');
    expect(star('oedipus').classList.contains('is-flared')).toBe(false);
    expect(star('tao').classList.contains('is-flared')).toBe(true);
    sky.flare(null);
    expect(container.querySelectorAll('.is-flared')).toHaveLength(0);
  });

  it('runs a frame loop on start and stop cancels it and releases its listeners', () => {
    const add = vi.spyOn(document, 'addEventListener');
    const remove = vi.spyOn(document, 'removeEventListener');
    mount();
    sky.start();
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    frames.shift()(1000);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
    expect(add).toHaveBeenCalledWith('visibilitychange', expect.any(Function));

    sky.stop();
    expect(cancelAnimationFrame).toHaveBeenCalledWith(2);
    const handler = add.mock.calls.find(([type]) => type === 'visibilitychange')[1];
    expect(remove).toHaveBeenCalledWith('visibilitychange', handler);
    expect(observers.map(o => o.kind).sort()).toEqual(['intersection', 'resize']);
    for (const observer of observers) expect(observer.disconnect).toHaveBeenCalled();

    // A frame already queued by the browser must not restart the loop.
    frames.shift()?.(1100);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it('holds the loop while the tab is hidden and resumes when it returns', () => {
    mount();
    sky.start();
    const hidden = vi.spyOn(document, 'hidden', 'get').mockReturnValue(true);
    frames.shift()(1000);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    hidden.mockReturnValue(false);
    document.dispatchEvent(new Event('visibilitychange'));
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it('holds the loop while the sky is off-screen', () => {
    mount();
    sky.start();
    const io = observers.find(o => o.kind === 'intersection');
    io.callback([{ isIntersecting: false }]);
    frames.shift()(1000);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
    io.callback([{ isIntersecting: true }]);
    expect(requestAnimationFrame).toHaveBeenCalledTimes(2);
  });

  it('destroy empties the container and later calls do nothing', () => {
    mount();
    sky.start();
    sky.destroy();
    expect(container.childElementCount).toBe(0);
    expect(cancelAnimationFrame).toHaveBeenCalled();
    sky.start();
    sky.flare('oedipus');
    expect(requestAnimationFrame).toHaveBeenCalledTimes(1);
  });

  it('under reduced motion draws one still frame and schedules none', () => {
    reducedMotion(true);
    mount();
    sky.start();
    const ctx = contextOf();
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled();
    ctx.arc.mockClear();
    sky.setBusy(true);
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    sky.flare('oedipus');
    expect(requestAnimationFrame).not.toHaveBeenCalled();
    expect(ctx.arc).toHaveBeenCalled(); // the flare appears at once
  });

  it('without a 2D context keeps the stars as buttons and falls back to a CSS sky', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
    const onPick = vi.fn();
    mount({ onPick });
    sky.start();
    expect(container.querySelector('canvas')).toBeNull();
    expect(container.querySelector('.night-sky').classList.contains('night-sky--flat')).toBe(true);
    container.querySelector('[data-work-id="iliad"]').click();
    expect(onPick).toHaveBeenCalledWith('iliad');
    sky.flare('iliad');
    expect(container.querySelector('.is-flared').dataset.workId).toBe('iliad');
    expect(requestAnimationFrame).not.toHaveBeenCalled();
  });

  it('marks the busy state on the sky', () => {
    mount();
    sky.setBusy(true);
    expect(container.querySelector('.night-sky').classList.contains('is-busy')).toBe(true);
    sky.setBusy(false);
    expect(container.querySelector('.night-sky').classList.contains('is-busy')).toBe(false);
  });
});
