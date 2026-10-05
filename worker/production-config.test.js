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
});
