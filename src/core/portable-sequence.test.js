import { describe, expect, it } from 'vitest';
import { resolveLibrarySourceIds } from './scriptorium-resolve.js';
import { validateWorkshopProject, WORKSHOP_PROJECT_SCHEMA } from './workshop-project.js';
import { exportPortableSequence, inspectPortableSequence } from './portable-sequence.js';

const SOURCE_ID = 'spoon-river-anthology#12';

async function authoredProject() {
  const { sources, missing, refused } = await resolveLibrarySourceIds([SOURCE_ID]);
  expect(missing).toEqual([]);
  expect(refused).toEqual([]);
  return validateWorkshopProject({
    schema: WORKSHOP_PROJECT_SCHEMA,
    id: 'an-authored-score',
    title: 'An authored score',
    intent: 'custom',
    sources,
    assets: [],
    experienceProgram: {
      schema: 'rise.experience-program.v1',
      id: 'an-authored-score',
      authority: 'user',
      editable: true,
      tracks: [
        { id: 'movement', kind: 'movement', clips: [{
          id: 'first', anchor: { sourceIds: [SOURCE_ID] }, data: { index: 0, title: 'First' }
        }] },
        { id: 'visual', kind: 'visual', clips: [{
          id: 'light', anchor: { sourceIds: [SOURCE_ID] },
          cue: { kind: 'field', renderer: 'attractor' }
        }], fallback: { kind: 'still' } },
        { id: 'audio', kind: 'audio', clips: [{
          id: 'sound', anchor: { sourceIds: [SOURCE_ID] },
          cue: { kind: 'soundscape', soundscapeId: 'aurora', gain: 0.4 }
        }], fallback: { kind: 'silence' } }
      ],
      metadata: { privatePrompt: 'do not export this note' }
    },
    defaults: { reading: { wpm: 240 }, projection: 'stream' },
    revision: 0,
    updatedAt: 0
  });
}

describe('portable Archive sequences', () => {
  it('carries a visual and audio score without copying source text or private metadata', async () => {
    const original = await authoredProject();
    const text = await exportPortableSequence(original, { creatorCredit: 'A declared creator' });
    const bundle = JSON.parse(text);
    expect(text).not.toContain(original.sources[0].data);
    expect(text).not.toContain('do not export this note');
    expect(bundle.sources[0]).toMatchObject({
      id: SOURCE_ID,
      workId: 'spoon-river-anthology',
      basis: 'pre-1930-us'
    });
    expect(bundle.sources[0].sourceRevision).toMatch(/^sha256:[0-9a-f]{64}$/);

    const imported = await inspectPortableSequence(text);
    expect(imported.creatorCredit).toBe('A declared creator');
    expect(imported.project.experienceProgram.authority).toBe('proposed');
    expect(imported.project.sources[0].data).toBe(original.sources[0].data);
    expect(imported.project.experienceProgram.tracks.map(track => track.kind))
      .toEqual(['movement', 'visual', 'audio']);
    expect(imported.project.defaults.visual.surface).toBe('scored');
    expect(imported.project.id).toBe(imported.id);
  });

  it('refuses an export whose saved source text differs from the named Archive extent', async () => {
    const original = await authoredProject();
    const changed = {
      ...original,
      sources: [{ ...original.sources[0], data: 'A different text under the same id.' }]
    };
    await expect(exportPortableSequence(changed)).rejects.toMatchObject({
      code: 'PORTABLE_SOURCE_CHANGED'
    });
  });

  it('refuses an import when the edition revision differs from the receiving Archive', async () => {
    const text = await exportPortableSequence(await authoredProject());
    const bundle = JSON.parse(text);
    bundle.sources[0].sourceRevision = `sha256:${'0'.repeat(64)}`;
    await expect(inspectPortableSequence(JSON.stringify(bundle))).rejects.toMatchObject({
      code: 'PORTABLE_SOURCE_MISMATCH'
    });
  });

  it('refuses personal media and remote visual pools', async () => {
    const original = await authoredProject();
    await expect(exportPortableSequence({ ...original, assets: [{ id: 'local-photo' }] }))
      .rejects.toMatchObject({ code: 'PORTABLE_LOCAL_MEDIA' });
    const remote = structuredClone(original);
    remote.experienceProgram.tracks[1].clips[0].cue = {
      kind: 'sourced', collections: ['aic-portraits']
    };
    await expect(exportPortableSequence(remote))
      .rejects.toMatchObject({ code: 'PORTABLE_CAPABILITY' });
  });

  it('refuses malformed, unknown, and oversized transfer documents', async () => {
    await expect(inspectPortableSequence('{')).rejects.toMatchObject({ code: 'PORTABLE_JSON' });
    await expect(inspectPortableSequence('x'.repeat(2_000_001)))
      .rejects.toMatchObject({ code: 'PORTABLE_TOO_LARGE' });
    await expect(inspectPortableSequence('é'.repeat(1_000_001)))
      .rejects.toMatchObject({ code: 'PORTABLE_TOO_LARGE' });
    const bundle = JSON.parse(await exportPortableSequence(await authoredProject()));
    bundle.unexpected = true;
    await expect(inspectPortableSequence(JSON.stringify(bundle)))
      .rejects.toMatchObject({ code: 'PORTABLE_UNKNOWN_FIELD' });
  });
});
