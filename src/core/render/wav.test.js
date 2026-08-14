import { describe, expect, it } from 'vitest';
import { encodeWav } from './wav.js';

describe('WAV sidecar', () => {
  it('writes a PCM16 WAVE header over mixed samples', () => {
    const pcm = new Float32Array([0, 0.5, -0.5, 1]);
    const bytes = encodeWav({ pcm, sampleRate: 48000, channels: 2 });
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(bytes.byteLength).toBe(44 + pcm.length * 2);
  });
});
