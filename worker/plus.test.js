import { afterEach, describe, expect, it, vi } from 'vitest';

import worker from './index.mjs';
import { PLUS_INTERNALS, isPlusRoute } from './plus.mjs';

const SITE = 'https://rise.example';
const NOW = 1_800_000_000;
const { sign, COOKIE, DAY_S, GRACE_S } = PLUS_INTERNALS;

const subscription = (overrides = {}) => ({
  id: 'sub_1', status: 'active', customer: 'cus_1', current_period_end: NOW + 20 * DAY_S, ...overrides
});

function bucket(objects = {}) {
  return {
    get: vi.fn(async key => objects[key]
      ? { body: objects[key], httpEtag: `"${key}"` }
      : null)
  };
}

function environment(overrides = {}) {
  return {
    STRIPE_SECRET_KEY: 'sk_test_x',
    PLUS_COOKIE_SECRET: 'cookie-secret-one',
    PLUS_AUDIO: bucket({ 'el_a/the-iliad/3/pack.json': '{"schema":"pack"}', 'el_a/the-iliad/3/0123456789abcdef.m4a': 'audio-bytes' }),
    DECISION_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    ...overrides
  };
}

/** Stripe, answering one session and one subscription lookup. */
function stripeAnswering({ session = null, sub = null } = {}) {
  const fetcher = vi.fn(async (url) => {
    const path = new URL(url).pathname;
    if (path.startsWith('/v1/checkout/sessions/')) return session ? Response.json(session) : new Response('', { status: 404 });
    if (path.startsWith('/v1/subscriptions/')) return sub ? Response.json(sub) : new Response('', { status: 404 });
    return new Response('', { status: 500 });
  });
  vi.stubGlobal('fetch', fetcher);
  return fetcher;
}

const claimRequest = (body = { session_id: 'cs_test_1' }) => new Request(`${SITE}/api/plus/claim`, {
  method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' }, body: JSON.stringify(body)
});

const cookieFor = async (env, claim) => `${COOKIE}=${await sign({ c: 'cus_1', s: 'sub_1', exp: NOW + 20 * DAY_S, iat: NOW, ...claim }, env.PLUS_COOKIE_SECRET)}`;

const audioRequest = (cookie, file = 'pack.json') => new Request(`${SITE}/api/plus/audio/el_a/the-iliad/3/${file}`, {
  headers: cookie ? { Cookie: cookie } : {}
});

const setCookieOf = response => response.headers.get('Set-Cookie');

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Plus routes', () => {
  it('names its own routes and nothing else', () => {
    expect(isPlusRoute('/api/plus/claim')).toBe(true);
    expect(isPlusRoute('/api/plus/audio/el_a/the-iliad/3/pack.json')).toBe(true);
    expect(isPlusRoute('/api/plus/audio/el_a/the-iliad/3/0123456789abcdef.m4a')).toBe(true);
    expect(isPlusRoute('/api/plus/audio/el_a/the-iliad/3/../secret')).toBe(false);
    expect(isPlusRoute('/api/plus/audio/El_A/the-iliad/3/pack.json')).toBe(false);
    expect(isPlusRoute('/api/plus')).toBe(false);
  });

  it('is switched off without its secrets and bucket', async () => {
    const response = await worker.fetch(claimRequest(), { DECISION_LIMITER: null });
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('PLUS_UNAVAILABLE');
  });
});

describe('claim', () => {
  it('mints the cookie only after Stripe confirms a paid session with an active subscription', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const fetcher = stripeAnswering({ session: { payment_status: 'paid', subscription: subscription() } });
    const response = await worker.fetch(claimRequest(), env);
    expect(response.status).toBe(204);
    const cookie = setCookieOf(response);
    expect(cookie).toMatch(new RegExp(`^${COOKIE}=v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+; Max-Age=${20 * DAY_S + GRACE_S}; HttpOnly; Secure; SameSite=Lax; Path=/api/plus$`, 'u'));
    expect(fetcher.mock.calls[0][0]).toBe('https://api.stripe.com/v1/checkout/sessions/cs_test_1?expand[]=subscription');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer sk_test_x');
    // The minted cookie opens the audio.
    const audio = await worker.fetch(audioRequest(cookie.split(';')[0]), env);
    expect(audio.status).toBe(200);
  });

  it.each([
    ['an unpaid session', { payment_status: 'unpaid', subscription: subscription() }],
    ['a paid session whose subscription was cancelled since (a reused success link)', { payment_status: 'paid', subscription: subscription({ status: 'canceled' }) }],
    ['a paid one-time session with no subscription', { payment_status: 'paid', subscription: null }]
  ])('refuses %s with 402 PLUS_REQUIRED and sets no cookie', async (_, session) => {
    stripeAnswering({ session });
    const response = await worker.fetch(claimRequest(), environment());
    expect(response.status).toBe(402);
    expect((await response.json()).error.code).toBe('PLUS_REQUIRED');
    expect(setCookieOf(response)).toBeNull();
  });

  it('needs a Checkout session id, and never asks Stripe without one', async () => {
    const fetcher = stripeAnswering();
    for (const body of [{}, { session_id: 'not-a-session' }, { session_id: 'cs_../x' }]) {
      const response = await worker.fetch(claimRequest(body), environment());
      expect(response.status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('answers 502 when Stripe cannot be reached, with no cookie', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const response = await worker.fetch(claimRequest(), environment());
    expect(response.status).toBe(502);
    expect(setCookieOf(response)).toBeNull();
  });

  it('is rate limited per address like the other routes', async () => {
    const fetcher = stripeAnswering();
    const env = environment({ DECISION_LIMITER: { limit: vi.fn(async () => ({ success: false })) } });
    const response = await worker.fetch(claimRequest(), env);
    expect(response.status).toBe(429);
    expect(env.DECISION_LIMITER.limit).toHaveBeenCalledWith({ key: 'plus:192.0.2.1' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('audio', () => {
  it('serves the pack and the clips to a signed cookie, and nothing to no cookie', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const cookie = await cookieFor(env);
    const pack = await worker.fetch(audioRequest(cookie), env);
    expect(pack.status).toBe(200);
    expect(pack.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(pack.headers.get('Cache-Control')).toBe('private, max-age=31536000, immutable');
    expect(await pack.text()).toBe('{"schema":"pack"}');
    const clip = await worker.fetch(audioRequest(cookie, '0123456789abcdef.m4a'), env);
    expect(clip.status).toBe(200);
    expect(clip.headers.get('Content-Type')).toBe('audio/mp4');
    expect(env.PLUS_AUDIO.get).toHaveBeenLastCalledWith('el_a/the-iliad/3/0123456789abcdef.m4a');

    const refused = await worker.fetch(audioRequest(null), env);
    expect(refused.status).toBe(402);
    expect((await refused.json()).error.code).toBe('PLUS_REQUIRED');
    expect(env.DECISION_LIMITER.limit).not.toHaveBeenCalled();
  });

  it('refuses a cookie signed with another secret, or edited after signing', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const forged = await cookieFor({ PLUS_COOKIE_SECRET: 'someone-else' });
    expect((await worker.fetch(audioRequest(forged), env)).status).toBe(402);
    const [name, value] = (await cookieFor(env)).split('=');
    const [keyId, payload, signature] = value.split('.');
    const edited = `${name}=${keyId}.${payload.slice(0, -2)}xx.${signature}`;
    expect((await worker.fetch(audioRequest(edited), env)).status).toBe(402);
  });

  it('accepts the previous secret while rotating', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment({ PLUS_COOKIE_SECRET: 'new', PLUS_COOKIE_SECRET_PREVIOUS: 'cookie-secret-one' });
    const old = await cookieFor({ PLUS_COOKIE_SECRET: 'cookie-secret-one' });
    expect((await worker.fetch(audioRequest(old, '0123456789abcdef.m4a'), env)).status).toBe(200);
  });

  it('lapses three days after the period end, and clears the cookie', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const inGrace = await cookieFor(env, { exp: NOW - GRACE_S + 60, iat: NOW - 60 });
    expect((await worker.fetch(audioRequest(inGrace, '0123456789abcdef.m4a'), env)).status).toBe(200);
    const past = await cookieFor(env, { exp: NOW - GRACE_S - 60, iat: NOW - 60 });
    const response = await worker.fetch(audioRequest(past, '0123456789abcdef.m4a'), env);
    expect(response.status).toBe(402);
    expect((await response.json()).error.code).toBe('PLUS_LAPSED');
    expect(setCookieOf(response)).toMatch(/^rise_plus=; Max-Age=0;/u);
  });

  it('asks Stripe once a day on the pack request and re-signs the cookie', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const fetcher = stripeAnswering({ sub: subscription({ current_period_end: NOW + 50 * DAY_S }) });
    const dayOld = await cookieFor(env, { iat: NOW - DAY_S - 1 });
    const response = await worker.fetch(audioRequest(dayOld), env);
    expect(response.status).toBe(200);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0][0]).toBe('https://api.stripe.com/v1/subscriptions/sub_1');
    expect(setCookieOf(response)).toMatch(new RegExp(`Max-Age=${50 * DAY_S + GRACE_S};`, 'u'));
    // A fresh cookie, and any clip request, never asks.
    const fresh = await cookieFor(env);
    await worker.fetch(audioRequest(fresh), env);
    await worker.fetch(audioRequest(dayOld, '0123456789abcdef.m4a'), env);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });

  it('clears a day-old cookie whose subscription Stripe says is gone', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    stripeAnswering({ sub: subscription({ status: 'canceled' }) });
    const response = await worker.fetch(audioRequest(await cookieFor(env, { iat: NOW - 2 * DAY_S })), env);
    expect(response.status).toBe(402);
    expect((await response.json()).error.code).toBe('PLUS_LAPSED');
    expect(setCookieOf(response)).toMatch(/Max-Age=0;/u);
  });

  it('keeps serving on a signed cookie when Stripe is unreachable, without re-signing', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    const response = await worker.fetch(audioRequest(await cookieFor(env, { iat: NOW - 2 * DAY_S })), env);
    expect(response.status).toBe(200);
    expect(setCookieOf(response)).toBeNull();
  });

  it('answers 404 for a clip the bucket does not hold', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const response = await worker.fetch(new Request(`${SITE}/api/plus/audio/el_a/the-iliad/9/pack.json`, { headers: { Cookie: await cookieFor(env) } }), env);
    expect(response.status).toBe(404);
  });
});

describe('forget', () => {
  it('clears the cookie', async () => {
    const response = await worker.fetch(new Request(`${SITE}/api/plus/forget`, { method: 'POST' }), environment());
    expect(response.status).toBe(204);
    expect(setCookieOf(response)).toMatch(/^rise_plus=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=\/api\/plus$/u);
  });
});
