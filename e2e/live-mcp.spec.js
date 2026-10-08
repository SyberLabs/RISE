/**
 * RISE's app inside an MCP host, in a real browser, against a fake host.
 *
 * The fake host is a page that does what an MCP Apps host does: it puts the
 * app's own HTML document (the relay RISE serves as `ui://rise/current`) in a
 * sandboxed frame, answers its handshake, hands it the arguments of the tool
 * call the model made (and, as real hosts do, the same again as the tool's
 * result), and answers the app's request for a completion from its model. What
 * is real is everything on RISE's side: the relay document, the page it frames,
 * the port, the adapter, the runtime, the Chamber, the controls.
 *
 * What it cannot show: any product's host. The frame here is not sandboxed the
 * way a product does it, its "model" is a script, and nothing has been tried
 * in ChatGPT, Claude, or VS Code. The reference package's own host class was
 * also run against the same page, once, by hand; see docs/plans/LIVE-MCP.md.
 */
import { BLACK_HOLES_CURRENT, toSealedCurrent } from '../src/test/sealed-current.js';
import { HORIZON_DIVE } from '../src/live/fixtures/black-holes.js';
import { relayHtml } from '../src/live/hosts/mcp-relay.js';
import { cardHtml } from '../src/live/hosts/mcp-card.js';
import { serializedUtf8Bytes } from '../src/live/hosts/mcp-size.js';
import { handleMcp } from '../worker/mcp-server.mjs';
import { expect, test } from './fixtures.js';

const HOST = '/__mcp-host';

/** The fake host's page: a frame for the relay, and a script that plays the host. */
function hostPage({ relay, current, sampling = true, dive, resultOnly = false, deferToolResult = false, height = 640, sandbox = 'allow-scripts allow-same-origin' }) {
    const escaped = relay.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;');
    return `<!doctype html><meta charset="utf-8"><title>fake host</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:${height}px}</style>
<iframe id="view" sandbox="${sandbox}" allow="microphone; autoplay" srcdoc="${escaped}"></iframe>
<script>
const CURRENT = ${JSON.stringify(current)};
const DIVE = ${JSON.stringify(dive)};
const SAMPLING = ${JSON.stringify(sampling)};
const RESULT_ONLY = ${JSON.stringify(resultOnly)};
const DEFER_TOOL_RESULT = ${JSON.stringify(deferToolResult)};
const log = [];
window.__host = { log, send: null, workerResult: null, releaseToolResult: null };
const view = document.getElementById('view');
// The relay's frame holds the app; messages from the relay's frame are the app's.
function reply(id, body) { view.contentWindow.postMessage({ jsonrpc: '2.0', id, ...body }, '*'); }
function tell(method, params) { view.contentWindow.postMessage({ jsonrpc: '2.0', method, params }, '*'); }
window.__host.send = tell;
window.__host.request = (id, method, params) => view.contentWindow.postMessage({ jsonrpc: '2.0', id, method, params }, '*');
window.addEventListener('message', event => {
  if (event.source !== view.contentWindow) { log.push({ ignored: true, from: 'other' }); return; }
  const message = event.data;
  if (!message || message.jsonrpc !== '2.0') return;
  log.push({ method: message.method, id: message.id, params: message.params, result: message.result });
  if (message.method === 'ui/initialize') {
    reply(message.id, { result: { protocolVersion: '2026-01-26', hostInfo: { name: 'fake host', version: '1' },
      hostCapabilities: SAMPLING ? { sampling: {} } : {}, hostContext: {} } });
  } else if (message.method === 'ui/notifications/initialized') {
    if (!RESULT_ONLY) tell('ui/notifications/tool-input', { arguments: { current: CURRENT } });
    fetch('/api/mcp', { method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'rise_present', arguments: { current: CURRENT } } })
    }).then(response => response.json()).then(({ result }) => {
      window.__host.workerResult = result;
      if (DEFER_TOOL_RESULT) window.__host.releaseToolResult = () => tell('ui/notifications/tool-result', result);
      else tell('ui/notifications/tool-result', result);
    });
  } else if (message.method === 'sampling/createMessage') {
    setTimeout(() => reply(message.id, { result: { role: 'assistant', model: 'fake', stopReason: 'endTurn', content: { type: 'text', text: JSON.stringify(DIVE) } } }), 300);
  } else if (message.method === 'ping') {
    reply(message.id, { result: {} });
  }
});
</script>`;
}

async function openHost(page, baseURL, options = {}) {
  const origin = new URL(baseURL).origin;
  await page.route('**/api/mcp', async route => {
    const request = route.request();
    const response = await handleMcp(new Request(request.url(), { method: request.method(), headers: request.headers(), body: request.postData() }), { MCP_ENABLED: 'true' });
    await route.fulfill({ status: response.status, headers: Object.fromEntries(response.headers), body: await response.text() });
  });
  // `appOrigin` frames RISE from another site than the host page's, as a product host does.
  const path = `/live?embed=mcp&voice=${options.voice ?? 'paced'}`;
  // `selfContained`: the frame holds RISE's own page, its addresses at `appOrigin` (mcp-card.js), as Claude requires.
  const relay = options.selfContained
    ? cardHtml({ origin: options.appOrigin ?? origin, indexHtml: await (await fetch(`${origin}/index.html`)).text(), path })
    : relayHtml({ origin: options.appOrigin ?? origin, path });
  // A product host gives the card an opaque origin (no allow-same-origin: the MCP Apps spec forbids it for a view); the relay's
  // frame keeps it because the relay frames RISE's real page.
  const sandbox = options.selfContained ? 'allow-scripts' : 'allow-scripts allow-same-origin';
  await page.route(`**${HOST}`, route => route.fulfill({ contentType: 'text/html', body: hostPage({ relay, sandbox, current: options.current ?? BLACK_HOLES_CURRENT, sampling: options.sampling ?? true, resultOnly: options.resultOnly ?? false, deferToolResult: options.deferToolResult ?? false, height: options.height, dive: toSealedCurrent(HORIZON_DIVE, 'dive-answer') }) }));
  await page.goto(HOST);
  // The app is a page in a frame in the relay's frame, or the host's frame itself when self-contained.
  return options.selfContained ? page.frameLocator('#view') : page.frameLocator('#view').frameLocator('#app');
}

const log = page => page.evaluate(() => window.__host.log);
const shown = async app => (await app.locator('#atom-display').innerText()).replace(/\s+/gu, ' ').trim();
const expectShown = (app, phrase, timeout = 15_000) => expect.poll(() => shown(app).catch(() => ''), { timeout, message: `waiting to see “${phrase}”` }).toContain(phrase);
const begin = app => app.getByRole('button', { name: 'Play', exact: true }).click();

function oversizedMcpCurrent() {
  return {
    ...BLACK_HOLES_CURRENT,
    segments: Array.from({ length: 16 }, (_, segmentIndex) => ({
      id: `s${segmentIndex}`,
      text: '界 '.repeat(625),
      visual: 'still',
      dives: Array.from({ length: 8 }, (_, diveIndex) => ({
        id: `d${segmentIndex}-${diveIndex}`,
        text: '界'.repeat(200),
        anchor: { fromCharacter: 0, toCharacter: 1, quoteStart: '界', quoteEnd: '界' }
      }))
    }))
  };
}

function workerBoundaryCurrent() {
  const build = unicodeWords => ({
    ...BLACK_HOLES_CURRENT,
    id: 'worker-port-boundary',
    title: 'Measured Worker boundary',
    segments: Array.from({ length: 5 }, (_, segmentIndex) => {
      const text = Array.from({ length: 2_000 }, (_, wordIndex) => segmentIndex * 2_000 + wordIndex < unicodeWords ? '界' : 'A').join(' ');
      return {
        id: `boundary-${segmentIndex}`, text, visual: 'still',
        dives: Array.from({ length: 8 }, (_, diveIndex) => ({
          id: `d${segmentIndex}-${diveIndex}`, text: 'x',
          anchor: { fromCharacter: 0, toCharacter: 1, quoteStart: text[0], quoteEnd: text[0] }
        }))
      };
    })
  });
  let low = 0;
  let high = 10_000;
  while (low < high) {
    const middle = Math.ceil((low + high) / 2);
    if (serializedUtf8Bytes(build(middle)) <= 65_536) low = middle;
    else high = middle - 1;
  }
  const current = build(low);
  let remaining = 65_536 - serializedUtf8Bytes(current);
  for (const segment of current.segments) for (const dive of segment.dives) {
    const added = Math.min(remaining, 599);
    dive.text += 'x'.repeat(added);
    remaining -= added;
  }
  if (remaining !== 0 || serializedUtf8Bytes(current) !== 65_536) throw new Error('Could not construct exact Worker Current boundary');
  return current;
}


test('a maximum valid CJK title keeps Play reachable in phone-sized host frames', async ({ page, baseURL }) => {
  const current = { ...BLACK_HOLES_CURRENT, id: 'long-cjk-title', title: '界'.repeat(200) };
  // The poster never scrolls ("No nested scrolling"): the title is clamped and Play is whole in view.
  const check = async app => {
    const button = app.getByRole('button', { name: 'Play', exact: true });
    await expect(button).toBeVisible();
    await expect(button).toBeInViewport({ ratio: 1 });
    expect(await app.locator('.live-host--poster').evaluate(node => node.scrollHeight - node.clientHeight)).toBe(0);
  };

  await page.setViewportSize({ width: 320, height: 700 });
  let app = await openHost(page, baseURL, { current, height: 640 });
  await check(app);

  await page.setViewportSize({ width: 375, height: 700 });
  await page.reload();
  app = page.frameLocator('#view').frameLocator('#app');
  await check(app);
});

test('tool input waits for the successful Worker result before enabling reader Play', async ({ page, baseURL }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const app = await openHost(page, baseURL, { deferToolResult: true });
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0);
  await expect(app.locator('.atom-word')).toHaveCount(0);
  await expect(app.locator('#rise-stage-controls')).toHaveCount(0);
  await expect.poll(() => page.evaluate(() => typeof window.__host.releaseToolResult)).toBe('function');
  const sent = await log(page);
  expect(sent.filter(entry => entry.method === 'ui/initialize')).toHaveLength(1);
  expect(sent.some(entry => entry.method === 'ui/notifications/initialized')).toBe(true);
  expect(sent.find(entry => entry.method === 'ui/notifications/size-changed').params).toEqual({ height: 560 });
  await page.evaluate(() => window.__host.releaseToolResult());
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  await expect(app.locator('.rise-stage__status')).toContainText(/paced as if spoken/u);
  await expectShown(app, 'Its boundary is called the event horizon', 20_000);
  await app.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(app.locator('.rise-stage__status')).toContainText('Paused.');
  const heldAt = await shown(app);
  await app.getByRole('button', { name: 'Play', exact: true }).click();
  await expectShown(app, 'It is not a surface you could touch', 20_000);
  expect(await shown(app)).not.toBe(heldAt);
  expect(errors).toEqual([]);
});

test('without an installed browser voice the embedded reader explains silent paced playback and keeps it under reader control', async ({ page, baseURL }) => {
  await page.addInitScript(() => {
    const synth = window.speechSynthesis ?? {};
    Object.defineProperty(synth, 'getVoices', { configurable: true, value: () => [] });
    if (!window.speechSynthesis) Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
  });
  const app = await openHost(page, baseURL, {
    sampling: false,
    voice: 'browser',
    current: {
      ...BLACK_HOLES_CURRENT,
      id: 'silent-paced-fallback',
      segments: [{
        id: 'paced',
        text: 'A black hole is a region of space where gravity is so strong that nothing, not even light, can escape its boundary.',
        visual: 'still'
      }]
    }
  });
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  // The glyph on the object says it, not a note: the sentence is for assistive tech.
  const object = app.locator('#rise-stage-controls [data-stage="play"][data-voice="none"]');
  await expect(object).toBeVisible();
  await expect(object).toHaveAttribute('aria-label', 'Pause (silent, no voice is installed)');
  await expect(app.locator('.rise-stage__status')).toContainText('No voice is installed for this browser.');
  await expect(app.locator('.rise-stage__status')).toContainText('paced as if spoken');
  await page.screenshot({ path: 'test-results/live-mcp-speech-unavailable.png' });

  await object.click();
  await expect(app.locator('.rise-stage__status')).toContainText('Paused.');
  const heldAt = await shown(app);
  await page.waitForTimeout(300);
  expect(await shown(app)).toBe(heldAt);
  await app.getByRole('button', { name: 'Play (silent, no voice is installed)', exact: true }).click();
  await expectShown(app, 'nothing, not even light', 10_000);
  expect((await log(page)).filter(entry => entry.method === 'sampling/createMessage')).toHaveLength(0);
});

test('the largest admitted Current crosses Worker, port and reader Play at 65,536 UTF-8 bytes', async ({ page, baseURL }) => {
  const current = workerBoundaryCurrent();
  expect(serializedUtf8Bytes(current)).toBe(65_536);
  const workerResponse = page.waitForResponse('**/api/mcp');
  const app = await openHost(page, baseURL, { resultOnly: true, current });
  const response = (await (await workerResponse).json()).result;
  expect(response.isError).toBeUndefined();
  expect(serializedUtf8Bytes(response.structuredContent.current)).toBe(65_536);
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await begin(app);
  await expect(app.locator('#atom-display')).toContainText('界');
  await expect(app.locator('.rise-stage__status')).toContainText('Reading');
});

test('a schema-valid Current at 65,537 UTF-8 bytes is refused before Play', async ({ page, baseURL }) => {
  const current = workerBoundaryCurrent();
  current.segments[0].dives[0].text += 'x';
  expect(serializedUtf8Bytes(current)).toBe(65_537);
  const workerResponse = page.waitForResponse('**/api/mcp');
  const app = await openHost(page, baseURL, { resultOnly: true, current });
  const response = (await (await workerResponse).json()).result;
  expect(response.isError).toBe(true);
  expect(response.content[0].text).toContain('65,536-byte MCP limit');
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0);
  await expect(app.locator('.atom-word')).toHaveCount(0);
});

test('a validated tool result alone delivers the Current for playback', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL, { resultOnly: true });
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  await expectShown(app, 'that nothing, not even light', 20_000);
});

test('reopening the nested frame reinitializes and plays the host result from its first passage', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  await expectShown(app, 'Its boundary is called the event horizon', 20_000);

  await app.locator('body').evaluate(body => body.ownerDocument.defaultView.location.reload());
  const reopened = page.frameLocator('#view').frameLocator('#app');
  // The poster again, and nothing starts by itself.
  await expect(reopened.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect(reopened.locator('.atom-word')).toHaveCount(0);
  await begin(reopened);
  await expectShown(reopened, 'A black hole is a region of space');
  await expect.poll(async () => (await log(page)).filter(entry => entry.method === 'ui/initialize').length).toBe(2);
  expect((await log(page)).filter(entry => entry.method === 'sampling/createMessage')).toHaveLength(0);
});

test('calmer lowers the held visual target and resumes the same atom without sampling', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  await app.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(app.locator('.rise-stage__status')).toContainText('Paused.');
  const heldAt = await shown(app);
  expect((await log(page)).filter(entry => entry.method === 'sampling/createMessage')).toHaveLength(0);

  await app.getByRole('button', { name: 'Settings', exact: true }).click();
  await app.getByRole('slider', { name: 'Intensity' }).fill('0.55');
  await expect(app.locator('#rise-stage-controls')).toHaveAttribute('data-intensity', '0.55');
  expect(await shown(app)).toBe(heldAt);
  expect((await log(page)).filter(entry => entry.method === 'sampling/createMessage')).toHaveLength(0);

  await app.getByRole('button', { name: 'Play', exact: true }).click();
  await expect.poll(() => shown(app), { timeout: 5_000 }).not.toBe(heldAt);
  expect((await log(page)).filter(entry => entry.method === 'sampling/createMessage')).toHaveLength(0);
});

/**
 * How many different pictures a canvas showed over about a second: 1 when nothing moved, 0 when nothing
 * was drawn. Drawn means some pixel clearly brighter than the void (#0A0A0C) Genesis paints first, so
 * an opaque ground alone counts as blank.
 */
// How many different pictures a canvas shows over about a second: 1 when it holds still, 0 when
// nothing bright is drawn (a ground alone, or a field cleared when its reading let it go).
const picturesOverASecond = canvas => canvas.evaluate(async node => {
  const pictures = new Set();
  let lit = false;
  for (let sample = 0; sample < 6; sample += 1) {
    if (sample) await new Promise(resolve => setTimeout(resolve, 200));
    const { data } = node.getContext('2d').getImageData(0, 0, node.width, node.height);
    let hash = 0;
    for (let i = 0; i < data.length; i += 1) hash = (hash * 31 + data[i]) | 0;
    for (let i = 0; i < data.length && !lit; i += 4) lit = data[i + 3] > 0 && Math.max(data[i], data[i + 1], data[i + 2]) >= 48;
    pictures.add(`${hash}:${getComputedStyle(node).opacity}`);
  }
  return lit ? pictures.size : 0;
});

test('under reduced motion the imagery holds still, the reader is told so, and the reading plays', async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  const app = await openHost(page, baseURL, {
    current: {
      ...BLACK_HOLES_CURRENT,
      id: 'reduced-motion',
      segments: [
        { id: 'turning', text: 'A strange attractor turns behind these words while they are read.', visual: 'attractor' },
        { id: 'growing', text: 'A composition grows beneath this second passage as it is read.', visual: 'genesis' }
      ]
    }
  });
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  // The setting reaches the app through both frames.
  expect(await app.locator('body').evaluate(body => body.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(await app.locator('html').evaluate(html => getComputedStyle(html).scrollBehavior)).toBe('auto');
  await begin(app);

  await expectShown(app, 'A strange attractor turns');
  // Text arrives whole: no word waits to be revealed, and the passage's fade is cut to nothing.
  await expect(app.locator('#atom-display .atom-word[data-pending]')).toHaveCount(0);
  expect(await app.locator('#atom-display').evaluate(node => parseFloat(getComputedStyle(node).transitionDuration))).toBeLessThanOrEqual(0.001);
  // Said to assistive tech, never as a visible note.
  await expect(app.locator('.rise-stage__status')).toContainText('Imagery stays still.');
  await expect(app.locator('#rise-stage-controls li[data-capability]')).toHaveCount(0);
  await expect.poll(() => picturesOverASecond(app.locator('.chamber-attractor canvas.attractor-canvas')), { timeout: 5_000 }).toBe(1);
  // The Still switch shows the system's choice, on and not the reader's to change, with its reason hidden.
  await app.getByRole('button', { name: 'Settings', exact: true }).click();
  const stillSwitch = app.getByRole('switch', { name: 'Still imagery' });
  await expect(stillSwitch).toBeChecked();
  await expect(stillSwitch).toBeDisabled();
  await expect(stillSwitch).toHaveAccessibleDescription('Your system asks for reduced motion.');
  await expect(app.locator('#rise-settings')).toContainText('Still imagery');
  // The reason is in the DOM for the description, and never shown.
  await expect(app.locator('#rise-settings-still-note')).toBeHidden();
  await app.getByRole('button', { name: 'Close settings', exact: true }).click();

  // The second passage's own visual, not a fallback, and it is still too.
  await expectShown(app, 'A composition grows beneath');
  await expect.poll(() => picturesOverASecond(app.locator('.chamber-genesis canvas.klee-field-canvas')), { timeout: 5_000 }).toBe(1);
  await expect(app.locator('#view-read .room-pane[data-pane="chamber"]')).toBeVisible();
});

/**
 * A host resizes its frame on a phone's rotation, a window change, or a move to fullscreen. A reading
 * held at that moment has no frame loop to repaint its field after the resize clears the canvas, so the
 * field must present its held frame itself, or the reader is looking at nothing.
 */
test('a resize while held keeps the attractor on screen', async ({ page, baseURL }) => {
  await page.setViewportSize({ width: 760, height: 640 });
  const app = await openHost(page, baseURL, { height: 640 });
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  const canvas = app.locator('.chamber-attractor canvas.attractor-canvas');
  await app.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(app.locator('.rise-stage__status')).toContainText('Paused.');
  await expect.poll(() => picturesOverASecond(canvas), { timeout: 5_000 }).toBe(1);

  await page.setViewportSize({ width: 560, height: 640 });
  await expect.poll(() => app.locator('body').evaluate(body => body.ownerDocument.defaultView.innerWidth)).toBe(560);
  await expect.poll(() => picturesOverASecond(canvas), { timeout: 5_000 }).toBe(1);
  await expect(app.locator('#atom-display')).toContainText('A black hole is a region of space');
  // The height follows the width: 760 asked for 502, and the narrower frame asks again for 481.
  await expect.poll(async () => (await log(page)).filter(entry => entry.method === 'ui/notifications/size-changed').map(entry => entry.params.height)).toEqual([502, 481]);
});

const TWO_FIELDS = {
  ...BLACK_HOLES_CURRENT,
  id: 'two-fields',
  segments: [
    { id: 'turning', text: 'A strange attractor turns behind these words while they are read.', visual: 'attractor' },
    { id: 'growing', text: 'A composition grows beneath this second passage as it is read.', visual: 'genesis' }
  ]
};

/**
 * The ChatGPT case (docs/experiments/EMBED-SAFETY-2026-10-05.md). The app is framed from another site, so
 * the browser gives the frame storage of its own and the settings a reader saved on RISE's own site are not
 * there. (Playwright turns that partitioning off, so here the frame's storage is simply left empty.) The host
 * page is on localhost and the app on 127.0.0.1: two sites.
 */
test('framed from another site with no saved settings, the embed starts on safe defaults: nothing flashes, and the system’s reduced motion takes hold mid-reading', async ({ page, baseURL }) => {
  const appOrigin = `http://127.0.0.1:${new URL(baseURL).port}`;
  // A loopback frame inside a page Playwright serves itself would otherwise wait on a local-network prompt.
  await page.context().grantPermissions(['local-network-access']);
  // The first passage must outlive the switch's on and off below (the paced voice gives 62 ms a character;
  // at the passage's end the next cue retires the attractor and removes its canvas), so it is long.
  const longTurn = { ...TWO_FIELDS.segments[0], text: 'A strange attractor turns behind these words while they are read, and keeps turning as the reader opens the settings, holds the imagery still, lets it move again, and then asks the system itself for stillness, all before the second passage and its own composition arrive to be read in turn.' };
  const app = await openHost(page, baseURL, { appOrigin, current: { ...TWO_FIELDS, id: 'two-fields-long', segments: [longTurn, TWO_FIELDS.segments[1]] } });
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  const applied = () => app.locator('html').evaluate(html => ({
    origin: location.origin,
    stored: localStorage.getItem('rise-settings'),
    classes: [...html.classList].filter(name => /^(reduced-motion|photosensitivity-mode)$/u.test(name)),
    fontSize: html.dataset.fontSize,
    chamberFace: html.dataset.chamberFace
  }));
  expect(await applied()).toEqual({ origin: appOrigin, stored: null, classes: [], fontSize: 'medium', chamberFace: 'literary' });

  await begin(app);
  await expectShown(app, 'A strange attractor turns');
  // No photosensitivity notice: a Composer presentation is a continuous field, and nothing in it flashes.
  await expect(app.locator('#photosensitivity-modal')).toBeHidden();
  const attractor = app.locator('.chamber-attractor canvas.attractor-canvas');
  // With no system preference the filament turns: a Reduced motion choice saved on RISE's site would not travel.
  await expect.poll(() => picturesOverASecond(attractor), { timeout: 5_000 }).toBeGreaterThan(1);

  // The Still switch is the reader's own channel: it holds the field at once and is saved in this frame's storage.
  await app.getByRole('button', { name: 'Settings', exact: true }).click();
  const stillSwitch = app.getByRole('switch', { name: 'Still imagery' });
  await expect(stillSwitch).not.toBeChecked();
  await stillSwitch.click();
  await expect(stillSwitch).toBeChecked();
  await expect.poll(async () => (await applied()).classes).toEqual(['reduced-motion']);
  expect(JSON.parse((await applied()).stored).reducedMotion).toBe(true);
  await expect(app.locator('.rise-stage__status')).toContainText('Imagery stays still.');
  await expect.poll(() => picturesOverASecond(attractor), { timeout: 5_000 }).toBe(1);
  await stillSwitch.click();
  await expect.poll(async () => (await applied()).classes).toEqual([]);
  expect(JSON.parse((await applied()).stored).reducedMotion).toBe(false);
  await expect(app.locator('.rise-stage__status')).not.toContainText('stays still');
  await expect.poll(() => picturesOverASecond(attractor), { timeout: 5_000 }).toBeGreaterThan(1);
  await app.getByRole('button', { name: 'Close settings', exact: true }).click();

  // The system's preference does reach the cross-site frame, and takes hold mid-reading.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await expect.poll(async () => (await applied()).classes).toEqual(['reduced-motion']);
  await expect.poll(() => picturesOverASecond(attractor), { timeout: 5_000 }).toBe(1);
  await expectShown(app, 'A composition grows beneath');
  await expect.poll(() => picturesOverASecond(app.locator('.chamber-genesis canvas.klee-field-canvas')), { timeout: 5_000 }).toBe(1);
  await expect(app.locator('#atom-display .atom-word[data-pending]')).toHaveCount(0);
  await expect(app.locator('#photosensitivity-modal')).toBeHidden();
});


test('while paused the field holds one frame, a later passage’s field included', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL, { current: TWO_FIELDS });
  await begin(app);
  await expectShown(app, 'A composition grows beneath');
  const field = await app.locator('.chamber-genesis canvas.klee-field-canvas').elementHandle();
  // The check can see drawing: while the reading plays, the field moves.
  await expect.poll(() => picturesOverASecond(field), { timeout: 5_000 }).toBeGreaterThan(1);

  await app.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(app.locator('.rise-stage__status')).toContainText('Paused.');
  await expect(app.locator('#view-read .room-pane[data-pane="chamber"]')).toBeVisible();
  await expect.poll(() => picturesOverASecond(field), { timeout: 5_000 }).toBe(1);
});

test('once the reading has ended, the display stays, its field holds one frame, and Play again is offered', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL, { current: { ...TWO_FIELDS, id: 'one-field', segments: TWO_FIELDS.segments.slice(0, 1) } });
  await begin(app);
  const field = await app.locator('.chamber-attractor canvas.attractor-canvas').elementHandle({ timeout: 15_000 });
  await expect.poll(() => picturesOverASecond(field), { timeout: 5_000 }).toBeGreaterThan(1);

  await expect(app.locator('.rise-stage__status')).toContainText('Finished', { timeout: 20_000 });
  await expect(app.locator('#chamber-display')).toBeVisible();
  expect(await picturesOverASecond(field)).toBeLessThanOrEqual(1);
  await expect(app.getByRole('button', { name: 'Play again', exact: true })).toBeVisible();
});

test('from the keyboard alone: Play, Pause, the sheet and Play again, with the focus kept on the stage throughout', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL, { current: { ...TWO_FIELDS, id: 'one-field', segments: TWO_FIELDS.segments.slice(0, 1) } });
  const object = app.locator('#rise-stage-controls [data-stage="play"]');
  const settings = app.getByRole('button', { name: 'Settings', exact: true });
  const status = app.locator('.rise-stage__status');
  await app.getByRole('button', { name: 'Play', exact: true }).focus();
  await page.keyboard.press('Enter');
  // The poster's Play is gone once pressed; the focus is handed to the object that replaced it.
  await expect(object).toHaveAttribute('aria-label', 'Pause', { timeout: 10_000 });
  await expect(object).toBeFocused();
  await page.keyboard.press('Space');
  await expect(status).toContainText('Paused.');
  await expect(object).toBeFocused();

  await page.keyboard.press('Tab');
  await expect(settings).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(app.locator('#rise-settings')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(app.locator('#rise-settings')).toBeHidden();
  await expect(settings).toBeFocused();

  await page.keyboard.press('Shift+Tab');
  await expect(object).toBeFocused();
  await page.keyboard.press('Space');
  await expect(status).toContainText('Finished', { timeout: 20_000 });
  await expect(object).toHaveAttribute('aria-label', 'Play again');
  await expect(object).toBeFocused();
  await page.keyboard.press('Enter');
  await expect(object).toHaveAttribute('aria-label', 'Pause', { timeout: 10_000 });
  await expect(object).toBeFocused();
});

/** The Settings sheet's own scroll: a card scrolls nothing inside it ("No nested scrolling"). */
const sheetScroll = app => app.locator('#rise-settings').evaluate(sheet => sheet.scrollHeight - sheet.clientHeight);

test('in a short frame both objects stay whole in view, the sheet opens without scrolling, and Intensity works', async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.setViewportSize({ width: 900, height: 481 });
  const app = await openHost(page, baseURL, { height: 481 });
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  const play = app.getByRole('button', { name: 'Pause', exact: true });
  const settings = app.getByRole('button', { name: 'Settings', exact: true });
  for (const width of [900, 600, 420]) {
    await page.setViewportSize({ width, height: 481 });
    await expect.poll(() => app.locator('body').evaluate(body => body.ownerDocument.defaultView.innerWidth)).toBe(width);
    await expect(play, `Pause at ${width} px wide`).toBeInViewport({ ratio: 1 });
    await expect(settings, `Settings at ${width} px wide`).toBeInViewport({ ratio: 1 });
  }
  // The stage never scrolls: no element in it can scroll, and nothing a reader can see is taller than
  // its box. The visually hidden regions (1 px boxes under clip-path) hold whole sentences by design.
  expect(await app.locator('#rise-stage-controls').evaluate(stage => {
    const all = [stage, ...stage.querySelectorAll('*')];
    const scrollable = all.filter(node => /auto|scroll/u.test(getComputedStyle(node).overflowY));
    const visible = all.filter(node => !node.matches('.rise-stage__sr, .rise-stage__sr *') && node.getClientRects().length > 0);
    return {
      scrollable: scrollable.map(node => `${node.tagName}.${node.className}`),
      taller: visible.filter(node => node.scrollHeight > node.clientHeight + 1).map(node => `${node.tagName}.${node.className}`)
    };
  })).toEqual({ scrollable: [], taller: [] });

  await play.click();
  await expect(app.locator('.rise-stage__status')).toContainText('Paused.');
  for (const [width, intensity] of [[600, '0.55'], [420, '0.45']]) {
    await page.setViewportSize({ width, height: 481 });
    await expect.poll(() => app.locator('body').evaluate(body => body.ownerDocument.defaultView.innerWidth)).toBe(width);
    await settings.click();
    await expect(app.locator('#rise-settings')).toBeInViewport({ ratio: 1 });
    expect(await sheetScroll(app), `the sheet at ${width} px wide`).toBe(0);
    await app.getByRole('slider', { name: 'Intensity' }).fill(intensity);
    await expect(app.locator('#rise-stage-controls')).toHaveAttribute('data-intensity', intensity);
    await app.getByRole('button', { name: 'Close settings', exact: true }).click();
    await expect(app.locator('#rise-settings')).toBeHidden();
  }
});

test('the stage at three widths, held with the sheet open', async ({ page, baseURL }) => {
  for (const width of [390, 560, 760]) {
    await page.setViewportSize({ width, height: 640 });
    const app = await openHost(page, baseURL, { height: 560 });
    await begin(app);
    await expectShown(app, 'A black hole is a region of space');
    await app.getByRole('button', { name: 'Pause', exact: true }).click();
    await expect(app.locator('.rise-stage__status')).toContainText('Paused.');
    await app.getByRole('button', { name: 'Settings', exact: true }).click();
    await expect(app.locator('#rise-settings')).toBeVisible();
    await page.screenshot({ path: `test-results/live-mcp-stage-${width}.png` });
  }
});

test('an invalid worker result has no playable Current', async ({ page, baseURL }) => {
  const serverResponse = page.waitForResponse('**/api/mcp');
  const app = await openHost(page, baseURL, { resultOnly: true, current: { ...BLACK_HOLES_CURRENT, segments: [{ id: 's1', text: 'Fine words.' }, { id: 's2', text: 'a | b' }] } });
  expect((await (await serverResponse).json()).result.isError).toBe(true);
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0);
  await expect(app.locator('.atom-word')).toHaveCount(0);
});

test('a valid Current over the MCP payload budget is refused by the Worker and explained in the app', async ({ page, baseURL }) => {
  const serverResponse = page.waitForResponse('**/api/mcp');
  const app = await openHost(page, baseURL, { resultOnly: true, current: oversizedMcpCurrent() });
  const result = (await (await serverResponse).json()).result;
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain('65,536-byte MCP limit');
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0);
  await expect(app.locator('.live-embed[role="alert"]')).toContainText('correct the answer');
  await expect(app.locator('.atom-word')).toHaveCount(0);
});

test('a Composer presentation offers no Dive, and puts no question to the host’s model even where it could', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'that nothing, not even light');
  // No question box exists at all, and no button but the two objects.
  await expect(app.locator('#rise-stage-controls form, #rise-stage-controls input[type="text"]')).toHaveCount(0);
  await expect(app.getByRole('button', { name: /Dive|Look under/u })).toHaveCount(0);
  await expect(app.getByRole('button', { name: /^(Stop|Interrupt|Surface)$/u })).toHaveCount(0);
  await app.getByRole('button', { name: 'Pause', exact: true }).click();
  await expect(app.locator('.rise-stage__status')).toContainText('Paused.');
  await app.getByRole('button', { name: 'Play', exact: true }).click();
  await expect(app.locator('.rise-stage__status')).toContainText(/paced as if spoken/u);
  expect((await log(page)).some(entry => entry.method === 'sampling/createMessage')).toBe(false);
});

test('a long invalid Current is refused whole with recovery guidance within the runtime limit', async ({ page, baseURL }) => {
  const invalid = { ...BLACK_HOLES_CURRENT, ['x'.repeat(400)]: true };
  const app = await openHost(page, baseURL, { current: invalid });
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toHaveCount(0);
  const error = app.locator('.live-embed[role="alert"]');
  await expect(error).toContainText('refused');
  await expect(error).toContainText('Ask the assistant again');
  expect((await error.textContent()).length).toBeLessThanOrEqual(300);
  await expect(app.locator('.atom-word')).toHaveCount(0);
});

test('the host’s ping is answered, and its request to tear down is answered and ends the reading', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  const field = await app.locator('.chamber-attractor canvas.attractor-canvas').elementHandle();
  await expect.poll(() => picturesOverASecond(field), { timeout: 5_000 }).toBeGreaterThan(1);
  await page.evaluate(() => { window.__host.request('p1', 'ping'); });
  await expect.poll(async () => (await log(page)).some(entry => entry.id === 'p1' && entry.result !== undefined)).toBe(true);
  await page.evaluate(() => { window.__host.request('t1', 'ui/resource-teardown', {}); });
  await expect.poll(async () => (await log(page)).some(entry => entry.id === 't1' && entry.result !== undefined)).toBe(true);
  await expect(app.locator('#rise-stage-controls')).toHaveCount(0);
  await expect(app.locator('.live-embed')).toContainText('Finished.');
  // The reading is over, so its imagery is too.
  expect(await picturesOverASecond(field)).toBeLessThanOrEqual(1);
});

test('a document at another origin in the app’s frame cannot speak to the host through the relay, though RISE’s own page can', async ({ page, baseURL }) => {
  await openHost(page, baseURL);
  await expect.poll(async () => (await log(page)).some(entry => entry.method === 'ui/initialize')).toBe(true);
  const frame = page.frames().find(item => item.url().includes('/live?embed=mcp'));
  const speak = method => frame.evaluate(name => window.parent.postMessage({ jsonrpc: '2.0', method: name, params: {} }, '*'), method);

  // The control: what RISE's own page says is passed on.
  await speak('x/from-rise');
  await expect.poll(async () => (await log(page)).some(entry => entry.method === 'x/from-rise')).toBe(true);

  // The frame is now a page on another origin (the same server by its address, not its name).
  const elsewhere = new URL(baseURL);
  elsewhere.hostname = elsewhere.hostname === 'localhost' ? '127.0.0.1' : 'localhost';
  await frame.goto(`${elsewhere.origin}/privacy.html`);
  await speak('x/from-elsewhere');
  await page.waitForTimeout(500);
  expect((await log(page)).some(entry => entry.method === 'x/from-elsewhere')).toBe(false);
});

test('opened directly in a browser, with no host, it says what it is for and does nothing', async ({ page }) => {
  await page.goto('/live?embed=mcp&voice=paced');
  await expect(page.locator('.live-embed')).toContainText('Open it from one');
  await expect(page.locator('.live-start')).toHaveCount(0);
  await expect(page.locator('#rise-stage-controls')).toHaveCount(0);
});

const backgroundOf = locator => locator.evaluate(element => getComputedStyle(element).backgroundColor);
const posterTitle = app => app.locator('.live-host--poster').getByRole('heading', { level: 1 });
/** A computed color's red, green and blue as 0–255, whether Chromium writes rgb() or color(srgb). */
const channels = color => {
  const numbers = color.match(/[\d.]+/gu).slice(0, 3).map(Number);
  return color.startsWith('color(') ? numbers.map(value => Math.round(value * 255)) : numbers;
};

/** Lit pixels (alpha ≥ 16) of a 64×64 grid over the drawn filament, and their summed channels. */
const filamentPaint = app => app.locator('.chamber-attractor canvas.attractor-canvas').first().evaluate(element => {
  const totals = { lit: 0, r: 0, g: 0, b: 0 };
  const { width, height } = element;
  if (!width || !height) return totals;
  const pixels = element.getContext('2d').getImageData(0, 0, width, height).data;
  for (let y = 0; y < 64; y += 1) {
    const py = Math.min(height - 1, Math.floor(y * height / 64));
    for (let x = 0; x < 64; x += 1) {
      const px = Math.min(width - 1, Math.floor(x * width / 64));
      const offset = (py * width + px) * 4;
      if (pixels[offset + 3] < 16) continue;
      totals.lit += 1;
      totals.r += pixels[offset];
      totals.g += pixels[offset + 1];
      totals.b += pixels[offset + 2];
    }
  }
  return totals;
});

test('a themed answer opens on a poster in its colors, and its reading and filament take them', async ({ page, baseURL }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const app = await openHost(page, baseURL, { current: { ...BLACK_HOLES_CURRENT, theme: 'jade' } });
  await expect(posterTitle(app)).toHaveText(BLACK_HOLES_CURRENT.title);
  await expect(app.getByRole('button', { name: 'Play', exact: true })).toBeVisible();
  await expect.poll(() => backgroundOf(app.locator('body'))).toBe('rgb(6, 25, 18)');

  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  await expect.poll(() => backgroundOf(app.locator('.chamber').first())).toBe('rgb(6, 25, 18)');
  // The plate behind words over imagery is the theme's ground, not RISE ink.
  expect((await app.locator('.chamber').first().evaluate(element => getComputedStyle(element).getPropertyValue('--reading-scrim'))).toLowerCase()).toContain('#061912');
  // The sheet's labels are in the theme's ink, not RISE's.
  await app.getByRole('button', { name: 'Settings', exact: true }).click();
  const labelInk = () => app.locator('#rise-settings label').first().evaluate(element => getComputedStyle(element).color);
  expect(channels(await labelInk())).toEqual([232, 255, 244]);
  // The default white filament is blue-dominant; green-dominant paint is the jade palette drawing.
  const filamentIs = (name, dominant) => expect.poll(async () => {
    const { lit, r, g, b } = await filamentPaint(app).catch(() => ({ lit: 0, r: 0, g: 0, b: 0 }));
    return lit > 20 && dominant({ r, g, b });
  }, { timeout: 5_000, message: `waiting for a ${name}-dominant filament` }).toBe(true);
  await filamentIs('green', ({ r, g, b }) => g > b && g > r);

  // The Theme row recolours the frame, the reading and the live filament in place; "As written" gives jade back.
  const themeSelect = app.getByRole('combobox', { name: 'Theme' });
  await expect(themeSelect).toHaveValue('');
  await themeSelect.selectOption('rose');
  await expect.poll(() => backgroundOf(app.locator('body'))).toBe('rgb(26, 4, 20)');
  await expect.poll(() => backgroundOf(app.locator('.chamber').first())).toBe('rgb(26, 4, 20)');
  await expect.poll(async () => channels(await labelInk())).toEqual([255, 240, 244]);
  await filamentIs('red', ({ r, g, b }) => r > g && r > b);
  await themeSelect.selectOption('');
  await expect.poll(() => backgroundOf(app.locator('body'))).toBe('rgb(6, 25, 18)');
  await expect.poll(() => backgroundOf(app.locator('.chamber').first())).toBe('rgb(6, 25, 18)');
  await filamentIs('green', ({ r, g, b }) => g > b && g > r);
  await app.getByRole('button', { name: 'Close settings', exact: true }).click();

  expect((await log(page)).filter(entry => entry.method === 'sampling/createMessage')).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('an answer without a theme keeps RISE ink and still shows its title over Play', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expect(posterTitle(app)).toHaveText(BLACK_HOLES_CURRENT.title);
  const beginButton = app.getByRole('button', { name: 'Play', exact: true });
  await expect(beginButton).toBeVisible();
  const [title, button] = [await posterTitle(app).boundingBox(), await beginButton.boundingBox()];
  expect(title.y + title.height).toBeLessThanOrEqual(button.y);
  await expect.poll(() => backgroundOf(app.locator('body'))).toBe('rgb(6, 5, 26)');
});

// SCR-002: a Current may name any of the ten looks; the card draws each through its own field.
const LOOK_FIELDS = {
  plain: null,
  gallery: '.chamber-continuous-field :is(canvas, img)',
  nocturne: '.chamber-continuous-field :is(canvas, img)',
  garden: '.chamber-genesis',
  flame: '.chamber-living-flame',
  signal: '.chamber-attractor',
  iris: '.chamber-continuous-field :is(canvas, img)',
  revel: '.chamber-continuous-field :is(canvas, img)',
  vigil: '.chamber-focal',
  inlay: '.chamber-continuous-field :is(canvas, img)'
};
for (const [look, field] of Object.entries(LOOK_FIELDS)) {
  test(`a Current in the ${look} look plays in the card with that look's imagery`, async ({ page, baseURL }) => {
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    const { theme: _theme, ...answer } = BLACK_HOLES_CURRENT;
    const current = { ...answer, look, segments: answer.segments.map(({ visual: _visual, ...segment }) => segment) };
    const app = await openHost(page, baseURL, { current });
    await expect(posterTitle(app)).toHaveText(BLACK_HOLES_CURRENT.title);
    await begin(app);
    await expectShown(app, 'A black hole is a region of space');
    if (field) await expect(app.locator(field).first()).toBeAttached({ timeout: 15_000 });
    else await expect(app.locator('.chamber-continuous-field :is(canvas, img), .chamber-genesis, .chamber-attractor, .chamber-living-flame, .chamber-focal')).toHaveCount(0);
    // Inlay keeps its imagery and face but never masks the spoken sentence inside one word.
    if (look === 'inlay') await expect(app.locator('#atom-display.is-mask')).toHaveCount(0);
    // Intensity is offered only where the field has a verified mutable control: the attractor (SCR-003).
    await app.getByRole('button', { name: 'Settings', exact: true }).click();
    const slider = app.getByRole('slider', { name: 'Intensity' });
    if (look === 'signal') await expect(slider).toBeVisible();
    else await expect(slider).toBeHidden();
    expect(errors).toEqual([]);
  });
}

// LIVE-010: the self-contained card. RISE's own page is the host's frame, its addresses at another origin
// (localhost against the host's 127.0.0.1), so modules, styles and content cross origins as in a product host.
test('the self-contained card plays a Current from another origin, framing nothing', async ({ page, baseURL }) => {
  const errors = [];
  const seen = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (['error', 'warning'].includes(message.type())) seen.push(`console.${message.type()}: ${message.text().slice(0, 300)}`); });
  page.on('requestfailed', request => seen.push(`failed: ${request.url()} ${request.failure()?.errorText ?? ''}`));
  page.on('response', response => { if (response.status() >= 400) seen.push(`${response.status()}: ${response.url()}`); });
  const appOrigin = new URL(baseURL).origin.replace('127.0.0.1', 'localhost');
  const app = await openHost(page, baseURL, { selfContained: true, appOrigin, current: { ...BLACK_HOLES_CURRENT, look: 'signal' } });
  // What the card did in its sandbox, printed before the first assertion so a failure explains itself.
  await posterTitle(app).waitFor({ timeout: 15_000 }).catch(() => {});
  console.log(`[self-contained] errors=${JSON.stringify(errors)} seen=${JSON.stringify(seen.slice(0, 20))} log=${JSON.stringify((await page.evaluate(() => window.__host.log.map(entry => entry.method ?? (entry.ignored ? 'ignored' : 'reply')))).slice(0, 12))}`);
  await expect(posterTitle(app)).toHaveText(BLACK_HOLES_CURRENT.title);
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  await expect(app.locator('.chamber-attractor').first()).toBeAttached({ timeout: 15_000 });
  expect(await app.locator('iframe').count()).toBe(0);
  // Its code came from RISE's origin, not the host's.
  const scripts = await page.frameLocator('#view').locator('script[type="module"]').evaluateAll(nodes => nodes.map(node => node.src));
  expect(scripts.length).toBeGreaterThan(0);
  for (const src of scripts) expect(src.startsWith(appOrigin)).toBe(true);
  expect(errors).toEqual([]);
});
