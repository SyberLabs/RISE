import { describe, expect, it, vi } from 'vitest';
import {
  applyWorkshopAudioAsset,
  WorkshopAudioPreviewController,
  workshopAudioAssetIsCurrent
} from './workshop-audio.js';

describe('Workshop audio defaults', () => {
  it('holds one base layer, and lets nothing else clear it', () => {
    // A soundscape displaces a tone: there is one base at a time.
    expect(applyWorkshopAudioAsset({ soundscape: 'aurora', audioPreset: 'gateway' },
      'soundscape:faded-signal')).toMatchObject({ soundscape: 'faded-signal', audioPreset: 'silent' });
    // And a tone displaces a soundscape.
    expect(applyWorkshopAudioAsset({ soundscape: 'aurora', audioPreset: 'silent' },
      'tone:deep')).toMatchObject({ soundscape: 'none', audioPreset: 'deep' });
    expect(workshopAudioAssetIsCurrent({ soundscape: 'none', audioPreset: 'silent' },
      { kind: 'tone', value: 'silent' })).toBe(true);
  });

  it('no longer discards a personal recording when a tone is chosen', () => {
    // `audioPreset` carried both a tone and the flag `personal`, so the two
    // settings destroyed one another: picking a tone nulled the recording,
    // picking the recording overwrote the tone with a value the engine does
    // not know. They are separate fields of the model now.
    const next = applyWorkshopAudioAsset(
      { soundscape: 'none', audioPreset: 'silent', selectedSwellId: 's1' }, 'tone:deep');
    expect(next.audioPreset).toBe('deep');
    expect(next.selectedSwellId).toBe('s1');
  });
});

describe('WorkshopAudioPreviewController', () => {
  function engine() {
    return {
      init: vi.fn().mockResolvedValue(undefined), resume: vi.fn().mockResolvedValue(undefined),
      applyPreset: vi.fn(), startSoundscape: vi.fn(), stopSoundscape: vi.fn(),
      playSwell: vi.fn().mockResolvedValue(undefined), stopSwell: vi.fn()
    };
  }

  it('owns one preview, stops the replaced preview, and reports lifecycle state', async () => {
    const audio = engine();
    const onChange = vi.fn();
    const preview = new WorkshopAudioPreviewController({
      engineProvider: () => audio, onChange, durationMs: 30000
    });

    await preview.play('soundscape:aurora');
    expect(audio.startSoundscape).toHaveBeenCalledWith('aurora');
    expect(preview.status()).toEqual({ state: 'playing', assetId: 'soundscape:aurora' });

    await preview.play('tone:focus');
    expect(audio.stopSoundscape).toHaveBeenCalledWith(true);
    expect(audio.applyPreset).toHaveBeenLastCalledWith('focus');

    preview.destroy();
    expect(audio.applyPreset).toHaveBeenLastCalledWith('silent');
    expect(preview.status()).toEqual({ state: 'idle', assetId: null });
    expect(onChange).toHaveBeenCalled();
  });

  it('cancels a stale asynchronous preview before it can publish ownership', async () => {
    let release;
    const audio = engine();
    audio.init.mockReturnValue(new Promise(resolve => { release = resolve; }));
    const preview = new WorkshopAudioPreviewController({ engineProvider: () => audio });

    const pending = preview.play('soundscape:aurora');
    preview.stop();
    release();
    await pending;

    expect(audio.startSoundscape).not.toHaveBeenCalled();
    expect(preview.status().state).toBe('idle');
  });
});
