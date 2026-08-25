import { describe, expect, it } from 'vitest';
import { EXPERIENCE_PROGRAM_SCHEMA } from './experience-program.js';
import { exportCuratorContext } from './curator-context.js';
import { BOUNDARY_SOURCE_PREFIX } from './journey-compiler.js';
import {
  assertProgramWithinContext,
  ExperienceProgramIoError,
  importExperienceProgram,
  parseExperienceProgramJson,
  PROGRAM_IO_MAX_JSON_BYTES,
  serializeExperienceProgram,
  withVisualSurfaceForProgram,
  workshopProjectFromImportedProgram
} from './experience-program-io.js';
import { WORKSHOP_PROJECT_SCHEMA } from './workshop-project.js';

const IMAGE = 'data:image/png;base64,cHJvamVjdA==';

function baseProgram(overrides = {}) {
  return {
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'proposed-score',
    authority: 'user',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: [{
          id: 'm1',
          anchor: { sourceIds: ['src-a'] },
          data: { index: 0, title: 'One' }
        }]
      },
      {
        id: 'visual-main',
        kind: 'visual',
        clips: [{
          id: 'v1',
          anchor: {
            sourceIds: ['src-a'],
            fromCharacter: 0,
            toCharacter: 11,
            quoteStart: 'Still water',
            quoteEnd: 'Still water'
          },
          cue: { kind: 'procedural', collections: ['klee'] }
        }],
        fallback: { kind: 'still' }
      },
      {
        id: 'audio-bed',
        kind: 'audio',
        clips: [{
          id: 'a1',
          anchor: { sourceIds: ['src-a'] },
          cue: { kind: 'soundscape', soundscapeId: 'aurora', gain: 0.4 }
        }],
        fallback: { kind: 'silence', fadeMs: 500 }
      }
    ],
    metadata: { thesis: 'test' },
    ...overrides
  };
}

describe('experience-program-io', () => {
  it('round-trips JSON and lands imports as proposed', () => {
    const program = importExperienceProgram(baseProgram());
    expect(program.authority).toBe('proposed');
    expect(program.editable).toBe(true);
    expect(program.metadata.kind).toBe('live-curator-import');

    const text = serializeExperienceProgram(program);
    const again = parseExperienceProgramJson(text);
    expect(again.id).toBe(program.id);
    expect(again.authority).toBe('proposed');
  });

  it('refuses published programs at the doorway', () => {
    expect(() => importExperienceProgram(baseProgram({
      authority: 'published',
      editable: false
    }))).toThrow(expect.objectContaining({ code: 'PROGRAM_IO_PUBLISHED_REFUSED' }));
  });

  it('refuses smuggled URIs in cues', () => {
    const value = baseProgram();
    value.tracks[1].clips[0].cue = {
      kind: 'sourced',
      collections: ['https://evil.example/image.png']
    };
    expect(() => importExperienceProgram(value))
      .toThrow(expect.objectContaining({ code: 'PROGRAM_IO_URI_REFUSED' }));
  });

  it('refuses same-lane cross-coordinate overlap on import', () => {
    const value = baseProgram();
    value.tracks[1].clips = [
      {
        id: 'by-char',
        anchor: {
          sourceIds: ['src-a'],
          fromCharacter: 0,
          toCharacter: 11,
          quoteStart: 'Still water',
          quoteEnd: 'Still water'
        },
        cue: { kind: 'procedural', collections: ['klee'] }
      },
      {
        id: 'by-prog',
        anchor: {
          sourceIds: ['src-a'],
          fromProgress: 0,
          toProgress: 1
        },
        cue: { kind: 'procedural', collections: ['turrell'] }
      }
    ];
    expect(() => importExperienceProgram(value))
      .toThrow(expect.objectContaining({ code: 'PROGRAM_LANE_OVERLAP' }));
  });

  it('assertProgramWithinContext refuses unknown collections', () => {
    const context = exportCuratorContext({
      id: 'ctx',
      sources: [{ id: 'src-a', data: 'Still water' }]
    });
    const program = importExperienceProgram(baseProgram());
    expect(() => assertProgramWithinContext(program, context)).not.toThrow();

    const foreign = importExperienceProgram(baseProgram({
      tracks: [
        baseProgram().tracks[0],
        {
          id: 'visual-main',
          kind: 'visual',
          clips: [{
            id: 'v1',
            anchor: { sourceIds: ['src-a'] },
            cue: { kind: 'sourced', collections: ['not-a-real-collection'] }
          }],
          fallback: { kind: 'still' }
        }
      ]
    }));
    expect(() => assertProgramWithinContext(foreign, context))
      .toThrow(expect.objectContaining({ code: 'PROGRAM_IO_UNKNOWN_COLLECTION' }));
  });

  it('refuses journey-boundary prefix smuggled onto movement/visual without a transition', () => {
    const context = exportCuratorContext({
      id: 'ctx',
      sources: [{ id: 'src-a', data: 'Still water' }]
    });
    const smuggled = `${BOUNDARY_SOURCE_PREFIX}anything-i-want`;
    // Movement cannot own the smuggled id while also keeping src-a for neighbors;
    // name it only on visual — knownAnchors won't include it → program validate
    // fails first. Stronger case: movement owns the boundary-prefixed id.
    const value = baseProgram({
      tracks: [
        {
          id: 'movements',
          kind: 'movement',
          clips: [{
            id: 'm1',
            anchor: { sourceIds: [smuggled] },
            data: { index: 0, title: 'One' }
          }]
        },
        {
          id: 'visual-main',
          kind: 'visual',
          clips: [{
            id: 'v1',
            anchor: { sourceIds: [smuggled] },
            cue: { kind: 'procedural', collections: ['klee'] }
          }],
          fallback: { kind: 'still' }
        }
      ]
    });
    const program = importExperienceProgram(value);
    expect(() => assertProgramWithinContext(program, context))
      .toThrow(expect.objectContaining({
        code: 'PROGRAM_IO_UNKNOWN_SOURCE',
        details: expect.objectContaining({ sourceId: smuggled })
      }));
  });

  it('allows declared transition boundary sources without listing them in context', () => {
    const context = exportCuratorContext({
      id: 'ctx',
      sources: [{ id: 'src-a', data: 'Still water' }, { id: 'src-b', data: 'Steel rain' }]
    });
    const boundary = `${BOUNDARY_SOURCE_PREFIX}descent`;
    const program = importExperienceProgram({
      schema: EXPERIENCE_PROGRAM_SCHEMA,
      id: 'with-boundary',
      authority: 'user',
      editable: true,
      tracks: [
        {
          id: 'movements',
          kind: 'movement',
          clips: [
            { id: 'heaven', anchor: { sourceIds: ['src-a'] }, data: { index: 0, title: 'A' } },
            { id: 'steel', anchor: { sourceIds: ['src-b'] }, data: { index: 1, title: 'B' } }
          ]
        },
        {
          id: 'transitions',
          kind: 'transition',
          clips: [{
            id: 'descent',
            anchor: {
              sourceIds: [boundary],
              afterSourceId: 'src-a',
              beforeSourceId: 'src-b'
            },
            data: { fromMovementId: 'heaven', toMovementId: 'steel' },
            durationMs: 1800
          }]
        },
        {
          id: 'visual-main',
          kind: 'visual',
          clips: [
            {
              id: 'v-move',
              anchor: { sourceIds: ['src-a'] },
              cue: { kind: 'procedural', collections: ['klee'] }
            },
            {
              id: 'v-boundary',
              anchor: { sourceIds: [boundary] },
              cue: { kind: 'still' }
            }
          ],
          fallback: { kind: 'still' }
        }
      ]
    });
    expect(() => assertProgramWithinContext(program, context)).not.toThrow();
  });

  it('forwards context through workshopProjectFromImportedProgram', () => {
    const context = exportCuratorContext({
      id: 'ctx',
      sources: [{ id: 'src-a', data: 'Still water' }]
    });
    expect(() => workshopProjectFromImportedProgram({
      program: baseProgram({
        tracks: [
          baseProgram().tracks[0],
          {
            id: 'visual-main',
            kind: 'visual',
            clips: [{
              id: 'v1',
              anchor: { sourceIds: ['src-a'] },
              cue: { kind: 'sourced', collections: ['not-a-real-collection'] }
            }],
            fallback: { kind: 'still' }
          }
        ]
      }),
      sources: [{
        id: 'src-a',
        name: 'Alpha',
        providerId: 'local',
        type: 'text/plain',
        data: 'Still water reflects the moon.'
      }],
      assets: [],
      id: 'import-ctx',
      context
    })).toThrow(expect.objectContaining({ code: 'PROGRAM_IO_UNKNOWN_COLLECTION' }));
  });

  it('wraps an import into a workshop project when assets match', () => {
    const program = importExperienceProgram(baseProgram({
      tracks: [
        baseProgram().tracks[0],
        {
          id: 'visual-main',
          kind: 'visual',
          clips: [{
            id: 'v1',
            anchor: {
              sourceIds: ['src-a'],
              fromCharacter: 0,
              toCharacter: 11,
              quoteStart: 'Still water',
              quoteEnd: 'Still water'
            },
            cue: { kind: 'sourced', collections: ['sequence-asset:moon'] }
          }],
          fallback: { kind: 'still' }
        }
      ]
    }));
    const project = workshopProjectFromImportedProgram({
      program,
      sources: [{
        id: 'src-a',
        name: 'Alpha',
        providerId: 'local',
        type: 'text/plain',
        data: 'Still water reflects the moon.'
      }],
      assets: [{ id: 'moon', uri: IMAGE, name: 'Moon' }],
      id: 'import-1',
      title: 'Imported'
    });
    expect(project.schema).toBe(WORKSHOP_PROJECT_SCHEMA);
    expect(project.experienceProgram.authority).toBe('proposed');
    expect(project.provenance.kind).toBe('live-curator-import');
  });

  it('refuses workshop wrap when a sequence-asset is missing', () => {
    const program = importExperienceProgram(baseProgram({
      tracks: [
        baseProgram().tracks[0],
        {
          id: 'visual-main',
          kind: 'visual',
          clips: [{
            id: 'v1',
            anchor: { sourceIds: ['src-a'] },
            cue: { kind: 'sourced', collections: ['sequence-asset:missing'] }
          }],
          fallback: { kind: 'still' }
        }
      ]
    }));
    expect(() => workshopProjectFromImportedProgram({
      program,
      sources: [{
        id: 'src-a',
        name: 'Alpha',
        providerId: 'local',
        type: 'text/plain',
        data: 'Still water reflects the moon.'
      }],
      assets: [],
      id: 'import-missing'
    })).toThrow();
  });

  it('defaults missing wordFill on an Astronomy × Fractal visual surface to a Fractal pick', () => {
    const defaults = withVisualSurfaceForProgram(baseProgram(), {
      visual: {
        config: {
          interlocution: {
            sourced: ['sci-astronomy'],
            procedural: ['fractal']
          }
        }
      }
    });
    expect(defaults.visual.config.interlocution.wordFill).toEqual({
      mode: 'pick',
      border: 'cream',
      sourceFamily: 'procedural',
      procedural: ['fractal'],
      sourced: []
    });
    expect(defaults.visual.config.interlocution.presentation).toBe('continuous');

    const declared = withVisualSurfaceForProgram(baseProgram(), {
      visual: {
        config: {
          interlocution: {
            sourced: ['sci-astronomy'],
            procedural: ['fractal'],
            wordFill: { mode: 'same' }
          }
        }
      }
    });
    expect(declared.visual.config.interlocution.wordFill).toEqual({ mode: 'same', border: 'cream' });
  });

  it('refuses invalid JSON', () => {
    expect(() => parseExperienceProgramJson('{'))
      .toThrow(ExperienceProgramIoError);
  });

  it('refuses oversized JSON before parse', () => {
    const huge = `{"${'a'.repeat(PROGRAM_IO_MAX_JSON_BYTES)}"}`;
    expect(huge.length).toBeGreaterThan(PROGRAM_IO_MAX_JSON_BYTES);
    expect(() => parseExperienceProgramJson(huge))
      .toThrow(expect.objectContaining({ code: 'PROGRAM_IO_TOO_LARGE' }));
  });
});
