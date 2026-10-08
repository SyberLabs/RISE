/**
 * The Plus routes (worker/plus.mjs), with Stripe and the vendor behind a stubbed fetch.
 *
 * The meter is the real PlusMeter class behind an in-memory Durable Object namespace:
 * one instance per name, each with a Map standing in for the synchronous
 * `ctx.storage.kv` of a SQLite-backed object. PlusMeter reads and writes with no
 * await between them, so JavaScript's one thread gives the same atomicity a Durable
 * Object's one-request-at-a-time gives in workerd. (The same race was also run once
 * against workerd itself through `wrangler dev --local`; the repo has no
 * @cloudflare/vitest-pool-workers.)
 *
 * The "attack" tests are the exploits of the 2026-10-08 security review, each with
 * its final assertion turned round: they pass only while the attack fails.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import worker from './index.mjs';
import { PLUS_INTERNALS, PlusMeter, STRIPE_VERSION, VOICE_ALLOWANCE, isPlusRoute } from './plus.mjs';

const SITE = 'https://rise.example';
const NOW = 1_800_000_000;
const { sign, COOKIE, DAY_S, GRACE_S, MAX_COOKIE_S, MAX_BODY_BYTES } = PLUS_INTERNALS;
const PRICE = 'price_plus';
const EXP = NOW + 20 * DAY_S;
/** The allow-list as wrangler hands a JSON var over: parsed. */
const VOICES = [
  { slug: 'default', label: 'Default' },
  { slug: 'george', label: 'George', id: 'JBFqnCBsd6RMkjVDRZzb' },
  { slug: 'rachel', label: 'Rachel', id: '21m00Tcm4TlvDq8ikWAM' }
];

/** A subscription as Stripe 2025-03-31.basil returns it: the billing period is on the item. */
const subscription = ({ current_period_end = EXP, price = PRICE, ...overrides } = {}) => ({
  id: 'sub_1', status: 'active', customer: 'cus_1',
  items: { object: 'list', data: [{ id: 'si_1', price: { id: price }, current_period_end }] },
  ...overrides
});

/** A Durable Object namespace of real PlusMeter instances over in-memory storage. */
function meterNamespace() {
  const instances = new Map();
  const instance = name => {
    if (!instances.has(name)) {
      const map = new Map();
      instances.set(name, new PlusMeter({ storage: { kv: { get: key => map.get(key), put: (key, value) => { map.set(key, value); } } } }));
    }
    return instances.get(name);
  };
  return {
    idFromName: name => name,
    get: name => ({ fetch: (url, init) => instance(name).fetch(new Request(url, init)) })
  };
}

/** What a meter instance says has been used for a period, read through its own API. */
async function usedIn(env, name, period) {
  const stub = env.PLUS_METER.get(env.PLUS_METER.idFromName(name));
  return (await (await stub.fetch('https://plus-meter/reserve', { method: 'POST', body: JSON.stringify({ period, n: 0, limit: Number.MAX_SAFE_INTEGER }) })).json()).used;
}

async function prefill(env, name, period, n) {
  const stub = env.PLUS_METER.get(env.PLUS_METER.idFromName(name));
  await stub.fetch('https://plus-meter/reserve', { method: 'POST', body: JSON.stringify({ period, n, limit: Number.MAX_SAFE_INTEGER }) });
}

function environment(overrides = {}) {
  return {
    STRIPE_SECRET_KEY: 'sk_test_x',
    PLUS_COOKIE_SECRET: 'cookie-secret-one',
    PLUS_PRICE_ID: PRICE,
    ELEVENLABS_API_KEY: 'el-secret',
    PLUS_VOICE_ID: 'voice-1',
    PLUS_VOICES: VOICES,
    PLUS_DAILY_CHAR_CAP: '1000000',
    PLUS_METER: meterNamespace(),
    DECISION_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    ...overrides
  };
}

/** A text of exactly n characters that passes the atom check and maps letter for letter. */
const textOf = (n, seed) => {
  const word = `w${seed}`;
  const out = [];
  let length = 0;
  while (length + word.length + 1 <= n) { out.push(word); length += word.length + 1; }
  let text = out.join(' ');
  while (text.length < n) text += 'a';
  return text;
};

/** A vendor-shaped answer: 60 ms a character, mp3 bytes that spell their own name. */
function vendorAnswer(text) {
  const characters = [...text];
  const starts = characters.map((_, i) => 0.1 + i * 0.06);
  return { audio_base64: btoa('mp3-bytes'), alignment: { characters, character_start_times_seconds: starts, character_end_times_seconds: starts.map(t => t + 0.06) } };
}

/**
 * Stripe and the vendor behind one fetch. `vendor` is 'echo' (a faithful answer),
 * 'mismatch' (billed, but says something else), 'garbage' (billed, not JSON), or a status.
 */
function world({ sub = subscription(), session = { payment_status: 'paid', subscription: sub }, vendor = 'echo', stripeDown = false } = {}) {
  const state = { vendorCalls: 0, vendorChars: 0, stripeGets: 0, stripeWrites: 0 };
  const fetcher = vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname === 'api.elevenlabs.io') {
      const { text } = JSON.parse(init.body);
      state.vendorCalls++;
      if (typeof vendor === 'number') return new Response('', { status: vendor });
      state.vendorChars += text.length; // billed from here on, whatever happens next
      if (vendor === 'mismatch') return Response.json(vendorAnswer(`${text} extra`));
      if (vendor === 'garbage') return new Response('{not json', { status: 200 });
      return Response.json(vendorAnswer(text));
    }
    if (u.hostname === 'api.stripe.com') {
      if (stripeDown) throw new Error('offline');
      if ((init.method ?? 'GET') !== 'GET') state.stripeWrites++;
      if (u.pathname.startsWith('/v1/checkout/sessions/')) return session ? Response.json(session) : new Response('', { status: 404 });
      if (u.pathname.startsWith('/v1/subscriptions/')) {
        state.stripeGets++;
        // Each subscription id answers as itself, so several subscribers can share one Stripe.
        return sub ? Response.json({ ...sub, id: decodeURIComponent(u.pathname.split('/').pop()) }) : new Response('', { status: 404 });
      }
    }
    return new Response('', { status: 500 });
  });
  vi.stubGlobal('fetch', fetcher);
  return { state, fetcher };
}

const cookieFor = async (env, claim = {}) => `${COOKIE}=${await sign({ c: 'cus_1', s: 'sub_1', exp: EXP, iat: NOW, l: false, ...claim }, env.PLUS_COOKIE_SECRET)}`;
const claimOf = setCookie => JSON.parse(Buffer.from(setCookie.split(';')[0].split('=')[1].split('.')[1], 'base64url').toString());
const POST_HEADERS = { Origin: SITE, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' };

const claimRequest = (body = { session_id: 'cs_test_1' }, headers = {}) => new Request(`${SITE}/api/plus/claim`, {
  method: 'POST', headers: { ...POST_HEADERS, ...headers }, body: JSON.stringify(body)
});
const voiceRequest = (cookie, atoms, headers = {}, extra = {}) => new Request(`${SITE}/api/plus/voice`, {
  method: 'POST', headers: { ...POST_HEADERS, ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: JSON.stringify({ atoms, ...extra })
});
const vendorVoiceOf = call => decodeURIComponent(new URL(call[0]).pathname.split('/')[3]);
const setCookieOf = response => response.headers.get('Set-Cookie');
const cookiePart = response => setCookieOf(response)?.split(';')[0] ?? null;
const codeOf = async response => (await response.json()).error.code;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('Plus routes', () => {
  it('names its own routes and nothing else: there is no audio route any more', () => {
    expect(isPlusRoute('/api/plus/claim')).toBe(true);
    expect(isPlusRoute('/api/plus/voice')).toBe(true);
    expect(isPlusRoute('/api/plus/forget')).toBe(true);
    expect(isPlusRoute('/api/plus/voices')).toBe(true);
    expect(isPlusRoute(`/api/plus/audio/voiced/${'a'.repeat(64)}/pack.json`)).toBe(false);
    expect(isPlusRoute('/api/plus/audio/el_a/the-iliad/3/pack.json')).toBe(false);
    expect(isPlusRoute('/api/plus')).toBe(false);
  });

  it('is switched off without its secrets, and says which', async () => {
    const response = await worker.fetch(claimRequest(), { DECISION_LIMITER: null });
    expect(response.status).toBe(503);
    const { error } = await response.json();
    expect(error.code).toBe('PLUS_UNAVAILABLE');
    expect(error.message).toContain('STRIPE_SECRET_KEY');
  });

  it('answers only POST', async () => {
    const response = await worker.fetch(new Request(`${SITE}/api/plus/voice`), environment());
    expect(response.status).toBe(405);
  });
});

describe('claim', () => {
  it('mints a __Secure- cookie only after Stripe confirms a paid session with an active subscription', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const { fetcher } = world();
    const response = await worker.fetch(claimRequest(), environment());
    expect(response.status).toBe(204);
    const cookie = setCookieOf(response);
    expect(cookie).toMatch(new RegExp(`^__Secure-rise_plus=v1\\.[A-Za-z0-9_-]+\\.[A-Za-z0-9_-]+; Max-Age=${20 * DAY_S + GRACE_S}; HttpOnly; Secure; SameSite=Lax; Path=/api/plus$`, 'u'));
    expect(claimOf(cookie)).toEqual({ c: 'cus_1', s: 'sub_1', exp: EXP, l: false, iat: NOW });
    expect(fetcher.mock.calls[0][0]).toBe('https://api.stripe.com/v1/checkout/sessions/cs_test_1?expand[]=subscription');
    expect(fetcher.mock.calls[0][1].headers.Authorization).toBe('Bearer sk_test_x');
    expect(fetcher.mock.calls[0][1].headers['Stripe-Version']).toBe(STRIPE_VERSION);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
  });

  it.each([
    ['an unpaid session', { payment_status: 'unpaid', subscription: subscription() }],
    ['a paid session whose subscription was cancelled since (a reused success link)', { payment_status: 'paid', subscription: subscription({ status: 'canceled' }) }],
    ['a paid one-time session with no subscription', { payment_status: 'paid', subscription: null }],
    ['a paid session for another product on the same Stripe account', { payment_status: 'paid', subscription: subscription({ price: 'price_other' }) }],
    ['a subscription with no billing period anywhere', { payment_status: 'paid', subscription: { ...subscription(), items: { data: [{ price: { id: PRICE } }] } } }]
  ])('refuses %s with 402 PLUS_REQUIRED and sets no cookie', async (_, session) => {
    world({ session });
    const response = await worker.fetch(claimRequest(), environment());
    expect(response.status).toBe(402);
    expect(await codeOf(response)).toBe('PLUS_REQUIRED');
    expect(setCookieOf(response)).toBeNull();
  });

  it('reads the period end from the top level for a subscription in the pre-basil shape', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const legacy = { id: 'sub_1', status: 'active', customer: 'cus_1', current_period_end: NOW + 10 * DAY_S, items: { data: [{ price: { id: PRICE } }] } };
    world({ session: { payment_status: 'paid', subscription: legacy } });
    const response = await worker.fetch(claimRequest(), environment());
    expect(response.status).toBe(204);
    expect(setCookieOf(response)).toContain(`Max-Age=${10 * DAY_S + GRACE_S};`);
  });

  it('caps the cookie\'s Max-Age at the server ceiling whatever the period end', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    world({ sub: subscription({ current_period_end: NOW + 365 * DAY_S }) });
    const response = await worker.fetch(claimRequest(), environment());
    expect(setCookieOf(response)).toContain(`Max-Age=${MAX_COOKIE_S};`);
  });

  it('refuses every claim while PLUS_PRICE_ID is unset, without asking Stripe (fail closed)', async () => {
    const { fetcher } = world();
    const response = await worker.fetch(claimRequest(), environment({ PLUS_PRICE_ID: undefined }));
    expect(response.status).toBe(503);
    const { error } = await response.json();
    expect(error.code).toBe('PLUS_UNAVAILABLE');
    expect(error.message).toContain('PLUS_PRICE_ID');
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('needs a Checkout session id, and never asks Stripe without one', async () => {
    const { fetcher } = world();
    for (const body of [{}, { session_id: 'not-a-session' }, { session_id: 'cs_../x' }]) {
      expect((await worker.fetch(claimRequest(body), environment())).status).toBe(400);
    }
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('answers 502 when Stripe cannot be reached, with no cookie', async () => {
    world({ stripeDown: true });
    const response = await worker.fetch(claimRequest(), environment());
    expect(response.status).toBe(502);
    expect(setCookieOf(response)).toBeNull();
  });

  it('is rate limited per address like the other routes', async () => {
    const { fetcher } = world();
    const env = environment({ DECISION_LIMITER: { limit: vi.fn(async () => ({ success: false })) } });
    const response = await worker.fetch(claimRequest(), env);
    expect(response.status).toBe(429);
    expect(env.DECISION_LIMITER.limit).toHaveBeenCalledWith({ key: 'plus:192.0.2.1' });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('marks the cookie with the Stripe mode of the key that minted it', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    world();
    const live = await worker.fetch(claimRequest(), environment({ STRIPE_SECRET_KEY: 'sk_live_x' }));
    expect(claimOf(setCookieOf(live)).l).toBe(true);
  });
});

describe('forget', () => {
  it('clears the cookie', async () => {
    const response = await worker.fetch(new Request(`${SITE}/api/plus/forget`, { method: 'POST', headers: { Origin: SITE } }), environment());
    expect(response.status).toBe(204);
    expect(setCookieOf(response)).toBe('__Secure-rise_plus=; Max-Age=0; HttpOnly; Secure; SameSite=Lax; Path=/api/plus');
  });
});

describe('voice', () => {
  const ATOMS = ['The sun had not yet risen.', 'The sea was indistinguishable from the sky,', 'except that the sea was slightly creased.'];
  const TEXT = ATOMS.join(' ');

  it('answers the contract: the pack, the audio and the allowance, and keeps nothing', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { fetcher } = world();
    const response = await worker.fetch(voiceRequest(await cookieFor(env), ATOMS), env);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json; charset=utf-8');
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    const body = await response.json();
    expect(Object.keys(body).sort()).toEqual(['allowance', 'audio', 'pack']);
    expect(body.audio).toBe(btoa('mp3-bytes'));
    expect(body.allowance).toEqual({ used: TEXT.length, limit: VOICE_ALLOWANCE, periodEnd: EXP });
    const { pack } = body;
    expect(pack.schema).toBe('rise.recitation-voice-pack.v1');
    expect(pack.voiced).toEqual({ hash: expect.stringMatching(/^[0-9a-f]{64}$/u), voice: 'default', characters: TEXT.length, model: 'elevenlabs/eleven_flash_v2_5' });
    expect(Object.keys(pack.voices)).toEqual(['default']);
    expect(pack.voices.default.label).toBe('Default');
    const entries = Object.values(pack.voices.default.entries);
    expect(entries.map(e => e.text)).toEqual(ATOMS);
    expect(new Set(entries.map(e => e.asset))).toEqual(new Set([`voiced:${pack.voiced.hash}`]));
    expect(entries[0].mimeType).toBe('audio/mpeg');
    expect(entries[1].fromMs).toBeGreaterThan(entries[0].toMs - 1);
    expect(entries[1].onsetsMs[0]).toBe(0);
    expect(entries[1].durationMs).toBe(entries[1].toMs - entries[1].fromMs);
    // The vendor was asked once, with the key and the joined text; Stripe was asked first, with the pinned version.
    const vendorCall = fetcher.mock.calls.find(([url]) => String(url).includes('elevenlabs'));
    expect(vendorCall[1].headers['xi-api-key']).toBe('el-secret');
    expect(vendorVoiceOf(vendorCall)).toBe('voice-1'); // no voice named: the default, PLUS_VOICE_ID
    expect(JSON.parse(vendorCall[1].body)).toEqual({ text: TEXT, model_id: 'eleven_flash_v2_5' });
    const stripeCall = fetcher.mock.calls.find(([url]) => String(url) === 'https://api.stripe.com/v1/subscriptions/sub_1');
    expect(stripeCall[1].headers['Stripe-Version']).toBe(STRIPE_VERSION);
    expect(fetcher.mock.calls.indexOf(stripeCall)).toBeLessThan(fetcher.mock.calls.indexOf(vendorCall));
    // The cookie is re-signed from what Stripe just said, and carries no count.
    expect(claimOf(setCookieOf(response))).toEqual({ c: 'cus_1', s: 'sub_1', exp: EXP, l: false, iat: NOW });
  });

  it('voices and meters the same text again: the server dedupes nothing', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    const cookie = await cookieFor(env);
    await worker.fetch(voiceRequest(cookie, ATOMS), env);
    const again = await worker.fetch(voiceRequest(cookie, ATOMS), env);
    expect(again.status).toBe(200);
    expect((await again.json()).allowance.used).toBe(2 * TEXT.length);
    expect(state.vendorCalls).toBe(2);
  });

  it('refuses past the allowance before asking the vendor', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    await prefill(env, 'sub:sub_1', EXP, VOICE_ALLOWANCE - TEXT.length + 1);
    const response = await worker.fetch(voiceRequest(await cookieFor(env), ATOMS), env);
    expect(response.status).toBe(402);
    expect(await codeOf(response)).toBe('PLUS_ALLOWANCE');
    expect(state.vendorCalls).toBe(0);
  });

  it('starts a new count with a new billing period', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    await prefill(env, 'sub:sub_1', EXP, VOICE_ALLOWANCE);
    world({ sub: subscription({ current_period_end: EXP + 30 * DAY_S }) });
    const response = await worker.fetch(voiceRequest(await cookieFor(env), ATOMS), env);
    expect(response.status).toBe(200);
    expect((await response.json()).allowance).toEqual({ used: TEXT.length, limit: VOICE_ALLOWANCE, periodEnd: EXP + 30 * DAY_S });
  });

  it.each([
    ['no phrases', [], 400],
    ['a phrase with no letters', ['...'], 400],
    ['a phrase with a line break', ['one\ntwo'], 400],
    ['more than one request of text', ['x'.repeat(6_000), 'y'.repeat(6_000)], 413]
  ])('refuses %s without asking anyone', async (_, atoms, status) => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { fetcher } = world();
    expect((await worker.fetch(voiceRequest(await cookieFor(env), atoms), env)).status).toBe(status);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('needs the cookie', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    world();
    const response = await worker.fetch(voiceRequest(null, ATOMS), environment());
    expect(response.status).toBe(402);
    expect(await codeOf(response)).toBe('PLUS_REQUIRED');
  });

  it.each([
    ['ELEVENLABS_API_KEY', { ELEVENLABS_API_KEY: undefined }],
    ['PLUS_VOICE_ID', { PLUS_VOICE_ID: undefined }],
    ['PLUS_VOICES', { PLUS_VOICES: undefined }],
    ['PLUS_VOICES', { PLUS_VOICES: 'not json' }],
    ['PLUS_VOICES', { PLUS_VOICES: [{ slug: 'george', label: 'George', id: 'x' }] }],
    ['PLUS_VOICES', { PLUS_VOICES: [...VOICES, { slug: 'nobody', label: 'No id' }] }],
    ['PLUS_VOICES', { PLUS_VOICES: [...VOICES, { slug: 'george', label: 'Twice', id: 'y' }] }],
    ['PLUS_DAILY_CHAR_CAP', { PLUS_DAILY_CHAR_CAP: undefined }],
    ['PLUS_DAILY_CHAR_CAP', { PLUS_DAILY_CHAR_CAP: 'lots' }],
    ['PLUS_DAILY_CHAR_CAP', { PLUS_DAILY_CHAR_CAP: '0' }],
    ['PLUS_METER', { PLUS_METER: undefined }]
  ])('is switched off, naming %s, when it is missing or unusable (fail closed)', async (name, overrides) => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment(overrides);
    const { fetcher } = world();
    const response = await worker.fetch(voiceRequest(await cookieFor(env), ATOMS), env);
    expect(response.status).toBe(503);
    const { error } = await response.json();
    expect(error.code).toBe('PLUS_UNAVAILABLE');
    expect(error.message).toContain(name);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('gives the reservation back when the vendor refuses before billing', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    for (const status of [429, 500, 401]) {
      const env = environment();
      world({ vendor: status });
      const response = await worker.fetch(voiceRequest(await cookieFor(env), ATOMS), env);
      expect(response.status).toBe(502);
      expect(await codeOf(response)).toBe('UPSTREAM');
      expect(await usedIn(env, 'sub:sub_1', EXP)).toBe(0);
      expect(await usedIn(env, 'global', '2027-01-15')).toBe(0);
    }
  });

  it('lapses three days after the period end, and clears the cookie', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    const response = await worker.fetch(voiceRequest(await cookieFor(env, { exp: NOW - GRACE_S - 60, iat: NOW - 60 }), ATOMS), env);
    expect(response.status).toBe(402);
    expect(await codeOf(response)).toBe('PLUS_LAPSED');
    expect(setCookieOf(response)).toMatch(/^__Secure-rise_plus=; Max-Age=0;/u);
    expect(state.vendorCalls).toBe(0);
  });

  it('accepts the previous secret while rotating, and re-signs with the new one', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment({ PLUS_COOKIE_SECRET: 'new', PLUS_COOKIE_SECRET_PREVIOUS: 'cookie-secret-one' });
    world();
    const response = await worker.fetch(voiceRequest(await cookieFor({ PLUS_COOKIE_SECRET: 'cookie-secret-one' }), ATOMS), env);
    expect(response.status).toBe(200);
    const fresh = cookiePart(response);
    expect((await worker.fetch(voiceRequest(fresh, ATOMS), environment({ PLUS_COOKIE_SECRET: 'new' }))).status).toBe(200);
  });

  it('refuses a forged payload, a key-id swap, a signature from another secret and an empty signature', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    const good = (await cookieFor(env)).split('=')[1];
    const [kid, payload, sig] = good.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ c: 'cus_1', s: 'sub_1', exp: EXP, iat: NOW, l: false })).toString('base64url');
    for (const value of [`${kid}.${forgedPayload}x.${sig}`, `v2.${payload}.${sig}`, (await cookieFor({ PLUS_COOKIE_SECRET: 'other' })).split('=')[1], `${kid}.${payload}.`, `${kid}.${payload}.!!!`]) {
      expect((await worker.fetch(voiceRequest(`${COOKIE}=${value}`, ['hello']), env)).status).toBe(402);
    }
    expect(state.vendorCalls).toBe(0);
  });
});

describe('attacks from the security review, now refused', () => {
  it('C1: replaying the first cookie cannot voice past the allowance', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    const fresh = await cookieFor(env); // what /api/plus/claim minted on day one
    let ok = 0;
    for (let i = 0; i < 30; i++) {
      const response = await worker.fetch(voiceRequest(fresh, [textOf(10_000, i)]), env);
      if (response.status === 200) ok++;
      else expect(await codeOf(response)).toBe('PLUS_ALLOWANCE');
    }
    expect(ok).toBe(10);
    expect(state.vendorChars).toBe(100_000);
    expect(state.vendorChars).toBeLessThanOrEqual(VOICE_ALLOWANCE);
  });

  it('C1b: nothing rolls back: Stripe is never written, and a re-claim does not reset the count', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    const fresh = await cookieFor(env);
    for (let i = 0; i < 10; i++) await worker.fetch(voiceRequest(fresh, [textOf(10_000, i)]), env);
    const reclaimed = cookiePart(await worker.fetch(claimRequest(), env));
    const response = await worker.fetch(voiceRequest(reclaimed, [textOf(10_000, 99)]), env);
    expect(response.status).toBe(402);
    expect(await codeOf(response)).toBe('PLUS_ALLOWANCE');
    expect(state.stripeWrites).toBe(0);
  });

  it('H1: ten parallel requests with room for one cannot pass the limit together', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    await prefill(env, 'sub:sub_1', EXP, VOICE_ALLOWANCE - 10_000); // room for one more 10k voicing
    const cookie = await cookieFor(env);
    const results = await Promise.all(Array.from({ length: 10 }, (_, i) => worker.fetch(voiceRequest(cookie, [textOf(10_000, 100 + i)]), env)));
    expect(results.filter(r => r.status === 200)).toHaveLength(1);
    expect(results.filter(r => r.status === 402)).toHaveLength(9);
    expect(state.vendorChars).toBe(10_000);
    expect(await usedIn(env, 'sub:sub_1', EXP)).toBe(VOICE_ALLOWANCE);
  });

  it('H1: ten parallel requests from a fresh allowance stop at the limit', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    const cookie = await cookieFor(env);
    const results = await Promise.all(Array.from({ length: 12 }, (_, i) => worker.fetch(voiceRequest(cookie, [textOf(10_000, i)]), env)));
    expect(results.filter(r => r.status === 200)).toHaveLength(10);
    expect(state.vendorChars).toBeLessThanOrEqual(VOICE_ALLOWANCE);
  });

  it('H2: one success link claimed in five browsers shares one allowance', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    const browsers = [];
    for (let i = 0; i < 5; i++) browsers.push(cookiePart(await worker.fetch(claimRequest(), env)));
    expect(browsers.every(Boolean)).toBe(true);
    let ok = 0;
    for (const [b, cookie] of browsers.entries()) {
      for (let i = 0; i < 10; i++) {
        if ((await worker.fetch(voiceRequest(cookie, [textOf(10_000, b * 100 + i)]), env)).status === 200) ok++;
      }
    }
    expect(ok).toBe(10);
    expect(state.vendorChars).toBe(100_000);
  });

  it.each([
    ['canceled', subscription({ status: 'canceled' })],
    ['past_due', subscription({ status: 'past_due' })],
    ['unpaid', subscription({ status: 'unpaid' })],
    ['moved to another price', subscription({ price: 'price_other' })],
    ['gone from Stripe', null]
  ])('H3: a subscription that is %s stops voicing at once, and the cookie is cleared', async (_, sub) => {
    vi.useFakeTimers({ now: (NOW + 15 * DAY_S) * 1000 });
    const env = environment();
    const { state } = world({ sub });
    const response = await worker.fetch(voiceRequest(await cookieFor(env), [textOf(10_000, 7)]), env);
    expect(response.status).toBe(402);
    expect(await codeOf(response)).toBe('PLUS_REQUIRED');
    expect(setCookieOf(response)).toMatch(/Max-Age=0;/u);
    expect(state.stripeGets).toBe(1);
    expect(state.vendorCalls).toBe(0);
  });

  it('H3: a trialing subscription with the Plus price still voices', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    world({ sub: subscription({ status: 'trialing' }) });
    expect((await worker.fetch(voiceRequest(await cookieFor(env), ['hello there']), env)).status).toBe(200);
  });

  it('H3: Stripe unreachable at voicing time fails closed, before the vendor', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world({ stripeDown: true });
    const response = await worker.fetch(voiceRequest(await cookieFor(env), ['hello there']), env);
    expect(response.status).toBe(502);
    expect(await codeOf(response)).toBe('UPSTREAM');
    expect(state.vendorCalls).toBe(0);
  });

  it('M3: a test-mode cookie is refused under a live key, and a live one under a test key', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const { state } = world();
    const live = environment({ STRIPE_SECRET_KEY: 'sk_live_x' });
    const testCookie = await cookieFor(live, { l: false }); // same secret: only the mode tells them apart
    const refused = await worker.fetch(voiceRequest(testCookie, ['hello there']), live);
    expect(refused.status).toBe(402);
    expect(await codeOf(refused)).toBe('PLUS_REQUIRED');
    const test = environment({ STRIPE_SECRET_KEY: 'sk_test_x' });
    expect((await worker.fetch(voiceRequest(await cookieFor(test, { l: true }), ['hello there']), test)).status).toBe(402);
    const untagged = `${COOKIE}=${await sign({ c: 'cus_1', s: 'sub_1', exp: EXP, iat: NOW, u: 0 }, live.PLUS_COOKIE_SECRET)}`;
    expect((await worker.fetch(voiceRequest(untagged, ['hello there']), live)).status).toBe(402);
    expect(state.vendorCalls).toBe(0);
    expect((await worker.fetch(voiceRequest(await cookieFor(live, { l: true }), ['hello there']), live)).status).toBe(200);
  });

  it('M1: an answer the vendor billed but that fails the letter check is metered', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world({ vendor: 'mismatch' });
    await prefill(env, 'sub:sub_1', EXP, VOICE_ALLOWANCE - 10_000);
    const cookie = await cookieFor(env);
    const first = await worker.fetch(voiceRequest(cookie, [textOf(10_000, 1)]), env);
    expect(first.status).toBe(502);
    expect(await codeOf(first)).toBe('VOICE_REFUSED');
    for (let i = 0; i < 4; i++) {
      const again = await worker.fetch(voiceRequest(cookie, [textOf(10_000, 1)]), env);
      expect(again.status).toBe(402);
      expect(await codeOf(again)).toBe('PLUS_ALLOWANCE');
    }
    expect(state.vendorChars).toBe(10_000);
    expect(await usedIn(env, 'sub:sub_1', EXP)).toBe(VOICE_ALLOWANCE);
  });

  it('M1b: a billed answer that is not JSON is metered and answered, not thrown', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world({ vendor: 'garbage' });
    const response = await worker.fetch(voiceRequest(await cookieFor(env), [textOf(10_000, 1)]), env);
    expect(response.status).toBe(502);
    expect(state.vendorChars).toBe(10_000);
    expect(await usedIn(env, 'sub:sub_1', EXP)).toBe(10_000);
  });

  it('M2: there is no shared cache: no oracle on another reader\'s text, and nothing to read back', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    const secret = ['Dear Dr. Lee, my biopsy results came back positive.'];
    const victim = await worker.fetch(voiceRequest(await cookieFor(env, { c: 'cus_victim', s: 'sub_v' }), secret), env);
    const { pack: { voiced: { hash } } } = await victim.json();
    await prefill(env, 'sub:sub_a', EXP, VOICE_ALLOWANCE); // the attacker's allowance is used up
    const attacker = await cookieFor(env, { c: 'cus_attacker', s: 'sub_a' });
    const probe = await worker.fetch(voiceRequest(attacker, secret), env);
    const miss = await worker.fetch(voiceRequest(attacker, ['Dear Dr. Lee, my biopsy results came back negative.']), env);
    expect([probe.status, await codeOf(probe)]).toEqual([402, 'PLUS_ALLOWANCE']);
    expect([miss.status, await codeOf(miss)]).toEqual([402, 'PLUS_ALLOWANCE']); // indistinguishable
    expect(state.vendorCalls).toBe(1);
    const read = await worker.fetch(new Request(`${SITE}/api/plus/audio/voiced/${hash}/pack.json`, { headers: { Cookie: attacker } }), env);
    expect(read.status).toBe(404);
    expect(await read.text()).not.toContain('biopsy');
  });

  it('L1: a text/plain body or a foreign, missing or sibling Origin is refused before any spend', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { fetcher } = world();
    const cookie = await cookieFor(env);
    const plain = await worker.fetch(voiceRequest(cookie, [textOf(10_000, 9)], { 'Content-Type': 'text/plain' }), env);
    expect([plain.status, await codeOf(plain)]).toEqual([415, 'BAD_CONTENT_TYPE']);
    for (const origin of ['https://evil.syberlabs.io', 'https://evil.example', 'null']) {
      const response = await worker.fetch(voiceRequest(cookie, ['hello there'], { Origin: origin }), env);
      expect([response.status, await codeOf(response)]).toEqual([403, 'FORBIDDEN_ORIGIN']);
    }
    const headers = { ...POST_HEADERS, Cookie: cookie };
    delete headers.Origin;
    const none = await worker.fetch(new Request(`${SITE}/api/plus/voice`, { method: 'POST', headers, body: JSON.stringify({ atoms: ['hello'] }) }), env);
    expect(none.status).toBe(403);
    const claim = await worker.fetch(claimRequest(undefined, { Origin: 'https://evil.example' }), env);
    expect(claim.status).toBe(403);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it('L3: the unprefixed cookie name a sibling subdomain could plant is not read', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    const value = (await cookieFor(env)).split('=')[1];
    expect((await worker.fetch(voiceRequest(`rise_plus=${value}`, ['hello there']), env)).status).toBe(402);
    expect(state.vendorCalls).toBe(0);
  });

  it('L4: a cookie signed more than 40 days ago, or in the future, is refused whatever its exp says', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    const old = await cookieFor(env, { exp: NOW + 100 * 365 * DAY_S, iat: NOW - MAX_COOKIE_S - 1 });
    expect((await worker.fetch(voiceRequest(old, ['hello there']), env)).status).toBe(402);
    const future = await cookieFor(env, { exp: NOW + 100 * 365 * DAY_S, iat: NOW + DAY_S });
    expect((await worker.fetch(voiceRequest(future, ['hello there']), env)).status).toBe(402);
    expect(state.vendorCalls).toBe(0);
  });

  it('L5: a body over the cap is refused by its declared length, and by counting a body that declares none', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { fetcher } = world();
    const cookie = await cookieFor(env);
    const declared = await worker.fetch(voiceRequest(cookie, ['x'], { 'Content-Length': String(MAX_BODY_BYTES + 1) }), env);
    expect([declared.status, await codeOf(declared)]).toEqual([413, 'TOO_LARGE']);
    const chunk = new TextEncoder().encode('x'.repeat(16 * 1024));
    let pulled = 0;
    const stream = new ReadableStream({
      pull(controller) {
        pulled++;
        if (pulled > 100) controller.close(); else controller.enqueue(chunk);
      }
    });
    const chunked = await worker.fetch(new Request(`${SITE}/api/plus/voice`, { method: 'POST', headers: { ...POST_HEADERS, Cookie: cookie }, body: stream, duplex: 'half' }), env);
    expect([chunked.status, await codeOf(chunked)]).toEqual([413, 'TOO_LARGE']);
    expect(pulled).toBeLessThan(10); // stopped reading at the cap, not at the end
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('the daily cap across every subscriber', () => {
  it('refuses the voicing that would pass it, and gives that subscriber\'s reservation back', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment({ PLUS_DAILY_CHAR_CAP: '15000' });
    const { state } = world();
    const first = await worker.fetch(voiceRequest(await cookieFor(env, { s: 'sub_1' }), [textOf(10_000, 1)]), env);
    expect(first.status).toBe(200);
    const second = await worker.fetch(voiceRequest(await cookieFor(env, { s: 'sub_1' }), [textOf(10_000, 2)]), env);
    expect([second.status, await codeOf(second)]).toEqual([503, 'PLUS_DAILY_CAP']);
    expect(state.vendorCalls).toBe(1);
    expect(await usedIn(env, 'sub:sub_1', EXP)).toBe(10_000);
    // The next UTC day starts again.
    vi.setSystemTime((NOW + DAY_S) * 1000);
    expect((await worker.fetch(voiceRequest(await cookieFor(env, { iat: NOW + DAY_S }), [textOf(10_000, 3)]), env)).status).toBe(200);
  });

  it('holds under parallel requests from many subscribers', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment({ PLUS_DAILY_CHAR_CAP: '30000' });
    const { state } = world();
    const results = await Promise.all(Array.from({ length: 10 }, async (_, i) => worker.fetch(voiceRequest(await cookieFor(env, { s: `sub_${i}` }), [textOf(10_000, i)]), env)));
    expect(results.filter(r => r.status === 200)).toHaveLength(3);
    expect(state.vendorChars).toBe(30_000);
  });
});

describe('PlusMeter', () => {
  const meter = () => {
    const map = new Map();
    return new PlusMeter({ storage: { kv: { get: key => map.get(key), put: (key, value) => { map.set(key, value); } } } });
  };
  const call = async (m, op, body) => (await m.fetch(new Request(`https://plus-meter/${op}`, { method: 'POST', body: JSON.stringify(body) }))).json();

  it('reserves up to the limit exactly, releases, and keeps periods apart', async () => {
    const m = meter();
    expect(await call(m, 'reserve', { period: 1, n: 60, limit: 100 })).toEqual({ ok: true, used: 60 });
    expect(await call(m, 'reserve', { period: 1, n: 41, limit: 100 })).toEqual({ ok: false, used: 60 });
    expect(await call(m, 'reserve', { period: 1, n: 40, limit: 100 })).toEqual({ ok: true, used: 100 });
    expect(await call(m, 'release', { period: 1, n: 40 })).toEqual({ ok: true, used: 60 });
    expect(await call(m, 'reserve', { period: 2, n: 100, limit: 100 })).toEqual({ ok: true, used: 100 });
    expect(await call(m, 'release', { period: 3, n: 5 })).toEqual({ ok: true, used: 0 });
  });

  it('refuses a malformed request', async () => {
    const m = meter();
    expect((await m.fetch(new Request('https://plus-meter/reserve', { method: 'POST', body: JSON.stringify({ period: 1, n: -5, limit: 100 }) }))).status).toBe(400);
    expect((await m.fetch(new Request('https://plus-meter/other', { method: 'POST', body: JSON.stringify({ period: 1, n: 1 }) }))).status).toBe(404);
  });
});

describe('choosing a voice', () => {
  it('maps each slug to its own vendor id, and names the slug in the pack', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { fetcher } = world();
    const cookie = await cookieFor(env);
    const hashes = new Set();
    for (const [slug, id] of [['default', 'voice-1'], ['george', 'JBFqnCBsd6RMkjVDRZzb'], ['rachel', '21m00Tcm4TlvDq8ikWAM']]) {
      fetcher.mockClear();
      const response = await worker.fetch(voiceRequest(cookie, ['hello there'], {}, { voice: slug }), env);
      expect(response.status).toBe(200);
      const { pack } = await response.json();
      expect(pack.voiced.voice).toBe(slug);
      expect(Object.keys(pack.voices)).toEqual([slug]);
      hashes.add(pack.voiced.hash);
      expect(vendorVoiceOf(fetcher.mock.calls.find(([url]) => String(url).includes('elevenlabs')))).toBe(id);
    }
    expect(hashes.size).toBe(3); // the same text in another voice is another performance
  });

  it('accepts the allow-list as text too, as a dashboard or secret value arrives', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment({ PLUS_VOICES: JSON.stringify(VOICES) });
    world();
    expect((await worker.fetch(voiceRequest(await cookieFor(env), ['hello there'], {}, { voice: 'george' }), env)).status).toBe(200);
  });

  it.each([
    ['an unknown slug', 'brian'],
    ['a raw vendor id', 'JBFqnCBsd6RMkjVDRZzb'],
    ['a raw id of the default voice', 'voice-1'],
    ['an object', { id: 'JBFqnCBsd6RMkjVDRZzb' }],
    ['a list', ['george']],
    ['a property of every object', '__proto__']
  ])('refuses %s with 400 before Stripe, the meter or the vendor', async (_, voice) => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { fetcher } = world();
    const response = await worker.fetch(voiceRequest(await cookieFor(env), ['hello there'], {}, { voice }), env);
    expect([response.status, await codeOf(response)]).toEqual([400, 'UNKNOWN_VOICE']);
    expect(fetcher).not.toHaveBeenCalled();
    expect(await usedIn(env, 'sub:sub_1', EXP)).toBe(0);
  });

  it('cannot reach the vendor with an id smuggled in elsewhere in the body', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { fetcher } = world();
    const response = await worker.fetch(voiceRequest(await cookieFor(env), ['hello there'], {}, { voice: 'george', voice_id: 'attacker-voice', id: 'attacker-voice', model_id: 'eleven_v3' }), env);
    expect(response.status).toBe(200);
    const vendorCall = fetcher.mock.calls.find(([url]) => String(url).includes('elevenlabs'));
    expect(vendorVoiceOf(vendorCall)).toBe('JBFqnCBsd6RMkjVDRZzb');
    expect(JSON.parse(vendorCall[1].body)).toEqual({ text: 'hello there', model_id: 'eleven_flash_v2_5' });
  });

  it('meters per subscription whatever the voice', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const env = environment();
    const { state } = world();
    const cookie = await cookieFor(env);
    let ok = 0;
    for (let i = 0; i < 12; i++) {
      const voice = VOICES[i % VOICES.length].slug;
      if ((await worker.fetch(voiceRequest(cookie, [textOf(10_000, i)], {}, { voice }), env)).status === 200) ok++;
    }
    expect(ok).toBe(10);
    expect(state.vendorChars).toBe(100_000);
    expect(await usedIn(env, 'sub:sub_1', EXP)).toBe(100_000);
  });

  it('lists slugs and labels without a cookie, and never a vendor id', async () => {
    const env = environment();
    const { fetcher } = world();
    const response = await worker.fetch(new Request(`${SITE}/api/plus/voices`), env);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toEqual(VOICES.map(({ slug, label }) => ({ slug, label })));
    const text = JSON.stringify(body);
    for (const id of ['voice-1', 'JBFqnCBsd6RMkjVDRZzb', '21m00Tcm4TlvDq8ikWAM']) expect(text).not.toContain(id);
    expect(fetcher).not.toHaveBeenCalled();
    expect((await worker.fetch(new Request(`${SITE}/api/plus/voices`, { method: 'POST', headers: { Origin: SITE } }), env)).status).toBe(405);
    expect((await worker.fetch(new Request(`${SITE}/api/plus/voices`), environment({ PLUS_VOICES: 'nope' }))).status).toBe(503);
  });
});
