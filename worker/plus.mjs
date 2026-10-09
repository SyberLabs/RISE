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
 *   GET  /api/plus/voices                   the voices a reader may choose: [{ slug, label }], never a vendor id; no cookie needed
 *   GET  /api/plus/config                   { paymentLink }: PLUS_PAYMENT_LINK when it is an https://buy.stripe.com/ link of the
 *                                           same Stripe mode as STRIPE_SECRET_KEY (a test_ link only with a test key), else null
 *   POST /api/plus/stripe-webhook           Stripe's events (below); signed by Stripe, so it is exempt from the Origin rule
 *
 * Every other POST must carry `Origin` equal to the request's own origin (403 FORBIDDEN_ORIGIN);
 * claim and voice must send `Content-Type: application/json` (415 BAD_CONTENT_TYPE) and a
 * body of at most 64 KiB (413 TOO_LARGE).
 *
 * POST /api/plus/voice contract (the client, src/audio/plus-voice.js, is built against it):
 *   request  { "atoms": ["phrase", ...], "voice"?: <slug> }   1..400 phrases, each with a letter
 *            or digit and no line break; joined by one space, at most 10,000 characters. `voice`
 *            is a slug from GET /api/plus/voices, "default" when absent; the vendor's voice id
 *            comes only from the server's allow-list (PLUS_VOICES), never from the request.
 *   200 application/json
 *     { "pack": { "schema": "rise.recitation-voice-pack.v1",
 *                 "voiced": { "hash": <sha256 hex of voice id, model, slug and text>, "voice": <slug>, "characters": n, "model": "elevenlabs/<model>" },
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
 *     400 BAD_REQUEST, 400 UNKNOWN_VOICE (a slug not in the allow-list), 413 TOO_LONG | TOO_LARGE, 415 BAD_CONTENT_TYPE, 403 FORBIDDEN_ORIGIN,
 *     402 PLUS_REQUIRED (no valid cookie, or Stripe no longer has an active Plus subscription;
 *         the cookie is cleared), 402 PLUS_LAPSED (cookie past its period and grace),
 *     402 PLUS_ALLOWANCE (this period's characters are used up), 429 RATE_LIMITED (per address,
 *         and per subscription; also when the rate limiter itself fails: the voice fails closed),
 *     429 PLUS_DAILY_LIMIT (this subscription voiced PLUS_SUB_DAILY_CHAR_CAP characters this UTC day),
 *     503 PLUS_UNAVAILABLE (names the missing secret, var or binding; under PLUS_REQUIRE_LIVE a
 *         generic message, the detail going to the Worker's log, names only, never values),
 *     503 PLUS_DAILY_CAP (every subscriber together reached today's character cap),
 *     502 UPSTREAM (Stripe or the vendor could not answer), 502 VOICE_REFUSED (the
 *         performance did not match the text; the vendor billed it, so it stays metered).
 *
 * Stripe is asked at most once a minute per subscription: the subscription's meter keeps
 * the last standing Stripe gave (active or not, price, period, mode) for STANDING_TTL_S
 * seconds, so a cancellation Stripe reports is refused within a minute even without the
 * webhook, and at once with it. Before Stripe is asked at all, the meter refuses a revoked
 * subscription, more than SUB_RATE_PER_MINUTE requests a minute, and a request that would
 * pass the allowance of the period it last saw: an exhausted or cancelled subscription
 * costs no Stripe call.
 *
 * Metering: before the vendor is called, the characters are reserved atomically in the
 * subscription's meter (per billing period, keyed by the current_period_start of the
 * subscription item that carries PLUS_PRICE_ID) and in the global meter (per UTC day,
 * capped by PLUS_DAILY_CHAR_CAP). The start, not the end: Stripe moves the start only
 * when it begins a new billing period, which it invoices (a renewal, or an anchor reset
 * that bills the new period at once); a trial extension or a plan change that keeps the
 * anchor moves the end only, and must not mint a fresh allowance. A reservation stands
 * as spent once the vendor request is sent, including an error or lost answer. Only a
 * refusal before contacting the vendor releases it. Atomic microdollar reservations
 * also cap vendor cost below net collected revenue after taxes, fees and a reserve.
 *
 * Refunds, disputes and cancellations: POST /api/plus/stripe-webhook. In the Stripe dashboard
 * (Developers, Webhooks, Add destination; the live and the test account each need their own),
 * point an endpoint at https://rise.syberlabs.io/api/plus/stripe-webhook (the preview:
 * https://rise-plus-preview.<account>.workers.dev/api/plus/stripe-webhook), API version
 * 2025-03-31.basil, and subscribe exactly these events:
 *   charge.refunded                  a full refund revokes the subscription it paid (a partial refund does not)
 *   charge.dispute.created           revokes the subscription the disputed charge paid
 *   customer.subscription.deleted    revokes it
 *   customer.subscription.updated    a status outside active/trialing revokes it until a later
 *                                    event says it stands again; any update forgets the cached standing
 * Its signing secret (whsec_...) is the secret STRIPE_WEBHOOK_SECRET. The signature is
 * Stripe's v1 scheme: HMAC-SHA256 of "<t>.<raw body>", within WEBHOOK_TOLERANCE_S of now.
 * Each event is applied once (by event id). A charge is traced to its subscription through
 * Stripe (invoice payments of its PaymentIntent); a Stripe error answers 500 so Stripe retries.
 * A full refund or a dispute also cancels the Plus subscription in Stripe at once (DELETE
 * /v1/subscriptions/{id}), so the reader is not billed again for a voice that will never
 * come back; one already cancelled, gone, or not carrying PLUS_PRICE_ID is left alone. The
 * cancel is tried on every delivery, a redelivery included, so a failed one (500) is retried.
 * Unset, the webhook answers 503 and every other route works as before.
 *
 * Secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, PLUS_COOKIE_SECRET (and PLUS_COOKIE_SECRET_PREVIOUS while
 * rotating; every configuration has its own), ELEVENLABS_API_KEY, PLUS_PRICE_ID (the Stripe
 * price of RISE Plus, test and live differ; unset, every claim and voicing is refused),
 * PLUS_VOICE_ID (the vendor's id of the "default" voice). Vars in config: PLUS_VOICES (the
 * allow-list, a JSON array of { slug, label, id }; the "default" entry takes its id from
 * PLUS_VOICE_ID), PLUS_VOICE_MODEL, PLUS_DAILY_CHAR_CAP, PLUS_PAYMENT_LINK (the Stripe
 * Payment Link the Subscribe button opens; test and live differ). Bindings: PLUS_METER, the
 * PlusMeter Durable Object namespace; PLUS_CLAIM_LIMITER, the strict per-address limit on
 * claims (each costs a Stripe call; unbound, every claim is refused); DECISION_LIMITER.
 * PLUS_SUB_DAILY_CHAR_CAP (vars, default SUB_DAILY_CHAR_CAP): the characters one subscription
 * may voice per UTC day, under its period allowance, so a stolen card cannot drain the
 * allowance in the hours before its chargeback.
 *
 * PLUS_REQUIRE_LIVE (vars, "true" in production only): the deployment takes real money, so
 * claim and voice answer 503 PLUS_UNAVAILABLE, and config serves no payment link, unless
 * STRIPE_SECRET_KEY is a live key (sk_live_/rk_live_), PLUS_PAYMENT_LINK is a live link (no
 * test_), and STRIPE_WEBHOOK_SECRET is set. Production once served a test-mode link with a
 * test key, and Stripe's public test card then bought real ElevenLabs characters.
 */
import { getAdmin, verifyAdmin } from './plus-admin.mjs';
import { spendingPolicy, paidBudget, adminBudget } from './plus-budget.mjs';
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
/** Stripe events are larger than a reader's request; this still bounds what is read. */
const MAX_WEBHOOK_BYTES = 256 * 1024;
/** How old a webhook's signed timestamp may be (Stripe's own libraries use five minutes). */
const WEBHOOK_TOLERANCE_S = 5 * 60;
/** How long the meter's copy of a subscription's Stripe standing is used before Stripe is asked again. */
export const STANDING_TTL_S = 60;
/** Voicing requests one subscription may make a minute, whichever addresses they come from. */
export const SUB_RATE_PER_MINUTE = 30;
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
/** Characters one subscription may voice per UTC day when PLUS_SUB_DAILY_CHAR_CAP is unset. */
export const SUB_DAILY_CHAR_CAP = 25_000;
/** One voicing is one vendor request: a Current, not a chapter. */
export const VOICE_MAX_CHARS = 10_000;
const VOICE_MAX_ATOMS = 400;

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const ROUTES = new Set(['/api/plus/claim', '/api/plus/voice', '/api/plus/forget', '/api/plus/voices', '/api/plus/config', '/api/plus/stripe-webhook', '/api/plus/status', '/api/plus/admin/login', '/api/plus/admin/check']);

export function isPlusRoute(path) {
  return ROUTES.has(path);
}

/**
 * PLUS_PAYMENT_LINK when it is a Stripe Payment Link of the key's own mode (a test_ link
 * with a test key, any other with a live key) and the deployment is ready to take money,
 * else null (and the client hides Subscribe).
 */
function paymentLink(env) {
  const link = env.PLUS_PAYMENT_LINK;
  if (typeof link !== 'string' || !PAYMENT_LINK.test(link)) return null;
  if (isTestLink(link) === livemode(env) || notLive(env)) return null;
  return link;
}

/** A Stripe Payment Link, nothing before or after it. */
const PAYMENT_LINK = /^https:\/\/buy\.stripe\.com\/[A-Za-z0-9_]+$/u;
const isTestLink = link => link.startsWith('https://buy.stripe.com/test_');
const requireLive = env => env.PLUS_REQUIRE_LIVE === 'true';

/**
 * Under PLUS_REQUIRE_LIVE, what keeps this deployment from taking real money, by name
 * (never a value); null when nothing does, or when the deployment does not require live.
 */
function notLive(env) {
  if (!requireLive(env)) return null;
  const link = env.PLUS_PAYMENT_LINK;
  const problems = [
    !livemode(env) && 'STRIPE_SECRET_KEY is not a live key',
    (typeof link !== 'string' || !PAYMENT_LINK.test(link) || isTestLink(link)) && 'PLUS_PAYMENT_LINK is not a live Payment Link',
    !env.STRIPE_WEBHOOK_SECRET && 'STRIPE_WEBHOOK_SECRET is not set'
  ].filter(Boolean);
  return problems.length ? problems.join('; ') : null;
}

/**
 * 503 PLUS_UNAVAILABLE. Under PLUS_REQUIRE_LIVE the body is generic and the detail (names
 * of what is unset, never a value) goes to the Worker's log: a public answer must not map
 * production's configuration. Elsewhere the detail is the message, for whoever sets it up.
 */
function unavailable(env, detail) {
  if (!requireLive(env)) return refuse(503, 'PLUS_UNAVAILABLE', detail);
  console.error(`Plus unavailable: ${detail}`);
  return refuse(503, 'PLUS_UNAVAILABLE', 'Plus is not available right now.');
}

/**
 * The voice allow-list: slug to label and vendor id, or null when PLUS_VOICES is not a
 * usable list (and the voice is off). Wrangler hands a JSON var over parsed; a dashboard
 * or secret value arrives as text. The "default" voice's id is the PLUS_VOICE_ID secret.
 */
export function voices(env) {
  let list = env.PLUS_VOICES;
  try {
    if (typeof list === 'string') list = JSON.parse(list);
  } catch {
    return null;
  }
  if (!Array.isArray(list) || !list.length) return null;
  const bySlug = new Map();
  for (const voice of list) {
    const id = voice?.slug === 'default' ? env.PLUS_VOICE_ID : voice?.id;
    if (typeof voice?.slug !== 'string' || !/^[a-z0-9_-]{1,32}$/u.test(voice.slug) || bySlug.has(voice.slug)
      || typeof voice.label !== 'string' || !voice.label || (voice.slug !== 'default' && (typeof id !== 'string' || !id))) return null;
    bySlug.set(voice.slug, { label: voice.label, id });
  }
  return bySlug.has('default') ? bySlug : null;
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
  const { c, s, exp, l, iat } = claim;
  return `${COOKIE}=${await sign({ c, s, exp, l, iat }, env.PLUS_COOKIE_SECRET)}; Max-Age=${maxAge}; ${ATTRIBUTES}`;
}

const CLEAR_COOKIE = `${COOKIE}=; Max-Age=0; ${ATTRIBUTES}`;

async function stripe(path, env, method = 'GET') {
  const response = await fetch(`${STRIPE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version': STRIPE_VERSION }
  });
  if (!response.ok) throw Object.assign(new Error(`Stripe answered ${response.status}`), { status: response.status });
  return response.json();
}

const ACTIVE = new Set(['active', 'trialing']);

const itemsOf = subscription => (Array.isArray(subscription?.items?.data) ? subscription.items.data : []);
const priceIdOf = item => (typeof item?.price === 'string' ? item.price : item?.price?.id);

/**
 * The billing period of the item that carries the Plus price: on the items from basil
 * on, at the top level before it. Never items[0]: the subscription may carry other items.
 */
function periodOf(subscription, item) {
  const from = key => (Number.isFinite(item?.[key]) ? item[key] : subscription[key]);
  return { start: from('current_period_start'), end: from('current_period_end') };
}

/**
 * The claim for a subscription object Stripe just returned, or null when it does
 * not stand. It stands only with the Plus price on it: the Stripe account may sell
 * other subscriptions, and without PLUS_PRICE_ID nothing stands (fail closed).
 */
function claimFor(subscription, env) {
  if (!subscription || !ACTIVE.has(subscription.status)) return null;
  const item = env.PLUS_PRICE_ID ? itemsOf(subscription).find(candidate => priceIdOf(candidate) === env.PLUS_PRICE_ID) : null;
  if (!item) return null;
  const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  const { start, end: exp } = periodOf(subscription, item);
  if (!customer || typeof subscription.id !== 'string' || !Number.isFinite(exp) || !Number.isFinite(start)) return null;
  return { c: customer, s: subscription.id, exp, start, l: livemode(env) };
}

/** Whether this address is over the limiter's rate. A limiter that throws counts as over: these routes spend the lab's money, so they fail closed. */
async function limited(request, limiter, key) {
  const ip = request.headers.get('CF-Connecting-IP')?.trim();
  if (!ip || typeof limiter?.limit !== 'function') return false;
  try {
    return (await limiter.limit({ key: `${key}:${ip}` }))?.success !== true;
  } catch {
    return true;
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
  const { refusal, bytes } = await readBytes(request, MAX_BODY_BYTES);
  if (refusal) return { refusal };
  try {
    return { body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { body: undefined };
  }
}

/** The raw body, read no further than `max` bytes, or a 413 refusal. */
async function readBytes(request, max) {
  const tooLarge = { refusal: refuse(413, 'TOO_LARGE', `The request body is over ${max} bytes.`) };
  if (Number(request.headers.get('Content-Length')) > max) return tooLarge;
  const chunks = [];
  let total = 0;
  if (request.body) {
    const reader = request.body.getReader();
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > max) {
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
  return { bytes };
}

async function claim(request, env, now) {
  // Each claim costs a Stripe call and needs no cookie, so it has its own, stricter limit, and none bound is no claim.
  if (!env.PLUS_CLAIM_LIMITER) return unavailable(env, 'Plus is not switched on in this deployment (PLUS_CLAIM_LIMITER is not bound).');
  if (await limited(request, env.PLUS_CLAIM_LIMITER, 'plus-claim')) return refuse(429, 'RATE_LIMITED', 'Too many requests were sent. Try again in a minute.');
  const { refusal, body } = await readJson(request);
  if (refusal) return refusal;
  const sessionId = body?.session_id;
  if (typeof sessionId !== 'string' || !/^cs_[A-Za-z0-9_]+$/u.test(sessionId)) {
    return refuse(400, 'BAD_REQUEST', 'A Checkout session id is needed.');
  }
  if (!env.PLUS_PRICE_ID) return unavailable(env, 'Plus is not switched on in this deployment (PLUS_PRICE_ID is not set).');
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
/** PLUS_SUB_DAILY_CHAR_CAP as a positive whole number, else SUB_DAILY_CHAR_CAP: a cap always stands. */
const subDailyCap = env => (/^\d+$/u.test(String(env.PLUS_SUB_DAILY_CHAR_CAP ?? '')) && Number(env.PLUS_SUB_DAILY_CHAR_CAP) > 0 ? Number(env.PLUS_SUB_DAILY_CHAR_CAP) : SUB_DAILY_CHAR_CAP);

/** One meter: a Durable Object instance by name. */
async function meter(env, name, op, body) {
  const stub = env.PLUS_METER.get(env.PLUS_METER.idFromName(name));
  const response = await stub.fetch(`https://plus-meter/${op}`, { method: 'POST', body: JSON.stringify(body) });
  if (!response.ok) throw new Error('Plus meter unavailable');
  const answer = await response.json();
  if (!answer || typeof answer !== 'object' || answer.error) throw new Error('Invalid Plus meter answer');
  if (op === 'gate' && !answer.revoked && !answer.limited && !answer.exhausted && typeof answer.fresh !== 'boolean') throw new Error('Invalid Plus gate');
  if (op === 'inspect' && (!Number.isSafeInteger(answer.used) || answer.used < 0 || typeof answer.fresh !== 'boolean')) throw new Error('Invalid Plus inspection');
  if (op === 'reserve' && (typeof answer.ok !== 'boolean' || !Number.isSafeInteger(answer.used) || answer.used < 0)) throw new Error('Invalid Plus reservation');
  if (['standing', 'release', 'event'].includes(op) && answer.ok !== true) throw new Error('Invalid Plus meter acknowledgement');
  return answer;
}

/**
 * Voice one short reading. The atoms are the reader's own phrases, exactly as
 * the Chamber will cut them, joined by one space for the vendor so the letter
 * check (src/audio/poem-alignment.js) holds by construction. The pack points
 * every phrase at one audio file with its own time range; the Voice slices it.
 */
async function voice(request, env, now, admin = null) {
  const policy = spendingPolicy(env);
  const adminCap = admin ? adminBudget(env, policy) : null;
  const budgetPolicy = JSON.stringify(policy);
  if (!policy || (admin && !adminCap)) return unavailable(env, 'The voice spending policy is not configured safely.');
  const allowed = voices(env);
  const missing = ['ELEVENLABS_API_KEY', 'PLUS_VOICE_ID', 'PLUS_VOICES', 'PLUS_DAILY_CHAR_CAP', 'PLUS_METER', ...(!admin ? ['PLUS_PRICE_ID', ...(requireLive(env) ? ['STRIPE_WEBHOOK_SECRET'] : [])] : [])]
    .filter(name => (name === 'ELEVENLABS_API_KEY' ? !providerReady(env) : name === 'PLUS_DAILY_CHAR_CAP' ? dailyCap(env) === null : name === 'PLUS_VOICES' ? !allowed : !env[name]));
  if (missing.length) {
    return unavailable(env, `The Plus voice is not switched on in this deployment (${missing.join(', ')} not set).`);
  }
  const current = admin ? null : await verify(cookieValue(request), env, now);
  if (!admin && !current) return refuse(402, 'PLUS_REQUIRED', 'A Plus subscription is needed for this voice.', { 'Set-Cookie': CLEAR_COOKIE });
  if (!admin && now > current.exp + GRACE_S) return refuse(402, 'PLUS_LAPSED', 'Your Plus subscription has lapsed.', { 'Set-Cookie': CLEAR_COOKIE });
  if (await limited(request, env.DECISION_LIMITER, 'plus-voice')) return refuse(429, 'RATE_LIMITED', 'Too many requests were sent. Try again in a minute.');

  const { refusal, body } = await readJson(request);
  if (refusal) return refusal;
  const atoms = body?.atoms;
  if (!Array.isArray(atoms) || !atoms.length || atoms.length > VOICE_MAX_ATOMS
    || !atoms.every(atom => typeof atom === 'string' && /[\p{L}\p{N}]/u.test(atom) && !/\n/u.test(atom))) {
    return refuse(400, 'BAD_REQUEST', `Send between 1 and ${VOICE_MAX_ATOMS} spoken phrases, each with at least one letter.`);
  }
  const slug = body.voice ?? 'default';
  if (typeof slug !== 'string' || !allowed.has(slug)) {
    return refuse(400, 'UNKNOWN_VOICE', 'Choose a voice from /api/plus/voices.');
  }
  const voiceId = allowed.get(slug).id;
  const text = atoms.join(' ');
  if (text.length > VOICE_MAX_CHARS) return refuse(413, 'TOO_LONG', `A voicing is at most ${VOICE_MAX_CHARS.toLocaleString('en')} characters.`);

  if (!await voiceReady(env)) return unavailable(env, 'The private voice provider is not ready.');

  const n = text.length;
  // All administrators share one explicit monthly budget; adding administrators never multiplies it.
  const sub = admin ? 'admin' : `sub:${current.s}`;
  const lapsed = () => refuse(402, 'PLUS_REQUIRED', 'This is no longer an active Plus subscription.', { 'Set-Cookie': CLEAR_COOKIE });
  const spent = () => refuse(402, 'PLUS_ALLOWANCE', `This period's voice allowance is used up. It resets with your next billing period.`);
  // The subscription's own meter first: revoked, too many requests, or no room left costs no Stripe call.
  const gate = await meter(env, sub, 'gate', { n, limit: VOICE_ALLOWANCE, rate: SUB_RATE_PER_MINUTE, ttl: STANDING_TTL_S });
  if (gate.revoked) return lapsed();
  if (gate.limited) return refuse(429, 'RATE_LIMITED', 'Too many requests were sent. Try again in a minute.');
  if (gate.exhausted) return spent();

  // Stripe, at most once a minute per subscription: a cancelled, refunded or disputed subscription stops here.
  let standing;
  if (admin) {
    const date = new Date(now * 1000);
    standing = { start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000, exp: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000, budgetMicros: adminCap.micros };
  } else if (gate.fresh && (gate.standing === null || (gate.standing.l === livemode(env) && gate.standing.budgetPolicy === budgetPolicy))) {
    standing = gate.standing;
  } else {
    try {
      const subscription = await stripe(`/v1/subscriptions/${encodeURIComponent(current.s)}`, env);
      standing = claimFor(subscription, env);
      if (standing) {
        const budgetMicros = await paidBudget(subscription, standing, env, policy, stripe);
        standing = budgetMicros ? { ...standing, budgetMicros, budgetPolicy: JSON.stringify(policy) } : null;
      }
    } catch (error) {
      // 404: Stripe has no such subscription (deleted), which is an answer, not an outage.
      if (error?.status !== 404) return refuse(502, 'UPSTREAM', 'Stripe could not be reached. Try again in a moment.');
      standing = null;
    }
    await meter(env, sub, 'standing', { standing, revision: gate.revision });
  }
  if (!standing || (!admin && standing.s !== current.s)) return lapsed();
  if (!Number.isSafeInteger(standing.budgetMicros) || standing.budgetMicros <= 0) return lapsed();
  const limit = Math.min(VOICE_ALLOWANCE, Math.floor(standing.budgetMicros / policy.rate));
  if (n > limit) return spent();

  const day = new Date(now * 1000).toISOString().slice(0, 10);
  const own = { period: standing.start, n, limit, day, dayLimit: admin ? adminCap.dayLimit : subDailyCap(env), costMicros: n * policy.rate, spendLimitMicros: standing.budgetMicros, rateMicros: policy.rate, revision: gate.revision };
  const all = { period: day, n, limit: dailyCap(env) };
  const reserved = await meter(env, sub, 'reserve', own);
  if (reserved.changed) return unavailable(env, 'The subscription changed while its allowance was being verified.');
  if (reserved.revoked) return lapsed();
  if (reserved.dayFull) return refuse(429, 'PLUS_DAILY_LIMIT', `Today's voice limit is reached. It resets at midnight UTC.`);
  if (!reserved.ok) return spent();
  if (!(await meter(env, 'global', 'reserve', all)).ok) {
    await meter(env, sub, 'release', own);
    return refuse(503, 'PLUS_DAILY_CAP', 'The Plus voice has reached today\'s limit. Try again tomorrow.');
  }

  const model = env.PLUS_VOICE_MODEL || 'eleven_flash_v2_5';
  let response;
  try {
    if (typeof env.PLUS_VOICE_PROVIDER?.render === 'function') {
      const outcome = await env.PLUS_VOICE_PROVIDER.render({ text, voiceId, model });
      // This envelope comes only from our private broker, never from an HTTP vendor header/body.
      if (outcome?.contacted === false && (outcome.status === 400 || outcome.status === 503)
        && Object.keys(outcome).sort().join(',') === 'contacted,status') {
        await meter(env, sub, 'release', own);
        await meter(env, 'global', 'release', all);
        return unavailable(env, 'The private voice provider refused before contacting the vendor.');
      }
      response = outcome?.contacted === true ? outcome.response : null;
    } else {
      response = await fetch(`${ELEVENLABS}/v1/text-to-speech/${encodeURIComponent(voiceId)}/with-timestamps?output_format=mp3_44100_64`, {
        method: 'POST',
        headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, model_id: model })
      });
    }
  } catch {
    response = null;
  }
  if (!response?.ok) {
    // A sent request can be billed even when its answer is lost or fails. Retain every debit;
    // only a refusal before contacting the vendor (above) can release a reservation.
    return refuse(502, 'UPSTREAM', 'The voice could not be rendered. Try again in a moment.');
  }
  // From here the vendor has billed, so the reservation stands whatever happens next.
  const allowance = { used: reserved.used, limit, periodEnd: standing.exp };
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
  let mapped;
  try {
    mapped = mapAlignment({ atoms, alignment: rendered.alignment ?? {} });
  } catch {
    mapped = { ok: false, reason: 'it came without timing' }; // billed all the same, so it stays metered
  }
  if (!mapped.ok) return refuse(502, 'VOICE_REFUSED', `The performance did not match the text (${mapped.reason}).`);

  const hash = await sha256(`${voiceId}\n${model}\n${slug}\n${text}`);
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
    voiced: { hash, voice: slug, characters: n, model: `elevenlabs/${model}` },
    voices: { [slug]: { label: allowed.get(slug).label, model: `elevenlabs/${model}`, format: 'mp3', entries } }
  };
  return reply(200, { pack, audio: rendered.audio_base64, allowance }, admin ? {} : { 'Set-Cookie': await setCookie({ c: standing.c, s: standing.s, exp: standing.exp, start: standing.start, l: standing.l, iat: now }, env, now) });
}

/** Equal strings in a time that does not depend on where they differ. */
function sameText(a, b) {
  if (a.length !== b.length) return false;
  let difference = 0;
  for (let i = 0; i < a.length; i++) difference |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return difference === 0;
}

/**
 * Whether Stripe signed this body (Stripe's v1 scheme): the Stripe-Signature header is
 * `t=<unix seconds>,v1=<hex HMAC-SHA256 of "<t>.<raw body>">[,v1=...]`, and t is within
 * WEBHOOK_TOLERANCE_S of now, so a captured event cannot be replayed later.
 */
async function signedByStripe(header, bytes, secret, now) {
  const parts = String(header ?? '').split(',').map(part => part.trim().split('='));
  const t = parts.find(([key]) => key === 't')?.[1];
  const v1 = parts.filter(([key, value]) => key === 'v1' && value).map(([, value]) => value);
  if (!/^\d{1,12}$/u.test(t ?? '') || !v1.length || Math.abs(now - Number(t)) > WEBHOOK_TOLERANCE_S) return false;
  const prefix = encoder.encode(`${t}.`);
  const payload = new Uint8Array(prefix.byteLength + bytes.byteLength);
  payload.set(prefix);
  payload.set(bytes, prefix.byteLength);
  const mac = await crypto.subtle.sign('HMAC', await hmacKey(secret), payload);
  const expected = [...new Uint8Array(mac)].map(b => b.toString(16).padStart(2, '0')).join('');
  let ok = false;
  for (const candidate of v1) ok = sameText(candidate, expected) || ok; // every candidate is compared
  return ok;
}

const idOf = value => (typeof value === 'string' ? value : value?.id);

/** The subscriptions a charge or dispute paid for, traced through Stripe: PaymentIntent, then its invoice payments, then each invoice's subscription. */
async function subscriptionsPaidBy(object, env) {
  let paymentIntent = idOf(object.payment_intent);
  if (!paymentIntent && idOf(object.charge)) paymentIntent = idOf((await stripe(`/v1/charges/${encodeURIComponent(idOf(object.charge))}`, env)).payment_intent);
  if (!paymentIntent) return [];
  const payments = await stripe(`/v1/invoice_payments?payment[type]=payment_intent&payment[payment_intent]=${encodeURIComponent(paymentIntent)}&expand[]=data.invoice`, env);
  const found = (payments?.data ?? []).map(({ invoice }) => idOf(invoice?.parent?.subscription_details?.subscription ?? invoice?.subscription));
  return [...new Set(found.filter(id => typeof id === 'string' && id))];
}

/**
 * Stripe's events about money taken back or a subscription ending. Each becomes one
 * `event` on the subscription's meter, which applies it once (by event id) and refuses
 * further voicing at once. Any other event type is acknowledged and ignored.
 */
async function webhook(request, env) {
  if (!env.STRIPE_WEBHOOK_SECRET || !env.STRIPE_SECRET_KEY || !env.PLUS_METER) {
    return unavailable(env, 'The Stripe webhook is not switched on in this deployment (STRIPE_WEBHOOK_SECRET, STRIPE_SECRET_KEY or PLUS_METER is not set).');
  }
  const { refusal, bytes } = await readBytes(request, MAX_WEBHOOK_BYTES);
  if (refusal) return refusal;
  if (!(await signedByStripe(request.headers.get('Stripe-Signature'), bytes, env.STRIPE_WEBHOOK_SECRET, Math.floor(Date.now() / 1000)))) {
    return refuse(400, 'BAD_SIGNATURE', 'The Stripe signature does not verify.');
  }
  let event;
  try {
    event = JSON.parse(new TextDecoder().decode(bytes));
  } catch {
    event = null;
  }
  const object = event?.data?.object;
  if (typeof event?.id !== 'string' || !Number.isFinite(event.created) || !object) return refuse(400, 'BAD_REQUEST', 'Not a Stripe event.');
  if (event.livemode !== livemode(env)) return refuse(400, 'WRONG_MODE', 'This event is from the other Stripe mode than this deployment\'s key.');

  let subscriptions = [];
  let change;
  try {
    if (event.type === 'customer.subscription.deleted') {
      subscriptions = [object.id];
      change = { action: 'revoke', kind: 'deleted' };
    } else if (event.type === 'customer.subscription.updated') {
      subscriptions = [object.id];
      change = ACTIVE.has(object.status) ? { action: 'restore' } : { action: 'revoke', kind: 'status' };
    } else if (event.type === 'charge.refunded') {
      subscriptions = await subscriptionsPaidBy(object, env);
      change = object.refunded === true ? { action: 'revoke', kind: 'refund' } : { action: 'refresh' };
    } else if (event.type === 'charge.dispute.created') {
      subscriptions = await subscriptionsPaidBy(object, env);
      change = { action: 'revoke', kind: 'dispute' };
    }
  } catch {
    return refuse(500, 'UPSTREAM', 'Stripe could not be reached to trace the charge; Stripe will send the event again.');
  }
  const applied = [];
  for (const s of subscriptions.filter(id => typeof id === 'string' && id)) {
    await meter(env, `sub:${s}`, 'event', { id: event.id, created: event.created, ...change });
    applied.push(s);
  }
  // Money taken back ends the subscription in Stripe too: the meter's revocation is final,
  // so billing on would charge the reader for a voice that never returns.
  if (change?.kind === 'refund' || change?.kind === 'dispute') {
    try {
      for (const s of applied) await cancelPlus(s, env);
    } catch {
      return refuse(500, 'UPSTREAM', 'Stripe could not cancel the subscription; Stripe will send the event again.');
    }
  }
  return reply(200, { received: true, applied });
}

/** Cancels a Plus subscription at once. One that is already cancelled, gone, or not Plus is left alone; any other Stripe error throws. */
async function cancelPlus(id, env) {
  const path = `/v1/subscriptions/${encodeURIComponent(id)}`;
  let subscription;
  try {
    subscription = await stripe(path, env);
  } catch (error) {
    if (error?.status === 404) return;
    throw error;
  }
  if (subscription?.status === 'canceled' || !env.PLUS_PRICE_ID || !itemsOf(subscription).some(item => priceIdOf(item) === env.PLUS_PRICE_ID)) return;
  await stripe(path, env, 'DELETE');
}

const adminLoginConfigured = env => /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/u.test(env.PLUS_ADMIN_ACCESS_ISSUER ?? '') && typeof env.PLUS_ADMIN_ACCESS_AUD === 'string' && Boolean(env.PLUS_ADMIN_ACCESS_AUD.trim());
const providerReady = env => typeof env.PLUS_VOICE_PROVIDER?.render === 'function' || Boolean(env.ELEVENLABS_API_KEY);
async function voiceReady(env) {
  const allowed = voices(env);
  if (!providerReady(env) || !env.PLUS_VOICE_ID || !allowed || !dailyCap(env) || !env.PLUS_METER || !spendingPolicy(env)) return false;
  if (env.PLUS_VOICE_PROVIDER == null) return true;
  if (typeof env.PLUS_VOICE_PROVIDER.render !== 'function' || typeof env.PLUS_VOICE_PROVIDER.ready !== 'function') return false;
  let timer;
  try {
    const result = await Promise.race([
      env.PLUS_VOICE_PROVIDER.ready({ voiceIds: [...allowed.values()].map(voice => voice.id), model: env.PLUS_VOICE_MODEL || 'eleven_flash_v2_5' }),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Provider readiness timed out')), 5000); })
    ]);
    return result?.ready === true;
  } catch { return false; } finally { clearTimeout(timer); }
}

/** A read-only entitlement view. Identity always comes from verified Access or a server-signed
 * Stripe receipt; client flags and cached browser allowance are never consulted.
 */
async function status(request, env, now) {
  const policy = spendingPolicy(env);
  const admin = await getAdmin(request, env);
  const result = { admin: Boolean(admin), subscriber: false, available: false, adminLogin: adminLoginConfigured(env), allowance: null };
  let standing, name;
  if (admin) {
    const budget = adminBudget(env, policy);
    if (!budget || !await voiceReady(env)) return reply(200, result);
    const date = new Date(now * 1000);
    standing = { start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000, exp: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000, budgetMicros: budget.micros };
    name = 'admin';
  } else {
    if (!policy || !env.STRIPE_SECRET_KEY || !env.PLUS_COOKIE_SECRET || !env.PLUS_PRICE_ID || !env.PLUS_METER || notLive(env)) return reply(200, result);
    const current = await verify(cookieValue(request), env, now);
    if (!current || now > current.exp + GRACE_S) return reply(200, result);
    name = `sub:${current.s}`;
    const kept = await meter(env, name, 'inspect', { ttl: STANDING_TTL_S });
    if (kept.revoked) return reply(200, result);
    if (kept.fresh && (kept.standing === null || (kept.standing.l === livemode(env) && kept.standing.budgetPolicy === JSON.stringify(policy)))) standing = kept.standing;
    else {
      try {
        const subscription = await stripe(`/v1/subscriptions/${encodeURIComponent(current.s)}`, env);
        standing = claimFor(subscription, env);
        if (standing) {
          const budgetMicros = await paidBudget(subscription, standing, env, policy, stripe);
          standing = budgetMicros ? { ...standing, budgetMicros, budgetPolicy: JSON.stringify(policy) } : null;
        }
      } catch (error) {
        if (error?.status !== 404) throw error;
        standing = null;
      }
      await meter(env, name, 'standing', { standing, revision: kept.revision });
    }
    if (!standing || standing.s !== current.s || !Number.isSafeInteger(standing.budgetMicros) || standing.budgetMicros <= 0) return reply(200, result);
    result.subscriber = true;
  }
  const inspected = await meter(env, name, 'inspect', { period: standing.start, ttl: STANDING_TTL_S });
  if (inspected.revoked) { result.subscriber = false; return reply(200, result); }
  const limit = Math.min(VOICE_ALLOWANCE, Math.floor(standing.budgetMicros / policy.rate));
  result.allowance = { used: inspected.used, limit, periodEnd: standing.exp };
  result.available = await voiceReady(env) && inspected.used < limit && (inspected.spentMicros ?? 0) + policy.rate <= standing.budgetMicros;
  return reply(200, result);
}

async function routePlus(request, env) {
  const path = new URL(request.url).pathname;
  if (path === '/api/plus/status' || path === '/api/plus/admin/login' || path === '/api/plus/admin/check') {
    if (request.method !== 'GET') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use GET.');
    if (path === '/api/plus/status') {
      if (typeof env.DECISION_LIMITER?.limit !== 'function') return unavailable(env, 'The Plus status address limiter is not configured.');
      if (await limited(request, env.DECISION_LIMITER, 'plus-status')) return refuse(429, 'RATE_LIMITED', 'Too many requests were sent. Try again in a minute.');
      return status(request, env, Math.floor(Date.now() / 1000));
    }
    if (path === '/api/plus/admin/check') {
      // The probe forwards only a cookie. Access must inject this assertion after
      // checking the session; without it, a deleted/misconfigured app must deny.
      const checked = request.headers.get('Cf-Access-Jwt-Assertion') ? await verifyAdmin(request, env) : null;
      return checked ? reply(200, { subject: checked.subject }) : refuse(403, 'FORBIDDEN_ADMIN', 'Administrator sign-in is required.');
    }
    if (!(await getAdmin(request, env))) return refuse(403, 'FORBIDDEN_ADMIN', 'Administrator sign-in is required.');
    const destination = new URL(request.url).search === '?returnTo=voice-demo' ? '/voice-demo' : '/settings';
    return reply(303, null, { Location: destination });
  }
  if (path === '/api/plus/voices') {
    if (request.method !== 'GET') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use GET.');
    const allowed = voices(env);
    if (!allowed) return unavailable(env, 'The Plus voices are not set in this deployment (PLUS_VOICES).');
    return reply(200, [...allowed].map(([slug, { label }]) => ({ slug, label })));
  }
  if (path === '/api/plus/config') {
    if (request.method !== 'GET') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use GET.');
    return reply(200, { paymentLink: paymentLink(env) });
  }
  if (request.method !== 'POST') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  // Stripe sends no Origin; its signature is the check.
  if (path === '/api/plus/stripe-webhook') return webhook(request, env);
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return refuse(403, 'FORBIDDEN_ORIGIN', 'Plus answers only the page it serves.');
  }
  if (path === '/api/plus/forget') return reply(204, null, { 'Set-Cookie': CLEAR_COOKIE });
  const admin = path === '/api/plus/voice' ? await getAdmin(request, env) : null;
  if (admin) return voice(request, env, Math.floor(Date.now() / 1000), admin);
  if (!env.STRIPE_SECRET_KEY || !env.PLUS_COOKIE_SECRET) {
    return unavailable(env, 'Plus is not switched on in this deployment (STRIPE_SECRET_KEY or PLUS_COOKIE_SECRET is not set).');
  }
  const blocked = notLive(env);
  if (blocked) return unavailable(env, `Plus requires live Stripe here (PLUS_REQUIRE_LIVE): ${blocked}.`);
  const now = Math.floor(Date.now() / 1000);
  if (path === '/api/plus/claim') return claim(request, env, now);
  return voice(request, env, now);
}

/**
 * A character meter: one instance per subscription (`sub:<id>`, keyed by billing
 * period start) and one for everyone (`global`, keyed by UTC day). A Durable Object
 * runs one request at a time, and no operation below awaits between its reads and
 * writes, so no two reservations can both fit in the same last gap. SQLite-backed
 * (wrangler `new_sqlite_classes`), the only kind the Workers Free plan offers; the
 * synchronous `ctx.storage.kv` is that backend's key-value API.
 *
 *   POST /reserve { period, n, limit[, day, dayLimit] }  -> { ok, used[, revoked | dayFull] }  adds n unless used + n would
 *        pass limit, or (with `day`, a UTC date) the day's count + n would pass dayLimit, or the subscription is revoked
 *   POST /release { period, n[, day] }  -> { ok, used }  gives n back only before a vendor request is sent
 *
 * A subscription's instance also keeps what decides whether it may voice, so most
 * refusals cost no Stripe call:
 *   POST /gate { n, limit, rate, ttl }  -> { revoked } | { limited } | { exhausted, used } | { fresh, standing }
 *        counts the request against `rate` a minute; `exhausted` when n would pass `limit`
 *        in the period the last standing named, while that period lasts; `standing` is the
 *        last one Stripe gave (null: it did not stand), `fresh` when under `ttl` seconds old
 *   POST /standing { standing }         keeps what Stripe just said, with the time
 *   POST /event { id, created, action: 'revoke' | 'restore', kind? }
 *        a Stripe webhook event, applied once by id. A revocation for a refund, dispute or
 *        deletion is final; one for a status (past_due, unpaid, ...) is lifted by a later
 *        'restore'. Older events than the last status event applied do not move the status.
 *        Every event forgets the kept standing.
 *
 * One period and one count, never a history: a newer period overwrites the old count; the
 * same for the day's count (`today`), which a newer day overwrites.
 * (Stored as `since`: the earlier `period` held a period end and is ignored.)
 * Everything an instance keeps is listed in PRIVACY.md ("What the server keeps").
 */
export class PlusMeter {
  constructor(ctx) {
    this.kv = ctx.storage.kv;
  }

  /** What is used in `period`: 0 for a newer period, and `stale` for an older one. */
  usage(period) {
    const current = this.kv.get('since');
    return { stale: current !== undefined && period < current, used: current === period ? this.kv.get('used') ?? 0 : 0 };
  }

  async fetch(request) {
    const op = new URL(request.url).pathname;
    const body = await request.json();
    const now = Math.floor(Date.now() / 1000);
    if (op === '/inspect') {
      const kept = this.kv.get('standing');
      const usage = body.period === undefined ? { used: 0 } : this.usage(body.period);
      return Response.json({ revision: this.kv.get('revision') ?? 0, used: usage.used, spentMicros: this.kv.get('since') === body.period ? this.kv.get('spentMicros') ?? 0 : 0, revoked: Boolean(this.kv.get('revoked')), fresh: Boolean(kept) && now - kept.at < body.ttl, standing: kept?.standing ?? null });
    }
    if (op === '/gate') return Response.json(this.gate(body, now));
    if (op === '/standing') {
      if (body.revision !== (this.kv.get('revision') ?? 0)) return Response.json({ ok: false, changed: true });
      this.kv.put('standing', { standing: body.standing ?? null, at: now });
      return Response.json({ ok: true });
    }
    if (op === '/event') return Response.json(this.event(body));
    const { period, n, limit, day, dayLimit, costMicros, spendLimitMicros, rateMicros } = body;
    if (!Number.isInteger(n) || n < 0 || (typeof period !== 'number' && typeof period !== 'string')) {
      return Response.json({ ok: false, error: 'bad meter request' }, { status: 400 });
    }
    // A request still carrying an older period, as one can at a renewal, reserves
    // nothing and releases nothing, so it cannot roll the count back.
    const { stale, used } = this.usage(period);
    if (op === '/reserve') {
      if (body.revision !== undefined && body.revision !== (this.kv.get('revision') ?? 0)) return Response.json({ ok: false, used, changed: true });
      if (this.kv.get('revoked')) return Response.json({ ok: false, used, revoked: true });
      const money = costMicros !== undefined;
      const spentMicros = this.kv.get('since') === period ? this.kv.get('spentMicros') ?? used * rateMicros : 0;
      if (money && (!Number.isSafeInteger(costMicros) || costMicros < 0 || !Number.isSafeInteger(spendLimitMicros) || spendLimitMicros <= 0 || !Number.isSafeInteger(rateMicros) || rateMicros < 60 || !Number.isSafeInteger(spentMicros) || spentMicros + costMicros > spendLimitMicros)) return Response.json({ ok: false, used });
      if (stale || !(used + n <= limit)) return Response.json({ ok: false, used });
      const today = this.kv.get('today');
      const dayUsed = day !== undefined && today?.day === day ? today.used : 0;
      if (day !== undefined && !(dayUsed + n <= dayLimit)) return Response.json({ ok: false, used, dayFull: true });
      if (day !== undefined) this.kv.put('today', { day, used: dayUsed + n });
      this.kv.put('since', period);
      this.kv.put('used', used + n);
      if (money) this.kv.put('spentMicros', spentMicros + costMicros);
      return Response.json({ ok: true, used: used + n });
    }
    if (op === '/release') {
      const today = this.kv.get('today');
      if (day !== undefined && today?.day === day) this.kv.put('today', { day, used: Math.max(0, today.used - n) });
      if (stale || this.kv.get('since') !== period) return Response.json({ ok: true, used });
      this.kv.put('used', Math.max(0, used - n));
      if (Number.isSafeInteger(costMicros) && costMicros >= 0) this.kv.put('spentMicros', Math.max(0, (this.kv.get('spentMicros') ?? used * rateMicros) - costMicros));
      return Response.json({ ok: true, used: Math.max(0, used - n) });
    }
    return Response.json({ ok: false, error: 'no such meter operation' }, { status: 404 });
  }

  gate({ n, limit, rate, ttl }, now) {
    if (this.kv.get('revoked')) return { revoked: true };
    const minute = Math.floor(now / 60);
    const counted = this.kv.get('rate');
    const count = counted?.minute === minute ? counted.count + 1 : 1;
    this.kv.put('rate', { minute, count });
    if (count > rate) return { limited: true };
    const kept = this.kv.get('standing');
    const standing = kept?.standing ?? null;
    if (standing && now < standing.exp) {
      const { used } = this.usage(standing.start);
      if (used + n > limit) return { exhausted: true, used };
    }
    return { revision: this.kv.get('revision') ?? 0, fresh: Boolean(kept) && now - kept.at < ttl, standing };
  }

  event({ id, created, action, kind }) {
    const seen = this.kv.get('events') ?? [];
    if (typeof id !== 'string' || seen.includes(id)) return { ok: true, duplicate: true };
    this.kv.put('events', [...seen, id].slice(-50));
    this.kv.put('revision', (this.kv.get('revision') ?? 0) + 1);
    this.kv.delete('standing');
    const revoked = this.kv.get('revoked');
    if (action === 'revoke' && kind !== 'status') {
      this.kv.put('revoked', { kind, created });
    } else if (action === 'revoke' || action === 'restore') {
      // Stripe does not promise order: only the newest status event says where the status stands.
      if (created < (this.kv.get('statusAt') ?? 0)) return { ok: true, outdated: true };
      this.kv.put('statusAt', created);
      if (action === 'revoke' && (!revoked || revoked.kind === 'status')) this.kv.put('revoked', { kind, created });
      if (action === 'restore' && revoked?.kind === 'status') this.kv.delete('revoked');
    }
    return { ok: true };
  }
}

export const PLUS_INTERNALS = { sign, verify, livemode, COOKIE, DAY_S, GRACE_S, MAX_COOKIE_S, MAX_BODY_BYTES, WEBHOOK_TOLERANCE_S };

/** Storage/configuration failures never fall through to a billable vendor call. */
export async function handlePlus(request, env) {
  try { return await routePlus(request, env); } catch { return unavailable(env, 'The Plus entitlement or spending meter could not be verified.'); }
}
