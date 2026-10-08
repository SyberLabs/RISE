/**
 * Plus: the paid voice, gated by a Stripe receipt (MasterMind RFC 0001, section 2).
 * The Worker keeps no reader text and no audio. A reader who paid holds one signed,
 * HttpOnly cookie naming their subscription; the allowance lives on the server, in
 * one Durable Object per subscription (PlusMeter below), and Stripe is asked again
 * before every voicing.
 *
 *   POST /api/plus/claim   { session_id }   the Checkout success page; 204 and the cookie once Stripe confirms
 *   POST /api/plus/voice   { atoms }        voices one short reading on the lab's key (contract below)
 *   POST /api/plus/forget                   clears the cookie in this browser
 *
 * Every POST must carry `Origin` equal to the request's own origin (403 FORBIDDEN_ORIGIN);
 * claim and voice must send `Content-Type: application/json` (415 BAD_CONTENT_TYPE) and a
 * body of at most 64 KiB (413 TOO_LARGE).
 *
 * POST /api/plus/voice contract (the client, src/audio/plus-voice.js, is built against it):
 *   request  { "atoms": ["phrase", ...] }   1..400 phrases, each with a letter or digit and
 *            no line break; joined by one space, at most 10,000 characters.
 *   200 application/json
 *     { "pack": { "schema": "rise.recitation-voice-pack.v1",
 *                 "voiced": { "hash": <sha256 hex of voice, model, slug and text>, "characters": n, "model": "elevenlabs/<model>" },
 *                 "voices": { <slug>: { "label", "model", "format": "mp3",
 *                   "entries": { <voiceAssetKey(text)>: { "text", "asset": "voiced:<hash>", "mimeType": "audio/mpeg",
 *                                                       "fromMs", "toMs", "durationMs", "onsetsMs": [...] } } } } },
 *       "audio": "<base64 mp3, the whole performance; every entry is a time range of it>",
 *       "allowance": { "used": n, "limit": n, "periodEnd": <unix seconds> } }
 *     `text` stays in each entry because the Voice admits an entry only when its text
 *     matches the phrase (src/audio/voice-pack.js resolveVoicePackEntry). `asset` is an
 *     opaque id, not a URL: the server keeps no copy, so the client stores the audio and
 *     answers that id itself. Nothing is cached server-side; the same text sent twice is
 *     voiced, and metered, twice. The response re-signs the cookie.
 *   errors   { "error": { "code", "message" } }
 *     400 BAD_REQUEST, 413 TOO_LONG | TOO_LARGE, 415 BAD_CONTENT_TYPE, 403 FORBIDDEN_ORIGIN,
 *     402 PLUS_REQUIRED (no valid cookie, or Stripe no longer has an active Plus subscription;
 *         the cookie is cleared), 402 PLUS_LAPSED (cookie past its period and grace),
 *     402 PLUS_ALLOWANCE (this period's characters are used up), 429 RATE_LIMITED,
 *     503 PLUS_UNAVAILABLE (names the missing secret, var or binding),
 *     503 PLUS_DAILY_CAP (every subscriber together reached today's character cap),
 *     502 UPSTREAM (Stripe or the vendor could not answer), 502 VOICE_REFUSED (the
 *         performance did not match the text; the vendor billed it, so it stays metered).
 *
 * Metering: before the vendor is called, the characters are reserved atomically in the
 * subscription's meter (per billing period, keyed by the period end Stripe just gave) and
 * in the global meter (per UTC day, capped by PLUS_DAILY_CHAR_CAP). A reservation stands
 * as spent unless the vendor refused before billing (a non-2xx answer, or no answer),
 * when both are released. So whatever the vendor billed is counted, even when the answer
 * is then refused, and a reservation lost to a crash errs toward the lab.
 *
 * Secrets: STRIPE_SECRET_KEY, PLUS_COOKIE_SECRET (and PLUS_COOKIE_SECRET_PREVIOUS while
 * rotating; every configuration has its own), ELEVENLABS_API_KEY, PLUS_PRICE_ID (the Stripe
 * price of RISE Plus, test and live differ; unset, every claim and voicing is refused),
 * PLUS_VOICE_ID (the vendor's voice). Vars in config: PLUS_VOICE_SLUG, PLUS_VOICE_MODEL,
 * PLUS_DAILY_CHAR_CAP. Binding: PLUS_METER, the PlusMeter Durable Object namespace.
 */
import { mapAlignment } from '../src/audio/poem-alignment.js';
import { VOICE_PACK_SCHEMA, voiceAssetKey } from '../src/audio/voice-pack-key.js';

/** `__Secure-` makes the browser refuse it from anything but a secure origin, and from a sibling subdomain's Set-Cookie without Secure. */
const COOKIE = '__Secure-rise_plus';
const KEY_ID = 'v1';
const DAY_S = 24 * 60 * 60;
const GRACE_S = 3 * DAY_S;
/** No cookie is honoured longer than this after it was signed, whatever its `exp` says; claim and every voicing re-sign it. */
const MAX_COOKIE_S = 40 * DAY_S;
const CLOCK_SKEW_S = 5 * 60;
const MAX_BODY_BYTES = 64 * 1024;
const STRIPE = 'https://api.stripe.com';
/**
 * Every Stripe call names its API version, so the account's default cannot change
 * the shape read here. From 2025-03-31.basil the billing period lives on the
 * subscription items, not the subscription (docs.stripe.com/changelog/basil).
 */
export const STRIPE_VERSION = '2025-03-31.basil';
const ELEVENLABS = 'https://api.elevenlabs.io';
/** Characters a subscriber may have voiced per billing period (RFC 0001 revision 5; about half of $8.99 at Flash pricing). */
export const VOICE_ALLOWANCE = 105_000;
/** One voicing is one vendor request: a Current, not a chapter. */
const VOICE_MAX_CHARS = 10_000;
const VOICE_MAX_ATOMS = 400;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

export function isPlusRoute(path) {
  return path === '/api/plus/claim' || path === '/api/plus/voice' || path === '/api/plus/forget';
}

function reply(status, body, headers = {}) {
  return new Response(body === null ? null : JSON.stringify(body), { status, headers: { ...JSON_HEADERS, ...headers } });
}

function refuse(status, code, message, headers) {
  return reply(status, { error: { code, message } }, headers);
}

const encoder = new TextEncoder();
const b64url = bytes => btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/gu, '-').replace(/\//gu, '_').replace(/=+$/u, '');
const fromB64url = text => Uint8Array.from(atob(text.replace(/-/gu, '+').replace(/_/gu, '/')), c => c.charCodeAt(0));

async function hmacKey(secret) {
  return crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

/** `v1.<payload>.<signature>`, the payload being the claim as JSON. */
async function sign(claim, secret) {
  const payload = b64url(encoder.encode(JSON.stringify(claim)));
  const signature = await crypto.subtle.sign('HMAC', await hmacKey(secret), encoder.encode(`${KEY_ID}.${payload}`));
  return `${KEY_ID}.${payload}.${b64url(signature)}`;
}

/** Whether the Stripe key in use is a live-mode key. A cookie minted under the other mode is refused. */
const livemode = env => /^(sk|rk)_live_/u.test(env.STRIPE_SECRET_KEY ?? '');

/**
 * The claim inside a cookie whose signature one of the secrets vouches for, minted
 * under this deployment's Stripe mode and within the lifetime ceiling; else null.
 */
async function verify(value, env, now) {
  const [keyId, payload, signature] = String(value ?? '').split('.');
  if (keyId !== KEY_ID || !payload || !signature) return null;
  for (const secret of [env.PLUS_COOKIE_SECRET, env.PLUS_COOKIE_SECRET_PREVIOUS].filter(Boolean)) {
    let ok = false;
    try {
      ok = await crypto.subtle.verify('HMAC', await hmacKey(secret), fromB64url(signature), encoder.encode(`${keyId}.${payload}`));
    } catch {
      ok = false;
    }
    if (!ok) continue;
    try {
      const claim = JSON.parse(new TextDecoder().decode(fromB64url(payload)));
      if (typeof claim.c === 'string' && typeof claim.s === 'string' && Number.isFinite(claim.exp) && Number.isFinite(claim.iat)
        && claim.l === livemode(env) && claim.iat <= now + CLOCK_SKEW_S && now - claim.iat <= MAX_COOKIE_S) {
        return claim;
      }
    } catch {
      /* not ours */
    }
    return null;
  }
  return null;
}

function cookieValue(request) {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === COOKIE) return rest.join('=');
  }
  return null;
}

const ATTRIBUTES = 'HttpOnly; Secure; SameSite=Lax; Path=/api/plus';

async function setCookie(claim, env, now) {
  const maxAge = Math.min(MAX_COOKIE_S, Math.max(0, claim.exp + GRACE_S - now));
  return `${COOKIE}=${await sign(claim, env.PLUS_COOKIE_SECRET)}; Max-Age=${maxAge}; ${ATTRIBUTES}`;
}

const CLEAR_COOKIE = `${COOKIE}=; Max-Age=0; ${ATTRIBUTES}`;

async function stripe(path, env) {
  const response = await fetch(`${STRIPE}${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version': STRIPE_VERSION }
  });
  if (!response.ok) throw Object.assign(new Error(`Stripe answered ${response.status}`), { status: response.status });
  return response.json();
}

const ACTIVE = new Set(['active', 'trialing']);

const itemsOf = subscription => (Array.isArray(subscription?.items?.data) ? subscription.items.data : []);
const priceIdOf = item => (typeof item?.price === 'string' ? item.price : item?.price?.id);

/** The period end: on the items from basil on, at the top level before it. */
function periodEnd(subscription) {
  const fromItem = itemsOf(subscription)[0]?.current_period_end;
  return Number.isFinite(fromItem) ? fromItem : subscription.current_period_end;
}

/**
 * The claim for a subscription object Stripe just returned, or null when it does
 * not stand. It stands only with the Plus price on it: the Stripe account may sell
 * other subscriptions, and without PLUS_PRICE_ID nothing stands (fail closed).
 */
function claimFor(subscription, env) {
  if (!subscription || !ACTIVE.has(subscription.status)) return null;
  if (!env.PLUS_PRICE_ID || !itemsOf(subscription).some(item => priceIdOf(item) === env.PLUS_PRICE_ID)) return null;
  const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  const exp = periodEnd(subscription);
  if (!customer || typeof subscription.id !== 'string' || !Number.isFinite(exp)) return null;
  return { c: customer, s: subscription.id, exp, l: livemode(env) };
}

async function limited(request, env, key) {
  const ip = request.headers.get('CF-Connecting-IP')?.trim();
  if (!ip || typeof env.DECISION_LIMITER?.limit !== 'function') return false;
  try {
    return (await env.DECISION_LIMITER.limit({ key: `${key}:${ip}` }))?.success !== true;
  } catch {
    return false; // the platform's fault, not the reader's
  }
}

/**
 * The JSON body, read no further than MAX_BODY_BYTES, or a refusal. The declared
 * length is checked first, and the stream is counted as it arrives, because a
 * chunked body declares none.
 */
async function readJson(request) {
  if (!/^application\/json(\s*;|$)/iu.test(request.headers.get('Content-Type') ?? '')) {
    return { refusal: refuse(415, 'BAD_CONTENT_TYPE', 'Send the body as application/json.') };
  }
  const tooLarge = { refusal: refuse(413, 'TOO_LARGE', `The request body is over ${MAX_BODY_BYTES} bytes.`) };
  if (Number(request.headers.get('Content-Length')) > MAX_BODY_BYTES) return tooLarge;
  const chunks = [];
  let total = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BODY_BYTES) {
        await reader.cancel().catch(() => {});
        return tooLarge;
      }
      chunks.push(value);
    }
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { body: undefined };
  }
}

async function claim(request, env, now) {
  if (await limited(request, env, 'plus')) return refuse(429, 'RATE_LIMITED', 'Too many requests were sent. Try again in a minute.');
  const { refusal, body } = await readJson(request);
  if (refusal) return refusal;
  const sessionId = body?.session_id;
  if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]+$/u.test(sessionId)) {
    return refuse(400, 'BAD_REQUEST', 'A Checkout session id is needed.');
  }
  if (!env.PLUS_PRICE_ID) return refuse(503, 'PLUS_UNAVAILABLE', 'Plus is not switched on in this deployment (PLUS_PRICE_ID is not set).');
  let session;
  try {
    session = await stripe(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`, env);
  } catch {
    return refuse(502, 'UPSTREAM', 'Stripe could not be reached. Try again in a moment.');
  }
  const paid = session.payment_status === 'paid' && claimFor(session.subscription, env);
  if (!paid) return refuse(402, 'PLUS_REQUIRED', 'This purchase is not an active Plus subscription.');
  return reply(204, null, { 'Set-Cookie': await setCookie({ ...paid, iat: now }, env, now) });
}

const sha256 = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))].map(b => b.toString(16).padStart(2, '0')).join('');

/** PLUS_DAILY_CHAR_CAP as a positive whole number, else null (and the voice is off). */
const dailyCap = env => (/^\d+$/u.test(String(env.PLUS_DAILY_CHAR_CAP ?? '')) && Number(env.PLUS_DAILY_CHAR_CAP) > 0 ? Number(env.PLUS_DAILY_CHAR_CAP) : null);

/** One meter: a Durable Object instance by name. */
async function meter(env, name, op, body) {
  const stub = env.PLUS_METER.get(env.PLUS_METER.idFromName(name));
  const response = await stub.fetch(`https://plus-meter/${op}`, { method: 'POST', body: JSON.stringify(body) });
  return response.json();
}

/**
 * Voice one short reading. The atoms are the reader's own phrases, exactly as
 * the Chamber will cut them, joined by one space for the vendor so the letter
 * check (src/audio/poem-alignment.js) holds by construction. The pack points
 * every phrase at one audio file with its own time range; the Voice slices it.
 */
async function voice(request, env, now) {
  const missing = ['ELEVENLABS_API_KEY', 'PLUS_VOICE_ID', 'PLUS_VOICE_SLUG', 'PLUS_PRICE_ID', 'PLUS_DAILY_CHAR_CAP', 'PLUS_METER']
    .filter(name => (name === 'PLUS_DAILY_CHAR_CAP' ? dailyCap(env) === null : !env[name]));
  if (missing.length) {
    return refuse(503, 'PLUS_UNAVAILABLE', `The Plus voice is not switched on in this deployment (${missing.join(', ')} not set).`);
  }
  const current = await verify(cookieValue(request), env, now);
  if (!current) return refuse(402, 'PLUS_REQUIRED', 'A Plus subscription is needed for this voice.', { 'Set-Cookie': CLEAR_COOKIE });
  if (now > current.exp + GRACE_S) return refuse(402, 'PLUS_LAPSED', 'Your Plus subscription has lapsed.', { 'Set-Cookie': CLEAR_COOKIE });
  if (await limited(request, env, 'plus-voice')) return refuse(429, 'RATE_LIMITED', 'Too many requests were sent. Try again in a minute.');

  const { refusal, body } = await readJson(request);
  if (refusal) return refusal;
  const atoms = body?.atoms;
  if (!Array.isArray(atoms) || !atoms.length || atoms.length > VOICE_MAX_ATOMS
    || !atoms.every(atom => typeof atom === 'string' && /[\p{L}\p{N}]/u.test(atom) && !/\n/u.test(atom))) {
    return refuse(400, 'BAD_REQUEST', `Send between 1 and ${VOICE_MAX_ATOMS} spoken phrases, each with at least one letter.`);
  }
  const text = atoms.join(' ');
  if (text.length > VOICE_MAX_CHARS) return refuse(413, 'TOO_LONG', `A voicing is at most ${VOICE_MAX_CHARS.toLocaleString('en')} characters.`);

  // Stripe, every time the lab is about to pay: a cancelled, refunded or disputed subscription stops here.
  let standing;
  try {
    standing = claimFor(await stripe(`/v1/subscriptions/${encodeURIComponent(current.s)}`, env), env);
  } catch (error) {
    // 404: Stripe has no such subscription (deleted), which is an answer, not an outage.
    if (error?.status !== 404) return refuse(502, 'UPSTREAM', 'Stripe could not be reached. Try again in a moment.');
    standing = null;
  }
  if (!standing || standing.s !== current.s) {
    return refuse(402, 'PLUS_REQUIRED', 'This is no longer an active Plus subscription.', { 'Set-Cookie': CLEAR_COOKIE });
  }

  const n = text.length;
  const own = { period: standing.exp, n, limit: VOICE_ALLOWANCE };
  const day = new Date(now * 1000).toISOString().slice(0, 10);
  const all = { period: day, n, limit: dailyCap(env) };
  const reserved = await meter(env, `sub:${current.s}`, 'reserve', own);
  if (!reserved.ok) {
    return refuse(402, 'PLUS_ALLOWANCE', `This month's voice allowance is used up (${VOICE_ALLOWANCE.toLocaleString('en')} characters). It resets with your next billing period.`);
  }
  if (!(await meter(env, 'global', 'reserve', all)).ok) {
    await meter(env, `sub:${current.s}`, 'release', own);
    return refuse(503, 'PLUS_DAILY_CAP', 'The Plus voice has reached today\'s limit. Try again tomorrow.');
  }

  const model = env.PLUS_VOICE_MODEL || 'eleven_flash_v2_5';
  let response;
  try {
    response = await fetch(`${ELEVENLABS}/v1/text-to-speech/${encodeURIComponent(env.PLUS_VOICE_ID)}/with-timestamps?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: model })
    });
  } catch {
    response = null;
  }
  if (!response?.ok) {
    // Refused before billing: the reservation goes back.
    await meter(env, `sub:${current.s}`, 'release', own);
    await meter(env, 'global', 'release', all);
    return refuse(502, 'UPSTREAM', 'The voice could not be rendered. Try again in a moment.');
  }
  // From here the vendor has billed, so the reservation stands whatever happens next.
  const allowance = { used: reserved.used, limit: VOICE_ALLOWANCE, periodEnd: standing.exp };
  let rendered;
  try {
    rendered = await response.json();
  } catch {
    rendered = null;
  }
  if (typeof rendered?.audio_base64 !== 'string' || !rendered.audio_base64) {
    return refuse(502, 'UPSTREAM', 'The voice could not be rendered. Try again in a moment.');
  }
  // The raw alignment names the characters sent; normalized_alignment names what the voice said instead and would fail the letter check.
  const mapped = mapAlignment({ atoms, alignment: rendered.alignment ?? {} });
  if (!mapped.ok) return refuse(502, 'VOICE_REFUSED', `The performance did not match the text (${mapped.reason}).`);

  const slug = env.PLUS_VOICE_SLUG;
  const hash = await sha256(`${env.PLUS_VOICE_ID}\n${model}\n${slug}\n${text}`);
  const asset = `voiced:${hash}`;
  const entries = {};
  for (const atom of mapped.atoms) {
    const key = voiceAssetKey(atom.text);
    if (entries[key]) continue;
    entries[key] = {
      text: atom.text,
      asset,
      mimeType: 'audio/mpeg',
      fromMs: Math.round(atom.startMs),
      toMs: Math.round(atom.endMs),
      durationMs: Math.round(atom.endMs - atom.startMs),
      onsetsMs: atom.onsetsMs.map(t => Math.max(0, Math.round(t - atom.startMs)))
    };
  }
  const pack = {
    schema: VOICE_PACK_SCHEMA,
    voiced: { hash, characters: n, model: `elevenlabs/${model}` },
    voices: { [slug]: { label: slug, model: `elevenlabs/${model}`, format: 'mp3', entries } }
  };
  return reply(200, { pack, audio: rendered.audio_base64, allowance }, { 'Set-Cookie': await setCookie({ ...standing, iat: now }, env, now) });
}

export async function handlePlus(request, env) {
  const path = new URL(request.url).pathname;
  if (request.method !== 'POST') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return refuse(403, 'FORBIDDEN_ORIGIN', 'Plus answers only the page it serves.');
  }
  if (path === '/api/plus/forget') return reply(204, null, { 'Set-Cookie': CLEAR_COOKIE });
  if (!env.STRIPE_SECRET_KEY || !env.PLUS_COOKIE_SECRET) {
    return refuse(503, 'PLUS_UNAVAILABLE', 'Plus is not switched on in this deployment (STRIPE_SECRET_KEY or PLUS_COOKIE_SECRET is not set).');
  }
  const now = Math.floor(Date.now() / 1000);
  if (path === '/api/plus/claim') return claim(request, env, now);
  return voice(request, env, now);
}

/**
 * A character meter: one instance per subscription (`sub:<id>`, keyed by billing
 * period end) and one for everyone (`global`, keyed by UTC day). A Durable Object
 * runs one request at a time, and the read and write below have no await between
 * them, so no two reservations can both fit in the same last gap. SQLite-backed
 * (wrangler `new_sqlite_classes`), the only kind the Workers Free plan offers; the
 * synchronous `ctx.storage.kv` is that backend's key-value API.
 *
 *   POST /reserve { period, n, limit }  -> { ok, used }  adds n unless used + n would pass limit
 *   POST /release { period, n }         -> { ok, used }  gives n back (a vendor refusal before billing)
 */
export class PlusMeter {
  constructor(ctx) {
    this.kv = ctx.storage.kv;
  }

  async fetch(request) {
    const op = new URL(request.url).pathname;
    const { period, n, limit } = await request.json();
    if (!Number.isInteger(n) || n < 0 || (typeof period !== 'number' && typeof period !== 'string')) {
      return Response.json({ ok: false, error: 'bad meter request' }, { status: 400 });
    }
    const key = `used:${period}`;
    const used = this.kv.get(key) ?? 0;
    if (op === '/reserve') {
      if (!(used + n <= limit)) return Response.json({ ok: false, used });
      this.kv.put(key, used + n);
      return Response.json({ ok: true, used: used + n });
    }
    if (op === '/release') {
      this.kv.put(key, Math.max(0, used - n));
      return Response.json({ ok: true, used: Math.max(0, used - n) });
    }
    return Response.json({ ok: false, error: 'no such meter operation' }, { status: 404 });
  }
}

export const PLUS_INTERNALS = { sign, verify, livemode, COOKIE, DAY_S, GRACE_S, MAX_COOKIE_S, MAX_BODY_BYTES };
