import { describe, expect, it } from 'vitest';
import { Session } from './models.js';
import {
  audioAssignmentsFromProgram,
  isWorkshopProject,
  migrateWorkshopBlueprint,
  validateWorkshopProject,
  visualAssignmentsFromProgram,
  WORKSHOP_PROJECT_SCHEMA,
  WorkshopProjectError,
  workshopEditorDataToProject,
  workshopProjectToBlueprintView,
  workshopProjectToSessionConfig
} from './workshop-project.js';

const IMAGE = 'data:image/png;base64,cHJvamVjdA==';

function legacyBlueprint(overrides = {}) {
  return {
    id: 'blueprint-1',
    title: 'A scored reading',
    intent: 'reflection',
    sources: [{
      id: 'source-1',
      name: 'Source',
      providerId: 'local',
      type: 'text/plain',
      data: 'Still water reflects the moon.'
    }],
    wpm: 200,
    paceV2: true,
    chunkMode: 'phrase',
    curve: 'wave',
    displayMode: 'focal',
    soundscape: 'aurora',
    audioPreset: 'silent',
    visualConfig: {
      visualMode: 'interlocution',
      interlocution: { presentation: 'continuous', frequency: 0.3 }
    },
    sequenceVisualAssets: [{
      id: 'moon', uri: IMAGE, name: 'Moon', color: '#7fd4a4'
    }],
    visualScoreAssignments: [{
      id: 'visual-1',
      sourceId: 'source-1',
      assetId: 'moon',
      fromCharacter: 0,
      toCharacter: 11,
      quoteStart: 'Still water',
      quoteEnd: 'Still water'
    }],
    ...overrides
  };
}

describe('Workshop Project v1', () => {
  it('opens a saved project whose sound is a parked Feelings soundscape on its stand-in', () => {
    const project = migrateWorkshopBlueprint(legacyBlueprint({ soundscape: 'wonder' }));
    expect(project.defaults.audio.soundscape).toBe('aurora');
    expect(validateWorkshopProject({ ...project, defaults: { ...project.defaults,
      audio: { ...project.defaults.audio, soundscape: 'chase' } } }).defaults.audio.soundscape).toBe('night-drive');
  });

  it('opens a saved score with stand-ins for parked passage sounds and fallback', () => {
    const project = migrateWorkshopBlueprint(legacyBlueprint());
    const experienceProgram = JSON.parse(JSON.stringify(project.experienceProgram));
    experienceProgram.tracks.push({ id: 'saved-audio', kind: 'audio', clips: [{
      id: 'saved-cue', anchor: { sourceIds: ['source-1'] },
      cue: { kind: 'soundscape', soundscapeId: 'chase', gain: 0.4 }
    }], fallback: { kind: 'soundscape', soundscapeId: 'wonder' } });
    const restored = validateWorkshopProject({ ...project, experienceProgram });
    const audio = restored.experienceProgram.tracks.find(track => track.kind === 'audio');
    expect(audio.clips[0].cue.soundscapeId).toBe('night-drive');
    expect(audio.fallback.soundscapeId).toBe('aurora');
    expect(experienceProgram.tracks.at(-1).clips[0].cue.soundscapeId).toBe('chase');
  });

  it('migrates a flat blueprint into one canonical project', () => {
    const project = migrateWorkshopBlueprint(legacyBlueprint());

    expect(project.schema).toBe(WORKSHOP_PROJECT_SCHEMA);
    expect(project.defaults).toMatchObject({
      reading: { wpm: 200, chunkMode: 'phrase', curve: 'wave' },
      visual: { surface: 'scored' },
      audio: { soundscape: 'aurora', audioPreset: 'silent' }
    });
    expect(project.assets[0].id).toBe('moon');
    expect(project.experienceProgram.metadata.kind).toBe('workshop-visual-score');
    expect(project).not.toHaveProperty('visualScoreAssignments');
    expect(project).not.toHaveProperty('customVisuals');
    expect(Object.isFrozen(project)).toBe(true);
  });

  it('keeps a tone’s delivery and waveform with the project, through to the reading, and refuses unknown ones', () => {
    const editor = legacyBlueprint({ soundscape: 'none', audioPreset: 'focus', entrainmentMode: 'isochronic', entrainmentWaveform: 'triangle' });
    const project = workshopEditorDataToProject(editor, { id: editor.id });
    expect(project.defaults.audio).toMatchObject({ audioPreset: 'focus', entrainmentMode: 'isochronic', entrainmentWaveform: 'triangle' });
    expect(workshopProjectToSessionConfig(project)).toMatchObject({ entrainmentMode: 'isochronic', entrainmentWaveform: 'triangle' });
    expect(migrateWorkshopBlueprint(editor).defaults.audio).toMatchObject({ entrainmentMode: 'isochronic', entrainmentWaveform: 'triangle' });

    // Unknown or default values leave the audio defaults in the shape they had before these existed.
    for (const [mode, waveform] of [['loud', 'square'], ['binaural', 'sine']]) {
      const plain = workshopEditorDataToProject(legacyBlueprint({ entrainmentMode: mode, entrainmentWaveform: waveform }), { id: 'x' });
      expect(Object.keys(plain.defaults.audio).sort(), mode).toEqual(['audioPreset', 'selectedSwellId', 'soundscape']);
    }
  });

  it('keeps a Living Flame reading as itself through the project and back, with its flame as the fallback (RDR-023)', () => {
    const editor = legacyBlueprint({ visualConfig: { visualMode: 'living-flame' } });
    const project = workshopEditorDataToProject(editor, { id: editor.id });
    expect(project.defaults.visual.surface).toBe('living-flame');
    expect(workshopProjectToSessionConfig(project).visualConfig.visualMode).toBe('living-flame');
    const migrated = migrateWorkshopBlueprint(editor);
    expect(migrated.defaults.visual.surface).toBe('living-flame');
    expect(migrated.experienceProgram.tracks.find(track => track.kind === 'visual').fallback)
      .toMatchObject({ kind: 'field', renderer: 'living-flame' });
  });

  it('migrates the historical pacing contract exactly once', () => {
    const migrated = migrateWorkshopBlueprint(legacyBlueprint({ wpm: 200, paceV2: false }));
    expect(migrated.defaults.reading.wpm).toBe(290);
    expect(migrateWorkshopBlueprint(migrated).defaults.reading.wpm).toBe(290);
  });

  it('projects formal projects into Session and legacy component read models', () => {
    const project = migrateWorkshopBlueprint(legacyBlueprint());
    const session = workshopProjectToSessionConfig(project);
    const view = workshopProjectToBlueprintView(project);

    expect(session).toMatchObject({
      id: 'blueprint-1',
      wpm: 200,
      soundscape: 'aurora',
      visualConfig: { visualMode: 'interlocution' }
    });
    expect(session.visualScoreAssignments[0]).toMatchObject({
      id: 'visual-1', assetId: 'moon', fromCharacter: 0, toCharacter: 11
    });
    expect(view.schema).toBe(WORKSHOP_PROJECT_SCHEMA);
    expect(view.project).toBeDefined();
    expect(view.customVisuals).toEqual([IMAGE]);
  });

  it('serializes the current editor projection without persisting duplicate lane state', () => {
    const editor = legacyBlueprint();
    const project = workshopEditorDataToProject(editor, { id: editor.id, updatedAt: 42 });

    expect(isWorkshopProject(project)).toBe(true);
    expect(project.updatedAt).toBe(42);
    expect(project.experienceProgram.tracks.find(track => track.kind === 'visual').clips)
      .toHaveLength(1);
    expect(visualAssignmentsFromProgram(project.experienceProgram)).toEqual(
      expect.arrayContaining([expect.objectContaining({ id: 'visual-1', assetId: 'moon' })])
    );
  });

  it('opens a saved project whose passage cue is a parked Feelings soundscape on its stand-in, and lowers it so', () => {
    const editor = legacyBlueprint({
      audioScoreAssignments: [{
        id: 'audio-1', sourceId: 'source-1', assetId: 'soundscape:faded-signal',
        lane: 'audio', fromCharacter: 12, toCharacter: 20,
        quoteStart: 'reflects', quoteEnd: 'reflects'
      }]
    });
    const saved = structuredClone(workshopEditorDataToProject(editor, { id: editor.id }));
    const cueOf = project => project.experienceProgram.tracks.find(track => track.kind === 'audio').clips[0].cue;
    cueOf(saved).soundscapeId = 'chase';

    const project = validateWorkshopProject(saved);
    expect(cueOf(project)).toEqual({ kind: 'soundscape', soundscapeId: 'night-drive', fadeMs: 700 });
    expect(audioAssignmentsFromProgram(project.experienceProgram)[0].assetId).toBe('soundscape:night-drive');
    const session = new Session(workshopProjectToSessionConfig(project));
    expect(session.audioProgram.segments.map(segment => segment.cue.soundscapeId).filter(Boolean)).toContain('night-drive');
    expect(JSON.stringify(session.audioProgram)).not.toContain('chase');

    // An offered id is left as it is.
    cueOf(saved).soundscapeId = 'faded-signal';
    expect(cueOf(validateWorkshopProject(saved)).soundscapeId).toBe('faded-signal');
  });

  it('round-trips passage audio independently from the project atmosphere default', () => {
    const editor = legacyBlueprint({
      audioScoreAssignments: [{
        id: 'audio-1', sourceId: 'source-1', assetId: 'soundscape:faded-signal',
        lane: 'audio', fromCharacter: 12, toCharacter: 20,
        quoteStart: 'reflects', quoteEnd: 'reflects'
      }]
    });
    const project = workshopEditorDataToProject(editor, { id: editor.id });
    expect(project.defaults.audio.soundscape).toBe('aurora');
    expect(project.experienceProgram.tracks.find(track => track.kind === 'audio').clips[0].cue)
      .toEqual({ kind: 'soundscape', soundscapeId: 'faded-signal', fadeMs: 700 });
    expect(audioAssignmentsFromProgram(project.experienceProgram)[0]).toMatchObject({
      id: 'audio-1', assetId: 'soundscape:faded-signal', lane: 'audio'
    });
    expect(workshopProjectToSessionConfig(project).audioScoreAssignments).toHaveLength(1);
  });

  it('restores deterministic editor references for collection and procedural cues', () => {
    const base = migrateWorkshopBlueprint(legacyBlueprint());
    const program = JSON.parse(JSON.stringify(base.experienceProgram));
    const visual = program.tracks.find(track => track.kind === 'visual');
    visual.clips = [
      {
        id: 'collection-clip',
        anchor: {
          sourceIds: ['source-1'], fromCharacter: 0, toCharacter: 5,
          quoteStart: 'Still', quoteEnd: 'Still'
        },
        cue: { kind: 'sourced', collections: ['aic-oldmasters'] }
      },
      {
        id: 'procedural-clip',
        anchor: {
          sourceIds: ['source-1'], fromCharacter: 12, toCharacter: 20,
          quoteStart: 'reflects', quoteEnd: 'reflects'
        },
        cue: { kind: 'procedural', collections: ['klee'] }
      }
    ];
    const project = validateWorkshopProject({ ...base, assets: [], experienceProgram: program });

    expect(workshopProjectToSessionConfig(project).visualScoreAssignments).toEqual([
      expect.objectContaining({ id: 'collection-clip', assetId: 'collection:aic-oldmasters' }),
      expect.objectContaining({ id: 'procedural-clip', assetId: 'procedural:klee' })
    ]);
  });

  it('refuses drift, duplicate identities, unknown schemas, and unsafe prototype keys', () => {
    expect(() => migrateWorkshopBlueprint(legacyBlueprint({
      sources: [{ ...legacyBlueprint().sources[0], data: 'Changed edition.' }]
    }))).toThrow(/fingerprint|matches/i);

    expect(() => migrateWorkshopBlueprint(legacyBlueprint({
      sequenceVisualAssets: [
        legacyBlueprint().sequenceVisualAssets[0],
        legacyBlueprint().sequenceVisualAssets[0]
      ]
    }))).toThrow(expect.objectContaining({ code: 'WORKSHOP_PROJECT_DUPLICATE_ASSET' }));

    expect(() => validateWorkshopProject({ schema: 'wrong' }))
      .toThrow(WorkshopProjectError);

    const polluted = legacyBlueprint({
      provenance: JSON.parse('{"safe":"yes","__proto__":{"polluted":true}}')
    });
    const project = migrateWorkshopBlueprint(polluted);
    expect(project.provenance.safe).toBe('yes');
    expect(Object.hasOwn(project.provenance, '__proto__')).toBe(false);
    expect({}.polluted).toBeUndefined();
  });

  it('refuses canonical clips whose local project image is missing', () => {
    const project = migrateWorkshopBlueprint(legacyBlueprint());

    expect(() => validateWorkshopProject({ ...project, assets: [] }))
      .toThrow(expect.objectContaining({ code: 'VISUAL_SCORE_ASSET_NOT_FOUND' }));
  });

  it('persists a personal focal by project asset id without a transient blob URL', () => {
    const project = workshopEditorDataToProject(legacyBlueprint({
      visualConfig: {
        visualMode: 'focals',
        focals: {
          type: 'personal', personalAssetId: 'moon',
          personalImage: 'blob:http://localhost/transient'
        }
      },
      visualScoreAssignments: []
    }), { id: 'personal-focal' });

    expect(project.defaults.visual).toMatchObject({
      surface: 'focal',
      config: {
        focals: { type: 'personal', personalAssetId: 'moon', personalImage: null }
      }
    });
  });

  it('refuses a pre-baked experience program with same-lane overlaps', () => {
    const project = migrateWorkshopBlueprint(legacyBlueprint());
    const program = JSON.parse(JSON.stringify(project.experienceProgram));
    const visual = program.tracks.find(track => track.kind === 'visual');
    visual.clips.push({
      id: 'visual-overlap',
      anchor: {
        sourceIds: ['source-1'],
        fromCharacter: 0,
        toCharacter: 11,
        quoteStart: 'Still water',
        quoteEnd: 'Still water'
      },
      cue: { kind: 'sourced', collections: ['sequence-asset:moon'] }
    });

    expect(() => validateWorkshopProject({ ...project, experienceProgram: program }))
      .toThrow(expect.objectContaining({ code: 'PROGRAM_LANE_OVERLAP' }));
  });
});
