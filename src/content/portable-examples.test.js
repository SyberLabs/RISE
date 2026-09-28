import { expect, it } from 'vitest';
import { PORTABLE_EXAMPLES } from './portable-examples.js';
import { inspectPortableSequence } from '../core/portable-sequence.js';

it('admits both fixed Archive editions and preserves their distinct authored score cues', async () => {
  const [quiet, energetic] = await Promise.all(PORTABLE_EXAMPLES.map(async example =>
    inspectPortableSequence(JSON.stringify(example.bundle))));
  expect(quiet.project.sources[0].id).toBe('spoon-river-anthology#12');
  expect(energetic.project.sources[0].id).toBe('oedipus-rex#1:200');
  expect(quiet.project.defaults.reading.wpm).toBe(180);
  expect(energetic.project.defaults.reading.wpm).toBe(280);
  expect(quiet.project.experienceProgram.tracks.find(track => track.kind === 'visual')
    .clips.map(clip => clip.cue.collections[0])).toEqual(['turrell', 'rockgarden']);
  expect(energetic.project.experienceProgram.tracks.find(track => track.kind === 'visual')
    .clips.map(clip => clip.cue.collections[0])).toEqual(['fractal', 'neural']);
  expect(quiet.project.experienceProgram.tracks.find(track => track.kind === 'audio')
    .clips.map(clip => clip.cue.soundscapeId)).toEqual(['aurora', 'nocturne']);
  expect(energetic.project.experienceProgram.tracks.find(track => track.kind === 'audio')
    .clips.map(clip => clip.cue.soundscapeId)).toEqual(['thrilling', 'chase']);
  expect(quiet.project.experienceProgram.authority).toBe('proposed');
  expect(energetic.project.experienceProgram.authority).toBe('proposed');
  for (const [index, example] of PORTABLE_EXAMPLES.entries()) {
    expect(JSON.stringify(example.bundle)).not.toContain([quiet, energetic][index].project.sources[0].data);
    expect(example.bundle).not.toHaveProperty('assets');
  }
});
