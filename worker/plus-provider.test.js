import { afterEach, expect, it, vi } from 'vitest';
import { renderVoice } from './plus-provider.mjs';
const env = { ELEVENLABS_API_KEY: 'private-key', PLUS_VOICE_ID: 'default-id', PLUS_VOICES: [{ slug: 'default', label: 'Default' }, { slug: 'george', label: 'George', id: 'george-id' }] };
const input = { text: 'Hello world', voiceId: 'default-id', model: 'eleven_flash_v2_5' };
afterEach(() => vi.unstubAllGlobals());
it('calls only the fixed timestamp endpoint with its own private key and approved model/voice', async () => {
  const vendor = vi.fn(async () => new Response(JSON.stringify({ audio_base64: 'mp3', alignment: {} })));
  vi.stubGlobal('fetch', vendor);
  const response = await renderVoice(input, env);
  expect(response.status).toBe(200);
  expect(vendor).toHaveBeenCalledOnce();
  const [url, init] = vendor.mock.calls[0];
  expect(url).toBe('https://api.elevenlabs.io/v1/text-to-speech/default-id/with-timestamps?output_format=mp3_44100_64');
  expect(init.headers['xi-api-key']).toBe('private-key');
  expect(JSON.parse(init.body)).toEqual({ text: 'Hello world', model_id: 'eleven_flash_v2_5' });
});
it.each([null, {}, { ...input, text: '' }, { ...input, text: 'x'.repeat(10001) }, { ...input, voiceId: 'unapproved' }, { ...input, model: 'eleven_multilingual_v2' }, { ...input, text: 12 }])('refuses malformed, oversized, unknown voice or expensive model before contacting provider: %j', async bad => {
  const vendor = vi.fn(); vi.stubGlobal('fetch', vendor);
  expect((await renderVoice(bad, env)).status).toBe(400);
  expect(vendor).not.toHaveBeenCalled();
});
it('fails closed when the provider key or allow-list is missing', async () => {
  const vendor = vi.fn(); vi.stubGlobal('fetch', vendor);
  expect((await renderVoice(input, { ...env, ELEVENLABS_API_KEY: undefined })).status).toBe(503);
  expect((await renderVoice(input, { ...env, PLUS_VOICES: [] })).status).toBe(503);
  expect(vendor).not.toHaveBeenCalled();
});
