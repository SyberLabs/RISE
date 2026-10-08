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

describe('voice', () => {
  const ATOMS = ['The sun had not yet risen.', 'The sea was indistinguishable from the sky,', 'except that the sea was slightly creased.'];
  const TEXT = ATOMS.join(' ');

  /** A vendor-shaped answer: 60 ms a character, mp3 bytes that spell their own name. */
  function vendorAnswer(text) {
    const characters = [...text];
    const starts = characters.map((_, i) => 0.1 + i * 0.06);
    const ends = starts.map(t => t + 0.06);
    return { audio_base64: btoa('mp3-bytes'), alignment: { characters, character_start_times_seconds: starts, character_end_times_seconds: ends } };
  }

  function voiceEnvironment(overrides = {}) {
    const stored = {};
    const env = environment({
      ELEVENLABS_API_KEY: 'el-secret',
      PLUS_VOICE_ID: 'voice-1',
      PLUS_VOICE_SLUG: 'el_plus',
      PLUS_AUDIO: {
        get: vi.fn(async key => stored[key] ? { body: stored[key], httpEtag: `"${key}"` } : null),
        put: vi.fn(async (key, value) => { stored[key] = value; })
      },
      ...overrides
    });
    return { env, stored };
  }

  /** Vendor and Stripe behind one fetch. */
  function upstream({ vendor = vendorAnswer(TEXT), vendorStatus = 200 } = {}) {
    const fetcher = vi.fn(async (url, init) => {
      if (String(url).startsWith('https://api.elevenlabs.io/')) {
        return vendorStatus === 200 ? Response.json(vendor) : new Response('', { status: vendorStatus });
      }
      if (String(url).includes('/v1/subscriptions/')) return Response.json(subscription({ metadata: {} }));
      return new Response('', { status: 500 });
    });
    vi.stubGlobal('fetch', fetcher);
    return fetcher;
  }

  const voiceRequest = (cookie, body = { atoms: ATOMS }) => new Request(`${SITE}/api/plus/voice`, {
    method: 'POST', headers: { 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1', ...(cookie ? { Cookie: cookie } : {}) }, body: JSON.stringify(body)
  });

  it('voices a reading once, stores it, meters the cookie and tells Stripe', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const { env, stored } = voiceEnvironment();
    const fetcher = upstream();
    const response = await worker.fetch(voiceRequest(await cookieFor(env)), env);
    expect(response.status).toBe(200);
    const pack = await response.json();
    expect(pack.schema).toBe('rise.recitation-voice-pack.v1');
    const entries = Object.values(pack.voices.el_plus.entries);
    expect(entries.map(e => e.text)).toEqual(ATOMS);
    expect(new Set(entries.map(e => e.asset)).size).toBe(1);
    expect(entries[0].asset).toMatch(/^\/api\/plus\/audio\/voiced\/[0-9a-f]{64}\/audio\.mp3$/u);
    expect(entries[1].fromMs).toBeGreaterThan(entries[0].toMs - 1);
    expect(entries[1].onsetsMs[0]).toBe(0);
    expect(entries[1].durationMs).toBe(entries[1].toMs - entries[1].fromMs);
    // The vendor was asked once, with the key and the joined text.
    const vendorCall = fetcher.mock.calls.find(([url]) => String(url).includes('elevenlabs'));
    expect(vendorCall[1].headers['xi-api-key']).toBe('el-secret');
    expect(JSON.parse(vendorCall[1].body)).toEqual({ text: TEXT, model_id: 'eleven_flash_v2_5' });
    // Stored under the hash: the audio and the pack.
    expect(Object.keys(stored).sort()).toEqual([`voiced/${pack.voiced.hash}/audio.mp3`, `voiced/${pack.voiced.hash}/pack.json`]);
    expect(new TextDecoder().decode(stored[`voiced/${pack.voiced.hash}/audio.mp3`])).toBe('mp3-bytes');
    // Metered: Stripe told, cookie re-signed with the count.
    const stripeCall = fetcher.mock.calls.find(([url]) => String(url).includes('/v1/subscriptions/sub_1'));
    expect(stripeCall[1].method).toBe('POST');
    expect(stripeCall[1].body).toBe(`metadata%5Bplus_used_${NOW + 20 * DAY_S}%5D=${TEXT.length}`);
    const cookie = setCookieOf(response).split(';')[0];
    expect(cookie).toMatch(/^rise_plus=v1\./u);
    // The voiced file and pack are served to the cookie.
    const audio = await worker.fetch(new Request(`${SITE}${entries[0].asset}`, { headers: { Cookie: cookie } }), env);
    expect(audio.status).toBe(200);
    expect(audio.headers.get('Content-Type')).toBe('audio/mpeg');
    const served = await worker.fetch(new Request(`${SITE}/api/plus/audio/voiced/${pack.voiced.hash}/pack.json`, { headers: { Cookie: cookie } }), env);
    expect(served.status).toBe(200);
  });

  it('serves a text said before from storage: no vendor call, no allowance spent', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const { env } = voiceEnvironment();
    const fetcher = upstream();
    const first = await worker.fetch(voiceRequest(await cookieFor(env)), env);
    const pack = await first.json();
    const again = await worker.fetch(voiceRequest(await cookieFor(env)), env);
    expect(again.status).toBe(200);
    expect((await again.json()).voiced.hash).toBe(pack.voiced.hash);
    expect(fetcher.mock.calls.filter(([url]) => String(url).includes('elevenlabs'))).toHaveLength(1);
    expect(setCookieOf(again)).toBeNull();
  });

  it('refuses past the allowance before asking the vendor', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const { env } = voiceEnvironment();
    const fetcher = upstream();
    const nearlyUsed = await cookieFor(env, { u: 105_000 - TEXT.length + 1 });
    const response = await worker.fetch(voiceRequest(nearlyUsed), env);
    expect(response.status).toBe(402);
    expect((await response.json()).error.code).toBe('PLUS_ALLOWANCE');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('seeds the count from Stripe at claim time, so a cleared browser keeps its meter', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    stripeAnswering({ session: { payment_status: 'paid', subscription: subscription({ metadata: { [`plus_used_${NOW + 20 * DAY_S}`]: '100000' } }) } });
    const claimed = await worker.fetch(claimRequest(), env);
    const cookie = setCookieOf(claimed).split(';')[0];
    const { env: voiced } = voiceEnvironment();
    const fetcher = upstream();
    const response = await worker.fetch(voiceRequest(cookie, { atoms: ['x'.repeat(5_990) + ' and more'] }), voiced);
    expect(response.status).toBe(402);
    expect((await response.json()).error.code).toBe('PLUS_ALLOWANCE');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it.each([
    ['no phrases', { atoms: [] }, 400],
    ['a phrase with no letters', { atoms: ['...'] }, 400],
    ['a phrase with a line break', { atoms: ['one\ntwo'] }, 400],
    ['more than one request of text', { atoms: ['x'.repeat(6_000), 'y'.repeat(6_000)] }, 413]
  ])('refuses %s without asking the vendor', async (_, body, status) => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const { env } = voiceEnvironment();
    const fetcher = upstream();
    const response = await worker.fetch(voiceRequest(await cookieFor(env), body), env);
    expect(response.status).toBe(status);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('needs the cookie, and is switched off without the vendor key', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const { env } = voiceEnvironment();
    upstream();
    expect((await worker.fetch(voiceRequest(null), env)).status).toBe(402);
    const { env: off } = voiceEnvironment({ ELEVENLABS_API_KEY: undefined });
    expect((await worker.fetch(voiceRequest(await cookieFor(off)), off)).status).toBe(503);
  });

  it('answers 502 when the vendor fails or the performance does not match the text, storing nothing', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const { env, stored } = voiceEnvironment();
    upstream({ vendorStatus: 500 });
    expect((await worker.fetch(voiceRequest(await cookieFor(env)), env)).status).toBe(502);
    upstream({ vendor: vendorAnswer('Something else entirely was said.') });
    const refused = await worker.fetch(voiceRequest(await cookieFor(env)), env);
    expect(refused.status).toBe(502);
    expect((await refused.json()).error.code).toBe('VOICE_REFUSED');
    expect(Object.keys(stored)).toEqual([]);
  });
});
