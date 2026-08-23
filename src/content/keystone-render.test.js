import { describe, expect, it } from 'vitest';
import { buildKeystoneRenderComposition } from './keystone-render.js';

describe('Keystone render compositions', () => {
  it.each([
    ['meditations', 'fractal', 'faded-signal', true],
    ['metamorphoses', 'ostensoria', 'aurora', false],
    ['tintern', 'aic-landscapes', 'aurora', false]
  ])('lowers %s with the same Chamber identities', async (slug, visualId, soundscapeId, releaseCertified) => {
    const composition = await buildKeystoneRenderComposition(slug);
    const visual = composition.program.tracks.find(track => track.kind === 'visual');
    const audio = composition.program.tracks.find(track => track.kind === 'audio');
    const narration = composition.program.tracks.find(track => track.kind === 'narration');

    expect(composition.admission.admitted).toBe(true);
    expect(composition.admission.releaseCertified).toBe(releaseCertified);
    expect(visual.clips[0].cue.collections).toEqual([visualId]);
    expect(audio?.clips[0].cue.soundscapeId || null).toBe(soundscapeId);
    expect(narration.clips[0].cue.voiceId).toBe('af_heart');
    expect(composition.lowered.narrationProgram.segments).toHaveLength(1);
    expect(composition.session.totalDuration).toBeGreaterThan(0);
  });
});
