/** Authenticated account audio. The server owns reuse, render identity and charging;
 * this page keeps only the admitted reading in memory for its current session. */
import { VOICE_PACK_SCHEMA, normalizeVoiceText } from './voice-pack-key.js';
import { fetchPlusStatus, plusAudioSession } from '../app/plus.js';

export const PLUS_VOICE_ROUTE = '/api/plus/voice';

/** The spoken phrases of a compiled session, as the Worker and the Voice both key them. */
export function spokenAtoms(atoms) {
  return (Array.isArray(atoms) ? atoms : [])
    .map(atom => normalizeVoiceText(atom))
    .filter(text => /[\p{L}\p{N}]/u.test(text));
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
function playable({ pack, audio }, signal) {
  const voiceId = Object.keys(pack.voices)[0];
  const assets = new Set(Object.values(pack.voices[voiceId].entries ?? {}).map(entry => entry.asset));
  const fetchImpl = async asset => (signal.aborted ? new Response(null, { status: 401 }) : assets.has(asset)
    ? new Response(audio, { status: 200, headers: { 'Content-Type': 'audio/mpeg' } })
    : new Response(null, { status: 404 }));
  return { ok: true, voiceId, manifest: pack, fetchImpl, signal };
}

/**
 * @returns {Promise<{ ok: true, voiceId: string, manifest: object, fetchImpl: Function,
 *   allowance?: { used: number, limit: number, periodEnd: number } | null }
 *   | { ok: false, code: string, message: string }>}
 *   `manifest` and `fetchImpl` are what the Voice is built with. `allowance`
 *   comes from the authenticated Worker response.
 */
export async function voiceReading(atoms, { voice = 'default', fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  const signal = plusAudioSession();
  const changed = () => ({ ok: false, code: 'PLUS_SESSION_CHANGED', message: 'Your voice session changed. Open this reading again to check access.' });
  const spoken = spokenAtoms(atoms);
  if (!spoken.length) return { ok: false, code: 'NOTHING_TO_SAY', message: 'There is nothing to read aloud.' };

  let response;
  try {
    response = await fetchImpl(PLUS_VOICE_ROUTE, {
      method: 'POST', credentials: 'same-origin', cache: 'no-store', signal,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ atoms: spoken, voice })
    });
  } catch {
    if (signal.aborted) return changed();
    return { ok: false, code: 'OFFLINE', message: 'The voice could not be reached.' };
  }
  let body = null;
  try {
    body = await response.json();
  } catch {
    body = null;
  }
  if (signal.aborted) return changed();
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
  // HttpOnly credentials can change in another tab while rendering. Recheck
  // their opaque owner scope before admitting these private bytes to playback.
  const status = await fetchPlusStatus({ fetchImpl });
  if (signal.aborted) return changed();
  if (!status.audioScope || !/^[a-f0-9]{64}$/u.test(body?.cache?.scope ?? '')) {
    return { ok: false, code: 'PLUS_AUDIO_AUTH', message: 'Could not confirm access to saved audio. Sign in and try again; saved audio will not be voiced or charged again.' };
  }
  if (status.audioScope !== body.cache.scope) return changed();
  return { ...playable({ pack, audio }, signal), allowance: body.allowance ?? null };
}
