/**
 * RISE as an MCP server, spoken to as a host would.
 *
 * What is held: it is off unless switched on; it answers nothing from another
 * site's page, and only POST; it reads a bounded, well-formed JSON-RPC message
 * and answers it in the shapes MCP's clients expect (initialize, tools, the
 * app's resource); the tool refuses a Current that is not valid and tells the
 * model why; the app's document is served with the frame and the microphone it
 * needs and nothing more; and the one page that may be framed is framed only
 * when asked for and only while switched on.
 */
import { describe, expect, it, vi } from 'vitest';
import { BLACK_HOLES_CURRENT } from '../src/test/sealed-current.js';
import worker from './index.mjs';
import { APP_MIME, APP_URI, handleLive, handleMcp, MCP_PATH, PROTOCOL_VERSIONS, TOOL } from './mcp-server.mjs';

const SITE = 'https://rise.example';
const ON = { MCP_ENABLED: 'true' };

function post(body, { headers = {}, env = ON, url = `${SITE}${MCP_PATH}`, raw } = {}) {
  return handleMcp(new Request(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream', ...headers },
    body: raw ?? JSON.stringify(body)
  }), env);
}

const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, params });
const json = async response => JSON.parse(await response.text());

describe('when it is switched on', () => {
  it('is off unless MCP_ENABLED is exactly the text true, and says so', async () => {
    for (const env of [{}, null, { MCP_ENABLED: 'false' }, { MCP_ENABLED: '1' }, { MCP_ENABLED: 'TRUE' }, { MCP_ENABLED: true }]) {
      const response = await post(rpc('ping'), { env });
      expect(response.status, JSON.stringify(env)).toBe(503);
      expect((await json(response)).error.code).toBe('MCP_UNAVAILABLE');
    }
  });

  it('is reached at one path on the worker', async () => {
    const response = await worker.fetch(new Request(`${SITE}${MCP_PATH}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(rpc('ping'))
    }), ON);
    expect(response.status).toBe(200);
    expect(await json(response)).toEqual({ jsonrpc: '2.0', id: 1, result: {} });
    const off = await worker.fetch(new Request(`${SITE}${MCP_PATH}`, { method: 'POST', body: '{}' }), {});
    expect(off.status).toBe(503);
  });
});

describe('who may ask, and how', () => {
  it('takes a request with no Origin, as a host’s own server sends, and one from its own origin', async () => {
    expect((await post(rpc('ping'))).status).toBe(200);
    expect((await post(rpc('ping'), { headers: { Origin: SITE } })).status).toBe(200);
  });

  it('refuses a page on any other site, including near ones, so a browser cannot be made to talk to it', async () => {
    for (const origin of ['https://evil.example', 'http://rise.example', `${SITE}.evil.example`, 'null', 'https://rise.example:8443', '']) {
      const response = await post(rpc('ping'), { headers: { Origin: origin } });
      expect(response.status, origin).toBe(403);
      expect((await json(response)).error.code).toBe('ORIGIN_DENIED');
    }
  });

  it('takes only POST, and says which', async () => {
    for (const method of ['GET', 'DELETE', 'PUT', 'PATCH']) {
      const response = await handleMcp(new Request(`${SITE}${MCP_PATH}`, { method }), ON);
      expect(response.status, method).toBe(405);
      expect(response.headers.get('Allow')).toBe('POST');
    }
  });

  it('takes only JSON', async () => {
    for (const type of ['text/plain', 'application/x-www-form-urlencoded', 'multipart/form-data', '']) {
      const response = await handleMcp(new Request(`${SITE}${MCP_PATH}`, { method: 'POST', headers: type ? { 'Content-Type': type } : {}, body: '{}' }), ON);
      expect(response.status, type).toBe(415);
    }
    expect((await post(rpc('ping'), { headers: { 'Content-Type': 'Application/JSON; charset=utf-8' } })).status).toBe(200);
  });

  it('reads a bounded body, and says a bigger one is too large', async () => {
    const response = await post(null, { raw: JSON.stringify(rpc('tools/call', { name: 'rise_present', arguments: { current: { pad: 'x'.repeat(300_000) } } })) });
    expect(response.status).toBe(413);
  });

  it('says a body that is not JSON, or not UTF-8, is a parse error, and refuses a batch', async () => {
    for (const raw of ['{not json', '', 'undefined']) {
      const response = await post(null, { raw });
      expect((await json(response)).error).toMatchObject({ code: -32700, message: 'Parse error' });
    }
    const bytes = new Uint8Array([0x7b, 0xff, 0xfe, 0x7d]);
    const bad = await handleMcp(new Request(`${SITE}${MCP_PATH}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: bytes }), ON);
    expect((await json(bad)).error.code).toBe(-32700);
    const batch = await post([rpc('ping', undefined, 1), rpc('ping', undefined, 2)]);
    expect((await json(batch)).error).toMatchObject({ code: -32600 });
  });

  it('says a message that is not JSON-RPC is an invalid request, and an unknown method is not found', async () => {
    for (const body of [null, 5, 'text', {}, { jsonrpc: '1.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', id: {}, method: 'ping' }, { jsonrpc: '2.0', id: [], method: 'ping' }]) {
      const response = await post(null, { raw: JSON.stringify(body) });
      expect((await json(response)).error, JSON.stringify(body)).toMatchObject({ code: -32600 });
    }
    expect((await json(await post(rpc('prompts/list')))).error).toMatchObject({ code: -32601 });
    expect((await json(await post(rpc('constructor')))).error).toMatchObject({ code: -32601 });
    expect((await json(await post(rpc('__proto__')))).error).toMatchObject({ code: -32601 });
  });

  it('accepts notifications and a client’s own replies without answering them', async () => {
    for (const body of [{ jsonrpc: '2.0', method: 'notifications/initialized' }, { jsonrpc: '2.0', method: 'notifications/cancelled', params: { requestId: 1 } }, { jsonrpc: '2.0', id: 3, result: {} }]) {
      const response = await post(body);
      expect(response.status, JSON.stringify(body)).toBe(202);
      expect(await response.text()).toBe('');
    }
  });

  it('answers every request as JSON that is not cached, and never sniffed', async () => {
    const response = await post(rpc('ping'));
    expect(response.headers.get('Content-Type')).toMatch(/^application\/json/u);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
  });

  it('carries the request’s id back, a string or a number', async () => {
    for (const id of [7, 0, 'abc', '']) expect((await json(await post(rpc('ping', undefined, id)))).id).toBe(id);
  });
});

describe('saying hello', () => {
  it('answers with the version the client asked for when it knows it, and its newest when it does not', async () => {
    for (const version of PROTOCOL_VERSIONS) {
      expect((await json(await post(rpc('initialize', { protocolVersion: version })))).result.protocolVersion).toBe(version);
    }
    for (const version of ['1999-01-01', '', undefined, 5, null, {}]) {
      expect((await json(await post(rpc('initialize', { protocolVersion: version })))).result.protocolVersion, String(version)).toBe(PROTOCOL_VERSIONS[0]);
    }
    expect((await json(await post(rpc('initialize')))).result.protocolVersion).toBe(PROTOCOL_VERSIONS[0]);
  });

  it('says what it offers, and no more: tools and resources, not prompts, logging or completions', async () => {
    const { result } = await json(await post(rpc('initialize', { protocolVersion: '2025-11-25' })));
    expect(Object.keys(result.capabilities).sort()).toEqual(['resources', 'tools']);
    expect(result.serverInfo).toMatchObject({ name: 'rise' });
    expect(result.instructions).toContain('rise_present');
  });
});

describe('the tool', () => {
  it('is one tool, read-only, with a schema that asks for a Current and nothing else, and the guide to writing one', async () => {
    const { result } = await json(await post(rpc('tools/list')));
    expect(result.tools).toHaveLength(1);
    const [tool] = result.tools;
    expect(tool.name).toBe('rise_present');
    expect(tool.inputSchema).toEqual({ type: 'object', properties: { current: { type: 'object', description: expect.any(String) } }, required: ['current'], additionalProperties: false });
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    expect(tool.description).toContain('rise.current.v1');
    expect(tool.description).toContain('"segments"');
  });

  it('points at the app in the extension’s key and in its older spelling, and at one resource', async () => {
    expect(TOOL._meta).toEqual({ ui: { resourceUri: APP_URI }, 'ui/resourceUri': APP_URI });
    expect(APP_URI).toBe('ui://rise/current');
    expect(APP_MIME).toBe('text/html;profile=mcp-app');
  });

  it('takes a valid Current, and says it is being presented', async () => {
    const { result } = await json(await post(rpc('tools/call', { name: 'rise_present', arguments: { current: BLACK_HOLES_CURRENT } })));
    expect(result.isError).toBeUndefined();
    expect(result.structuredContent).toEqual({ current: BLACK_HOLES_CURRENT });
    expect(result.content[0].text).toContain('accepted');
  });

  it('refuses a valid Current whose serialized UTF-8 payload exceeds the MCP-only budget', async () => {
    const current = {
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
    const { result } = await json(await post(rpc('tools/call', { name: 'rise_present', arguments: { current } })));
    expect(result.isError).toBe(true);
    expect(result.structuredContent?.current).toBeUndefined();
    expect(result.content[0].text).toContain('65,536-byte MCP limit');
    expect(result.content[0].text).toContain('call rise_present again');
  });

  it('refuses one that is not valid, in words the model can act on, and does not send back what it was given', async () => {
    const hostile = { ...BLACK_HOLES_CURRENT, segments: [{ id: 's', text: 'a | b' }], onclick: '<script>alert(1)</script>' };
    for (const current of [hostile, { ...BLACK_HOLES_CURRENT, schema: 'other' }, { ...BLACK_HOLES_CURRENT, segments: [] }, { ...BLACK_HOLES_CURRENT, [`x${'y'.repeat(2_000)}`]: 1 }]) {
      const { result } = await json(await post(rpc('tools/call', { name: 'rise_present', arguments: { current } })));
      expect(result.isError).toBe(true);
      expect(result.structuredContent?.current).toBeUndefined();
      const text = result.content[0].text;
      expect(text).toMatch(/^RISE refused this Current: /u);
      expect(text).toContain('call rise_present again');
      expect(text).not.toContain('<script>');
      expect(text.length).toBeLessThan(500);
    }
  });

  it('says how to call it when it is called with nothing to present, and what is not a tool is not found', async () => {
    for (const args of [undefined, null, {}, [], 'text', { current: null }, { current: 'text' }, { curent: BLACK_HOLES_CURRENT }]) {
      const { result } = await json(await post(rpc('tools/call', { name: 'rise_present', arguments: args })));
      expect(result.isError, JSON.stringify(args)).toBe(true);
      expect(result.content[0].text).toContain('rise_present');
    }
    for (const name of ['other', '', 'constructor', undefined, 5]) {
      expect((await json(await post(rpc('tools/call', { name, arguments: {} })))).error, String(name)).toMatchObject({ code: -32602 });
    }
    expect((await json(await post(rpc('tools/call', undefined)))).error).toMatchObject({ code: -32602 });
  });

  it('keeps nothing between calls: the same call answers the same, in any order', async () => {
    const a = await (await post(rpc('tools/call', { name: 'rise_present', arguments: { current: BLACK_HOLES_CURRENT } }))).text();
    await post(rpc('tools/call', { name: 'rise_present', arguments: { current: { schema: 'x' } } }));
    expect(await (await post(rpc('tools/call', { name: 'rise_present', arguments: { current: BLACK_HOLES_CURRENT } }))).text()).toBe(a);
  });
});

describe('the app', () => {
  it('is listed as one resource with the extension’s type', async () => {
    const { result } = await json(await post(rpc('resources/list')));
    expect(result.resources).toEqual([expect.objectContaining({ uri: APP_URI, mimeType: APP_MIME })]);
  });

  it('is served as an HTML document that frames RISE’s own page at this origin, and asks the host for that frame and the microphone only', async () => {
    const { result } = await json(await post(rpc('resources/read', { uri: APP_URI })));
    expect(result.contents).toHaveLength(1);
    const [content] = result.contents;
    expect(content).toMatchObject({ uri: APP_URI, mimeType: APP_MIME });
    expect(content.text.startsWith('<!doctype html>')).toBe(true);
    expect(content.text).toContain(`src="${SITE}/live?embed=mcp"`);
    expect(content._meta.ui).toEqual({ csp: { frameDomains: [SITE], connectDomains: [], resourceDomains: [] }, permissions: { microphone: {} }, prefersBorder: false });
  });

  it('follows the origin it is asked at, so a staging site frames its own page', async () => {
    const { result } = await json(await post(rpc('resources/read', { uri: APP_URI }), { url: 'https://staging.rise.example/api/mcp' }));
    expect(result.contents[0].text).toContain('src="https://staging.rise.example/live?embed=mcp"');
    expect(result.contents[0]._meta.ui.csp.frameDomains).toEqual(['https://staging.rise.example']);
  });

  it('says a resource it does not have is not found, and does not echo more than a clipped address', async () => {
    for (const uri of ['ui://rise/other', 'file:///etc/passwd', '', undefined, 5, null, {}]) {
      const { error } = await json(await post(rpc('resources/read', { uri })));
      expect(error, String(uri)).toMatchObject({ code: -32002, message: 'Resource not found' });
    }
    const long = (await json(await post(rpc('resources/read', { uri: `ui://${'x'.repeat(5_000)}` })))).error.data.uri;
    expect(long.length).toBeLessThanOrEqual(200);
    expect((await json(await post(rpc('resources/read')))).error.code).toBe(-32002);
  });
});

describe('the one page that may be framed', () => {
  const page = (headers = {}) => new Response('<html></html>', {
    status: 200,
    headers: {
      'Content-Type': 'text/html',
      'X-Frame-Options': 'DENY',
      'Content-Security-Policy': "default-src 'self'; script-src 'self'; frame-ancestors 'none'",
      ...headers
    }
  });
  const ask = (path, { env = ON, method = 'GET', response = page() } = {}) => {
    const ASSETS = { fetch: vi.fn(async () => response) };
    return handleLive(new Request(`${SITE}${path}`, { method }), { ...env, ASSETS }).then(result => ({ result, ASSETS }));
  };

  it('may be framed by any site when it is asked for as the embedded page, and only then', async () => {
    const { result, ASSETS } = await ask('/live?embed=mcp');
    expect(ASSETS.fetch).toHaveBeenCalledTimes(1);
    expect(result.headers.get('X-Frame-Options')).toBeNull();
    expect(result.headers.get('Content-Security-Policy')).toBe("default-src 'self'; script-src 'self'; frame-ancestors *");
    expect(await result.text()).toBe('<html></html>');
  });

  it('keeps every header the site set, and changes nothing else about the response', async () => {
    const { result } = await ask('/live?embed=mcp', { response: page({ 'Permissions-Policy': 'microphone=(self)', 'X-Content-Type-Options': 'nosniff' }) });
    expect(result.headers.get('Permissions-Policy')).toBe('microphone=(self)');
    expect(result.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(result.headers.get('Content-Type')).toBe('text/html');
    expect(result.status).toBe(200);
  });

  it('is exactly the asset, framing headers included, when not asked for as the embedded page', async () => {
    for (const path of ['/live', '/live?embed=other', '/live?embed=', '/live?provider=openai', '/live?xembed=mcp', '/live?embed=MCP']) {
      const { result } = await ask(path);
      expect(result.headers.get('X-Frame-Options'), path).toBe('DENY');
      expect(result.headers.get('Content-Security-Policy'), path).toContain("frame-ancestors 'none'");
    }
  });

  it('is exactly the asset while it is switched off, even when asked for as the embedded page', async () => {
    for (const env of [{}, { MCP_ENABLED: 'false' }, { MCP_ENABLED: 'yes' }]) {
      const { result } = await ask('/live?embed=mcp', { env });
      expect(result.headers.get('X-Frame-Options'), JSON.stringify(env)).toBe('DENY');
      expect(result.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
    }
  });

  it('does not loosen a response for anything but a read of the page', async () => {
    for (const method of ['POST', 'PUT', 'DELETE']) {
      const { result } = await ask('/live?embed=mcp', { method });
      expect(result.headers.get('X-Frame-Options'), method).toBe('DENY');
    }
  });

  it('does not loosen an error: a page that was not found keeps its headers and its status', async () => {
    const { result } = await ask('/live?embed=mcp', { response: new Response('nope', { status: 404, headers: { 'X-Frame-Options': 'DENY' } }) });
    expect(result.status).toBe(404);
  });

  it('says it is unavailable, rather than failing, when there is nothing to serve the page from', async () => {
    const response = await handleLive(new Request(`${SITE}/live?embed=mcp`), ON);
    expect(response.status).toBe(503);
  });

  it('is reached at /live on the worker', async () => {
    const ASSETS = { fetch: vi.fn(async () => page()) };
    const response = await worker.fetch(new Request(`${SITE}/live?embed=mcp`), { ...ON, ASSETS });
    expect(response.headers.get('X-Frame-Options')).toBeNull();
  });
});
