import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import releaseInventory from '../src/content/archive/release-inventory.json';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  neon: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  redis: vi.fn()
}));

vi.mock('@neondatabase/serverless', () => ({
  neon: (url) => {
    mocks.neon(url);
    return mocks.query;
  }
}));
vi.mock('@upstash/redis/cloudflare', () => ({
  Redis: class {
    constructor(options) { mocks.redis(options); }
    get(key) { return mocks.get(key); }
    set(key, value, options) { return mocks.set(key, value, options); }
  }
}));

import { handleJevRecommend } from './jev-recommend.mjs';
import worker from './index.mjs';

const SITE = 'https://rise.example';
const env = {
  OPENROUTER_API_KEY: 'openrouter-server-secret',
  NEON_DATABASE_URL: 'postgresql://private.example/rise',
  UPSTASH_REDIS_REST_URL: 'https://redis.example',
  UPSTASH_REDIS_REST_TOKEN: 'redis-server-secret'
};

function book(workId, extras = {}) {
  const edition = releaseInventory[workId];
  return {
    work_id: workId,
    title: workId === 'middlemarch' ? 'Middlemarch' : 'Walden',
    author: workId === 'middlemarch' ? 'George Eliot' : 'Henry David Thoreau',
    edition_id: edition.editionId,
    source_revision: edition.sourceRevision,
    fit_description: 'A thoughtful classic for reflective reading.',
    decision_criterion: 'Choose this for a reflective reading mood.',
    active: true,
    ...extras
  };
}

const books = Object.keys(releaseInventory).map(workId => book(workId));

function request(body = { intent: 'I want a thoughtful novel.' }, headers = {}) {
  return new Request(`${SITE}/api/jev-recommend`, {
    method: 'POST',
    headers: { Origin: SITE, 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body)
  });
}

beforeEach(() => {
  mocks.query.mockResolvedValue(books);
  mocks.get.mockResolvedValue(null);
  mocks.set.mockResolvedValue('OK');
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

describe('Jev reading recommendation', () => {
  it('uses the production Worker rate limit before reading PostgreSQL, Redis, or Jev', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const response = await worker.fetch(request(undefined, { 'CF-Connecting-IP': '192.0.2.1' }), {
      ...env, DECISION_LIMITER: { limit: vi.fn(async () => ({ success: false })) }
    });
    expect(response.status).toBe(429);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(mocks.query).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it('loads PostgreSQL on a Redis catalog miss and sends only admitted books to Jev', async () => {
    const provider = vi.fn(async () => Response.json({
      id: 'gen-dec-live-1', model: 'typesafe/jev-1.13-20260917', provider: 'TypeSafe',
      answers: { book: { type: 'choice', choice: 'middlemarch' } }
    }));
    vi.stubGlobal('fetch', provider);

    const response = await handleJevRecommend(request(), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requestId: 'gen-dec-live-1', model: 'typesafe/jev-1.13-20260917',
      workId: 'middlemarch', editionId: books[0].edition_id,
      sourceRevision: books[0].source_revision,
      reason: books[0].fit_description, cacheStatus: 'miss'
    });
    expect(mocks.neon).toHaveBeenCalledWith(env.NEON_DATABASE_URL);
    expect(mocks.set).toHaveBeenCalledWith(expect.stringMatching(/^rise:books:v1:[0-9a-f]{64}$/u), books, { ex: 300 });
    expect(mocks.set.mock.calls[0][0]).not.toContain('thoughtful novel');
    const body = JSON.parse(provider.mock.calls[0][1].body);
    expect(body.model).toBe('typesafe/jev-1.13');
    expect(Object.keys(body.questions.book.criteria)).toHaveLength(15);
    expect(Object.keys(body.questions.book.criteria)).toContain('middlemarch');
    expect(Object.keys(body.questions.book.criteria)).toContain('literary-walden');
    expect(body.state).toEqual({ reader_intent: 'I want a thoughtful novel.' });
    expect(provider.mock.calls[0][1].headers.Authorization).toBe('Bearer openrouter-server-secret');
  });

  it('uses public catalog metadata from Redis but still calls Jev for the reader intent', async () => {
    mocks.get.mockResolvedValue(books);
    const provider = vi.fn(async () => Response.json({
      id: 'gen-dec-live-2', model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: { book: { type: 'choice', choice: 'literary-walden' } }
    }));
    vi.stubGlobal('fetch', provider);

    const response = await handleJevRecommend(request({ intent: 'Nature and quiet.' }), env);
    expect(response.status).toBe(200);
    expect((await response.json()).cacheStatus).toBe('hit');
    expect(mocks.query).not.toHaveBeenCalled();
    expect(provider).toHaveBeenCalledOnce();
  });

  it('rejects a database row whose edition does not match the shipped Standard Ebooks inventory', async () => {
    mocks.query.mockResolvedValue(books.map(row => row.work_id === 'literary-walden'
      ? { ...row, edition_id: 'other-provider:walden' } : row));
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);

    const response = await handleJevRecommend(request(), env);
    expect(response.status).toBe(503);
    expect((await response.json()).error.code).toBe('CATALOG_UNAVAILABLE');
    expect(provider).not.toHaveBeenCalled();
  });

  it('rejects a Jev choice outside the validated catalog', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: { book: { type: 'choice', choice: 'unreviewed-book' } }
    })));
    const response = await handleJevRecommend(request(), env);
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe('DECISION_INVALID_RESPONSE');
  });

  it('rejects cross-origin and malformed requests before touching secrets or services', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    const responses = await Promise.all([
      handleJevRecommend(request({ intent: 'read' }, { Origin: 'https://other.example' }), env),
      handleJevRecommend(request({ intent: 'ab' }), env),
      handleJevRecommend(request({ intent: 'read', extra: 'ignored' }), env)
    ]);
    expect(responses.map(item => item.status)).toEqual([403, 400, 400]);
    expect(mocks.get).not.toHaveBeenCalled();
    expect(provider).not.toHaveBeenCalled();
  });

  it('fails closed when Redis or required production secrets are unavailable', async () => {
    const provider = vi.fn();
    vi.stubGlobal('fetch', provider);
    mocks.get.mockRejectedValue(new Error('Redis unavailable'));
    const cacheFailure = await handleJevRecommend(request(), env);
    const missingSecret = await handleJevRecommend(request(), { ...env, NEON_DATABASE_URL: '' });
    expect([cacheFailure.status, missingSecret.status]).toEqual([503, 503]);
    expect(provider).not.toHaveBeenCalled();
  });
});
