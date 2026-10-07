/**
 * The production Worker's configuration, read as Wrangler reads it.
 *
 * What is held: the Worker runs first for the paths it must answer itself.
 * `/live` is one of them because handleLive (mcp-server.mjs) loosens the
 * framing headers of the embedded page, and a request the assets layer
 * answers by itself never reaches it.
 */
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/** JSONC to JSON: comments go, strings stay as they are. */
const stripComments = text => text.replace(/("(?:[^"\\]|\\.)*")|\/\*[\s\S]*?\*\/|\/\/[^\n]*/gu, (match, string) => string ?? '');

const config = JSON.parse(stripComments(readFileSync('wrangler.production.jsonc', 'utf8')));

describe('the production Worker', () => {
  it('runs first for the API and for the page an MCP app frames', () => {
    expect(config.assets.run_worker_first).toEqual(expect.arrayContaining(['/api/*', '/live']));
  });

  // docs/plans/LIVE-MCP.md §"Turning it on" and AGENTS.md say both routes are
  // off in production. The Worker turns either on only for the exact text "true"
  // (live-realtime.mjs, mcp-server.mjs), so the committed config must say "false"
  // in so many words: switching one on is then a visible one-line diff, never a
  // missing or mistyped var.
  it('ships with live realtime and the MCP server switched off, explicitly', () => {
    expect(config.vars.LIVE_REALTIME_ENABLED).toBe('false');
    expect(config.vars.MCP_ENABLED).toBe('false');
  });
});
