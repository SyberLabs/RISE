import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { resolveSpokenClips } from './voice-pcm.js';

describe('voice-pcm Opus decode', () => {
  it('decodes an Ogg Opus asset to 48 kHz PCM', () => {
    const bytes = readFileSync(resolve(process.cwd(), 'src/core/render/fixtures/sine.opus'));
    const plan = {
      narrationRuns: [{
        cueKind: 'narration:spoken',
        cueId: 'c1',
        fromMs: 0,
        toMs: 2000,
        voiceAssetId: 'asset-opus'
      }]
    };
    const clips = resolveSpokenClips(plan, { voiceBytes: { 'asset-opus': bytes } });
    expect(clips).toHaveLength(1);
    expect(clips[0].sampleRate).toBe(48000);
    expect(clips[0].channels).toBe(1);
    expect(clips[0].pcm.length).toBeGreaterThan(90000);
  });
});
