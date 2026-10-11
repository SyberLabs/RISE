import { afterEach, describe, expect, it, vi } from 'vitest';
import worker from './index.mjs';
import { PLUS_INTERNALS, PlusMeter } from './plus.mjs';
import { spendingPolicy } from './plus-budget.mjs';
const SITE = 'https://rise.example';
const NOW = 1800000000;
const PRICE = 'price_plus';
const UUID = '8f8bb0bc-1338-42ed-9bf5-6694e538d6f1';
const subscription = (extra = {}) => ({ id: 'sub_1', customer: 'cus_1', status: 'active', livemode: false, metadata: { rise_offer: 'v1_60000' }, items: { data: [{ id:'si_1', price: { id: PRICE }, current_period_start: NOW-1000, current_period_end: NOW+86400*20 }] }, ...extra });
function environment(extra = {}) {
 const instances = new Map();
 return { STRIPE_SECRET_KEY:'sk_test_x', PLUS_COOKIE_SECRET:'cookie-secret', PLUS_PRICE_ID:PRICE, STRIPE_WEBHOOK_SECRET:'whsec_x', PLUS_CHECKOUT_ENABLED:'true', PLUS_PORTAL_CONFIGURATION:'bpc_1', RESEND_API_KEY:'resend-secret', PLUS_EMAIL_FROM:'RISE <rise@example.com>', ELEVENLABS_API_KEY:'vendor-secret', PLUS_VOICE_ID:'voice', PLUS_VOICES:[{slug:'default',label:'Default'}], PLUS_DAILY_CHAR_CAP:'500000', PLUS_CLAIM_LIMITER:{limit:async()=>({success:true})}, DECISION_LIMITER:{limit:async()=>({success:true})}, PLUS_METER:{idFromName:n=>n,get(name){if(!instances.has(name)){const map=new Map();instances.set(name,new PlusMeter({storage:{kv:{get:k=>map.get(k),put:(k,v)=>map.set(k,v),delete:k=>map.delete(k)}}}));}return {fetch:(url,init)=>instances.get(name).fetch(new Request(url,init))};}}, ...extra };
}
function world({ sub=subscription(), customers=[{id:'cus_1',email:'reader@example.com'}], priceExtra={}, portalExtra={}, failEmail=false }={}) {
 const state={ mails:[], checkouts:[], portals:[], calls:[] };
 vi.stubGlobal('fetch',vi.fn(async(url,init={})=>{
  const u=new URL(url);state.calls.push(u.pathname);
  if(u.hostname==='api.resend.com'){if(failEmail)return new Response('',{status:503});state.mails.push(JSON.parse(init.body));return Response.json({id:'mail_1'});}
  if(u.hostname!=='api.stripe.com')throw new Error('Unexpected host');
  if(u.pathname===`/v1/prices/${PRICE}`)return Response.json({id:PRICE,active:true,livemode:false,currency:'usd',unit_amount:899,billing_scheme:'per_unit',tax_behavior:'exclusive',recurring:{interval:'month',interval_count:1,usage_type:'licensed'},product:{id:'prod_1',active:true},...priceExtra});
  if(u.pathname==='/v1/checkout/sessions'){state.checkouts.push({body:new URLSearchParams(init.body),headers:init.headers});return Response.json({url:'https://checkout.stripe.com/c/pay/cs_test_1'});}
  if(u.pathname.startsWith('/v1/checkout/sessions/'))return Response.json({livemode:false,mode:'subscription',status:'complete',payment_status:'paid',client_reference_id:state.checkouts.at(-1)?.body.get('client_reference_id') ?? null,subscription:sub});
  if(u.pathname==='/v1/billing_portal/configurations/bpc_1')return portalExtra===null?new Response('',{status:404}):Response.json({id:'bpc_1',active:true,livemode:false,features:{subscription_cancel:{enabled:true,mode:'at_period_end'},invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_update:{enabled:false}},...portalExtra});
  if(u.pathname==='/v1/billing_portal/sessions'){state.portals.push(new URLSearchParams(init.body));return Response.json({url:'https://billing.stripe.com/p/session/test'});}
  if(u.pathname==='/v1/customers')return Response.json({data:customers.filter(c=>c.email===u.searchParams.get('email')),has_more:false});
  if(u.pathname==='/v1/customers/search')return Response.json({data:customers,has_more:false});
  if(u.pathname==='/v1/subscriptions')return Response.json({data:[sub],has_more:false});
  if(u.pathname===`/v1/subscriptions/${sub.id}`)return Response.json(sub);
  throw new Error('Unexpected Stripe path '+u.pathname);
 }));return state;
}
function req(path,body,cookie,headers={}) {return new Request(SITE+'/api/plus/'+path,{method:body===undefined?'GET':'POST',headers:{Origin:SITE,'Content-Type':'application/json','CF-Connecting-IP':'192.0.2.1',...(cookie?{Cookie:cookie}:{}),...headers},...(body===undefined?{}:{body:JSON.stringify(body)})});}
async function call(e,path,body,cookie,headers){return worker.fetch(req(path,body,cookie,headers),e);}
function cookies(response){return response.headers.getSetCookie().map(v=>v.split(';')[0]).join('; ');}
function mailToken(mail){return new URL(mail.text.match(/https:\/\/\S+/)[0]).hash.slice('#token='.length);}
async function claim(e){return cookies(await call(e,'claim',{session_id:'cs_test_1'}));}
afterEach(()=>{vi.unstubAllGlobals();vi.useRealTimers();});

describe('Plus customer lifecycle',()=>{
 it('advertises only the fixed funded offer, and withholds checkout when sender is missing',async()=>{
  vi.useFakeTimers({now:NOW*1000});world();
  const live=await (await call(environment(),'config')).json();
  expect(live).toMatchObject({checkoutAvailable:true,recoveryAvailable:true,offer:{amount:899,currency:'usd',interval:'month',characterLimit:60000}});
  const unavailable=await (await call(environment({RESEND_API_KEY:undefined}),'config')).json();
  expect(unavailable).toMatchObject({checkoutAvailable:false,recoveryAvailable:false,offer:null});
 });
 it('creates retry-safe Checkout with server price and fixed return destinations',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();const state=world();
  const r=await call(e,'checkout',{request_id:UUID,price:'price_attacker',success_url:'https://evil.example'});
  expect(r.status).toBe(200);expect(await r.json()).toEqual({url:'https://checkout.stripe.com/c/pay/cs_test_1'});
  const fields=state.checkouts[0].body;
  expect(fields.get('line_items[0][price]')).toBe(PRICE);expect(fields.get('success_url')).toBe(SITE+'/plus/claim?session_id={CHECKOUT_SESSION_ID}');
  expect(fields.get('cancel_url')).toBe(SITE+'/plus/');expect(fields.get('subscription_data[metadata][rise_offer]')).toBe('v1_60000');expect(fields.get('allow_promotion_codes')).toBe('false');
  await call(e,'checkout',{request_id:UUID});expect(state.checkouts[0].headers['Idempotency-Key']).toBe(state.checkouts[1].headers['Idempotency-Key']);
 });
 it.each([{unit_amount:799},{tax_behavior:'inclusive'},{currency:'eur'},{active:false},{livemode:true},{recurring:{interval:'month',interval_count:1,usage_type:'metered'}}])('refuses misconfigured price before taking payment %j',async priceExtra=>{
  const e=environment();const state=world({priceExtra});expect((await call(e,'checkout',{request_id:UUID})).status).toBe(503);expect(state.checkouts).toHaveLength(0);
 });
 it('refuses checkout when the spending policy cannot fund the advertised allowance',async()=>{
  const e=environment({PLUS_VENDOR_MICRO_USD_PER_CHAR:'100'});const state=world();expect((await call(e,'checkout',{request_id:UUID})).status).toBe(503);expect(state.checkouts).toHaveLength(0);
 });
 it.each([null,{features:{subscription_cancel:{enabled:true,mode:'immediately'},invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_update:{enabled:false}}},{active:false},{livemode:true},{features:{subscription_cancel:{enabled:false},invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_update:{enabled:false}}},{features:{subscription_cancel:{enabled:true,mode:'at_period_end'},invoice_history:{enabled:false},payment_method_update:{enabled:true},subscription_update:{enabled:false}}},{features:{subscription_cancel:{enabled:true,mode:'at_period_end'},invoice_history:{enabled:true},payment_method_update:{enabled:false},subscription_update:{enabled:false}}},{features:{subscription_cancel:{enabled:true,mode:'at_period_end'},invoice_history:{enabled:true},payment_method_update:{enabled:true},subscription_update:{enabled:true}}}])('does not sell with an unavailable or unsupported billing portal: %j',async portalExtra=>{
  const e=environment();const state=world({portalExtra});expect((await call(e,'checkout',{request_id:UUID})).status).toBe(503);expect(state.checkouts).toHaveLength(0);
  expect((await (await call(e,'config')).json()).checkoutAvailable).toBe(false);
 });
 it('bounds portal readiness caching but rechecks the actual portal before checkout',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();const state=world();await call(e,'config');await call(e,'config');
  expect(state.calls.filter(path=>path==='/v1/billing_portal/configurations/bpc_1')).toHaveLength(1);
  vi.setSystemTime((NOW+61)*1000);await call(e,'config');expect(state.calls.filter(path=>path==='/v1/billing_portal/configurations/bpc_1')).toHaveLength(2);
  const changed=world({portalExtra:{active:false}});expect((await call(e,'checkout',{request_id:UUID})).status).toBe(503);expect(changed.checkouts).toHaveLength(0);
 });
 it('rejects cross-origin writes and malformed idempotency keys',async()=>{
  const e=environment();const state=world();expect((await call(e,'checkout',{request_id:UUID},null,{Origin:'https://evil.example'})).status).toBe(403);expect((await call(e,'checkout',{request_id:'x'})).status).toBe(400);expect(state.checkouts).toHaveLength(0);
 });
 it('binds a new Checkout receipt to the purchasing browser instead of accepting a copied success URL',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();world();const started=await call(e,'checkout',{request_id:UUID});expect(started.status).toBe(200);
  expect((await call(e,'claim',{session_id:'cs_test_1'})).status).toBe(401);
  expect((await call(e,'claim',{session_id:'cs_test_1'},cookies(started))).status).toBe(204);
 });
 it('fails closed when customer endpoints cannot identify an address for rate limiting',async()=>{
  const e=environment();world();const request=req('recover',{email:'reader@example.com'});request.headers.delete('CF-Connecting-IP');
  expect((await worker.fetch(request,e)).status).toBe(503);
 });
 it('keeps recovery and billing available after the operator closes acquisition',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment({STRIPE_SECRET_KEY:'sk_live_x',PLUS_REQUIRE_LIVE:'true',PLUS_CHECKOUT_ENABLED:'false',PLUS_PAYMENT_LINK:''});const state=world();const cookie=await claim(e);
  expect((await call(e,'portal',{},cookie)).status).toBe(200);expect((await call(e,'recover',{email:'reader@example.com'})).status).toBe(202);expect(state.mails).toHaveLength(1);
  expect((await (await call(e,'config')).json())).toMatchObject({checkoutAvailable:false,recoveryAvailable:true,offer:null});
 });
 it('keeps billing access after the paid subscription lapses and ignores caller customer IDs',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();world();const cookie=await claim(e);
  world({sub:subscription({status:'canceled'})});
  const r=await call(e,'portal',{customer:'cus_attacker'},cookie);expect(r.status).toBe(200);expect(await r.json()).toEqual({url:'https://billing.stripe.com/p/session/test'});
  const s=await (await call(e,'status',undefined,cookie)).json();expect(s.billingAvailable).toBe(true);expect(s.subscriber).toBe(false);
 });
 it('does not sell a second subscription to a recognized active subscriber',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();const state=world();const cookie=await claim(e);
  expect((await call(e,'checkout',{request_id:UUID},cookie)).status).toBe(409);expect(state.checkouts).toHaveLength(0);
 });
 it('refuses duplicate checkout when Stripe returns an unknown nonterminal subscription state',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();world();const cookie=await claim(e);const state=world({sub:subscription({status:'future_state'})});
  expect((await call(e,'checkout',{request_id:UUID},cookie)).status).toBe(409);expect(state.checkouts).toHaveLength(0);
 });
 it('does not grant portal access from an unverified customer ID',async()=>{
  const e=environment();const state=world();expect((await call(e,'portal',{customer:'cus_1'})).status).toBe(401);expect(state.portals).toHaveLength(0);
 });
 it('creates a fresh customer for a canceled subscriber so old credits and discounts cannot underfund the offer',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();world();const cookie=await claim(e);const state=world({sub:subscription({status:'canceled'})});
  expect((await call(e,'checkout',{request_id:UUID},cookie)).status).toBe(200);expect(state.checkouts[0].body.has('customer')).toBe(false);
 });
 it('chooses an active subscription across customers sharing an email before a canceled fallback',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();const state=world({customers:[{id:'cus_old',email:'reader@example.com'},{id:'cus_1',email:'reader@example.com'}]});
  const original=vi.mocked(fetch).getMockImplementation();vi.mocked(fetch).mockImplementation((url,init)=>new URL(url).pathname==='/v1/subscriptions'&&new URL(url).searchParams.get('customer')==='cus_old'?Promise.resolve(Response.json({data:[subscription({id:'sub_old',customer:'cus_old',status:'canceled'})],has_more:false})):original(url,init));
  await call(e,'recover',{email:'reader@example.com'});expect(state.mails).toHaveLength(1);const r=await call(e,'restore',{token:mailToken(state.mails[0])});expect(r.status).toBe(204);
  const r2=await call(e,'portal',{},cookies(r));expect(r2.status).toBe(200);expect(state.portals[0].get('customer')).toBe('cus_1');
 });
 it('recovers email with different capitalization without trusting unrelated search results',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();const state=world();expect((await call(e,'recover',{email:'READER@example.com'})).status).toBe(202);expect(state.mails).toHaveLength(1);expect(state.mails[0].to).toEqual(['reader@example.com']);
 });
 it('sends an expiring recovery fragment to the Stripe email and consumes it once across concurrent requests',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();const state=world();
  expect((await call(e,'recover',{email:'reader@example.com'})).status).toBe(202);expect(state.mails).toHaveLength(1);expect(state.mails[0].to).toEqual(['reader@example.com']);
  expect(state.mails).toHaveLength(1);const token=mailToken(state.mails[0]);expect(token).toBeTruthy();
  const results=await Promise.all([call(e,'restore',{token}),call(e,'restore',{token})]);expect(results.map(r=>r.status).sort()).toEqual([204,400]);
  expect(cookies(results.find(r=>r.status===204))).toContain('__Secure-rise_plus=');
 });
 it('returns identical recovery responses for unknown addresses without sending mail',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();world();const known=await call(e,'recover',{email:'reader@example.com'});expect(known.status).toBe(202);
  const state=world({customers:[]});const unknown=await call(e,'recover',{email:'unknown@example.com'});expect(unknown.status).toBe(known.status);expect(await unknown.json()).toEqual(await known.json());expect(state.mails).toHaveLength(0);
 });
 it('refuses expired or modified recovery tokens and prevents using recovery tokens as voice cookies',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();const state=world();await call(e,'recover',{email:'reader@example.com'});expect(state.mails).toHaveLength(1);const token=mailToken(state.mails[0]);
  expect((await call(e,'restore',{token:token+'x'})).status).toBe(400);
  const status=await (await call(e,'status',undefined,PLUS_INTERNALS.COOKIE+'='+token)).json();expect(status.subscriber).toBe(false);expect(status.billingAvailable).toBe(false);
  vi.setSystemTime((NOW+901)*1000);expect((await call(e,'restore',{token})).status).toBe(400);
 });
 it('recovers canceled subscriptions for self-service billing without reviving paid access',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();const state=world({sub:subscription({status:'canceled'})});await call(e,'recover',{email:'reader@example.com'});
  expect(state.mails).toHaveLength(1);const r=await call(e,'restore',{token:mailToken(state.mails[0])});expect(r.status).toBe(204);const cookie=cookies(r);
  expect((await (await call(e,'status',undefined,cookie)).json())).toMatchObject({subscriber:false,billingAvailable:true});expect((await call(e,'portal',{},cookie)).status).toBe(200);
 });
 it('invalidates active cached financial standing when recovery confirms cancellation',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();const state=world({sub:subscription({status:'canceled'})});
  const meter=e.PLUS_METER.get('sub:sub_1');
  await meter.fetch('https://plus-meter/standing',{method:'POST',body:JSON.stringify({revision:0,subscriptionStatus:'active',standing:{c:'cus_1',s:'sub_1',start:NOW-1000,exp:NOW+20*86400,l:false,budgetMicros:10000000,budgetPolicy:JSON.stringify(spendingPolicy(e))}})});
  await call(e,'recover',{email:'reader@example.com'});expect(state.mails).toHaveLength(1);
  const restored=await call(e,'restore',{token:mailToken(state.mails[0])});expect(restored.status).toBe(204);
  const status=await call(e,'status',undefined,cookies(restored));expect(await status.json()).toMatchObject({subscriber:false,available:false,billingAvailable:true,canSubscribe:true});
  expect(status.headers.getSetCookie().some(value=>/^__Secure-rise_plus=v1/u.test(value))).toBe(false);
  const stale=await meter.fetch('https://plus-meter/standing',{method:'POST',body:JSON.stringify({revision:0,subscriptionStatus:'active',standing:{s:'sub_1'}})});
  expect(await stale.json()).toMatchObject({ok:false,changed:true});
 });
 it('rate limits recovery email per subscription and fails closed on unavailable address limiter',async()=>{
  vi.useFakeTimers({now:NOW*1000});const e=environment();const state=world();await call(e,'recover',{email:'reader@example.com'});await call(e,'recover',{email:'reader@example.com'});expect(state.mails).toHaveLength(1);
  expect((await call(environment({PLUS_CLAIM_LIMITER:undefined}),'recover',{email:'reader@example.com'})).status).toBe(503);
 });
});
