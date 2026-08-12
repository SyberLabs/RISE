import { describe, expect, it } from 'vitest';
import {
  assignVisualSpan,
  compileVisualScoreProgram,
  createSequenceVisualAsset,
  eraseVisualSpan,
  validateSequenceAssetReferences,
  validateVisualScoreLane,
  VisualScoreLaneError
} from './visual-score-lane.js';
import { createEditorAsset } from './editor-asset.js';

const IMAGE = 'data:image/png;base64,AAAA';
const source = {
  id: 'source-1',
  name: 'Source One',
  text: 'Before the first selected phrase and after the final selected phrase.'
};
const asset = createSequenceVisualAsset({
  id: 'asset-1', uri: IMAGE, name: 'Green field', color: '#7fd4a4'
});

const paint = (from, to, assignments = [], overlap = 'reject', id = 'visual-1') =>
  assignVisualSpan({
    assignments,
    source,
    assetId: asset.id,
    assignmentId: id,
    fromCharacter: from,
    toCharacter: to,
    overlap
  });

describe('visual score lane', () => {
  it('authors quote-fingerprinted character spans and erases by stable id', () => {
    const from = source.text.indexOf('the first');
    const to = source.text.indexOf(' and after');
    const assignments = paint(from, to);

    expect(assignments[0]).toMatchObject({
      id: 'visual-1',
      sourceId: 'source-1',
      assetId: 'asset-1',
      fromCharacter: from,
      toCharacter: to,
      quoteStart: 'the first selected phrase',
      quoteEnd: 'the first selected phrase'
    });
    expect(eraseVisualSpan(assignments, 'visual-1')).toEqual([]);
  });

  it('refuses overlaps by default and replaces all conflicts only when asked', () => {
    const first = paint(7, 25);
    expect(() => paint(20, 40, first, 'reject', 'visual-2'))
      .toThrow(expect.objectContaining({
        code: 'VISUAL_SCORE_OVERLAP',
        details: expect.objectContaining({ conflicts: ['visual-1'] })
      }));

    const replaced = paint(20, 40, first, 'replace', 'visual-2');
    expect(replaced.map(item => item.id)).toEqual(['visual-2']);
  });

  it('allows adjacent half-open assignments without a false overlap', () => {
    const first = paint(7, 25);
    const adjacent = paint(25, 40, first, 'reject', 'visual-2');
    expect(adjacent).toHaveLength(2);
  });

  it('compiles the relationship, not editor colour, into an Experience Program', () => {
    const assignments = paint(7, 25);
    const program = compileVisualScoreProgram({
      programId: 'workshop-score-1',
      sources: [source],
      assets: [asset],
      assignments
    });

    expect(program.tracks[1].clips[0]).toMatchObject({
      id: 'visual-1',
      cue: { kind: 'sourced', collections: ['sequence-asset:asset-1'] }
    });
    expect(JSON.stringify(program)).not.toContain(asset.color);
    expect(validateSequenceAssetReferences(program, [asset])).toBe(true);
    expect(() => validateSequenceAssetReferences(program, [])).toThrow(expect.objectContaining({
      code: 'VISUAL_SCORE_ASSET_NOT_FOUND'
    }));
  });

  it('compiles collection and procedural editor assets to their canonical cue kinds', () => {
    const collection = createEditorAsset({
      id: 'collection:aic-oldmasters', lane: 'visual', kind: 'sourced-collection',
      name: 'Old Masters', capability: 'both',
      editor: { color: '#d7a7ff', preview: { kind: 'sample', ref: 'aic-oldmasters' } },
      provenance: { provider: 'Art Institute of Chicago' },
      cueTemplate: { kind: 'sourced', collections: ['aic-oldmasters'] }
    });
    const procedural = createEditorAsset({
      id: 'procedural:klee', lane: 'visual', kind: 'procedural',
      name: 'Klee Lines', capability: 'both',
      editor: { color: '#f0bf72', preview: { kind: 'generator', ref: 'klee' } },
      provenance: { provider: 'RISE Visual Cortex' },
      cueTemplate: { kind: 'procedural', collections: ['klee'] }
    });
    const first = paint(7, 25, [], 'reject', 'collection-clip').map(item => ({
      ...item, assetId: collection.id
    }));
    const assignments = paint(30, 45, first, 'reject', 'procedural-clip').map(item =>
      item.id === 'procedural-clip' ? { ...item, assetId: procedural.id } : item);
    const program = compileVisualScoreProgram({
      programId: 'mixed-score', sources: [source], assets: [collection, procedural], assignments
    });

    expect(program.tracks[1].clips.map(clip => clip.cue)).toEqual([
      { kind: 'sourced', collections: ['aic-oldmasters'] },
      { kind: 'procedural', collections: ['klee'] }
    ]);
  });

  it('validates durable personal focal references independently of their field asset', () => {
    const program = {
      tracks: [{
        kind: 'visual', clips: [{
          id: 'personal-focal-clip',
          cue: {
            kind: 'field', renderer: 'focal',
            config: { type: 'personal', personalAssetId: asset.id }
          }
        }]
      }]
    };
    expect(validateSequenceAssetReferences(program, [asset])).toBe(true);
    expect(() => validateSequenceAssetReferences(program, [])).toThrow(expect.objectContaining({
      code: 'VISUAL_SCORE_ASSET_NOT_FOUND'
    }));
  });

  it('compiles a configured reading field as a passage cue over a field fallback', () => {
    const genesis = createEditorAsset({
      id: 'surface:genesis', lane: 'visual', kind: 'project-surface',
      name: 'Genesis', capability: 'both',
      editor: { color: '#7fd4a4', preview: { kind: 'surface', ref: 'genesis' } },
      cueTemplate: { kind: 'field', renderer: 'genesis', config: { preset: 'harmonic' } }
    });
    const assignments = paint(7, 25).map(item => ({ ...item, assetId: genesis.id }));
    const fallback = {
      kind: 'field', renderer: 'attractor', config: { system: 'thomas', palette: 'gold' }
    };
    const program = compileVisualScoreProgram({
      programId: 'field-score', sources: [source], assets: [genesis],
      assignments, visualFallback: fallback
    });

    expect(program.tracks[1].clips[0].cue).toEqual(genesis.cueTemplate);
    expect(program.tracks[1].fallback).toEqual(fallback);
  });

  it('snapshots a procedural passage style independently from its registry default', () => {
    const klee = createEditorAsset({
      id: 'procedural:klee', lane: 'visual', kind: 'procedural',
      name: 'Klee Lines', capability: 'both',
      editor: { color: '#7fd4a4', preview: { kind: 'generator', ref: 'klee' } },
      cueTemplate: { kind: 'procedural', collections: ['klee'], config: { preset: 'random' } }
    });
    const assignments = paint(7, 25).map(item => ({
      ...item, assetId: klee.id,
      cue: { kind: 'procedural', collections: ['klee'], config: { preset: 'harmonic' } }
    }));
    const program = compileVisualScoreProgram({
      programId: 'klee-style-score', sources: [source], assets: [klee], assignments
    });
    expect(program.tracks[1].clips[0].cue).toEqual({
      kind: 'procedural', collections: ['klee'], config: { preset: 'harmonic' }
    });
  });

  it('refuses a restored lane whose source edition or overlap changed', () => {
    const assignments = paint(7, 25);
    expect(() => validateVisualScoreLane({
      sources: [{ ...source, text: `Changed ${source.text}` }],
      assets: [asset],
      assignments
    })).toThrow(/fingerprint|matches/i);

    expect(() => validateVisualScoreLane({
      sources: [source],
      assets: [asset],
      assignments: [assignments[0], { ...assignments[0], id: 'visual-2' }]
    })).toThrow(expect.objectContaining({ code: 'VISUAL_SCORE_OVERLAP' }));
  });

  it('exposes typed authoring failures', () => {
    expect(() => paint(10, 10)).toThrow(VisualScoreLaneError);
    expect(() => paint(25, 40, paint(7, 25), 'reject', 'visual-1'))
      .toThrow(expect.objectContaining({ code: 'VISUAL_SCORE_DUPLICATE_ASSIGNMENT' }));
  });

  it('preserves bounded provenance on project-owned image snapshots', () => {
    const snapshot = createSequenceVisualAsset({
      id: 'asset-shared', uri: IMAGE, name: 'Shared image', color: '#7fd4a4',
      provenance: JSON.parse('{"origin":"saved-sequence","snapshotOf":"shared:moon","__proto__":{"polluted":true}}')
    });

    expect(snapshot.provenance).toEqual({
      origin: 'saved-sequence', snapshotOf: 'shared:moon'
    });
    expect(Object.hasOwn(snapshot.provenance, '__proto__')).toBe(false);
    expect(Object.isFrozen(snapshot.provenance)).toBe(true);
  });

  it('compiles a durable MP4 as a first-class muted video cue', () => {
    const video = createSequenceVisualAsset({
      id: 'video-1', kind: 'video', name: 'Slow field', color: '#7fd4a4',
      storage: 'idb', mimeType: 'video/mp4', byteLength: 4096,
      durationMs: 12000, timeMode: 'loop', uri: 'blob:https://rise.test/video-1'
    });
    const program = compileVisualScoreProgram({
      programId: 'video-score', sources: [source], assets: [video],
      assignments: [{
        id: 'video-clip', sourceId: source.id, assetId: video.id,
        fromCharacter: 0, toCharacter: 6, quoteStart: 'Before', quoteEnd: 'Before'
      }]
    });

    expect(video).toMatchObject({
      kind: 'video', audioPolicy: 'muted', durationMs: 12000, storage: 'idb'
    });
    expect(program.tracks[1].clips[0].cue).toEqual({
      kind: 'video', assetId: 'video-1', timeMode: 'loop',
      audioPolicy: 'muted', reducedMotion: 'poster'
    });
    expect(validateSequenceAssetReferences(program, [video])).toBe(true);
    expect(() => validateSequenceAssetReferences(program, [{
      id: 'video-1', uri: IMAGE, name: 'Wrong kind'
    }])).toThrow(expect.objectContaining({ code: 'VISUAL_SCORE_ASSET_NOT_FOUND' }));
  });
});
