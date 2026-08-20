// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import App from './app.js';
import { BetaGate } from './components/BetaGate.js';
import { Rosarium } from './components/Rosarium.js';
import { ROSARY_PRAYERS, mysterySetForDate } from './content/chapel/liturgy/rosary.js';
import { isRosaryDoor, rosaryDoorHref, ROSARY_DOOR_HASH } from './core/rosary-door.js';
import * as sources from './sources/index.js';

const VIEW_IDS = [
  'view-portal', 'view-vault', 'view-chamber', 'view-library',
  'view-journeys', 'view-workshop', 'view-sol', 'view-chapel',
  'view-rosarium', 'view-via', 'view-curia', 'view-scriptorium',
  'view-settings'
];

function plantShell() {
  for (const id of VIEW_IDS) {
    const el = document.createElement('div');
    el.id = id;
    el.className = 'view-container';
    el.hidden = true;
    document.body.appendChild(el);
  }
  const toast = document.createElement('div');
  toast.id = 'toast-container';
  document.body.appendChild(toast);
}

function openSession() {
  return {
    code: 'open',
    name: 'Reader',
    vault: null,
    timestamp: Date.now()
  };
}

function prayerText() {
  return document.querySelector('.rosarium-prayer-text')?.textContent ?? null;
}

function stubMedia() {
  HTMLImageElement.prototype.decode = vi.fn().mockRejectedValue(new Error('stillness'));
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.load = vi.fn();
  HTMLMediaElement.prototype.pause = vi.fn();
}

describe('Chapel Rosary door (#rosary)', () => {
  let app;

  beforeEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
    window.location.hash = '';
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      value: vi.fn(() => ({
        matches: false,
        addEventListener() {},
        removeEventListener() {},
        addListener() {},
        removeListener() {}
      }))
    });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockResolvedValue(undefined) }
    });
    stubMedia();
    vi.spyOn(sources, 'initSourceSystem').mockResolvedValue();
    plantShell();
  });

  afterEach(async () => {
    app?.destroy?.();
    app = null;
    window.location.hash = '';
    localStorage.clear();
    document.body.replaceChildren();
    vi.restoreAllMocks();
    stubMedia();
  });

  it('gate-then-prayer: ENTER THE SPACE then the Sign of the Cross', async () => {
    window.location.hash = ROSARY_DOOR_HASH;
    app = new App();
    const opened = app.checkBetaAccess();

    const enter = document.querySelector('#beta-enter');
    expect(enter).toBeTruthy();
    expect(enter.textContent).toMatch(/Enter the Space/i);
    expect(prayerText()).toBeNull();
    expect(app.router).toBeNull();

    enter.click();
    await opened;

    expect(JSON.parse(localStorage.getItem('rise-beta-session')).code).toBe('open');
    expect(app.router.getCurrentView()).toBe('rosarium');
    expect(prayerText()).toBe(ROSARY_PRAYERS.signOfTheCross);
    expect(document.querySelector('.rosarium-panel')).toBeNull();
    expect(document.querySelector('[data-action="start"]')).toBeNull();
    expect(document.querySelector('.beta-gate')).toBeNull();
    expect(document.getElementById('view-portal').hidden).toBe(true);
    expect(window.location.hash).toBe(ROSARY_DOOR_HASH);
  });

  it('session-straight-to-prayer: no gate, first surface is the Sign of the Cross', async () => {
    localStorage.setItem('rise-beta-session', JSON.stringify(openSession()));
    window.location.hash = ROSARY_DOOR_HASH;
    app = new App();
    await app.checkBetaAccess();

    expect(document.querySelector('#beta-enter')).toBeNull();
    expect(document.querySelector('.beta-gate')).toBeNull();
    expect(app.router.getCurrentView()).toBe('rosarium');
    expect(prayerText()).toBe(ROSARY_PRAYERS.signOfTheCross);
    expect(document.querySelector('.rosarium-panel')).toBeNull();
  });

  it('calendar set: the door prays mysterySetForDate(), not a URL set', async () => {
    localStorage.setItem('rise-beta-session', JSON.stringify(openSession()));
    window.location.hash = ROSARY_DOOR_HASH;
    app = new App();
    await app.checkBetaAccess();

    const room = app.router.getViewInstance('rosarium');
    expect(room.setId).toBe(mysterySetForDate());
    expect(room.mode).toBe('plain');
    expect(room.sound).toBe('none');
    expect(room.autoAdvance).toBe(true);
    expect(room.pace).toBe(1);
    expect(room.compiled.steps[0].text).toBe(ROSARY_PRAYERS.signOfTheCross);
    const hail = room.compiled.steps.find(step => step.text === ROSARY_PRAYERS.hailMary);
    expect(hail.durationMs).toBe(13000);
  });

  it('hash unchanged through the sit and at complete; copy-link is the door URL', async () => {
    localStorage.setItem('rise-beta-session', JSON.stringify(openSession()));
    window.location.hash = ROSARY_DOOR_HASH;
    app = new App();
    await app.checkBetaAccess();

    const room = app.router.getViewInstance('rosarium');
    expect(room.phase).toBe('prayer');
    expect(window.location.hash).toBe(ROSARY_DOOR_HASH);

    room.returnToStrand();
    expect(room.phase).toBe('strand');
    expect(window.location.hash).toBe(ROSARY_DOOR_HASH);

    room.finish();
    expect(room.phase).toBe('complete');
    expect(document.querySelector('.rosarium-where').textContent).toBe('The Rosary is complete.');
    expect(window.location.hash).toBe(ROSARY_DOOR_HASH);

    document.querySelector('[data-action="copy-link"]').click();
    await vi.waitFor(() => {
      expect(navigator.clipboard.writeText).toHaveBeenCalledWith(rosaryDoorHref());
    });
    expect(rosaryDoorHref()).toMatch(/#rosary$/);
    expect(window.location.hash).toBe(ROSARY_DOOR_HASH);
  });

  it('bare / unchanged: gate then Portal, never the Rosary', async () => {
    window.location.hash = '';
    app = new App();
    const opened = app.checkBetaAccess();

    expect(document.querySelector('#beta-enter')).toBeTruthy();
    document.querySelector('#beta-enter').click();
    await opened;

    expect(app.router.getCurrentView()).toBe('portal');
    expect(prayerText()).toBeNull();
    expect(document.getElementById('view-rosarium').hidden).toBe(true);
    expect(document.getElementById('view-portal').hidden).toBe(false);
    expect(window.location.hash).toBe('');
    expect(isRosaryDoor()).toBe(false);
  });

  it('an open session on bare / is still the Portal', async () => {
    localStorage.setItem('rise-beta-session', JSON.stringify(openSession()));
    window.location.hash = '';
    app = new App();
    await app.checkBetaAccess();

    expect(app.router.getCurrentView()).toBe('portal');
    expect(prayerText()).toBeNull();
  });

  it('open session, hashchange to #rosary: Sign of the Cross without reload', async () => {
    localStorage.setItem('rise-beta-session', JSON.stringify(openSession()));
    window.location.hash = '';
    app = new App();
    await app.checkBetaAccess();

    expect(app.router.getCurrentView()).toBe('portal');
    expect(prayerText()).toBeNull();

    const navigate = vi.spyOn(app.router, 'navigate');
    window.location.hash = ROSARY_DOOR_HASH;
    window.dispatchEvent(new HashChangeEvent('hashchange'));

    await vi.waitFor(() => {
      expect(app.router.getCurrentView()).toBe('rosarium');
      expect(prayerText()).toBe(ROSARY_PRAYERS.signOfTheCross);
    });

    expect(navigate).toHaveBeenCalledWith('rosarium', { data: { door: true } });
    expect(navigate).not.toHaveBeenCalledWith('portal');
    expect(navigate).not.toHaveBeenCalledWith('portal', expect.anything());
    expect(document.getElementById('view-portal').hidden).toBe(true);
    expect(document.getElementById('view-rosarium').hidden).toBe(false);
    expect(window.location.hash).toBe(ROSARY_DOOR_HASH);
  });

  it('the room without the door still opens on the chooser', () => {
    const container = document.createElement('div');
    const room = new Rosarium(container);
    expect(room.phase).toBe('choosing');
    expect(container.querySelector('[data-action="start"]')).toBeTruthy();
    expect(container.querySelector('.rosarium-prayer-text')).toBeNull();
    room.destroy();
  });
});

describe('BetaGate open session', () => {
  afterEach(() => {
    document.body.replaceChildren();
    localStorage.clear();
  });

  it('reloads { code: "open" } as a session, not another gate', () => {
    localStorage.setItem('rise-beta-session', JSON.stringify(openSession()));
    const container = document.createElement('div');
    const onAccess = vi.fn();
    const gate = new BetaGate(container, { onAccess });
    expect(onAccess).toHaveBeenCalledWith(expect.objectContaining({ code: 'open' }));
    expect(container.querySelector('#beta-enter')).toBeNull();
    gate.destroy();
  });
});
