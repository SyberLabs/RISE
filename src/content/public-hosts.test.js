import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  RISE_CANONICAL_ORIGIN,
  RISE_VANITY_HOSTS,
  canonicalUrlForHost
} from './public-hosts.js';
import { KEYSTONE_MANIFESTS, TRY_RISE_PATH } from './keystones.js';

describe('RISE public hosts', () => {
  it('keeps one canonical origin and 301s only the vanity names onto existing paths', () => {
    expect(RISE_CANONICAL_ORIGIN).toBe('https://rise.syberlabs.space');
    expect(canonicalUrlForHost('rise.syberlabs.space')).toBe(`${RISE_CANONICAL_ORIGIN}/`);
    expect(canonicalUrlForHost('try-rise.syberlabs.space'))
      .toBe(`${RISE_CANONICAL_ORIGIN}${TRY_RISE_PATH}`);
    expect(KEYSTONE_MANIFESTS.map(item => item.slug).sort()).toEqual([
      'meditations',
      'metamorphoses',
      'tintern'
    ]);
    for (const { slug } of KEYSTONE_MANIFESTS) {
      expect(canonicalUrlForHost(`${slug}.rise.syberlabs.space`))
        .toBe(`${RISE_CANONICAL_ORIGIN}/keystone/${slug}`);
    }
    expect(canonicalUrlForHost('syberlabs.space')).toBeNull();
    expect(canonicalUrlForHost('unknown.rise.syberlabs.space')).toBeNull();
  });

  it('declares each vanity 301 in netlify.toml before the SPA fallback', () => {
    const toml = readFileSync(resolve('netlify.toml'), 'utf8');
    const spa = toml.indexOf('from = "/*"');
    expect(spa).toBeGreaterThan(0);
    expect(RISE_VANITY_HOSTS).toHaveLength(4);
    for (const { host, path } of RISE_VANITY_HOSTS) {
      const from = `from = "https://${host}/*"`;
      const to = `to = "${RISE_CANONICAL_ORIGIN}${path}"`;
      expect(toml, host).toContain(from);
      expect(toml, host).toContain(to);
      expect(toml.indexOf(from), host).toBeLessThan(spa);
    }
    expect(toml).toMatch(/status = 301/);
    expect(toml).toMatch(/force = true/);
  });
});
