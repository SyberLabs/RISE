import { describe, expect, it } from 'vitest';
import { decodeWav, encodeWav } from './wav.js';

describe('WAV sidecar', () => {
  it('writes a PCM16 WAVE header over mixed samples', () => {
    const pcm = new Float32Array([0, 0.5, -0.5, 1]);
    const bytes = encodeWav({ pcm, sampleRate: 48000, channels: 2 });
    expect(String.fromCharCode(...bytes.slice(0, 4))).toBe('RIFF');
    expect(String.fromCharCode(...bytes.slice(8, 12))).toBe('WAVE');
    expect(bytes.byteLength).toBe(44 + pcm.length * 2);
  });

  it('round-trips PCM16 and decodes IEEE-float recitation WAV', () => {
    const pcm = new Float32Array([0, 0.5, -0.5, 0.25]);
    const decoded = decodeWav(encodeWav({ pcm, sampleRate: 8000, channels: 1 }));
    expect(decoded.sampleRate).toBe(8000);
    expect(decoded.channels).toBe(1);
    expect(decoded.pcm[1]).toBeCloseTo(0.5, 2);
    expect(decoded.pcm[2]).toBeCloseTo(-0.5, 2);
  });
});
