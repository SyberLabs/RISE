// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { validateJevRecommendation } from '../app/jev-reading.js';
import { resolveJevChamberConfig } from '../core/jev-config.js';
import { jevColors } from '../core/jev-palette.js';
import { compileJevAudioProgram, compileJevVisualProgram } from '../core/jev-sequence.js';
import { rollReading } from '../core/roll.js';
import { Home } from './Home.js';
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
// Home is held to the calls it makes to rollReading; the real roll answers them.
vi.mock('../core/roll.js', async importOriginal => {
  const actual = await importOriginal();
  return { ...actual, rollReading: vi.fn(actual.rollReading) };
});
vi.mock('../app/jev-reading.js', async importOriginal => ({
  ...(await importOriginal()),
  openingLines: vi.fn(async () => ({ text: 'Stately, plump Buck Mulligan came from the stairhead', verse: false }))
}));
// Home's engine and stream are stood in for; this file is about asking.
vi.mock('./reading-backdrop.js', () => ({
  ReadingStage: class { show() {} pause() {} resume() {} destroy() {} }
}));
vi.mock('./reading-stream.js', () => ({
  ReadingStream: class { play() {} stop() {} destroy() {} }
}));
// jsdom has no modal dialogs; these do what the browser's do, minus the top layer.
HTMLDialogElement.prototype.showModal ||= function showModal() { this.open = true; };
HTMLDialogElement.prototype.close ||= function close() {
  if (!this.open) return;
  this.open = false;
  this.dispatchEvent(new Event('close'));
};

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
  const portal = new Home(container, options);
  return { portal, container };
}

const hook = (container, name) => container.querySelector(`[data-home="${name}"]`);
const field = container => container.querySelector('#home-intent');
const dialog = container => container.querySelector('dialog.home-ask');
const askStatus = container => container.querySelector('[data-ask-status]').textContent;
const homeStatus = container => container.querySelector('[data-home-status]').textContent;
const askAlert = container => dialog(container).querySelector('.portal-alert');

/** Asking sits in the Menu: "Ask for a reading" opens it in a dialog. */
async function openAsk(container) {
  container.querySelector('.portal-menu-toggle').click();
  const item = container.querySelector('.portal-nav [data-home="ask-open"]');
  expect(item.textContent.trim()).toBe('Ask for a reading');
  item.click();
  await vi.waitFor(() => expect(dialog(container).open).toBe(true));
  expect(container.querySelector('.sl-header').classList.contains('is-open')).toBe(false);
}

function ask(container, intent) {
  field(container).value = intent;
  container.querySelector('#home-form').dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
}

it('says what asking needs when there is no AI, sends nothing, and closes on Cancel', async () => {
  const provider = vi.fn();
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount();
  await openAsk(container);
  expect(field(container)).toBeNull();
  expect(dialog(container).querySelector('h2').textContent).toBe('Asking needs your own AI.');
  expect(dialog(container).getAttribute('aria-labelledby')).toBe(dialog(container).querySelector('h2').id);
  expect(dialog(container).querySelector('.home-lede').textContent).toBe(
    'Connect your OpenRouter account (billed to you) or run RISE on your computer with Kev. Another reading needs neither.');
  const connect = dialog(container).querySelector('[data-ai="connect"]');
  expect(connect.textContent).toBe('Connect OpenRouter');
  expect(document.activeElement).toBe(connect);
  expect([...dialog(container).querySelectorAll('.btn-primary')]).toEqual([connect]);
  const local = dialog(container).querySelector('a.btn-secondary');
  expect(local.textContent).toBe('Run RISE locally');
  expect(local.getAttribute('href')).toBe('https://github.com/SyberLabs/RISE/blob/main/docs/LOCAL-RISE.md');
  expect(local.getAttribute('rel')).toContain('noopener');
  const about = dialog(container).querySelector('.portal-ai-about');
  expect(about.querySelector('summary').textContent).toBe('About your connection');
  expect(about.textContent).toContain('It is never sent to SyberLabs. Browser extensions can read page memory');

  hook(container, 'ask-cancel').click();
  expect(dialog(container).open).toBe(false);
  expect(provider).not.toHaveBeenCalled();
  portal.destroy();
});

it('is a labelled request with a microphone, Ask and Cancel once connected', async () => {
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
  expect([...dialog(container).querySelectorAll('.btn-primary')]).toEqual([hook(container, 'ask')]);
  expect(hook(container, 'ask-cancel').textContent).toBe('Cancel');
  expect(container.querySelector('[data-jev-dictate]').getAttribute('aria-label')).toMatch(/Speak your/u);
  expect(dialog(container).querySelector('[data-jev-dictation-status]')).not.toBeNull();
  expect(askStatus(container)).toBe('Ask for a mood, a style, a text, or all three.');
  portal.destroy();
});

it('asks once, makes the answer Home\'s reading, says what RISE cannot do, and plays only on Read it with sound', async () => {
  acceptOpenRouterKey(KEY);
  const provider = vi.fn(async () => Response.json(tokyoDecision()));
  const launch = vi.fn(async () => {});
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount({ onLaunchJevReading: launch });
  await openAsk(container);
  ask(container, 'i want something psychedelic fast tokyo drift style');
  expect(hook(container, 'ask').getAttribute('aria-busy')).toBe('true');
  expect(field(container).readOnly).toBe(true);
  expect(askStatus(container)).toContain('Interpreting your request');

  await vi.waitFor(() => expect(dialog(container).open).toBe(false), { timeout: 3000 });
  expect(provider).toHaveBeenCalledOnce();
  expect(provider).toHaveBeenCalledWith('reader-connection', expect.objectContaining({
    body: JSON.stringify({ intent: 'i want something psychedelic fast tokyo drift style', nightDrive: true })
  }));
  expect(launch).not.toHaveBeenCalled();
  // An asked reading has no temper: its caption is the reader's own.
  expect(container.querySelector('h1').textContent).toBe('Ulysses, by James Joyce');
  expect(container.querySelector('.home-label').textContent).toBe('As you asked: fast phrases, fractal light, chase, large japanese serif');
  expect(homeStatus(container)).toBe('As you asked. Ulysses, by James Joyce. Fast phrases, fractal light, chase, large japanese serif.');
  const note = container.querySelector('.home-note');
  expect(note.hidden).toBe(false);
  expect(note.textContent).toContain('You referenced “Tokyo Drift”. RISE treated it as a style');
  expect(note.textContent).toContain('RISE can’t play the Tokyo Drift soundtrack');
  expect(hook(container, 'adjust')).not.toBeNull();
  expect(document.activeElement).toBe(hook(container, 'enter'));

  hook(container, 'enter').click();
  await vi.waitFor(() => expect(launch).toHaveBeenCalledOnce());
  expect(launch.mock.calls[0][0].workId).toBe('ulysses');
  expect(launch).toHaveBeenCalledWith(expect.anything(), { firstReadPreview: false });
  expect(() => validateJevRecommendation(launch.mock.calls[0][0])).not.toThrow();

  // Another reading after an asked one rolls from it, and the note goes with the asked reading.
  const asked = portal.reading;
  await vi.waitFor(() => expect(hook(container, 'roll').disabled).toBe(false));
  hook(container, 'roll').click();
  await vi.waitFor(() => expect(portal.reading).not.toBe(asked), { timeout: 3000 });
  expect(rollReading).toHaveBeenLastCalledWith({ previous: { temper: null, decision: asked.decision }, vivid: true });
  expect(container.querySelector('.home-note').hidden).toBe(true);
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
  expect(askStatus(container)).not.toContain('Add a few words');
  const plain = new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true });
  input.dispatchEvent(plain);
  expect(plain.defaultPrevented).toBe(true);
  expect(askStatus(container)).toContain('Add a few words');
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
  expect(askStatus(container)).toContain('Add a few words');
  ask(container, 'x'.repeat(241));
  expect(askStatus(container)).toContain('under 240');
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
  const alert = askAlert(container);
  await vi.waitFor(() => expect(alert.hidden).toBe(false));
  expect(alert.querySelector('.portal-alert-title').textContent).toBe('Couldn’t interpret that here. Your request is kept.');
  // The raw cause is never the message; it waits behind a closed "Details".
  const details = alert.querySelector('.portal-alert-details');
  expect(details.hidden).toBe(false);
  expect(details.open).toBe(false);
  expect(alert.querySelector('.portal-alert-message').textContent).toBe('Jev timed out.');
  expect(dialog(container).open).toBe(true);
  expect(field(container).value).toBe('tokyo drift');
  expect(field(container).readOnly).toBe(false);
  expect(hook(container, 'ask').disabled).toBe(false);
  expect(launch).not.toHaveBeenCalled();
  portal.destroy();
});

it('refuses an answer that fails admission, and keeps the reading Home had', async () => {
  acceptOpenRouterKey(KEY);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json({ ...tokyoDecision(), model: 'someone-else' })));
  const { portal, container } = mount();
  await openAsk(container);
  ask(container, 'tokyo drift');
  await vi.waitFor(() => expect(askAlert(container).hidden).toBe(false));
  expect(dialog(container).open).toBe(true);
  expect(portal.reading).toBeNull();
  portal.destroy();
});

it('keeps what was typed while Home is open, across closing and opening again', async () => {
  acceptOpenRouterKey(KEY);
  const { portal, container } = mount();
  await openAsk(container);
  field(container).value = 'something slow about the sea';
  field(container).dispatchEvent(new Event('input', { bubbles: true }));
  hook(container, 'ask-cancel').click();
  await openAsk(container);
  expect(field(container).value).toBe('something slow about the sea');
  portal.destroy();
});

it('loads again on the next ask when asking could not load', async () => {
  acceptOpenRouterKey(KEY);
  vi.stubGlobal('fetch', vi.fn(async () => Response.json(tokyoDecision())));
  vi.doMock('../app/invocation.js', () => { throw new Error('chunk failed'); });
  const { portal, container } = mount();
  await openAsk(container);
  ask(container, 'tokyo drift');
  await vi.waitFor(() => expect(askAlert(container).hidden).toBe(false));
  vi.doUnmock('../app/invocation.js');
  ask(container, 'tokyo drift');
  await vi.waitFor(() => expect(dialog(container).open).toBe(false), { timeout: 3000 });
  expect(askAlert(container).hidden).toBe(true);
  expect(container.querySelector('.home-label').textContent).toMatch(/^As you asked: /u);
  portal.destroy();
});

it('says on Home, not in the closed dialog, when a request fails after Home was left', async () => {
  acceptOpenRouterKey(KEY);
  let fail;
  vi.stubGlobal('fetch', vi.fn(() => new Promise(resolve => {
    fail = () => resolve(Response.json({ error: { message: 'Jev timed out.' } }, { status: 504 }));
  })));
  const { portal, container } = mount();
  portal.activate();
  await openAsk(container);
  ask(container, 'tokyo drift');
  await vi.waitFor(() => expect(fail).toBeTypeOf('function'));
  // Home's own keys hold while the request is in flight.
  expect(hook(container, 'roll').disabled).toBe(true);
  portal.deactivate();
  expect(dialog(container).open).toBe(false);
  fail();
  const homeAlert = container.querySelector('.home-alert');
  await vi.waitFor(() => expect(homeAlert.hidden).toBe(false));
  expect(homeAlert.querySelector('.portal-alert-title').textContent).toBe('Couldn’t interpret that here. Your request is kept.');
  expect(homeAlert.querySelector('.portal-alert-message').textContent).toBe('Jev timed out.');
  expect(askAlert(container).hidden).toBe(true);
  expect(hook(container, 'roll').disabled).toBe(false);
  portal.destroy();
});

it('tells a reader whose connection dropped how to reconnect', async () => {
  acceptOpenRouterKey(KEY);
  globalThis.__notConnected = true;
  const provider = vi.fn();
  vi.stubGlobal('fetch', provider);
  const { portal, container } = mount();
  await openAsk(container);
  ask(container, 'A slow, quiet reading.');
  const notice = container.querySelector('#portal-ai .portal-ai-notice');
  await vi.waitFor(() => expect(notice.hidden).toBe(false));
  expect(notice.textContent).toBe('Connect OpenRouter or run RISE locally to ask for a specific reading. Another reading works without AI.');
  expect(askAlert(container).hidden).toBe(false);
  expect(provider).not.toHaveBeenCalled();
  portal.destroy();
});

it('shows a connected OpenRouter account in the dialog, its billing, and disconnects', async () => {
  const { portal, container } = mount();
  await openAsk(container);
  expect(field(container)).toBeNull();
  acceptOpenRouterKey(KEY);
  // The open request becomes a field the moment the reader is connected.
  expect(field(container)).not.toBeNull();
  const line = dialog(container).querySelector('#portal-ai');
  expect(line.textContent).toContain('billed to your OpenRouter account');
  expect(line.textContent).not.toContain('sk-or-v1-portal-test-key');
  line.querySelector('[data-ai="disconnect"]').click();
  expect(line.querySelector('[data-ai="disconnect"]')).toBeNull();
  expect(line.querySelector('.portal-ai-notice').textContent).toContain('forgot the key');
  expect(field(container)).toBeNull();
  portal.destroy();
});
