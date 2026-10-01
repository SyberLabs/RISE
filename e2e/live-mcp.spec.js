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
function hostPage({ relay, current, sampling = true, dive, resultOnly = false, deferToolResult = false }) {
    const escaped = relay.replace(/&/gu, '&amp;').replace(/"/gu, '&quot;');
    return `<!doctype html><meta charset="utf-8"><title>fake host</title>
<style>html,body{margin:0;height:100%}iframe{border:0;width:100%;height:640px}</style>
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
  await page.route(`**${HOST}`, route => route.fulfill({ contentType: 'text/html', body: hostPage({ relay, current: options.current ?? BLACK_HOLES_CURRENT, sampling: options.sampling ?? true, resultOnly: options.resultOnly ?? false, deferToolResult: options.deferToolResult ?? false, dive: toSealedCurrent(HORIZON_DIVE, 'dive-answer') }) }));
  await page.goto(HOST);
  // The app is a page in a frame in the relay's frame.
  return page.frameLocator('#view').frameLocator('#app');
}

const log = page => page.evaluate(() => window.__host.log);
const shown = async app => (await app.locator('#atom-display').innerText()).replace(/\s+/gu, ' ').trim();
const expectShown = (app, phrase, timeout = 15_000) => expect.poll(() => shown(app).catch(() => ''), { timeout, message: `waiting to see “${phrase}”` }).toContain(phrase);

test('the input and matching worker result play once without restarting a held reading', async ({ page, baseURL }) => {
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const app = await openHost(page, baseURL, { deferToolResult: true });
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
  await expectShown(app, 'A black hole is a region of space');
  await expectShown(app, 'that nothing, not even light', 20_000);
});

test('reopening the nested frame reinitializes and plays the host result from its first passage', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expectShown(app, 'A black hole is a region of space');
  await expect(app.locator('#live-controls')).toContainText('Reopening starts this reading from the beginning');
  await expectShown(app, 'Its boundary is called the event horizon', 20_000);

  await app.locator('body').evaluate(body => body.ownerDocument.defaultView.location.reload());
  const reopened = page.frameLocator('#view').frameLocator('#app');
  await expectShown(reopened, 'A black hole is a region of space');
  await expect(reopened.locator('#live-controls')).toContainText('Reopening starts this reading from the beginning');
  await expect.poll(async () => (await log(page)).filter(entry => entry.method === 'ui/initialize').length).toBe(2);
  expect((await log(page)).filter(entry => entry.method === 'sampling/createMessage')).toHaveLength(0);
});

test('calmer lowers the held visual target and resumes the same atom without sampling', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
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

test('an invalid worker result has no playable Current', async ({ page, baseURL }) => {
  const serverResponse = page.waitForResponse('**/api/mcp');
  const app = await openHost(page, baseURL, { resultOnly: true, current: { ...BLACK_HOLES_CURRENT, segments: [{ id: 's1', text: 'Fine words.' }, { id: 's2', text: 'a | b' }] } });
  expect((await (await serverResponse).json()).result.isError).toBe(true);
  await expect(app.locator('.atom-word')).toHaveCount(0);
});

test('a Dive is a question put to the host’s model, answered in the same call, and Surface returns to the very atom', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
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

test('a Current that is not valid is refused whole, in words, and nothing of it is shown', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL, { current: { ...BLACK_HOLES_CURRENT, segments: [{ id: 's1', text: 'Fine words.' }, { id: 's2', text: 'a | b' }] } });
  await expect(app.locator('.live-controls__status')).toContainText('could not be answered', { timeout: 15_000 });
  await expect(app.locator('.live-controls__error')).toContainText('refused');
  await expect(app.locator('.live-controls__error')).toContainText('Ask the assistant again');
  await expect(app.locator('.atom-word')).toHaveCount(0);
});

test('the host’s ping is answered, and its request to tear down is answered and ends the reading', async ({ page, baseURL }) => {
  const app = await openHost(page, baseURL);
  await expectShown(app, 'A black hole is a region of space');
  await page.evaluate(() => { window.__host.request('p1', 'ping'); });
  await expect.poll(async () => (await log(page)).some(entry => entry.id === 'p1' && entry.result !== undefined)).toBe(true);
  await page.evaluate(() => { window.__host.request('t1', 'ui/resource-teardown', {}); });
  await expect.poll(async () => (await log(page)).some(entry => entry.id === 't1' && entry.result !== undefined)).toBe(true);
  await expect(app.locator('#live-controls')).toHaveCount(0);
  await expect(app.locator('.live-embed')).toContainText('Reopening starts this reading from the beginning');
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
