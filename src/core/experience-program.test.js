import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_PROGRAM_SCHEMA,
  ExperienceProgramValidationError,
  createExperienceProgram,
  lowerExperienceProgram,
  validateExperienceProgram
} from './experience-program.js';

const score = (overrides = {}) => ({
  schema: EXPERIENCE_PROGRAM_SCHEMA,
  id: 'journey-war',
  authority: 'published',
  editable: false,
  tracks: [
    {
      id: 'movements',
      kind: 'movement',
      clips: [
        { id: 'heaven', anchor: { sourceIds: ['milton'] }, data: { index: 0, title: 'Heaven' } },
        { id: 'steel', anchor: { sourceIds: ['junger'] }, data: { index: 1, title: 'Steel' } }
      ]
    },
    {
      id: 'transitions',
      kind: 'transition',
      clips: [{
        id: 'descent',
        anchor: {
          sourceIds: ['journey-boundary:descent'],
          afterSourceId: 'milton',
          beforeSourceId: 'junger'
        },
        data: { fromMovementId: 'heaven', toMovementId: 'steel' },
        durationMs: 1800,
        syncGroup: 'descent-1'
      }]
    },
    {
      id: 'visual-main',
      kind: 'visual',
      clips: [
        {
          id: 'heaven-visual',
          anchor: { sourceIds: ['milton'] },
          cue: { kind: 'procedural', collections: ['paradise-lost'], engines: ['flaming_sword'] }
        },
        {
          id: 'steel-visual',
          anchor: { sourceIds: ['junger'], fromProgress: 0.2, toProgress: 0.7 },
          cue: { kind: 'sourced', collections: ['journey-war-trench'] }
        }
      ],
      fallback: { kind: 'still' }
    },
    {
      id: 'audio-bed',
      kind: 'audio',
      clips: [{
        id: 'heaven-audio',
        anchor: { sourceIds: ['milton'] },
        cue: { kind: 'soundscape', soundscapeId: 'war-ordered-field', gain: 0.5 }
      }],
      fallback: { kind: 'silence', fadeMs: 500 }
    },
    {
      id: 'audio-events',
      kind: 'swell',
      clips: [{
        id: 'steel-swell',
        anchor: { sourceIds: ['junger'] },
        cue: { kind: 'swell', swellId: 'pressure-hit' }
      }]
    }
  ],
  metadata: { kind: 'journey', thesis: 'descent' },
  ...overrides
});

describe('rise.experience-program.v1', () => {
  it('returns a detached, immutable canonical score', () => {
    const input = score();
    const program = createExperienceProgram(input);

    expect(program).not.toBe(input);
    expect(program.schema).toBe(EXPERIENCE_PROGRAM_SCHEMA);
    expect(program.tracks.map(track => track.kind)).toEqual([
      'movement', 'transition', 'visual', 'audio', 'swell'
    ]);
    expect(Object.isFrozen(program)).toBe(true);
    expect(Object.isFrozen(program.tracks[2].clips[0].anchor)).toBe(true);
  });

  it('round-trips through JSON without changing the score', () => {
    const program = createExperienceProgram(score());
    expect(validateExperienceProgram(JSON.parse(JSON.stringify(program)))).toEqual(program);
  });

  it('lowers to the current runtime without making it a second authoring format', () => {
    const lowered = lowerExperienceProgram(score());

    expect(lowered.movementProgram.movements.map(movement => movement.id))
      .toEqual(['heaven', 'steel']);
    expect(lowered.movementProgram.boundaries[0]).toMatchObject({
      id: 'descent',
      sourceId: 'journey-boundary:descent',
      afterSourceId: 'milton',
      beforeSourceId: 'junger'
    });
    expect(lowered.visualProgram.segments[1].match).toEqual({
      sourceIds: ['junger'], fromProgress: 0.2, toProgress: 0.7
    });
    expect(lowered.audioProgram.segments.map(segment => segment.id))
      .toEqual(['heaven-audio', 'steel-swell']);
    expect(lowered.swellProgram.segments[0].cue)
      .toEqual({ kind: 'swell', swellId: 'pressure-hit' });
    expect(lowered.sourceBoundaries).toEqual([{
      id: 'descent',
      sourceId: 'journey-boundary:descent',
      afterSourceId: 'milton',
      beforeSourceId: 'junger',
      kind: 'movement',
      durationMs: 1800
    }]);
  });

  it.each([
    ['wrong schema', { schema: 'rise.experience-program.v99' }, 'PROGRAM_SCHEMA'],
    ['editable published score', { editable: true }, 'PROGRAM_AUTHORITY_EDITABLE'],
    ['read-only user score', { authority: 'user', editable: false }, 'PROGRAM_AUTHORITY_EDITABLE']
  ])('rejects %s', (_name, patch, code) => {
    expect(() => validateExperienceProgram(score(patch)))
      .toThrow(expect.objectContaining({ code }));
  });

  it('rejects unknown cue vocabulary instead of translating it to absence', () => {
    const value = score();
    value.tracks[2].clips[0].cue.kind = 'procedrual';
    expect(() => validateExperienceProgram(value)).toThrow(expect.objectContaining({
      name: 'ExperienceProgramValidationError',
      code: 'PROGRAM_VISUAL_KIND',
      path: '$.tracks[2].clips[0].cue.kind'
    }));
  });

  it('rejects unknown fields rather than dropping a likely misspelling', () => {
    const value = score();
    value.tracks[2].clips[0].synchGroup = 'descent-1';
    expect(() => validateExperienceProgram(value)).toThrow(expect.objectContaining({
      code: 'PROGRAM_UNKNOWN_FIELD',
      path: '$.tracks[2].clips[0].synchGroup'
    }));
  });

  it('rejects ambiguous movement ownership and dead clip anchors', () => {
    const duplicate = score();
    duplicate.tracks[0].clips[1].anchor.sourceIds = ['milton'];
    expect(() => validateExperienceProgram(duplicate)).toThrow(expect.objectContaining({
      code: 'PROGRAM_SOURCE_OWNERSHIP'
    }));

    const dead = score();
    dead.tracks[2].clips[0].anchor.sourceIds = ['missing-source'];
    expect(() => validateExperienceProgram(dead)).toThrow(expect.objectContaining({
      code: 'PROGRAM_UNKNOWN_SOURCE'
    }));
  });

  it('rejects overflow instead of truncating authored clips', () => {
    const value = score();
    const movementTrack = value.tracks[0];
    movementTrack.clips = Array.from({ length: 17 }, (_, index) => ({
      id: `m-${index}`,
      anchor: { sourceIds: [`p-${index}`] },
      data: { index, title: `Movement ${index}` }
    }));
    expect(() => validateExperienceProgram(value)).toThrow(expect.objectContaining({
      code: 'PROGRAM_TOO_MANY_CLIPS'
    }));
  });

  it('rejects incomplete and inverted source ranges', () => {
    const incomplete = score();
    incomplete.tracks[2].clips[0].anchor.fromProgress = 0.5;
    expect(() => validateExperienceProgram(incomplete)).toThrow(expect.objectContaining({
      code: 'PROGRAM_INCOMPLETE_RANGE'
    }));

    const inverted = score();
    inverted.tracks[2].clips[0].anchor = {
      sourceIds: ['milton'], fromProgress: 0.7, toProgress: 0.2
    };
    expect(() => validateExperienceProgram(inverted)).toThrow(expect.objectContaining({
      code: 'PROGRAM_INVERTED_RANGE'
    }));
  });

  it('validates authored character and token spans without mixing coordinate systems', () => {
    const character = score();
    character.tracks[2].clips[1].anchor = {
      sourceIds: ['junger'],
      fromCharacter: 10,
      toCharacter: 40,
      quoteStart: 'The opening',
      quoteEnd: 'the ending'
    };
    expect(validateExperienceProgram(character).tracks[2].clips[1].anchor)
      .toMatchObject({ fromCharacter: 10, toCharacter: 40 });

    const missingQuote = score();
    missingQuote.tracks[2].clips[1].anchor = {
      sourceIds: ['junger'], fromToken: 2, toToken: 8
    };
    expect(() => validateExperienceProgram(missingQuote)).toThrow(expect.objectContaining({
      code: 'PROGRAM_QUOTE_REQUIRED'
    }));

    const mixed = score();
    mixed.tracks[2].clips[1].anchor = {
      sourceIds: ['junger'],
      fromProgress: 0.2,
      toProgress: 0.7,
      fromCharacter: 10,
      toCharacter: 40,
      quoteStart: 'The opening',
      quoteEnd: 'the ending'
    };
    expect(() => validateExperienceProgram(mixed)).toThrow(expect.objectContaining({
      code: 'PROGRAM_AMBIGUOUS_RANGE'
    }));
  });

  it('rejects time values the runtime cannot preserve exactly', () => {
    const tooShort = score();
    tooShort.tracks[1].clips[0].durationMs = 199;
    expect(() => validateExperienceProgram(tooShort)).toThrow(expect.objectContaining({
      code: 'PROGRAM_INTEGER_OUT_OF_RANGE',
      path: '$.tracks[1].clips[0].durationMs'
    }));

    const fractionalFade = score();
    fractionalFade.tracks[3].fallback.fadeMs = 12.5;
    expect(() => validateExperienceProgram(fractionalFade)).toThrow(expect.objectContaining({
      code: 'PROGRAM_INTEGER_OUT_OF_RANGE',
      path: '$.tracks[3].fallback.fadeMs'
    }));
  });

  it('lowers overlapping beds and swells into independent runtime lanes', () => {
    const value = score();
    value.tracks[4].clips[0].anchor = { sourceIds: ['milton'] };
    value.tracks[3].clips[0].syncGroup = 'opening-audio';
    value.tracks[4].clips[0].syncGroup = 'opening-audio';
    const lowered = lowerExperienceProgram(value);
    expect(lowered.audioProgram.lanes.bed.segments[0]).toMatchObject({
      id: 'heaven-audio', syncGroup: 'opening-audio'
    });
    expect(lowered.audioProgram.lanes.swell.segments[0]).toMatchObject({
      id: 'steel-swell', syncGroup: 'opening-audio'
    });
  });

  it('exposes typed validation failures', () => {
    expect(() => validateExperienceProgram(null)).toThrow(ExperienceProgramValidationError);
  });
});
