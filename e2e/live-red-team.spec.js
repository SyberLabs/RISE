/**
 * Adversarial browser checks for the live layer (docs/plans/LIVE-RED-TEAM.md).
 *
 * Each test is an invariant that was attacked. The one named "risk:" proves an
 * accepted exposure rather than a defect. A defect found later is added with
 * `test.fail()`, which asserts what should be true and passes while it is not;
 * the fix removes the annotation.
 */
import { scriptToLines } from '../src/test/fake-text-transport.js';
import { BLACK_HOLES } from '../src/live/fixtures/black-holes.js';
import { expect, test } from './fixtures.js';

// In production both pages of the framing test are public. Here the other page is answered by the test and
// RISE is on a loopback address, so Chromium's local-network check would stand in for a boundary that does not exist.
test.use({ launchOptions: { args: ['--autoplay-policy=no-user-gesture-required', '--disable-features=LocalNetworkAccessChecks'] } });

const KEY = 'sk-test-0123456789abcdefghijklmnopqrstuvwxyz';
const ANSWER_SDP = 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n';

/** A fake peer that counts what is opened, closed and asked, and streams the fixed answer. */
async function installCountingPeer(page) {
    await page.addInitScript(({ answer }) => {
        window.__rtc = { peers: 0, closed: 0, responses: 0 };
        class Channel extends EventTarget {
            constructor() { super(); this.readyState = 'connecting'; }
            emit(event) { this.dispatchEvent(new MessageEvent('message', { data: JSON.stringify(event) })); }
            send(text) {
                const event = JSON.parse(text);
                if (event.type !== 'response.create') return;
                window.__rtc.responses += 1;
                this.emit({ type: 'response.created', response: { id: 'r', status: 'in_progress' } });
                let at = 0;
                const step = () => {
                    if (this.readyState !== 'open') return;
                    if (at >= answer.length) { this.emit({ type: 'response.done', response: { id: 'r', status: 'completed' } }); return; }
                    this.emit({ type: 'response.output_text.delta', response_id: 'r', delta: answer.slice(at, at + 23) });
                    at += 23;
                    setTimeout(step, 10);
                };
                setTimeout(step, 10);
            }
            close() { this.readyState = 'closed'; this.dispatchEvent(new Event('close')); }
        }
        window.RTCPeerConnection = class {
            constructor() { this.iceGatheringState = 'complete'; this.connectionState = 'new'; window.__rtc.peers += 1; }
            createDataChannel() { this.channel = new Channel(); return this.channel; }
            addTransceiver() {}
            async createOffer() { return { type: 'offer', sdp: 'v=0\r\nm=audio 9 UDP/TLS/RTP/SAVPF 111\r\nm=application 9 UDP/DTLS/SCTP webrtc-datachannel\r\n' }; }
            async setLocalDescription(description) { this.localDescription = description; }
            async setRemoteDescription() { setTimeout(() => { this.channel.readyState = 'open'; this.channel.dispatchEvent(new Event('open')); }, 10); }
            addEventListener() {}
            removeEventListener() {}
            close() { if (this.connectionState !== 'closed') window.__rtc.closed += 1; this.connectionState = 'closed'; }
        };
    }, { answer: scriptToLines(BLACK_HOLES) });
}

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
    // The embedded page holds a delivered Current until the reader presses Begin (#368).
    await app.getByRole('button', { name: 'Begin', exact: true }).click();
    await expect(app.locator('#atom-display')).toContainText('whichever page framed RISE', { timeout: 15_000 });
    return { app, rise, elsewhere };
}

test.describe('the embedded page under a parent it cannot identify', () => {
    test('risk: any origin can frame the page and act as its host, but it hears no question from the reader', async ({ page, baseURL }) => {
        const { app, rise, elsewhere } = await framedByAnySite(page, baseURL);
        expect(new URL(page.url()).origin).toBe(elsewhere.origin);
        // A Composer presentation offers no Dive, so even a parent that claims sampling is asked nothing.
        await expect(app.locator('.live-controls__ask')).toBeAttached();
        await expect(app.locator('#live-controls-question')).toBeHidden();
        await app.getByRole('button', { name: 'Interrupt', exact: true }).click();
        await app.getByRole('button', { name: 'Resume', exact: true }).click();
        const heard = await page.evaluate(() => window.__heard);
        expect(heard.some(entry => entry.origin === rise.origin && entry.method === 'ui/initialize')).toBe(true);
        expect(heard.some(entry => entry.method === 'sampling/createMessage')).toBe(false);
    });
});

test.describe('the live runtime against a reader who stops while it connects', () => {
    test('Stop pressed while the OpenAI session is connecting: nothing is asked, nothing is shown, and the connection is closed', async ({ page }) => {
        await installCountingPeer(page);
        let answerRelay;
        const relayAsked = new Promise(resolve => {
            void page.route('**/api/live/realtime**', async route => {
                resolve();
                await new Promise(release => { answerRelay = release; });
                await route.fulfill({ status: 200, contentType: 'application/sdp', body: ANSWER_SDP });
            });
        });

        await page.goto('/live?provider=openai&voice=paced');
        await page.locator('#live-key').fill(KEY);
        await page.locator('.live-start').click();
        await relayAsked;
        await page.getByRole('button', { name: 'Stop', exact: true }).click();
        answerRelay();
        await page.waitForTimeout(3_000);

        const rtc = await page.evaluate(() => ({ ...window.__rtc }));
        const shown = (await page.locator('#atom-display').allInnerTexts()).join('');
        expect({ askedAfterStop: rtc.responses, shownAfterStop: shown.trim().length > 0, unclosedPeers: rtc.peers - rtc.closed })
            .toEqual({ askedAfterStop: 0, shownAfterStop: false, unclosedPeers: 0 });
    });
});
