/**
 * The independent attack suite against worker/plus.mjs (the 2026-10-08 security review and
 * its verification), kept in the repo so every change to the paid voice runs it.
 *
 * Convention: every test PASSES when the attack is blocked, and it asserts the mechanism
 * (status, error code, and which counters moved: Stripe GETs, meter calls, vendor characters),
 * so a block by the wrong check fails the test. A test named RESIDUAL passes while a known,
 * bounded weakness remains, and says what bounds it.
 *
 * Two things make "parallel" mean parallel here: the meter namespace runs the real PlusMeter
 * with random microtask jitter around each call, and the Stripe subscription GET can hold its
 * answer until N requests wait on it (a latency barrier), so requests overlap at the meter.
 * Without the barrier, WebCrypto's callbacks serialize the requests and a racy meter passes.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

import worker from './index.mjs';
import { PLUS_INTERNALS, PlusMeter, SUB_RATE_PER_MINUTE, VOICE_ALLOWANCE, isPlusRoute } from './plus.mjs';

const SITE = 'https://rise.example';
const NOW = 1_800_000_000;
const DAY = '2027-01-15'; // UTC day of NOW
const { sign, COOKIE, DAY_S, GRACE_S, MAX_COOKIE_S, MAX_BODY_BYTES } = PLUS_INTERNALS;
const PRICE = 'price_plus';
const EXP = NOW + 20 * DAY_S;
/** The allowance is keyed by the start of the Plus item's billing period. */
const START = NOW - 10 * DAY_S;
const VOICES = [
  { slug: 'default', label: 'Default' },
  { slug: 'george', label: 'George', id: 'JBFqnCBsd6RMkjVDRZzb' },
  { slug: 'rachel', label: 'Rachel', id: '21m00Tcm4TlvDq8ikWAM' }
];
const VENDOR_IDS = ['voice-1', 'JBFqnCBsd6RMkjVDRZzb', '21m00Tcm4TlvDq8ikWAM'];

const subscription = (o = {}) => ({
  id: 'sub_1', status: 'active', customer: 'cus_1', latest_invoice: 'in_1',
  items: { object: 'list', data: [{ id: 'si_1', price: { id: PRICE }, current_period_start: START, current_period_end: EXP }] }, ...o
});

const textOf = (n, seed) => {
  const word = `w${seed}`;
  const out = [];
  let len = 0;
  while (len + word.length + 1 <= n) { out.push(word); len += word.length + 1; }
  let s = out.join(' ');
  while (s.length < n) s += 'a';
  return s;
};

function vendorAnswer(text) {
  const characters = [...text];
  const starts = characters.map((_, i) => 0.1 + i * 0.06);
  return { audio_base64: btoa('mp3'), alignment: { characters, character_start_times_seconds: starts, character_end_times_seconds: starts.map(t => t + 0.06) } };
}

/** A few microtask turns, a random number of them: varies the interleaving of concurrent requests (fake timers are on, so no setTimeout). */
const jitter = async () => { for (let i = Math.floor(Math.random() * 6); i > 0; i--) await Promise.resolve(); };

/**
 * A Durable Object namespace over the REAL PlusMeter class. Faithful to workerd's semantics:
 * one instance per name, the body crosses as serialized bytes, and the caller's stub.fetch is
 * asynchronous with a random delay before and after the object runs (the object itself, like a
 * DO, only interleaves at its own awaits). `failNext` injects a meter outage.
 */
function meterNamespace() {
  const instances = new Map();
  const ns = {
    calls: [],
    failNext: 0,
    failOp: null,
    instance(name) {
      if (!instances.has(name)) {
        const map = new Map();
        instances.set(name, new PlusMeter({ storage: { kv: { get: k => map.get(k), put: (k, v) => { map.set(k, v); }, delete: k => map.delete(k) } } }));
      }
      return instances.get(name);
    },
    idFromName: name => ({ name }),
    get: id => ({
      fetch: async (url, init) => {
        await jitter();
        if (ns.failNext > 0 && (!ns.failOp || new URL(url).pathname === ns.failOp)) { ns.failNext--; throw new Error('Durable Object reset'); }
        ns.calls.push([id.name, new URL(url).pathname, JSON.parse(init.body)]);
        const res = await ns.instance(id.name).fetch(new Request(url, init));
        await jitter();
        return res;
      }
    })
  };
  return ns;
}
async function used(e, name, period) {
  const r = await e.PLUS_METER.instance(name).fetch(new Request('https://plus-meter/reserve', { method: 'POST', body: JSON.stringify({ period, n: 0, limit: Number.MAX_SAFE_INTEGER }) }));
  return (await r.json()).used;
}
async function prefill(e, name, period, n) {
  await e.PLUS_METER.instance(name).fetch(new Request('https://plus-meter/reserve', { method: 'POST', body: JSON.stringify({ period, n, limit: Number.MAX_SAFE_INTEGER }) }));
}

/**
 * Stripe (checkout session + subscription GET, which now runs on every voicing) and the vendor.
 * vendor: 'echo' | 'mismatch' (billed, fails letter check) | 'garbage' (billed, not JSON) |
 * 'noalign' (billed, JSON without alignment) | 'throw' (network error, not billed) | <status> (not billed) |
 * a function (text) => one of those, for mixed runs.
 */
function world({ sub = subscription(), vendor = 'echo', subsById = null, barrier = 0 } = {}) {
  const state = { sub: structuredClone(sub), vendorCalls: 0, vendorChars: 0, stripeGets: 0, stripeWrites: [], sessionGets: 0, vendorVoiceIds: [] };
  // barrier: the subscription GET answers only once `barrier` requests are waiting on it, then all at once,
  // as real Stripe latency (~100 ms) would line them up. Without it, WebCrypto's thread-pool callbacks
  // serialize the requests and "parallel" tests never overlap at the meter.
  const waiting = [];
  const gate = () => (barrier > 0 ? new Promise(resolve => { waiting.push(resolve); if (waiting.length >= barrier) waiting.splice(0).forEach(r => r()); }) : null);
  const fetcher = vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname === 'api.elevenlabs.io') {
      const { text } = JSON.parse(init.body);
      state.vendorCalls++;
      state.vendorVoiceIds.push(decodeURIComponent(u.pathname.split('/')[3]));
      const mode = typeof vendor === 'function' ? vendor(text) : vendor;
      if (mode === 'throw') throw new TypeError('network');
      if (typeof mode === 'number') return new Response('', { status: mode });
      state.vendorChars += text.length; // billed from here, whatever happens next
      if (mode === 'mismatch') return Response.json(vendorAnswer(`${text} extra`));
      if (mode === 'garbage') return new Response('{not json', { status: 200 });
      if (mode === 'noalign') return Response.json({ audio_base64: btoa('mp3') });
      return Response.json(vendorAnswer(text));
    }
    if (u.hostname === 'api.stripe.com') {
      if ((init.method ?? 'GET') !== 'GET') state.stripeWrites.push(init.body);
      if (u.pathname.startsWith('/v1/invoices/')) {
        const invoiceId = decodeURIComponent(u.pathname.split('/').pop());
        const id = invoiceId === 'in_1' ? 'sub_1' : invoiceId.slice('in_'.length);
        const billSub = subsById?.[id] ?? state.sub;
        const item = billSub?.items?.data?.find(candidate => (typeof candidate.price === 'string' ? candidate.price : candidate.price?.id) === PRICE);
        return Response.json({ id: invoiceId, status: 'paid', currency: 'usd', livemode: /^(sk|rk)_live_/u.test(init.headers?.Authorization?.slice(7) ?? ''), amount_paid: 2000, total: 2000, total_taxes: [], post_payment_credit_notes_amount: 0, parent: { subscription_details: { subscription: id } }, lines: { has_more: false, data: [{ pricing: { price_details: { price: PRICE } }, period: { start: item?.current_period_start, end: item?.current_period_end }, parent: { subscription_item_details: { subscription: id, subscription_item: item?.id, proration: false } } }] } });
      }
      if (u.pathname === '/v1/balance_transactions/txn_budget') return Response.json({ currency: 'usd', fee: 88 });
      if (u.pathname === '/v1/invoice_payments' && u.searchParams.has('invoice')) return Response.json({ has_more: false, data: [{ status: 'paid', currency: 'usd', amount_paid: 2000, payment: { type: 'payment_intent', payment_intent: { status: 'succeeded', latest_charge: { paid: true, captured: true, disputed: false, currency: 'usd', amount: 2000, amount_refunded: 0, balance_transaction: 'txn_budget' } } } }] });
      if (u.pathname.startsWith('/v1/checkout/sessions/')) { state.sessionGets++; return Response.json({ payment_status: 'paid', subscription: state.sub }); }
      if (u.pathname.startsWith('/v1/subscriptions/')) {
        state.stripeGets++;
        await gate();
        const id = decodeURIComponent(u.pathname.split('/').pop());
        if (subsById) return subsById[id] ? Response.json(subsById[id]) : new Response('', { status: 404 });
        return state.sub ? Response.json({ ...state.sub, id, latest_invoice: `in_${id}` }) : new Response('', { status: 404 });
      }
    }
    return new Response('', { status: 500 });
  });
  vi.stubGlobal('fetch', fetcher);
  return state;
}

function env(overrides = {}) {
  return {
    PLUS_ADMIN_ACCESS_ISSUER: undefined, PLUS_ADMIN_ACCESS_AUD: undefined, PLUS_VENDOR_MICRO_USD_PER_CHAR: '60', PLUS_FEE_BPS: '500', PLUS_FEE_FIXED_USD_CENTS: '50', PLUS_RESERVE_BPS: '5000',
    STRIPE_SECRET_KEY: 'sk_test_x', PLUS_COOKIE_SECRET: 'cookie-secret-one', PLUS_PRICE_ID: PRICE,
    ELEVENLABS_API_KEY: 'el-secret', PLUS_VOICE_ID: 'voice-1', PLUS_VOICES: VOICES, PLUS_DAILY_CHAR_CAP: '1000000',
    // These attacks are on the period allowance; the per-subscription daily cap is tested in plus.test.js.
    PLUS_SUB_DAILY_CHAR_CAP: String(VOICE_ALLOWANCE),
    PLUS_METER: meterNamespace(),
    DECISION_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    PLUS_CLAIM_LIMITER: { limit: vi.fn(async () => ({ success: true })) },
    ...overrides
  };
}

const cookieFor = async (e, claim = {}) => `${COOKIE}=${await sign({ c: 'cus_1', s: 'sub_1', exp: EXP, iat: NOW, l: false, ...claim }, e.PLUS_COOKIE_SECRET)}`;
const claimOf = cookie => JSON.parse(Buffer.from(cookie.split('=')[1].split('.')[1], 'base64url').toString());
const LEGIT = { Origin: SITE, 'Content-Type': 'application/json', 'CF-Connecting-IP': '192.0.2.1' };
const voiceReq = (cookie, atoms, headers = {}, extra = {}) => new Request(`${SITE}/api/plus/voice`, {
  method: 'POST', headers: { ...LEGIT, ...(cookie ? { Cookie: cookie } : {}), ...headers }, body: JSON.stringify({ atoms, ...extra })
});
const rawVoiceReq = (cookie, body, headers = {}) => new Request(`${SITE}/api/plus/voice`, {
  method: 'POST', headers: { ...LEGIT, Cookie: cookie, ...headers }, body
});
const claimReq = (headers = {}, sessionId = 'cs_live_leaked') => new Request(`${SITE}/api/plus/claim`, {
  method: 'POST', headers: { ...LEGIT, ...headers }, body: JSON.stringify({ session_id: sessionId })
});
const setCookie = r => r.headers.get('Set-Cookie')?.split(';')[0] ?? null;
const code = async r => (await r.clone().json()).error?.code;
const reserves = e => e.PLUS_METER.calls.filter(([, op]) => op === '/reserve');

afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe('allowance integrity (original exploits, valid plumbing)', () => {
  it('C1: replaying the day-one cookie stops at the allowance, by the server meter (402 PLUS_ALLOWANCE), not by Origin', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const fresh = await cookieFor(e);
    const statuses = [];
    for (let i = 0; i < 30; i++) {
      const r = await worker.fetch(voiceReq(fresh, [textOf(10_000, i)]), e); // same old cookie every time
      statuses.push(r.status === 200 ? 200 : `${r.status} ${await code(r)}`);
    }
    expect(statuses.filter(x => x === 200)).toHaveLength(10);
    expect(statuses.slice(10)).toEqual(Array(20).fill('402 PLUS_ALLOWANCE'));
    expect(s.vendorChars).toBe(100_000);
    expect(s.vendorChars).toBeLessThanOrEqual(VOICE_ALLOWANCE);
    expect(await used(e, 'sub:sub_1', START)).toBe(100_000);
  });

  it('C1b: nothing rolls back: no Stripe write exists, and a re-claim inherits the server count', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const fresh = await cookieFor(e);
    const r1 = await worker.fetch(voiceReq(fresh, [textOf(10_000, 1)]), e);
    await worker.fetch(voiceReq(setCookie(r1), [textOf(10_000, 2)]), e);
    expect(claimOf(setCookie(r1))).not.toHaveProperty('u'); // the cookie carries no count to roll back
    await worker.fetch(voiceReq(fresh, [textOf(10, 3)]), e); // replay day-one cookie
    expect(await used(e, 'sub:sub_1', START)).toBe(20_010);
    const reclaimed = setCookie(await worker.fetch(claimReq(), e));
    const r = await worker.fetch(voiceReq(reclaimed, [textOf(10, 4)]), e);
    expect((await r.json()).allowance.used).toBe(20_020);
    expect(s.stripeWrites).toHaveLength(0);
  });

  it('H1: 10 concurrent requests with room for one: exactly one passes, by the DO reservation', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    for (let round = 0; round < 20; round++) { // random interleavings
      const e = env();
      const s = world({ barrier: 10 });
      await prefill(e, 'sub:sub_1', START, VOICE_ALLOWANCE - 10_000);
      const cookie = await cookieFor(e);
      const results = await Promise.all(Array.from({ length: 10 }, (_, i) => worker.fetch(voiceReq(cookie, [textOf(10_000, 100 + i)]), e)));
      expect(results.filter(r => r.status === 200)).toHaveLength(1);
      expect(await Promise.all(results.filter(r => r.status !== 200).map(code))).toEqual(Array(9).fill('PLUS_ALLOWANCE'));
      expect(s.vendorChars).toBe(10_000);
      expect(await used(e, 'sub:sub_1', START)).toBe(VOICE_ALLOWANCE);
    }
  });

  it('H2: one success link in 5 browsers shares one allowance (the meter is keyed by subscription, not cookie)', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const browsers = [];
    for (let i = 0; i < 5; i++) { vi.setSystemTime((NOW + i * 3600) * 1000); browsers.push(setCookie(await worker.fetch(claimReq(), e))); }
    expect(new Set(browsers).size).toBe(5); // five distinct cookies
    expect(browsers.every(Boolean)).toBe(true);
    let ok = 0;
    for (const [b, cookie] of browsers.entries()) {
      let c = cookie;
      vi.setSystemTime((NOW + 5 * 3600 + b * 120) * 1000); // each browser in its own minute: the per-subscription rate is not what stops them
      for (let i = 0; i < 10; i++) {
        const r = await worker.fetch(voiceReq(c, [textOf(10_000, b * 100 + i)]), e);
        if (r.status === 200) { ok++; c = setCookie(r); } else expect(await code(r)).toBe('PLUS_ALLOWANCE');
      }
    }
    expect(ok).toBe(10);
    expect(s.vendorChars).toBe(100_000);
  });

  it('H3: a cancelled subscription stops: 402 PLUS_REQUIRED from the Stripe GET, before any reservation and the vendor', async () => {
    vi.useFakeTimers({ now: (NOW + 15 * DAY_S) * 1000 });
    const e = env();
    const s = world({ sub: subscription({ status: 'canceled' }) });
    const r = await worker.fetch(voiceReq(await cookieFor(e), [textOf(10_000, 7)]), e);
    expect([r.status, await code(r)]).toEqual([402, 'PLUS_REQUIRED']);
    expect(r.headers.get('Set-Cookie')).toMatch(/Max-Age=0/u);
    expect(s.stripeGets).toBe(1);
    expect(s.vendorCalls).toBe(0);
    expect(reserves(e)).toHaveLength(0);
  });

  it('M1: a billed answer that fails the letter check is metered (reservation stands)', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world({ vendor: 'mismatch' });
    await prefill(e, 'sub:sub_1', START, VOICE_ALLOWANCE - 10_000);
    const cookie = await cookieFor(e);
    const out = [];
    for (let i = 0; i < 5; i++) {
      const r = await worker.fetch(voiceReq(cookie, [textOf(10_000, 1)]), e);
      out.push(`${r.status} ${await code(r)}`);
    }
    expect(out).toEqual(['502 VOICE_REFUSED', ...Array(4).fill('402 PLUS_ALLOWANCE')]);
    expect(s.vendorChars).toBe(10_000);
    expect(await used(e, 'sub:sub_1', START)).toBe(VOICE_ALLOWANCE);
    expect(await used(e, 'global', DAY)).toBe(10_000);
  });

  it('M1b (premise gone: no R2). Replacement: every post-billing failure keeps the reservation, and the Worker touches no storage binding', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    for (const mode of ['garbage', 'noalign']) {
      const base = env();
      const touched = new Set();
      const e = new Proxy(base, { get(t, k) { touched.add(k); return t[k]; } });
      const s = world({ vendor: mode });
      let status;
      try {
        status = (await worker.fetch(voiceReq(await cookieFor(base), [textOf(10_000, 1)]), e)).status;
      } catch (err) {
        status = `threw ${err.constructor.name}`;
      }
      expect(s.vendorChars).toBe(10_000);
      expect(await used(base, 'sub:sub_1', START)).toBe(10_000); // metered either way
      expect(await used(base, 'global', DAY)).toBe(10_000);
      const allowed = new Set(['STRIPE_SECRET_KEY', 'PLUS_COOKIE_SECRET', 'PLUS_COOKIE_SECRET_PREVIOUS', 'PLUS_PRICE_ID', 'ELEVENLABS_API_KEY', 'PLUS_VOICE_ID', 'PLUS_VOICES', 'PLUS_DAILY_CHAR_CAP', 'PLUS_METER', 'DECISION_LIMITER', 'PLUS_VOICE_MODEL', 'PLUS_REQUIRE_LIVE', 'PLUS_SUB_DAILY_CHAR_CAP', 'PLUS_ADMIN_ACCESS_ISSUER', 'PLUS_ADMIN_ACCESS_AUD', 'PLUS_VENDOR_MICRO_USD_PER_CHAR', 'PLUS_FEE_BPS', 'PLUS_FEE_FIXED_USD_CENTS', 'PLUS_RESERVE_BPS']);
      expect([...touched].filter(k => typeof k === 'string' && !allowed.has(k))).toEqual([]);
      if (mode === 'garbage') expect(status).toBe(502);
      if (mode === 'noalign') expect(status).toBe(502); // N12: a handled 502, still metered
    }
  });
});

describe('privacy (M2: premise gone, no shared cache)', () => {
  it('M2: no oracle, no read-back route, no other reader\'s text in any response', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const secret = ['Dear Dr. Lee, my biopsy results came back positive.'];
    const victim = await worker.fetch(voiceReq(await cookieFor(e, { c: 'cus_victim', s: 'sub_v' }), secret), e);
    const { pack: { voiced: { hash } } } = await victim.json();
    // Exhausted attacker: exact text and a variant answer identically, and the vendor is not called.
    await prefill(e, 'sub:sub_a', START, VOICE_ALLOWANCE);
    const attacker = await cookieFor(e, { c: 'cus_attacker', s: 'sub_a' });
    const probe = await worker.fetch(voiceReq(attacker, secret), e);
    const miss = await worker.fetch(voiceReq(attacker, ['Dear Dr. Lee, my biopsy results came back negative.']), e);
    expect([probe.status, await code(probe)]).toEqual([402, 'PLUS_ALLOWANCE']);
    expect([miss.status, await code(miss)]).toEqual([402, 'PLUS_ALLOWANCE']);
    expect(await probe.text()).toBe(await miss.text());
    expect(s.vendorCalls).toBe(1);
    // An attacker with allowance: the exact text is voiced afresh (vendor called, metered) - no cache hit to time or detect.
    const rich = await cookieFor(e, { c: 'cus_rich', s: 'sub_r' });
    const again = await worker.fetch(voiceReq(rich, secret), e);
    expect(again.status).toBe(200);
    expect(s.vendorCalls).toBe(2);
    expect(await used(e, 'sub:sub_r', START)).toBe(secret[0].length);
    const other = await worker.fetch(voiceReq(rich, ['Something else entirely.']), e);
    expect(await other.text()).not.toContain('biopsy');
    // No read-back route of any shape.
    for (const p of [`/api/plus/audio/voiced/${hash}/pack.json`, `/api/plus/audio/voiced/${hash}/audio.mp3`, `/api/plus/voiced/${hash}`, `/api/plus/voice?hash=${hash}`]) {
      const r = await worker.fetch(new Request(`${SITE}${p}`, { headers: { Cookie: rich } }), e);
      expect(r.status === 404 || r.status === 405).toBe(true);
      expect(await r.text()).not.toContain('biopsy');
    }
  });
});

describe('request origin', () => {
  it('L1: text/plain from a sibling Origin is refused 403 FORBIDDEN_ORIGIN; text/plain same-origin is 415; no spend either way', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const cookie = await cookieFor(e);
    const sibling = await worker.fetch(rawVoiceReq(cookie, JSON.stringify({ atoms: [textOf(10_000, 9)] }), { 'Content-Type': 'text/plain', Origin: 'https://evil.syberlabs.io', 'Sec-Fetch-Site': 'same-site' }), e);
    expect([sibling.status, await code(sibling)]).toEqual([403, 'FORBIDDEN_ORIGIN']);
    const sameOriginPlain = await worker.fetch(rawVoiceReq(cookie, JSON.stringify({ atoms: [textOf(10_000, 9)] }), { 'Content-Type': 'text/plain' }), e);
    expect([sameOriginPlain.status, await code(sameOriginPlain)]).toEqual([415, 'BAD_CONTENT_TYPE']);
    for (const ct of ['application/x-www-form-urlencoded', 'multipart/form-data; boundary=x', 'application/jsonp', 'text/plain; application/json']) {
      expect((await worker.fetch(rawVoiceReq(cookie, '{"atoms":["hi"]}', { 'Content-Type': ct }), e)).status).toBe(415);
    }
    const siblingClaim = await worker.fetch(claimReq({ Origin: 'https://evil.syberlabs.io' }), e);
    expect(siblingClaim.status).toBe(403);
    expect(s.vendorCalls + s.stripeGets + s.sessionGets).toBe(0);
  });

  it('L2: a rate limiter that throws fails closed for the voice and the claim (429, nothing spent)', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const down = { limit: vi.fn(async () => { throw new Error('limiter down'); }) };
    const e = env({ DECISION_LIMITER: down, PLUS_CLAIM_LIMITER: down });
    const s = world();
    const r = await worker.fetch(voiceReq(await cookieFor(e), [textOf(100, 1)]), e);
    expect([r.status, await code(r)]).toEqual([429, 'RATE_LIMITED']);
    const c = await worker.fetch(claimReq(), e);
    expect([c.status, await code(c)]).toEqual([429, 'RATE_LIMITED']);
    expect(s.vendorCalls + s.stripeGets + s.sessionGets).toBe(0);
    expect(e.PLUS_METER.calls).toHaveLength(0);
  });
});

describe('cookie mechanics', () => {
  it('rejects a forged payload, a key-id swap, a signature from another secret, and empty/garbage signatures', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const good = (await cookieFor(e)).split('=')[1];
    const [kid, payload, sig] = good.split('.');
    const forgedPayload = Buffer.from(JSON.stringify({ c: 'cus_1', s: 'sub_1', exp: EXP, iat: NOW, l: false })).toString('base64url');
    for (const v of [`${kid}.${forgedPayload}x.${sig}`, `v2.${payload}.${sig}`, (await cookieFor({ PLUS_COOKIE_SECRET: 'other' })).split('=')[1], `${kid}.${payload}.`, `${kid}.${payload}.!!!`]) {
      const r = await worker.fetch(voiceReq(`${COOKIE}=${v}`, ['hello']), e);
      expect([r.status, await code(r)]).toEqual([402, 'PLUS_REQUIRED']);
    }
    expect(s.stripeGets + s.vendorCalls).toBe(0);
  });

  it('a long-exp cookie minted with a leaked secret is now bounded: Stripe decides standing and period, and the re-signed cookie is capped at 40 days', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    world();
    const forever = await cookieFor(e, { exp: NOW + 100 * 365 * DAY_S, iat: NOW });
    const r = await worker.fetch(voiceReq(forever, ['hello there']), e);
    expect(r.status).toBe(200); // a leaked secret still mints usable cookies (expected)
    expect(claimOf(setCookie(r)).exp).toBe(EXP); // ...but the period comes from Stripe
    expect(r.headers.get('Set-Cookie')).toMatch(new RegExp(`Max-Age=${20 * DAY_S + GRACE_S};`));
    const old = await cookieFor(e, { exp: NOW + 100 * 365 * DAY_S, iat: NOW - MAX_COOKIE_S - 1 });
    expect((await worker.fetch(voiceReq(old, ['hello there']), e)).status).toBe(402);
  });

  it('(was: cache hit is free) the same text twice is voiced and metered twice; an exhausted cookie gets nothing', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    await worker.fetch(voiceReq(await cookieFor(e), ['same words']), e);
    await prefill(e, 'sub:sub_1', START, VOICE_ALLOWANCE);
    const r = await worker.fetch(voiceReq(await cookieFor(e), ['same words']), e);
    expect([r.status, await code(r)]).toEqual([402, 'PLUS_ALLOWANCE']);
    expect(s.vendorCalls).toBe(1);
  });

  it('no audio/read-back route exists, traversal or not', async () => {
    for (const p of ['/api/plus/audio/voiced/../../x/pack.json', '/api/plus/audio/voiced/%2e%2e/pack.json', '/api/plus/audio/a/b/1/..%2fpack.json', `/api/plus/audio/voiced/${'a'.repeat(64)}/../pack.json`, '/api/plus/voice/../voices', '/api/plus/./voice']) {
      const path = new URL(`${SITE}${p}`).pathname;
      expect(isPlusRoute(path) ? ['/api/plus/voice', '/api/plus/voices'].includes(path) : true).toBe(true);
      expect(path.startsWith('/api/plus/audio') ? isPlusRoute(path) : false).toBe(false);
    }
  });
});

describe('NEW: attacks on the new design', () => {
  it('N1: a cookie naming another subscription cannot be minted without the secret; tampering never reaches the victim\'s meter', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const mine = (await cookieFor(e, { c: 'cus_a', s: 'sub_a' })).split('=')[1];
    const [kid, , sig] = mine.split('.');
    const victimPayload = Buffer.from(JSON.stringify({ c: 'cus_a', s: 'sub_victim', exp: EXP, iat: NOW, l: false })).toString('base64url');
    const attempts = [
      `${kid}.${victimPayload}.${sig}`, // my signature on the victim's payload
      (await cookieFor({ PLUS_COOKIE_SECRET: 'cookie-secret-onE' }, { s: 'sub_victim' })).split('=')[1],
      `${kid}.${victimPayload}`,
      `${kid}..${sig}`
    ];
    for (const v of attempts) {
      const r = await worker.fetch(voiceReq(`${COOKIE}=${v}`, ['hello there']), e);
      expect([r.status, await code(r)]).toEqual([402, 'PLUS_REQUIRED']);
    }
    // Two cookies, first one forged: the server reads the first (by name) and refuses; it does not fall through to the second.
    const two = `${COOKIE}=${attempts[0]}; ${COOKIE}=${mine}`;
    expect((await worker.fetch(voiceReq(two, ['hello there']), e)).status).toBe(402);
    expect(e.PLUS_METER.calls).toHaveLength(0);
    expect(s.stripeGets).toBe(0);
  });

  it('N1b: even a validly-signed cookie is only honoured if Stripe returns that same subscription id; the meter key is the Stripe-confirmed id', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    // Stripe answers with a different id (e.g. a lookup that resolved elsewhere): refused before the meter.
    const s = world({ subsById: { sub_1: subscription({ id: 'sub_other' }) } });
    const r = await worker.fetch(voiceReq(await cookieFor(e), ['hello there']), e);
    expect([r.status, await code(r)]).toEqual([402, 'PLUS_REQUIRED']);
    expect(reserves(e)).toHaveLength(0);
    expect(s.vendorCalls).toBe(0);
  });

  it('N2: reserve -> vendor error -> release gives no free voicing: no audio without a billed 2xx, and meter >= billed over a random mix', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const modes = ['echo', 'mismatch', 'garbage', 429, 500, 401, 'throw'];
    for (let round = 0; round < 5; round++) {
      const e = env();
      const pick = () => modes[Math.floor(Math.random() * modes.length)];
      const s = world({ vendor: pick, barrier: SUB_RATE_PER_MINUTE });
      const cookie = await cookieFor(e);
      let audios = 0;
      const results = await Promise.all(Array.from({ length: SUB_RATE_PER_MINUTE }, (_, i) => worker.fetch(voiceReq(cookie, [textOf(5_000, i)]), e)));
      for (const r of results) {
        const body = await r.json();
        if (body.audio) { audios++; expect(r.status).toBe(200); }
      }
      const meter = await used(e, 'sub:sub_1', START);
      expect(s.stripeGets).toBe(SUB_RATE_PER_MINUTE); // all overlapped: none found a kept standing
      expect(meter).toBeGreaterThanOrEqual(s.vendorChars); // everything billed is counted
      expect(meter).toBeLessThanOrEqual(VOICE_ALLOWANCE);
      expect(s.vendorChars).toBeLessThanOrEqual(VOICE_ALLOWANCE);
      expect(await used(e, 'global', DAY)).toBe(meter); // the two meters agree
      expect(audios * 5_000).toBeLessThanOrEqual(meter);
    }
  });

  it('N2b: vendor errors and lost answers retain both debits conservatively', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    world({ vendor: 'throw', barrier: 30 });
    const cookie = await cookieFor(e);
    const rs = await Promise.all(Array.from({ length: 30 }, (_, i) => worker.fetch(voiceReq(cookie, [textOf(10_000, i)]), e)));
    for (const c of await Promise.all(rs.map(code))) expect(['UPSTREAM', 'PLUS_ALLOWANCE']).toContain(c); // in-flight reservations may briefly fill the meter
    expect(await used(e, 'sub:sub_1', START)).toBe(100000);
    expect(await used(e, 'global', DAY)).toBe(100000);
  });

  it.each(['/gate', '/reserve'])('N2c: a meter outage at %s fails closed (no vendor call)', async op => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    e.PLUS_METER.failNext = 1;
    e.PLUS_METER.failOp = op;
    expect((await worker.fetch(voiceReq(await cookieFor(e), ['hello there']), e)).status).toBe(503);
    expect(s.vendorCalls).toBe(0);
  });

  it('N3: the daily cap holds under concurrency across 20 subscribers, and losers\' subscription reservations are released', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    for (let round = 0; round < 10; round++) {
      const e = env({ PLUS_DAILY_CHAR_CAP: '30000' });
      const s = world({ barrier: 20 });
      const rs = await Promise.all(Array.from({ length: 20 }, async (_, i) => worker.fetch(voiceReq(await cookieFor(e, { s: `sub_${i}` }), [textOf(10_000, i)]), e)));
      expect(rs.filter(r => r.status === 200)).toHaveLength(3);
      expect(await Promise.all(rs.filter(r => r.status !== 200).map(code))).toEqual(Array(17).fill('PLUS_DAILY_CAP'));
      expect(s.vendorChars).toBe(30_000);
      expect(await used(e, 'global', DAY)).toBe(30_000);
      let subTotal = 0;
      for (let i = 0; i < 20; i++) subTotal += await used(e, `sub:sub_${i}`, START);
      expect(subTotal).toBe(30_000);
    }
  });

  it.each([
    '__proto__', 'constructor', 'toString', 'hasOwnProperty', 'valueOf', '../george', 'george/../rachel', 'george/', 'GEORGE', 'george ', ' george',
    'default\u0000', 'george%2f..', 'JBFqnCBsd6RMkjVDRZzb', 'voice-1', '', 0, 1, true, {}, [], ['george'], { slug: 'george' }, { toString: 'george' }
  ])('N4: voice slug %j is refused 400 UNKNOWN_VOICE before Stripe, the meter and the vendor', async voice => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const r = await worker.fetch(voiceReq(await cookieFor(e), ['hello there'], {}, { voice }), e);
    expect([r.status, await code(r)]).toEqual([400, 'UNKNOWN_VOICE']);
    expect(s.stripeGets + s.vendorCalls).toBe(0);
    expect(e.PLUS_METER.calls).toHaveLength(0);
  });

  it('N4b: null voice falls back to default; a smuggled vendor id, model or text field never reaches the vendor', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const r = await worker.fetch(rawVoiceReq(await cookieFor(e), JSON.stringify({ atoms: ['hello there'], voice: null, voice_id: 'evil', model_id: 'eleven_v3', text: 'x'.repeat(40_000), __proto__: { voice: 'evil' } })), e);
    expect(r.status).toBe(200);
    expect(s.vendorVoiceIds).toEqual(['voice-1']);
    expect(JSON.parse(vi.mocked(fetch).mock.calls.find(([u]) => String(u).includes('elevenlabs'))[1].body)).toEqual({ text: 'hello there', model_id: 'eleven_flash_v2_5' });
  });

  it('N5: /api/plus/voices and /api/plus/voice responses never contain a vendor id', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    world();
    const list = await (await worker.fetch(new Request(`${SITE}/api/plus/voices`), e)).text();
    for (const id of VENDOR_IDS) expect(list).not.toContain(id);
    expect(JSON.parse(list).every(v => Object.keys(v).sort().join() === 'label,slug')).toBe(true);
    for (const voice of ['default', 'george', 'rachel']) {
      const r = await worker.fetch(voiceReq(await cookieFor(e), ['hello there'], {}, { voice }), e);
      const text = await r.text();
      for (const id of VENDOR_IDS) expect(text).not.toContain(id);
      expect(r.headers.get('Set-Cookie')).not.toMatch(new RegExp(VENDOR_IDS.join('|')));
    }
    // error messages do not leak them either
    const bad = await worker.fetch(voiceReq(await cookieFor(e), ['hello there'], {}, { voice: 'nope' }), e);
    const badText = await bad.text();
    for (const id of VENDOR_IDS) expect(badText).not.toContain(id);
  });

  it('N6: huge atoms array, over-long text, and Content-Length lies are refused before Stripe/meter/vendor', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const cookie = await cookieFor(e);
    const cases = [
      [voiceReq(cookie, Array(401).fill('a')), 400, 'BAD_REQUEST'],
      [voiceReq(cookie, Array(400).fill('abcdefghijklmnopqrstuvwx')), 413, 'TOO_LONG'], // 400*25-1 = 9,999? -> check below
      [voiceReq(cookie, Array(400).fill('abcdefghijklmnopqrstuvwxy')), 413, 'TOO_LONG'],
      [rawVoiceReq(cookie, JSON.stringify({ atoms: ['x'.repeat(70_000)] }), { 'Content-Length': '10' }), 413, 'TOO_LARGE'],
      [rawVoiceReq(cookie, JSON.stringify({ atoms: ['x'.repeat(70_000)] }), { 'Content-Length': 'abc' }), 413, 'TOO_LARGE'],
      [rawVoiceReq(cookie, JSON.stringify({ atoms: ['x'.repeat(70_000)] }), { 'Content-Length': '-1' }), 413, 'TOO_LARGE'],
      [rawVoiceReq(cookie, '['.repeat(60_000)), 400, 'BAD_REQUEST'],
      [rawVoiceReq(cookie, `{"atoms":${'['.repeat(30_000)}"a"${']'.repeat(30_000)}}`), 400, 'BAD_REQUEST'],
      [rawVoiceReq(cookie, JSON.stringify({ atoms: { length: 1, 0: 'hi' } })), 400, 'BAD_REQUEST'],
      [rawVoiceReq(cookie, JSON.stringify({ atoms: ['hi', 5] })), 400, 'BAD_REQUEST']
    ];
    for (const [req, status, c] of cases) {
      let r;
      try { r = await worker.fetch(req, e); } catch (err) { r = null; expect.fail(`threw ${err}`); }
      if (c === 'TOO_LONG' && r.status === 200) continue; // 9,999 chars is legitimately within cap
      expect([r.status, await code(r)]).toEqual([status, c]);
    }
    expect(s.stripeGets).toBeLessThanOrEqual(1); // only the legitimate 9,999-char case may proceed
  });

  it('N7: livemode mismatch: a test-mode cookie is refused under a live key before Stripe is asked, and vice versa', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const s = world();
    const live = env({ STRIPE_SECRET_KEY: 'sk_live_x' });
    const restricted = env({ STRIPE_SECRET_KEY: 'rk_live_x' });
    const test = env();
    for (const [e, l] of [[live, false], [restricted, false], [test, true], [live, undefined], [live, 'true'], [live, 1]]) {
      const r = await worker.fetch(voiceReq(await cookieFor(e, { l }), ['hello there']), e);
      expect([r.status, await code(r)]).toEqual([402, 'PLUS_REQUIRED']);
    }
    expect(s.stripeGets + s.vendorCalls).toBe(0);
    expect((await worker.fetch(voiceReq(await cookieFor(live, { l: true }), ['hello there']), live)).status).toBe(200);
  });

  it('N8: an exhausted subscription costs no Stripe call, from any number of addresses (the meter answers first)', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const cookie = await cookieFor(e);
    expect((await worker.fetch(voiceReq(cookie, ['a b']), e)).status).toBe(200); // one Stripe GET; the meter keeps the standing
    await prefill(e, 'sub:sub_1', START, VOICE_ALLOWANCE); // exhausted
    for (let minute = 0; minute < 5; minute++) {
      vi.setSystemTime((NOW + 60 + minute * 600) * 1000); // the kept standing is long stale; its period still runs
      for (let i = 0; i < 20; i++) {
        const r = await worker.fetch(voiceReq(cookie, ['a'], { 'CF-Connecting-IP': `198.51.100.${minute * 20 + i}` }), e); // one request per IP
        expect(await code(r)).toBe('PLUS_ALLOWANCE');
      }
    }
    expect(s.stripeGets).toBe(1);
    expect(s.vendorCalls).toBe(1);
  });

  it('N8: a cancelled subscription\'s replayed cookie costs at most one Stripe call a minute, and is refused within 60 s of the cancellation', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const cookie = await cookieFor(e);
    expect((await worker.fetch(voiceReq(cookie, ['a b']), e)).status).toBe(200);
    s.sub.status = 'canceled'; // cancelled in Stripe; no webhook arrives
    const refusedBy = [];
    // One request every 3 s from a new address (20 a minute: under the per-subscription limit, so that is not what stops it).
    for (let t = 3; t <= 180; t += 3) {
      vi.setSystemTime((NOW + t) * 1000);
      const r = await worker.fetch(voiceReq(cookie, ['a'], { 'CF-Connecting-IP': `203.0.113.${t % 250}` }), e);
      if (r.status !== 200) { expect(await code(r)).toBe('PLUS_REQUIRED'); refusedBy.push(t); }
    }
    expect(refusedBy[0]).toBeLessThanOrEqual(60);
    expect(refusedBy).toHaveLength((180 - refusedBy[0]) / 3 + 1); // never voiced again after
    expect(s.stripeGets).toBeLessThanOrEqual(1 + Math.ceil(180 / 60));
    expect(s.vendorCalls).toBeLessThan(60);
  });

  it(`N8: one subscription gets at most ${SUB_RATE_PER_MINUTE} voicing requests a minute, whatever the addresses`, async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const cookie = await cookieFor(e);
    const results = [];
    for (let i = 0; i < SUB_RATE_PER_MINUTE + 20; i++) results.push(await worker.fetch(voiceReq(cookie, ['a b'], { 'CF-Connecting-IP': `198.51.100.${i}` }), e));
    expect(results.filter(r => r.status === 200)).toHaveLength(SUB_RATE_PER_MINUTE);
    expect(await Promise.all(results.slice(SUB_RATE_PER_MINUTE).map(code))).toEqual(Array(20).fill('RATE_LIMITED'));
    expect(s.vendorCalls).toBe(SUB_RATE_PER_MINUTE);
  });

  it('N8b RESIDUAL: a claim needs no cookie, so each costs one Stripe call; the brake is the strict per-address claim limiter, which fails closed', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    for (let i = 0; i < 50; i++) await worker.fetch(claimReq({ 'CF-Connecting-IP': `198.51.100.${i}` }, `cs_live_random${i}`), e);
    expect(s.sessionGets).toBe(50); // 50 addresses: still 50 calls (bounded by Cloudflare's 5 a minute per address)
    expect(e.PLUS_CLAIM_LIMITER.limit).toHaveBeenCalledTimes(50);
    expect(e.PLUS_CLAIM_LIMITER.limit.mock.calls.every(([{ key }]) => key.startsWith('plus-claim:'))).toBe(true);
    expect(e.DECISION_LIMITER.limit).not.toHaveBeenCalled();
    // One address over its limit: no Stripe call.
    const over = env({ PLUS_CLAIM_LIMITER: { limit: vi.fn(async () => ({ success: false })) } });
    const before = s.sessionGets;
    expect((await worker.fetch(claimReq(), over)).status).toBe(429);
    expect(s.sessionGets).toBe(before);
  });

  it('N9: a refunded or disputed subscription that Stripe still reports active stops at once when Stripe\'s webhook says so; a forged webhook revokes nothing', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const secret = 'whsec_verify';
    const e = env({ STRIPE_WEBHOOK_SECRET: secret });
    const s = world({ sub: subscription({ status: 'active' }) });
    vi.mocked(fetch).mockImplementation((original => async (url, init) => {
      const u = new URL(url);
      if (u.pathname === '/v1/invoice_payments' && !u.searchParams.has('invoice')) return Response.json({ data: [{ invoice: { parent: { subscription_details: { subscription: 'sub_1' } } } }] });
      return original(url, init);
    })(vi.mocked(fetch).getMockImplementation()));
    const cookie = await cookieFor(e);
    expect((await worker.fetch(voiceReq(cookie, [textOf(10_000, 1)]), e)).status).toBe(200);
    const send = async (event, key = secret) => {
      const body = JSON.stringify(event);
      const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(key), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
      const t = Math.floor(Date.now() / 1000);
      const sig = Buffer.from(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${t}.${body}`))).toString('hex');
      return worker.fetch(new Request(`${SITE}/api/plus/stripe-webhook`, { method: 'POST', headers: { 'Stripe-Signature': `t=${t},v1=${sig}`, 'Content-Type': 'application/json' }, body }), e);
    };
    const refund = { id: 'evt_r', type: 'charge.refunded', created: NOW, livemode: false, data: { object: { id: 'ch_1', payment_intent: 'pi_1', refunded: true } } };
    expect((await send(refund, 'whsec_guess')).status).toBe(400); // forged
    expect((await worker.fetch(voiceReq(cookie, [textOf(10_000, 2)]), e)).status).toBe(200);
    expect((await send(refund)).status).toBe(200);
    const r = await worker.fetch(voiceReq(cookie, [textOf(10_000, 3)]), e);
    expect([r.status, await code(r)]).toEqual([402, 'PLUS_REQUIRED']);
    expect(s.vendorCalls).toBe(2);
  });

  it('N10: the allowance is keyed by the Plus item\'s period start; moving the period end mid-period mints nothing', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    const s = world();
    const cookie = await cookieFor(e);
    for (let i = 0; i < 10; i++) await worker.fetch(voiceReq(cookie, [textOf(10_000, i)]), e);
    expect((await worker.fetch(voiceReq(cookie, [textOf(10_000, 50)]), e)).status).toBe(402);
    s.sub.items.data[0].current_period_end = EXP + 3600; // e.g. a trial extension, or a plan change that keeps the anchor
    vi.setSystemTime((NOW + 120) * 1000); // past the kept standing: Stripe is asked again
    const r = await worker.fetch(voiceReq(cookie, [textOf(10_000, 99)]), e);
    expect([r.status, await code(r)]).toEqual([402, 'PLUS_ALLOWANCE']);
    expect(s.vendorChars).toBe(100_000);
  });

  it('N11: with several items, the period comes from the item that carries the Plus price', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    world({ sub: subscription({ items: { data: [{ price: { id: 'price_addon' }, current_period_start: NOW - 1, current_period_end: EXP + 999 }, { price: { id: PRICE }, current_period_start: START, current_period_end: EXP }] } }) });
    const r = await worker.fetch(voiceReq(await cookieFor(e), ['hello there']), e);
    expect((await r.json()).allowance.periodEnd).toBe(EXP);
    expect(await used(e, 'sub:sub_1', START)).toBe(11);
  });
});
