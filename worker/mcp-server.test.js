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
import { RISE_CURRENT_LIMITS, RISE_CURRENT_LOOKS, RISE_CURRENT_SCHEMA, RISE_CURRENT_THEME_IDS, RISE_CURRENT_VISUALS, validateRiseCurrent } from '../src/core/rise-current.js';
import { BLACK_HOLES_CURRENT } from '../src/test/sealed-current.js';
import { CURRENT_EXAMPLE, CURRENT_GUIDE } from '../src/live/adapters/current-guide.js';
import { FOREST_AFTER_FIRE, WEATHER_CHAOS } from '../src/live/fixtures/explanations.js';
import worker from './index.mjs';
import { APP_MIME, APP_URI, currentJsonSchema, handleLive, handleMcp, MCP_PATH, PROTOCOL_VERSIONS, TOOL } from './mcp-server.mjs';

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

  it('takes a request in any well-formed protocol version, newer ones included, and refuses a malformed one before reading the body', async () => {
    for (const version of [...PROTOCOL_VERSIONS, '2026-07-28', '1999-01-01']) expect((await post(rpc('ping'), { headers: { 'MCP-Protocol-Version': version } })).status, version).toBe(200);
    for (const version of ['latest', '', '2026-7-28', '2026-07-28; charset=x']) {
      const response = await post(null, { raw: '{not json', headers: { 'MCP-Protocol-Version': version } });
      expect(response.status, version).toBe(400);
      expect(await json(response)).toEqual({ error: { code: 'UNSUPPORTED_PROTOCOL_VERSION', message: expect.any(String) } });
    }
  });

  it('is limited per client address through the limiter live answers use, before the body is read, and is as it was without one', async () => {
    const headers = { 'CF-Connecting-IP': '192.0.2.1' };
    const denied = { ...ON, DECISION_LIMITER: { limit: async () => ({ success: false }) } };
    const limit = vi.fn(async () => ({ success: true }));
    expect((await post(rpc('ping'), { headers, env: { ...ON, DECISION_LIMITER: { limit } } })).status).toBe(200);
    expect(limit).toHaveBeenCalledWith({ key: 'mcp:192.0.2.1' });
    const limited = await post(null, { raw: '{not json', headers, env: denied });
    expect(limited.status).toBe(429);
    expect(await json(limited)).toEqual({ error: { code: 'RATE_LIMITED', message: expect.any(String) } });
    // No binding (tests, a local run), no address, or a limiter that fails: the route is unchanged.
    expect((await post(rpc('ping'), { headers })).status).toBe(200);
    expect((await post(rpc('ping'), { env: denied })).status).toBe(200);
    expect((await post(rpc('ping'), { headers, env: { ...ON, DECISION_LIMITER: { limit: async () => { throw new Error('down'); } } } })).status).toBe(200);
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
  it('is one tool, read-only, callable with no sign-in, with the guide to writing a Current', async () => {
    const { result } = await json(await post(rpc('tools/list')));
    expect(result.tools).toHaveLength(1);
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
    expect(tool.description.endsWith(CURRENT_GUIDE)).toBe(true);
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

  it('refuses, as the validator does, a field it does not know, a theme or a visual off the catalog, another schema, no segments, and no origin', () => {
    const cases = [
      c => { c.extra = 1; },
      c => { c.theme = 'neon'; },
      c => { c.segments[0].visual = 'shader'; },
      c => { c.schema = 'rise.current.v2'; },
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
    expect(result.tools[0].inputSchema).toEqual({ type: 'object', properties: { current: schema }, required: ['current'], additionalProperties: false });
  });

  it('is what the tool promises back, and what it gives back', async () => {
    const { result: listed } = await json(await post(rpc('tools/list')));
    expect(listed.tools[0].outputSchema).toEqual({ type: 'object', properties: { current: schema }, required: ['current'] });
    const { result } = await json(await post(rpc('tools/call', { name: 'rise_present', arguments: { current: BLACK_HOLES_CURRENT } })));
    expect(conforms(listed.tools[0].outputSchema, result.structuredContent)).toEqual([]);
  });
});

describe('the app', () => {
  it('is listed as one resource with the extension’s type', async () => {
    const { result } = await json(await post(rpc('resources/list')));
    expect(result.resources).toEqual([expect.objectContaining({ uri: APP_URI, mimeType: APP_MIME })]);
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
      expect(content.text).toContain(`<base href="${SITE}/">`);
      expect(content.text).toContain('<meta name="rise-embed" content="/live?embed=mcp">');
      expect(content.text).toContain('src="/assets/main-x.js"');
      expect(content.text).not.toContain('<iframe');
      expect(content._meta.ui.csp).toEqual({ connectDomains: [SITE], resourceDomains: [SITE], baseUriDomains: [SITE], frameDomains: [] });
    });

    it('serves the framed card while the switch is off, or when the deployed page cannot be read', async () => {
      expect((await read({ ASSETS: assets() })).text).toContain(`src="${SITE}/live?embed=mcp"`);
      expect((await read({ MCP_SELF_CONTAINED: 'true', ASSETS: assets('', false) })).text).toContain('<iframe');
    });
  });

  it('tells ChatGPT on the resource that it is shown inline only, so the host picks the mode before loading it', async () => {
    const { result } = await json(await post(rpc('resources/read', { uri: APP_URI })));
    expect(result.contents[0]._meta['openai/ui']).toEqual({ availableDisplayModes: ['inline'] });
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
