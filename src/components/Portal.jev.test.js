// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { validateJevRecommendation } from '../app/jev-reading.js';
import { resolveJevChamberConfig } from '../core/jev-config.js';
import { jevColors } from '../core/jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../core/jev-sequence.js';
import { Portal } from './Portal.js';

beforeEach(() => sessionStorage.clear());
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

async function request(container, intent) {
  container.querySelector('#portal-jev-intent').value = intent;
  container.querySelector('#portal-jev-form')
    .dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

it('asks RISE once, shows how the request was read, and plays only when asked', async () => {
  const decision = tokyoDecision();
  const provider = vi.fn(async () => Response.json(decision));
  const launch = vi.fn(async () => {});
  const navigate = vi.fn();
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount({ onLaunchJevReading: launch, onNavigate: navigate });

  await request(container, 'i want something psychedelic fast tokyo drift style');
  expect(container.querySelector('.portal-jev-submit').getAttribute('aria-busy')).not.toBeNull();
  expect(container.querySelector('#portal-jev-hint').textContent).toContain('Interpreting your request');
  expect(container.querySelector('.portal-skeleton').hidden).toBe(false);

  const preview = container.querySelector('#portal-preview');
  await vi.waitFor(() => expect(preview.hidden).toBe(false));
  expect(provider).toHaveBeenCalledOnce();
  expect(provider).toHaveBeenCalledWith('/api/jev-recommend', expect.objectContaining({
    method: 'POST',
    body: JSON.stringify({ intent: 'i want something psychedelic fast tokyo drift style', schemaVersion: 3 })
  }));
  // Nothing plays on arrival.
  expect(launch).not.toHaveBeenCalled();
  expect(preview.querySelector('.portal-preview-lede').textContent)
    .toContain('You referenced “Tokyo Drift”. RISE treated it as a style');
  const rows = [...preview.querySelectorAll('.portal-row')].map(row => row.textContent.replace(/\s+/g, ' ').trim());
  expect(rows[0]).toContain('Neon night');
  expect(rows[1]).toContain('Fast, flowing fractal light');
  expect(rows[2]).toContain('Fast: 300 words a minute');
  expect(preview.querySelector('.portal-read-title').textContent).toBe('Ulysses');
  expect(preview.querySelector('.portal-read-why').hidden).toBe(false);
  // The limitation is stated before Play.
  expect(preview.querySelector('.portal-limit').hidden).toBe(false);
  expect(preview.querySelector('.portal-limit-body').textContent)
    .toContain('RISE can’t play the Tokyo Drift soundtrack');
  expect(container.querySelector('.portal-submit-label').textContent).toBe('Update preview');

  preview.querySelector('#portal-play').click();
  await vi.waitFor(() => expect(launch).toHaveBeenCalledOnce());
  expect(launch.mock.calls[0][0].workId).toBe('ulysses');
  expect(navigate).not.toHaveBeenCalled();
  portal.destroy();
});

it('adjusts one part locally with no new request, and plays the adjusted plan', async () => {
  const provider = vi.fn(async () => Response.json(tokyoDecision()));
  const launch = vi.fn(async () => {});
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount({ onLaunchJevReading: launch });
  await request(container, 'tokyo drift');
  const preview = container.querySelector('#portal-preview');
  await vi.waitFor(() => expect(preview.hidden).toBe(false));

  preview.querySelector('[data-adjust-kind="speed"][data-adjust-value="fastest"]').click();
  await vi.waitFor(() => expect(preview.querySelector('.portal-adjust-note').textContent)
    .toBe('Speed: Fastest. Updated instantly, nothing sent.'));
  preview.querySelector('[data-adjust-kind="colors"][data-adjust-value="ember"]').click();
  await vi.waitFor(() => expect(preview.querySelector('.portal-rows').textContent).toContain('Ember'));
  const text = preview.querySelector('#portal-adjust-text');
  text.value = 'the-iliad';
  text.dispatchEvent(new Event('change'));
  await vi.waitFor(() => expect(preview.querySelector('.portal-read-title').textContent).toContain('The Iliad'));

  expect(provider).toHaveBeenCalledOnce();
  expect(preview.querySelector('[data-adjust-kind="speed"][data-adjust-value="fastest"]').getAttribute('aria-pressed')).toBe('true');
  expect(preview.querySelector('.portal-rows').textContent).toContain('400 words a minute');
  expect(preview.querySelector('.portal-adjust-reset').hidden).toBe(false);

  preview.querySelector('#portal-play').click();
  await vi.waitFor(() => expect(launch).toHaveBeenCalledOnce());
  const played = launch.mock.calls[0][0];
  expect(() => validateJevRecommendation(played)).not.toThrow();
  expect(played).toMatchObject({ workId: 'the-iliad', config: { wpm: 400, colorTheme: 'ember' } });
  portal.destroy();
});

it('keeps the request and the preview across a reload, and keeps changes on a new request', async () => {
  const provider = vi.fn(async () => Response.json(tokyoDecision()));
  vi.stubGlobal('fetch', provider);
  const first = mount();
  await request(first.container, 'i want something psychedelic fast tokyo drift style');
  await vi.waitFor(() => expect(first.container.querySelector('#portal-preview').hidden).toBe(false));
  first.container.querySelector('[data-adjust-kind="speed"][data-adjust-value="fastest"]').click();
  await vi.waitFor(() => expect(first.container.querySelector('.portal-rows').textContent).toContain('400 words'));
  first.portal.destroy();
  document.body.innerHTML = '';

  // A reload: a fresh Home, no network.
  const second = mount();
  expect(second.container.querySelector('#portal-jev-intent').value)
    .toBe('i want something psychedelic fast tokyo drift style');
  await vi.waitFor(() => expect(second.container.querySelector('#portal-preview').hidden).toBe(false));
  expect(second.container.querySelector('.portal-rows').textContent).toContain('400 words');
  expect(provider).toHaveBeenCalledOnce();

  // Editing the request asks once more and keeps the reader's own change.
  expect(second.container.querySelector('#portal-jev-kept').textContent).toBe('Updating keeps your changes: Speed.');
  await request(second.container, 'tokyo drift');
  await vi.waitFor(() => expect(provider).toHaveBeenCalledTimes(2));
  await vi.waitFor(() => expect(second.container.querySelector('.portal-rows').textContent).toContain('400 words'));
  second.portal.destroy();
});

it('keeps the request when RISE fails, and plays nothing', async () => {
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'Jev timed out.' } }, { status: 504 })));
  const launch = vi.fn();
  const { portal, container } = mount({ onLaunchJevReading: launch });
  await request(container, 'tokyo drift');
  const alert = container.querySelector('#portal-jev-error');
  await vi.waitFor(() => expect(alert.hidden).toBe(false));
  expect(alert.querySelector('.portal-alert-title').textContent).toBe('Couldn’t create a preview. Your request is saved.');
  // The raw cause is never the message; it waits behind a closed "Details".
  const details = alert.querySelector('.portal-alert-details');
  expect(details.hidden).toBe(false);
  expect(details.open).toBe(false);
  expect(alert.querySelector('.portal-alert-message').textContent).toBe('Jev timed out.');
  expect(container.querySelector('#portal-jev-intent').value).toBe('tokyo drift');
  expect(container.querySelector('.portal-jev-submit').disabled).toBe(false);
  expect(container.querySelector('.portal-skeleton').hidden).toBe(true);
  expect(container.querySelector('#portal-preview').hidden).toBe(true);
  expect(launch).not.toHaveBeenCalled();
  portal.destroy();
});

it('offers microphone dictation beside the editable request', () => {
  const { portal, container } = mount();
  const form = container.querySelector('#portal-jev-form');
  const mic = form.querySelector('[data-jev-dictate]');
  expect(mic).not.toBeNull();
  expect(mic.getAttribute('aria-label')).toBe('Speak your request');
  expect(mic.textContent).not.toMatch(/\p{Extended_Pictographic}/u);
  expect(form.querySelector('[data-jev-dictation-status]')).not.toBeNull();
  expect(form.textContent).toMatch(/browser.s speech service/i);
  portal.destroy();
});

it('brings the previous preview back when an update fails', async () => {
  const provider = vi.fn()
    .mockResolvedValueOnce(Response.json(tokyoDecision()))
    .mockResolvedValueOnce(Response.json({ error: { message: 'Jev timed out.' } }, { status: 504 }));
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount();
  await request(container, 'tokyo drift');
  const preview = container.querySelector('#portal-preview');
  await vi.waitFor(() => expect(preview.hidden).toBe(false));
  await request(container, 'tokyo drift, slower');
  await vi.waitFor(() => expect(container.querySelector('#portal-jev-error').hidden).toBe(false));
  expect(preview.hidden).toBe(false);
  expect(container.querySelector('#portal-jev-intent').value).toBe('tokyo drift, slower');
  portal.destroy();
});
