// @vitest-environment node
import { afterAll, beforeAll, expect, it, vi } from 'vitest';
import { build } from 'esbuild';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { PLUS_INTERNALS } from './plus.mjs';
import { spendingPolicy } from './plus-budget.mjs';

let runtime, script, directory;
let vendorAudio = '', vendorCalls = 0;
async function start() {
  runtime = new Miniflare(convertV4MiniflareOptions({
    resourcePersistencePath: directory,
    workers: [{ name: 'audio-test', modules: true, script, compatibilityDate: '2026-09-26',
      bindings: { STRIPE_SECRET_KEY: 'sk_test_runtime', PLUS_COOKIE_SECRET: 'runtime-test-secret', PLUS_PRICE_ID: 'price_test', PLUS_VOICE_ID: 'voice-test', PLUS_VOICES: [{ slug: 'default', label: 'Default' }], PLUS_DAILY_CHAR_CAP: '1000000' },
      serviceBindings: { VENDOR: async request => {
        vendorCalls++;
        const { text } = await request.json();
        const characters = [...text];
        const starts = characters.map((_, i) => i * 0.06);
        return Response.json({ audio_base64: vendorAudio, alignment: { characters, character_start_times_seconds: starts, character_end_times_seconds: starts.map(t => t + 0.06) } });
      } },
      durableObjects: { PLUS_METER: { className: 'PlusMeter', useSQLite: true } } }]
  }));
  await runtime.ready;
}
async function call(owner, op, body = {}) {
  const namespace = await runtime.getDurableObjectNamespace('PLUS_METER', 'audio-test');
  const response = await namespace.get(namespace.idFromName(owner)).fetch(`https://meter/audio/${op}`, { method: 'POST', body: JSON.stringify(body) });
  expect(response.status).toBe(200);
  return response.json();
}
beforeAll(async () => {
  // Exercise a constrained V8 heap; external ArrayBuffer memory is separate.
  vi.stubEnv('MINIFLARE_WORKERD_V8_FLAGS', '--max-old-space-size=64 --max-semi-space-size=4');
  directory = await mkdtemp(join(tmpdir(), 'rise-audio-runtime-'));
  const bundle = await build({ stdin: { contents: `
    export { PlusMeter } from './worker/plus.mjs';
    import { handlePlus } from './worker/plus.mjs';
    export default { fetch(request, env) {
      env.DECISION_LIMITER = { limit: async () => ({ success: true }) };
      env.PLUS_VOICE_PROVIDER = {
        ready: async () => ({ ready: true }),
        render: async input => ({ contacted: true, response: await env.VENDOR.fetch('https://vendor/render', { method: 'POST', body: JSON.stringify(input) }) })
      };
      return handlePlus(request, env);
    } };`, resolveDir: process.cwd() }, bundle: true, format: 'esm', write: false, external: ['cloudflare:workers'] });
  script = bundle.outputFiles[0].text;
  await start();
}, 20000);
afterAll(async () => { await runtime?.dispose(); if (directory) await rm(directory, { recursive: true, force: true }); vi.unstubAllEnvs(); });

it('SQLite stores binary chunks and timings across runtime restart, without leaking between owners', async () => {
  const render = 'a'.repeat(64);
  const requests = await Promise.all(Array.from({ length: 8 }, () => call('owner-a', 'claim', { render })));
  expect(requests.filter(r => r.state === 'claimed')).toHaveLength(1);
  expect(requests.filter(r => r.state === 'pending')).toHaveLength(7);
  const token = requests.find(r => r.state === 'claimed').token;
  const audio = Buffer.alloc(150_000, 123).toString('base64');
  const timings = [0, 0.2, 0.2, 0.4];
  expect((await call('owner-a', 'complete', { render, token, audio, timings })).state).toBe('ready');
  await runtime.dispose();
  await start();
  const replay = await call('owner-a', 'claim', { render });
  expect(replay.state).toBe('ready');
  expect(replay.audio === audio).toBe(true);
  expect(replay.timings).toEqual(timings);
  expect((await call('owner-b', 'claim', { render })).state).toBe('claimed');
  await call('owner-a', 'erase');
  expect((await call('owner-a', 'claim', { render })).state).toBe('unavailable');
}, 20000);

it('SQLite deletion fences in-flight writes and retains the no-repeat safety record after restart', async () => {
  const render = 'b'.repeat(64);
  const claim = await call('owner-c', 'claim', { render });
  await call('owner-c', 'erase');
  expect((await call('owner-c', 'complete', { render, token: claim.token, audio: 'YWJj', timings: [0, 1] })).state).toBe('unavailable');
  await runtime.dispose();
  await start();
  expect((await call('owner-c', 'claim', { render })).state).toBe('unavailable');
}, 20000);

// This is deliberately large enough to overflow the former grouped base64 regexp.
it('persists and replays multi-megabyte audio through real SQLite storage', async () => {
  const render = 'c'.repeat(64);
  const { token } = await call('owner-large', 'claim', { render });
  const audio = Buffer.alloc(6 * 1024 * 1024, 123).toString('base64');
  expect((await call('owner-large', 'complete', { render, token, audio, timings: [0, 1] })).state).toBe('ready');
  await runtime.dispose();
  await start();
  const replay = await call('owner-large', 'claim', { render });
  expect(replay.state).toBe('ready');
  expect(replay.audio === audio).toBe(true);
  expect(replay.timings).toEqual([0, 1]);
}, 30000);

it('renders, persists and replays the maximum audio/timing payload through the full Worker route on a bounded V8 heap', async () => {
  const now = Math.floor(Date.now() / 1000);
  const standing = { c: 'cus_runtime', s: 'sub_runtime', l: false, iat: now, start: now - 60, exp: now + 3600, budgetMicros: 10_000_000, budgetPolicy: JSON.stringify(spendingPolicy({})) };
  const cookie = `${PLUS_INTERNALS.COOKIE}=${await PLUS_INTERNALS.sign(standing, 'runtime-test-secret')}`;
  const namespace = await runtime.getDurableObjectNamespace('PLUS_METER', 'audio-test');
  const meter = namespace.get(namespace.idFromName('sub:sub_runtime'));
  await meter.fetch('https://meter/standing', { method: 'POST', body: JSON.stringify({ standing, revision: 0 }) });
  const page = { fetch: (...args) => runtime.dispatchFetch(...args) };
  const status = await (await page.fetch('https://rise.test/api/plus/status', { headers: { Cookie: cookie } })).json();
  expect(status).toMatchObject({ subscriber: true });
  // Maximum input text gives 20,000 timing doubles; audio fills the rest of 16 MiB.
  const text = 'a'.repeat(10_000);
  vendorAudio = Buffer.alloc(16 * 1024 * 1024 - text.length * 16, 123).toString('base64');
  const before = vendorCalls;
  const send = () => page.fetch('https://rise.test/api/plus/voice', { method: 'POST', headers: { Cookie: cookie, Origin: 'https://rise.test', 'Content-Type': 'application/json' }, body: JSON.stringify({ atoms: [text], audioScope: status.audioScope }) });
  const rendered = await send();
  expect(rendered.status, rendered.status === 200 ? undefined : await rendered.clone().text()).toBe(200);
  const first = await rendered.json();
  expect(first.cache.hit).toBe(false);
  expect(first.audio === vendorAudio).toBe(true);
  expect(first.allowance.used).toBe(text.length);
  const replay = await send();
  expect(replay.status).toBe(200);
  const second = await replay.json();
  expect(second.cache.hit).toBe(true);
  expect(second.audio === vendorAudio).toBe(true);
  expect(second.pack).toEqual(first.pack);
  expect(second.allowance.used).toBe(text.length);
  expect(vendorCalls - before).toBe(1);
}, 30000);
