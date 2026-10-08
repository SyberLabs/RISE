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
    expect(config.assets.run_worker_first).toEqual(expect.arrayContaining(['/api/*', '/live', '/content/arena/*']));
  });

  // The Worker turns a route on only for the exact text "true" (live-realtime.mjs,
  // mcp-server.mjs), so each switch is stated in so many words: a change is a
  // visible one-line diff, never a missing or mistyped var. Live realtime is off.
  // The MCP server is on only with the self-contained card: without it the
  // embedded page drops its framing headers for any site (LIVE-RED-TEAM.md R-1).
  // The paid voice keeps no audio, so production deploys with no bucket existing; its
  // allowance meter is a SQLite-backed Durable Object, the kind the free plan offers.
  it('binds the Plus meter, and no bucket', () => {
    expect(config.durable_objects.bindings).toContainEqual({ name: 'PLUS_METER', class_name: 'PlusMeter' });
    expect(config.migrations.flatMap(m => m.new_sqlite_classes ?? [])).toContain('PlusMeter');
    expect(config.migrations.flatMap(m => m.new_classes ?? [])).not.toContain('PlusMeter');
    expect(config.r2_buckets).toBeUndefined();
    expect(Number(config.vars.PLUS_DAILY_CHAR_CAP)).toBeGreaterThan(0);
  });

  // The vendor id of a voice comes only from this list; "default" is the PLUS_VOICE_ID secret.
  it('offers a default voice and an id for every other one', () => {
    const voices = config.vars.PLUS_VOICES;
    expect(voices.filter(v => v.slug === 'default')).toEqual([{ slug: 'default', label: expect.any(String) }]);
    for (const voice of voices.filter(v => v.slug !== 'default')) {
      expect(voice).toEqual({ slug: expect.stringMatching(/^[a-z0-9_-]{1,32}$/u), label: expect.any(String), id: expect.stringMatching(/^[A-Za-z0-9]+$/u) });
    }
    expect(new Set(voices.map(v => v.slug)).size).toBe(voices.length);
  });

  it('ships live realtime off, and the MCP server on only with the self-contained card', () => {
    expect(config.vars.LIVE_REALTIME_ENABLED).toBe('false');
    expect(['true', 'false']).toContain(config.vars.MCP_ENABLED);
    if (config.vars.MCP_ENABLED === 'true') expect(config.vars.MCP_SELF_CONTAINED).toBe('true');
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
