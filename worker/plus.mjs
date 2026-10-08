/**
 * Plus: the paid voice, gated by a Stripe receipt and nothing else
 * (MasterMind RFC 0001, section 2). The Worker keeps no table and no model
 * credential. A reader who paid holds one signed, HttpOnly cookie; every
 * audio request checks its signature, and once a day the pack request asks
 * Stripe whether the subscription still stands and re-signs or clears it.
 *
 *   POST /api/plus/claim  { session_id }      the Checkout success page; mints the cookie after Stripe confirms
 *   POST /api/plus/voice  { atoms }           voices one short reading (a Composer Current) on the lab's key, once per text
 *   GET  /api/plus/audio/<voice>/<work>/<division>/pack.json | <sha16>.m4a      the rendered canon
 *   GET  /api/plus/audio/voiced/<sha256>/pack.json | audio.mp3                  a voiced reading
 *   POST /api/plus/forget                     clears the cookie in this browser
 *
 * The voice allowance is metered without a table: the characters voiced this
 * period ride inside the cookie and are mirrored to the Stripe subscription's
 * metadata on every paid voicing, so a cleared browser recovers its count at
 * the next claim and a reused success link cannot reset it. The same text is
 * never paid for twice: a voicing is cached by the hash of what was said.
 *
 * Secrets: STRIPE_SECRET_KEY, PLUS_COOKIE_SECRET (and PLUS_COOKIE_SECRET_PREVIOUS
 * while rotating), ELEVENLABS_API_KEY (voice only). Set with `wrangler secret put`
 * as well, because a dashboard var is dropped by the next deploy from config:
 * PLUS_PRICE_ID (the Stripe price of RISE Plus, test and live differ; unset, every
 * claim and renewal is refused) and PLUS_VOICE_ID (the vendor's voice; unset, the
 * voice route answers 503). Vars in config: PLUS_VOICE_SLUG (the voice's name in
 * RISE), PLUS_VOICE_MODEL.
 * Binding: PLUS_AUDIO, the private bucket the render script and the voice route fill.
 */
import { mapAlignment } from '../src/audio/poem-alignment.js';
import { VOICE_PACK_SCHEMA, voiceAssetKey } from '../src/audio/voice-pack-key.js';

const COOKIE = 'rise_plus';
const KEY_ID = 'v1';
const DAY_S = 24 * 60 * 60;
const GRACE_S = 3 * DAY_S;
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

const AUDIO_PATH = /^\/api\/plus\/audio\/([a-z0-9_]+)\/([a-z0-9-]+)\/(\d{1,4})\/(pack\.json|[0-9a-f]{16}\.m4a)$/u;
const VOICED_PATH = /^\/api\/plus\/audio\/voiced\/([0-9a-f]{64})\/(pack\.json|audio\.mp3)$/u;

export function isPlusRoute(path) {
  return path === '/api/plus/claim' || path === '/api/plus/voice' || path === '/api/plus/forget'
    || AUDIO_PATH.test(path) || VOICED_PATH.test(path);
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

/** The claim inside a cookie whose signature one of the secrets vouches for, else null. */
async function verify(value, env) {
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
      if (typeof claim.c === 'string' && typeof claim.s === 'string' && Number.isFinite(claim.exp) && Number.isFinite(claim.iat)) {
        return { ...claim, u: Number.isFinite(claim.u) ? claim.u : 0 };
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
  const maxAge = Math.max(0, claim.exp + GRACE_S - now);
  return `${COOKIE}=${await sign(claim, env.PLUS_COOKIE_SECRET)}; Max-Age=${maxAge}; ${ATTRIBUTES}`;
}

const CLEAR_COOKIE = `${COOKIE}=; Max-Age=0; ${ATTRIBUTES}`;

async function stripe(path, env, form = null) {
  const response = await fetch(`${STRIPE}${path}`, {
    method: form ? 'POST' : 'GET',
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version': STRIPE_VERSION, ...(form ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}) },
    ...(form ? { body: new URLSearchParams(form).toString() } : {})
  });
  if (!response.ok) throw new Error(`Stripe answered ${response.status}`);
  return response.json();
}

/** The characters voiced this period, as Stripe remembers them for this subscription. */
const usedFrom = (subscription, exp) => {
  const value = Number(subscription?.metadata?.[`plus_used_${exp}`]);
  return Number.isFinite(value) && value > 0 ? Math.floor(value) : 0;
};

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
  return { c: customer, s: subscription.id, exp, u: usedFrom(subscription, exp) };
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

async function claim(request, env, now) {
  if (request.method !== 'POST') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  if (await limited(request, env, 'plus')) return refuse(429, 'RATE_LIMITED', 'Too many requests were sent. Try again in a minute.');
  let sessionId;
  try {
    sessionId = (await request.json())?.session_id;
  } catch {
    sessionId = undefined;
  }
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

/** A day-old cookie on a pack request: ask Stripe once, then re-sign or clear. */
async function renewed(current, env, now) {
  if (now - current.iat < DAY_S) return { claim: current };
  let subscription;
  try {
    subscription = await stripe(`/v1/subscriptions/${encodeURIComponent(current.s)}`, env);
  } catch {
    return { claim: current }; // Stripe is down: the signed cookie stands until its own grace runs out
  }
  const next = claimFor(subscription, env);
  if (!next) return { claim: null };
  return { claim: { ...next, iat: now }, cookie: await setCookie({ ...next, iat: now }, env, now) };
}

const sha256 = async text => [...new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(text)))].map(b => b.toString(16).padStart(2, '0')).join('');

/**
 * Voice one short reading. The atoms are the reader's own phrases, exactly as
 * the Chamber will cut them, joined by one space for the vendor so the letter
 * check (src/audio/poem-alignment.js) holds by construction. The pack points
 * every phrase at one audio file with its own time range; the Voice slices it.
 */
async function voice(request, env, now) {
  if (request.method !== 'POST') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  const missing = ['ELEVENLABS_API_KEY', 'PLUS_VOICE_ID', 'PLUS_VOICE_SLUG'].filter(name => !env[name]);
  if (missing.length) {
    return refuse(503, 'PLUS_UNAVAILABLE', `The Plus voice is not switched on in this deployment (${missing.join(', ')} not set).`);
  }
  const current = await verify(cookieValue(request), env);
  if (!current) return refuse(402, 'PLUS_REQUIRED', 'A Plus subscription is needed for this voice.', { 'Set-Cookie': CLEAR_COOKIE });
  if (now > current.exp + GRACE_S) return refuse(402, 'PLUS_LAPSED', 'Your Plus subscription has lapsed.', { 'Set-Cookie': CLEAR_COOKIE });
  if (await limited(request, env, 'plus-voice')) return refuse(429, 'RATE_LIMITED', 'Too many requests were sent. Try again in a minute.');

  let atoms;
  try {
    atoms = (await request.json())?.atoms;
  } catch {
    atoms = undefined;
  }
  if (!Array.isArray(atoms) || !atoms.length || atoms.length > VOICE_MAX_ATOMS
    || !atoms.every(atom => typeof atom === 'string' && /[\p{L}\p{N}]/u.test(atom) && !/\n/u.test(atom))) {
    return refuse(400, 'BAD_REQUEST', `Send between 1 and ${VOICE_MAX_ATOMS} spoken phrases, each with at least one letter.`);
  }
  const text = atoms.join(' ');
  if (text.length > VOICE_MAX_CHARS) return refuse(413, 'TOO_LONG', `A voicing is at most ${VOICE_MAX_CHARS.toLocaleString('en')} characters.`);

  const model = env.PLUS_VOICE_MODEL || 'eleven_flash_v2_5';
  const slug = env.PLUS_VOICE_SLUG;
  const hash = await sha256(`${env.PLUS_VOICE_ID}\n${model}\n${slug}\n${text}`);
  const packKey = `voiced/${hash}/pack.json`;
  const cached = await env.PLUS_AUDIO.get(packKey);
  if (cached) {
    // Said before: nobody pays again, and the allowance is untouched.
    return new Response(cached.body, { status: 200, headers: { ...JSON_HEADERS, 'Cache-Control': 'private, max-age=31536000, immutable' } });
  }

  if (current.u + text.length > VOICE_ALLOWANCE) {
    return refuse(402, 'PLUS_ALLOWANCE', `This month's voice allowance is used up (${VOICE_ALLOWANCE.toLocaleString('en')} characters). It resets with your next billing period.`);
  }

  let rendered;
  try {
    const response = await fetch(`${ELEVENLABS}/v1/text-to-speech/${encodeURIComponent(env.PLUS_VOICE_ID)}/with-timestamps?output_format=mp3_44100_64`, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, model_id: model })
    });
    if (!response.ok) throw new Error(`vendor answered ${response.status}`);
    rendered = await response.json();
  } catch {
    return refuse(502, 'UPSTREAM', 'The voice could not be rendered. Try again in a moment.');
  }
  // The raw alignment names the characters sent; normalized_alignment names what the voice said instead and would fail the letter check.
  const mapped = mapAlignment({ atoms, alignment: rendered.alignment ?? {} });
  if (!mapped.ok) return refuse(502, 'VOICE_REFUSED', `The performance did not match the text (${mapped.reason}).`);

  const asset = `/api/plus/audio/voiced/${hash}/audio.mp3`;
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
  const pack = JSON.stringify({
    schema: VOICE_PACK_SCHEMA,
    voiced: { hash, characters: text.length, model: `elevenlabs/${model}` },
    voices: { [slug]: { label: slug, model: `elevenlabs/${model}`, format: 'mp3', entries } }
  });
  await env.PLUS_AUDIO.put(`voiced/${hash}/audio.mp3`, Uint8Array.from(atob(rendered.audio_base64 ?? ''), c => c.charCodeAt(0)), { httpMetadata: { contentType: 'audio/mpeg' } });
  await env.PLUS_AUDIO.put(packKey, pack, { httpMetadata: { contentType: 'application/json' } });

  const used = current.u + text.length;
  try {
    await stripe(`/v1/subscriptions/${encodeURIComponent(current.s)}`, env, { [`metadata[plus_used_${current.exp}]`]: String(used) });
  } catch {
    /* the cookie still carries the count; Stripe catches up on the next voicing */
  }
  return new Response(pack, {
    status: 200,
    headers: { ...JSON_HEADERS, 'Set-Cookie': await setCookie({ ...current, u: used, iat: current.iat }, env, now) }
  });
}

async function audio(request, env, now) {
  if (request.method !== 'GET') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use GET.');
  const path = new URL(request.url).pathname;
  const voiced = path.match(VOICED_PATH);
  const [, voice, work, division, file] = voiced ? [null, 'voiced', voiced[1], null, voiced[2]] : path.match(AUDIO_PATH);
  const current = await verify(cookieValue(request), env);
  if (!current) return refuse(402, 'PLUS_REQUIRED', 'A Plus subscription is needed for this voice.', { 'Set-Cookie': CLEAR_COOKIE });
  if (now > current.exp + GRACE_S) return refuse(402, 'PLUS_LAPSED', 'Your Plus subscription has lapsed.', { 'Set-Cookie': CLEAR_COOKIE });
  let cookie = null;
  if (file === 'pack.json') {
    const result = await renewed(current, env, now);
    if (!result.claim) return refuse(402, 'PLUS_LAPSED', 'Your Plus subscription has lapsed.', { 'Set-Cookie': CLEAR_COOKIE });
    cookie = result.cookie ?? null;
  }
  const object = await env.PLUS_AUDIO.get(voiced ? `voiced/${work}/${file}` : `${voice}/${work}/${division}/${file}`);
  if (!object) return refuse(404, 'NOT_FOUND', 'No such clip.');
  const headers = new Headers({
    'Content-Type': file === 'pack.json' ? 'application/json; charset=utf-8' : file === 'audio.mp3' ? 'audio/mpeg' : 'audio/mp4',
    'Cache-Control': 'private, max-age=31536000, immutable',
    'X-Content-Type-Options': 'nosniff',
    ...(object.httpEtag ? { ETag: object.httpEtag } : {})
  });
  if (cookie) headers.set('Set-Cookie', cookie);
  return new Response(object.body, { status: 200, headers });
}

export async function handlePlus(request, env) {
  const path = new URL(request.url).pathname;
  if (!env.STRIPE_SECRET_KEY || !env.PLUS_COOKIE_SECRET || !env.PLUS_AUDIO) {
    return refuse(503, 'PLUS_UNAVAILABLE', 'Plus is not switched on in this deployment.');
  }
  const now = Math.floor(Date.now() / 1000);
  if (path === '/api/plus/claim') return claim(request, env, now);
  if (path === '/api/plus/voice') return voice(request, env, now);
  if (path === '/api/plus/forget') return reply(204, null, { 'Set-Cookie': CLEAR_COOKIE });
  return audio(request, env, now);
}

export const PLUS_INTERNALS = { sign, verify, COOKIE, DAY_S, GRACE_S };
