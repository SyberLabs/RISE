import { describe, expect, it } from 'vitest';
import { resolveLibrarySourceIds } from './scriptorium-resolve.js';
import { validateWorkshopProject, WORKSHOP_PROJECT_SCHEMA } from './workshop-project.js';
import { exportPortableSequence, inspectPortableSequence, remixablePassages, remixPassage }
  from './portable-sequence.js';
import quietExample from '../content/portable-examples/quiet.json' with { type: 'json' };

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

  it('gives a title and pace variation a new identity with an unverified parent reference', async () => {
    const parentText = await exportPortableSequence(await authoredProject(), {
      creatorCredit: 'First creator'
    });
    const parent = await inspectPortableSequence(parentText);
    const child = structuredClone(parent.project);
    child.title = 'My slower reading';
    child.defaults.reading.wpm = 180;
    child.provenance = {
      kind: 'portable-sequence-variation', parentPortableId: parent.id
    };
    const childText = await exportPortableSequence(child, { creatorCredit: 'Second creator' });
    const bundle = JSON.parse(childText);
    expect(bundle.parent).toEqual({ id: parent.id });
    expect(bundle.id).not.toBe(parent.id);
    expect(JSON.parse(await exportPortableSequence(child)).id).toBe(bundle.id);
    const inspected = await inspectPortableSequence(childText);
    expect(inspected.project.title).toBe('My slower reading');
    expect(inspected.project.defaults.reading.wpm).toBe(180);
    expect(inspected.project.experienceProgram.authority).toBe('proposed');
    expect(inspected.project.provenance).toMatchObject({
      portableId: bundle.id, parentPortableId: parent.id, creatorCredit: 'Second creator'
    });

    child.defaults.reading.wpm = 200;
    const faster = JSON.parse(await exportPortableSequence(child, { creatorCredit: 'Second creator' }));
    expect(faster.id).not.toBe(bundle.id);
    await expect(inspectPortableSequence(JSON.stringify({ ...bundle, title: 'Rebranded' })))
      .rejects.toMatchObject({ code: 'PORTABLE_ID' });
  });

  it('refuses malformed or self-referential parent claims', async () => {
    const valid = JSON.parse(await exportPortableSequence(await authoredProject()));
    for (const parent of [[], { id: 'local-draft' }, { id: valid.id, claim: 'approved' }]) {
      await expect(inspectPortableSequence(JSON.stringify({ ...valid, parent })))
        .rejects.toMatchObject({ code: 'PORTABLE_PARENT' });
    }
    await expect(inspectPortableSequence(JSON.stringify({ ...valid, parent: { id: valid.id } })))
      .rejects.toMatchObject({ code: 'PORTABLE_PARENT' });
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

  it('refuses freeform visual fields that could carry private notes', async () => {
    const original = await authoredProject();
    const field = structuredClone(original);
    field.experienceProgram.tracks[1].clips[0].cue.config = {
      privatePrompt: 'do not export this note'
    };
    await expect(exportPortableSequence(field))
      .rejects.toMatchObject({ code: 'PORTABLE_CAPABILITY' });

    const focal = structuredClone(original);
    focal.experienceProgram.tracks[1].clips[0].cue = {
      kind: 'focal', focal: { privatePrompt: 'do not export this note' }
    };
    await expect(exportPortableSequence(focal))
      .rejects.toMatchObject({ code: 'PORTABLE_CAPABILITY' });

    const fallback = structuredClone(original);
    fallback.experienceProgram.tracks[1].fallback = {
      kind: 'field', renderer: 'attractor', config: { privatePrompt: 'do not export this note' }
    };
    await expect(exportPortableSequence(fallback))
      .rejects.toMatchObject({ code: 'PORTABLE_CAPABILITY' });

    const sourcedFallback = structuredClone(original);
    sourcedFallback.experienceProgram.tracks[1].fallback = {
      kind: 'sourced', collections: ['aic-portraits']
    };
    await expect(exportPortableSequence(sourcedFallback))
      .rejects.toMatchObject({ code: 'PORTABLE_CAPABILITY' });

    const personal = JSON.parse(await exportPortableSequence(original));
    personal.program.tracks[1].clips[0].cue = {
      kind: 'field', renderer: 'focal',
      config: { type: 'personal', personalAssetId: 'a-private-photo' }
    };
    await expect(inspectPortableSequence(JSON.stringify(personal)))
      .rejects.toMatchObject({ code: 'PORTABLE_CAPABILITY' });
  });

  it('preserves supported authored visual controls', async () => {
    const original = await authoredProject();
    const styled = structuredClone(original);
    styled.experienceProgram.tracks[1].clips[0].cue.config = {
      system: 'thomas', palette: 'blue', form: 'kaleido', speed: 1.5
    };
    const imported = await inspectPortableSequence(await exportPortableSequence(styled));
    expect(imported.project.experienceProgram.tracks[1].clips[0].cue.config)
      .toMatchObject(styled.experienceProgram.tracks[1].clips[0].cue.config);
  });

  it('keeps matching Archive quote anchors and refuses a false fingerprint', async () => {
    const original = await authoredProject();
    const phrase = 'How does it happen, tell me';
    const start = original.sources[0].data.indexOf(phrase);
    expect(start).toBeGreaterThanOrEqual(0);
    const quoted = structuredClone(original);
    quoted.experienceProgram.tracks[1].clips[0].anchor = {
      sourceIds: [SOURCE_ID], fromCharacter: start, toCharacter: start + phrase.length,
      quoteStart: 'How does', quoteEnd: 'tell me'
    };
    const text = await exportPortableSequence(quoted);
    expect(text).toContain('How does');
    await expect(inspectPortableSequence(text)).resolves.toMatchObject({
      project: { experienceProgram: { authority: 'proposed' } }
    });

    quoted.experienceProgram.tracks[1].clips[0].anchor.quoteStart = 'PRIVATE_NONMATCHING_TEXT';
    await expect(exportPortableSequence(quoted))
      .rejects.toMatchObject({ code: 'PORTABLE_SOURCE_QUOTE' });
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

describe('recipient passage remix', () => {
  const cues = program => program.tracks.filter(track => ['visual', 'audio'].includes(track.kind))
    .map(track => track.clips.map(clip => clip.cue));

  it('lists each passage with its span, visual, and soundscape', async () => {
    const { project } = await inspectPortableSequence(JSON.stringify(quietExample));
    expect(remixablePassages(project.experienceProgram)).toEqual([
      { id: 'visual-1', span: 'the first 50%', collection: 'turrell', soundscapeId: 'aurora' },
      { id: 'visual-2', span: 'the last 50%', collection: 'rockgarden', soundscapeId: 'nocturne' }
    ]);
  });

  it('changes one passage and carries it as a distinct child without touching the parent', async () => {
    const parent = await inspectPortableSequence(JSON.stringify(quietExample));
    const before = structuredClone(parent.project);
    const program = remixPassage(parent.project.experienceProgram, 'visual-1',
      { collection: 'fractal', soundscapeId: 'soft-rain' });
    expect(parent.project).toEqual(before);
    expect(remixablePassages(program)).toEqual([
      { id: 'visual-1', span: 'the first 50%', collection: 'fractal', soundscapeId: 'soft-rain' },
      { id: 'visual-2', span: 'the last 50%', collection: 'rockgarden', soundscapeId: 'nocturne' }
    ]);
    expect(program.tracks.find(track => track.kind === 'audio').clips[0].cue.gain).toBe(0.35);
    expect(program.tracks.map(track => track.clips.map(clip => clip.anchor)))
      .toEqual(parent.project.experienceProgram.tracks.map(track => track.clips.map(clip => clip.anchor)));

    const child = {
      ...structuredClone(parent.project), experienceProgram: program,
      provenance: { kind: 'portable-sequence-variation', parentPortableId: parent.id }
    };
    const unchanged = { ...child, experienceProgram: parent.project.experienceProgram };
    const text = await exportPortableSequence(child, { creatorCredit: 'Remix author' });
    const bundle = JSON.parse(text);
    expect(bundle.id).not.toBe(parent.id);
    expect(bundle.id).not.toBe(JSON.parse(await exportPortableSequence(unchanged)).id);
    expect(bundle.sources).toEqual(quietExample.sources);
    const carried = await inspectPortableSequence(text);
    expect(carried.parentPortableId).toBe(parent.id);
    expect(carried.creatorCredit).toBe('Remix author');
    expect(cues(carried.project.experienceProgram)).toEqual(cues(program));
  });

  it('offers only procedural and soundscape passages, and keeps the sound\'s gain and fade', async () => {
    expect(remixablePassages((await authoredProject()).experienceProgram)).toEqual([]);
    const { project } = await inspectPortableSequence(JSON.stringify(quietExample));
    const faded = structuredClone(project.experienceProgram);
    faded.tracks.find(track => track.kind === 'audio').clips[0].cue.fadeMs = 1500;
    const program = remixPassage(faded, 'visual-1', { collection: 'klee', soundscapeId: 'piano' });
    expect(program.tracks.find(track => track.kind === 'audio').clips[0].cue)
      .toEqual({ kind: 'soundscape', soundscapeId: 'piano', gain: 0.35, fadeMs: 1500 });
  });

  it('keeps a blended visual whole when only the soundscape changes', async () => {
    const { project } = await inspectPortableSequence(JSON.stringify(quietExample));
    const blended = structuredClone(project.experienceProgram);
    blended.tracks.find(track => track.kind === 'visual').clips[0].cue.collections = ['turrell', 'klee'];
    const program = remixPassage(blended, 'visual-1', { collection: 'turrell', soundscapeId: 'piano' });
    expect(program.tracks.find(track => track.kind === 'visual').clips[0].cue.collections)
      .toEqual(['turrell', 'klee']);
    expect(remixablePassages(program)[0].soundscapeId).toBe('piano');
  });

  it('returns the same program when the passage keeps its visual and soundscape', async () => {
    const { project } = await inspectPortableSequence(JSON.stringify(quietExample));
    expect(remixPassage(project.experienceProgram, 'visual-2',
      { collection: 'rockgarden', soundscapeId: 'nocturne' })).toBe(project.experienceProgram);
  });

  it('refuses a passage, visual, or soundscape this build does not offer', async () => {
    const { project } = await inspectPortableSequence(JSON.stringify(quietExample));
    const program = project.experienceProgram;
    const valid = { collection: 'klee', soundscapeId: 'aurora' };
    expect(() => remixPassage(program, 'audio-1', valid)).toThrow(/passage/i);
    expect(() => remixPassage(program, 'visual-1', { ...valid, collection: 'attractor' }))
      .toThrow(expect.objectContaining({ code: 'PORTABLE_CAPABILITY' }));
    expect(() => remixPassage(program, 'visual-1', { ...valid, collection: 'aic-paintings' }))
      .toThrow(expect.objectContaining({ code: 'PORTABLE_CAPABILITY' }));
    expect(() => remixPassage(program, 'visual-1', { ...valid, soundscapeId: 'https://x.test/a.mp3' }))
      .toThrow(expect.objectContaining({ code: 'PORTABLE_SCORE_INVALID' }));
    expect(() => remixPassage(program, 'visual-1', { ...valid, soundscapeId: 'not-a-soundscape' }))
      .toThrow(expect.objectContaining({ code: 'PORTABLE_SCORE_INVALID' }));
  });
});
