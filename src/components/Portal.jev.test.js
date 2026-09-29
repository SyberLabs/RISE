// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { validateJevRecommendation } from '../app/jev-reading.js';
import { resolveJevChamberConfig } from '../core/jev-config.js';
import { jevColors } from '../core/jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../core/jev-sequence.js';
import { Portal } from './Portal.js';

beforeEach(() => {
  sessionStorage.clear();
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => {
  document.body.innerHTML = '';
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

/** The plan the live service returned for the Tokyo Drift request (2026-09-27). */
function tokyoDecision() {
  const selectors = {
    section: 'first', wpm: 300, curve: 'wave', chunkMode: 'phrase', audio: 'chase',
    visualMode: 'interlocution', visualStyle: 'psychedelic', visualEngine: 'fractal',
    visualArc: 'triple', arcSplit: '30', middleEngine: 'fractal', finaleEngine: 'fractal',
    middleTheme: 'prism', finaleTheme: 'prism', middleAudio: 'chase', finaleAudio: 'chase',
    visualPalette: 'purple', kleePreset: 'chaotic', galleryCadence: 'lively', chamberFace: 'jp',
    fontSize: 'large', colorTheme: 'prism', textColor: 'amethyst', backgroundColor: 'prism',
    wordFill: 'accent', projection: 'stream', revealMode: 'instant'
  };
  const released = releaseInventory.ulysses;
  return {
    schemaVersion: 2, requestId: 'gen-dec-test', model: 'typesafe/jev-1.13-20260917',
    workId: released.workId, editionId: released.editionId, sourceRevision: released.sourceRevision,
    reason: 'An experimental day-long journey through Dublin and consciousness.',
    config: {
      ...selectors, colors: jevColors('prism', 'amethyst', 'prism'),
      ...resolveJevChamberConfig(selectors),
      visualProgram: compileJevVisualProgram(selectors),
      audioProgram: compileJevAudioProgram(selectors)
    },
    cacheStatus: 'miss', decisionCacheStatus: 'miss'
  };
}

function mount(options = {}) {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const portal = new Portal(container, options);
  return { portal, container };
}

/** Asking is an escape hatch: it opens after a first roll. */
async function openAsk(container) {
  container.querySelector('[data-oracle="roll"]').click();
  await vi.waitFor(() => expect(container.querySelector('[data-oracle="ask-open"]').hidden).toBe(false), { timeout: 3000 });
  container.querySelector('[data-oracle="ask-open"]').click();
  await vi.waitFor(() => expect(container.querySelector('.oracle-intent').hidden).toBe(false), { timeout: 3000 });
}

function ask(container, intent) {
  container.querySelector('.oracle-intent').value = intent;
  container.querySelector('#oracle-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

it('turns the window into a request, and the keys into Ask, a microphone and Roll', async () => {
  const { portal, container } = mount();
  await openAsk(container);
  expect(document.activeElement).toBe(container.querySelector('.oracle-intent'));
  expect([...container.querySelectorAll('.oracle-keys button')].map(key => key.getAttribute('aria-label') || key.textContent.trim()))
    .toEqual(['Ask', 'Speak your request', 'Roll']);
  expect(container.querySelector('[data-jev-dictation-status]')).not.toBeNull();
  expect(container.querySelector('.oracle-help').hidden).toBe(false);
  expect(container.querySelector('.oracle-help').textContent).toMatch(/Only your request is sent/u);
  expect(container.querySelector('.oracle-help').textContent).toMatch(/browser.s speech service/iu);
  expect(container.querySelector('[data-oracle="ask-open"]').hidden).toBe(true);
  portal.destroy();
});

it('asks RISE once, says what it cannot do before anything plays, and plays only on Enter', async () => {
  const decision = tokyoDecision();
  const provider = vi.fn(async () => Response.json(decision));
  const launch = vi.fn(async () => {});
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount({ onLaunchJevReading: launch });
  await openAsk(container);
  ask(container, 'i want something psychedelic fast tokyo drift style');
  expect(container.querySelector('[data-oracle="ask"]').getAttribute('aria-busy')).toBe('true');
  expect(container.querySelector('[data-oracle-status]').textContent).toContain('Interpreting your request');

  await vi.waitFor(() => expect(container.querySelector('[data-oracle="enter"]')).not.toBeNull(), { timeout: 3000 });
  expect(provider).toHaveBeenCalledOnce();
  expect(provider).toHaveBeenCalledWith('/api/jev-recommend', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ intent: 'i want something psychedelic fast tokyo drift style', schemaVersion: 3 })
  }));
  expect(launch).not.toHaveBeenCalled();
  expect(container.querySelector('.oracle-answer-title').textContent).toBe('Ulysses');
  // A Jev answer has no temper: the window holds a name and an author, and no third word.
  expect(container.querySelector('.oracle-answer-mood').hidden).toBe(true);
  expect(container.querySelector('[data-oracle-status]').textContent).toContain('fractal light');
  const note = container.querySelector('.oracle-note');
  expect(note.hidden).toBe(false);
  expect(note.textContent).toContain('You referenced “Tokyo Drift”. RISE treated it as a style');
  expect(note.textContent).toContain('RISE can’t play the Tokyo Drift soundtrack');

  container.querySelector('[data-oracle="enter"]').click();
  await vi.waitFor(() => expect(launch).toHaveBeenCalledOnce());
  expect(launch.mock.calls[0][0].workId).toBe('ulysses');
  expect(() => validateJevRecommendation(launch.mock.calls[0][0])).not.toThrow();
  portal.destroy();
});

it('never sends an empty or overlong request, and says why', async () => {
  const provider = vi.fn();
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount();
  await openAsk(container);
  ask(container, '  ');
  expect(container.querySelector('[data-oracle-status]').textContent).toContain('Add a few words');
  ask(container, 'x'.repeat(241));
  expect(container.querySelector('[data-oracle-status]').textContent).toContain('under 240');
  expect(provider).not.toHaveBeenCalled();
  portal.destroy();
});

it('keeps the request when RISE fails, says so plainly, and plays nothing', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'Jev timed out.' } }, { status: 504 })));
  const launch = vi.fn();
  const { portal, container } = mount({ onLaunchJevReading: launch });
  await openAsk(container);
  ask(container, 'tokyo drift');
  const alert = container.querySelector('.oracle-alert');
  await vi.waitFor(() => expect(alert.hidden).toBe(false));
  expect(alert.querySelector('.portal-alert-title').textContent).toBe('Couldn’t interpret that here. Your request is kept.');
  // The raw cause is never the message; it waits behind a closed "Details".
  const details = alert.querySelector('.portal-alert-details');
  expect(details.hidden).toBe(false);
  expect(details.open).toBe(false);
  expect(alert.querySelector('.portal-alert-message').textContent).toBe('Jev timed out.');
  expect(container.querySelector('.oracle-intent').value).toBe('tokyo drift');
  expect(container.querySelector('[data-oracle="ask"]').disabled).toBe(false);
  expect(launch).not.toHaveBeenCalled();
  portal.destroy();
});

it('refuses an answer that fails admission', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...tokyoDecision(), model: 'someone-else' })));
  const { portal, container } = mount();
  await openAsk(container);
  ask(container, 'tokyo drift');
  await vi.waitFor(() => expect(container.querySelector('.oracle-alert').hidden).toBe(false));
  expect(portal.result?.source).toBe('roll');
  portal.destroy();
});

it('keeps the draft across a reload', async () => {
  const first = mount();
  await openAsk(first.container);
  const field = first.container.querySelector('.oracle-intent');
  field.value = 'something slow about the sea';
  field.dispatchEvent(new Event('input', { bubbles: true }));
  first.portal.destroy();
  document.body.innerHTML = '';

  const second = mount();
  await vi.waitFor(() => expect(second.container.querySelector('.oracle-intent').value).toBe('something slow about the sea'));
  second.portal.destroy();
});
