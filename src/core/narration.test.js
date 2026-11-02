import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_PROGRAM_SCHEMA,
  lowerExperienceProgram,
  validateExperienceProgram
} from './experience-program.js';
import {
  NarrationError,
  duckGainAt,
  validateNarrationCue
} from './narration.js';
import {
  assignNarrationSpan,
  createNarrationScoreAsset
} from './narration-score-lane.js';
import {
  AGENT_OPERATION_SET_SCHEMA,
  applyAgentOperationSet
} from './agent-operations.js';
import { emptyWorkshopProject } from './workshop-project.js';
import { mixAudio, peakAmplitude } from './render/audio-mix.js';
import { encodeWav } from './render/wav.js';
import { captionsFromPlan } from './render/captions.js';

const SOURCE_ID = 'source-anna';
const SOURCE_TEXT = 'Happy families are all alike; every unhappy family is unhappy in its own way.';

function spokenProgram(cueOverrides = {}) {
  return validateExperienceProgram({
    schema: EXPERIENCE_PROGRAM_SCHEMA,
    id: 'spoken-score',
    authority: 'user',
    editable: true,
    tracks: [
      {
        id: 'movements',
        kind: 'movement',
        clips: [{
          id: 'm1',
          anchor: { sourceIds: [SOURCE_ID] },
          data: { index: 0, title: 'One' }
        }]
      },
      {
        id: 'audio-bed',
        kind: 'audio',
        fallback: { kind: 'soundscape', soundscapeId: 'aurora' },
        clips: [{
          id: 'bed-1',
          anchor: { sourceIds: [SOURCE_ID] },
          cue: { kind: 'soundscape', soundscapeId: 'aurora' }
        }]
      },
      {
        id: 'narration',
        kind: 'narration',
        clips: [{
          id: 'voice-1',
          anchor: {
            sourceIds: [SOURCE_ID],
            fromCharacter: 0,
            toCharacter: 15,
            quoteStart: 'Happy families',
            quoteEnd: 'Happy families'
          },
          cue: {
            kind: 'spoken',
            voiceId: 'af_heart',
            duck: { target: 'bed', floor: 0.2, downMs: 50, upMs: 50 },
            ...cueOverrides
          }
        }]
      }
    ]
  });
}

describe('narration lane contract', () => {
  it('accepts a spoken cue and refuses to wear a soundscape or duck a swell', () => {
    expect(validateNarrationCue({ kind: 'spoken', voiceId: 'af_heart' }).kind).toBe('spoken');
    expect(() => validateNarrationCue({ kind: 'soundscape', soundscapeId: 'aurora' }))
      .toThrow(expect.objectContaining({ code: 'NARRATION_KIND' }));
    expect(() => validateNarrationCue({
      kind: 'spoken',
      voiceId: 'af_heart',
      duck: { target: 'swell', floor: 0.2 }
    })).toThrow(expect.objectContaining({ code: 'NARRATION_DUCK_TARGET' }));
    expect(() => createNarrationScoreAsset({ id: 'soundscape:aurora' }))
      .toThrow(expect.objectContaining({ code: 'NARRATION_SCORE_NOT_VOICE' }));
  });

  it('keeps pronunciation as a review table and will not rewrite the source', () => {
    expect(validateNarrationCue({
      kind: 'spoken',
      voiceId: 'af_heart',
      pronunciations: [{ source: 'families', spoken: 'FAM-uh-leez' }]
    }).pronunciations).toHaveLength(1);
    expect(() => assignNarrationSpan({
      source: { id: SOURCE_ID, text: SOURCE_TEXT },
      assetId: 'af_heart',
      assignmentId: 'n1',
      fromCharacter: 0,
      toCharacter: 15,
      cue: {
        kind: 'spoken',
        voiceId: 'af_heart',
        pronunciations: [{ source: 'Cholmondeley', spoken: 'CHUM-lee' }]
      }
    })).toThrow(expect.objectContaining({ code: 'NARRATION_PRONUNCIATION' }));
  });

  it('lowers narration beside audio, not inside the bed lane', () => {
    const lowered = lowerExperienceProgram(spokenProgram());
    expect(lowered.narrationProgram.segments[0].cue.kind).toBe('spoken');
    expect(lowered.audioProgram.lanes.bed.segments[0].cue.kind).toBe('soundscape');
    expect(lowered.audioProgram.lanes.bed.segments.some(item => item.cue.kind === 'spoken'))
      .toBe(false);
  });
});

describe('narration mix and captions', () => {

  it('ducks the bed while speech is active and captions keep source coordinates', () => {
    const plan = {
      durationMs: 1000,
      audioRuns: [{
        cueId: 'bed',
        cueKind: 'audio:soundscape',
        cue: { kind: 'soundscape', soundscapeId: 'aurora' },
        fromMs: 0,
        toMs: 1000,
        fadeMs: 0,
        gain: 1
      }],
      narrationRuns: [{
        cueId: 'voice-1',
        cueKind: 'narration:spoken',
        cue: { kind: 'spoken', voiceId: 'af_heart', voiceAssetId: 'asset-voice-1' },
        fromMs: 0,
        toMs: 400,
        duck: { target: 'bed', floor: 0.1, downMs: 0, upMs: 0 },
        words: [{ text: 'Happy', fromCharacter: 0, toCharacter: 5, durationMs: 300 }],
        voiceId: 'af_heart',
        voiceAssetId: 'asset-voice-1'
      }],
      atoms: [{
        index: 0,
        startMs: 0,
        endMs: 400,
        text: 'Happy families',
        sourceId: SOURCE_ID,
        sourceCharacterStart: 0,
        sourceCharacterEnd: 15
      }]
    };
    const take = new Float32Array(Math.round(0.4 * 8_000)).fill(0.35);
    const mixed = mixAudio(plan, {
      sampleRate: 8_000,
      inventory: {
        bytesById: { 'asset-voice-1': encodeWav({ pcm: take, sampleRate: 8_000, channels: 1 }) }
      }
    });
    expect(duckGainAt(plan.narrationRuns[0], 200)).toBe(0.1);
    expect(peakAmplitude(mixed.pcm)).toBeGreaterThan(0.2);
    const captions = captionsFromPlan(plan);
    const spoken = captions.find(item => item.text === 'Happy');
    expect(spoken.sourceId).toBe(SOURCE_ID);
    expect(spoken.sourceCharacterStart).toBe(0);
    expect(spoken.sourceCharacterEnd).toBe(5);
    expect(spoken.text).toBe('Happy');
  });

  it('refuses spoken mix when the assigned voice bytes are missing', () => {
    const plan = {
      durationMs: 400,
      audioRuns: [{
        cueId: 'bed',
        cueKind: 'audio:silence',
        cue: { kind: 'silence' },
        fromMs: 0,
        toMs: 400,
        fadeMs: 0,
        gain: 1
      }],
      narrationRuns: [{
        cueId: 'voice-1',
        cueKind: 'narration:spoken',
        cue: { kind: 'spoken', voiceAssetId: 'asset-voice-1' },
        fromMs: 0,
        toMs: 400,
        voiceAssetId: 'asset-voice-1'
      }],
      atoms: [{
        index: 0,
        startMs: 0,
        endMs: 400,
        text: 'Happy families',
        sourceId: SOURCE_ID,
        sourceCharacterStart: 0,
        sourceCharacterEnd: 15
      }]
    };
    expect(() => mixAudio(plan, { sampleRate: 8_000 }))
      .toThrow(expect.objectContaining({ code: 'RENDER_AUDIO_MISSING' }));
  });
});

describe('agent narration operations', () => {
  it('assigns a spoken clip without touching atmosphere, and refuses a swell as a voice', () => {
    const project = emptyWorkshopProject({ id: 'project-memory' });
    const atmosphere = project.defaults.audio;
    const applied = applyAgentOperationSet({
      project,
      operationSet: {
        schema: AGENT_OPERATION_SET_SCHEMA,
        id: 'ops-voice-1',
        projectId: 'project-memory',
        baseRevision: 0,
        operations: [
          { op: 'add-source', id: 'op-source', sourceId: SOURCE_ID },
          {
            op: 'assign-narration',
            id: 'op-voice',
            assignmentId: 'voice-1',
            sourceId: SOURCE_ID,
            voiceId: 'af_heart',
            fromCharacter: 0,
            toCharacter: 15,
            duck: { target: 'bed', floor: 0.18 }
          }
        ]
      },
      resolvedSources: {
        [SOURCE_ID]: { id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }
      }
    });
    expect(applied.project.defaults.audio.soundscape).toBe(atmosphere.soundscape);
    expect(applied.project.defaults.audio.selectedSwellId).toBe(atmosphere.selectedSwellId);
    const narration = applied.project.experienceProgram.tracks.find(item => item.kind === 'narration');
    expect(narration.clips[0].cue.kind).toBe('spoken');
    expect(narration.clips[0].cue.voiceId).toBe('af_heart');
    expect(applied.project.experienceProgram.tracks.some(item =>
      item.kind === 'audio' && item.clips.some(clip => clip.cue.kind === 'spoken'))).toBe(false);

    expect(() => applyAgentOperationSet({
      project: applied.project,
      operationSet: {
        schema: AGENT_OPERATION_SET_SCHEMA,
        id: 'ops-voice-bad',
        projectId: 'project-memory',
        baseRevision: applied.project.revision,
        operations: [{
          op: 'assign-narration',
          id: 'op-swell',
          assignmentId: 'voice-2',
          sourceId: SOURCE_ID,
          assetId: 'swell:bell',
          fromCharacter: 16,
          toCharacter: 30
        }]
      },
      resolvedSources: {
        [SOURCE_ID]: { id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }
      }
    })).toThrow(expect.objectContaining({ code: 'NARRATION_SCORE_NOT_VOICE' }));
  });
});

describe('narration errors stay named', () => {
  it('throws NarrationError for an unknown spoken field', () => {
    expect(() => validateNarrationCue({
      kind: 'spoken',
      voiceId: 'af_heart',
      soundscapeId: 'aurora'
    })).toThrow(NarrationError);
  });
});
