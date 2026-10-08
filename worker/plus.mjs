/**
 * Plus: the paid voice, gated by a Stripe receipt and nothing else
 * (MasterMind RFC 0001, section 2). The Worker keeps no table and no model
 * credential. A reader who paid holds one signed, HttpOnly cookie; every
 * audio request checks its signature, and once a day the pack request asks
 * Stripe whether the subscription still stands and re-signs or clears it.
 *
 *   POST /api/plus/claim  { session_id }      the Checkout success page; mints the cookie after Stripe confirms
 *   GET  /api/plus/audio/<voice>/<work>/<division>/pack.json | <sha16>.m4a
 *   POST /api/plus/forget                     clears the cookie in this browser
 *
 * Secrets: STRIPE_SECRET_KEY, PLUS_COOKIE_SECRET (and PLUS_COOKIE_SECRET_PREVIOUS
 * while rotating). Binding: PLUS_AUDIO, the private bucket the render script fills.
 */

const COOKIE = 'rise_plus';
const KEY_ID = 'v1';
const DAY_S = 24 * 60 * 60;
const GRACE_S = 3 * DAY_S;
const STRIPE = 'https://api.stripe.com';

const JSON_HEADERS = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

const AUDIO_PATH = /^\/api\/plus\/audio\/([a-z0-9_]+)\/([a-z0-9-]+)\/(\d{1,4})\/(pack\.json|[0-9a-f]{16}\.m4a)$/u;

export function isPlusRoute(path) {
  return path === '/api/plus/claim' || path === '/api/plus/forget' || AUDIO_PATH.test(path);
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
      if (typeof claim.c === 'string' && typeof claim.s === 'string' && Number.isFinite(claim.exp) && Number.isFinite(claim.iat)) return claim;
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

async function stripe(path, env) {
  const response = await fetch(`${STRIPE}${path}`, { headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` } });
  if (!response.ok) throw new Error(`Stripe answered ${response.status}`);
  return response.json();
}

const ACTIVE = new Set(['active', 'trialing']);

/** The claim for a subscription object Stripe just returned, or null when it does not stand. */
function claimFor(subscription) {
  if (!subscription || !ACTIVE.has(subscription.status)) return null;
  const customer = typeof subscription.customer === 'string' ? subscription.customer : subscription.customer?.id;
  if (!customer || typeof subscription.id !== 'string' || !Number.isFinite(subscription.current_period_end)) return null;
  return { c: customer, s: subscription.id, exp: subscription.current_period_end };
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
  let session;
  try {
    session = await stripe(`/v1/checkout/sessions/${encodeURIComponent(sessionId)}?expand[]=subscription`, env);
  } catch {
    return refuse(502, 'UPSTREAM', 'Stripe could not be reached. Try again in a moment.');
  }
  const paid = session.payment_status === 'paid' && claimFor(session.subscription);
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
  const next = claimFor(subscription);
  if (!next) return { claim: null };
  return { claim: { ...next, iat: now }, cookie: await setCookie({ ...next, iat: now }, env, now) };
}

async function audio(request, env, now) {
  if (request.method !== 'GET') return refuse(405, 'METHOD_NOT_ALLOWED', 'Use GET.');
  const [, voice, work, division, file] = new URL(request.url).pathname.match(AUDIO_PATH);
  const current = await verify(cookieValue(request), env);
  if (!current) return refuse(402, 'PLUS_REQUIRED', 'A Plus subscription is needed for this voice.', { 'Set-Cookie': CLEAR_COOKIE });
  if (now > current.exp + GRACE_S) return refuse(402, 'PLUS_LAPSED', 'Your Plus subscription has lapsed.', { 'Set-Cookie': CLEAR_COOKIE });
  let cookie = null;
  if (file === 'pack.json') {
    const result = await renewed(current, env, now);
    if (!result.claim) return refuse(402, 'PLUS_LAPSED', 'Your Plus subscription has lapsed.', { 'Set-Cookie': CLEAR_COOKIE });
    cookie = result.cookie ?? null;
  }
  const object = await env.PLUS_AUDIO.get(`${voice}/${work}/${division}/${file}`);
  if (!object) return refuse(404, 'NOT_FOUND', 'No such clip.');
  const headers = new Headers({
    'Content-Type': file === 'pack.json' ? 'application/json; charset=utf-8' : 'audio/mp4',
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
  if (path === '/api/plus/forget') return reply(204, null, { 'Set-Cookie': CLEAR_COOKIE });
  return audio(request, env, now);
}

export const PLUS_INTERNALS = { sign, verify, COOKIE, DAY_S, GRACE_S };
