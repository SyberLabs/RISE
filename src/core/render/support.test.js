import { describe, expect, it } from 'vitest';
import {
  PROGRAM_AUDIO_KINDS,
  PROGRAM_READING_KINDS,
  PROGRAM_TRACK_KINDS,
  PROGRAM_VISUAL_FIELD_RENDERERS,
  PROGRAM_VISUAL_KINDS,
  EXPERIENCE_PROGRAM_SCHEMA,
  validateExperienceProgram
} from '../experience-program.js';
import { PROCEDURAL_PATTERN_IDS } from '../visual-registry.js';
import {
  RENDER_SUPPORT,
  RENDER_SUPPORT_KINDS,
  classifyCue,
  classifyProgramCues,
  requiredRenderCueKinds,
  renderSupportFor
} from './support.js';

function programWithVisualCue(cue, extraClips = []) {
  return validateExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'support-probe',
    authority: 'user',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: [{ id: 'm1', anchor: { sourceIds: ['src'] }, data: { index: 0, title: 'One' } }]
      },
      {
        id: 'visual-main',
        kind: 'visual',
        clips: [
          {
            id: 'v1',
            anchor: { sourceIds: ['src'] },
            cue
          },
          ...extraClips
        ],
        fallback: { kind: 'still' }
      }
    ]
  });
}

describe('render-support registry', () => {
  it('declares every canonical cue kind native, degraded, or unsupported', () => {
    const required = [...requiredRenderCueKinds()].sort();
    const declared = [...RENDER_SUPPORT_KINDS].sort();
    expect(declared).toEqual(required);
    for (const cueKind of required) {
      const row = renderSupportFor(cueKind);
      expect(row, cueKind).toMatchObject({
        cueKind,
        interactive: true,
        render: expect.stringMatching(/^(native|degraded|unsupported)$/)
      });
      if (row.render !== 'native') {
        expect(row.reason, cueKind).toBeTruthy();
      }
    }
  });

  it('covers the experience-program vocabularies without a second list of kinds', () => {
    expect(PROGRAM_TRACK_KINDS).toEqual([
      'movement', 'transition', 'visual', 'audio', 'swell', 'reading', 'narration', 'thread'
    ]);
    expect(PROGRAM_VISUAL_KINDS).toEqual([
      'still', 'focal', 'field', 'sourced', 'procedural', 'video', 'scene'
    ]);
    // A generated scene runs in a worker on the display's clock; a film has no such clock yet.
    expect(RENDER_SUPPORT['visual:scene']).toMatchObject({ render: 'unsupported' });
    expect(classifyCue({ kind: 'scene', sceneId: 'v', code: 'export default 1' })).toBe('visual:scene');
    expect(PROGRAM_VISUAL_FIELD_RENDERERS).toEqual(['focal', 'attractor', 'genesis', 'living-flame']);
    // Living Flame exports honestly as a deterministic still, never omitted.
    expect(RENDER_SUPPORT['visual:field:living-flame']).toMatchObject({
      render: 'degraded', degradation: 'deterministic-still'
    });
    expect(RENDER_SUPPORT['visual:field:living-flame'].reason).toMatch(/live GPU motion is not exported/);
    expect(PROGRAM_AUDIO_KINDS).toEqual(['hold', 'silence', 'soundscape', 'tone']);
    expect(PROGRAM_READING_KINDS).toEqual(['pace']);
    for (const renderer of PROGRAM_VISUAL_FIELD_RENDERERS) {
      expect(RENDER_SUPPORT[`visual:field:${renderer}`]).toBeTruthy();
    }
    for (const id of PROCEDURAL_PATTERN_IDS) {
      expect(RENDER_SUPPORT[`visual:procedural:${id}`]).toBeTruthy();
    }
    const coveredTracks = new Set(
      RENDER_SUPPORT_KINDS.map((cueKind) => {
        const [family, name] = cueKind.split(':');
        return family === 'structural' ? name : family;
      })
    );
    expect([...coveredTracks].sort()).toEqual([...PROGRAM_TRACK_KINDS].sort());
  });

  it('classifies the vertical-slice families as native', () => {
    expect(classifyCue({ kind: 'still' }, 'visual')).toBe('visual:still');
    expect(classifyCue({
      kind: 'sourced',
      collections: ['sequence-asset:asset-rain-window']
    }, 'visual')).toBe('visual:sourced:project-image');
    expect(classifyCue({ kind: 'procedural', collections: ['klee'] }, 'visual'))
      .toBe('visual:procedural:klee');
    expect(classifyCue({
      kind: 'video',
      assetId: 'asset-water',
      timeMode: 'cue'
    }, 'visual')).toBe('visual:video');
    expect(classifyCue({ kind: 'soundscape', soundscapeId: 'aurora' }, 'audio'))
      .toBe('audio:soundscape');
    expect(classifyCue({ kind: 'pace', wpm: 160 }, 'reading')).toBe('reading:pace');
    expect(renderSupportFor('visual:procedural:klee').render).toBe('native');
    expect(renderSupportFor('visual:procedural:turrell').render).toBe('native');
    expect(renderSupportFor('visual:procedural:fractal').render).toBe('native');
    expect(renderSupportFor('visual:procedural:neural').render).toBe('native');
    expect(renderSupportFor('visual:procedural:rockgarden').render).toBe('native');
    expect(renderSupportFor('visual:procedural:harmonograph').render).toBe('native');
    expect(renderSupportFor('visual:procedural:ostensoria').render).toBe('native');
    expect(renderSupportFor('visual:procedural:apparitio').render).toBe('native');
    expect(renderSupportFor('visual:video').render).toBe('native');
  });

  it('classifies live shuffle, fields, and work engines as native Chamber painters', () => {
    expect(classifyCue({
      kind: 'field', renderer: 'genesis', config: {}
    }, 'visual')).toBe('visual:field:genesis');
    expect(renderSupportFor('visual:field:genesis').render).toBe('native');
    expect(renderSupportFor('visual:field:attractor').render).toBe('native');
    expect(renderSupportFor('visual:focal').render).toBe('native');
    expect(classifyCue({
      kind: 'procedural',
      collections: ['paradise-lost'],
      engines: ['flaming_sword']
    }, 'visual')).toBe('visual:procedural:work-engine');
    expect(classifyCue({
      kind: 'procedural',
      collections: ['storm-of-steel']
    }, 'visual')).toBe('visual:procedural:work-engine');
    expect(renderSupportFor('visual:procedural:work-engine').render).toBe('native');
    expect(classifyCue({
      kind: 'procedural',
      collections: ['klee', 'turrell']
    }, 'visual')).toBe('visual:procedural:shuffled');
    expect(renderSupportFor('visual:procedural:shuffled').render).toBe('native');
    expect(classifyCue({
      kind: 'sourced',
      collections: ['aic-oldmasters']
    }, 'visual')).toBe('visual:sourced:collection');
    expect(renderSupportFor('visual:sourced:collection').render).toBe('native');
    expect(classifyCue({ kind: 'swell', swellId: 'pressure-hit' }, 'swell'))
      .toBe('swell:swell');
    expect(renderSupportFor('swell:swell').render).toBe('unsupported');
  });

  it('walks fallbacks as well as clips so an unsupported default still refuses', () => {
    const program = programWithVisualCue({ kind: 'still' });
    const classified = classifyProgramCues(program);
    const kinds = classified.map(item => item.cueKind);
    expect(kinds).toContain('structural:movement');
    expect(kinds).toContain('visual:still');
    expect(classified.some(item => item.role === 'fallback' && item.cueKind === 'visual:still'))
      .toBe(true);
  });

  it('declares a thread not painted, so a glossed reading still exports and says so', () => {
    const program = validateExperienceProgram({
      schema: EXPERIENCE_PROGRAM_SCHEMA,
      id: 'thread-probe',
      authority: 'user',
      editable: true,
      tracks: [
        {
          id: 'movements',
          kind: 'movement',
          clips: [{ id: 'm1', anchor: { sourceIds: ['src'] }, data: { index: 0, title: 'One' } }]
        },
        {
          id: 'threads',
          kind: 'thread',
          clips: [
            {
              id: 'g1',
              anchor: { sourceIds: ['src'], quoteStart: 'The first', quoteEnd: 'first division' },
              cue: { kind: 'gloss', text: 'The opening.' }
            },
            {
              id: 'e1',
              anchor: { sourceIds: ['src'], quoteStart: 'It says', quoteEnd: 'plainly' },
              cue: { kind: 'echo', of: { sourceId: 'src', quoteStart: 'The first', quoteEnd: 'first division' } }
            }
          ]
        }
      ]
    });
    const kinds = classifyProgramCues(program).map(item => item.cueKind);
    expect(kinds).toEqual(expect.arrayContaining(['thread:gloss', 'thread:echo']));
    expect(kinds.filter(kind => kind.startsWith('undeclared'))).toEqual([]);
    for (const kind of ['thread:gloss', 'thread:echo']) {
      expect(renderSupportFor(kind)).toMatchObject({ render: 'degraded', degradation: 'not-painted' });
    }
  });
});
