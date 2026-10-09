import { voices, VOICE_MAX_CHARS } from './plus.mjs';

/** The private capability accepts data only, never a URL, key, model selection or arbitrary voice. */
export async function renderVoice(input, env) {
  const allowed = voices(env);
  if (!env.ELEVENLABS_API_KEY || !allowed) return new Response(null, { status: 503 });
  if (!input || typeof input.text !== 'string' || !/[\p{L}\p{N}]/u.test(input.text)
    || input.text.length > VOICE_MAX_CHARS || input.model !== 'eleven_flash_v2_5'
    || typeof input.voiceId !== 'string' || ![...allowed.values()].some(voice => voice.id === input.voiceId)) {
    return new Response(null, { status: 400 });
  }
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.voiceId)}/with-timestamps?output_format=mp3_44100_64`, {
    method: 'POST', redirect: 'manual',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: input.text, model_id: 'eleven_flash_v2_5' })
  });
  return new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } });
}
