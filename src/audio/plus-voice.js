/**
 * The Plus voice for a reading of the reader's own: the Worker voices it once
 * on the lab's key (worker/plus.mjs) and answers with a pack the Chamber plays
 * like any recitation. The reader's cookie rides on the same-origin request.
 */
import { normalizeVoiceText } from './voice-pack-key.js';

export const PLUS_VOICE_ROUTE = '/api/plus/voice';

/** The spoken phrases of a compiled session, as the Worker and the Voice both key them. */
export function spokenAtoms(atoms) {
  return (Array.isArray(atoms) ? atoms : [])
    .map(atom => normalizeVoiceText(atom))
    .filter(text => /[\p{L}\p{N}]/u.test(text));
}

/**
 * @returns {{ ok: true, voiceId: string, pack: string } | { ok: false, code: string, message: string }}
 *   `pack` is the pack's own URL, which the session carries as `recitation.pack`.
 */
export async function voiceReading(atoms, { fetchImpl = globalThis.fetch?.bind(globalThis) } = {}) {
  const spoken = spokenAtoms(atoms);
  if (!spoken.length) return { ok: false, code: 'NOTHING_TO_SAY', message: 'There is nothing to read aloud.' };
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
  const voiceId = Object.keys(body?.voices ?? {})[0];
  const hash = body?.voiced?.hash;
  if (!voiceId || typeof hash !== 'string') return { ok: false, code: 'BAD_PACK', message: 'The voice answered with something that is not a pack.' };
  return { ok: true, voiceId, pack: `/api/plus/audio/voiced/${hash}/pack.json` };
}
