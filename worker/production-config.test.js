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
  it('keeps new customer checkout explicitly closed until payment and recovery verification', () => {
    expect(config.vars.PLUS_CHECKOUT_ENABLED).toBe('false');
    expect(config.vars.PLUS_REQUIRE_LIVE).toBe('true');
    expect(config.vars.PLUS_PAYMENT_LINK).toBe('');
  });

  it('rechecks admin sessions through the public Access edge rather than the private origin', () => {
    // getAdmin probes /api/plus/admin/check on this Worker's own zone. Public
    // routing must apply Access revocation and reach that check handler.
    expect(config.compatibility_flags).toContain('global_fetch_strictly_public');
    expect(config.compatibility_flags).not.toContain('global_fetch_private_origin');
  });

  it('runs first for the API, for the page an MCP app frames, and for /.well-known/, so no metadata probe gets the app shell', () => {
    expect(config.assets.run_worker_first).toEqual(expect.arrayContaining(['/api/*', '/live', '/content/arena/*', '/content/changes/*', '/.well-known/*']));
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

describe('release deployment controls', () => {
  const workflow = readFileSync('.github/workflows/ci.yml', 'utf8').replace(/\r\n/g, '\n');

  it('requires an explicit main-branch dispatch to deploy the private provider', () => {
    expect(workflow).toContain("deploy_private_provider:\n        description: 'Deploy the private provider after its account owner confirms access; public production is unchanged.'\n        type: boolean\n        default: false");
    const provider = workflow.split('  voice-provider:\n')[1].split('  production:\n')[0];
    expect(provider).toContain("if: github.event_name == 'workflow_dispatch' && github.ref == 'refs/heads/main' && inputs.deploy_private_provider");
    expect(provider).toContain('needs: [ci]');
    expect(provider).toContain('Verify the tested provider bundle');
    expect(provider).toContain('test "$TESTED_SHA" = "$current"');
  });

  it('stages the tested artifact for a normal public push or an explicit private-provider dispatch', () => {
    const condition = "if: github.ref == 'refs/heads/main' && (github.event_name == 'push' || (github.event_name == 'workflow_dispatch' && inputs.deploy_private_provider))";
    expect(workflow.split(condition)).toHaveLength(3);
    const production = workflow.split('  production:\n')[1];
    expect(production).toContain("if: always() && github.event_name == 'push' && github.ref == 'refs/heads/main' && needs.ci.result == 'success'");
    expect(production).toContain('needs: [ci, voice-provider]');
    expect(production).toContain('Verify public production serves the exact release');
    expect(production).toContain('Record prior production versions');
    expect(config.services).toContainEqual({ binding: 'PLUS_VOICE_PROVIDER', service: 'rise-plus-preview', entrypoint: 'VoiceProvider' });
  });

  it.each([
    ['push', 'refs/heads/main', false, true, false, true],
    ['workflow_dispatch', 'refs/heads/main', false, false, false, false],
    ['workflow_dispatch', 'refs/heads/main', true, true, true, false],
    ['workflow_dispatch', 'refs/heads/feature', true, false, false, false],
    ['pull_request', 'refs/pull/1/merge', true, false, false, false]
  ])('%s on %s with provider=%s stages=%s, provider=%s, public=%s', (event_name, ref, deploy_private_provider, staged, privateDeploy, publicDeploy) => {
    const jobIf = name => workflow.split(`  ${name}:\n`)[1].match(/^    if: (.+)$/m)[1];
    // These conditions use the JavaScript-compatible logical subset of Actions
    // expressions. This checks the schedule matrix offline, not GitHub's engine.
    const evaluate = condition => Function('github', 'inputs', 'needs', 'always', `return (${condition});`)(
      { event_name, ref }, { deploy_private_provider }, { ci: { result: 'success' } }, () => true
    );
    const stageIf = workflow.split('      - name: Stage the tested release\n')[1].match(/^        if: (.+)$/m)[1];
    expect(evaluate(stageIf)).toBe(staged);
    expect(evaluate(jobIf('voice-provider'))).toBe(privateDeploy);
    expect(evaluate(jobIf('production'))).toBe(publicDeploy);
  });
});
