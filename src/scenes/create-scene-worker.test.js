/**
 * How the scene worker is started on each kind of page. The refusal runs first: the
 * fetched text is cached for the page, and a refusal clears it. The card's blob worker
 * must be a classic worker: in an opaque origin a module worker from a blob
 * never loads (its script is fetched in CORS mode, which blob:null cannot pass).
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./scene-worker.js?worker&url', () => ({ default: 'https://rise.example/assets/scene-worker-abc.js' }));

const { createSceneWorker } = await import('./create-scene-worker.js');

afterEach(() => vi.restoreAllMocks());

describe('createSceneWorker', () => {
  it('on RISE’s own page starts RISE’s module worker from its own URL', async () => {
    const makeWorker = vi.fn((url, options) => ({ url, options }));
    const made = await createSceneWorker({ inHostCard: false, makeWorker });
    expect(made).toEqual({ url: 'https://rise.example/assets/scene-worker-abc.js', options: { type: 'module' } });
  });

  it('in a host’s card refuses when the built worker cannot be fetched', async () => {
    const load = vi.fn(async () => ({ ok: false, status: 404, text: async () => '' }));
    await expect(createSceneWorker({ inHostCard: true, load, makeWorker: vi.fn() })).rejects.toThrow('answered 404');
  });

  it('in a host’s card fetches the built worker once and starts it as a classic worker from a blob', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:null/worker');
    const load = vi.fn(async () => ({ ok: true, text: async () => 'self.onmessage = () => {}' }));
    const makeWorker = vi.fn((url, options) => ({ url, options }));
    const first = await createSceneWorker({ inHostCard: true, load, makeWorker });
    const second = await createSceneWorker({ inHostCard: true, load, makeWorker });
    expect(first).toEqual({ url: 'blob:null/worker', options: undefined });
    expect(second).toEqual({ url: 'blob:null/worker', options: undefined });
    expect(load).toHaveBeenCalledTimes(1);
    expect(load).toHaveBeenCalledWith('https://rise.example/assets/scene-worker-abc.js');
  });
});
