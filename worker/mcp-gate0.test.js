/**
 * The Gate 0 probe, spoken to as a host would.
 *
 * What is held: the probe tool is absent unless MCP_GATE0 is exactly 'true';
 * when present it takes only a catalog visual and an intensity from 0 to 1,
 * logs one line with no request text beyond those two values, and changes
 * nothing about `rise_present`.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BLACK_HOLES_CURRENT } from '../src/test/sealed-current.js';
import { callGate0, GATE0_TOOL_NAME } from './mcp-gate0.mjs';
import { GUIDE_TOOL, handleMcp, MCP_PATH, TOOL } from './mcp-server.mjs';

const ON = { MCP_ENABLED: 'true' };
const PROBE = { MCP_ENABLED: 'true', MCP_GATE0: 'true' };

const post = (body, env) => handleMcp(new Request(`https://rise.example${MCP_PATH}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body)
}), env);
const rpc = (method, params, id = 1) => ({ jsonrpc: '2.0', id, method, params });
const json = async response => JSON.parse(await response.text());
const listed = async env => (await json(await post(rpc('tools/list'), env))).result.tools.map(tool => tool.name);
const setVisual = args => rpc('tools/call', { name: GATE0_TOOL_NAME, arguments: args });

afterEach(() => vi.restoreAllMocks());

describe('Gate 0 probe', () => {
  it('is listed only when MCP_GATE0 is exactly the text true', async () => {
    expect(await listed(PROBE)).toEqual([TOOL.name, GUIDE_TOOL.name, GATE0_TOOL_NAME]);
    for (const extra of [{}, { MCP_GATE0: 'false' }, { MCP_GATE0: 'TRUE' }, { MCP_GATE0: true }]) {
      expect(await listed({ ...ON, ...extra }), JSON.stringify(extra)).toEqual([TOOL.name, GUIDE_TOOL.name]);
    }
  });

  it('cannot be called while it is not listed', async () => {
    const body = await json(await post(setVisual({ visual: 'attractor', intensity: 0.5 }), ON));
    expect(body.error.message).toBe('Unknown tool');
  });

  it('records a catalog visual and its intensity, with the time the server received it', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const body = await json(await post(setVisual({ visual: 'genesis', intensity: 0.8 }), PROBE));
    expect(body.result.isError).toBeUndefined();
    expect(body.result.structuredContent).toMatchObject({ visual: 'genesis', intensity: 0.8 });
    expect(log).toHaveBeenCalledTimes(1);
    const line = JSON.parse(log.mock.calls[0][0]);
    expect(Object.keys(line).sort()).toEqual(['gate0', 'intensity', 'receivedAt', 'visual']);
    expect(line).toMatchObject({ gate0: 'TOOL_CALL', visual: 'genesis', intensity: 0.8 });
    expect(Number.isNaN(Date.parse(line.receivedAt))).toBe(false);
  });

  it('refuses anything outside the catalog or the range, and logs nothing for it', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    for (const args of [
      { visual: 'unknown-surface', intensity: 0.5 }, { visual: 'attractor', intensity: 1.01 },
      { visual: 'attractor', intensity: -0.1 }, { visual: 'attractor', intensity: '0.5' },
      { visual: 'attractor', intensity: Number.NaN }, { visual: 'attractor' }, null
    ]) {
      const body = await json(await post(setVisual(args), PROBE));
      expect(body.result.isError, JSON.stringify(args)).toBe(true);
    }
    expect(log).not.toHaveBeenCalled();
  });

  it('accepts both ends of the range', () => {
    expect(callGate0({ visual: 'still', intensity: 0 }, 0).result.isError).toBeUndefined();
    expect(callGate0({ visual: 'still', intensity: 1 }, 0).result.isError).toBeUndefined();
  });

  it('leaves rise_present as it was', async () => {
    const call = rpc('tools/call', { name: TOOL.name, arguments: { current: BLACK_HOLES_CURRENT } });
    expect(await json(await post(call, PROBE))).toEqual(await json(await post(call, ON)));
  });
});
