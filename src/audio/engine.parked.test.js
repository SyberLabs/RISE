/**
 * The audio door: an id the engine is asked to start that no soundscape can
 * be made from, but that is a parked Feelings sound, starts its stand-in
 * with a warning instead of leaving the reading silent.
 */
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./soundscapes.js', async importOriginal => ({
  ...(await importOriginal()),
  createSoundscape: vi.fn(() => ({ start: vi.fn(), stop: vi.fn() }))
}));

const { createSoundscape } = await import('./soundscapes.js');
const { AudioEngine } = await import('./engine.js');

function readyEngine() {
  const engine = new AudioEngine();
  engine.isInitialized = true;
  engine.context = { currentTime: 0 };
  engine.layerGains = { soundscape: {} };
  vi.spyOn(engine, 'stopSoundscape').mockImplementation(() => {});
  vi.spyOn(engine, 'setLayerVolume').mockImplementation(() => {});
  return engine;
}

describe('the engine starting a soundscape', () => {
  afterEach(() => vi.restoreAllMocks());

  it('starts the stand-in for a parked Feelings id, and says so', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    readyEngine().startSoundscape('chase');
    expect(createSoundscape).toHaveBeenLastCalledWith('night-drive', expect.anything(), expect.anything(), expect.anything());
    expect(warn.mock.calls.some(call => String(call[0]).includes('chase'))).toBe(true);
  });

  it('starts an offered id as it is, without a warning', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'log').mockImplementation(() => {});
    readyEngine().startSoundscape('aurora');
    expect(createSoundscape).toHaveBeenLastCalledWith('aurora', expect.anything(), expect.anything(), expect.anything());
    expect(warn).not.toHaveBeenCalled();
  });
});
