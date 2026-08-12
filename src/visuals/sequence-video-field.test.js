import { afterEach, describe, expect, it, vi } from 'vitest';
import { adaptiveVideoLayout, SequenceVideoField } from './sequence-video-field.js';

const asset = {
  id: 'video-1', kind: 'video', mimeType: 'video/mp4',
  uri: 'blob:http://localhost/video-1', durationMs: 18000
};

function mount(options = {}) {
  const host = document.createElement('div');
  document.body.appendChild(host);
  const field = new SequenceVideoField(host, options);
  vi.spyOn(field.video, 'load').mockImplementation(() => {});
  vi.spyOn(field.video, 'play').mockResolvedValue(undefined);
  vi.spyOn(field.video, 'pause').mockImplementation(() => {});
  return { field, host };
}

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

describe('SequenceVideoField', () => {
  it('fills near-matched stages and preserves extreme aspect mismatches', () => {
    expect(adaptiveVideoLayout({
      mediaWidth: 1920, mediaHeight: 1080,
      stageWidth: 1440, stageHeight: 900
    })).toMatchObject({
      fit: 'cover', mediaOrientation: 'landscape', stageOrientation: 'landscape'
    });
    expect(adaptiveVideoLayout({
      mediaWidth: 1920, mediaHeight: 1080,
      stageWidth: 390, stageHeight: 844
    })).toMatchObject({
      fit: 'contain', mediaOrientation: 'landscape', stageOrientation: 'portrait'
    });
    expect(adaptiveVideoLayout({
      mediaWidth: 1080, mediaHeight: 1920,
      stageWidth: 390, stageHeight: 844
    }).fit).toBe('cover');
  });

  it('does not play invisibly and starts only after a decoded frame exists', async () => {
    const { field } = mount();
    field.show(asset, { timeMode: 'loop' });
    expect(field.root.hidden).toBe(true);
    expect(field.video.play).not.toHaveBeenCalled();
    field.video.dispatchEvent(new Event('loadeddata'));
    await Promise.resolve();
    expect(field.root.hidden).toBe(false);
    expect(field.video.muted).toBe(true);
    expect(field.video.loop).toBe(true);
    expect(field.video.play).toHaveBeenCalledOnce();
  });

  it('holds a poster under reduced motion and never autoplays', async () => {
    const { field } = mount({ reducedMotion: true });
    field.show(asset, { timeMode: 'loop' });
    field.video.dispatchEvent(new Event('loadeddata'));
    await Promise.resolve();
    expect(field.root.hidden).toBe(false);
    expect(field.video.play).not.toHaveBeenCalled();
  });

  it('pauses with transport, resumes, and cancels on authority loss', async () => {
    const { field } = mount();
    field.show(asset, { timeMode: 'cue' });
    field.video.dispatchEvent(new Event('loadeddata'));
    await Promise.resolve();
    expect(field.pause()).toBe(true);
    expect(field.video.pause).toHaveBeenCalled();
    expect(field.resume()).toBe(true);
    expect(field.video.play).toHaveBeenCalledTimes(2);
    field.hide();
    expect(field.root.hidden).toBe(true);
    expect(field.video.hasAttribute('src')).toBe(false);
  });

  it('reflows across orientation changes without restarting the active work', async () => {
    const { field, host } = mount();
    let stage = { width: 1440, height: 900 };
    vi.spyOn(host, 'getBoundingClientRect').mockImplementation(() => ({
      ...stage, x: 0, y: 0, top: 0, left: 0,
      right: stage.width, bottom: stage.height, toJSON: () => ({})
    }));
    Object.defineProperty(field.video, 'videoWidth', { configurable: true, value: 1920 });
    Object.defineProperty(field.video, 'videoHeight', { configurable: true, value: 1080 });

    field.show(asset, { timeMode: 'loop', presentation: 'full-frame' });
    field.video.dispatchEvent(new Event('loadedmetadata'));
    field.video.dispatchEvent(new Event('loadeddata'));
    await Promise.resolve();
    expect(field.root.dataset.fit).toBe('cover');

    stage = { width: 390, height: 844 };
    field._syncLayout();
    expect(field.root.dataset.fit).toBe('contain');
    expect(field.assetId).toBe(asset.id);
    expect(field.video.getAttribute('src')).toBe(asset.uri);
  });
});
