import { describe, expect, it } from 'vitest';
import { createNightDrive, NIGHT_DRIVE_LIMITS } from './night-drive.js';

// Minimal Web Audio stand-in that records when each oscillator starts.
function fakeContext() {
  const starts = [];
  const param = () => ({ value: 0, setValueAtTime() {}, linearRampToValueAtTime() {}, exponentialRampToValueAtTime() {}, cancelScheduledValues() {}, setTargetAtTime() {} });
  const node = extra => ({ connect() {}, disconnect() {}, gain: param(), frequency: param(), Q: param(), detune: param(), delayTime: param(), threshold: param(), knee: param(), ratio: param(), attack: param(), release: param(), ...extra });
  const ctx = {
    sampleRate: 8000, currentTime: 0, destination: node(),
    createGain: () => node(), createBiquadFilter: () => node(), createDelay: () => node(), createDynamicsCompressor: () => node(),
    createBuffer: (c, n) => ({ getChannelData: () => new Float32Array(n) }),
    createOscillator: () => node({ type: '', start(t) { starts.push({ t, kind: 'osc', o: this }); }, stop() {} }),
    createBufferSource: () => node({ buffer: null, start(t) { starts.push({ t, kind: 'noise' }); }, stop() {} })
  };
  return { ctx, starts };
}

describe('Night Drive bed', () => {
  it('puts a kick on every beat at the requested tempo', () => {
    const { ctx, starts } = fakeContext();
    const bed = createNightDrive(ctx, ctx.destination, { bpm: 124 });
    bed.renderInto(4);
    // kicks are the sine oscillators whose pitch drops from 150 Hz
    const kicks = starts.filter(s => s.kind === 'osc' && s.o.type === 'sine').map(s => s.t);
    const gaps = kicks.slice(1).map((t, i) => t - kicks[i]);
    for (const g of gaps) expect(g).toBeCloseTo(60 / 124, 6);
    expect(kicks.length).toBe(Math.ceil((4 - 0.02) / (60 / 124)));
  });

  it('clamps tempo to the supported range', () => {
    const { ctx } = fakeContext();
    expect(createNightDrive(ctx, ctx.destination, { bpm: 300 }).bpm).toBe(NIGHT_DRIVE_LIMITS.bpm.max);
    expect(createNightDrive(ctx, ctx.destination, { bpm: 10 }).bpm).toBe(NIGHT_DRIVE_LIMITS.bpm.min);
  });
});
