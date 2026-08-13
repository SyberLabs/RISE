import { describe, expect, it } from 'vitest';
import {
  EXPERIENCE_PROGRAM_SCHEMA,
  lowerExperienceProgram,
  validateExperienceProgram
} from './experience-program.js';
import {
  NarrationError,
  duckGainAt,
  spokenCaptionText,
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
import {
  ACQUISITION_REQUEST_SCHEMA,
  ACQUISITION_VERDICT_SCHEMA,
  admitAcquisitionCandidate,
  fetchAcquisitionCandidate,
  inspectAcquisition
} from './acquisition.js';
import { createVoiceProvider } from './acquisition-providers.js';
import { mixAudio, peakAmplitude } from './render/audio-mix.js';
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

function wavBytes() {
  const bytes = new Uint8Array(64);
  bytes.set([0x52, 0x49, 0x46, 0x46]);
  bytes[8] = 0x57;
  bytes[9] = 0x41;
  bytes[10] = 0x56;
  bytes[11] = 0x45;
  return bytes;
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
    const cue = validateNarrationCue({
      kind: 'spoken',
      voiceId: 'af_heart',
      pronunciations: [{ source: 'families', spoken: 'FAM-uh-leez' }]
    });
    expect(spokenCaptionText('Happy families', cue.pronunciations)).toBe('Happy families');
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

describe('narration admission, mix, and captions', () => {
  it('admits spoken WAV through the voice gate, not as generic audio', async () => {
    const req = {
      schema: ACQUISITION_REQUEST_SCHEMA,
      id: 'take-1',
      kind: 'voice',
      query: 'spoken take',
      sourcePreference: ['project-media']
    };
    const options = {
      providers: [createVoiceProvider()],
      bytes: wavBytes(),
      mimeType: 'audio/wav',
      durationMs: 1200
    };
    const [candidate] = await inspectAcquisition(req, options);
    const fetched = await fetchAcquisitionCandidate(candidate, req, options);
    const admitted = await admitAcquisitionCandidate({
      ...fetched,
      verdict: {
        schema: ACQUISITION_VERDICT_SCHEMA,
        candidateId: fetched.candidate.id,
        decision: 'admit',
        actor: 'human',
        authority: 'user',
        decidedAt: '2026-08-13T21:30:00.000Z'
      },
      projectId: 'project-memory',
      assetId: 'asset-voice-1',
      now: '2026-08-13T21:30:00.000Z'
    });
    expect(admitted.asset.kind).toBe('audio');
    expect(admitted.asset.durationMs).toBe(1200);
    expect(admitted.asset.provenance.origin).toBe('upload');
  });

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
        cue: { kind: 'spoken', voiceId: 'af_heart' },
        fromMs: 0,
        toMs: 400,
        duck: { target: 'bed', floor: 0.1, downMs: 0, upMs: 0 },
        words: [{ text: 'Happy', fromCharacter: 0, toCharacter: 5, durationMs: 300 }]
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
    const mixed = mixAudio(plan);
    expect(duckGainAt(plan.narrationRuns[0], 200)).toBe(0.1);
    expect(peakAmplitude(mixed.pcm)).toBeGreaterThan(0);
    const captions = captionsFromPlan(plan);
    const spoken = captions.find(item => item.text === 'Happy');
    expect(spoken.sourceId).toBe(SOURCE_ID);
    expect(spoken.sourceCharacterStart).toBe(0);
    expect(spoken.sourceCharacterEnd).toBe(5);
    expect(spoken.text).toBe('Happy');
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
