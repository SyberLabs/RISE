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
import { handleMcp } from '../worker/mcp-server.mjs';
import { expect, test } from './fixtures.js';

const HOST = '/__mcp-host';

/** The fake host's page: a frame for the relay, and a script that plays the host. */
function hostPage({ relay, current, sampling = true, dive, resultOnly = false, deferToolResult = false, height = 640 }) {
    const escaped = relay.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;');
    return `<!doctype html><meta charset="utf-8"><title>fake host</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:${height}px}</style>
<iframe id="view" sandbox="allow-scripts allow-same-origin" allow="microphone; autoplay" srcdoc="${escaped}"></iframe>
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
  const relay = relayHtml({ origin, path: '/live?embed=mcp&voice=paced' });
  await page.route(`**${HOST}`, route => route.fulfill({ contentType: 'text/html', body: hostPage({ relay, current: options.current ?? BLACK_HOLES_CURRENT, sampling: options.sampling ?? true, resultOnly: options.resultOnly ?? false, deferToolResult: options.deferToolResult ?? false, height: options.height, dive: toSealedCurrent(HORIZON_DIVE, 'dive-answer') }) }));
  await page.goto(HOST);
  // The app is a page in a frame in the relay's frame.
  return page.frameLocator('#view').frameLocator('#app');
}

const log = page => page.evaluate(() => window.__host.log);
const shown = async app => (await app.locator('#atom-display').innerText()).replace(/\s+/gu, ' ').trim();
const expectShown = (app, phrase, timeout = 15_000) => expect.poll(() => shown(app).catch(() => ''), { timeout, message: `waiting to see “${phrase}”` }).toContain(phrase);
const begin = app => app.getByRole('button', { name: 'Begin', exact: true }).click();

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


test('a maximum valid CJK title keeps Begin reachable in phone-sized host frames', async ({ page, baseURL }) => {
  const current = { ...BLACK_HOLES_CURRENT, id: 'long-cjk-title', title: '界'.repeat(200) };
  const check = async app => {
    const button = app.getByRole('button', { name: 'Begin', exact: true });
    await expect(button).toBeVisible();
    const poster = app.locator('.live-host--poster');
    const geometry = await poster.evaluate(node => {
      node.scrollTop = node.scrollHeight;
      const frame = node.getBoundingClientRect();
      const begin = node.querySelector('.live-start').getBoundingClientRect();
      return {
        scrollTop: node.scrollTop,
        maxScroll: Math.max(0, node.scrollHeight - node.clientHeight),
        beginTop: begin.top,
        beginBottom: begin.bottom,
        frameTop: frame.top,
        frameBottom: frame.bottom
      };
    });
    expect(geometry.scrollTop).toBe(geometry.maxScroll);
    expect(geometry.beginTop).toBeGreaterThanOrEqual(geometry.frameTop);
    expect(geometry.beginBottom).toBeLessThanOrEqual(geometry.frameBottom);
  };

  await page.setViewportSize({ width: 320, height: 700 });
  let app = await openHost(page, baseURL, { current, height: 640 });
  await check(app);

  await page.setViewportSize({ width: 375, height: 700 });
  await page.reload();
  app = page.frameLocator('#view').frameLocator('#app');
  await check(app);
});

test('the reader begins the held Current once despite the matching tool result arriving later', async ({ page, baseURL }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const app = await openHost(page, baseURL, { deferToolResult: true });
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  await expect(app.locator('.atom-word')).toHaveCount(0);
  await expect(app.locator('#live-controls')).toHaveCount(0);
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  await expect(app.locator('.live-controls__status')).toContainText(/paced as if spoken/u);

  const sent = await log(page);
  const hello = sent.filter(entry => entry.method === 'ui/initialize');
  expect(hello).toHaveLength(1);
  expect(hello[0].params).toMatchObject({ appInfo: { name: 'RISE' }, protocolVersion: '2026-01-26' });
  expect(sent.some(entry => entry.method === 'ui/notifications/initialized')).toBe(true);
  expect(sent.find(entry => entry.method === 'ui/notifications/size-changed').params.height).toBe(640);
  // Hold later in the Current, then release its real worker result.
  await expectShown(app, 'Its boundary is called the event horizon', 20_000);
  await app.getByRole('button', { name: 'Interrupt', exact: true }).click();
  await expect(app.locator('.live-controls__status')).toContainText('Held where you are');
  const heldAt = await shown(app);
  await expect.poll(() => page.evaluate(() => window.__host.workerResult?.structuredContent?.current?.id ?? null)).toBe('black-holes');
  await expect.poll(() => page.evaluate(() => typeof window.__host.releaseToolResult)).toBe('function');
  await page.evaluate(() => window.__host.releaseToolResult());
  await expect(app.locator('.live-controls__status')).toContainText('Held where you are');
  expect(await shown(app)).toBe(heldAt);
  await app.getByRole('button', { name: 'Resume', exact: true }).click();
  await expectShown(app, 'It is not a surface you could touch', 20_000);
  expect(errors).toEqual([]);
});

test('a validated tool result alone delivers the Current for playback', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL, { resultOnly: true });
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  await expectShown(app, 'that nothing, not even light', 20_000);
});

test('reopening the nested frame reinitializes and plays the host result from its first passage', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  await expect(app.locator('#live-controls')).toContainText('Reopening starts this reading from the beginning');
  await expectShown(app, 'Its boundary is called the event horizon', 20_000);

  await app.locator('body').evaluate(body => body.ownerDocument.defaultView.location.reload());
  const reopened = page.frameLocator('#view').frameLocator('#app');
  await expect(reopened.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  await begin(reopened);
  await expectShown(reopened, 'A black hole is a region of space');
  await expect(reopened.locator('#live-controls')).toContainText('Reopening starts this reading from the beginning');
  await expect.poll(async () => (await log(page)).filter(entry => entry.method === 'ui/initialize').length).toBe(2);
  expect((await log(page)).filter(entry => entry.method === 'sampling/createMessage')).toHaveLength(0);
});

test('calmer lowers the held visual target and resumes the same atom without sampling', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  await app.getByRole('button', { name: 'Interrupt', exact: true }).click();
  await expect(app.locator('.live-controls__status')).toContainText('Held where you are');
  const heldAt = await shown(app);
  expect((await log(page)).filter(entry => entry.method === 'sampling/createMessage')).toHaveLength(0);

  await app.locator('#live-controls-visual').fill('please make it calmer');
  await app.getByRole('button', { name: 'Change visual', exact: true }).click();
  await expect(app.locator('.live-controls__status')).toContainText('brightness target changed to 0.55');
  expect(await shown(app)).toBe(heldAt);
  expect((await log(page)).filter(entry => entry.method === 'sampling/createMessage')).toHaveLength(0);

  await app.getByRole('button', { name: 'Resume', exact: true }).click();
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

test('under reduced motion the imagery holds still, the reader is told so, and the reading plays and stops', async ({ page, baseURL }) => {
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
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  // The setting reaches the app through both frames.
  expect(await app.locator('body').evaluate(body => body.ownerDocument.defaultView.matchMedia('(prefers-reduced-motion: reduce)').matches)).toBe(true);
  expect(await app.locator('html').evaluate(html => getComputedStyle(html).scrollBehavior)).toBe('auto');
  await begin(app);

  await expectShown(app, 'A strange attractor turns');
  const note = app.locator('.live-controls__notes [data-capability="reducedMotion"]');
  await expect(note).toBeVisible();
  await expect(note).toHaveText('Reduced motion is on. Imagery stays still.');
  // In the reading's ink 72% toward its ground (here RISE's own), not a fixed lavender.
  expect(channels(await note.evaluate(element => getComputedStyle(element).color))).toEqual([173, 174, 191]);
  await expect.poll(() => picturesOverASecond(app.locator('.chamber-attractor canvas.attractor-canvas')), { timeout: 5_000 }).toBe(1);

  // The second passage's own visual, not a fallback, and it is still too.
  await expectShown(app, 'A composition grows beneath');
  await expect.poll(() => picturesOverASecond(app.locator('.chamber-genesis canvas.klee-field-canvas')), { timeout: 5_000 }).toBe(1);

  await app.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(app.locator('.live-embed')).toContainText('Stopped.');
  await expect(app.locator('#live-controls')).toHaveCount(0);
  await expect(app.locator('#view-chamber')).toBeHidden();
});

const TWO_FIELDS = {
  ...BLACK_HOLES_CURRENT,
  id: 'two-fields',
  segments: [
    { id: 'turning', text: 'A strange attractor turns behind these words while they are read.', visual: 'attractor' },
    { id: 'growing', text: 'A composition grows beneath this second passage as it is read.', visual: 'genesis' }
  ]
};

test('after Stop the hidden reading draws nothing more, a later passage’s field included', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL, { current: TWO_FIELDS });
  await begin(app);
  await expectShown(app, 'A composition grows beneath');
  const field = await app.locator('.chamber-genesis canvas.klee-field-canvas').elementHandle();
  // The check can see drawing: while the reading plays, the field moves.
  await expect.poll(() => picturesOverASecond(field), { timeout: 5_000 }).toBeGreaterThan(1);

  await app.getByRole('button', { name: 'Stop', exact: true }).click();
  await expect(app.locator('.live-embed')).toContainText('Stopped.');
  await expect(app.locator('#view-chamber')).toBeHidden();
  expect(await picturesOverASecond(field)).toBeLessThanOrEqual(1);
});

test('once the reading has ended, its field draws nothing more behind the closing screen', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL, { current: { ...TWO_FIELDS, id: 'one-field', segments: TWO_FIELDS.segments.slice(0, 1) } });
  await begin(app);
  const field = await app.locator('.chamber-attractor canvas.attractor-canvas').elementHandle({ timeout: 15_000 });
  await expect.poll(() => picturesOverASecond(field), { timeout: 5_000 }).toBeGreaterThan(1);

  await expect(app.locator('.live-controls__status')).toContainText('Finished', { timeout: 20_000 });
  await expect(app.locator('#chamber-display')).toBeHidden();
  expect(await picturesOverASecond(field)).toBeLessThanOrEqual(1);
});

/** Where the status line and each button in the row lie against the panel, in the next painted frame, and inside the frame. */
const controlsHead = app => app.locator('#live-controls').evaluate(async panel => {
  await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const box = panel.getBoundingClientRect();
  const top = box.top + panel.clientTop;
  const bottom = Math.min(top + panel.clientHeight, innerHeight);
  const shown = [panel.querySelector('.live-controls__status'), ...panel.querySelectorAll('.live-controls__buttons button:not([hidden])')]
    .map(element => ({ name: element.matches('.live-controls__status') ? 'status' : element.textContent, top: element.getBoundingClientRect().top, bottom: element.getBoundingClientRect().bottom }));
  const cut = shown
    .filter(element => element.top < top || element.bottom > bottom)
    .map(element => `${element.name} ${element.top}-${element.bottom} outside ${top}-${bottom}`);
  return { scrollTop: panel.scrollTop, names: shown.map(element => element.name), cut };
});

test('in a short frame of any width the reader keeps what is happening, Interrupt and Stop in view, and can still reach the rest', async ({ page, baseURL }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  // ChatGPT's inline frames are narrower than the default 1280 px viewport, where the row once fitted by luck.
  await page.setViewportSize({ width: 900, height: 420 });
  const app = await openHost(page, baseURL, { height: 420 });
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  for (const width of [900, 600, 420]) {
    await page.setViewportSize({ width, height: 420 });
    await expect.poll(() => app.locator('body').evaluate(body => body.ownerDocument.defaultView.innerWidth)).toBe(width);
    // As the panel first opens, unscrolled.
    expect.soft(await controlsHead(app), `at ${width} px wide`).toEqual({ scrollTop: 0, names: expect.arrayContaining(['status', 'Interrupt', 'Stop']), cut: [] });
  }
  // What sits below the row is still reachable by scrolling the panel.
  for (const selector of ['#live-controls-question', '#live-controls-visual', '.live-controls__notes [data-capability="reducedMotion"]']) {
    const element = app.locator(selector);
    await element.evaluate(node => node.scrollIntoView({ block: 'center' }));
    await expect(element, selector).toBeInViewport({ ratio: 1 });
  }
  await expect(app.locator('.live-controls__notes [data-capability="reducedMotion"]')).toHaveText('Reduced motion is on. Imagery stays still.');

  // A two-line status, a Dive under way, at the narrowest width, with Surface in the row.
  await app.locator('#live-controls-question').fill('dive on event horizon');
  await app.getByRole('button', { name: /Dive: ask about this place/u }).click();
  await expect(app.locator('.live-controls__status')).toContainText('The reading you left is held exactly where it was');
  await app.locator('#live-controls').evaluate(panel => { panel.scrollTop = 0; });
  expect(await controlsHead(app)).toEqual({ scrollTop: 0, names: expect.arrayContaining(['status', 'Surface', 'Stop']), cut: [] });
});

test('an invalid worker result has no playable Current', async ({ page, baseURL }) => {
  const serverResponse = page.waitForResponse('**/api/mcp');
  const app = await openHost(page, baseURL, { resultOnly: true, current: { ...BLACK_HOLES_CURRENT, segments: [{ id: 's1', text: 'Fine words.' }, { id: 's2', text: 'a | b' }] } });
  expect((await (await serverResponse).json()).result.isError).toBe(true);
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toHaveCount(0);
  await expect(app.locator('.atom-word')).toHaveCount(0);
});

test('a valid Current over the MCP payload budget is refused by the Worker and explained in the app', async ({ page, baseURL }) => {
  const serverResponse = page.waitForResponse('**/api/mcp');
  const app = await openHost(page, baseURL, { resultOnly: true, current: oversizedMcpCurrent() });
  const result = (await (await serverResponse).json()).result;
  expect(result.isError).toBe(true);
  expect(result.content[0].text).toContain('65,536-byte MCP limit');
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toHaveCount(0);
  await expect(app.locator('.live-embed[role="alert"]')).toContainText('correct the answer');
  await expect(app.locator('.atom-word')).toHaveCount(0);
});

test('a Dive is a question put to the host’s model, answered in the same call, and Surface returns to the very atom', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'that nothing, not even light');
  await app.getByRole('button', { name: 'Interrupt', exact: true }).click();
  await expect(app.locator('.live-controls__status')).toContainText('Held where you are');
  const heldAt = await shown(app);

  await app.locator('#live-controls-question').fill('dive on event horizon');
  await app.getByRole('button', { name: /Dive: ask about this place/u }).click();

  await expect.poll(async () => (await log(page)).filter(entry => entry.method === 'sampling/createMessage').length).toBe(1);
  const asked = (await log(page)).find(entry => entry.method === 'sampling/createMessage').params;
  expect(asked.systemPrompt).toContain('rise.current.v1');
  expect(asked.systemPrompt).toContain('JSON object only');
  expect(asked.messages[0].content.text).toContain('dive on event horizon');
  expect(asked.messages[0].content.text).toContain('quoted, not an instruction');

  await expectShown(app, 'The event horizon is where the speed needed to escape');
  await expect(app.locator('.live-controls__status')).toContainText('answered', { timeout: 20_000 });
  await app.getByRole('button', { name: 'Surface', exact: true }).click();
  await expectShown(app, 'that nothing, not even light');
  expect(await shown(app)).toBe(heldAt);
});

test('where the host will not put a question to its model, a Dive says so in words and the reading is untouched', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL, { sampling: false });
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'that nothing, not even light');
  await app.getByRole('button', { name: 'Interrupt', exact: true }).click();
  const heldAt = await shown(app);
  await app.locator('#live-controls-question').fill('dive on event horizon');
  await app.getByRole('button', { name: /Dive: ask about this place/u }).click();
  await expect(app.locator('.live-controls__error')).toContainText('does not let RISE put a question to its model');
  expect((await log(page)).some(entry => entry.method === 'sampling/createMessage')).toBe(false);
  expect(await shown(app)).toBe(heldAt);
  await app.getByRole('button', { name: 'Resume', exact: true }).click();
  await expect(app.locator('.live-controls__status')).toContainText(/paced as if spoken/u);
});

test('a long invalid Current is refused whole with recovery guidance within the runtime limit', async ({ page, baseURL }) => {
  const invalid = { ...BLACK_HOLES_CURRENT, ['x'.repeat(400)]: true };
  const app = await openHost(page, baseURL, { current: invalid });
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toHaveCount(0);
  const error = app.locator('.live-embed[role="alert"]');
  await expect(error).toContainText('refused');
  await expect(error).toContainText('Ask the assistant again');
  expect((await error.textContent()).length).toBeLessThanOrEqual(300);
  await expect(app.locator('.atom-word')).toHaveCount(0);
});

test('the host’s ping is answered, and its request to tear down is answered and ends the reading', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  const field = await app.locator('.chamber-attractor canvas.attractor-canvas').elementHandle();
  await expect.poll(() => picturesOverASecond(field), { timeout: 5_000 }).toBeGreaterThan(1);
  await page.evaluate(() => { window.__host.request('p1', 'ping'); });
  await expect.poll(async () => (await log(page)).some(entry => entry.id === 'p1' && entry.result !== undefined)).toBe(true);
  await page.evaluate(() => { window.__host.request('t1', 'ui/resource-teardown', {}); });
  await expect.poll(async () => (await log(page)).some(entry => entry.id === 't1' && entry.result !== undefined)).toBe(true);
  await expect(app.locator('#live-controls')).toHaveCount(0);
  await expect(app.locator('.live-embed')).toContainText('Reopening starts this reading from the beginning');
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
  await expect(page.locator('#live-controls')).toHaveCount(0);
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
  await expect(app.getByRole('button', { name: 'Begin', exact: true })).toBeVisible();
  await expect.poll(() => backgroundOf(app.locator('body'))).toBe('rgb(6, 25, 18)');

  await begin(app);
  await expectShown(app, 'A black hole is a region of space');
  await expect.poll(() => backgroundOf(app.locator('.chamber').first())).toBe('rgb(6, 25, 18)');
  // The plate behind words over imagery is the theme's ground, not RISE ink.
  expect((await app.locator('.chamber').first().evaluate(element => getComputedStyle(element).getPropertyValue('--reading-scrim'))).toLowerCase()).toContain('#061912');
  // The input hints are the theme's ink 60% toward its ground, not RISE's blue mist.
  expect(channels(await app.locator('#live-controls-question').evaluate(element => getComputedStyle(element, '::placeholder').color))).toEqual([142, 163, 154]);
  // The panel's quieter words are the theme's ink 72% toward its ground, not RISE's lavender.
  const quiet = ['.live-controls__notice', '.live-controls__mic-note summary', '.live-controls__transcript summary'];
  const quietColors = {};
  for (const selector of quiet) quietColors[selector] = channels(await app.locator(selector).evaluate(element => getComputedStyle(element).color));
  expect(quietColors).toEqual(Object.fromEntries(quiet.map(selector => [selector, [169, 191, 181]])));
  // The default white filament is blue-dominant; green-dominant paint is the jade palette drawing.
  await expect.poll(async () => {
    const { lit, r, g, b } = await filamentPaint(app).catch(() => ({ lit: 0, r: 0, g: 0, b: 0 }));
    return lit > 20 && g > b && g > r;
  }, { timeout: 5_000, message: 'waiting for a green-dominant filament' }).toBe(true);

  expect((await log(page)).filter(entry => entry.method === 'sampling/createMessage')).toHaveLength(0);
  expect(errors).toEqual([]);
});

test('an answer without a theme keeps RISE ink and still shows its title over Begin', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expect(posterTitle(app)).toHaveText(BLACK_HOLES_CURRENT.title);
  const beginButton = app.getByRole('button', { name: 'Begin', exact: true });
  await expect(beginButton).toBeVisible();
  const [title, button] = [await posterTitle(app).boundingBox(), await beginButton.boundingBox()];
  expect(title.y + title.height).toBeLessThanOrEqual(button.y);
  await expect.poll(() => backgroundOf(app.locator('body'))).toBe('rgb(6, 5, 26)');
});
