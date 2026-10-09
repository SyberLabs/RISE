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
  return { STRIPE_SECRET_KEY: 'sk_live_example', PLUS_COOKIE_SECRET: 'secret', PLUS_PRICE_ID: PRICE, STRIPE_WEBHOOK_SECRET: 'webhook', PLUS_PAYMENT_LINK: 'https://buy.stripe.com/live', PLUS_REQUIRE_LIVE: 'true', ELEVENLABS_API_KEY: 'vendor', PLUS_VOICE_ID: 'voice', PLUS_VOICES: [{ slug: 'default', label: 'Default' }], PLUS_DAILY_CHAR_CAP: '500000', PLUS_SUB_DAILY_CHAR_CAP: '105000', DECISION_LIMITER: { limit: async () => ({ success: true }) }, PLUS_METER: { idFromName: n => n, get(name) { if (!instances.has(name)) { const map = new Map(); instances.set(name, new PlusMeter({ storage: { kv: { get: k => map.get(k), put: (k,v) => map.set(k,v), delete: k => map.delete(k) } } })); } return { fetch: (url, init) => instances.get(name).fetch(new Request(url,init)) }; } }, ...overrides };
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
async function request(e,n) {
  const token = await PLUS_INTERNALS.sign({ c:'cus_1',s:'sub_1',exp:END,iat:NOW,l:true },e.PLUS_COOKIE_SECRET);
  return new Request(SITE+'/api/plus/voice',{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json',Cookie:PLUS_INTERNALS.COOKIE+'='+token,'CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({atoms:['a'.repeat(n)]})});
}
afterEach(()=>{auth.subject = null; auth.calls = 0;vi.unstubAllGlobals();vi.useRealTimers();});

describe('subscriber vendor spend is funded by collected revenue',()=>{
  it('atomically caps an $8.99 paid invoice at 67,000 characters after conservative fees and reserve',async()=>{
    vi.useFakeTimers({now:NOW*1000}); const e=env();const state=world();
    const responses=await Promise.all(Array.from({length:8},async()=>handlePlus(await request(e,10000),e)));
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


const adminRequest = n => new Request(SITE+'/api/plus/voice',{method:'POST',headers:{Origin:SITE,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1'},body:JSON.stringify({atoms:['a'.repeat(n)]})});
describe('authenticated administrators have a separate bounded budget',()=>{
  it('does not require Stripe readiness, while sharing the $5 monthly budget across administrators',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env({STRIPE_SECRET_KEY:undefined,PLUS_COOKIE_SECRET:undefined,STRIPE_WEBHOOK_SECRET:undefined,PLUS_ADMIN_MONTHLY_USD_CENTS:'500',PLUS_ADMIN_DAILY_CHAR_CAP:'25000'});const state=world();auth.subject='admin-one';
    const first=await handlePlus(adminRequest(10000),e);expect(first.status).toBe(200);expect((await first.json()).allowance.limit).toBe(83333);
    auth.subject='admin-two';expect((await handlePlus(adminRequest(10000),e)).status).toBe(200);
    const dayOver=await handlePlus(adminRequest(10000),e);expect(dayOver.status).toBe(429);
    for(let day=1;day<=2;day++){vi.setSystemTime((NOW+day*86400)*1000);expect((await handlePlus(adminRequest(10000),e)).status).toBe(200);expect((await handlePlus(adminRequest(10000),e)).status).toBe(200);}
    vi.setSystemTime((NOW+3*86400)*1000);expect((await handlePlus(adminRequest(10000),e)).status).toBe(200);
    expect((await handlePlus(adminRequest(10000),e)).status).toBe(200);
    expect((await handlePlus(adminRequest(3333),e)).status).toBe(200);
    expect((await handlePlus(adminRequest(1),e)).status).toBe(402);expect(state.vendorChars).toBe(83333);
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
    vi.useFakeTimers({now:NOW*1000});const e=env({PLUS_ADMIN_MONTHLY_USD_CENTS:'500',PLUS_DAILY_CHAR_CAP:'1'});const state=world();auth.subject='admin';expect((await handlePlus(adminRequest(1),e)).status).toBe(200);expect((await handlePlus(adminRequest(1),e)).status).toBe(503);expect(state.vendorChars).toBe(1);
  });
  it('reports verified status and redirects admin sign-in only after identity verification',async()=>{
    vi.useFakeTimers({now:NOW*1000});const e=env({PLUS_ADMIN_MONTHLY_USD_CENTS:'500',PLUS_ADMIN_ACCESS_ISSUER:'https://team.cloudflareaccess.com',PLUS_ADMIN_ACCESS_AUD:'aud'});world();
    const signedOut=await handlePlus(new Request(SITE+'/api/plus/status'),e);expect(signedOut.status).toBe(200);expect(await signedOut.json()).toEqual({admin:false,subscriber:false,available:false,adminLogin:true,allowance:null});
    expect((await handlePlus(new Request(SITE+'/api/plus/admin/login'),e)).status).toBe(403);
    auth.subject='admin';const signedIn=await handlePlus(new Request(SITE+'/api/plus/status'),e);expect(await signedIn.json()).toMatchObject({admin:true,subscriber:false,available:true,allowance:{used:0,limit:83333}});
    const login=await handlePlus(new Request(SITE+'/api/plus/admin/login'),e);expect(login.status).toBe(303);expect(login.headers.get('Location')).toBe('/settings');
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
    expect(await r.json()).toEqual({admin:false,subscriber:true,available:true,adminLogin:false,allowance:{used:0,limit:67000,periodEnd:END}});expect(state.vendorCalls).toBe(0);
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
      expect(await response.json()).toEqual({ admin: false, subscriber: false, available: false, adminLogin: false, allowance: null });
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
