/**
 * RISE Changes files (src/app/changes.js): `/content/changes/<file>` is the file of that name on the
 * repository's `changes-data` branch, which the weekly digest workflow writes and nothing deploys, and
 * `/content/changes/<slug>/<file>` is the same file on a listed team's own branch (src/core/changes/listed.js).
 * No other repository is ever fetched: the slug names it, and an unlisted slug is a 404.
 *
 * Only the index and dated digests are asked for, by GET or HEAD with no query; everything else, and
 * anything upstream does not answer with a 200 (a redirect included), is a JSON 404, never cached. A
 * file is refused above 256 KB. The files are model- and PR-written, so they go out as JSON the browser
 * may not sniff, and the app admits each before showing it.
 *
 * Cached at the edge by fetch's `cf` options: Cloudflare does not cache JSON by default, so
 * `cacheEverything` is set, and `cacheTtlByStatus` keeps a success for its TTL and no other status
 * (developers.cloudflare.com/workers/runtime-apis/request/, /workers/examples/cache-using-fetch/).
 */

import { listedTeam } from '../src/core/changes/listed.js';

export const CHANGES_UPSTREAM = 'https://raw.githubusercontent.com/SyberLabs/RISE/changes-data/';
export const CHANGES_PREFIX = '/content/changes/';
export const CHANGES_MAX_BYTES = 256 * 1024;

const RAW = 'https://raw.githubusercontent.com/';
const FILE = /^(?:index|\d{4}-\d{2}-\d{2}(?:-[a-z0-9]{1,8})?)\.json$/u;
// The index changes each week; a digest is written once, and a rerun the same day may replace it.
const INDEX_TTL = 300;
const DIGEST_TTL = 86_400;

const NO_STORE = {
  'Content-Type': 'application/json; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff'
};

function notFound(message = 'No such changes file.') {
  return new Response(JSON.stringify({ error: { code: 'NOT_FOUND', message } }), { status: 404, headers: NO_STORE });
}

/** The body, or null once it passes the cap. */
async function bounded(response) {
  const declared = Number(response.headers.get('Content-Length'));
  if (declared > CHANGES_MAX_BYTES) return null;
  if (!response.body) return new Uint8Array(0);
  const reader = response.body.getReader();
  const parts = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > CHANGES_MAX_BYTES) {
      await reader.cancel();
      return null;
    }
    parts.push(value);
  }
  const body = new Uint8Array(size);
  let at = 0;
  for (const part of parts) {
    body.set(part, at);
    at += part.byteLength;
  }
  return body;
}

/** The branch's address for a path under the prefix: RISE's own, or a listed team's; null for anything else. */
function upstreamFor(rest, teams) {
  const [first, name, more] = rest.split('/');
  if (name === undefined) return { base: CHANGES_UPSTREAM, name: first };
  const team = more === undefined ? listedTeam(first, teams) : null;
  return team ? { base: `${RAW}${team.repo}/changes-data/`, name } : null;
}

export async function serveChangesFile(request, teams) {
  const url = new URL(request.url);
  const found = upstreamFor(url.pathname.slice(CHANGES_PREFIX.length), teams);
  if ((request.method !== 'GET' && request.method !== 'HEAD') || url.search !== '' || !found || !FILE.test(found.name)) return notFound();
  const { base, name } = found;
  const ttl = name === 'index.json' ? INDEX_TTL : DIGEST_TTL;
  let body;
  try {
    const upstream = await fetch(`${base}${name}`, {
      method: 'GET',
      redirect: 'manual',
      cf: { cacheEverything: true, cacheTtlByStatus: { '200-299': ttl, '300-599': -1 } }
    });
    if (upstream.status !== 200) return notFound();
    body = await bounded(upstream);
  } catch {
    return notFound('The changes file could not be fetched.');
  }
  if (body === null) return notFound('The changes file is over 256 KB.');
  return new Response(request.method === 'HEAD' ? null : body, {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': `public, max-age=${ttl}`,
      'X-Content-Type-Options': 'nosniff'
    }
  });
}
