import { describe, expect, it } from 'vitest';
import {
  assignAudioSpan,
  AudioScoreLaneError,
  compileWorkshopScoreProgram,
  eraseAudioSpan,
  validateAudioScoreLane
} from './audio-score-lane.js';
import { workshopAudioEditorAsset } from './workshop-audio.js';
import { compileSession } from './session-compiler.js';

const source = { id: 'source-1', name: 'Source', text: 'Alpha beta gamma delta epsilon.' };
const aurora = workshopAudioEditorAsset('soundscape:aurora');
const silence = workshopAudioEditorAsset('tone:silent');
const swell = {
  schema: 'rise.editor-asset.v1', id: 'swell:bell', lane: 'swell', kind: 'audio-swell',
  name: 'Bell', capability: 'both',
  editor: { color: '#67b9c7', preview: { kind: 'audio', ref: 'bell' } },
  provenance: {}, availability: { state: 'ready', reason: null },
  cueTemplate: { kind: 'swell', swellId: 'bell', fadeMs: 250 }
};

describe('Workshop audio score lane', () => {
  it('authors quote-fingerprinted audio spans and erases only the relationship', () => {
    const assigned = assignAudioSpan({
      source, assets: [aurora], assetId: aurora.id, assignmentId: 'bed-1',
      assignments: [], fromCharacter: 0, toCharacter: 10
    });
    expect(assigned[0]).toMatchObject({
      lane: 'audio', quoteStart: 'Alpha beta', quoteEnd: 'Alpha beta'
    });
    expect(eraseAudioSpan(assigned, 'bed-1')).toEqual([]);
  });

  it('rejects overlap inside a lane but permits a swell over a bed', () => {
    const beds = assignAudioSpan({
      source, assets: [aurora, silence, swell], assetId: aurora.id,
      assignmentId: 'bed-1', assignments: [], fromCharacter: 0, toCharacter: 16
    });
    expect(() => assignAudioSpan({
      source, assets: [aurora, silence, swell], assetId: silence.id,
      assignmentId: 'bed-2', assignments: beds, fromCharacter: 6, toCharacter: 22
    })).toThrow(expect.objectContaining({ code: 'AUDIO_SCORE_OVERLAP' }));
    const parallel = assignAudioSpan({
      source, assets: [aurora, silence, swell], assetId: swell.id,
      assignmentId: 'swell-1', assignments: beds, fromCharacter: 6, toCharacter: 22
    });
    expect(parallel.map(item => item.lane)).toEqual(['audio', 'swell']);
    expect(() => validateAudioScoreLane({ sources: [source], assets: [aurora, swell], assignments: parallel }))
      .not.toThrow();
  });

  it('replaces every conflicting clip as one deterministic result', () => {
    const first = assignAudioSpan({ source, assets: [aurora, silence], assetId: aurora.id,
      assignmentId: 'one', assignments: [], fromCharacter: 0, toCharacter: 10 });
    const replaced = assignAudioSpan({ source, assets: [aurora, silence], assetId: silence.id,
      assignmentId: 'two', assignments: first, fromCharacter: 0, toCharacter: 16, overlap: 'replace' });
    expect(replaced.map(item => item.id)).toEqual(['two']);
  });

  it('compiles bed and swell tracks independently with sync groups', () => {
    const bed = assignAudioSpan({ source, assets: [aurora, swell], assetId: aurora.id,
      assignmentId: 'bed-1', assignments: [], fromCharacter: 0, toCharacter: 16,
      syncGroup: 'opening' });
    const assignments = assignAudioSpan({ source, assets: [aurora, swell], assetId: swell.id,
      assignmentId: 'swell-1', assignments: bed, fromCharacter: 0, toCharacter: 16,
      syncGroup: 'opening' });
    const program = compileWorkshopScoreProgram({
      programId: 'workshop-audio', sources: [source], audioAssets: [aurora, swell],
      audioAssignments: assignments
    });
    expect(program.tracks.find(track => track.kind === 'audio').fallback).toEqual({ kind: 'hold', fadeMs: 500 });
    expect(program.tracks.find(track => track.kind === 'swell').clips[0].syncGroup).toBe('opening');
    expect(Object.isFrozen(program)).toBe(true);
  });

  it('carries exact audio ranges through Session lowering and atom membership', () => {
    const assignments = assignAudioSpan({ source, assets: [aurora], assetId: aurora.id,
      assignmentId: 'bed-1', assignments: [], fromCharacter: 0, toCharacter: 16 });
    const program = compileWorkshopScoreProgram({
      programId: 'workshop-runtime', sources: [source], audioAssets: [aurora],
      audioAssignments: assignments
    });
    const session = compileSession({
      title: 'Audio', sources: [{ id: source.id, name: source.name, data: source.text }],
      chunkMode: 'word', wpm: 200, curve: 'flat', experienceProgram: program
    });
    expect(session.audioProgram.lanes.bed.segments[0].match).toMatchObject({
      fromCharacter: 0, toCharacter: 16
    });
    expect(session.atoms.some(atom => atom.sourceSpanIds.includes('audio-bed:bed-1'))).toBe(true);
  });
});
