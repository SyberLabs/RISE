// @vitest-environment node
import { afterAll, beforeAll, expect, it } from 'vitest';
import { build } from 'esbuild';
import { Miniflare, convertV4MiniflareOptions } from 'miniflare';
import { PLUS_INTERNALS } from './plus.mjs';
let runtime, caller, preview;
const calls = [];
const input = { text: 'Hello world', voiceId: 'default-id', model: 'eleven_flash_v2_5' };
beforeAll(async () => {
  const bundle = await build({ entryPoints: ['worker/plus-preview.mjs'], bundle: true, format: 'esm', write: false, external: ['cloudflare:workers'] });
  runtime = new Miniflare(convertV4MiniflareOptions({ workers: [
    { name: 'caller', compatibilityDate: '2026-09-26', modules: true, script: `export default { async fetch(request, env) { if (new URL(request.url).pathname === '/fetch') return env.PROVIDER.fetch(request); const input = await request.json(); if (new URL(request.url).pathname === '/ready-no-key') return Response.json(await env.UNREADY.ready(input)); if (new URL(request.url).pathname === '/ready') return Response.json(await env.PROVIDER.ready(input)); const result = await env.PROVIDER.render(input); return result.contacted === true ? result.response : Response.json(result, { status: result.status }); } }`, serviceBindings: { PROVIDER: { name: 'provider', entrypoint: 'VoiceProvider' }, UNREADY: { name: 'unready-provider', entrypoint: 'VoiceProvider' } } },
    { name: 'provider', compatibilityDate: '2026-09-26', modules: true, script: bundle.outputFiles[0].text,
      bindings: { ELEVENLABS_API_KEY: 'private-key', PLUS_VOICE_ID: 'default-id', PLUS_VOICES: [{ slug: 'default', label: 'Default' }], STRIPE_SECRET_KEY: 'sk_test_fixture', PLUS_COOKIE_SECRET: 'test-cookie-key', PLUS_PRICE_ID: 'price_test', PLUS_DAILY_CHAR_CAP: '20000' },
      serviceBindings: { ASSETS: () => new Response(null, { status: 404 }) },
      outboundService: async request => { calls.push({ url: request.url, body: await request.json(), hasOwnKey: request.headers.get('xi-api-key') === 'private-key' }); return new Response(JSON.stringify({ audio_base64: 'audio', alignment: { characters: ['H'] } })); }
    },
    { name: 'unready-provider', compatibilityDate: '2026-09-26', modules: true, script: bundle.outputFiles[0].text, bindings: { PLUS_VOICE_ID: 'default-id', PLUS_VOICES: [{ slug: 'default', label: 'Default' }] }, outboundService: async () => { calls.push({ unexpected: true }); return new Response(null, { status: 500 }); } }
  ] }));
  caller = await runtime.getWorker('caller'); preview = await runtime.getWorker('provider');
}, 20000);
afterAll(async () => { await runtime?.dispose(); });
it('actual named service RPC renders once with bounded data; provider key never crosses response', async () => {
  const before = calls.length;
  const response = await caller.fetch('https://caller/render', { method: 'POST', body: JSON.stringify(input) });
  expect(response.status).toBe(200);
  expect(await response.json()).toEqual({ audio_base64: 'audio', alignment: { characters: ['H'] } });
  expect(calls.length).toBe(before + 1);
  expect(calls.at(-1)).toEqual({ url: 'https://api.elevenlabs.io/v1/text-to-speech/default-id/with-timestamps?output_format=mp3_44100_64', body: { text: 'Hello world', model_id: 'eleven_flash_v2_5' }, hasOwnKey: true });
});
it('malformed private RPC input makes no provider request', async () => {
  const before = calls.length;
  for (const bad of [{ ...input, model: 'eleven_multilingual_v2' }, { ...input, voiceId: 'unknown' }, { ...input, text: 'x'.repeat(10001) }, null]) {
    expect((await caller.fetch('https://caller/render', { method: 'POST', body: JSON.stringify(bad) })).status).toBe(400);
  }
  expect(calls.length).toBe(before);
});
it('public preview voice stays refused even with a valid test subscription cookie; guessed RPC URLs do not dispatch', async () => {
  const before = calls.length;
  const now = Math.floor(Date.now() / 1000);
  const cookie = await PLUS_INTERNALS.sign({ c: 'cus_test', s: 'sub_test', iat: now, exp: now + 3600, l: false }, 'test-cookie-key');
  const voice = await preview.fetch('https://preview/api/plus/voice', { method: 'POST', headers: { Cookie: `${PLUS_INTERNALS.COOKIE}=${cookie}`, Origin: 'https://preview' }, body: JSON.stringify({ atoms: ['Hello world'] }) });
  expect(voice.status).toBe(403);
  for (const path of ['/VoiceProvider/render', '/render', '/api/plus/VoiceProvider/render', '/?method=render&entrypoint=VoiceProvider']) {
    expect((await preview.fetch(`https://preview${path}`, { method: 'POST', body: JSON.stringify(input), headers: { 'X-Worker-Entrypoint': 'VoiceProvider' } })).status).toBe(404);
  }
  expect(calls.length).toBe(before);
});

it('named provider HTTP fetch refuses without contacting vendor', async () => {
  const before = calls.length;
  expect((await caller.fetch('https://caller/fetch')).status).toBe(403);
  expect(calls.length).toBe(before);
});

it('actual named readiness RPC checks all voices and default configuration without vendor contact', async () => {
  const before = calls.length;
  for (const [voiceIds, ready] of [[['default-id'], true], [['mismatched-default'], false], [['default-id', 'unknown'], false]]) {
    const response = await caller.fetch('https://caller/ready', { method: 'POST', body: JSON.stringify({ voiceIds, model: 'eleven_flash_v2_5' }) });
    expect(await response.json()).toEqual({ ready });
  }
  expect(calls.length).toBe(before);
});

it('actual named readiness reports an unloaded provider key without any external request', async () => {
  const before = calls.length;
  const response = await caller.fetch('https://caller/ready-no-key', { method: 'POST', body: JSON.stringify({ voiceIds: ['default-id'], model: 'eleven_flash_v2_5' }) });
  expect(await response.json()).toEqual({ ready: false });
  expect(calls.length).toBe(before);
});
