import { afterEach, expect, it, vi } from 'vitest';
import { renderVoice, providerReadiness } from './plus-provider.mjs';
const env = { ELEVENLABS_API_KEY: 'private-key', PLUS_VOICE_ID: 'default-id', PLUS_VOICES: [{ slug: 'default', label: 'Default' }, { slug: 'george', label: 'George', id: 'george-id' }] };
const input = { text: 'Hello world', voiceId: 'default-id', model: 'eleven_flash_v2_5' };
afterEach(() => vi.unstubAllGlobals());
it('calls only the fixed timestamp endpoint with its own private key and approved model/voice', async () => {
  const vendor = vi.fn(async () => new Response(JSON.stringify({ audio_base64: 'mp3', alignment: {} })));
  vi.stubGlobal('fetch', vendor);
  const response = await renderVoice(input, env);
  expect(response.contacted).toBe(true);
  expect(response.response.status).toBe(200);
  expect(vendor).toHaveBeenCalledOnce();
  const [url, init] = vendor.mock.calls[0];
  expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/default-id/with-timestamps?output_format=mp3_44100_64');
  expect(init.headers['xi-api-key']).toBe('private-key');
  expect(JSON.parse(init.body)).toEqual({ text: 'Hello world', model_id: 'eleven_flash_v2_5' });
});
it.each([null, {}, { ...input, text: '' }, { ...input, text: 'x'.repeat(10001) }, { ...input, voiceId: 'unapproved' }, { ...input, model: 'eleven_multilingual_v2' }, { ...input, text: 12 }])('refuses malformed, oversized, unknown voice or expensive model before contacting provider: %j', async bad => {
  const vendor = vi.fn(); vi.stubGlobal('fetch', vendor);
  expect(await renderVoice(bad, env)).toEqual({ contacted: false, status: 400 });
  expect(vendor).not.toHaveBeenCalled();
});
it('fails closed when the provider key or allow-list is missing', async () => {
  const vendor = vi.fn(); vi.stubGlobal('fetch', vendor);
  expect(await renderVoice(input, { ...env, ELEVENLABS_API_KEY: undefined })).toEqual({ contacted: false, status: 503 });
  expect(await renderVoice(input, { ...env, PLUS_VOICES: [] })).toEqual({ contacted: false, status: 503 });
  expect(vendor).not.toHaveBeenCalled();
});

it.each([{ ELEVENLABS_API_KEY: undefined }, { ELEVENLABS_API_KEY: '' }, { PLUS_VOICE_ID: 'mismatch' }, { PLUS_VOICES: [] }, { PLUS_VOICE_MODEL: 'eleven_multilingual_v2' }])('readiness refuses missing key or mismatched server configuration without vendor contact: %j', override => {
  const vendor = vi.fn(); vi.stubGlobal('fetch', vendor);
  expect(providerReadiness({ voiceIds: ['default-id', 'george-id'], model: 'eleven_flash_v2_5' }, { ...env, ...override })).toEqual({ ready: false });
  expect(vendor).not.toHaveBeenCalled();
});
it('readiness checks every production allowed voice and model without billing', () => {
  const vendor = vi.fn(); vi.stubGlobal('fetch', vendor);
  expect(providerReadiness({ voiceIds: ['default-id', 'george-id'], model: 'eleven_flash_v2_5' }, env)).toEqual({ ready: true });
  expect(providerReadiness({ voiceIds: ['default-id', 'unknown'], model: 'eleven_flash_v2_5' }, env)).toEqual({ ready: false });
  expect(providerReadiness({ voiceIds: ['default-id'], model: 'expensive' }, env)).toEqual({ ready: false });
  expect(vendor).not.toHaveBeenCalled();
});
it('never forwards a vendor no-contact marker as its own preflight decision', async () => {
  vi.stubGlobal('fetch', async () => new Response(null, { status: 503, headers: { 'X-Provider-Contacted': 'false' } }));
  const result = await renderVoice(input, env);
  expect(result.contacted).toBe(true); expect(result.response.status).toBe(503);
  expect(result.response.headers.get('X-Provider-Contacted')).toBeNull();
});

it.each([{ ELEVENLABS_API_KEY: undefined }, { PLUS_VOICE_ID: 'new-default' }, { PLUS_VOICE_MODEL: 'eleven_multilingual_v2' }])('render rechecks changed provider configuration after a successful readiness response: %j', change => {
  const vendor = vi.fn(); vi.stubGlobal('fetch', vendor);
  const current = { ...env };
  expect(providerReadiness({ voiceIds: ['default-id', 'george-id'], model: input.model }, current)).toEqual({ ready: true });
  Object.assign(current, change);
  return renderVoice(input, current).then(outcome => {
    expect(outcome.contacted).toBe(false); expect([400, 503]).toContain(outcome.status);
    expect(vendor).not.toHaveBeenCalled();
  });
});
