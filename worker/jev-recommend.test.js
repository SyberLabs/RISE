import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import releaseInventory from '../src/content/archive/release-inventory.json';
import { JEV_PALETTES } from '../src/core/jev-palette.js';

const mocks = vi.hoisted(() => ({
  query: vi.fn(),
  neon: vi.fn(),
  get: vi.fn(),
  set: vi.fn(),
  incr: vi.fn(),
  expire: vi.fn(),
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
    incr(key) { return mocks.incr(key); }
    expire(key, seconds) { return mocks.expire(key, seconds); }
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

const chosenConfig = Object.freeze({
  section: 'first', wpm: 200, curve: 'flat', chunkMode: 'word',
  audio: 'silent', visualMode: 'off', visualStyle: 'quiet',
  visualEngine: 'klee', visualPalette: 'white',
  kleePreset: 'harmonic', galleryCadence: 'balanced', chamberFace: 'literary',
  fontSize: 'medium', colorTheme: 'classic', colors: JEV_PALETTES.classic, wordFill: 'plain',
  projection: 'stream', revealMode: 'instant',
  audioPreset: 'silent', soundscape: 'none',
  entrainmentMode: 'binaural', entrainmentWaveform: 'sine',
  recitation: { enabled: false }, voiceId: null,
  visualConfig: { visualMode: 'off' },
  presentation: {
    chamberFace: 'literary', fontSize: 'medium',
    colorTheme: 'classic', colors: JEV_PALETTES.classic
  }
});

function answers(workId, overrides = {}) {
  return {
    book: { type: 'choice', choice: workId },
    section: { type: 'choice', choice: 'first' },
    pace: { type: 'choice', choice: '200' },
    curve: { type: 'choice', choice: 'flat' },
    chunk: { type: 'choice', choice: 'word' },
    audio: { type: 'choice', choice: 'silent' },
    visual: { type: 'choice', choice: 'off' },
    visualStyle: { type: 'choice', choice: 'quiet' },
    visualEngine: { type: 'choice', choice: 'klee' },
    visualPalette: { type: 'choice', choice: 'white' },
    kleePreset: { type: 'choice', choice: 'harmonic' },
    galleryCadence: { type: 'choice', choice: 'balanced' },
    chamberFace: { type: 'choice', choice: 'literary' },
    fontSize: { type: 'choice', choice: 'medium' },
    colorTheme: { type: 'choice', choice: 'classic' },
    wordFill: { type: 'choice', choice: 'plain' },
    projection: { type: 'choice', choice: 'stream' },
    reveal: { type: 'choice', choice: 'instant' },
    ...overrides
  };
}

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
  mocks.incr.mockResolvedValue(1);
  mocks.expire.mockResolvedValue(1);
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
      answers: answers('middlemarch')
    }));
    vi.stubGlobal('fetch', provider);

    const response = await handleJevRecommend(request(), env);
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      requestId: 'gen-dec-live-1', model: 'typesafe/jev-1.13-20260917',
      workId: 'middlemarch', editionId: books[0].edition_id,
      sourceRevision: books[0].source_revision,
      reason: books[0].fit_description, config: chosenConfig,
      cacheStatus: 'miss', decisionCacheStatus: 'miss'
    });
    expect(mocks.neon).toHaveBeenCalledWith(env.NEON_DATABASE_URL);
    expect(mocks.set).toHaveBeenCalledWith(expect.stringMatching(/^rise:books:v1:[0-9a-f]{64}$/u), books, { ex: 30 });
    expect(mocks.set.mock.calls[0][0]).not.toContain('thoughtful novel');
    const body = JSON.parse(provider.mock.calls[0][1].body);
    expect(body.model).toBe('typesafe/jev-1.13');
    expect(Object.keys(body.questions.book.criteria)).toHaveLength(15);
    expect(Object.keys(body.questions.book.criteria)).toContain('middlemarch');
    expect(Object.keys(body.questions.book.criteria)).toContain('literary-walden');
    expect(body.state).toEqual({
      reader_intent: 'I want a thoughtful novel.',
      experience_hint: expect.stringContaining('Explicit reader preferences always take priority')
    });
    expect(Object.keys(body.questions)).toEqual([
      'book', 'section', 'pace', 'curve', 'chunk', 'audio', 'visual', 'visualStyle',
      'visualEngine', 'visualPalette', 'kleePreset', 'galleryCadence',
      'chamberFace', 'fontSize', 'colorTheme', 'wordFill', 'projection', 'reveal'
    ]);
    expect(body.questions.visual.criteria.interlocution).toContain('psychedelic');
    expect(body.questions.visualEngine.criteria.fractal).toContain('psychedelic');
    expect(Object.keys(body.questions.audio.criteria)).toEqual(['silent', 'aurora', 'faded-signal']);
    expect(body.questions.section.criteria).toHaveProperty('shortest');
    expect(provider.mock.calls[0][1].headers.Authorization).toBe('Bearer openrouter-server-secret');
  });

  it('uses public catalog metadata from Redis but still calls Jev for the reader intent', async () => {
    mocks.get.mockResolvedValue(books);
    const provider = vi.fn(async () => Response.json({
      id: 'gen-dec-live-2', model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: answers('literary-walden')
    }));
    vi.stubGlobal('fetch', provider);

    const response = await handleJevRecommend(request({ intent: 'Nature and quiet.' }), env);
    expect(response.status).toBe(200);
    expect((await response.json()).cacheStatus).toBe('hit');
    expect(mocks.query).not.toHaveBeenCalled();
    expect(provider).toHaveBeenCalledOnce();
  });

  it('returns the selected configuration from one Jev decision', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      id: 'one-decision', model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: answers('literary-walden', {
        section: { type: 'choice', choice: 'shortest' },
        pace: { type: 'choice', choice: '150' },
        curve: { type: 'choice', choice: 'wave' },
        chunk: { type: 'choice', choice: 'phrase' },
        audio: { type: 'choice', choice: 'aurora' },
        visual: { type: 'choice', choice: 'interlocution' },
        visualStyle: { type: 'choice', choice: 'psychedelic' },
        visualEngine: { type: 'choice', choice: 'fractal' },
        visualPalette: { type: 'choice', choice: 'purple' },
        kleePreset: { type: 'choice', choice: 'chaotic' },
        galleryCadence: { type: 'choice', choice: 'lively' },
        chamberFace: { type: 'choice', choice: 'thick' },
        fontSize: { type: 'choice', choice: 'fit' },
        colorTheme: { type: 'choice', choice: 'prism' },
        wordFill: { type: 'choice', choice: 'accent' },
        projection: { type: 'choice', choice: 'page' },
        reveal: { type: 'choice', choice: 'progressive' }
      })
    })));
    const response = await handleJevRecommend(request({ intent: 'A brief, gentle nature reading.' }), env);
    expect(response.status).toBe(200);
    expect((await response.json()).config).toEqual({
      section: 'shortest', wpm: 150, curve: 'wave', chunkMode: 'phrase',
      audio: 'aurora', visualMode: 'interlocution', visualEngine: 'fractal',
      visualStyle: 'psychedelic', visualPalette: 'purple', kleePreset: 'chaotic',
      galleryCadence: 'lively', chamberFace: 'thick', fontSize: 'large',
      colorTheme: 'prism', colors: JEV_PALETTES.prism,
      wordFill: 'accent', projection: 'stream', revealMode: 'progressive',
      audioPreset: 'silent', soundscape: 'aurora',
      entrainmentMode: 'binaural', entrainmentWaveform: 'sine',
      recitation: { enabled: false }, voiceId: null,
      visualConfig: {
        visualMode: 'interlocution', livingText: { enabled: true },
        interlocution: {
          sourceFamily: 'procedural', procedural: ['fractal'], sourced: [],
          presentation: 'continuous', galleryCadence: 0.85,
          kleePreset: 'chaotic', wordFill: { mode: 'accent' }
        }
      },
      presentation: {
        chamberFace: 'thick', fontSize: 'large',
        colorTheme: 'prism', colors: JEV_PALETTES.prism
      }
    });
    expect(fetch).toHaveBeenCalledOnce();
  });

  it('makes a psychedelic choice visibly colorful even when other answers conflict', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: answers('middlemarch', {
        visualStyle: { type: 'choice', choice: 'psychedelic' },
        visual: { type: 'choice', choice: 'off' },
        visualEngine: { type: 'choice', choice: 'turrell' },
        galleryCadence: { type: 'choice', choice: 'slow' },
        colorTheme: { type: 'choice', choice: 'classic' },
        projection: { type: 'choice', choice: 'page' }
      })
    })));
    const response = await handleJevRecommend(request({ intent: 'A psychedelic reading.' }), env);
    expect(response.status).toBe(200);
    expect((await response.json()).config).toMatchObject({
      visualStyle: 'psychedelic', visualMode: 'interlocution',
      visualEngine: 'fractal', galleryCadence: 'lively',
      projection: 'stream', colorTheme: 'prism', colors: JEV_PALETTES.prism,
      visualConfig: { visualMode: 'interlocution', interlocution: {
        presentation: 'continuous', procedural: ['fractal'], galleryCadence: 0.85
      } },
      presentation: { colorTheme: 'prism', colors: JEV_PALETTES.prism }
    });
  });

  it('returns a visible large size when Jev chooses Fit for phrase chunks', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: answers('middlemarch', {
        chunk: { type: 'choice', choice: 'phrase' },
        fontSize: { type: 'choice', choice: 'fit' }
      })
    })));
    const response = await handleJevRecommend(request({ intent: 'A large phrase reading.' }), env);
    expect(response.status).toBe(200);
    const { config } = await response.json();
    expect(config.chunkMode).toBe('phrase');
    expect(config.fontSize).toBe('large');
    expect(config.presentation.fontSize).toBe('large');
  });

  it('reuses a validated Jev decision for the same intent within the Redis TTL', async () => {
    const cache = new Map();
    mocks.get.mockImplementation(async key => cache.get(key) ?? (key.startsWith('rise:books:') ? books : null));
    mocks.set.mockImplementation(async (key, value) => { cache.set(key, value); return 'OK'; });
    const provider = vi.fn(async () => Response.json({
      id: 'gen-dec-cached', model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: answers('literary-walden')
    }));
    vi.stubGlobal('fetch', provider);

    const first = await handleJevRecommend(request({ intent: 'Nature and quiet.' }), env);
    const second = await handleJevRecommend(request({ intent: 'Nature and quiet.' }), env);

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    expect((await first.json()).decisionCacheStatus).toBe('miss');
    expect(await second.json()).toMatchObject({
      requestId: 'gen-dec-cached', workId: 'literary-walden', decisionCacheStatus: 'hit'
    });
    expect(provider).toHaveBeenCalledTimes(1);
    const decisionKey = [...cache.keys()].find(key => key.startsWith('rise:jev-decision:'));
    expect(decisionKey).toMatch(/^rise:jev-decision:v6:[0-9a-f]{64}:0$/u);
    expect(decisionKey).not.toContain('Nature and quiet.');
    expect(mocks.set).toHaveBeenCalledWith(decisionKey, expect.objectContaining({
      workId: 'literary-walden'
    }), { ex: 300 });
  });

  it('rotates distinct released books for an open discovery request in one Jev call per new variant', async () => {
    const cache = new Map();
    mocks.get.mockImplementation(async key => key.startsWith('rise:books:') ? books : cache.get(key));
    mocks.set.mockImplementation(async (key, value) => { cache.set(key, value); return 'OK'; });
    mocks.incr.mockResolvedValueOnce(1).mockResolvedValueOnce(2)
      .mockResolvedValueOnce(3).mockResolvedValueOnce(4).mockResolvedValueOnce(5);
    const provider = vi.fn(async (_url, options) => {
      const criteria = JSON.parse(options.body).questions.book.criteria;
      return Response.json({
        id: `gen-dec-${provider.mock.calls.length}`,
        model: 'typesafe/jev-1.13', provider: 'TypeSafe',
        answers: answers(Object.keys(criteria)[0])
      });
    });
    vi.stubGlobal('fetch', provider);

    const responses = [];
    for (let index = 0; index < 5; index++) {
      const response = await handleJevRecommend(request({ intent: 'Surprise me.' }), env);
      expect(response.status).toBe(200);
      responses.push(await response.json());
    }

    for (let index = 1; index < responses.length; index++) {
      expect(responses[index].workId).not.toBe(responses[index - 1].workId);
    }
    expect(provider).toHaveBeenCalledTimes(4);
    expect(responses[4].decisionCacheStatus).toBe('hit');
    expect(responses[4].workId).toBe(responses[0].workId);
    const first = Object.keys(JSON.parse(provider.mock.calls[0][1].body).questions.book.criteria);
    const second = Object.keys(JSON.parse(provider.mock.calls[1][1].body).questions.book.criteria);
    expect(first.filter(id => second.includes(id))).toEqual([]);
  });

  it('asks Jev again when the intent or admitted catalog changes', async () => {
    const cache = new Map();
    let catalog = books;
    mocks.get.mockImplementation(async key => key.startsWith('rise:books:') ? catalog : cache.get(key));
    mocks.set.mockImplementation(async (key, value) => { cache.set(key, value); return 'OK'; });
    const provider = vi.fn(async () => Response.json({
      id: `gen-dec-${provider.mock.calls.length}`, model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: answers('literary-walden')
    }));
    vi.stubGlobal('fetch', provider);

    await handleJevRecommend(request({ intent: 'Nature and quiet.' }), env);
    await handleJevRecommend(request({ intent: 'An intricate novel.' }), env);
    catalog = books.map(row => row.work_id === 'middlemarch'
      ? { ...row, decision_criterion: 'Choose this for a rich and intricate novel.' } : row);
    const changed = await handleJevRecommend(request({ intent: 'Nature and quiet.' }), env);

    expect(changed.status).toBe(200);
    expect((await changed.json()).decisionCacheStatus).toBe('miss');
    expect(provider).toHaveBeenCalledTimes(3);
  });

  it('does not serve a cached result with an invalid model', async () => {
    mocks.get.mockImplementation(async key => key.startsWith('rise:books:') ? books : {
      requestId: 'forged', model: 'other/model', workId: 'literary-walden',
      editionId: book('literary-walden').edition_id,
      sourceRevision: book('literary-walden').source_revision,
      reason: book('literary-walden').fit_description
    });
    const provider = vi.fn(async () => Response.json({
      id: 'gen-dec-fresh', model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: answers('literary-walden')
    }));
    vi.stubGlobal('fetch', provider);

    const response = await handleJevRecommend(request(), env);

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ requestId: 'gen-dec-fresh', decisionCacheStatus: 'miss' });
    expect(provider).toHaveBeenCalledOnce();
  });

  it('continues recommending only active books when a catalog row is withdrawn', async () => {
    mocks.query.mockResolvedValue(books.filter(row => row.work_id !== 'middlemarch'));
    const provider = vi.fn(async () => Response.json({
      model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: answers('literary-walden')
    }));
    vi.stubGlobal('fetch', provider);

    const response = await handleJevRecommend(request(), env);
    expect(response.status).toBe(200);
    const criteria = JSON.parse(provider.mock.calls[0][1].body).questions.book.criteria;
    expect(Object.keys(criteria)).toHaveLength(14);
    expect(criteria).not.toHaveProperty('middlemarch');
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
      answers: answers('unreviewed-book')
    })));
    const response = await handleJevRecommend(request(), env);
    expect(response.status).toBe(502);
    expect((await response.json()).error.code).toBe('DECISION_INVALID_RESPONSE');
  });

  it.each([
    ['missing setting', { pace: undefined }],
    ['unavailable sound', { audio: { type: 'choice', choice: 'invented' } }],
    ['pure focus tone', { audio: { type: 'choice', choice: 'focus' } }],
    ['pure deep tone', { audio: { type: 'choice', choice: 'deep' } }],
    ['pure gateway tone', { audio: { type: 'choice', choice: 'gateway' } }],
    ['invalid answer type', { visual: { type: 'text', value: 'focals' } }],
    ['unavailable section', { section: { type: 'choice', choice: 'chapter-999' } }]
  ])('rejects %s rather than launching a partial configuration', async (_label, overrides) => {
    vi.stubGlobal('fetch', vi.fn(async () => Response.json({
      model: 'typesafe/jev-1.13', provider: 'TypeSafe',
      answers: answers('middlemarch', overrides)
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
