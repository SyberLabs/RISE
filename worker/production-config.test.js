/**
 * The Worker's configurations, read as Wrangler reads them.
 *
 * What is held: the production Worker runs first for the paths it must answer
 * itself. `/live` is one of them because handleLive (mcp-server.mjs) loosens
 * the framing headers of the embedded page, and a request the assets layer
 * answers by itself never reaches it. And every configuration that can switch
 * on a rate-limited route (live answers, the MCP server) declares the limiter
 * those routes key on, because without the binding the MCP route is unlimited.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** JSONC to JSON: comments go, strings stay as they are. */
const stripComments = text => text.replace(/("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, (match, string) => string ?? '');

const load = file => JSON.parse(stripComments(readFileSync(file, 'utf8')));
const config = load('wrangler.production.jsonc');

describe('the production Worker', () => {
  it('runs first for the API and for the page an MCP app frames', () => {
    expect(config.assets.run_worker_first).toEqual(expect.arrayContaining(['/api/*', '/live']));
  });
});

describe('every Worker configuration', () => {
  const files = readdirSync('.').filter(file => /^wrangler\..*\.jsonc$/u.test(file));

  it('declares DECISION_LIMITER wherever live answers or the MCP server can be switched on', () => {
    const switchable = files.filter(file => {
      const vars = load(file).vars ?? {};
      return 'LIVE_REALTIME_ENABLED' in vars || 'MCP_ENABLED' in vars;
    });
    expect(switchable).toEqual(expect.arrayContaining(['wrangler.production.jsonc', 'wrangler.demo.jsonc']));
    for (const file of switchable) {
      expect(load(file).ratelimits ?? [], file).toContainEqual(expect.objectContaining({ name: 'DECISION_LIMITER' }));
    }
  });
});
