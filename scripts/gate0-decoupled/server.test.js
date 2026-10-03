import { afterEach, describe, expect, it } from 'vitest';
import {
  createDecoupledRunState,
  dispatchDecoupled,
  startDecoupledServer,
  DECOUPLED_WIDGET_URI
} from './server.mjs';

const jsonRpc = (id, method, params) => ({ jsonrpc: '2.0', id, method, ...(params === undefined ? {} : { params }) });
const post = (url, body, headers = {}) => fetch(url, {
  method: 'POST',
  headers: { 'content-type': 'application/json', ...headers },
  body: typeof body === 'string' ? body : JSON.stringify(body)
});
let activeServers = [];
afterEach(async () => {
  await Promise.all(activeServers.splice(0).map(({ server }) => new Promise(resolve => server.close(resolve))));
});

function timeSource() {
  let tick = 0;
  return () => new Date(Date.UTC(2026, 9, 3, 12, 0, tick++)).toISOString();
}

async function start() {
  const started = await startDecoupledServer({ port: 0, widgetHtml: '<html></html>', state: createDecoupledRunState({ runId: 'run-a', now: timeSource() }) });
  activeServers.push(started);
  return started;
}

async function directRpc(message, state) {
  return (await dispatchDecoupled(message, state, '<html></html>')).json();
}

async function rpc(address, message, headers = {}) {
  const response = await post(`http://127.0.0.1:${address.port}/mcp`, message, headers);
  return { response, body: response.status === 202 ? null : await response.json() };
}

describe('decoupled Gate 0 tool contract', () => {
  it('lists only open, set, and read, with a UI resource on open only', async () => {
    const state = createDecoupledRunState();
    const response = await dispatchDecoupled(jsonRpc(1, 'tools/list'), state, '<html></html>');
    const body = await response.json();
    const tools = body.result.tools;
    expect(tools.map(tool => tool.name)).toEqual(['rise_open_visual', 'rise_set_visual', 'rise_read_visual']);
    expect(tools.filter(tool => tool._meta?.ui?.resourceUri)).toHaveLength(1);
    expect(tools[0]._meta.ui.resourceUri).toBe(DECOUPLED_WIDGET_URI);
    expect(tools[0]._meta['openai/outputTemplate']).toBe(DECOUPLED_WIDGET_URI);
    expect(tools[1]._meta.ui.visibility).toEqual(['model', 'app']);
    expect(tools[2]._meta.ui.visibility).toEqual(['model', 'app']);
    expect(tools[1]._meta.ui.resourceUri).toBeUndefined();
    expect(tools[2]._meta.ui.resourceUri).toBeUndefined();
    expect(tools[1]._meta['openai/outputTemplate']).toBeUndefined();
    expect(tools[2]._meta['openai/outputTemplate']).toBeUndefined();
    expect(state.sequence).toBe(0);
  });

  it('opens and reads the exact seven-field baseline without changing sequence', async () => {
    const state = createDecoupledRunState({ runId: 'run-a', now: timeSource() });
    const opened = await directRpc(jsonRpc(1, 'tools/call', { name: 'rise_open_visual', arguments: {} }), state);
    expect(Object.keys(opened.result.structuredContent)).toEqual(['runId', 'sequence', 'visual', 'intensity', 'serverReceivedAt', 'serverAppliedAt', 'observedAt']);
    expect(opened.result.structuredContent).toMatchObject({ runId: 'run-a', sequence: 0, visual: 'still', intensity: null, serverReceivedAt: null, serverAppliedAt: null });
    expect(opened.result._meta.ui.resourceUri).toBe(DECOUPLED_WIDGET_URI);
    expect(state.sequence).toBe(0);
    const read = await directRpc(jsonRpc(2, 'tools/call', { name: 'rise_read_visual', arguments: { runId: 'run-a' } }), state);
    expect(read.result.structuredContent).toMatchObject({ ...opened.result.structuredContent, observedAt: expect.any(String) });
    expect(read.result.structuredContent.serverReceivedAt).toBeNull();
    expect(read.result.structuredContent.serverAppliedAt).toBeNull();
    expect(state.sequence).toBe(0);
  });

  it('admits a valid mutation and reports the same last-mutation times on later reads', async () => {
    const state = createDecoupledRunState({ runId: 'run-a', now: timeSource() });
    const set = await directRpc(jsonRpc(3, 'tools/call', { name: 'rise_set_visual', arguments: { runId: 'run-a', visual: 'attractor' } }), state);
    const snapshot = set.result.structuredContent;
    expect(snapshot).toMatchObject({ runId: 'run-a', sequence: 1, visual: 'attractor', intensity: 0.65 });
    expect(snapshot.serverReceivedAt).toBe('2026-10-03T12:00:00.000Z');
    expect(snapshot.serverAppliedAt).toBe('2026-10-03T12:00:01.000Z');
    expect(set.result._meta).toBeUndefined();
    const read = await directRpc(jsonRpc(4, 'tools/call', { name: 'rise_read_visual', arguments: { runId: 'run-a' } }), state);
    expect(read.result.structuredContent.serverReceivedAt).toBe(snapshot.serverReceivedAt);
    expect(read.result.structuredContent.serverAppliedAt).toBe(snapshot.serverAppliedAt);
    expect(read.result._meta).toBeUndefined();
    expect(read.result.structuredContent.sequence).toBe(1);
    expect(state.sequence).toBe(1);
  });

  it('refuses stale runs, open arguments, and invalid mutation fields without exposing a snapshot', async () => {
    const state = createDecoupledRunState({ runId: 'run-a', now: timeSource() });
    const requests = [
      ['rise_open_visual', { unknown: true }],
      ['rise_set_visual', { runId: 'stale', visual: 'attractor' }],
      ['rise_set_visual', { runId: 'run-a', visual: 'still', intensity: 0.65 }],
      ['rise_set_visual', { runId: 'run-a', visual: 'attractor', intensity: 0.8 }],
      ['rise_read_visual', { runId: 'stale' }],
      ['rise_read_visual', { runId: 'run-a', extra: 1 }]
    ];
    for (const [name, args] of requests) {
      const response = await directRpc(jsonRpc(1, 'tools/call', { name, arguments: args }), state);
      expect(response.result.isError).toBe(true);
      expect(response.result.structuredContent).toBeUndefined();
    }
    expect(state.sequence).toBe(0);
  });

  it('serves inert HTML and enforces HTTP admission over actual loopback requests', async () => {
    const { address, state } = await start();
    const goodOrigin = `http://127.0.0.1:${address.port}`;
    const denied = await post(`${goodOrigin}/mcp`, jsonRpc(1, 'tools/list'), { origin: 'http://evil.test' });
    expect(denied.status).toBe(403);
    const unknown = await fetch(`${goodOrigin}/unknown`);
    expect(unknown.status).toBe(404);
    const wrongMethod = await fetch(`${goodOrigin}/mcp`);
    expect(wrongMethod.status).toBe(405);
    const malformed = await post(`${goodOrigin}/mcp`, '{bad', { origin: goodOrigin });
    expect((await malformed.json()).error.code).toBe(-32700);
    const oversized = await post(`${goodOrigin}/mcp`, ' '.repeat(16_385), { origin: goodOrigin });
    expect(oversized.status).toBe(413);
    const notify = await rpc(address, { jsonrpc: '2.0', method: 'tools/list' }, { origin: goodOrigin });
    expect(notify.response.status).toBe(202);
    const stringId = await rpc(address, jsonRpc('hello', 'tools/list'), { origin: goodOrigin });
    expect(stringId.body.id).toBe('hello');
    expect(stringId.body.result.tools.map(tool => tool.name)).toEqual(['rise_open_visual', 'rise_set_visual', 'rise_read_visual']);
    const refused = await rpc(address, jsonRpc(4, 'tools/call', { name: 'rise_set_visual', arguments: { runId: 'stale', visual: 'attractor' } }), { origin: goodOrigin });
    expect(refused.body.result.isError).toBe(true);
    expect(refused.body.result.structuredContent).toBeUndefined();
    expect(state.sequence).toBe(0);
    const opened = await rpc(address, jsonRpc(3, 'tools/call', { name: 'rise_open_visual', arguments: {} }), { origin: goodOrigin });
    expect(opened.body.result.structuredContent.sequence).toBe(0);
    expect(opened.body.result._meta.ui.resourceUri).toBe(DECOUPLED_WIDGET_URI);
    const html = await fetch(`${goodOrigin}/__gate0/widget`);
    expect(html.status).toBe(200);
    expect(await html.text()).toBe('<html></html>');
    expect((await rpc(address, jsonRpc(4, 'tools/call', { name: 'rise_set_visual', arguments: { runId: 'run-a', visual: 'still' } }), { origin: goodOrigin })).body.result.structuredContent.sequence).toBe(1);
  });
});
