// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { validateJevRecommendation } from '../app/jev-reading.js';
import { resolveJevChamberConfig } from '../core/jev-config.js';
import { jevColors } from '../core/jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../core/jev-sequence.js';
import { rollReading } from '../core/roll.js';
import { Portal } from './Portal.js';
import { DecisionError } from '../core/decision/call.js';
import { acceptOpenRouterKey, resetConnectionForTests } from '../core/ai-connection.js';

// The recommender runs in the page on the reader's own connection. Here a
// stand-in connection answers with the decision each test scripts.
vi.mock('../core/decision/browser.js', () => ({
  recommendReading: async (intent, options) => {
    if (globalThis.__notConnected) throw new DecisionError('NOT_CONNECTED');
    const response = await fetch('reader-connection', { method: 'POST', body: JSON.stringify({ intent, ...options }) });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error.message);
    return body;
  }
}));
// CORE extends rollReading and adds openingLines; Home is held to the calls.
// rollReading draws a part given as null (CORE's contract), as an asked reading's temper.
vi.mock('../core/roll.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, rollReading: vi.fn(({ temper, ...parts } = {}) => actual.rollReading({ ...parts, temper: temper ?? undefined })) };
});
vi.mock('../app/jev-reading.js', async importOriginal => ({
  ...(await importOriginal()),
  openingLines: vi.fn(async () => 'Stately, plump Buck Mulligan came from the stairhead')
}));

const KEY = 'sk-or-v1-portal-test-key-0123456789';

beforeEach(() => {
  sessionStorage.clear();
  vi.mocked(rollReading).mockClear();
  window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} });
});
afterEach(() => {
  delete globalThis.__notConnected;
  resetConnectionForTests();
  document.body.innerHTML = '';
  sessionStorage.clear();
  vi.unstubAllGlobals();
  vi.doUnmock('../app/invocation.js');
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

const hook = (container, name) => container.querySelector(`[data-home="${name}"]`);
const field = container => container.querySelector('#home-intent');
const status = container => container.querySelector('[data-home-status]').textContent;
const shown = container => container.querySelector('.home-panel').dataset.state;

/** Asking is offered from the start, beside Roll a reading. */
async function openAsk(container) {
  hook(container, 'ask-open').click();
  await vi.waitFor(() => expect(shown(container)).toBe('ask'));
}

function ask(container, intent) {
  field(container).value = intent;
  container.querySelector('#home-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

it('says what asking needs when there is no AI, sends nothing, and leaves rolling one press away', async () => {
  const provider = vi.fn();
  const launch = vi.fn(async () => {});
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount({ onLaunchJevReading: launch });
  await openAsk(container);
  expect(field(container)).toBeNull();
  expect(container.querySelector('h1').textContent).toBe('Asking needs your own AI.');
  expect(container.querySelector('.home-lede').textContent).toBe(
    'Connect your OpenRouter account (billed to you) or run RISE on your computer with Kev. Rolling needs neither.');
  const connect = container.querySelector('.home-panel [data-ai="connect"]');
  expect(connect.textContent).toBe('Connect OpenRouter');
  expect([...container.querySelectorAll('.home .btn-primary')]).toEqual([connect]);
  const local = container.querySelector('.home-panel a.btn-secondary');
  expect(local.textContent).toBe('Run RISE locally');
  expect(local.getAttribute('href')).toBe('https://github.com/SyberLabs/RISE/blob/main/docs/LOCAL-RISE.md');
  expect(local.getAttribute('rel')).toContain('noopener');
  expect(hook(container, 'roll-instead').classList.contains('btn-ghost')).toBe(true);
  const about = container.querySelector('.home-panel .portal-ai-about');
  expect(about.querySelector('summary').textContent).toBe('About your connection');
  expect(about.textContent).toContain('It is never sent to SyberLabs. Browser extensions can read page memory');

  hook(container, 'roll-instead').click();
  // The request stays on the panel while it rolls.
  expect(shown(container)).toBe('ask');
  expect(hook(container, 'roll-instead').getAttribute('aria-busy')).toBe('true');
  await vi.waitFor(() => expect(shown(container)).toBe('result'), { timeout: 3000 });
  hook(container, 'enter').click();
  await vi.waitFor(() => expect(launch).toHaveBeenCalledOnce());
  expect(launch).toHaveBeenCalledWith(portal.result.decision, { firstReadPreview: true });
  expect(provider).not.toHaveBeenCalled();
  portal.destroy();
});

it('turns the panel into a labelled request with Ask, Roll instead and a microphone once connected', async () => {
  acceptOpenRouterKey(KEY);
  const { portal, container } = mount();
  await openAsk(container);
  const input = field(container);
  expect(document.activeElement).toBe(input);
  expect(container.querySelector('label[for="home-intent"]').textContent).toBe('What would you like to read?');
  expect(input.maxLength).toBe(240);
  const help = container.querySelector(`#${input.getAttribute('aria-describedby')}`);
  expect(help.textContent).toMatch(/Only your request is sent/u);
  expect(help.textContent).toMatch(/browser.s speech service/iu);
  expect(hook(container, 'ask').type).toBe('submit');
  expect([...container.querySelectorAll('.home .btn-primary')]).toEqual([hook(container, 'ask')]);
  expect(hook(container, 'roll-instead').classList.contains('btn-secondary')).toBe(true);
  expect(container.querySelector('[data-jev-dictate]').getAttribute('aria-label')).toMatch(/Speak your/u);
  expect(container.querySelector('[data-jev-dictation-status]')).not.toBeNull();
  expect(hook(container, 'ask-open')).toBeNull();
  portal.destroy();
});

it('asks RISE once, says what it cannot do before anything plays, and plays only on Start reading', async () => {
  acceptOpenRouterKey(KEY);
  const decision = tokyoDecision();
  const provider = vi.fn(async () => Response.json(decision));
  const launch = vi.fn(async () => {});
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount({ onLaunchJevReading: launch });
  await openAsk(container);
  ask(container, 'i want something psychedelic fast tokyo drift style');
  expect(hook(container, 'ask').getAttribute('aria-busy')).toBe('true');
  expect(field(container).readOnly).toBe(true);
  expect(status(container)).toContain('Interpreting your request');

  await vi.waitFor(() => expect(hook(container, 'enter')).not.toBeNull(), { timeout: 3000 });
  expect(provider).toHaveBeenCalledOnce();
  expect(provider).toHaveBeenCalledWith('reader-connection', expect.objectContaining({
    body: JSON.stringify({ intent: 'i want something psychedelic fast tokyo drift style', nightDrive: true })
  }));
  expect(launch).not.toHaveBeenCalled();
  expect(container.querySelector('h1').textContent).toBe('Ulysses');
  // An asked reading has no temper: its mood is the reader's own words.
  const mood = container.querySelectorAll('.home-part')[1];
  expect(mood.querySelector('.home-part-value').textContent).toContain('As you asked');
  expect(mood.querySelector('.home-part-value').textContent).toContain('Fast phrases, fractal light, chase');
  expect(status(container)).toContain('fractal light');
  const note = container.querySelector('.home-note');
  expect(note.textContent).toContain('You referenced “Tokyo Drift”. RISE treated it as a style');
  expect(note.textContent).toContain('RISE can’t play the Tokyo Drift soundtrack');

  hook(container, 'enter').click();
  await vi.waitFor(() => expect(launch).toHaveBeenCalledOnce());
  expect(launch.mock.calls[0][0].workId).toBe('ulysses');
  expect(launch).toHaveBeenCalledWith(expect.anything(), { firstReadPreview: false });
  expect(() => validateJevRecommendation(launch.mock.calls[0][0])).not.toThrow();
  portal.destroy();
});

it('redraws one part of an asked reading as a roll, drawing a mood when it had none', async () => {
  acceptOpenRouterKey(KEY);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(tokyoDecision())));
  const { portal, container } = mount();
  await openAsk(container);
  ask(container, 'tokyo drift');
  await vi.waitFor(() => expect(hook(container, 'enter')).not.toBeNull(), { timeout: 3000 });
  const asked = portal.result;
  hook(container, 'redraw-passage').click();
  await vi.waitFor(() => expect(portal.result).not.toBe(asked), { timeout: 3000 });
  expect(rollReading).toHaveBeenLastCalledWith({ previous: asked, workId: 'ulysses', temper: null });
  expect(portal.result.source).toBe('roll');
  expect(container.querySelector('.home-note')).toBeNull();
  portal.destroy();
});

it('submits on Enter and keeps Shift+Enter for a new line', async () => {
  acceptOpenRouterKey(KEY);
  const provider = vi.fn();
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount();
  await openAsk(container);
  const input = field(container);
  const shifted = new KeyboardEvent('keydown', { key: 'Enter', shiftKey: true, bubbles: true, cancelable: true });
  input.dispatchEvent(shifted);
  expect(shifted.defaultPrevented).toBe(false);
  expect(status(container)).not.toContain('Add a few words');
  const plain = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  input.dispatchEvent(plain);
  expect(plain.defaultPrevented).toBe(true);
  expect(status(container)).toContain('Add a few words');
  expect(provider).not.toHaveBeenCalled();
  portal.destroy();
});

it('never sends an empty or overlong request, and says why', async () => {
  acceptOpenRouterKey(KEY);
  const provider = vi.fn();
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount();
  await openAsk(container);
  ask(container, '  ');
  expect(status(container)).toContain('Add a few words');
  ask(container, 'x'.repeat(241));
  expect(status(container)).toContain('under 240');
  expect(provider).not.toHaveBeenCalled();
  portal.destroy();
});

it('keeps the request when RISE fails, says so plainly, and plays nothing', async () => {
  acceptOpenRouterKey(KEY);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ error: { message: 'Jev timed out.' } }, { status: 504 })));
  const launch = vi.fn();
  const { portal, container } = mount({ onLaunchJevReading: launch });
  await openAsk(container);
  ask(container, 'tokyo drift');
  const alert = container.querySelector('.home-alert');
  await vi.waitFor(() => expect(alert.hidden).toBe(false));
  expect(alert.querySelector('.portal-alert-title').textContent).toBe('Couldn’t interpret that here. Your request is kept.');
  // The raw cause is never the message; it waits behind a closed "Details".
  const details = alert.querySelector('.portal-alert-details');
  expect(details.hidden).toBe(false);
  expect(details.open).toBe(false);
  expect(alert.querySelector('.portal-alert-message').textContent).toBe('Jev timed out.');
  expect(field(container).value).toBe('tokyo drift');
  expect(field(container).readOnly).toBe(false);
  expect(hook(container, 'ask').disabled).toBe(false);
  expect(launch).not.toHaveBeenCalled();
  portal.destroy();
});

it('refuses an answer that fails admission', async () => {
  acceptOpenRouterKey(KEY);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...tokyoDecision(), model: 'someone-else' })));
  const { portal, container } = mount();
  await openAsk(container);
  ask(container, 'tokyo drift');
  await vi.waitFor(() => expect(container.querySelector('.home-alert').hidden).toBe(false));
  expect(container.querySelector('h1').textContent).toBe('What would you like to read?');
  expect(shown(container)).toBe('ask');
  portal.destroy();
});

it('keeps what was typed while Home is open, and lets a roll leave the request without losing it', async () => {
  acceptOpenRouterKey(KEY);
  const { portal, container } = mount();
  await openAsk(container);
  field(container).value = 'something slow about the sea';
  field(container).dispatchEvent(new Event('input', { bubbles: true }));
  hook(container, 'roll-instead').click();
  await vi.waitFor(() => expect(shown(container)).toBe('result'), { timeout: 3000 });
  hook(container, 'ask-open').click();
  await vi.waitFor(() => expect(field(container)).not.toBeNull());
  expect(field(container).value).toBe('something slow about the sea');
  portal.destroy();
});

it('loads again on the next roll when asking could not load', async () => {
  acceptOpenRouterKey(KEY);
  vi.doMock('../app/invocation.js', () => { throw new Error('chunk failed'); });
  const { portal, container } = mount();
  await openAsk(container);
  ask(container, 'tokyo drift');
  await vi.waitFor(() => expect(container.querySelector('.home-alert').hidden).toBe(false));
  expect(shown(container)).toBe('ask');
  vi.doUnmock('../app/invocation.js');
  hook(container, 'roll-instead').click();
  await vi.waitFor(() => expect(shown(container)).toBe('result'), { timeout: 3000 });
  expect(container.querySelector('.home-alert').hidden).toBe(true);
  portal.destroy();
});

it('tells a reader whose connection dropped how to reconnect, and keeps rolling open', async () => {
  acceptOpenRouterKey(KEY);
  globalThis.__notConnected = true;
  const provider = vi.fn();
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount();
  await openAsk(container);
  ask(container, 'A slow, quiet reading.');
  const notice = container.querySelector('#portal-ai .portal-ai-notice');
  await vi.waitFor(() => expect(notice.hidden).toBe(false));
  expect(notice.textContent).toBe('Connect OpenRouter or run RISE locally to ask for a specific reading. Rolling works without AI.');
  expect(container.querySelector('.home-alert').hidden).toBe(false);
  expect(provider).not.toHaveBeenCalled();
  expect(hook(container, 'roll-instead').disabled).toBe(false);
  portal.destroy();
});

it('shows a connected OpenRouter account in the footer, its billing, and disconnects', async () => {
  const { portal, container } = mount();
  await openAsk(container);
  expect(field(container)).toBeNull();
  acceptOpenRouterKey(KEY);
  // The open request becomes a field the moment the reader is connected.
  expect(field(container)).not.toBeNull();
  const line = container.querySelector('.portal-footer #portal-ai');
  expect(line.textContent).toContain('billed to your OpenRouter account');
  expect(line.textContent).not.toContain('sk-or-v1-portal-test-key');
  line.querySelector('[data-ai="disconnect"]').click();
  expect(line.querySelector('[data-ai="connect"]')).not.toBeNull();
  expect(line.querySelector('.portal-ai-notice').textContent).toContain('forgot the key');
  expect(field(container)).toBeNull();
  portal.destroy();
});
