import { DEFAULT_OPENAI_MODEL, OPENAI_MODELS, REALTIME_INSTRUCTIONS } from '../src/live/adapters/openai-instructions.js';

/**
 * Open one OpenAI Realtime session for a reader, with the reader's own key.
 *
 * This is the only server involvement in a live Current, and it is narrow on
 * purpose. RISE funds no inference: the key is the reader's, typed into the
 * page, held in page memory, and sent here once per session over the same
 * origin. This route uses it for one request to OpenAI and forgets it: it is not
 * stored, not logged, not put in a URL, not returned, and not echoed in an
 * error. The browser then talks to OpenAI directly over WebRTC, so this route
 * relays one SDP offer and one SDP answer and never sees what is said.
 *
 * What the model is told is fixed here (src/live/adapters/openai-instructions.js)
 * and applied on this side, so a page cannot change it. The route is off unless
 * LIVE_REALTIME_ENABLED is 'true', and is limited per address.
 *
 * NOT VERIFIED AGAINST THE LIVE SERVICE: the upstream request follows OpenAI's
 * documented unified Realtime interface (an SDP offer and a session, as
 * multipart, to /v1/realtime/calls), written without a key to try it with.
 */

const UPSTREAM = 'https://api.openai.com/v1/realtime/calls';
const KEY = /^Bearer (sk-[A-Za-z0-9_-]{20,300})$/u;
const MAX_SDP_BYTES = 32_768;
const SDP_LINE = /^[\x20-\x7E]{0,1000}$/u;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function failure(status, code, message) {
  return new Response(JSON.stringify({ error: { code, message } }), { status, headers: JSON_HEADERS });
}

/** Whether a string is a session description a browser would send: SDP lines, printable, bounded. */
export function validSdp(text) {
  if (typeof text !== 'string' || text.length === 0 || text.length > MAX_SDP_BYTES) return false;
  if (!text.startsWith('v=0')) return false;
  const lines = text.split(/\r?\n/u);
  if (lines.length > 400) return false;
  return lines.every(line => SDP_LINE.test(line)) && lines.some(line => line.startsWith('m='));
}

async function readText(message, limit) {
  const reader = message.body?.getReader();
  if (!reader) throw new Error('body');
  const chunks = [];
  let bytes = 0;
  try {
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > limit) throw new Error('size');
      chunks.push(value);
    }
  } finally {
    void reader.cancel().catch(() => {});
  }
  const data = new Uint8Array(bytes);
  let offset = 0;
  for (const chunk of chunks) { data.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder('utf-8', { fatal: true }).decode(data);
}

export async function handleLiveRealtime(request, env) {
  if (env?.LIVE_REALTIME_ENABLED !== 'true') {
    return failure(503, 'LIVE_UNAVAILABLE', 'Live answers are not switched on for this site.');
  }
  if (request.method !== 'POST') return failure(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return failure(403, 'ORIGIN_DENIED', 'Same-origin requests are required.');
  }
  if (request.headers.get('Content-Type')?.split(';')[0].trim().toLowerCase() !== 'application/sdp') {
    return failure(415, 'SDP_REQUIRED', 'Send a session description.');
  }
  const key = KEY.exec(request.headers.get('Authorization') ?? '')?.[1];
  if (!key) return failure(401, 'KEY_REQUIRED', 'Your OpenAI key is needed to start a live answer.');

  const asked = new URL(request.url).searchParams.get('model');
  const model = asked === null ? DEFAULT_OPENAI_MODEL : asked;
  if (!OPENAI_MODELS.includes(model)) return failure(400, 'MODEL_NOT_OFFERED', 'That model is not offered.');

  const ip = request.headers.get('CF-Connecting-IP')?.trim();
  if (!ip || typeof env?.DECISION_LIMITER?.limit !== 'function') {
    return failure(503, 'LIVE_UNAVAILABLE', 'Live answers are not available.');
  }
  try {
    const result = await env.DECISION_LIMITER.limit({ key: `live:${ip}` });
    if (!result?.success) return failure(429, 'RATE_LIMITED', 'Too many live answers were started. Try again in a minute.');
  } catch {
    return failure(503, 'LIVE_UNAVAILABLE', 'Live answers are not available.');
  }

  let offer;
  try {
    offer = await readText(request, MAX_SDP_BYTES);
  } catch (error) {
    return failure(error?.message === 'size' ? 413 : 400, 'INVALID_REQUEST', 'The session description is invalid.');
  }
  if (!validSdp(offer)) return failure(400, 'INVALID_REQUEST', 'The session description is invalid.');

  const form = new FormData();
  form.set('sdp', new Blob([offer], { type: 'application/sdp' }));
  form.set('session', new Blob([JSON.stringify({
    type: 'realtime',
    model,
    instructions: REALTIME_INSTRUCTIONS,
    output_modalities: ['text']
  })], { type: 'application/json' }));

  let upstream;
  try {
    upstream = await fetch(UPSTREAM, {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}` },
      body: form,
      redirect: 'manual',
      signal: AbortSignal.timeout(15_000)
    });
  } catch (error) {
    const slow = error?.name === 'TimeoutError' || error?.name === 'AbortError';
    return failure(slow ? 504 : 502, slow ? 'PROVIDER_TIMEOUT' : 'PROVIDER_FAILED', 'OpenAI could not be reached.');
  }

  // What OpenAI says about a failure is never passed on: it can carry the key.
  if (!upstream.ok) {
    void upstream.body?.cancel().catch(() => {});
    if (upstream.status === 401 || upstream.status === 403) return failure(401, 'KEY_REFUSED', 'OpenAI refused the key.');
    if (upstream.status === 429) return failure(429, 'PROVIDER_RATE_LIMITED', 'OpenAI is limiting this key. Try again shortly.');
    if (upstream.status === 400 || upstream.status === 404 || upstream.status === 422) {
      return failure(502, 'PROVIDER_REJECTED', 'OpenAI did not accept the request.');
    }
    return failure(502, 'PROVIDER_FAILED', 'OpenAI could not start the session.');
  }
  let answer;
  try {
    answer = await readText(upstream, MAX_SDP_BYTES);
  } catch {
    return failure(502, 'PROVIDER_FAILED', 'OpenAI could not start the session.');
  }
  if (!validSdp(answer)) return failure(502, 'PROVIDER_FAILED', 'OpenAI could not start the session.');
  return new Response(answer, {
    status: 200,
    headers: { 'Content-Type': 'application/sdp', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }
  });
}
