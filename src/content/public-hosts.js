/**
 * Public hostnames under syberlabs.space.
 *
 * The SPA keeps running on one origin. Vanity names exist to share; they
 * 301 onto the paths this file names. Do not add a host here without the
 * matching Netlify redirect — public-hosts.test.js holds them together.
 */

import { KEYSTONE_MANIFESTS, TRY_RISE_PATH } from './keystones.js';

export const RISE_CANONICAL_HOST = 'rise.syberlabs.space';
export const RISE_CANONICAL_ORIGIN = `https://${RISE_CANONICAL_HOST}`;

function freeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(freeze);
  return value;
}

export const RISE_VANITY_HOSTS = freeze([
  { host: 'try-rise.syberlabs.space', path: TRY_RISE_PATH },
  ...KEYSTONE_MANIFESTS.map(item => ({
    host: `${item.slug}.${RISE_CANONICAL_HOST}`,
    path: `/keystone/${item.slug}`
  }))
]);

export function canonicalUrlForHost(hostname) {
  const host = String(hostname || '').trim().toLowerCase().replace(/\.$/u, '');
  if (host === RISE_CANONICAL_HOST) return `${RISE_CANONICAL_ORIGIN}/`;
  const hit = RISE_VANITY_HOSTS.find(item => item.host === host);
  return hit ? `${RISE_CANONICAL_ORIGIN}${hit.path}` : null;
}
