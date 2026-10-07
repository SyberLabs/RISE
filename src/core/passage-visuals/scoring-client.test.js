import { describe, expect, it, vi } from 'vitest';
import { compileSession } from '../session-compiler.js';
import { PassageDirector } from './director.js';
import {
  VISUAL_SCORE_CACHE_KEY,
  VisualScoreCache,
  VisualScoreCoordinator,
  scoreCacheKey
} from './scoring-client.js';
import { validateScoreRequest } from './score-protocol.js';
import { flamePreset } from '../../visuals/living-flame/flame-presets.js';

const paragraph = n => Array.from({ length: 200 }, (_, i) => `word${n}x${i % 17}`).join(' ') + '.';

function setup({ paragraphs = 20, fetchImpl, cache, now } = {}) {
  const text = Array.from({ length: paragraphs }, (_, n) => paragraph(n)).join('\n\n');
  const session = compileSession({ title: 'Score', text, wpm: 400, chunkMode: 'sentence', visualConfig: { visualMode: 'off' } });
  const director = new PassageDirector({
    sources: [{ id: 'primary', text: session.sourceTexts.get('primary') }],
    atoms: session.atoms,
    flameRecipe: flamePreset
  });
  const events = [];
  const coordinator = new VisualScoreCoordinator({
    director,
    sources: [{ id: 'primary', text }],
    // The coordinator calls the reader's connection; the test stands in a
    // provider whose replies it releases one at a time.
    score: async (request, signal) => {
      const response = await fetchImpl('reader-connection', { body: JSON.stringify(request), signal });
      if (!response.ok) throw Object.assign(new Error('refused'), { code: `HTTP_${response.status}` });
      return response.json();
    },
    canScore: () => true,
    cache: cache || new VisualScoreCache(),
    now: now || (() => 0),
    onEvent: event => events.push(event)
  });
  return { session, director, coordinator, events, text, fetchImpl };
}

/** A fetch whose replies the test releases one at a time. */
function controlledFetch({ status = 200, reply = null } = {}) {
  const calls = [];
  const fetchImpl = vi.fn((url, init) => new Promise((resolve, reject) => {
    const request = JSON.parse(init.body);
    const call = { url, init, request, resolve, reject };
    init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')));
    call.answer = (override = {}) => resolve(new Response(JSON.stringify(reply ? reply(request) : {
      schemaVersion: 1,
      sourceDigest: request.sourceDigest,
      sectionDigest: request.sectionDigest,
      treatmentCatalogVersion: request.treatmentCatalogVersion,
      model: 'typesafe/jev-1.13',
      choices: request.blocks.map(block => ({ blockId: block.id, treatmentId: 'solar-bloom', intensityBand: 'intense' })),
      ...override
    }), { status, headers: { 'Content-Type': 'application/json' } }));
    calls.push(call);
  }));
  return { fetchImpl, calls };
}

const flush = () => new Promise(resolve => setTimeout(resolve, 0));
async function settle() { for (let i = 0; i < 8; i += 1) await flush(); }

/**
 * Waits until the provider has received at least `count` requests. Between
 * observe() and the request the coordinator awaits two SHA-256 digests on the
 * platform's crypto thread pool, so under load that takes more timer ticks
 * than settle() counts; this waits on the event itself.
 */
function received(fetchImpl, count) {
  return vi.waitFor(() => {
    const seen = fetchImpl.mock.calls.length;
    if (seen < count) throw new Error(`expected ${count} request(s) by now, saw ${seen}`);
  }, { timeout: 5000, interval: 5 });
}

async function ready(context, { permit = true, playing = true } = {}) {
  await context.coordinator.prepare();
  if (permit) context.coordinator.setPermission(context.coordinator.sourceDigests);
  context.coordinator.setActivity({ playing, visible: true, inChamber: true, mode: 'follow' });
  context.coordinator.observe(0);
  await settle();
  // Without permission for this source, the coordinator never asks.
  if (permit) await received(context.fetchImpl, 1);
}

describe('VisualScoreCoordinator', () => {
  it('asks for the current section first, then only the next, one at a time', async () => {
    const { fetchImpl, calls } = controlledFetch();
    const context = setup({ fetchImpl });
    await ready(context);
    const sections = context.coordinator.sections;
    expect(sections.length).toBeGreaterThanOrEqual(3);
    expect(calls).toHaveLength(1);
    expect(validateScoreRequest(calls[0].request).ok).toBe(true);
    expect(calls[0].request.blocks.map(block => block.id))
      .toEqual(context.director.blocks.slice(sections[0].startBlock, sections[0].endBlock).map(block => block.id));
    expect(calls[0].request).not.toHaveProperty('previousTreatmentId');
    calls[0].answer();
    await settle();
    await received(fetchImpl, 2);
    expect(calls).toHaveLength(2);
    expect(calls[1].request.blocks[0].id).toBe(context.director.blocks[sections[1].startBlock].id);
    expect(calls[1].request.previousTreatmentId).toBe('solar-bloom');
    calls[1].answer();
    await settle();
    // The third section waits until the reader reaches the second.
    expect(calls).toHaveLength(2);
    context.coordinator.observe(sections[1].startBlock);
    await settle();
    await received(fetchImpl, 3);
    expect(calls).toHaveLength(3);
  });

  it('adopts a late response only for blocks the reader has not entered', async () => {
    const { fetchImpl, calls } = controlledFetch();
    const context = setup({ fetchImpl });
    await ready(context);
    const entered = context.director.admit(0);
    calls[0].answer();
    await settle();
    expect(context.director.blocks[0].admitted).toBe(entered);
    expect(context.director.pendingChoice(1)).toMatchObject({ treatmentId: 'solar-bloom', provenance: 'jev' });
  });

  it.each([
    ['paused', { playing: false }],
    ['hidden', { visible: false }],
    ['outside the Chamber', { inChamber: false }],
    ['in Hold', { mode: 'hold' }],
    ['Off', { mode: 'off' }]
  ])('starts no request while %s', async (_label, activity) => {
    const { fetchImpl, calls } = controlledFetch();
    const context = setup({ fetchImpl });
    await context.coordinator.prepare();
    context.coordinator.setPermission(context.coordinator.sourceDigests);
    context.coordinator.setActivity({ playing: true, visible: true, inChamber: true, mode: 'follow', ...activity });
    context.coordinator.observe(0);
    await settle();
    expect(calls).toHaveLength(0);
  });

  it('never transmits text without permission for that exact source', async () => {
    const { fetchImpl, calls } = controlledFetch();
    const context = setup({ fetchImpl });
    await context.coordinator.prepare();
    context.coordinator.setPermission(['0'.repeat(64)]);
    context.coordinator.setActivity({ playing: true });
    context.coordinator.observe(0);
    await settle();
    expect(calls).toHaveLength(0);
  });

  it('keeps a valid reply that lands while paused, without asking for more', async () => {
    const { fetchImpl, calls } = controlledFetch();
    const context = setup({ fetchImpl });
    await ready(context);
    context.coordinator.setActivity({ playing: false });
    calls[0].answer();
    await settle();
    expect(context.events.some(event => event.kind === 'scored')).toBe(true);
    expect(context.director.pendingChoice(0).provenance).toBe('jev');
    expect(calls).toHaveLength(1);
  });

  it('refuses a reply for another source and does not retry the section', async () => {
    const { fetchImpl, calls } = controlledFetch();
    const context = setup({ fetchImpl });
    await ready(context);
    calls[0].answer({ sourceDigest: 'e'.repeat(64) });
    await settle();
    expect(context.events.find(event => event.kind === 'failed').code).toMatch(/INVALID/);
    expect(context.director.pendingChoice(0).provenance).toBe('local');
    // The next section is attempted; the failed one is never asked again.
    await received(fetchImpl, 2);
    expect(calls).toHaveLength(2);
    calls[1].answer();
    await settle();
    context.coordinator.observe(1);
    await settle();
    expect(calls.filter(call => call.request.blocks[0].id === context.director.blocks[0].id)).toHaveLength(1);
  });

  it.each([429, 500, 503])('keeps local direction after HTTP %s', async (status) => {
    const { fetchImpl, calls } = controlledFetch({ status });
    const context = setup({ fetchImpl });
    await ready(context);
    calls[0].answer();
    await settle();
    expect(context.events.find(event => event.kind === 'failed').code).toBe(`HTTP_${status}`);
    expect(context.director.pendingChoice(0).provenance).toBe('local');
  });

  it('keeps local direction offline', async () => {
    const context = setup({ fetchImpl: vi.fn(async () => { throw new TypeError('offline'); }) });
    await ready(context);
    expect(context.events.find(event => event.kind === 'failed').code).toBe('NETWORK');
  });

  it('cancels an obsolete request on a large seek and asks for the destination', async () => {
    const { fetchImpl, calls } = controlledFetch();
    const context = setup({ fetchImpl });
    await ready(context);
    const last = context.coordinator.sections.at(-1);
    context.coordinator.observe(last.startBlock);
    await settle();
    expect(context.events.some(event => event.kind === 'aborted' && event.reason === 'seek')).toBe(true);
    await received(fetchImpl, 2);
    expect(calls).toHaveLength(2);
    expect(calls[1].request.blocks[0].id).toBe(context.director.blocks[last.startBlock].id);
    // The cancelled section's late answer cannot be adopted.
    calls[0].answer();
    await settle();
    expect(context.director.pendingChoice(0).provenance).toBe('local');
  });

  it('revocation aborts in-flight work and prevents any further transmission', async () => {
    const { fetchImpl, calls } = controlledFetch();
    const context = setup({ fetchImpl });
    await ready(context);
    context.coordinator.revoke();
    await settle();
    expect(context.events.some(event => event.kind === 'aborted' && event.reason === 'revoked')).toBe(true);
    context.coordinator.observe(9);
    context.coordinator.setActivity({ playing: true });
    await settle();
    expect(calls).toHaveLength(1);
  });

  it('holds the client to six requests a minute', async () => {
    let time = 0;
    const timers = [];
    const fetchImpl = vi.fn(async () => new Response('{}', { status: 500 }));
    const context = setup({ fetchImpl, paragraphs: 120, now: () => time });
    context.coordinator.setTimer = (fn, ms) => { timers.push({ fn, ms }); return timers.length; };
    context.coordinator.clearTimer = () => {};
    await ready(context);
    for (let block = 8; block < 120; block += 8) {
      context.coordinator.observe(block);
      await settle();
    }
    expect(fetchImpl).toHaveBeenCalledTimes(6);
    expect(timers.some(timer => timer.ms > 1000)).toBe(true);
  });

  it('reuses cached sections across readings without a request', async () => {
    const cache = new VisualScoreCache();
    const first = controlledFetch();
    const one = setup({ fetchImpl: first.fetchImpl, cache });
    await ready(one);
    first.calls[0].answer();
    await settle();
    const second = controlledFetch();
    const two = setup({ fetchImpl: second.fetchImpl, cache });
    await ready(two, { permit: false });
    expect(second.calls).toHaveLength(0);
    expect(two.director.pendingChoice(0)).toMatchObject({ treatmentId: 'solar-bloom', provenance: 'jev' });
  });
});

describe('VisualScoreCache', () => {
  it('keys by source, section, segmentation, catalog, prompt, and model', () => {
    expect(scoreCacheKey('a'.repeat(64), 'b'.repeat(64))).toBe(
      `${'a'.repeat(64)}:${'b'.repeat(64)}:s1:c1:p1:typesafe/jev-1.13`);
  });

  it('evicts the least recently used beyond 100 sections', () => {
    const cache = new VisualScoreCache({ limit: 100 });
    for (let i = 0; i < 101; i += 1) cache.set(`k${i}`, { choices: [] });
    expect(cache.get('k0')).toBeNull();
    expect(cache.get('k1')).not.toBeNull();
    cache.set('k101', { choices: [] });
    expect(cache.get('k1')).not.toBeNull();
    expect(cache.get('k2')).toBeNull();
  });

  it('persists to storage and survives storage failure in memory', () => {
    const store = new Map();
    const storage = { getItem: key => store.get(key) ?? null, setItem: (key, value) => store.set(key, value) };
    new VisualScoreCache({ storage }).set('k', { choices: [{ blockId: 'b' }] });
    expect(JSON.parse(store.get(VISUAL_SCORE_CACHE_KEY)).entries[0][0]).toBe('k');
    expect(new VisualScoreCache({ storage }).get('k').choices).toHaveLength(1);
    const broken = { getItem: () => { throw new Error('blocked'); }, setItem: () => { throw new Error('full'); } };
    const cache = new VisualScoreCache({ storage: broken });
    cache.set('x', { choices: [] });
    expect(cache.get('x')).not.toBeNull();
  });
});
