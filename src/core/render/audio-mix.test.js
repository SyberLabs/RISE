import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { mixAudio, peakAmplitude, measureLoudnessLufs } from './audio-mix.js';
import { encodeWav } from './wav.js';
import { RenderError } from './errors.js';
import { resolveVoicePackEntry, VOICE_PACK_SCHEMA, voiceAssetKey } from '../../audio/voice-pack.js';

function dcWav({ amplitude = 0.5, durationMs = 400, sampleRate = 8000 } = {}) {
  const frames = Math.round((durationMs / 1000) * sampleRate);
  const pcm = new Float32Array(frames).fill(amplitude);
  return encodeWav({ pcm, sampleRate, channels: 1 });
}

function spokenPlan({
  durationMs = 1000,
  fromMs = 0,
  toMs = 400,
  voiceId = 'af_heart',
  voiceAssetId = null,
  text = 'Look within.',
  words = null,
  duck = { target: 'bed', floor: 0.1, downMs: 0, upMs: 0 }
} = {}) {
  return {
    durationMs,
    loudnessLufs: null,
    audioRuns: [{
      cueId: 'bed',
      cueKind: 'audio:soundscape',
      cue: { kind: 'soundscape', soundscapeId: 'aurora' },
      fromMs: 0,
      toMs: durationMs,
      fadeMs: 0,
      gain: 1
    }],
    narrationRuns: [{
      cueId: 'voice-1',
      cueKind: 'narration:spoken',
      cue: {
        kind: 'spoken',
        ...(voiceId ? { voiceId } : {}),
        ...(voiceAssetId ? { voiceAssetId } : {})
      },
      fromMs,
      toMs,
      duck,
      words,
      voiceId,
      voiceAssetId
    }],
    atoms: [{
      index: 0,
      startMs: fromMs,
      endMs: toMs,
      text,
      narrationCueId: 'voice-1',
      sourceId: 'source-anna',
      sourceCharacterStart: 0,
      sourceCharacterEnd: String(text).length
    }]
  };
}

function sampleAt(mixed, ms, channel = 0) {
  const frame = Math.min(
    mixed.frames - 1,
    Math.max(0, Math.floor((ms / 1000) * mixed.sampleRate))
  );
  return mixed.pcm[frame * mixed.channels + channel];
}

describe('spoken PCM mix', () => {
  it('mixes assigned voice WAV instead of a 220 Hz sine and ducks the bed', () => {
    const plan = spokenPlan({
      voiceId: null,
      voiceAssetId: 'asset-voice-1',
      text: 'Happy families'
    });
    const mixed = mixAudio(plan, {
      sampleRate: 8_000,
      inventory: { bytesById: { 'asset-voice-1': dcWav({ amplitude: 0.4 }) } }
    });
    const spoken = sampleAt(mixed, 200);
    const after = sampleAt(mixed, 700);
    expect(Math.abs(spoken)).toBeGreaterThan(0.3);
    expect(Math.abs(spoken - 0.4)).toBeLessThan(0.08);
    expect(Math.abs(after)).toBeLessThan(Math.abs(spoken));
    expect(peakAmplitude(mixed.pcm)).toBeGreaterThan(0.3);

    let sineEnergy = 0;
    let dcEnergy = 0;
    const spokenFrames = Math.floor(0.4 * mixed.sampleRate);
    for (let i = 0; i < spokenFrames; i += 1) {
      const t = i / mixed.sampleRate;
      const left = mixed.pcm[i * mixed.channels];
      sineEnergy += left * Math.sin(2 * Math.PI * 220 * t);
      dcEnergy += left;
    }
    expect(Math.abs(dcEnergy)).toBeGreaterThan(Math.abs(sineEnergy) * 4);
  });

  it('maps recitation pack PCM onto narration spans for af_heart', () => {
    const entry = resolveVoicePackEntry('af_heart', 'Look within.');
    expect(entry?.asset).toBe('/audio/recitation/af_heart/c-1i1sp65.wav');
    const plan = spokenPlan({
      durationMs: 1600,
      toMs: 1500,
      text: 'Look within.'
    });
    const mixed = mixAudio(plan, { sampleRate: 8_000 });
    expect(peakAmplitude(mixed.pcm)).toBeGreaterThan(0.05);
    expect(Math.abs(sampleAt(mixed, 400))).toBeGreaterThan(0.01);
    const disk = readFileSync(resolve(process.cwd(), 'public/audio/recitation/af_heart/c-1i1sp65.wav'));
    expect(disk.byteLength).toBeGreaterThan(44);
  });

  it('places pack phrases on word/atom windows inside a spoken run', () => {
    const plan = {
      durationMs: 2800,
      loudnessLufs: null,
      audioRuns: [{
        cueId: 'bed',
        cueKind: 'audio:silence',
        cue: { kind: 'silence' },
        fromMs: 0,
        toMs: 2800,
        fadeMs: 0,
        gain: 1
      }],
      narrationRuns: [{
        cueId: 'voice-1',
        cueKind: 'narration:spoken',
        cue: { kind: 'spoken', voiceId: 'af_heart' },
        fromMs: 0,
        toMs: 2800,
        duck: null,
        voiceId: 'af_heart',
        voiceAssetId: null
      }],
      atoms: [
        {
          index: 0,
          startMs: 0,
          endMs: 1400,
          text: 'I,',
          narrationCueId: 'voice-1'
        },
        {
          index: 1,
          startMs: 1400,
          endMs: 2800,
          text: 'however,',
          narrationCueId: 'voice-1'
        }
      ]
    };
    const mixed = mixAudio(plan, { sampleRate: 8_000 });
    expect(Math.abs(sampleAt(mixed, 700))).toBeGreaterThan(0.01);
    expect(Math.abs(sampleAt(mixed, 2000))).toBeGreaterThan(0.01);
  });

  it('maps authored word spans onto pack PCM when every word is in the pack', () => {
    const happyKey = voiceAssetKey('Happy');
    const familiesKey = voiceAssetKey('families');
    const manifest = {
      schema: VOICE_PACK_SCHEMA,
      voices: {
        af_heart: {
          entries: {
            [happyKey]: {
              text: 'Happy',
              asset: '/audio/recitation/af_heart/happy.wav',
              mimeType: 'audio/wav',
              sampleRate: 8000,
              durationMs: 200
            },
            [familiesKey]: {
              text: 'families',
              asset: '/audio/recitation/af_heart/families.wav',
              mimeType: 'audio/wav',
              sampleRate: 8000,
              durationMs: 200
            }
          }
        }
      }
    };
    const plan = spokenPlan({
      durationMs: 400,
      toMs: 400,
      text: 'Happy families',
      words: [
        { text: 'Happy', fromCharacter: 0, toCharacter: 5, durationMs: 200 },
        { text: 'families', fromCharacter: 6, toCharacter: 14, durationMs: 200 }
      ]
    });
    const mixed = mixAudio(plan, {
      sampleRate: 8_000,
      manifest,
      voiceBytes: {
        '/audio/recitation/af_heart/happy.wav': dcWav({ amplitude: 0.5, durationMs: 200 }),
        '/audio/recitation/af_heart/families.wav': dcWav({ amplitude: -0.5, durationMs: 200 })
      }
    });
    expect(sampleAt(mixed, 80)).toBeGreaterThan(0.35);
    expect(sampleAt(mixed, 280)).toBeLessThan(-0.35);
  });

  it('aims the mix toward −14 LUFS when the plan names that target', () => {
    const plan = spokenPlan({
      voiceId: null,
      voiceAssetId: 'asset-voice-1',
      text: 'Happy families'
    });
    plan.loudnessLufs = -14;
    const mixed = mixAudio(plan, {
      sampleRate: 8_000,
      inventory: { bytesById: { 'asset-voice-1': dcWav({ amplitude: 0.2, durationMs: 400 }) } }
    });
    const lufs = measureLoudnessLufs(mixed.pcm, mixed.channels);
    expect(lufs).toBeGreaterThan(-16);
    expect(lufs).toBeLessThan(-12);
    expect(peakAmplitude(mixed.pcm)).toBeLessThan(10 ** (-1 / 20) + 1e-6);
  });

  it('refuses a spoken clip whose assigned bytes are missing', () => {
    const plan = spokenPlan({
      voiceId: null,
      voiceAssetId: 'asset-voice-1',
      text: 'Happy families'
    });
    expect(() => mixAudio(plan, { sampleRate: 8_000, inventory: {} }))
      .toThrow(expect.objectContaining({
        name: 'RenderError',
        code: 'RENDER_AUDIO_MISSING'
      }));
    expect(() => mixAudio(plan, { sampleRate: 8_000 })).toThrow(RenderError);
  });

  it('refuses a library voice with no pack coverage instead of inventing a bed', () => {
    const plan = spokenPlan({ text: 'Happy families are all alike' });
    expect(() => mixAudio(plan, { sampleRate: 8_000 }))
      .toThrow(expect.objectContaining({ code: 'RENDER_AUDIO_MISSING' }));
  });
});
