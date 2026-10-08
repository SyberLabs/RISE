/**
 * The Plus voice for a reading of the reader's own: the Worker voices it on
 * the lab's key (worker/plus.mjs) and answers with the pack and its audio,
 * keeping no copy. The voicing is kept here in the reader's browser
 * (plus-voice-store.js), so the same text voiced again on this device makes
 * no request at all. The reader's cookie rides on the same-origin request.
 */
import { VOICE_PACK_SCHEMA, normalizeVoiceText } from './voice-pack-key.js';
import { PlusVoices } from './plus-voice-store.js';

export const PLUS_VOICE_ROUTE = '/api/plus/voice';

/** The spoken phrases of a compiled session, as the Worker and the Voice both key them. */
export function spokenAtoms(atoms) {
  return (Array.isArray(atoms) ? atoms : [])
    .map(atom => normalizeVoiceText(atom))
    .filter(text => /[\p{L}\p{N}]/u.test(text));
}

/**
 * The store's key for a text in a voice: SHA-256 hex of the reader's chosen
 * voice slug and exactly what the Worker voices (the phrases joined by one
 * space). Another voice is another key, so switching voices voices the text
 * again rather than replaying the other voice. The model is the Worker's and
 * is not known before it answers; the version prefix stands for it.
 */
export async function voicingKey(spoken, voice = 'default') {
  const bytes = new TextEncoder().encode(`rise.plus-voice.v1\n${voice}\n${spoken.join(' ')}`);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
}

function bytesFromBase64(base64) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index++) bytes[index] = binary.charCodeAt(index);
  return bytes.buffer;
}

/**
 * A kept voicing as the Voice consumes it. The audio is served through the
 * Voice's fetch hook, not a blob: URL, which the CSP does not let fetch reach;
 * only the pack's own asset is answered.
 */
function playable({ pack, audio }) {
  const voiceId = Object.keys(pack.voices)[0];
  const assets = new Set(Object.values(pack.voices[voiceId].entries ?? {}).map(entry => entry.asset));
  const fetchImpl = async asset => (assets.has(asset)
    ? new Response(audio, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
    : new Response(null, { status: 404 }));
  return { ok: true, voiceId, manifest: pack, fetchImpl };
}

/**
 * @returns {Promise<{ ok: true, voiceId: string, manifest: object, fetchImpl: Function,
 *   allowance?: { used: number, limit: number, periodEnd: number } | null }
 *   | { ok: false, code: string, message: string }>}
 *   `manifest` and `fetchImpl` are what the Voice is built with. `allowance`
 *   is present only when the Worker was asked.
 */
export async function voiceReading(atoms, { voice = 'default', fetchImpl = globalThis.fetch?.bind(globalThis), store = PlusVoices } = {}) {
  const spoken = spokenAtoms(atoms);
  if (!spoken.length) return { ok: false, code: 'NOTHING_TO_SAY', message: 'There is nothing to read aloud.' };
  const key = await voicingKey(spoken, voice);
  const kept = await store.get(key).catch(() => null);
  if (kept) return playable(kept);

  let response;
  try {
    response = await fetchImpl(PLUS_VOICE_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atoms: spoken, voice })
    });
  } catch {
    return { ok: false, code: 'OFFLINE', message: 'The voice could not be reached.' };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (!response.ok) {
    return { ok: false, code: body?.error?.code ?? 'UPSTREAM', message: body?.error?.message ?? 'The voice could not be rendered.' };
  }
  const pack = body?.pack;
  let audio = null;
  try {
    audio = typeof body?.audio === 'string' ? bytesFromBase64(body.audio) : null;
  } catch {
    audio = null;
  }
  if (pack?.schema !== VOICE_PACK_SCHEMA || !Object.keys(pack.voices ?? {}).length || !audio?.byteLength) {
    return { ok: false, code: 'BAD_PACK', message: 'The voice answered with something that is not a pack.' };
  }
  // A store that cannot keep it (private mode, full disk) still plays it this once.
  await store.put(key, { pack, audio }).catch(() => {});
  return { ...playable({ pack, audio }), allowance: body.allowance ?? null };
}
