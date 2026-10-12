import { audioStorage } from './plus-test-storage.mjs';
import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index.mjs';
import { handlePlus, PLUS_INTERNALS, PlusMeter } from './plus.mjs';

const auth = vi.hoisted(() => ({ subject: null, calls: 0 }));
vi.mock('./plus-admin.mjs', () => ({ getAdmin: async () => { auth.calls++; return auth.subject ? { subject: auth.subject } : null; }, verifyAdmin: async () => auth.subject ? { subject: auth.subject } : null }));

const NOW = 1800000000;
const START = NOW - 864000;
const END = NOW + 1728000;
const SITE = 'https://rise.example';
const PRICE = 'price_plus';
const sub = { id: 'sub_1', status: 'active', customer: 'cus_1', latest_invoice: 'in_1', items: { data: [{ id: 'si_1', price: { id: PRICE }, current_period_start: START, current_period_end: END }] } };
const invoice = () => ({ id: 'in_1', status: 'paid', currency: 'usd', livemode: true, amount_paid: 899, total: 899, total_taxes: [], post_payment_credit_notes_amount: 0, parent: { subscription_details: { subscription: 'sub_1' } }, lines: { has_more: false, data: [{ amount: 899, pricing: { price_details: { price: PRICE } }, period: { start: START, end: END }, parent: { type: 'subscription_item_details', subscription_item_details: { subscription: 'sub_1', subscription_item: 'si_1', proration: false } } }] } });
function env(overrides = {}) {
  const instances = new Map();
  return { STRIPE_SECRET_KEY: 'sk_live_example', PLUS_COOKIE_SECRET: 'secret', PLUS_PRICE_ID: PRICE, STRIPE_WEBHOOK_SECRET: 'webhook', PLUS_PAYMENT_LINK: 'https://buy.stripe.com/live', PLUS_REQUIRE_LIVE: 'true', ELEVENLABS_API_KEY: 'vendor', PLUS_VOICE_ID: 'voice', PLUS_VOICES: [{ slug: 'default', label: 'Default' }], PLUS_DAILY_CHAR_CAP: '500000', PLUS_SUB_DAILY_CHAR_CAP: '105000', DECISION_LIMITER: { limit: async () => ({ success: true }) }, PLUS_METER: { idFromName: n => n, get(name) { if (!instances.has(name)) { const map = new Map(); instances.set(name, new PlusMeter({ storage: audioStorage() })); } return { fetch: (url, init) => instances.get(name).fetch(new Request(url,init)) }; } }, ...overrides };
}
function world({ bill = invoice(), refund = 0, fee = 56, subscription = sub, transportFailure = false } = {}) {
  const state = { vendorCalls: 0, vendorChars: 0 };
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    if (u.hostname === 'api.stripe.com') {
      if (u.pathname.startsWith('/v1/subscriptions/')) return Response.json(subscription);
      if (u.pathname === '/v1/invoices/in_1') return Response.json(bill);
      if (u.pathname === '/v1/invoice_payments') return Response.json({ has_more: false, data: [{ status: 'paid', currency: 'usd', amount_paid: bill.amount_paid, payment: { type: 'payment_intent', payment_intent: { id: 'pi_1', status: 'succeeded', latest_charge: { id: 'ch_1', currency: 'usd', paid: true, captured: true, amount: bill.amount_paid, amount_refunded: refund, disputed: false, balance_transaction: 'txn_1' } } } }] });
      if (u.pathname === '/v1/balance_transactions/txn_1') return Response.json({ currency: 'usd', fee });
      return new Response('', { status: 404 });
    }
    if (u.hostname === 'api.elevenlabs.io') {
      const { text } = JSON.parse(init.body); state.vendorCalls++; state.vendorChars += text.length;
      if (transportFailure) throw new Error('connection lost after upload');
      const characters = [...text]; const starts = characters.map((_,i) => i * .06);
      return Response.json({ audio_base64: btoa('audio'), alignment: { characters, character_start_times_seconds: starts, character_end_times_seconds: starts.map(t => t+.06) } });
    }
    return new Response('', { status: 404 });
  }));
  return state;
}
async function request(e,n, char = 'a') {
  const token = await PLUS_INTERNALS.sign({ c:'cus_1',s:'sub_1',exp:END,iat:NOW,l:true },e.PLUS_COOKIE_SECRET);
  return new Request(SITE+'/api/plus/voice',{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json',Cookie:PLUS_INTERNALS.COOKIE+'='+token,'CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({atoms:[char.repeat(n)]})});
}
afterEach(()=>{auth.subject = null; auth.calls = 0;vi.unstubAllGlobals();vi.useRealTimers();});

describe('subscriber vendor spend is funded by collected revenue',()=>{
  it('atomically caps an $8.99 paid invoice at 67,000 characters after conservative fees and reserve',async()=>{
    vi.useFakeTimers({now:NOW*1000}); const e=env();const state=world();
    const responses=[];
    for (let batch=0;batch<2;batch++) responses.push(...await Promise.all(Array.from({length:4},async(_,i)=>handlePlus(await request(e,10000,String.fromCharCode(97+batch*4+i)),e))));
    expect(responses.filter(r=>r.status===200)).toHaveLength(6);
    expect(state.vendorChars).toBe(60000);
    const remaining=await handlePlus(await request(e,7000),e);expect(remaining.status).toBe(200);
    expect((await remaining.json()).allowance.limit).toBe(67000);
    expect((await handlePlus(await request(e,1),e)).status).toBe(402);
    expect(state.vendorChars).toBe(67000);
  });
  it.each(['unpaid','zero','other-currency','other-period','other-price','multiple-lines','truncated-lines','missing-tax','trial'])('does not spend against %s revenue',async kind=>{
    vi.useFakeTimers({now:NOW*1000});const bill=invoice(); let subscription=sub;
    if(kind==='unpaid')bill.status='open';
    if(kind==='zero')bill.amount_paid=0;
    if(kind==='other-currency')bill.currency='eur';
    if(kind==='other-period')bill.lines.data[0].period.start=START-1;
    if(kind==='other-price')bill.lines.data[0].pricing.price_details.price='price_other';
    if(kind==='multiple-lines')bill.lines.data.push({...bill.lines.data[0]});
    if(kind==='truncated-lines')bill.lines.has_more=true;
    if(kind==='missing-tax')delete bill.total_taxes;
    if(kind==='trial')subscription={...sub,status:'trialing'};
    const e=env();const state=world({bill,subscription}); const r=await handlePlus(await request(e,1),e);
    expect(r.status).toBe(402);expect(state.vendorCalls).toBe(0);
  });
  it('uses discounted amount collected and actual tax rather than the advertised price',async()=>{
    vi.useFakeTimers({now:NOW*1000});const bill=invoice();bill.amount_paid=500;bill.total_taxes=[{amount:50}];const e=env();world({bill});
    const r=await handlePlus(await request(e,1),e);expect(r.status).toBe(200);
    expect((await r.json()).allowance.limit).toBe(31250); // (500-50-25-50)*50% cents / .006 cents per character
  });
  it('subtracts actual processor fees when greater than the configured upper estimate',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env();world({fee:200});
    const r=await handlePlus(await request(e,1),e);expect(r.status).toBe(200);expect((await r.json()).allowance.limit).toBe(58250);
  });
  it('subtracts refunded money before funding the next generation',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env();world({refund:400});
    const r=await handlePlus(await request(e,1),e);expect(r.status).toBe(200);expect((await r.json()).allowance.limit).toBe(33666);
  });
  it.each([{PLUS_VENDOR_MICRO_USD_PER_CHAR:'0'},{PLUS_VENDOR_MICRO_USD_PER_CHAR:'59'},{PLUS_FEE_BPS:'bogus'},{PLUS_RESERVE_BPS:'10001'},{PLUS_VOICE_MODEL:'unpriced_model'}])('refuses invalid or unsafe cost policy %j',async overrides=>{
    vi.useFakeTimers({now:NOW*1000});const e=env(overrides);const state=world();expect((await handlePlus(await request(e,1),e)).status).toBe(503);expect(state.vendorCalls).toBe(0);
  });
  it('fails closed when the meter has an outage',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env({PLUS_METER:{idFromName:n=>n,get:()=>({fetch:async()=>{throw new Error('down');}})}});const state=world();
    const r=await handlePlus(await request(e,1),e);expect(r.status).toBe(503);expect(state.vendorCalls).toBe(0);
  });
  it('retains the debit when the billable request has an unknown transport outcome',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env();world({transportFailure:true});expect((await handlePlus(await request(e,10000),e)).status).toBe(502);
    world();const r=await handlePlus(await request(e,1),e);expect(r.status).toBe(200);expect((await r.json()).allowance.used).toBe(10001);
  });
});


const adminRequest = (n, char = 'a') => new Request(SITE+'/api/plus/voice',{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({atoms:[char.repeat(n)]})});
describe('authenticated administrators have a separate bounded budget',()=>{
  it('does not require Stripe readiness, while sharing the $5 monthly budget across administrators',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env({STRIPE_SECRET_KEY:undefined,PLUS_COOKIE_SECRET:undefined,STRIPE_WEBHOOK_SECRET:undefined,PLUS_ADMIN_MONTHLY_USD_CENTS:'500',PLUS_ADMIN_DAILY_CHAR_CAP:'25000'});const state=world();auth.subject='admin-one';let sequence=0;const next=n=>adminRequest(n,String.fromCharCode(97+sequence++));
    const first=await handlePlus(next(10000),e);expect(first.status).toBe(200);expect((await first.json()).allowance.limit).toBe(83333);
    auth.subject='admin-two';expect((await handlePlus(next(10000),e)).status).toBe(200);
    const dayOver=await handlePlus(next(10000),e);expect(dayOver.status).toBe(429);
    for(let day=1;day<=2;day++){vi.setSystemTime((NOW+day*86400)*1000);expect((await handlePlus(next(10000),e)).status).toBe(200);expect((await handlePlus(next(10000),e)).status).toBe(200);}
    vi.setSystemTime((NOW+3*86400)*1000);expect((await handlePlus(next(10000),e)).status).toBe(200);
    expect((await handlePlus(next(10000),e)).status).toBe(200);
    expect((await handlePlus(next(3333),e)).status).toBe(200);
    expect((await handlePlus(next(1),e)).status).toBe(402);expect(state.vendorChars).toBe(83333);
  });
  it.each([undefined,'0','501','bogus'])('fails closed without a safe explicit admin monthly cap (%s)',async cap=>{
    vi.useFakeTimers({now:NOW*1000});const e=env({PLUS_ADMIN_MONTHLY_USD_CENTS:cap});const state=world();auth.subject='admin';expect((await handlePlus(adminRequest(1),e)).status).toBe(503);expect(state.vendorCalls).toBe(0);
  });
  it('does not accept an administrator role sent in a request or an unverified cookie',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env({PLUS_ADMIN_MONTHLY_USD_CENTS:'500'});const state=world();
    const r=await handlePlus(new Request(SITE+'/api/plus/voice',{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json',Cookie:'admin=true; CF_Authorization=unverified'},body:JSON.stringify({atoms:['hello'],admin:true})}),e);
    expect(r.status).toBe(402);expect(state.vendorCalls).toBe(0);
  });
  it('counts administrator requests against the shared global cap',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env({PLUS_ADMIN_MONTHLY_USD_CENTS:'500',PLUS_DAILY_CHAR_CAP:'1'});const state=world();auth.subject='admin';expect((await handlePlus(adminRequest(1),e)).status).toBe(200);expect((await handlePlus(adminRequest(1,'b'),e)).status).toBe(503);expect(state.vendorChars).toBe(1);
  });
  it('reports verified status and redirects admin sign-in only after identity verification',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env({PLUS_ADMIN_MONTHLY_USD_CENTS:'500',PLUS_ADMIN_ACCESS_ISSUER:'https://team.cloudflareaccess.com',PLUS_ADMIN_ACCESS_AUD:'aud'});world();
    const signedOut=await handlePlus(new Request(SITE+'/api/plus/status'),e);expect(signedOut.status).toBe(200);expect(await signedOut.json()).toEqual({canSubscribe:true,billingAvailable:false,admin:false,subscriber:false,available:false,adminLogin:true,allowance:null});
    expect((await handlePlus(new Request(SITE+'/api/plus/admin/login'),e)).status).toBe(403);
    auth.subject='admin';const signedIn=await handlePlus(new Request(SITE+'/api/plus/status'),e);expect(await signedIn.json()).toMatchObject({admin:true,subscriber:false,available:true,allowance:{used:0,limit:83333}});
    const login=await handlePlus(new Request(SITE+'/api/plus/admin/login'),e);expect(login.status).toBe(303);expect(login.headers.get('Location')).toBe('/settings');
    expect((await handlePlus(new Request(SITE+'/api/plus/admin/login?returnTo=voice-demo'),e)).headers.get('Location')).toBe('/voice-demo');
  });
  it('preserves dollar debits when the configured vendor rate is lowered after earlier spending',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env({PLUS_ADMIN_MONTHLY_USD_CENTS:'1',PLUS_VENDOR_MICRO_USD_PER_CHAR:'100'});world();auth.subject='admin';
    expect((await handlePlus(adminRequest(100),e)).status).toBe(200);e.PLUS_VENDOR_MICRO_USD_PER_CHAR='60';expect((await handlePlus(adminRequest(1),e)).status).toBe(402);
  });
});


describe('financial standing cannot race a refund invalidation',()=>{
  it('refuses an in-flight old invoice result after a partial refund event',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env();const state=world();const original=vi.mocked(fetch).getMockImplementation();
    vi.mocked(fetch).mockImplementation(async(url,init)=>{
      if(new URL(url).pathname==='/v1/invoices/in_1') await e.PLUS_METER.get('sub:sub_1').fetch('https://plus-meter/event',{method:'POST',body:JSON.stringify({id:'evt_partial',created:NOW,action:'refresh'})});
      return original(url,init);
    });
    const r=await handlePlus(await request(e,1),e);expect(r.status).toBe(503);expect(state.vendorCalls).toBe(0);
  });
  it('reports only server-verified subscriber allowance without spending it',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env();const state=world();const voice=await request(e,1);const r=await handlePlus(new Request(SITE+'/api/plus/status',{headers:{Cookie:voice.headers.get('Cookie')}}),e);
    expect(await r.json()).toEqual({canSubscribe:false,billingAvailable:false,admin:false,subscriber:true,available:true,adminLogin:false,audioScope:expect.stringMatching(/^[a-f0-9]{64}$/u),allowance:{used:0,limit:67000,periodEnd:END}});expect(state.vendorCalls).toBe(0);
  });
});


describe('new entitlement routes reach the production Worker',()=>{
  it('admits status and protected login/check paths through the Worker router',async()=>{
    const e=env();const status=await worker.fetch(new Request(SITE+'/api/plus/status'),e);expect(status.status).toBe(200);
    expect((await worker.fetch(new Request(SITE+'/api/plus/admin/login'),e)).status).toBe(403);
    expect((await worker.fetch(new Request(SITE+'/api/plus/admin/check'),e)).status).toBe(403);
    auth.subject='verified';const checked=await worker.fetch(new Request(SITE+'/api/plus/admin/check',{headers:{'Cf-Access-Jwt-Assertion':'edge-verified-test-token'}}),e);expect(await checked.json()).toEqual({subject:'verified'});
  });
});

describe('status caches unavailable subscriptions without hiding normal signed-out state', () => {
  it('reuses a negative financial standing for two requests, then rechecks after its cache expires', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    world({ subscription: { ...sub, status: 'canceled' } });
    const upstream = vi.mocked(fetch).getMockImplementation();
    let subscriptionGets = 0;
    vi.mocked(fetch).mockImplementation((url, init) => {
      if (new URL(url).pathname.startsWith('/v1/subscriptions/')) subscriptionGets++;
      return upstream(url, init);
    });
    const cookie = (await request(e, 1)).headers.get('Cookie');
    const read = () => handlePlus(new Request(SITE + '/api/plus/status', { headers: { Cookie: cookie } }), e);
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await read();
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual({ canSubscribe: true, billingAvailable: false, admin: false, subscriber: false, available: false, adminLogin: false, allowance: null });
    }
    expect(subscriptionGets).toBe(1);
    vi.setSystemTime((NOW + 61) * 1000);
    expect((await read()).status).toBe(200);
    expect(subscriptionGets).toBe(2);
  });

  it('treats a Stripe subscription 404 as a normal signed-out response and caches the null standing', async () => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env();
    world();
    const upstream = vi.mocked(fetch).getMockImplementation();
    let subscriptionGets = 0;
    vi.mocked(fetch).mockImplementation((url, init) => {
      if (new URL(url).pathname.startsWith('/v1/subscriptions/')) {
        subscriptionGets++;
        return new Response('', { status: 404 });
      }
      return upstream(url, init);
    });
    const cookie = (await request(e, 1)).headers.get('Cookie');
    for (let attempt = 0; attempt < 2; attempt++) {
      const response = await handlePlus(new Request(SITE + '/api/plus/status', { headers: { Cookie: cookie } }), e);
      expect(response.status).toBe(200);
      expect(await response.json()).toMatchObject({ admin: false, subscriber: false, available: false, allowance: null });
    }
    expect(subscriptionGets).toBe(1);
    const voice = await handlePlus(await request(e, 1), e);
    expect(voice.status).toBe(402);
    expect(subscriptionGets).toBe(1);
  });
});


describe('public entitlement status is rate limited before any paid or authentication lookups', () => {
  it.each(['denied', 'outage'])('returns 429 on a %s address limiter before contacting Stripe or Access', async mode => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const e = env({ DECISION_LIMITER: { limit: async () => { if (mode === 'outage') throw new Error('rate limiter unavailable'); return { success: false }; } } });
    world();
    auth.subject = 'verified';
    const response = await worker.fetch(new Request(SITE + '/api/plus/status', { headers: { 'CF-Connecting-IP': '192.0.2.1' } }), e);
    expect(response.status).toBe(429);
    expect((await response.json()).error.code).toBe('RATE_LIMITED');
    expect(auth.calls).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
  it('fails closed when the status address limiter is not configured', async () => {
    const e = env({ DECISION_LIMITER: undefined });
    world();
    const response = await worker.fetch(new Request(SITE + '/api/plus/status', { headers: { 'CF-Connecting-IP': '192.0.2.1' } }), e);
    expect(response.status).toBe(503);
    expect(auth.calls).toBe(0);
    expect(fetch).not.toHaveBeenCalled();
  });
});


describe('administrator liveness check requires a fresh Access assertion', () => {
  it('refuses a cookie alone even when its signature would verify', async () => {
    const e = env();
    auth.subject = 'verified';
    const response = await worker.fetch(new Request(SITE + '/api/plus/admin/check', { headers: { Cookie: 'CF_Authorization=previously-signed-token' } }), e);
    expect(response.status).toBe(403);
  });
});

async function usageSnapshot(e, name, period) {
  return (await (await e.PLUS_METER.get(name).fetch('https://meter/inspect', { method: 'POST', body: JSON.stringify({ period }) })).json());
}
const rpcAnswer = text => { const characters = [...text], starts = characters.map((_, i) => i * .06); return Response.json({ audio_base64: btoa('audio'), alignment: { characters, character_start_times_seconds: starts, character_end_times_seconds: starts.map(t => t + .06) } }); };
describe('private provider preflight and billing boundary', () => {
  it.each([['subscriber', 400], ['subscriber', 503], ['admin', 400], ['admin', 503]])('returns every reservation for a definitive private pre-vendor refusal (%s/%s)', async (role, status) => {
    vi.useFakeTimers({ now: NOW * 1000 });
    auth.subject = role === 'admin' ? 'verified-admin' : null;
    const ready = vi.fn(async () => ({ ready: true }));
    const render = vi.fn().mockResolvedValueOnce({ contacted: false, status }).mockImplementation(async input => ({ contacted: true, response: rpcAnswer(input.text) }));
    const e = env({ ELEVENLABS_API_KEY: undefined, PLUS_VOICE_PROVIDER: { ready, render }, PLUS_ADMIN_MONTHLY_USD_CENTS: '500', PLUS_ADMIN_DAILY_CHAR_CAP: '5', PLUS_SUB_DAILY_CHAR_CAP: '5', PLUS_DAILY_CHAR_CAP: '5' });
    const state = world();
    const send = async n => handlePlus(role === 'admin' ? adminRequest(n) : await request(e, n), e);
    expect((await send(5)).status).toBe(503);
    const period = role === 'admin' ? Date.UTC(2027, 0, 1) / 1000 : START;
    expect(await usageSnapshot(e, role === 'admin' ? 'admin' : 'sub:sub_1', period)).toMatchObject({ used: 0, spentMicros: 0 });
    expect(await usageSnapshot(e, 'global', '2027-01-15')).toMatchObject({ used: 0 });
    expect((await send(5)).status).toBe(200); // Own day and global day were also released.
    expect(render).toHaveBeenCalledTimes(2);
    expect(state.vendorCalls).toBe(0);
  });
  it.each(['false', 'throw', 'missing'])('an intended but unready provider does not reserve or fall back to a direct key (%s)', async outcome => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const ready = outcome === 'missing' ? undefined : vi.fn(async () => { if (outcome === 'throw') throw new Error('offline'); return { ready: false }; });
    const render = vi.fn(); const e = env({ PLUS_VOICE_PROVIDER: { ready, render } }); const state = world();
    expect((await handlePlus(await request(e, 5), e)).status).toBe(503);
    expect(await usageSnapshot(e, 'sub:sub_1', START)).toMatchObject({ used: 0, spentMicros: 0 });
    const token = await PLUS_INTERNALS.sign({ c: 'cus_1', s: 'sub_1', exp: END, iat: NOW, l: true }, e.PLUS_COOKIE_SECRET);
    const status = await handlePlus(new Request(SITE + '/api/plus/status', { headers: { Cookie: PLUS_INTERNALS.COOKIE + '=' + token } }), e);
    expect(await status.json()).toMatchObject({ subscriber: true, available: outcome !== 'missing' }); // Status is advisory; the miss still performed the actual preflight above.
    expect(render).not.toHaveBeenCalled(); expect(state.vendorCalls).toBe(0);
  });
  it.each(['throw', 'vendor-refusal', 'malformed-envelope', 'bad-no-contact-shape'])('retains every debit after an uncertain or contacted RPC outcome (%s)', async outcome => {
    vi.useFakeTimers({ now: NOW * 1000 });
    const render = vi.fn(async () => {
      if (outcome === 'throw') throw new Error('answer lost');
      if (outcome === 'malformed-envelope') return { contacted: 'false', status: 503 };
      if (outcome === 'bad-no-contact-shape') return { contacted: false, status: 503, response: new Response(null, { status: 503 }) };
      return { contacted: true, response: new Response(null, { status: 503, headers: { 'X-Provider-Contacted': 'false' } }) };
    });
    const e = env({ ELEVENLABS_API_KEY: undefined, PLUS_VOICE_PROVIDER: { ready: async () => ({ ready: true }), render } }); world();
    expect((await handlePlus(await request(e, 5), e)).status).toBe(502);
    expect(await usageSnapshot(e, 'sub:sub_1', START)).toMatchObject({ used: 5, spentMicros: 300 });
    expect(await usageSnapshot(e, 'global', '2027-01-15')).toMatchObject({ used: 5 });
  });
  it('does not accept a direct vendor response header as authority to release budget', async () => {
    vi.useFakeTimers({ now: NOW * 1000 }); const e = env(); world(); const upstream = fetch;
    vi.stubGlobal('fetch', async (url, init) => new URL(url).hostname === 'api.elevenlabs.io' ? new Response(null, { status: 503, headers: { 'X-Provider-Contacted': 'false' } }) : upstream(url, init));
    expect((await handlePlus(await request(e, 5), e)).status).toBe(502);
    expect(await usageSnapshot(e, 'sub:sub_1', START)).toMatchObject({ used: 5, spentMicros: 300 });
    expect(await usageSnapshot(e, 'global', '2027-01-15')).toMatchObject({ used: 5 });
  });
});

it('bounds stalled readiness on a voice miss without blocking status or reserving allowance', async () => {
  vi.useFakeTimers({ now: NOW * 1000 }); auth.subject = 'admin';
  const ready = vi.fn(() => new Promise(() => {})), render = vi.fn();
  const e = env({ PLUS_VOICE_PROVIDER: { ready, render }, PLUS_ADMIN_MONTHLY_USD_CENTS: '500' }); const state = world();
  const voicing = handlePlus(adminRequest(5), e);
  await vi.waitFor(() => expect(ready).toHaveBeenCalledTimes(1));
  await vi.advanceTimersByTimeAsync(5001);
  expect((await voicing).status).toBe(503);
  expect(await usageSnapshot(e, 'admin', Date.UTC(2027, 0, 1) / 1000)).toMatchObject({ used: 0, spentMicros: 0 });
  const inspecting = await handlePlus(new Request(SITE + '/api/plus/status'), e);
  expect(await inspecting.json()).toMatchObject({ admin: true, available: true });
  expect(ready).toHaveBeenCalledTimes(1);
  expect(render).not.toHaveBeenCalled(); expect(state.vendorCalls).toBe(0);
});

describe('the fixed customer offer and renewal', () => {
  it('limits the new offer to 60,000 characters while preserving the legacy spending budget', async () => {
    vi.useFakeTimers({now:NOW*1000});const e=env();const state=world({subscription:{...sub,metadata:{rise_offer:'v1_60000'}}});
    for(let i=0;i<6;i++) expect((await handlePlus(await request(e,10000,String.fromCharCode(97+i)),e)).status).toBe(200);
    expect((await handlePlus(await request(e,1),e)).status).toBe(402);
    expect(state.vendorChars).toBe(60000);
    const original=await request(e,1);
    const status=await handlePlus(new Request(SITE+'/api/plus/status',{headers:original.headers}),e);
    expect((await status.json()).allowance.limit).toBe(60000);
  });
  it('refreshes a signed receipt after renewal instead of losing a still-paying customer at the old period end', async () => {
    vi.useFakeTimers({now:NOW*1000});const e=env();world();
    const token=await PLUS_INTERNALS.sign({c:'cus_1',s:'sub_1',exp:NOW-4*86400,iat:NOW-30*86400,l:true},e.PLUS_COOKIE_SECRET);
    const r=await handlePlus(new Request(SITE+'/api/plus/status',{headers:{Cookie:PLUS_INTERNALS.COOKIE+'='+token,'CF-Connecting-IP':'192.0.2.1'}}),e);
    expect((await r.json()).subscriber).toBe(true);
    expect(r.headers.getSetCookie().some(value=>value.startsWith('__Secure-rise_plus='))).toBe(true);
  });
});

describe('authoritative repurchase eligibility', () => {
  it.each([['canceled',true],['incomplete_expired',true],['past_due',false],['unpaid',false],['active',false],['trialing',false]])('allows only ended subscriptions to repurchase: %s', async (subscriptionStatus,eligible) => {
    vi.useFakeTimers({now:NOW*1000});const e=env();world({subscription:{...sub,status:subscriptionStatus}});
    const original=await request(e,1);
    for(let i=0;i<2;i++) {
      const r=await handlePlus(new Request(SITE+'/api/plus/status',{headers:original.headers}),e);
      expect((await r.json()).canSubscribe).toBe(eligible);
    }
    const reads=vi.mocked(fetch).mock.calls.filter(([url])=>new URL(url).pathname==='/v1/subscriptions/sub_1');
    expect(reads).toHaveLength(1);
  });
  it('uses a verified deletion event to allow a canceled subscriber to return', async () => {
    vi.useFakeTimers({now:NOW*1000});const e=env();world();
    await e.PLUS_METER.get('sub:sub_1').fetch('https://plus-meter/event',{method:'POST',body:JSON.stringify({id:'evt_deleted',created:NOW,action:'revoke',kind:'deleted'})});
    const original=await request(e,1);const r=await handlePlus(new Request(SITE+'/api/plus/status',{headers:original.headers}),e);
    expect(await r.json()).toMatchObject({subscriber:false,canSubscribe:true});
  });
});

it('clears stale canceled eligibility when Stripe no longer knows the subscription', async () => {
  vi.useFakeTimers({now:NOW*1000});const e=env();world({subscription:{...sub,status:'canceled'}});
  const original=await request(e,1);
  const read=()=>handlePlus(new Request(SITE+'/api/plus/status',{headers:original.headers}),e);
  expect((await (await read()).json()).canSubscribe).toBe(true);
  vi.setSystemTime((NOW+61)*1000);
  const upstream=vi.mocked(fetch).getMockImplementation();
  vi.mocked(fetch).mockImplementation((url,init)=>new URL(url).pathname==='/v1/subscriptions/sub_1'?Promise.resolve(new Response('',{status:404})):upstream(url,init));
  expect((await (await read()).json()).canSubscribe).toBe(false);
});

it('isolates administrator audio by verified issuer and subject despite the shared spend meter', async () => {
  vi.useFakeTimers({ now: NOW * 1000 });
  const e = env({ PLUS_ADMIN_MONTHLY_USD_CENTS: '500', PLUS_ADMIN_ACCESS_ISSUER: 'https://one.cloudflareaccess.com' });
  const state = world();
  const scopes = [];
  for (const [issuer, subject] of [['https://one.cloudflareaccess.com', 'admin-one'], ['https://one.cloudflareaccess.com', 'admin-two'], ['https://two.cloudflareaccess.com', 'admin-one']]) {
    e.PLUS_ADMIN_ACCESS_ISSUER = issuer;
    auth.subject = subject;
    const response = await handlePlus(adminRequest(5), e);
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.cache.hit).toBe(false);
    scopes.push(body.cache.scope);
  }
  expect(new Set(scopes).size).toBe(3);
  const replay = await handlePlus(adminRequest(5), e);
  expect((await replay.json()).cache.hit).toBe(true);
  expect(state.vendorCalls).toBe(3);
});

it('serves saved audio and confirms its owner without waiting for a stalled provider', async () => {
  vi.useFakeTimers({ now: NOW * 1000 });
  auth.subject = 'admin';
  const ready = vi.fn(async () => ({ ready: true }));
  const render = vi.fn(async input => ({ contacted: true, response: rpcAnswer(input.text) }));
  const e = env({ PLUS_VOICE_PROVIDER: { ready, render }, PLUS_ADMIN_MONTHLY_USD_CENTS: '500' });
  world();
  expect((await handlePlus(adminRequest(5), e)).status).toBe(200);
  ready.mockImplementation(() => new Promise(() => {}));
  const replay = await handlePlus(adminRequest(5), e);
  expect(replay.status).toBe(200);
  const saved = await replay.json();
  expect(saved.cache.hit).toBe(true);
  let status;
  const inspecting = handlePlus(new Request(SITE + '/api/plus/status'), e).then(async response => { status = await response.json(); });
  await vi.waitFor(() => expect(status).toMatchObject({ admin: true, available: true, audioScope: saved.cache.scope }), { timeout: 100, interval: 10 });
  await inspecting;
  expect(ready).toHaveBeenCalledTimes(1);
  expect(render).toHaveBeenCalledTimes(1);
});
