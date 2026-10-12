/**
 * Plus: the paid voice, gated by a Stripe receipt (MasterMind RFC 0001, section 2).
 * The Worker keeps no raw reader text. Account-private audio and numeric timing
 * are saved for 30 days in the existing SQLite Durable Object namespace. A reader who paid holds a signed,
 * HttpOnly voice cookie naming their subscription; the allowance lives on the server, in
 * one Durable Object per subscription (PlusMeter below), and Stripe is asked again
 * before every voicing.
 *
 *   POST /api/plus/checkout { request_id } server-priced Checkout and browser binding
 *   POST /api/plus/portal  {}             verified customer billing portal
 *   POST /api/plus/recover { email }      generic acknowledgement; verified-email recovery
 *   POST /api/plus/restore { token }      consumes an emailed proof once
 *   POST /api/plus/claim   { session_id }   the Checkout success page; 204 and the cookie once Stripe confirms
 *   POST /api/plus/voice   { atoms }        voices one short reading on the lab's key (contract below)
 *   POST /api/plus/audio/erase {}           deletes this verified account's saved audio and timing, fencing unfinished writes
 *   POST /api/plus/forget                   clears voice and billing identity cookies
 *   GET  /api/plus/voices                   the voices a reader may choose: [{ slug, label }], never a vendor id; no cookie needed
 *   GET  /api/plus/config                   { paymentLink }: PLUS_PAYMENT_LINK when it is an https://buy.stripe.com/ link of the
 *                                           same Stripe mode as STRIPE_SECRET_KEY (a test_ link only with a test key), else null;
 *                                           also checkoutAvailable, recoveryAvailable and the funded offer (see docs/PLUS-CUSTOMER-LIFECYCLE.md)
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
 *     opaque id, not a public URL. After current entitlement verification, an exact
 *     account/text/provider/voice/model/settings hit reuses saved audio without spending.
 *     `cache: { hit, expiresAt, scope }` describes the private render; the response
 *     re-signs the cookie. Expired, erased, corrupt or uncertain renders cannot silently
 *     regenerate. Pending renders return 409; account storage capacity returns 507.
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
 * subscription and more than SUB_RATE_PER_MINUTE requests a minute. Active standing
 * is checked even for a replay with an exhausted allowance; only a cache miss spends.
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
 * STRIPE_SECRET_KEY is a live key (sk_live_/rk_live_) and STRIPE_WEBHOOK_SECRET is set.
 * Acquisition links separately enforce their own mode and new Checkout has a readiness gate. Production once served a test-mode link with a
 * test key, and Stripe's public test card then bought real ElevenLabs characters.
 */
import { getAdmin, verifyAdmin } from './plus-admin.mjs';
import { PlusAudio } from './plus-audio.mjs';
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

const CUSTOMER_ROUTES = new Set(['/api/plus/checkout', '/api/plus/portal', '/api/plus/recover', '/api/plus/restore']);
const ROUTES = new Set([...CUSTOMER_ROUTES, '/api/plus/claim', '/api/plus/voice', '/api/plus/audio/erase', '/api/plus/forget', '/api/plus/voices', '/api/plus/config', '/api/plus/stripe-webhook', '/api/plus/status', '/api/plus/admin/login', '/api/plus/admin/check']);

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
 * Under PLUS_REQUIRE_LIVE, what keeps subscriber service from using live Stripe, by name
 * (never a value); null when nothing does, or when the deployment does not require live.
 */
function notLive(env) {
  if (!requireLive(env)) return null;
  const problems = [
    !livemode(env) && 'STRIPE_SECRET_KEY is not a live key',
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

function cookieValue(request, cookieName = COOKIE) {
  const header = request.headers.get('Cookie') ?? '';
  for (const part of header.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === cookieName) return rest.join('=');
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

async function stripe(path, env, method = 'GET', fields, idempotencyKey) {
  const response = await fetch(`${STRIPE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, 'Stripe-Version': STRIPE_VERSION, ...(fields ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}), ...(idempotencyKey ? { 'Idempotency-Key': idempotencyKey } : {}) },
    ...(fields ? { body: new URLSearchParams(fields).toString() } : {}),
    signal: AbortSignal.timeout(10_000)
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
  return { c: customer, s: subscription.id, exp, start, l: livemode(env), ...(subscription.metadata?.rise_offer === OFFER_ID ? { offer: OFFER_ID } : {}) };
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
  // Each claim costs a Stripe call; legacy receipts need no browser proof, so all claims have a strict address limit.
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
  if (session.client_reference_id?.startsWith('plus:')) {
    const purchase = await verify(cookieValue(request, CHECKOUT_COOKIE), purposeEnv(env, 'checkout'), now);
    if (!purchase || purchase.exp <= now || `plus:${purchase.s}` !== session.client_reference_id) return refuse(401, 'CHECKOUT_BROWSER_REQUIRED', 'Open the checkout in the browser where you started it, or restore your subscription by email.');
  }
  const paid = session.payment_status === 'paid' && claimFor(session.subscription, env);
  if (!paid) return refuse(402, 'PLUS_REQUIRED', 'This purchase is not an active Plus subscription.');
  return withBilling(reply(204, null, { 'Set-Cookie': await setCookie({ ...paid, iat: now }, env, now) }), paid, env, now);
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
  const missing = ['PLUS_VOICE_ID', 'PLUS_VOICES', 'PLUS_METER', ...(!admin ? ['PLUS_PRICE_ID', ...(requireLive(env) ? ['STRIPE_WEBHOOK_SECRET'] : [])] : [])]
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

  const n = text.length;
  // All administrators share one explicit monthly budget; adding administrators never multiplies it.
  const sub = admin ? 'admin' : `sub:${current.s}`;
  const lapsed = () => refuse(402, 'PLUS_REQUIRED', 'This is no longer an active Plus subscription.', { 'Set-Cookie': CLEAR_COOKIE });
  const spent = () => refuse(402, 'PLUS_ALLOWANCE', `This period's voice allowance is used up. It resets with your next billing period.`);
  // The subscription's own meter first: revoked, too many requests, or no room left costs no Stripe call.
  const gate = await meter(env, sub, 'gate', { n: 0, limit: VOICE_ALLOWANCE, rate: SUB_RATE_PER_MINUTE, ttl: STANDING_TTL_S, accessOnly: true });
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
  if (!standing || (!admin && (standing.s !== current.s || standing.c !== current.c))) return lapsed();
  if (!Number.isSafeInteger(standing.budgetMicros) || standing.budgetMicros <= 0) return lapsed();
  const limit = Math.min(characterLimit(standing), Math.floor(standing.budgetMicros / policy.rate));
  const scope = await audioScope(admin, standing, env);
  const model = env.PLUS_VOICE_MODEL || 'eleven_flash_v2_5';
  // Version every output-affecting default, including the vendor endpoint and format.
  // The principal is a verified billing customer (test/live separated), never a client id.
  const hash = await sha256(JSON.stringify(['rise.plus.audio.v1', scope, 'elevenlabs', '/v1/text-to-speech/with-timestamps', voiceId, model, 'mp3_44100_64', 'vendor-default-settings-v1', text]));
  const cacheName = `audio:v1:${scope}`;
  const cached = await meter(env, cacheName, 'audio/claim', { render: hash });
  const responseFor = async (mapped, audio, allowance, expiresAt, hit) => reply(200, {
    pack: voicePack(mapped, hash, slug, allowed.get(slug).label, model, n), audio, allowance,
    cache: { hit, expiresAt, scope }
  }, admin ? {} : { 'Set-Cookie': await setCookie({ ...standing, iat: now }, env, now) });
  if (cached.state === 'ready') {
    const mapped = mapSavedTiming(atoms, text, cached.timings);
    if (!mapped.ok) return audioRefusal('unavailable');
    const inspected = await meter(env, sub, 'inspect', { period: standing.start, ttl: STANDING_TTL_S });
    if (inspected.revoked || inspected.revision !== gate.revision) return lapsed();
    return responseFor(mapped, cached.audio, { used: inspected.used, limit, periodEnd: standing.exp }, cached.expiresAt, true);
  }
  if (cached.state !== 'claimed' || typeof cached.token !== 'string') return audioRefusal(cached.state);
  const cacheClaim = { render: hash, token: cached.token };
  const abandonClaim = async response => {
    await meter(env, cacheName, 'audio/abandon', cacheClaim);
    return response;
  };
  const releaseClaim = async response => {
    await meter(env, cacheName, 'audio/release', cacheClaim);
    return response;
  };
  if (n > limit) return releaseClaim(spent());
  if (!providerReady(env)) return releaseClaim(unavailable(env, 'ELEVENLABS_API_KEY or the private voice provider is not set.'));
  if (dailyCap(env) === null) return releaseClaim(unavailable(env, 'PLUS_DAILY_CHAR_CAP is not set safely.'));
  if (!await voiceReady(env)) return releaseClaim(unavailable(env, 'The private voice provider is not ready.'));

  const day = new Date(now * 1000).toISOString().slice(0, 10);
  const own = { period: standing.start, n, limit, day, dayLimit: admin ? adminCap.dayLimit : subDailyCap(env), costMicros: n * policy.rate, spendLimitMicros: standing.budgetMicros, rateMicros: policy.rate, revision: gate.revision, operation: cached.token };
  const all = { period: day, n, limit: dailyCap(env), operation: cached.token };
  const reserved = await meter(env, sub, 'reserve', own);
  if (reserved.changed) return releaseClaim(unavailable(env, 'The subscription changed while its allowance was being verified.'));
  if (reserved.revoked) return releaseClaim(lapsed());
  if (reserved.dayFull) return releaseClaim(refuse(429, 'PLUS_DAILY_LIMIT', `Today's voice limit is reached. It resets at midnight UTC.`));
  if (!reserved.ok) return releaseClaim(spent());
  if (!(await meter(env, 'global', 'reserve', all)).ok) {
    await meter(env, sub, 'release', own);
    return releaseClaim(refuse(503, 'PLUS_DAILY_CAP', 'The Plus voice has reached today\'s limit. Try again tomorrow.'));
  }

  let response;
  try {
    if (typeof env.PLUS_VOICE_PROVIDER?.render === 'function') {
      const outcome = await env.PLUS_VOICE_PROVIDER.render({ text, voiceId, model });
      // This envelope comes only from our private broker, never from an HTTP vendor header/body.
      if (outcome?.contacted === false && (outcome.status === 400 || outcome.status === 503)
        && Object.keys(outcome).sort().join(',') === 'contacted,status') {
        await meter(env, sub, 'release', own);
        await meter(env, 'global', 'release', all);
        return releaseClaim(unavailable(env, 'The private voice provider refused before contacting the vendor.'));
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
    return abandonClaim(refuse(502, 'UPSTREAM', 'The voice could not be confirmed. It will not be generated or charged again automatically.'));
  }
  // From here the vendor has billed, so the reservation stands whatever happens next.
  const allowance = { used: reserved.used, limit, periodEnd: standing.exp };
  let rendered;
  try {
    const bounded = await readBytes(response, 24 * 1024 * 1024);
    rendered = bounded.bytes ? JSON.parse(new TextDecoder().decode(bounded.bytes)) : null;
  } catch {
    rendered = null;
  }
  if (typeof rendered?.audio_base64 !== 'string' || !rendered.audio_base64) {
    return abandonClaim(refuse(502, 'UPSTREAM', 'The voice could not be confirmed. It will not be generated or charged again automatically.'));
  }
  // The raw alignment names the characters sent; normalized_alignment names what the voice said instead and would fail the letter check.
  let mapped;
  try {
    mapped = mapAlignment({ atoms, alignment: rendered.alignment ?? {} });
  } catch {
    mapped = { ok: false, reason: 'it came without timing' }; // billed all the same, so it stays metered
  }
  if (!mapped.ok) return abandonClaim(refuse(502, 'VOICE_REFUSED', `The performance did not match the text (${mapped.reason}).`));

  const timings = canonicalTiming(rendered.alignment);
  if (!timings) return abandonClaim(refuse(502, 'VOICE_REFUSED', 'The performance came without valid timing.'));
  const saved = await meter(env, cacheName, 'audio/complete', { ...cacheClaim, audio: rendered.audio_base64, timings });
  if (saved.state !== 'ready') return audioRefusal('unavailable');
  const inspected = await meter(env, sub, 'inspect', { period: standing.start, ttl: STANDING_TTL_S });
  if (inspected.revoked || inspected.revision !== gate.revision) return lapsed();
  return responseFor(mapped, rendered.audio_base64, allowance, saved.expiresAt, false);
}

async function audioScope(admin, standing, env) {
  const identity = admin ? ['admin', env.PLUS_ADMIN_ACCESS_ISSUER, admin.subject] : ['customer', standing.l, standing.c];
  return sha256(JSON.stringify(identity));
}

function audioRefusal(state) {
  if (state === 'full') return refuse(507, 'PLUS_AUDIO_FULL', 'Saved voice storage is full. No new voice was charged. Contact support; deleting audio cannot clear the safety-record limit.');
  if (state === 'pending') return refuse(409, 'PLUS_AUDIO_PENDING', 'This voice is already being prepared. No second voice was charged. Try replaying it shortly.');
  return refuse(409, 'PLUS_AUDIO_UNAVAILABLE', 'This saved voice is expired, deleted, or could not be confirmed. It will not be generated or charged again automatically. Contact support.');
}

const spokenLetters = text => String(text).normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
function canonicalTiming(alignment) {
  const timings = [];
  if (!Array.isArray(alignment?.characters) || !Array.isArray(alignment.character_start_times_seconds) || !Array.isArray(alignment.character_end_times_seconds)) return null;
  for (let i = 0; i < alignment.characters.length; i++) {
    const start = alignment.character_start_times_seconds[i], end = alignment.character_end_times_seconds[i];
    if (!Number.isFinite(start) || !Number.isFinite(end) || start < 0 || end < start) return null;
    for (const _letter of spokenLetters(alignment.characters[i])) timings.push(start, end);
  }
  return timings;
}
function mapSavedTiming(atoms, text, timings) {
  const characters = [...spokenLetters(text)];
  if (!Array.isArray(timings) || timings.length !== characters.length * 2) return { ok: false };
  return mapAlignment({ atoms, alignment: { characters, character_start_times_seconds: characters.map((_, i) => timings[2 * i]), character_end_times_seconds: characters.map((_, i) => timings[2 * i + 1]) } });
}
function voicePack(mapped, hash, slug, label, model, n) {
  const asset = `voiced:${hash}`;
  const entries = {};
  for (const atom of mapped.atoms) {
    const key = voiceAssetKey(atom.text);
    if (entries[key]) continue;
    entries[key] = {
      text: atom.text, asset, mimeType: 'audio/mpeg', fromMs: Math.round(atom.startMs), toMs: Math.round(atom.endMs),
      durationMs: Math.round(atom.endMs - atom.startMs), onsetsMs: atom.onsetsMs.map(t => Math.max(0, Math.round(t - atom.startMs)))
    };
  }
  return { schema: VOICE_PACK_SCHEMA, voiced: { hash, voice: slug, characters: n, model: `elevenlabs/${model}` },
    voices: { [slug]: { label, model: `elevenlabs/${model}`, format: 'mp3', entries } } };
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
      change = ACTIVE.has(object.status) ? { action: 'restore', subscriptionStatus: object.status } : { action: 'revoke', kind: 'status', subscriptionStatus: object.status };
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
  const identity = await billingIdentity(request, env, now);
  // Nothing is for sale without a served payment link or checkout, so nobody can subscribe.
  const forSale = paymentLink(env) !== null || env.PLUS_CHECKOUT_ENABLED === 'true';
  const result = { canSubscribe: forSale && !identity, billingAvailable: billingReady(env) && Boolean(identity), admin: Boolean(admin), subscriber: false, available: false, adminLogin: adminLoginConfigured(env), allowance: null };
  let standing, name;
  if (admin) {
    const budget = adminBudget(env, policy);
    if (!budget) return reply(200, result);
    const date = new Date(now * 1000);
    standing = { start: Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1) / 1000, exp: Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 1) / 1000, budgetMicros: budget.micros };
    name = 'admin';
  } else {
    if (!policy || !env.STRIPE_SECRET_KEY || !env.PLUS_COOKIE_SECRET || !env.PLUS_PRICE_ID || !env.PLUS_METER || notLive(env)) return reply(200, result);
    const current = identity;
    if (!current) return reply(200, result);
    name = `sub:${current.s}`;
    const kept = await meter(env, name, 'inspect', { ttl: STANDING_TTL_S });
    const eligible = status => forSale && (status === 'canceled' || status === 'incomplete_expired');
    result.canSubscribe = eligible(kept.subscriptionStatus);
    if (kept.revoked) return reply(200, result);
    if (kept.fresh && (kept.standing === null || (kept.standing.l === livemode(env) && kept.standing.budgetPolicy === JSON.stringify(policy)))) standing = kept.standing;
    else {
      let subscriptionStatus = null;
      try {
        const subscription = await stripe(`/v1/subscriptions/${encodeURIComponent(current.s)}`, env);
        subscriptionStatus = subscription.status;
        result.canSubscribe = eligible(subscriptionStatus);
        standing = claimFor(subscription, env);
        if (standing) {
          const budgetMicros = await paidBudget(subscription, standing, env, policy, stripe);
          standing = budgetMicros ? { ...standing, budgetMicros, budgetPolicy: JSON.stringify(policy) } : null;
        }
      } catch (error) {
        if (error?.status !== 404) throw error;
        result.canSubscribe = false;
        standing = null;
      }
      await meter(env, name, 'standing', { standing, revision: kept.revision, subscriptionStatus });
    }
    if (!standing || standing.s !== current.s || standing.c !== current.c || !Number.isSafeInteger(standing.budgetMicros) || standing.budgetMicros <= 0) return reply(200, result);
    result.subscriber = true;
  }
  const inspected = await meter(env, name, 'inspect', { period: standing.start, ttl: STANDING_TTL_S });
  if (inspected.revoked) { result.subscriber = false; return reply(200, result); }
  result.audioScope = await audioScope(admin, standing, env);
  const limit = Math.min(characterLimit(standing), Math.floor(standing.budgetMicros / policy.rate));
  result.allowance = { used: inspected.used, limit, periodEnd: standing.exp };
  result.available = await voiceReady(env) && inspected.used < limit && (inspected.spentMicros ?? 0) + policy.rate <= standing.budgetMicros;
  const response = reply(200, result);
  if (result.subscriber) {
    response.headers.append('Set-Cookie', await setCookie({ ...standing, iat: now }, env, now));
    return withBilling(response, standing, env, now);
  }
  return response;
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
    return reply(303, null, { Location: new URL(request.url).searchParams.get('returnTo') === 'voice-demo' ? '/voice-demo' : '/settings' });
  }
  if (path === '/api/plus/voices') {
    if (request.method !== 'GET') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use GET.');
    const allowed = voices(env);
    if (!allowed) return unavailable(env, 'The Plus voices are not set in this deployment (PLUS_VOICES).');
    return reply(200, [...allowed].map(([slug, { label }]) => ({ slug, label })));
  }
  if (path === '/api/plus/config') {
    if (request.method !== 'GET') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use GET.');
    return lifecycleConfig(request, env);
  }
  if (request.method !== 'POST') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use POST.');
  // Stripe sends no Origin; its signature is the check.
  if (path === '/api/plus/stripe-webhook') return webhook(request, env);
  if (request.headers.get('Origin') !== new URL(request.url).origin) {
    return refuse(403, 'FORBIDDEN_ORIGIN', 'Plus answers only the page it serves.');
  }
  if (path === '/api/plus/forget') {
    const response = reply(204, null, { 'Set-Cookie': CLEAR_COOKIE });
    response.headers.append('Set-Cookie', `${BILLING_COOKIE}=; Max-Age=0; ${ATTRIBUTES}`);
    return response;
  }
  if (path === '/api/plus/audio/erase') {
    const { refusal } = await readJson(request);
    if (refusal) return refusal;
    if (await limited(request, env.DECISION_LIMITER, 'plus-audio-erase')) return refuse(429, 'RATE_LIMITED', 'Too many requests were sent. Try again in a minute.');
    const identity = await (await status(request, env, Math.floor(Date.now() / 1000))).json();
    if (!identity.audioScope) return refuse(402, 'PLUS_REQUIRED', 'An active Plus account is needed to delete its saved voice.');
    const erased = await meter(env, `audio:v1:${identity.audioScope}`, 'audio/erase', {});
    return erased.erased === true ? reply(200, { erased: true }) : unavailable(env, 'Saved voice could not be deleted.');
  }
  if (CUSTOMER_ROUTES.has(path)) return lifecycle(request, env, path, Math.floor(Date.now() / 1000));
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

// Customer lifecycle stays separate from staff Access and from voice entitlements.
const OFFER = Object.freeze({ amount: 899, currency: 'usd', interval: 'month', characterLimit: 60_000 });
const OFFER_ID = 'v1_60000';
const BILLING_COOKIE = '__Secure-rise_plus_billing';
const CHECKOUT_COOKIE = '__Secure-rise_plus_checkout';
const RECOVERY_S = 15 * 60;
const offerCache = new WeakMap();
const purposeEnv = (env, purpose) => ({ ...env, PLUS_COOKIE_SECRET: `${env.PLUS_COOKIE_SECRET}:${purpose}`, PLUS_COOKIE_SECRET_PREVIOUS: env.PLUS_COOKIE_SECRET_PREVIOUS ? `${env.PLUS_COOKIE_SECRET_PREVIOUS}:${purpose}` : undefined });
const recoveryReady = env => Boolean(env.STRIPE_SECRET_KEY && env.PLUS_COOKIE_SECRET && env.PLUS_PRICE_ID && env.PLUS_METER && env.PLUS_CLAIM_LIMITER && env.RESEND_API_KEY && typeof env.PLUS_EMAIL_FROM === 'string' && env.PLUS_EMAIL_FROM.includes('@') && !notLive(env));
const billingReady = env => Boolean(env.STRIPE_SECRET_KEY && env.PLUS_COOKIE_SECRET && env.PLUS_PRICE_ID && env.PLUS_PORTAL_CONFIGURATION && !notLive(env));

async function billingIdentity(request, env, now) {
  const billing = await verify(cookieValue(request, BILLING_COOKIE), purposeEnv(env, 'billing'), now);
  if (billing && billing.exp > now) return billing;
  // Receipts issued before billing cookies shipped remain usable to manage billing.
  return verify(cookieValue(request), env, now);
}

async function withBilling(response, claim, env, now) {
  const token = await sign({ c: claim.c, s: claim.s, l: livemode(env), iat: now, exp: now + MAX_COOKIE_S }, `${env.PLUS_COOKIE_SECRET}:billing`);
  response.headers.append('Set-Cookie', `${BILLING_COOKIE}=${token}; Max-Age=${MAX_COOKIE_S}; ${ATTRIBUTES}`);
  return response;
}

/** Fixed new offer; existing subscriptions retain their original capped spending policy. */
function characterLimit(standing) { return standing?.offer === OFFER_ID ? OFFER.characterLimit : VOICE_ALLOWANCE; }

async function checkedOffer(env, cached = false) {
  if (env.PLUS_CHECKOUT_ENABLED !== 'true' || !recoveryReady(env) || !billingReady(env) || !env.STRIPE_WEBHOOK_SECRET || !await voiceReady(env)) return null;
  const policy = spendingPolicy(env);
  // Exclusive tax is added to the price. Allow room for processor fees on up to
  // 30% added tax; the actual invoice/fee guard still applies to every voice.
  const fees = Math.ceil(Math.ceil(OFFER.amount * 1.3) * policy.feeBps / 10000) + policy.feeCents;
  if ((OFFER.amount - fees) * (10000 - policy.reserveBps) < OFFER.characterLimit * policy.rate) return null;
  const previous = offerCache.get(env);
  if (cached && previous && Date.now() - previous.at < 60_000) return previous.offer;
  const [price, portal] = await Promise.all([
    stripe(`/v1/prices/${encodeURIComponent(env.PLUS_PRICE_ID)}?expand[]=product`, env),
    stripe(`/v1/billing_portal/configurations/${encodeURIComponent(env.PLUS_PORTAL_CONFIGURATION)}`, env),
  ]);
  const features = portal.features;
  const portalValid = portal.id === env.PLUS_PORTAL_CONFIGURATION && portal.active === true && portal.livemode === livemode(env)
    && features?.subscription_cancel?.enabled === true && features.subscription_cancel.mode === 'at_period_end'
    && features.invoice_history?.enabled === true && features.payment_method_update?.enabled === true
    && features.subscription_update?.enabled === false;
  const valid = price.active === true && price.livemode === livemode(env) && price.currency === OFFER.currency
    && price.unit_amount === OFFER.amount && price.billing_scheme === 'per_unit' && price.tax_behavior === 'exclusive'
    && price.recurring?.interval === 'month' && price.recurring.interval_count === 1 && price.recurring.usage_type === 'licensed' && price.product?.active === true;
  const offer = valid && portalValid ? OFFER : null;
  offerCache.set(env, { at: Date.now(), offer });
  return offer;
}

async function lifecycleConfig(request, env) {
  let offer = null;
  if (env.PLUS_CHECKOUT_ENABLED === 'true') {
    const blocked = await lifecycleLimit(request, env, 'plus-config');
    if (blocked) return blocked;
    try { offer = await checkedOffer(env, true); } catch { /* Keep the free reader usable during a provider outage. */ }
  }
  return reply(200, { paymentLink: paymentLink(env), checkoutAvailable: Boolean(offer), recoveryAvailable: recoveryReady(env), offer });
}

async function lifecycleLimit(request, env, key) {
  if (typeof env.PLUS_CLAIM_LIMITER?.limit !== 'function' || !request.headers.get('CF-Connecting-IP')?.trim()) return unavailable(env, 'The Plus customer address limiter is not configured.');
  if (await limited(request, env.PLUS_CLAIM_LIMITER, key)) return refuse(429, 'RATE_LIMITED', 'Too many requests were sent. Try again in a minute.');
  return null;
}

async function ownedSubscription(identity, env) {
  if (!identity) return null;
  const subscription = await stripe(`/v1/subscriptions/${encodeURIComponent(identity.s)}`, env);
  return idOf(subscription.customer) === identity.c && itemsOf(subscription).some(item => priceIdOf(item) === env.PLUS_PRICE_ID) ? subscription : null;
}

function hostedUrl(value, hostname) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === hostname && !url.username && !url.password ? url.href : null; } catch { return null; }
}

async function checkout(request, env, body, now) {
  if (typeof body?.request_id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/iu.test(body.request_id)) return refuse(400, 'BAD_REQUEST', 'A new checkout request id is required.');
  if (!await checkedOffer(env)) return unavailable(env, 'The paid offer is not ready.');
  const identity = await billingIdentity(request, env, now);
  const existing = await ownedSubscription(identity, env);
  if (existing && !['canceled', 'incomplete_expired'].includes(existing.status)) return refuse(409, 'PLUS_EXISTS', 'You already have a subscription. Manage billing or restore access instead.');
  const origin = new URL(request.url).origin;
  const fields = {
    mode: 'subscription', client_reference_id: `plus:${body.request_id.toLowerCase()}`, 'line_items[0][price]': env.PLUS_PRICE_ID, 'line_items[0][quantity]': '1',
    'payment_method_types[0]': 'card', allow_promotion_codes: 'false', 'automatic_tax[enabled]': 'true',
    'subscription_data[metadata][rise_offer]': OFFER_ID,
    // A new customer prevents historical credits, discounts and pending invoice
    // items from silently changing the funded offer. Keep old identity until claim.
    success_url: `${origin}/plus/claim?session_id={CHECKOUT_SESSION_ID}`, cancel_url: `${origin}/plus/`
  };
  const session = await stripe('/v1/checkout/sessions', env, 'POST', fields, `rise-plus:${body.request_id.toLowerCase()}`);
  const url = hostedUrl(session.url, 'checkout.stripe.com');
  if (!url) return refuse(502, 'UPSTREAM', 'Checkout could not be opened. Try again.');
  const proof = await sign({ c: 'checkout', s: body.request_id.toLowerCase(), l: livemode(env), iat: now, exp: now + DAY_S }, `${env.PLUS_COOKIE_SECRET}:checkout`);
  return reply(200, { url }, { 'Set-Cookie': `${CHECKOUT_COOKIE}=${proof}; Max-Age=${DAY_S}; ${ATTRIBUTES}` });
}

async function portal(request, env, now) {
  if (!billingReady(env)) return unavailable(env, 'Billing management is not configured.');
  const identity = await billingIdentity(request, env, now);
  if (!await ownedSubscription(identity, env)) return refuse(401, 'BILLING_REQUIRED', 'Restore your subscription to manage billing.');
  const session = await stripe('/v1/billing_portal/sessions', env, 'POST', { customer: identity.c, configuration: env.PLUS_PORTAL_CONFIGURATION, return_url: `${new URL(request.url).origin}/plus/` });
  const url = hostedUrl(session.url, 'billing.stripe.com');
  return url ? reply(200, { url }) : refuse(502, 'UPSTREAM', 'Billing could not be opened. Try again.');
}

async function recover(request, env, body, now) {
  if (!recoveryReady(env)) return unavailable(env, 'Subscription recovery is not configured.');
  const email = typeof body?.email === 'string' ? body.email.trim() : '';
  if (email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/u.test(email)) return refuse(400, 'BAD_REQUEST', 'Enter a valid email address.');
  const accepted = () => reply(202, { accepted: true });
  const exact = await stripe(`/v1/customers?email=${encodeURIComponent(email)}&limit=10`, env);
  // List is current but case-sensitive. Search adds case variants; it can lag a
  // recent purchase, so preserve the exact list and check returned emails ourselves.
  let searched = { data: [], has_more: false };
  try { searched = await stripe(`/v1/customers/search?query=${encodeURIComponent(`email:${JSON.stringify(email)}`)}&limit=10`, env); } catch { /* Exact-case recovery still works when search is unavailable. */ }
  if (exact.has_more || searched.has_more || !Array.isArray(exact.data) || !Array.isArray(searched.data)) return accepted();
  const customers = [...new Map([...exact.data, ...searched.data].filter(customer => !customer.deleted && customer.email?.toLowerCase() === email.toLowerCase()).map(customer => [customer.id, customer])).values()];
  if (customers.length > 10) return accepted();
  const matches = await Promise.all(customers.map(async customer => {
    const subscriptions = await stripe(`/v1/subscriptions?customer=${encodeURIComponent(customer.id)}&status=all&limit=100`, env);
    if (subscriptions.has_more || !Array.isArray(subscriptions.data)) return null;
    return subscriptions.data.filter(sub => idOf(sub.customer) === customer.id && itemsOf(sub).some(item => priceIdOf(item) === env.PLUS_PRICE_ID)).map(sub => ({ customer, sub }));
  }));
  if (matches.some(result => result === null)) return accepted();
  const candidates = matches.flat();
  const chosen = candidates.find(({ sub }) => ACTIVE.has(sub.status)) ?? candidates[0];
  if (chosen) {
    const { customer, sub } = chosen;
    const nonce = crypto.randomUUID();
    const token = await sign({ c: customer.id, s: sub.id, l: livemode(env), iat: now, exp: now + RECOVERY_S, nonce }, `${env.PLUS_COOKIE_SECRET}:recovery`);
    const issued = await meter(env, `sub:${sub.id}`, 'recovery-issue', { hash: await sha256(token), exp: now + RECOVERY_S });
    if (!issued.ok) return accepted();
    const from = env.PLUS_EMAIL_FROM;
    let response;
    try { response = await fetch('https://api.resend.com/emails', {
      method: 'POST', signal: AbortSignal.timeout(10_000), headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [customer.email], subject: 'Restore your RISE Plus subscription', text: `Use this link to restore RISE Plus and manage billing. It expires in 15 minutes and can be used once.\n\n${new URL(request.url).origin}/plus/restore#token=${token}\n\nIf you did not request this email, you can ignore it.` })
    });
    } catch { /* Mail transport failures must not expose whether an address exists. */ }
    // Keep the public reply the same for absent accounts and mail-provider failures.
    if (!response?.ok) console.error('Plus recovery email could not be delivered.');
    return accepted();
  }
  return accepted();
}

async function restore(request, env, body, now) {
  if (!recoveryReady(env)) return unavailable(env, 'Subscription recovery is not configured.');
  const token = typeof body?.token === 'string' && body.token.length <= 2048 ? body.token : '';
  const identity = await verify(token, purposeEnv(env, 'recovery'), now);
  const invalid = () => refuse(400, 'RECOVERY_INVALID', 'This recovery link has expired or was already used. Request a new one.');
  if (!identity || identity.exp <= now || identity.exp - identity.iat !== RECOVERY_S || typeof identity.nonce !== 'string') return invalid();
  const sub = await ownedSubscription(identity, env);
  if (!sub) return invalid();
  const used = await meter(env, `sub:${identity.s}`, 'recovery-consume', { hash: await sha256(token), subscriptionStatus: sub.status });
  if (!used.ok) return invalid();
  const paid = claimFor(sub, env);
  const response = reply(204, null, { 'Set-Cookie': paid ? await setCookie({ ...paid, iat: now }, env, now) : CLEAR_COOKIE });
  return withBilling(response, identity, env, now);
}

async function lifecycle(request, env, path, now) {
  const blocked = await lifecycleLimit(request, env, 'plus-customer');
  if (blocked) return blocked;
  const { refusal, body } = await readJson(request);
  if (refusal) return refusal;
  if (path === '/api/plus/checkout') return checkout(request, env, body, now);
  if (path === '/api/plus/portal') return portal(request, env, now);
  if (path === '/api/plus/recover') return recover(request, env, body, now);
  return restore(request, env, body, now);
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
 * Meter reservation/release operation IDs are retained only for their current period
 * (at most 65,536); older periods cannot debit or refund the current one.
 * One period and one count: a newer period overwrites the old count; the
 * same for the day's count (`today`), which a newer day overwrites.
 * (Stored as `since`: the earlier `period` held a period end and is ignored.)
 * Everything an instance keeps is listed in PRIVACY.md ("What the server keeps").
 */
export class PlusMeter {
  constructor(ctx) {
    this.storage = ctx.storage;
    this.kv = ctx.storage.kv;
    this.audio = new PlusAudio(ctx.storage);
  }

  async alarm() { await this.audio.alarm(); }

  /** What is used in `period`: 0 for a newer period, and `stale` for an older one. */
  usage(period) {
    const current = this.kv.get('since');
    return { stale: current !== undefined && period < current, used: current === period ? this.kv.get('used') ?? 0 : 0 };
  }

  async fetch(request) {
    const op = new URL(request.url).pathname;
    const body = await request.json();
    const now = Math.floor(Date.now() / 1000);
    if (op.startsWith('/audio/')) return Response.json(await this.audio.handle(op.slice(7), body, now));
    const response = this.storage.transactionSync(() => this.handle(op, body, now));
    await this.storage.sync();
    return response;
  }

  handle(op, body, now) {
    if (op === '/recovery-issue') {
      const previous = this.kv.get('recovery');
      if (previous && now - previous.issued < 60) return Response.json({ ok: false });
      this.kv.put('recovery', { hash: body.hash, exp: body.exp, issued: now });
      return Response.json({ ok: true });
    }
    if (op === '/recovery-consume') {
      const kept = this.kv.get('recovery');
      if (!kept || kept.exp <= now || kept.hash !== body.hash) return Response.json({ ok: false });
      this.kv.delete('recovery');
      // The verified restore supersedes cached access and any in-flight standing
      // refresh. Permanent refund/dispute revocation remains unchanged.
      this.kv.delete('standing');
      this.kv.put('subscriptionStatus', body.subscriptionStatus ?? null);
      this.kv.put('revision', (this.kv.get('revision') ?? 0) + 1);
      return Response.json({ ok: true });
    }
    if (op === '/inspect') {
      const kept = this.kv.get('standing');
      const usage = body.period === undefined ? { used: 0 } : this.usage(body.period);
      return Response.json({ subscriptionStatus: this.kv.get('subscriptionStatus') ?? null, revision: this.kv.get('revision') ?? 0, used: usage.used, spentMicros: this.kv.get('since') === body.period ? this.kv.get('spentMicros') ?? 0 : 0, revoked: Boolean(this.kv.get('revoked')), fresh: Boolean(kept) && now - kept.at < body.ttl, standing: kept?.standing ?? null });
    }
    if (op === '/gate') return Response.json(this.gate(body, now));
    if (op === '/standing') {
      if (body.revision !== (this.kv.get('revision') ?? 0)) return Response.json({ ok: false, changed: true });
      this.kv.put('standing', { standing: body.standing ?? null, at: now });
      if (Object.hasOwn(body, 'subscriptionStatus')) this.kv.put('subscriptionStatus', body.subscriptionStatus);
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
    const operationKey = typeof body.operation === 'string' && /^[a-zA-Z0-9-]{1,64}$/u.test(body.operation) ? `operation:${body.operation}` : null;
    if (body.operation !== undefined && !operationKey) return Response.json({ ok: false, used });
    const fingerprint = JSON.stringify([period, n, day ?? null, costMicros ?? null, rateMicros ?? null]);
    const operation = operationKey ? this.kv.get(operationKey) : null;
    if (operation && operation.fingerprint !== fingerprint) return Response.json({ ok: false, used });
    if (op === '/reserve') {
      if (operation) return Response.json({ ok: operation.state === 'reserved', used });
      if (body.revision !== undefined && body.revision !== (this.kv.get('revision') ?? 0)) return Response.json({ ok: false, used, changed: true });
      if (this.kv.get('revoked')) return Response.json({ ok: false, used, revoked: true });
      const money = costMicros !== undefined;
      const spentMicros = this.kv.get('since') === period ? this.kv.get('spentMicros') ?? used * rateMicros : 0;
      if (money && (!Number.isSafeInteger(costMicros) || costMicros < 0 || !Number.isSafeInteger(spendLimitMicros) || spendLimitMicros <= 0 || !Number.isSafeInteger(rateMicros) || rateMicros < 60 || !Number.isSafeInteger(spentMicros) || spentMicros + costMicros > spendLimitMicros)) return Response.json({ ok: false, used });
      if (stale || !(used + n <= limit)) return Response.json({ ok: false, used });
      const today = this.kv.get('today');
      const dayUsed = day !== undefined && today?.day === day ? today.used : 0;
      if (day !== undefined && !(dayUsed + n <= dayLimit)) return Response.json({ ok: false, used, dayFull: true });
      if (operationKey) {
        if (this.kv.get('operationPeriod') !== period) {
          this.kv.put('operationPeriod', period);
          for (const [key] of this.kv.list({ prefix: 'operation:' })) this.kv.delete(key);
          this.kv.put('operationCount', 0);
        }
        const count = this.kv.get('operationCount') ?? 0;
        if (count >= 65_536) return Response.json({ ok: false, used });
        this.kv.put(operationKey, { fingerprint, state: 'reserved' });
        this.kv.put('operationCount', count + 1);
      }
      if (day !== undefined) this.kv.put('today', { day, used: dayUsed + n });
      this.kv.put('since', period);
      this.kv.put('used', used + n);
      if (money) this.kv.put('spentMicros', spentMicros + costMicros);
      return Response.json({ ok: true, used: used + n });
    }
    if (op === '/release') {
      if (operationKey) {
        if (operation?.state !== 'reserved') return Response.json({ ok: true, used });
        this.kv.put(operationKey, { ...operation, state: 'released' });
      }
      const today = this.kv.get('today');
      if (day !== undefined && today?.day === day) this.kv.put('today', { day, used: Math.max(0, today.used - n) });
      if (stale || this.kv.get('since') !== period) return Response.json({ ok: true, used });
      this.kv.put('used', Math.max(0, used - n));
      if (Number.isSafeInteger(costMicros) && costMicros >= 0) this.kv.put('spentMicros', Math.max(0, (this.kv.get('spentMicros') ?? used * rateMicros) - costMicros));
      return Response.json({ ok: true, used: Math.max(0, used - n) });
    }
    return Response.json({ ok: false, error: 'no such meter operation' }, { status: 404 });
  }

  gate({ n, limit, rate, ttl, accessOnly }, now) {
    if (this.kv.get('revoked')) return { revoked: true };
    const minute = Math.floor(now / 60);
    const counted = this.kv.get('rate');
    const count = counted?.minute === minute ? counted.count + 1 : 1;
    this.kv.put('rate', { minute, count });
    if (count > rate) return { limited: true };
    const kept = this.kv.get('standing');
    const standing = kept?.standing ?? null;
    if (!accessOnly && standing && now < standing.exp) {
      const { used } = this.usage(standing.start);
      if (used + n > Math.min(limit, characterLimit(standing))) return { exhausted: true, used };
    }
    return { revision: this.kv.get('revision') ?? 0, fresh: Boolean(kept) && now - kept.at < ttl, standing };
  }

  event({ id, created, action, kind, subscriptionStatus }) {
    const seen = this.kv.get('events') ?? [];
    if (typeof id !== 'string' || seen.includes(id)) return { ok: true, duplicate: true };
    this.kv.put('events', [...seen, id].slice(-50));
    this.kv.put('revision', (this.kv.get('revision') ?? 0) + 1);
    this.kv.delete('standing');
    const revoked = this.kv.get('revoked');
    if (action === 'revoke' && kind !== 'status') {
      this.kv.put('revoked', { kind, created });
      if (kind === 'deleted') this.kv.put('subscriptionStatus', 'canceled');
    } else if (action === 'revoke' || action === 'restore') {
      // Stripe does not promise order: only the newest status event says where the status stands.
      if (created < (this.kv.get('statusAt') ?? 0)) return { ok: true, outdated: true };
      this.kv.put('statusAt', created);
      if (typeof subscriptionStatus === 'string' && (!revoked || revoked.kind === 'status')) this.kv.put('subscriptionStatus', subscriptionStatus);
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
