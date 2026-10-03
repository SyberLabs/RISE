import { describe, expect, it } from 'vitest';
import { createRunState, mutateVisual, handleMcp, dispatch, TOOL_NAME, WIDGET_URI, APP_MIME } from './server.mjs';
import { acceptVisualResult, createVisualController, CLIENT_LOG_LIMIT } from './widget-runtime.mjs';

const now = () => '2026-10-02T12:00:00.000Z';
const valid = (patch = {}) => ({
  runId: '57be2c5a-6b58-4a21-92d5-c70be9e4d592',
  sequence: 1,
  visual: 'attractor',
  intensity: 0.65,
  serverReceivedAt: now(),
  serverAppliedAt: now(),
  ...patch
});

describe('Gate 0 mutation contract', () => {
  it('refuses malformed mutations without changing state', () => {
    const state = createRunState({ runId: valid().runId });
    for (const args of [
      { visual: 'attractor', intensity: 0.8 },
      { visual: 'attractor', intensity: NaN },
      { visual: 'still', intensity: 0.65 },
      { visual: 'canvas', intensity: 0.65 },
      { visual: 'still', extra: true },
      [], null
    ]) {
      expect(mutateVisual(state, args, now()).isError).toBe(true);
      expect(state.sequence).toBe(0);
      expect(state.log).toHaveLength(0);
    }
  });

  it('answers the reviewed initialization and exposes one mutating tool plus one UI resource', async () => {
    const state = createRunState({ runId: valid().runId });
    const read = async message => (await dispatch(message, state, '<html></html>').json()).result;
    const initialized = await read({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-06-18' } });
    expect(initialized.protocolVersion).toBe('2025-06-18');
    expect(Object.keys(initialized.capabilities).sort()).toEqual(['resources', 'tools']);
    const tools = await read({ jsonrpc: '2.0', id: 2, method: 'tools/list' });
    expect(tools.tools).toHaveLength(1);
    expect(tools.tools[0]).toMatchObject({ name: TOOL_NAME, annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: false } });
    const resources = await read({ jsonrpc: '2.0', id: 3, method: 'resources/list' });
    expect(resources.resources).toEqual([expect.objectContaining({ uri: WIDGET_URI, mimeType: APP_MIME })]);
    const content = await read({ jsonrpc: '2.0', id: 4, method: 'resources/read', params: { uri: WIDGET_URI } });
    expect(content.contents[0]).toMatchObject({ uri: WIDGET_URI, mimeType: APP_MIME, text: '<html></html>' });
  });

  it('preserves valid string JSON-RPC request IDs', async () => {
    const response = await dispatch({ jsonrpc: '2.0', id: 'probe-1', method: 'initialize', params: { protocolVersion: '2025-06-18' } }, createRunState(), '<html></html>').json();
    expect(response).toMatchObject({ jsonrpc: '2.0', id: 'probe-1', result: { protocolVersion: '2025-06-18' } });
    expect(response.error).toBeUndefined();
  });

  it('applies valid visual mutations with monotonic receipts and a bounded log', () => {
    const state = createRunState({ runId: valid().runId, logLimit: 2 });
    const a = mutateVisual(state, { visual: 'attractor' }, now());
    const b = mutateVisual(state, { visual: 'still' }, now());
    const c = mutateVisual(state, { visual: 'attractor', intensity: 0.4 }, now());
    expect([a.structuredContent.sequence, b.structuredContent.sequence, c.structuredContent.sequence]).toEqual([1, 2, 3]);
    expect(a.structuredContent.intensity).toBe(0.65);
    expect(b.structuredContent.intensity).toBeNull();
    expect(state.log.map(entry => entry.sequence)).toEqual([2, 3]);
  });

  it('bounds request bodies and accepts only the local browser origin', async () => {
    const state = createRunState({ runId: valid().runId });
    const oversized = new Request('http://127.0.0.1:4319/mcp', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://evil.test' },
      body: ' '.repeat(20_000)
    });
    expect((await handleMcp(oversized, state, '<html></html>', 'http://127.0.0.1:4319')).status).toBe(403);
    const tooBig = new Request('http://127.0.0.1:4319/mcp', {
      method: 'POST', headers: { 'content-type': 'application/json', origin: 'http://127.0.0.1:4319' },
      body: ' '.repeat(20_000)
    });
    expect((await handleMcp(tooBig, state, '<html></html>', 'http://127.0.0.1:4319')).status).toBe(413);
    expect(state.sequence).toBe(0);
  });

  it('rejects an Origin matching forged Host when it differs from the bound loopback origin', async () => {
    const state = createRunState({ runId: valid().runId });
    const request = new Request('http://evil.test/mcp', {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'http://evil.test' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: TOOL_NAME, arguments: { visual: 'attractor' } } })
    });
    const response = await handleMcp(request, state, '<html></html>', 'http://127.0.0.1:4319');
    expect(response.status).toBe(403);
    expect(state.sequence).toBe(0);
  });
});

describe('Gate 0 widget result admission', () => {
  it('rejects untrusted, malformed, oversized, duplicate and stale results before applying them', () => {
    const actions = [];
    const apply = result => { actions.push(result.sequence); };
    const first = acceptVisualResult(valid(), { trustedParent: true, apply });
    const duplicate = acceptVisualResult(valid(), { trustedParent: true, apply, lastSequence: 1, runId: valid().runId });
    const stale = acceptVisualResult(valid({ sequence: 1 }), { trustedParent: true, apply, lastSequence: 2, runId: valid().runId });
    const unknown = acceptVisualResult(valid({ extra: '<script>' }), { trustedParent: true, apply });
    const untrusted = acceptVisualResult(valid(), { trustedParent: false, apply });
    expect(first.status).toBe('applied');
    expect([duplicate.status, stale.status, unknown.status, untrusted.status]).toEqual(['duplicate', 'stale', 'refused', 'ignored']);
    expect(actions).toEqual([1]);
  });

  it('reuses one renderer for intensity changes and records bounded manual evidence separately', () => {
    const frames = new Map();
    const calls = [];
    let frameId = 0;
    const field = { destroy: () => calls.push('destroy') };
    const controller = createVisualController({
      mountAttractor: value => { calls.push(['mount', value]); return field; },
      setIntensity: (value, target) => { calls.push(['intensity', value, target === field]); return true; },
      showStill: () => calls.push('still'),
      clock: () => now(),
      requestFrame: callback => { const id = ++frameId; frames.set(id, callback); return id; },
      cancelFrame: id => frames.delete(id)
    });
    expect(controller.accept(valid({ sequence: 1 }), true).status).toBe('applied');
    expect(controller.accept(valid({ sequence: 2, intensity: 0.7 }), true).status).toBe('applied');
    expect(calls).toEqual([['mount', 0.65], ['intensity', 0.7, true]]);
    expect(controller.accept(valid({ sequence: 2, intensity: 0.7 }), true).status).toBe('duplicate');
    expect(controller.accept(valid({ sequence: 1, intensity: 0.4 }), true).status).toBe('stale');
    controller.appendEvidence({ type: 'reader_marker', evidence: 'host_rpc_acknowledged' });
    controller.appendEvidence({ type: 'manual_voice_observation', evidence: 'manual', kind: 'audible_reader_acknowledgment' });
    expect(controller.log.slice(-2).map(entry => entry.evidence)).toEqual(['host_rpc_acknowledged', 'manual']);
    expect(controller.sequence).toBe(2);
    for (const callback of frames.values()) callback();
    for (let index = 0; index < CLIENT_LOG_LIMIT + 4; index += 1) controller.appendEvidence({ type: 'manual_voice_observation', evidence: 'manual', kind: 'speech_start', observedAt: now() });
    expect(controller.log).toHaveLength(CLIENT_LOG_LIMIT);
    controller.teardown();
    expect(calls.at(-1)).toBe('destroy');
  });
});
