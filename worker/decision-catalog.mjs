/**
 * GET /api/decision-catalog — the public menu a reader-owned decision model
 * may be offered: released books, active sounds, and active type options.
 *
 * No inference happens here and no model credential exists in this Worker.
 * Neon and Upstash credentials stay server-side; only reviewed public columns
 * leave, so disabling a row in Neon still withdraws it from every reader.
 */
import { neon } from '@neondatabase/serverless';
import { Redis } from '@upstash/redis/cloudflare';
import {
  RELEASE_EDITIONS, SOUND_CATALOG_LIMIT, publicCatalog, validCatalog, validSoundCatalog
} from '../src/core/decision/catalog.js';
import { choiceMenu } from '../src/core/decision/recommend.js';

const OPTION_CACHE_KEY = 'rise:jev-options:v2';
const SOUND_CACHE_KEY = 'rise:sounds:v1';
const CACHE_SECONDS = 30;

export class CatalogError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

function reply(status, body, cache = 'no-store') {
  return new Response(JSON.stringify(body), { status, headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': cache,
    'X-Content-Type-Options': 'nosniff'
  } });
}

async function catalogCacheKey() {
  const revisions = Object.values(RELEASE_EDITIONS)
    .map(item => `${item.workId}:${item.sourceRevision}`).sort().join('|');
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(revisions));
  return `rise:books:v1:${Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')}`;
}

async function activeOptions(redis, env) {
  const cached = await redis.get(OPTION_CACHE_KEY);
  if (cached !== null && choiceMenu(cached)) return cached;
  let rows;
  try {
    const sql = neon(env.NEON_DATABASE_URL);
    rows = await sql`SELECT kind, id, description FROM rise_jev_options
      WHERE active = TRUE AND kind IN ('chamberFace', 'fontSize')`;
  } catch (cause) {
    // An unmigrated table is optional; an outage must not reactivate disabled choices.
    if (cause?.code === '42P01') return null;
    throw cause;
  }
  if (!choiceMenu(rows)) throw new CatalogError('OPTIONS_UNAVAILABLE', 'The presentation menu is unavailable.');
  await redis.set(OPTION_CACHE_KEY, rows, { ex: CACHE_SECONDS });
  return rows;
}

/** Admitted public catalog rows, read through the short Redis cache. */
export async function loadDecisionCatalog(env) {
  if (!env?.NEON_DATABASE_URL?.trim() || !env?.UPSTASH_REDIS_REST_URL?.trim()
    || !env?.UPSTASH_REDIS_REST_TOKEN?.trim()) {
    throw new CatalogError('CATALOG_NOT_CONFIGURED', 'The reading catalog is unavailable.');
  }
  let redis;
  let books;
  let sounds;
  try {
    redis = new Redis({
      url: env.UPSTASH_REDIS_REST_URL,
      token: env.UPSTASH_REDIS_REST_TOKEN,
      signal: () => AbortSignal.timeout(2500),
      enableTelemetry: false
    });
    const key = await catalogCacheKey();
    const [bookCache, soundCache] = await Promise.all([redis.get(key), redis.get(SOUND_CACHE_KEY)]);
    books = validCatalog(bookCache);
    if (!books) {
      const sql = neon(env.NEON_DATABASE_URL);
      const rows = await sql`SELECT work_id, title, author, edition_id, source_revision,
        fit_description, decision_criterion, active
        FROM rise_books WHERE active = true ORDER BY work_id LIMIT ${Object.keys(RELEASE_EDITIONS).length + 1}`;
      books = validCatalog(rows);
      if (!books) throw new CatalogError('CATALOG_UNAVAILABLE', 'The reading catalog is unavailable.');
      await redis.set(key, books, { ex: CACHE_SECONDS });
    }
    sounds = validSoundCatalog(soundCache);
    if (!sounds) {
      const sql = neon(env.NEON_DATABASE_URL);
      sounds = validSoundCatalog(await sql`SELECT sound_id, decision_criterion, active
        FROM rise_sounds WHERE active = true ORDER BY sound_id LIMIT ${SOUND_CATALOG_LIMIT}`);
      if (!sounds) throw new CatalogError('CATALOG_UNAVAILABLE', 'The sound catalog is unavailable.');
      await redis.set(SOUND_CACHE_KEY, sounds, { ex: CACHE_SECONDS });
    }
  } catch (cause) {
    if (cause instanceof CatalogError) throw cause;
    throw new CatalogError('CATALOG_UNAVAILABLE', 'The reading or sound catalog is unavailable.');
  }
  try {
    return { books, sounds, options: await activeOptions(redis, env) };
  } catch (cause) {
    if (cause instanceof CatalogError) throw cause;
    throw new CatalogError('OPTIONS_UNAVAILABLE', 'The presentation menu is unavailable.');
  }
}

export async function handleDecisionCatalog(request, env) {
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return new Response(JSON.stringify({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Use GET for this endpoint.' } }),
      { status: 405, headers: { 'Content-Type': 'application/json; charset=utf-8', Allow: 'GET, HEAD', 'Cache-Control': 'no-store' } });
  }
  try {
    const catalog = publicCatalog(await loadDecisionCatalog(env));
    // Short public caching: a withdrawn row leaves every reader within a minute.
    return reply(200, catalog, 'public, max-age=60');
  } catch (cause) {
    return reply(503, { error: { code: cause.code || 'CATALOG_UNAVAILABLE', message: cause.message || 'The reading catalog is unavailable.' } });
  }
}
