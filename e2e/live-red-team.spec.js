/**
 * Adversarial browser checks for the live layer (docs/plans/LIVE-RED-TEAM.md).
 *
 * Each test is an invariant that was attacked. The one named "risk:" proves an
 * accepted exposure rather than a defect. A defect found later is added with
 * `test.fail()`, which asserts what should be true and passes while it is not;
 * the fix removes the annotation.
 */
import { expect, test } from './fixtures.js';

// In production both pages of the framing test are public. Here the other page is answered by the test and
// RISE is on a loopback address, so Chromium's local-network check would stand in for a boundary that does not exist.
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--disable-features=LocalNetworkAccessChecks'] } });

/**
 * A page on another origin that frames `/live?embed=mcp` directly, with no relay, and plays an MCP
 * host: it claims sampling, hands over a Current, and answers a Dive with one that says a person
 * wrote it. Nothing about it is an MCP host; it is any site.
 */
function hostilePage(target, current, dive) {
    return `<!doctype html><meta charset="utf-8"><title>not a host</title>
<iframe id="app" src="${target}" allow="microphone; autoplay" style="border:0;width:100%;height:640px"></iframe>
<script>
const CURRENT = ${JSON.stringify(current)};
const DIVE = ${JSON.stringify(dive)};
window.__heard = [];
const app = document.getElementById('app');
const say = message => app.contentWindow.postMessage({ jsonrpc: '2.0', ...message }, '*');
window.addEventListener('message', event => {
  if (event.source !== app.contentWindow || event.data?.jsonrpc !== '2.0') return;
  const message = event.data;
  window.__heard.push({ method: message.method, origin: event.origin, params: message.params });
  if (message.method === 'ui/initialize') say({ id: message.id, result: { protocolVersion: '2026-01-26', hostInfo: { name: 'any site', version: '1' }, hostCapabilities: { sampling: {} }, hostContext: {} } });
  if (message.method === 'ui/notifications/initialized') {
    say({ method: 'ui/notifications/tool-input', params: { arguments: { current: CURRENT } } });
    say({ method: 'ui/notifications/tool-result', params: {
      content: [{ type: 'text', text: 'RISE accepted this Current for presentation to the reader.' }],
      structuredContent: { current: CURRENT }
    } });
  }
  if (message.method === 'sampling/createMessage') say({ id: message.id, result: { role: 'assistant', model: 'x', content: { type: 'text', text: JSON.stringify(DIVE) } } });
});
</script>`;
}

/** Frame RISE's embedded page from another origin and let it play. */
async function framedByAnySite(page, baseURL) {
    // The preview server listens on 127.0.0.1; the other page is answered by the test under another name.
    const rise = new URL(baseURL);
    rise.hostname = '127.0.0.1';
    const elsewhere = new URL(baseURL);
    elsewhere.hostname = 'localhost';
    const current = {
        schema: 'rise.current.v1', id: 'any', title: 'An answer',
        origin: { kind: 'human', name: 'The RISE editors' },
        segments: [{ id: 'one', text: 'These words were chosen by whichever page framed RISE.', visual: 'still' }]
    };
    const dive = {
        schema: 'rise.current.v1', id: 'any-dive', title: 'A reply',
        origin: { kind: 'human', name: 'Your teacher' },
        segments: [{ id: 'reply', text: 'A person did not write this.', visual: 'still' }]
    };
    await page.route(`${elsewhere.origin}/__any-site`, route => route.fulfill({
        contentType: 'text/html', body: hostilePage(`${rise.origin}/live?embed=mcp&voice=paced`, current, dive)
    }));
    await page.goto(`${elsewhere.origin}/__any-site`);
    const app = page.frameLocator('#app');
    // The embedded page holds a delivered Current until the reader presses Play (#368).
    await app.getByRole('button', { name: 'Play', exact: true }).click();
    await expect(app.locator('#atom-display')).toContainText('whichever page framed RISE', { timeout: 15_000 });
    return { app, rise, elsewhere };
}

test.describe('the embedded page under a parent it cannot identify', () => {
    test('risk: any origin can frame the page and act as its host, but it hears no question from the reader', async ({ page, baseURL }) => {
        const { app, rise, elsewhere } = await framedByAnySite(page, baseURL);
        expect(new URL(page.url()).origin).toBe(elsewhere.origin);
        // The stage has no question box at all, so even a parent that claims sampling is asked nothing.
        await expect(app.locator('#rise-stage-controls input[type="text"], #rise-stage-controls form')).toHaveCount(0);
        await app.getByRole('button', { name: 'Pause', exact: true }).click();
        await app.getByRole('button', { name: 'Play', exact: true }).click();
        const heard = await page.evaluate(() => window.__heard);
        expect(heard.some(entry => entry.origin === rise.origin && entry.method === 'ui/initialize')).toBe(true);
        expect(heard.some(entry => entry.method === 'sampling/createMessage')).toBe(false);
    });
});
