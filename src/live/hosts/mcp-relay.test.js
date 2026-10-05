/**
 * The page an MCP host is given, and what its script does.
 *
 * The script is run here as the text a host would run, against fake windows.
 * What is held: it passes JSON-RPC and nothing else, each way, from the right
 * window only; it sends to the page at the page's origin and takes from the
 * page only at that origin; it cannot be made to run anything by an origin it
 * is given; and the document names its frame and its permissions.
 */
import { describe, expect, it } from 'vitest';
import { EMBED_PATH, isOrigin, relayHtml, relayScript } from './mcp-relay.js';

const ORIGIN = 'https://rise.example';

/** The script, run against a document with an iframe, a parent, and a child window. */
function run(origin = ORIGIN) {
    const handlers = [];
    const toHost = [];
    const toChild = [];
    const child = { postMessage: (data, target) => toChild.push({ data, target }) };
    const host = { postMessage: (data, target) => toHost.push({ data, target }) };
    const frame = { contentWindow: child };
    const win = {
        parent: host,
        addEventListener: (type, fn) => { if (type === 'message') handlers.push(fn); }
    };
    // eslint-disable-next-line no-new-func
    new Function('window', 'document', relayScript(origin))(win, { getElementById: id => (id === 'app' ? frame : null) });
    const deliver = event => handlers.forEach(fn => fn(event));
    return { toHost, toChild, child, host, deliver, handlers };
}

const rpc = { jsonrpc: '2.0', method: 'ui/notifications/tool-input', params: { arguments: {} } };

describe('what the relay passes', () => {
    it('passes what the host says to the page, at the page’s origin only, and what the page says to the host', () => {
        const { toHost, toChild, child, host, deliver } = run();
        deliver({ source: host, origin: 'https://host.example', data: rpc });
        expect(toChild).toEqual([{ data: rpc, target: ORIGIN }]);
        deliver({ source: child, origin: ORIGIN, data: { jsonrpc: '2.0', id: 1, method: 'ui/initialize', params: {} } });
        expect(toHost).toEqual([{ data: { jsonrpc: '2.0', id: 1, method: 'ui/initialize', params: {} }, target: '*' }]);
    });

    it('passes nothing that is not a JSON-RPC object, either way', () => {
        const { toHost, toChild, child, host, deliver } = run();
        for (const data of [null, undefined, 'text', 5, [], [rpc], {}, { jsonrpc: '1.0' }, { jsonrpc: 2 }, { method: 'x' }]) {
            deliver({ source: host, origin: 'https://host.example', data });
            deliver({ source: child, origin: ORIGIN, data });
        }
        expect(toChild).toEqual([]);
        expect(toHost).toEqual([]);
    });

    it('takes from the page only at the page’s own origin, so another document in the frame cannot speak for it', () => {
        const { toHost, child, deliver } = run();
        deliver({ source: child, origin: 'https://evil.example', data: rpc });
        deliver({ source: child, origin: 'null', data: rpc });
        deliver({ source: child, origin: `${ORIGIN}.evil.example`, data: rpc });
        expect(toHost).toEqual([]);
    });

    it('passes nothing from any other window: not a sibling, not a window that opened it', () => {
        const { toHost, toChild, deliver } = run();
        deliver({ source: { other: 'window' }, origin: ORIGIN, data: rpc });
        deliver({ source: null, origin: ORIGIN, data: rpc });
        expect(toHost).toEqual([]);
        expect(toChild).toEqual([]);
    });

    it('does not answer, add to, or change what it passes', () => {
        const { toChild, host, deliver } = run();
        const message = { jsonrpc: '2.0', id: 4, method: 'ping' };
        deliver({ source: host, origin: 'https://host.example', data: message });
        expect(toChild[0].data).toBe(message);
    });
});

describe('an origin it is given', () => {
    it('is put in the script as a string and cannot end it: a closing tag or a quote does nothing', () => {
        const script = relayScript('https://x.example</script><script>alert(1)</script>');
        expect(script).not.toContain('</script>');
        const { toChild, host, deliver } = run('https://a.example"; alert(1); "');
        deliver({ source: host, origin: 'h', data: rpc });
        expect(toChild[0].target).toBe('https://a.example"; alert(1); "');
    });

    it('is refused by the page unless it is nothing but an origin', () => {
        for (const bad of ['', 'rise.example', 'https://rise.example/', 'https://rise.example/live', 'https://rise.example?x=1', 'javascript:alert(1)', 'ftp://rise.example', 'https://a.example"><script>', null, undefined, 5]) {
            expect(isOrigin(bad), String(bad)).toBe(false);
            expect(() => relayHtml({ origin: bad })).toThrow('nothing but an origin');
        }
        for (const good of ['https://rise.example', 'http://127.0.0.1:4317', 'https://rise.syberlabs.io']) expect(isOrigin(good), good).toBe(true);
    });

    it('takes only a plain path to frame', () => {
        for (const bad of ['live', '//evil.example', '/live"><script>', '/live onload=x', '/a b']) expect(() => relayHtml({ origin: ORIGIN, path: bad }), bad).toThrow('plain path');
    });
});

describe('the document', () => {
    it('frames RISE’s own embedded page, names it, lets it play sound, and asks for no microphone and no full screen', () => {
        const html = relayHtml({ origin: ORIGIN });
        expect(html).toContain(`<iframe id="app" title="RISE" src="${ORIGIN}${EMBED_PATH}" allow="autoplay"></iframe>`);
        expect(html).not.toContain('fullscreen');
        expect(html).not.toContain('microphone');
        expect(html.startsWith('<!doctype html>')).toBe(true);
        expect(html).toContain('lang="en"');
        expect(html).toContain(`<script>${relayScript(ORIGIN)}</script>`);
    });

    it('loads nothing else: no other script, image, style sheet or frame', () => {
        const html = relayHtml({ origin: ORIGIN });
        expect(html.match(/<script/gu)).toHaveLength(1);
        expect(html.match(/<iframe/gu)).toHaveLength(1);
        expect(html).not.toMatch(/<link|<img|src="(?!https:\/\/rise\.example)|@import|url\(/u);
    });

    it('is small', () => {
        expect(relayHtml({ origin: ORIGIN }).length).toBeLessThan(2_000);
    });
});
