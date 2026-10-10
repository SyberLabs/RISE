/**
 * RISE as an MCP server, spoken to as a host would.
 *
 * What is held: it is off unless switched on; it answers nothing from another
 * site's page, and only POST; it reads a bounded, well-formed JSON-RPC message
 * and answers it in the shapes MCP's clients expect (initialize, tools, the
 * app's resource); the tool refuses a Current that is not valid and tells the
 * model why; the app's document is served with the frame it needs and nothing
 * more; and the one page that may be framed is framed only when asked for and
 * only while switched on.
 */
import { describe, expect, it, vi } from 'vitest';
import { RISE_CURRENT_LIMITS, RISE_CURRENT_LOOKS, RISE_CURRENT_SCHEMA, RISE_CURRENT_STYLES, RISE_CURRENT_THEME_IDS, RISE_CURRENT_VISUALS, validateRiseCurrent } from '../src/core/rise-current.js';
import { BLACK_HOLES_CURRENT } from '../src/test/sealed-current.js';
import { CURRENT_EXAMPLE, CURRENT_EXAMPLE_V2, CURRENT_GUIDE, STYLE_LINES, styleGuide } from '../src/live/guide/index.js';
import { BEAT_CUE_PATTERN, BEAT_LIMITS, SCENE_ENGINES } from '../src/core/beats.js';
import { FOREST_AFTER_FIRE, WEATHER_CHAOS } from '../src/live/fixtures/explanations.js';
import worker from './index.mjs';
import { admitSvg } from '../src/core/svg-admission.js';
import { describeDiagnostic } from './scene-admission.mjs';
import { DISPLAY_MODES } from '../src/live/hosts/mcp-port.js';
import { APP_MIME, APP_URI, currentJsonSchema, currentJsonSchemaV2, GUIDE_TOOL, handleLive, handleMcp, MCP_PATH, PROTOCOL_VERSIONS, TOOL } from './mcp-server.mjs';

const SITE = 'https://rise.example';
/** The most the tool's description may say, in characters. */
const DESCRIPTION_BUDGET = 2_000;
/** The most tools/list may weigh, in bytes: the description, both Current schemas and the guide tool. */
const TOOLS_LIST_BUDGET = 12_000;
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
    expect(response.headers.get('Strict-Transport-Security')).toBe('max-age=31536000; includeSubDomains');
  });

  it('carries the request’s id back, a string or a number', async () => {
    for (const id of [7, 0, 'abc', '']) expect((await json(await post(rpc('ping', undefined, id)))).id).toBe(id);
  });

  it('takes a request in any well-formed protocol version, newer ones included, and refuses a malformed one before reading the body', async () => {
    for (const version of [...PROTOCOL_VERSIONS, '2026-07-28', '1999-01-01']) expect((await post(rpc('ping'), { headers: { 'MCP-Protocol-Version': version } })).status, version).toBe(200);
    for (const version of ['latest', '', '2026-7-28', '2026-07-28; charset=x']) {
      const response = await post(null, { raw: '{not json', headers: { 'MCP-Protocol-Version': version } });
      expect(response.status, version).toBe(400);
      expect(await json(response)).toEqual({ error: { code: 'UNSUPPORTED_PROTOCOL_VERSION', message: expect.any(String) } });
    }
  });

  it('is limited per client address through the limiter live answers use, and is as it was without one', async () => {
    const headers = { 'CF-Connecting-IP': '192.0.2.1' };
    const denied = { ...ON, DECISION_LIMITER: { limit: async () => ({ success: false }) } };
    const limit = vi.fn(async () => ({ success: true }));
    expect((await post(rpc('ping'), { headers, env: { ...ON, DECISION_LIMITER: { limit } } })).status).toBe(200);
    expect(limit).toHaveBeenCalledWith({ key: 'mcp:192.0.2.1' });
    expect((await post(rpc('ping'), { headers, env: denied })).status).toBe(429);
    // No binding (tests, a local run), no address, or a limiter that fails: the route is unchanged.
    expect((await post(rpc('ping'), { headers })).status).toBe(200);
    expect((await post(rpc('ping'), { env: denied })).status).toBe(200);
    expect((await post(rpc('ping'), { headers, env: { ...ON, DECISION_LIMITER: { limit: async () => { throw new Error('down'); } } } })).status).toBe(200);
  });

  it('never limits Anthropic’s published egress (160.79.104.0/21), which every Claude user shares, and limits the addresses beside it', async () => {
    const limit = vi.fn(async () => ({ success: false }));
    const env = { ...ON, DECISION_LIMITER: { limit } };
    for (const ip of ['160.79.104.0', '160.79.104.10', '160.79.106.77', '160.79.111.255']) {
      expect((await post(rpc('ping'), { headers: { 'CF-Connecting-IP': ip }, env })).status, ip).toBe(200);
    }
    expect(limit).not.toHaveBeenCalled();
    for (const ip of ['160.79.103.255', '160.79.112.0', '160.78.104.1', '192.0.2.1', '160.79.104', '160.79.104.300', '160.079.104.1', '2001:db8::1', '::ffff:160.79.104.1']) {
      expect((await post(rpc('ping'), { headers: { 'CF-Connecting-IP': ip }, env })).status, ip).toBe(429);
    }
  });

  it('answers a tripped limit as a JSON-RPC error a client can parse, with the request’s id, and reads a bounded body first', async () => {
    const env = { ...ON, DECISION_LIMITER: { limit: async () => ({ success: false }) } };
    const headers = { 'CF-Connecting-IP': '192.0.2.1' };
    const limited = await post(rpc('tools/list', undefined, 'list-7'), { headers, env });
    expect(limited.status).toBe(429);
    expect(limited.headers.get('Retry-After')).toBe('60');
    expect(limited.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(await json(limited)).toEqual({
      jsonrpc: '2.0', id: 'list-7',
      error: { code: -32000, message: expect.stringMatching(/too many requests.*from this address.*a minute/iu), data: { code: 'RATE_LIMITED', retryAfterSeconds: 60 } }
    });
    // A notification has no id to carry back; the error still parses.
    expect(await json(await post({ jsonrpc: '2.0', method: 'notifications/initialized' }, { headers, env }))).toMatchObject({ jsonrpc: '2.0', id: null, error: { code: -32000 } });
    // The size cap still comes before any parsing.
    expect((await post(null, { raw: 'x'.repeat(262_145), headers, env })).status).toBe(413);
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
    expect(result.instructions).toContain('rise_guide');
  });
});

describe('the guide tool', () => {
  const callGuide = async args => (await json(await post(rpc('tools/call', { name: 'rise_guide', arguments: args })))).result;

  it('is listed after rise_present: read-only, no sign-in, one sentence, a style from the enum, and no app', async () => {
    const { result } = await json(await post(rpc('tools/list')));
    expect(result.tools.map(tool => tool.name)).toEqual(['rise_present', 'rise_guide']);
    const guide = result.tools[1];
    expect(guide).toEqual(GUIDE_TOOL);
    expect(guide.description).toBe('Read how to write a RISE Current in a named style, with worked examples, before calling rise_present in that style.');
    expect(guide.inputSchema).toEqual({
      type: 'object', properties: { style: { type: 'string', enum: [...RISE_CURRENT_STYLES] } }, required: ['style'], additionalProperties: false
    });
    expect(guide.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    expect(guide.securitySchemes).toEqual([{ type: 'noauth' }]);
    expect(guide._meta).toBeUndefined();
  });

  it('gives each style’s full guidance as one text block, the same text as the resource', async () => {
    for (const id of RISE_CURRENT_STYLES) {
      const result = await callGuide({ style: id });
      expect(result.isError).toBeUndefined();
      const { result: read } = await json(await post(rpc('resources/read', { uri: `ui://rise/guide/${id}` })));
      expect(result.content).toEqual([{ type: 'text', text: read.contents[0].text }]);
      expect(result.content[0].text).toBe(styleGuide(id));
    }
  });

  it('refuses a style RISE does not have, or anything beside the style, and names the styles', async () => {
    for (const args of [{ style: 'baroque' }, { style: 'constructor' }, { style: 5 }, {}, { style: 'open-field', theme: 'jade' }, undefined, []]) {
      const result = await callGuide(args);
      expect(result.isError, JSON.stringify(args)).toBe(true);
      expect(result.content[0].text).toContain(RISE_CURRENT_STYLES.join(', '));
      expect(result.content[0].text).not.toContain('baroque');
    }
  });
});

describe('the tool', () => {
  it('is one tool to present, read-only, callable with no sign-in, with the guide to writing a Current', async () => {
    const { result } = await json(await post(rpc('tools/list')));
    expect(result.tools.filter(tool => tool.name === 'rise_present')).toHaveLength(1);
    const [tool] = result.tools;
    expect(tool.name).toBe('rise_present');
    expect(tool.annotations).toMatchObject({ readOnlyHint: true, destructiveHint: false, openWorldHint: false });
    expect(tool.securitySchemes).toEqual([{ type: 'noauth' }]);
    expect(tool.description).toContain('rise.current.v1');
    expect(tool.description).toContain('"segments"');
  });

  it('says when to use it and when not, in words that match what the embed does, and ends with the guide', async () => {
    const { result } = await json(await post(rpc('tools/list')));
    const [tool] = result.tools;
    expect(tool.title).toBe('Present a reading in RISE');
    expect(tool.description.startsWith('Use this when ')).toBe(true);
    expect(tool.description).toMatch(/presses Play/u);
    expect(tool.description).toMatch(/pause and resume/u);
    expect(tool.description).toMatch(/once per answer/u);
    expect(tool.description).toMatch(/Do not use it for/u);
    // The embed takes no question, so the description promises none.
    expect(tool.description).not.toMatch(/ask about/u);
  });

  it('shows a plain Current whole, the example the validator accepts, and leaves the rest of the guide to rise_guide', async () => {
    const { result } = await json(await post(rpc('tools/list')));
    const [tool] = result.tools;
    expect(tool.description).toContain(JSON.stringify(CURRENT_EXAMPLE));
    expect(tool.description).not.toContain(CURRENT_GUIDE);
    expect(tool.description).toMatch(/no markdown/u);
  });

  it('ends with one line per style, and says the guide tool gives each style’s full guidance', async () => {
    const { result } = await json(await post(rpc('tools/list')));
    const [tool] = result.tools;
    expect(tool.description.endsWith(STYLE_LINES.join('\n'))).toBe(true);
    expect(tool.description).toContain('call rise_guide with {"style": "<style>"}');
    expect(tool.description).not.toContain('ui://rise/guide');
    for (const id of RISE_CURRENT_STYLES) expect(tool.description).toContain(`- ${id}: `);
  });

  it('keeps the description and the whole listing within their budgets: the guide and the worked examples are rise_guide’s', async () => {
    // A host reads every tool's description and schema on every turn: about 500 tokens of description, 3k for the listing.
    expect(TOOL.description.length).toBeLessThanOrEqual(DESCRIPTION_BUDGET);
    for (const id of RISE_CURRENT_STYLES) expect(TOOL.description).not.toContain(styleGuide(id));
    const listing = await (await post(rpc('tools/list'))).text();
    expect(new TextEncoder().encode(listing).length).toBeLessThanOrEqual(TOOLS_LIST_BUDGET);
  });

  it('steers nothing beyond presenting a reading, and promotes nothing', async () => {
    const { result } = await json(await post(rpc('tools/list')));
    const { result: hello } = await json(await post(rpc('initialize', { protocolVersion: '2025-06-18' })));
    for (const text of [...result.tools.map(tool => tool.description), hello.instructions]) {
      expect(text).not.toMatch(/\bcite\b|\bsources?\b|\bPlus\b|SyberLabs|subscri|upgrade|ElevenLabs/iu);
    }
  });

  it('points at the app in the extension’s key and in its older spelling, and gives the host short words for while it runs and once it is done', async () => {
    expect(TOOL._meta).toEqual({
      ui: { resourceUri: APP_URI },
      'ui/resourceUri': APP_URI,
      'openai/toolInvocation/invoking': 'Preparing the reading',
      'openai/toolInvocation/invoked': 'The reading is ready to play'
    });
    for (const key of ['openai/toolInvocation/invoking', 'openai/toolInvocation/invoked']) expect(TOOL._meta[key].length, key).toBeLessThanOrEqual(64);
    expect(APP_URI).toBe('ui://rise/current');
    expect(APP_MIME).toBe('text/html;profile=mcp-app');
  });

  it('takes a valid Current, gives the app the Current, and gives the model a one-line receipt, not the Current again', async () => {
    const { result } = await json(await post(rpc('tools/call', { name: 'rise_present', arguments: { current: BLACK_HOLES_CURRENT } })));
    expect(result.isError).toBeUndefined();
    // The card admits the Current from structuredContent (src/live/hosts/mcp-port.js currentFrom).
    expect(result.structuredContent).toEqual({ current: BLACK_HOLES_CURRENT });
    expect(result.content).toHaveLength(1);
    const [{ type, text }] = result.content;
    expect(type).toBe('text');
    expect(text).toMatch(new RegExp(`^RISE is presenting "${BLACK_HOLES_CURRENT.title}" \\(id "${BLACK_HOLES_CURRENT.id}"\\) to the reader: ${BLACK_HOLES_CURRENT.segments.length} passages?, about \\d+ (seconds|minutes)\\. The reader starts it with Play\\.$`, 'u'));
    expect(text).not.toContain(BLACK_HOLES_CURRENT.segments[0].text);
  });

  it('estimates a beat Current’s length from its spoken words and its holds', async () => {
    // 27 spoken words at 150 a minute (10.8 s) and 4.5 s of holds.
    const { result } = await json(await post(rpc('tools/call', { name: 'rise_present', arguments: { current: CURRENT_EXAMPLE_V2 } })));
    expect(result.content).toEqual([{ type: 'text', text: 'RISE is presenting "How long is a vector?" (id "vector-length") to the reader: 5 beats, about 15 seconds. The reader starts it with Play.' }]);
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

  it('refuses an argument beside the Current, says a theme goes inside it, and echoes only a clipped name', async () => {
    const call = async args => (await json(await post(rpc('tools/call', { name: 'rise_present', arguments: args })))).result;
    const misplaced = await call({ current: BLACK_HOLES_CURRENT, theme: 'jade' });
    expect(misplaced.isError).toBe(true);
    expect(misplaced.structuredContent).toBeUndefined();
    expect(misplaced.content[0].text).toBe('RISE refused these arguments: "theme" belongs inside the Current, not beside it. Call rise_present with {"current": <a Current>} only.');
    const unknown = await call({ current: BLACK_HOLES_CURRENT, [`mood\u0000\n${'x'.repeat(2_000)}`]: 'calm' });
    expect(unknown.isError).toBe(true);
    expect(unknown.structuredContent).toBeUndefined();
    expect(unknown.content[0].text).toBe(`RISE refused these arguments: unknown argument "mood${'x'.repeat(35)}…". Call rise_present with {"current": <a Current>} only.`);
    for (const current of [BLACK_HOLES_CURRENT, { ...BLACK_HOLES_CURRENT, theme: 'jade' }]) {
      const accepted = await call({ current });
      expect(accepted.isError).toBeUndefined();
      expect(accepted.structuredContent).toEqual({ current });
    }
  });

  describe('a generated scene, admitted by its parse (CC-006)', () => {
    const GOOD_SCENE = 'export default function scene(rise) {\n  return { frame(t) { rise.lib.clear(); } };\n}\n';
    const withScene = (code, id = 'vector') => {
      const current = structuredClone(CURRENT_EXAMPLE_V2);
      current.scenes.push({ id, code });
      return current;
    };
    const present = async current => (await json(await post(rpc('tools/call', { name: 'rise_present', arguments: { current } })))).result;

    it('takes a Current whose scene parses and keeps to the rules', async () => {
      const current = withScene(GOOD_SCENE);
      const result = await present(current);
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual({ current });
    });

    it('refuses the whole call for one bad scene, one line per problem with the scene named, then how to go on', async () => {
      const result = await present(withScene("export default function scene(rise) {\n  fetch('https://evil.example');\n  debugger;\n  return { frame() {} };\n}\n"));
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      expect(result.content[0].text.split('\n')).toEqual([
        'Scene "vector" was refused: line 2, column 3: `fetch` is not available to a scene, and the name is refused even as a local name.',
        'Scene "vector" was refused: line 3, column 3: `debugger` is not available to a scene.',
        'Repair the scene’s code and call rise_present again with the whole Current.'
      ]);
    });

    it('names each refused scene, and says a missing default export without a line', async () => {
      // The validator's shape check sees "export default" in the comment; only the parse sees there is none.
      const current = withScene('// export default\nexport const x = 1;', 'first');
      current.scenes.push({ id: 'second', code: 'import x from "y";\nexport default () => ({ frame() {} });' });
      const lines = (await present(current)).content[0].text.split('\n');
      expect(lines[0]).toBe('Scene "first" was refused: a scene is an ES module with one default export function, export default function scene(rise) { return { frame(t, dt) {} }; }.');
      expect(lines[1]).toMatch(/^Scene "second" was refused: line 1, column 1: a scene imports nothing/u);
      expect(lines).toHaveLength(3);
    });

    it('clips what the parse echoes from the code, and strips control characters from it', async () => {
      const name = `a${'b'.repeat(2_000)}`;
      const text = (await present(withScene(`let ${name};\nlet ${name};\nexport default () => ({ frame() {} });`))).content[0].text;
      const [line] = text.split('\n');
      expect(line.startsWith('Scene "vector" was refused: line 2, column 5: the code does not parse as a module: Identifier')).toBe(true);
      expect(line.length).toBeLessThanOrEqual(300);
      expect(text).not.toMatch(/[\u0000-\u0009\u000B-\u001F\u007F]/u);
    });

    it('refuses an oversize scene before reading it, as the validator does', async () => {
      const result = await present(withScene(`export default () => ({ frame() {} });\n//${'x'.repeat(30_000)}`));
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/^RISE refused this Current: /u);
    });
  });

  describe('a figure, admitted by its tokenizer (CC-009)', () => {
    const FIGURE = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3">\n  <path d="M0,3 L4,3 L4,0 z" fill="currentColor"/>\n</svg>';
    const withFigure = (svg, id = 'triangle') => {
      const current = structuredClone(CURRENT_EXAMPLE_V2);
      current.scenes.push({ id, svg });
      return current;
    };
    const present = async current => (await json(await post(rpc('tools/call', { name: 'rise_present', arguments: { current } })))).result;

    it('takes a Current whose figure is admitted', async () => {
      const current = withFigure(FIGURE);
      const result = await present(current);
      expect(result.isError).toBeUndefined();
      expect(result.structuredContent).toEqual({ current });
    });

    it('refuses the whole call for a figure with a script, with the line and column the card would refuse it by', async () => {
      const svg = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 4 3">\n  <script>alert(1)</script>\n</svg>';
      const result = await present(withFigure(svg));
      expect(result.isError).toBe(true);
      expect(result.structuredContent).toBeUndefined();
      const [diagnostic] = admitSvg(svg).diagnostics;
      expect(result.content[0].text.split('\n')).toEqual([
        `Scene "triangle" was refused: ${describeDiagnostic(diagnostic)}`,
        'Repair the figure and call rise_present again with the whole Current.'
      ]);
      expect(result.content[0].text).toContain('Scene "triangle" was refused: line 2, column 3: <script> is not an element a figure may use.');
    });

    it('refuses a figure over its size as the validator does, before reading it', async () => {
      const result = await present(withFigure(`<svg>${'x'.repeat(40_000)}</svg>`));
      expect(result.isError).toBe(true);
      expect(result.content[0].text).toMatch(/^RISE refused this Current: A figure is an SVG document/u);
    });
  });

  it('keeps nothing between calls: the same call answers the same, in any order', async () => {
    const a = await (await post(rpc('tools/call', { name: 'rise_present', arguments: { current: BLACK_HOLES_CURRENT } }))).text();
    await post(rpc('tools/call', { name: 'rise_present', arguments: { current: { schema: 'x' } } }));
    expect(await (await post(rpc('tools/call', { name: 'rise_present', arguments: { current: BLACK_HOLES_CURRENT } }))).text()).toBe(a);
  });
});

describe('the shape of a Current, as the host’s model is told it', () => {
  /** Enough of JSON Schema for the keywords the Current’s schema uses: the problems found, in words. */
  function conforms(schema, value, path = '$') {
    const problems = [];
    if (schema.oneOf) {
      const matching = schema.oneOf.filter(branch => conforms(branch, value, path).length === 0).length;
      if (matching !== 1) problems.push(`${path}: matches ${matching} of oneOf, not exactly one`);
    }
    const type = Array.isArray(value) ? 'array' : value === null ? 'null' : typeof value;
    if ('const' in schema && value !== schema.const) problems.push(`${path}: not ${schema.const}`);
    if (schema.enum && !schema.enum.includes(value)) problems.push(`${path}: not one of ${schema.enum.join(', ')}`);
    if (schema.type && !(schema.type === 'integer' ? Number.isInteger(value) : type === schema.type)) problems.push(`${path}: not ${schema.type}`);
    if (type === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) problems.push(`${path}: too short`);
      if (schema.maxLength !== undefined && value.length > schema.maxLength) problems.push(`${path}: too long`);
    }
    if (type === 'number' && schema.minimum !== undefined && value < schema.minimum) problems.push(`${path}: below ${schema.minimum}`);
    if (type === 'array') {
      if (schema.minItems !== undefined && value.length < schema.minItems) problems.push(`${path}: too few`);
      if (schema.maxItems !== undefined && value.length > schema.maxItems) problems.push(`${path}: too many`);
      if (schema.items) value.forEach((item, index) => problems.push(...conforms(schema.items, item, `${path}[${index}]`)));
    }
    if (type === 'object') {
      for (const key of schema.required ?? []) if (!(key in value)) problems.push(`${path}.${key}: missing`);
      for (const [key, item] of Object.entries(value)) {
        const property = schema.properties?.[key];
        if (property) problems.push(...conforms(property, item, `${path}.${key}`));
        else if (schema.additionalProperties === false) problems.push(`${path}.${key}: not allowed`);
      }
    }
    return problems;
  }

  const schema = currentJsonSchema();

  it('takes every limit and catalog from the validator’s own constants', () => {
    expect(schema.properties.schema.const).toBe(RISE_CURRENT_SCHEMA);
    expect(schema.properties.theme.enum).toBe(RISE_CURRENT_THEME_IDS);
    expect(schema.properties.id.maxLength).toBe(RISE_CURRENT_LIMITS.id);
    expect(schema.properties.title.maxLength).toBe(RISE_CURRENT_LIMITS.title);
    expect(schema.properties.origin.properties.name.maxLength).toBe(RISE_CURRENT_LIMITS.name);
    expect(schema.properties.origin.properties.provider.maxLength).toBe(RISE_CURRENT_LIMITS.name);
    expect(schema.properties.segments.maxItems).toBe(RISE_CURRENT_LIMITS.segments);
    const segment = schema.properties.segments.items;
    expect(segment.properties.id.maxLength).toBe(RISE_CURRENT_LIMITS.id);
    expect(segment.properties.text.maxLength).toBe(RISE_CURRENT_LIMITS.segmentText);
    expect(segment.properties.visual.enum).toBe(RISE_CURRENT_VISUALS);
    expect(segment.properties.dives.maxItems).toBe(RISE_CURRENT_LIMITS.dives);
    const dive = segment.properties.dives.items;
    expect(dive.properties.id.maxLength).toBe(RISE_CURRENT_LIMITS.id);
    expect(dive.properties.text.maxLength).toBe(RISE_CURRENT_LIMITS.diveText);
  });

  it('requires what the validator requires, and allows no field it does not know', () => {
    expect(schema).toMatchObject({ type: 'object', required: ['schema', 'id', 'title', 'origin', 'segments'], additionalProperties: false });
    expect(Object.keys(schema.properties)).toEqual(['schema', 'id', 'title', 'theme', 'look', 'origin', 'segments']);
    expect(schema.properties.look).toEqual({ type: 'string', enum: [...RISE_CURRENT_LOOKS] });
    expect(schema.properties.origin).toMatchObject({ required: ['kind', 'name'], additionalProperties: false });
    expect(Object.keys(schema.properties.origin.properties)).toEqual(['kind', 'name', 'provider']);
    expect(schema.properties.segments.minItems).toBe(1);
    const segment = schema.properties.segments.items;
    expect(segment).toMatchObject({ required: ['id', 'text'], additionalProperties: false });
    expect(Object.keys(segment.properties)).toEqual(['id', 'text', 'visual', 'dives', 'literal']);
    const dive = segment.properties.dives.items;
    expect(dive).toMatchObject({ required: ['id', 'text', 'anchor'], additionalProperties: false });
    expect(Object.keys(dive.properties)).toEqual(['id', 'text', 'anchor']);
    expect(dive.properties.anchor).toMatchObject({ required: ['fromCharacter', 'toCharacter', 'quoteStart', 'quoteEnd'], additionalProperties: false });
  });

  it('accepts every Current the validator accepts: the fixtures, and the choices they leave out', () => {
    const { theme, ...unthemed } = FOREST_AFTER_FIRE;
    const human = { ...WEATHER_CHAOS, origin: { kind: 'human', name: 'A reader' } };
    const literal = { ...CURRENT_EXAMPLE, segments: [{ id: 'plain', text: 'Plain words.', literal: true }] };
    for (const current of [BLACK_HOLES_CURRENT, CURRENT_EXAMPLE, FOREST_AFTER_FIRE, WEATHER_CHAOS, unthemed, human, literal]) {
      expect(() => validateRiseCurrent(structuredClone(current)), current.id).not.toThrow();
      expect(conforms(schema, current), current.id).toEqual([]);
    }
  });

  it('describes a cue with the validator’s own pattern, so a set: cue the guide teaches is in the schema', () => {
    const { pattern } = currentJsonSchemaV2().properties.beats.items.properties.cue;
    expect(pattern).toBe(BEAT_CUE_PATTERN);
    const schemaCue = new RegExp(pattern, 'u');
    for (const cue of ['set:intensity=0.6', 'calm', 'draw_2', 'turn-left']) expect(schemaCue.test(cue), cue).toBe(true);
    for (const cue of ['a b', 'x/y', 'é', '']) expect(schemaCue.test(cue), cue).toBe(false);
    // The hold runs under the attractor, whose intensity is cueable: the validator accepts what the schema now does.
    const current = structuredClone(CURRENT_EXAMPLE_V2);
    current.beats[1].cue = 'set:intensity=0.6';
    expect(() => validateRiseCurrent(current)).not.toThrow();
    expect(conforms(currentJsonSchemaV2(), current)).toEqual([]);
  });

  it('describes the v2 Current as the validator admits it: beats over scenes', () => {
    const v2 = currentJsonSchemaV2();
    expect(conforms(v2, CURRENT_EXAMPLE_V2)).toEqual([]);
    expect(() => validateRiseCurrent(CURRENT_EXAMPLE_V2)).not.toThrow();
    expect(v2.properties.beats.maxItems).toBe(BEAT_LIMITS.beats);
    const [native, generated] = v2.properties.scenes.items.oneOf;
    expect(native.properties.engine.enum).toBe(SCENE_ENGINES);
    expect(generated).toMatchObject({ required: ['id', 'code'], additionalProperties: false });
    expect(generated.properties.code.maxLength).toBe(BEAT_LIMITS.code);
    expect(generated.properties.code.description).toMatch(/default export function.*rise.*no imports.*no network.*no timers.*frame/isu);
    const figure = v2.properties.scenes.items.oneOf[2];
    expect(figure).toMatchObject({ required: ['id', 'svg'], additionalProperties: false });
    expect(figure.properties.svg.maxLength).toBe(BEAT_LIMITS.svg);
    expect(figure.properties.svg.description).toMatch(/SVG.*viewBox.*currentColor.*no cues/isu);
    const drawn = structuredClone(CURRENT_EXAMPLE_V2);
    drawn.scenes.push({ id: 'triangle', svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1 1"/>' });
    expect(() => validateRiseCurrent(drawn)).not.toThrow();
    expect(conforms(v2, drawn)).toEqual([]);
    const coded = structuredClone(CURRENT_EXAMPLE_V2);
    coded.scenes.push({ id: 'vector', code: 'export default () => ({ frame() {} });' });
    expect(() => validateRiseCurrent(coded)).not.toThrow();
    expect(conforms(v2, coded)).toEqual([]);
    for (const mutate of [
      c => { c.beats[0].extra = 1; },
      c => { c.beats[0].place = 'margin'; },
      c => { c.scenes[0].engine = 'shader'; },
      c => { c.scenes[0].code = 'export default () => ({ frame() {} });'; },      c => { c.scenes[0].svg = '<svg/>'; },

      c => { c.beats = []; },
      // The Feelings are parked until they are reworked (owner, 2026-10-09).
      c => { c.beats[0].sound = 'mystery'; },
      c => { c.beats[0].sound = 'chase'; }
    ]) {
      const current = structuredClone(CURRENT_EXAMPLE_V2);
      mutate(current);
      expect(() => validateRiseCurrent(current)).toThrow();
      expect(conforms(v2, current).length).toBeGreaterThan(0);
    }
  });

  it('refuses, as the validator does, a field it does not know, a theme or a visual off the catalog, another schema, no segments, and no origin', () => {
    const cases = [
      c => { c.extra = 1; },
      c => { c.theme = 'neon'; },
      c => { c.segments[0].visual = 'shader'; },
      c => { c.schema = 'rise.current.v0'; },
      c => { c.segments = []; },
      c => { c.segments[0].text = ''; },
      c => { delete c.origin; }
    ];
    for (const [index, mutate] of cases.entries()) {
      const current = structuredClone(CURRENT_EXAMPLE);
      mutate(current);
      expect(() => validateRiseCurrent(current), `case ${index}`).toThrow();
      expect(conforms(schema, current).length, `case ${index}`).toBeGreaterThan(0);
    }
  });

  it('is what the tool asks for, as "current" and nothing beside it', async () => {
    const { result } = await json(await post(rpc('tools/list')));
    expect(result.tools[0].inputSchema).toEqual({ type: 'object', properties: { current: { oneOf: [schema, currentJsonSchemaV2()] } }, required: ['current'], additionalProperties: false });
  });

  it('is what the tool promises back, named once rather than repeated, and what it gives back', async () => {
    const { result: listed } = await json(await post(rpc('tools/list')));
    // The input schema already spells the Current out; the output names it, which keeps tools/list half the size.
    expect(listed.tools[0].outputSchema).toEqual({ type: 'object', properties: { current: { type: 'object', description: expect.any(String) } }, required: ['current'] });
    const { result } = await json(await post(rpc('tools/call', { name: 'rise_present', arguments: { current: BLACK_HOLES_CURRENT } })));
    expect(conforms(listed.tools[0].outputSchema, result.structuredContent)).toEqual([]);
  });
});

describe('the guides to the styles', () => {
  const GUIDE_URIS = RISE_CURRENT_STYLES.map(id => `ui://rise/guide/${id}`);

  it('are listed after the app, one Markdown resource per style, each named and described in one line', async () => {
    const { result } = await json(await post(rpc('resources/list')));
    expect(result.resources.map(resource => resource.uri)).toEqual([APP_URI, ...GUIDE_URIS]);
    for (const resource of result.resources.slice(1)) {
      expect(resource.mimeType).toBe('text/markdown');
      expect(resource.name).toMatch(/^rise-guide-[a-z-]+$/u);
      for (const key of ['title', 'description']) expect(resource[key], key).toMatch(/^[^\n]+$/u);
    }
  });

  it('are read as the style’s full guidance, with its worked Currents', async () => {
    for (const id of RISE_CURRENT_STYLES) {
      const { result } = await json(await post(rpc('resources/read', { uri: `ui://rise/guide/${id}` })));
      expect(result.contents).toEqual([{ uri: `ui://rise/guide/${id}`, mimeType: 'text/markdown', text: styleGuide(id) }]);
    }
  });

  it('are not found for a style RISE does not have', async () => {
    for (const uri of ['ui://rise/guide/', 'ui://rise/guide/baroque', 'ui://rise/guide/constructor', 'ui://rise/guide/open-field/x', 'ui://rise/guide/Open-Field']) {
      const { error } = await json(await post(rpc('resources/read', { uri })));
      expect(error, uri).toMatchObject({ code: -32002, message: 'Resource not found' });
    }
  });

  it('are served without reading the deployed page, even with the self-contained card switched on', async () => {
    const ASSETS = { asked: null, fetch: async request => { ASSETS.asked = request.url; return new Response('<!doctype html>'); } };
    const response = await post(rpc('resources/read', { uri: GUIDE_URIS[0] }), { env: { ...ON, MCP_SELF_CONTAINED: 'true', ASSETS } });
    expect((await json(response)).result.contents[0].mimeType).toBe('text/markdown');
    expect(ASSETS.asked).toBeNull();
  });
});

describe('the app', () => {
  it('is listed as a resource with the extension’s type, first', async () => {
    const { result } = await json(await post(rpc('resources/list')));
    expect(result.resources[0]).toEqual(expect.objectContaining({ uri: APP_URI, mimeType: APP_MIME }));
  });

  it('is served as an HTML document that frames RISE’s own page at this origin, asks the host for that frame only, and says in one sentence what it shows', async () => {
    const { result } = await json(await post(rpc('resources/read', { uri: APP_URI })));
    expect(result.contents).toHaveLength(1);
    const [content] = result.contents;
    expect(content).toMatchObject({ uri: APP_URI, mimeType: APP_MIME });
    expect(content.text.startsWith('<!doctype html>')).toBe(true);
    expect(content.text).toContain(`src="${SITE}/live?embed=mcp"`);
    expect(content._meta.ui).toEqual({ csp: { frameDomains: [SITE], connectDomains: [], resourceDomains: [] }, prefersBorder: false });
    expect(content._meta['openai/widgetDescription']).toMatch(/^[^.]*Play[^.]*\.$/u);
  });

  describe('self-contained, with MCP_SELF_CONTAINED (LIVE-010)', () => {
    const PAGE = '<!doctype html><html><head><meta charset="utf-8"><script type="module" crossorigin src="/assets/main-x.js"></script></head><body><div id="app"></div></body></html>';
    const assets = (page = PAGE, ok = true) => {
      const binding = { asked: null, fetch: async request => { binding.asked = request.url; return new Response(page, { status: ok ? 200 : 404 }); } };
      return binding;
    };
    const read = async env => (await json(await post(rpc('resources/read', { uri: APP_URI }), { env: { ...ON, ...env } }))).result.contents[0];

    it('is RISE’s deployed page itself, its addresses at RISE, framing nothing and reaching only this origin', async () => {
      const ASSETS = assets();
      const content = await read({ MCP_SELF_CONTAINED: 'true', ASSETS });
      expect(ASSETS.asked).toBe(`${SITE}/index.html`);
      // No <base>: a host's sandbox refuses one. The page's addresses are RISE's outright.
      expect(content.text).not.toContain('<base');
      expect(content.text).toContain('<meta name="rise-embed" content="/live?embed=mcp">');
      expect(content.text).toContain(`src="${SITE}/assets/main-x.js"`);
      expect(content.text).not.toContain('<iframe');
      expect(content._meta.ui.csp).toEqual({ connectDomains: [SITE], resourceDomains: [SITE], frameDomains: [] });
    });

    it('serves the framed card while the switch is off, or when the deployed page cannot be read', async () => {
      expect((await read({ ASSETS: assets() })).text).toContain(`src="${SITE}/live?embed=mcp"`);
      expect((await read({ MCP_SELF_CONTAINED: 'true', ASSETS: assets('', false) })).text).toContain('<iframe');
    });
  });

  it('names RISE’s own origin as ChatGPT’s dedicated domain, under ChatGPT’s key so Claude’s ui.domain check never sees it', async () => {
    const [content] = (await json(await post(rpc('resources/read', { uri: APP_URI })))).result.contents;
    expect(content._meta['openai/widgetDomain']).toBe(SITE);
    expect(content._meta.ui.domain).toBeUndefined();
  });

  it('tells ChatGPT on the resource the same display modes the app declares at ui/initialize, inline first', async () => {
    const { result } = await json(await post(rpc('resources/read', { uri: APP_URI })));
    expect(result.contents[0]._meta['openai/ui']).toEqual({ availableDisplayModes: [...DISPLAY_MODES] });
    expect(DISPLAY_MODES[0]).toBe('inline');
  });

  it('follows the origin it is asked at, so a staging site frames its own page', async () => {
    const { result } = await json(await post(rpc('resources/read', { uri: APP_URI }), { url: 'https://staging.rise.example/api/mcp' }));
    expect(result.contents[0].text).toContain('src="https://staging.rise.example/live?embed=mcp"');
    expect(result.contents[0]._meta.ui.csp.frameDomains).toEqual(['https://staging.rise.example']);
  });

  it('frames the page with the witness log switched on only while MCP_WITNESS is true, and otherwise byte for byte as today', async () => {
    const plain = (await json(await post(rpc('resources/read', { uri: APP_URI })))).result.contents[0];
    const witness = (await json(await post(rpc('resources/read', { uri: APP_URI }), { env: { ...ON, MCP_WITNESS: 'true' } }))).result.contents[0];
    expect(witness.text).toContain(`src="${SITE}/live?embed=mcp&log=host"`);
    expect(witness.text.replace('&log=host', '')).toBe(plain.text);
    expect(witness._meta).toEqual(plain._meta);
    for (const value of [undefined, 'false', 'TRUE', '1']) {
      const same = (await json(await post(rpc('resources/read', { uri: APP_URI }), { env: { ...ON, MCP_WITNESS: value } }))).result.contents[0];
      expect(same, String(value)).toEqual(plain);
    }
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

  it('keeps its framing headers while the self-contained card is on: nothing frames it then', async () => {
    const { result } = await ask('/live?embed=mcp', { env: { ...ON, MCP_SELF_CONTAINED: 'true' } });
    expect(result.headers.get('X-Frame-Options')).toBe('DENY');
    expect(result.headers.get('Content-Security-Policy')).toContain("frame-ancestors 'none'");
  });

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
