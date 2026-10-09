import { voices, VOICE_MAX_CHARS } from './plus.mjs';

const MODEL = 'eleven_flash_v2_5';
const configured = env => typeof env.ELEVENLABS_API_KEY === 'string' && Boolean(env.ELEVENLABS_API_KEY.trim())
  && typeof env.PLUS_VOICE_ID === 'string' && Boolean(env.PLUS_VOICE_ID.trim()) && Boolean(voices(env)) && (env.PLUS_VOICE_MODEL || MODEL) === MODEL;

/** Nonbillable configuration check. Never contacts the vendor or claims the key is still valid. */
export function providerReadiness(input, env) {
  const allowed = voices(env);
  const ready = configured(env) && input?.model === MODEL && Array.isArray(input.voiceIds)
    && input.voiceIds.length > 0 && input.voiceIds.length <= 32
    && input.voiceIds.every(id => typeof id === 'string' && [...allowed.values()].some(voice => voice.id === id));
  return { ready: Boolean(ready) };
}

/** Only this trusted broker can assert that no billable vendor request was sent. */
export async function renderVoice(input, env) {
  if (!configured(env)) return { contacted: false, status: 503 };
  if (!input || typeof input.text !== 'string' || !/[\p{L}\p{N}]/u.test(input.text)
    || input.text.length > VOICE_MAX_CHARS || !providerReadiness({ voiceIds: [input.voiceId], model: input.model }, env).ready) {
    return { contacted: false, status: 400 };
  }
  // From this boundary onwards every missing/failed answer is potentially billed.
  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${encodeURIComponent(input.voiceId)}/with-timestamps?output_format=mp3_44100_64`, {
    method: 'POST', redirect: 'manual',
    headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: input.text, model_id: MODEL })
  });
  return { contacted: true, response: new Response(response.body, { status: response.status, headers: { 'Content-Type': 'application/json' } }) };
}
