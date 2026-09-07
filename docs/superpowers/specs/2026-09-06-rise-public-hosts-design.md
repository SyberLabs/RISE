# RISE public hosts on syberlabs.space

**Date:** 2026-09-06
**Status:** approved
**Product:** RISE Netlify SPA; lab site remains GitHub Pages

## Problem

The public URL is a Netlify subdomain. Social bios and Keystone shares need
names under `syberlabs.space`. The SPA already has durable paths (`/`,
`/try-rise`, `/keystone/{slug}`). Those paths must stay the running origin.

## Decision

One canonical origin: `https://rise.syberlabs.space`.

Vanity hostnames are share/entry aliases. They 301 onto that origin plus the
existing path. They do not remain the origin for IndexedDB, audio consent, or
the PWA.

| Share | Canonical |
|---|---|
| `rise.syberlabs.space` | `/` (no redirect) |
| `try-rise.syberlabs.space` | `/try-rise` |
| `meditations.rise.syberlabs.space` | `/keystone/meditations` |
| `metamorphoses.rise.syberlabs.space` | `/keystone/metamorphoses` |
| `tintern.rise.syberlabs.space` | `/keystone/tintern` |

The three Keystone slugs are the locked release set. No wildcard host map.

`rise-v2-symbolic-experience.netlify.app` remains a fallback origin.

## Non-goals

- Changing GitHub Pages for `syberlabs.space` in this repository
- Host-sticky SPA routing (split origins)
- `www` aliases

## DNS (Namecheap)

CNAME each of `rise`, `try-rise`, `meditations.rise`, `metamorphoses.rise`,
`tintern.rise` to `rise-v2-symbolic-experience.netlify.app`. Then attach those
five hostnames as custom domains on the existing Netlify site.
