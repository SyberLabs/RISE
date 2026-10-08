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
 * The store's key for a text: SHA-256 hex of exactly what the Worker voices
 * (the phrases joined by one space). The voice, model and slug are the
 * Worker's and are not known before it answers, so a version prefix stands
 * for them; a new voice is a new prefix.
 */
export async function voicingKey(spoken) {
  const bytes = new TextEncoder().encode(`rise.plus-voice.v1\n${spoken.join(' ')}`);
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
export async function voiceReading(atoms, { fetchImpl = globalThis.fetch?.bind(globalThis), store = PlusVoices } = {}) {
  const spoken = spokenAtoms(atoms);
  if (!spoken.length) return { ok: false, code: 'NOTHING_TO_SAY', message: 'There is nothing to read aloud.' };
  const key = await voicingKey(spoken);
  const kept = await store.get(key).catch(() => null);
  if (kept) return playable(kept);

  let response;
  try {
    response = await fetchImpl(PLUS_VOICE_ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atoms: spoken })
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
