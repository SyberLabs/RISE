/** Dedicated Cloudflare Access application grants admin voice access; never a client-side role flag.
 * Protect /api/plus/admin-login with an Access Allow policy for the administrators only.
 * The application's audience must be different from every public/staff application.
 */
const ISSUER = /^https:\/\/[a-z0-9-]+\.cloudflareaccess\.com$/u;
const keysByIssuer = new Map();
const KEY_TTL_MS = 5 * 60 * 1000;
const decode = part => Uint8Array.from(atob(part.replace(/-/gu, '+').replace(/_/gu, '/')), c => c.charCodeAt(0));
const json = part => JSON.parse(new TextDecoder().decode(decode(part)));

async function publicKeys(issuer) {
  const cached = keysByIssuer.get(issuer);
  if (cached && cached.until > Date.now()) return cached.keys;
  const response = await fetch(`${issuer}/cdn-cgi/access/certs`, { redirect: 'manual', signal: AbortSignal.timeout(5000) });
  if (!response.ok) throw new Error('Access keys unavailable');
  const body = await response.json();
  if (!Array.isArray(body.keys) || body.keys.length > 20) throw new Error('Invalid Access keys');
  if (keysByIssuer.size >= 8) keysByIssuer.delete(keysByIssuer.keys().next().value);
  keysByIssuer.set(issuer, { keys: body.keys, until: Date.now() + KEY_TTL_MS });
  return body.keys;
}

/** Returns a verified human administrator, or null. Configuration and network failures deny access. */
export async function getAdmin(request, env) {
  const issuer = env.PLUS_ADMIN_ACCESS_ISSUER;
  const audience = env.PLUS_ADMIN_ACCESS_AUD;
  if (typeof issuer !== 'string' || !ISSUER.test(issuer) || typeof audience !== 'string' || !audience.trim()) return null;
  const assertion = request.headers.get('Cf-Access-Jwt-Assertion');
  const cookie = request.headers.get('Cookie')?.split(';').map(v => v.trim()).find(v => v.startsWith('CF_Authorization='))?.slice('CF_Authorization='.length);
  const token = assertion || cookie;
  if (typeof token !== 'string' || token.length > 16384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/u.test(token)) return null;
  try {
    const [head, payload, signature] = token.split('.');
    const header = json(head);
    const claim = json(payload);
    const now = Math.floor(Date.now() / 1000);
    if (header.alg !== 'RS256' || typeof header.kid !== 'string' || header.kid.length > 256) return null;
    if (claim.iss !== issuer || !Array.isArray(claim.aud) || !claim.aud.includes(audience)) return null;
    if (!Number.isSafeInteger(claim.exp) || claim.exp <= now || !Number.isSafeInteger(claim.iat) || claim.iat > now + 60 || claim.iat > claim.exp) return null;
    if (claim.nbf != null && (!Number.isSafeInteger(claim.nbf) || claim.nbf > now)) return null;
    if (claim.type !== 'app' || typeof claim.email !== 'string' || !claim.email.includes('@') || typeof claim.sub !== 'string' || !claim.sub || claim.sub.length > 256) return null;
    const jwk = (await publicKeys(issuer)).find(key => key.kid === header.kid && key.kty === 'RSA' && (!key.alg || key.alg === 'RS256') && (!key.use || key.use === 'sig'));
    if (!jwk) return null;
    const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
    const valid = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, decode(signature), new TextEncoder().encode(`${head}.${payload}`));
    return valid ? { subject: claim.sub } : null;
  } catch {
    return null;
  }
}
