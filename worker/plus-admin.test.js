import { beforeAll, afterEach, describe, expect, it, vi } from 'vitest';
import { getAdmin, verifyAdmin } from './plus-admin.mjs';

const issuer = 'https://rise-admin.cloudflareaccess.com';
const env = { PLUS_ADMIN_ACCESS_ISSUER: issuer, PLUS_ADMIN_ACCESS_AUD: 'rise-admin-app' };
const enc = value => Buffer.from(typeof value === 'string' ? value : JSON.stringify(value)).toString('base64url');
let privateKey, jwk;
beforeAll(async () => {
  const pair = await crypto.subtle.generateKey({ name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' }, true, ['sign', 'verify']);
  privateKey = pair.privateKey;
  jwk = { ...await crypto.subtle.exportKey('jwk', pair.publicKey), kid: 'test-key', alg: 'RS256', use: 'sig' };
});
afterEach(() => vi.unstubAllGlobals());
async function token(overrides = {}, header = {}) {
  const now = Math.floor(Date.now() / 1000);
  const parts = [enc({ alg: 'RS256', kid: 'test-key', ...header }), enc({ iss: issuer, aud: ['rise-admin-app'], type: 'app', sub: 'verified-admin', email: 'admin@example.com', iat: now, exp: now + 600, ...overrides })];
  const signature = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', privateKey, new TextEncoder().encode(parts.join('.')));
  return `${parts.join('.')}.${Buffer.from(signature).toString('base64url')}`;
}
function keys() { vi.stubGlobal('fetch', vi.fn(async url => new Response(JSON.stringify(url.includes('/certs') ? { keys: [jwk] } : { subject: 'verified-admin' })))); }
function request(jwt, cookie = false) { return new Request('https://rise.syberlabs.io/api/plus/status', { headers: cookie ? { Cookie: `CF_Authorization=${jwt}` } : { 'Cf-Access-Jwt-Assertion': jwt } }); }
describe('Cloudflare Access administrator identity', () => {
  it('accepts a cryptographically verified application user through assertion or browser cookie', async () => {
    keys();
    const jwt = await token();
    expect(await getAdmin(request(jwt), env)).toEqual({ subject: 'verified-admin' });
    expect(await getAdmin(request(jwt, true), env)).toEqual({ subject: 'verified-admin' });
    expect(fetch.mock.calls[0][0]).toBe(`${issuer}/cdn-cgi/access/certs`);
    expect(fetch.mock.calls[0][1].redirect).toBe('manual');
    expect(fetch.mock.calls.some(([url, options]) => url.endsWith('/admin/check') && options.headers.Cookie === `CF_Authorization=${jwt}`)).toBe(true);
  });
  it.each([{ iss: 'https://attacker.example' }, { aud: ['other-app'] }, { exp: 1 }, { iat: 9999999999 }, { type: 'service' }, { email: undefined }, { sub: '' }])('denies invalid claims %j', async override => {
    keys();
    expect(await getAdmin(request(await token(override)), env)).toBeNull();
  });
  it('denies a forged signature and an algorithm override', async () => {
    keys();
    const jwt = await token();
    const parts = jwt.split('.');
    parts[1] = enc({ iss: issuer, aud: ['rise-admin-app'], sub: 'attacker', email: 'a@b.com', type: 'app', exp: 9999999999, iat: 1 });
    expect(await getAdmin(request(parts.join('.')), env)).toBeNull();
    expect(await getAdmin(request(await token({}, { alg: 'none' })), env)).toBeNull();
  });
  it('denies a revoked session even while its signature is valid', async () => {
    keys();
    const jwt = await token();
    expect(await verifyAdmin(request(jwt), env)).toEqual({ subject: 'verified-admin' });
    vi.stubGlobal('fetch', vi.fn(async () => new Response(null, { status: 302, headers: { Location: issuer } })));
    expect(await getAdmin(request(jwt), env)).toBeNull();
  });
  it('fails closed without configuration and refuses arbitrary key hosts', async () => {
    keys();
    const jwt = await token();
    expect(await getAdmin(request(jwt), {})).toBeNull();
    expect(await getAdmin(request(jwt), { ...env, PLUS_ADMIN_ACCESS_ISSUER: 'https://attacker.example' })).toBeNull();
  });
  it('fails closed when the public key service fails', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new Error('offline'); }));
    expect(await getAdmin(request(await token({ iss: 'https://offline.cloudflareaccess.com' })), { ...env, PLUS_ADMIN_ACCESS_ISSUER: 'https://offline.cloudflareaccess.com' })).toBeNull();
  });
});
