import { describe, expect, it } from 'vitest';
import {
  compileSession,
  estimateCompiledDuration,
  normalizeProvenance,
  normalizeSessionConfig,
  normalizeVisualConfig,
  SESSION_LIMITS
} from './session-compiler.js';
import { compileVisualScoreProgram } from './visual-score-lane.js';
import { createEditorAsset } from './editor-asset.js';
import { SEQUENCE_CAPABILITIES } from './sequence-capabilities.js';

describe('session compiler', () => {
  it.each([
    ['instant', false],
    ['instant', true],
    ['progressive', false],
    ['progressive', true]
  ])('keeps %s text arrival independent when Spoken=%s', (revealMode, spoken) => {
    const session = compileSession({
      text: 'One short phrase.',
      chunkMode: 'phrase',
      revealMode,
      capabilities: spoken ? [SEQUENCE_CAPABILITIES.RECITATION_AUDIO] : [],
      recitation: { enabled: spoken }
    });
    expect(session.revealMode).toBe(revealMode);
    expect(session.recitation.enabled).toBe(spoken);
  });

  it('refuses Recitation when the loaded sequence did not receive that capability', () => {
    const session = compileSession({
      text: 'One short phrase.',
      chunkMode: 'phrase',
      recitation: { enabled: true }
    });

    expect(session.capabilities).toEqual([]);
    expect(session.recitation).toEqual({ enabled: false });
  });

  it('carries stable sequence assets through the canonical visual-score program', () => {
    const source = { id: 'alpha', name: 'Alpha', text: 'Still water.' };
    const asset = {
      id: 'moon',
      uri: 'data:image/png;base64,bW9vbg==',
      name: 'Moon',
      color: '#7fd4a4'
    };
    const experienceProgram = compileVisualScoreProgram({
      programId: 'score-program',
      sources: [source],
      assets: [asset],
      assignments: [{
        id: 'visual-1',
        sourceId: 'alpha',
        assetId: 'moon',
        fromCharacter: 0,
        toCharacter: 5,
        quoteStart: 'Still',
        quoteEnd: 'Still'
      }]
    });

    const session = compileSession({
      sources: [{ id: 'alpha', name: 'Alpha', data: source.text }],
      sequenceVisualAssets: [asset],
      experienceProgram
    });

    expect(session.sequenceVisualAssets).toEqual([{
      ...asset,
      storage: 'inline'
    }]);
    expect(session.visualProgram.segments[0].cue.collections)
      .toEqual(['sequence-asset:moon']);
    expect(() => compileSession({
      sources: [{ id: 'alpha', name: 'Alpha', data: source.text }],
      sequenceVisualAssets: [],
      experienceProgram
    })).toThrow(/missing sequence image moon/i);
  });

  it('carries durable MP4 metadata and excludes it from the legacy image pool', () => {
    const source = { id: 'video-source', name: 'Video source', text: 'Moving water.' };
    const asset = {
      id: 'video-1', kind: 'video', name: 'Moving water', color: '#7fd4a4',
      storage: 'idb', mimeType: 'video/mp4', byteLength: 2048,
      durationMs: 9000, timeMode: 'loop', audioPolicy: 'muted',
      uri: 'blob:https://rise.test/video-1'
    };
    const experienceProgram = compileVisualScoreProgram({
      programId: 'video-program', sources: [source], assets: [asset],
      assignments: [{
        id: 'video-clip', sourceId: source.id, assetId: asset.id,
        fromCharacter: 0, toCharacter: 6, quoteStart: 'Moving', quoteEnd: 'Moving'
      }]
    });
    const session = compileSession({
      sources: [{ id: source.id, name: source.name, data: source.text }],
      sequenceVisualAssets: [asset], experienceProgram
    });

    expect(session.sequenceVisualAssets[0]).toMatchObject({
      id: 'video-1', kind: 'video', mimeType: 'video/mp4', audioPolicy: 'muted'
    });
    expect(session.customVisuals).toEqual([]);
    expect(session.visualProgram.segments[0].cue).toMatchObject({
      kind: 'video', assetId: 'video-1'
    });
  });

  it('lowers mixed collection and procedural spans under every scored presentation', () => {
    const source = { id: 'mixed', name: 'Mixed', text: 'Klee and masters.' };
    const assets = [
      createEditorAsset({
        id: 'procedural:klee', lane: 'visual', kind: 'procedural', name: 'Klee',
        capability: 'both', editor: { color: '#7fd4a4', preview: { kind: 'generator', ref: 'klee' } },
        cueTemplate: { kind: 'procedural', collections: ['klee'] }
      }),
      createEditorAsset({
        id: 'collection:aic-oldmasters', lane: 'visual', kind: 'sourced-collection',
        name: 'Old Masters', capability: 'both',
        editor: { color: '#d7a7ff', preview: { kind: 'sample', ref: 'aic-oldmasters' } },
        cueTemplate: { kind: 'sourced', collections: ['aic-oldmasters'] }
      })
    ];
    const experienceProgram = compileVisualScoreProgram({
      programId: 'mixed-score', sources: [source], assets,
      assignments: [
        {
          id: 'klee-clip', sourceId: 'mixed', assetId: 'procedural:klee',
          fromCharacter: 0, toCharacter: 4, quoteStart: 'Klee', quoteEnd: 'Klee'
        },
        {
          id: 'masters-clip', sourceId: 'mixed', assetId: 'collection:aic-oldmasters',
          fromCharacter: 9, toCharacter: 16, quoteStart: 'masters', quoteEnd: 'masters'
        }
      ]
    });

    for (const presentation of ['full-frame', 'behind-stream', 'continuous']) {
      const session = compileSession({
        sources: [{ id: source.id, name: source.name, data: source.text }],
        experienceProgram,
        visualConfig: { visualMode: 'interlocution', interlocution: { presentation } }
      });
      expect(session.visualConfig.interlocution.presentation).toBe(presentation);
      expect(session.visualProgram.segments.map(segment => segment.cue)).toEqual([
        { kind: 'procedural', collections: ['klee'], config: { preset: 'random' } },
        { kind: 'sourced', collections: ['aic-oldmasters'] }
      ]);
    }
  });

  it('preserves source provenance across a multi-source session', () => {
    const session = compileSession({
      title: 'Synthesis',
      sources: [
        { id: 'alpha', name: 'Alpha', data: 'one two' },
        { id: 'beta', name: 'Beta', data: 'three four' }
      ],
      wpm: 220,
      chunkMode: 'word'
    });

    expect(session.sources).toHaveLength(2);
    expect(session.chunkMode).toBe('word');
    expect(session.atoms.filter(atom => atom.sourceId === 'alpha')).toHaveLength(2);
    expect(session.atoms.filter(atom => atom.sourceId === 'beta')).toHaveLength(2);
    expect(session.atoms.find(atom => atom.tags.includes('source-break'))?.timingLocked).toBe(true);
  });

  it('retains bounded edition, passage, and launch provenance', () => {
    const session = compileSession({
      title: 'Chapel fixture',
      sources: [{
        id: 'pass-numbers-2',
        name: 'Numbers 2',
        data: 'A verified packaged passage.',
        provenance: {
          kind: 'chapel-book',
          sourceId: 'src-numbers',
          canonicalLocator: 'Numbers 2',
          passageId: 'pass-numbers-2'
        }
      }],
      origin: { view: 'chapel', data: { bookId: 'numbers', chapter: 2 } },
      provenance: { kind: 'chapel-book', bookId: 'numbers', chapter: 2 }
    });

    expect(session.sources[0].provenance).toMatchObject({
      sourceId: 'src-numbers',
      passageId: 'pass-numbers-2'
    });
    expect(session.atoms.filter(atom => atom.content).every(atom => atom.sourceId === 'pass-numbers-2')).toBe(true);
    expect(session.origin).toMatchObject({ view: 'chapel', data: { bookId: 'numbers', chapter: 2 } });
    expect(session.provenance).toEqual({ kind: 'chapel-book', bookId: 'numbers', chapter: 2 });
  });

  it('bounds provenance and removes prototype-bearing keys', () => {
    const value = JSON.parse('{"safe":"ok","__proto__":{"polluted":true},"deep":{"one":{"two":{"three":{"four":"drop"}}}}}');
    const normalized = normalizeProvenance(value);
    expect(normalized.safe).toBe('ok');
    expect(Object.hasOwn(normalized, '__proto__')).toBe(false);
    expect(normalized.deep.one.two.three).toBeUndefined();
    expect({}.polluted).toBeUndefined();
  });

  it('uses the identical pipeline for estimates and playback', () => {
    const config = {
      text: 'A sentence, with deliberate punctuation.\n\n[PAUSE]\n\nThen return.',
      wpm: 180,
      chunkMode: 'phrase',
      curve: 'induction'
    };

    expect(estimateCompiledDuration(config)).toBe(compileSession(config).totalDuration);
  });

  it('normalizes invalid session controls', () => {
    expect(normalizeSessionConfig({ wpm: 0, chunkMode: 'tokens', curve: 'spiral' }))
      .toMatchObject({ wpm: 50, chunkMode: 'word', curve: 'flat' });
  });

  it('bounds visual execution settings and rejects removed presets', () => {
    expect(normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: { frequency: 5, duration: 5000, kleePreset: 'spiral' }
    })).toMatchObject({
      visualMode: 'interlocution',
      interlocution: { frequency: 1, duration: 2000, kleePreset: 'random' }
    });

    expect(normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: { duration: 0 }
    }).interlocution.duration).toBe(150);
  });

  it('validates the attractor block so an unknown id cannot reach the field', () => {
    const good = normalizeVisualConfig({
      visualMode: 'attractor',
      attractor: { system: 'thomas', palette: 'gold', form: 'kaleido' }
    }).attractor;
    expect(good).toMatchObject({ system: 'thomas', palette: 'gold', form: 'kaleido' });

    // Saved or imported garbage degrades to the documented defaults
    const bad = normalizeVisualConfig({
      visualMode: 'attractor',
      attractor: { system: 'lorenz', palette: 'chartreuse', form: 'spiral' }
    }).attractor;
    expect(bad).toMatchObject({ system: 'aizawa', palette: 'white', form: 'mirror' });

    const missing = normalizeVisualConfig({ visualMode: 'attractor' }).attractor;
    expect(missing).toMatchObject({ system: 'aizawa', palette: 'white', form: 'mirror' });
  });

  it('defaults behind-stream presence to a full beat, explicit values untouched', () => {
    expect(normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: { presentation: 'behind-stream' }
    }).interlocution.duration).toBe(1000);

    expect(normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: { presentation: 'behind-stream', duration: 450 }
    }).interlocution.duration).toBe(450);

    expect(normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: {}
    }).interlocution.duration).toBe(200);
  });

  it('normalizes Gallery cadence independently from flash frequency and presence', () => {
    const config = normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: {
        presentation: 'continuous',
        galleryCadence: 4,
        frequency: 0.37,
        duration: 700
      }
    }).interlocution;

    expect(config.galleryCadence).toBe(1);
    expect(config.frequency).toBe(0.37);
    expect(config.duration).toBe(700);
  });

  it('retires ASCII to native without disturbing source selection', () => {
    // ASCII was retired 2026-08-06 — a cool experiment that did not earn
    // its place. It is gone from every surface where it could be CHOSEN
    // (the Visual panel and the Workshop), so a stored program that still
    // names it must compile to native rather than request a surface no
    // control can reach. What the language was orthogonal TO is unchanged:
    // the source selection still survives normalisation untouched.
    const stored = normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: { renderLanguage: 'ascii', procedural: ['klee'], sourced: [] }
    });
    const invalid = normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: { renderLanguage: 'ansi', procedural: ['klee'], sourced: [] }
    });

    expect(stored.interlocution.renderLanguage).toBe('native');
    expect(stored.interlocution.procedural).toEqual(['klee']);
    expect(invalid.interlocution.renderLanguage).toBe('native');
  });

  it('normalizes a bounded Global Pool selection without treating empty as all', () => {
    const selected = normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'personal',
        sourced: ['global-pool'],
        globalPool: { mode: 'selected', assetIds: ['one', 'one', 7, 'two'] }
      }
    });
    const legacy = normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: { sourceFamily: 'personal', sourced: ['global-pool'] }
    });

    expect(selected.interlocution.globalPool).toEqual({ mode: 'selected', assetIds: ['one', 'two'] });
    expect(legacy.interlocution.globalPool).toEqual({ mode: 'all', assetIds: [] });
  });

  it('rejects empty and excessively large sources', () => {
    expect(() => compileSession({ text: '   ' })).toThrow(/non-empty text source/);
    expect(() => compileSession({ text: 'x'.repeat(2_000_001) })).toThrow(RangeError);
  });

  it('rejects aggregate source text above the session budget in playback and estimates', () => {
    const config = {
      sources: [
        { id: 'a', name: 'A', data: 'a'.repeat(1_000_001) },
        { id: 'b', name: 'B', data: 'b'.repeat(1_000_001) }
      ]
    };

    expect(() => compileSession(config)).toThrowError(TypeError);
    expect(() => compileSession(config)).toThrow(/combined character limit/);
    expect(() => estimateCompiledDuration(config)).toThrow(/combined character limit/);
  });

  it('rejects sessions whose post-chunk atom count exceeds the playback budget', () => {
    const text = Array.from({ length: SESSION_LIMITS.maxAtoms + 1 }, () => 'a').join(' ');

    let error;
    try {
      compileSession({ text, chunkMode: 'word' });
    } catch (caught) {
      error = caught;
    }
    expect(error).toBeInstanceOf(TypeError);
    expect(error.message).toMatch(/reading atoms/);
  });

  it('enforces exclusive visual source families and migrates intentional legacy mixes', () => {
    const procedural = normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: {
        sourceFamily: 'procedural',
        procedural: ['klee'],
        sourced: ['aic-oldmasters']
      }
    });
    expect(procedural.interlocution).toMatchObject({
      sourceFamily: 'procedural',
      procedural: ['klee'],
      sourced: []
    });

    const legacyBlend = normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: {
        procedural: ['harmonograph'],
        sourced: ['solar']
      }
    });
    expect(legacyBlend.interlocution).toMatchObject({
      sourceFamily: 'blend',
      procedural: ['harmonograph'],
      sourced: ['solar']
    });
  });

  it('defaults missing wordFill on Astronomy × Fractal to a Fractal pick', () => {
    const missing = normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: {
        sourced: ['sci-astronomy'],
        procedural: ['fractal']
      }
    }).interlocution;
    expect(missing.wordFill).toEqual({
      mode: 'pick',
      sourceFamily: 'procedural',
      procedural: ['fractal'],
      sourced: []
    });

    const declared = normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: {
        sourced: ['sci-astronomy'],
        procedural: ['fractal'],
        wordFill: { mode: 'same' }
      }
    }).interlocution;
    expect(declared.wordFill).toEqual({ mode: 'same' });
  });
});

describe('Temporal contract: effective WPM invariants', () => {
    // The red-team audit measured 139-153 delivered WPM at a requested
    // 220 (a hidden 1.4375x slowdown plus multiplicative punctuation).
    // These invariants pin the honest contract: nominal WPM is the
    // delivered WPM, within texture tolerance.

    const words = (n, word = 'lumen') => Array.from({ length: n }, () => word).join(' ');

    function effectiveWpm(text, options) {
        const session = compileSession({
            title: 'invariant',
            sources: [{ id: 's', name: 'S', raw: text }],
            ...options
        });
        const totalWords = text.split(/\s+/).filter(Boolean).length;
        const totalMs = session.atoms.reduce((sum, atom) => sum + atom.duration, 0);
        return (totalWords / totalMs) * 60_000;
    }

    it('word mode delivers nominal WPM on unpunctuated text (±8%)', () => {
        const wpm = effectiveWpm(words(300), { wpm: 220, chunkMode: 'word', curve: 'flat' });
        expect(wpm).toBeGreaterThan(220 * 0.92);
        expect(wpm).toBeLessThan(220 * 1.08);
    });

    it('sentence mode delivers nominal WPM on unpunctuated text (±8%)', () => {
        const wpm = effectiveWpm(words(96), { wpm: 240, chunkMode: 'sentence', curve: 'flat' });
        expect(wpm).toBeGreaterThan(240 * 0.92);
        expect(wpm).toBeLessThan(240 * 1.08);
    });

    it('punctuation adds bounded TERMINAL time, never multiplies the chunk', () => {
        const base = 60_000 / 220;
        const plain = compileSession({
            title: 't', wpm: 220, chunkMode: 'sentence', curve: 'flat',
            sources: [{ id: 's', name: 'S', raw: words(12) }]
        }).atoms[0].duration;
        const period = compileSession({
            title: 't', wpm: 220, chunkMode: 'sentence', curve: 'flat',
            sources: [{ id: 's', name: 'S', raw: words(12) + '.' }]
        }).atoms[0].duration;

        // A period adds one half-beat — not 50% of the whole sentence
        expect(period - plain).toBeGreaterThan(base * 0.4);
        expect(period - plain).toBeLessThan(base * 0.6);
    });

    it('long chunks are subdivided into readable atoms, never ceiling-compressed', () => {
        const session = compileSession({
            title: 't', wpm: 220, chunkMode: 'sentence', curve: 'flat',
            sources: [{ id: 's', name: 'S', raw: words(220) }]
        });
        const textAtoms = session.atoms.filter(a => a.content);
        expect(textAtoms.length).toBeGreaterThan(10);
        for (const atom of textAtoms) {
            expect(atom.content.split(/\s+/).length).toBeLessThanOrEqual(16);
            expect(atom.duration).toBeLessThan(10_000);
        }
        // And the whole passage still reads at nominal speed
        const wpm = effectiveWpm(words(220), { wpm: 220, chunkMode: 'sentence', curve: 'flat' });
        expect(wpm).toBeGreaterThan(220 * 0.92);
        expect(wpm).toBeLessThan(220 * 1.08);
    });

    it('token conservation: the smart split never duplicates connectives', () => {
        const source = 'one two three four five six and seven eight nine ten eleven twelve';
        const session = compileSession({
            title: 't', wpm: 220, chunkMode: 'phrase', curve: 'flat',
            sources: [{ id: 's', name: 'S', raw: source }]
        });
        const emitted = session.atoms
            .filter(a => a.content)
            .map(a => a.content)
            .join(' ')
            .split(/\s+/);
        expect(emitted).toEqual(source.split(/\s+/));
    });

    it('authored markers keep their contract ([PAUSE] = 2000ms)', () => {
        const session = compileSession({
            title: 't', wpm: 220, chunkMode: 'word', curve: 'flat',
            sources: [{ id: 's', name: 'S', raw: 'alpha\n\n[PAUSE]\n\nbeta' }]
        });
        const pause = session.atoms.find(a => a.tags.includes('PAUSE'));
        expect(pause).toBeDefined();
        expect(pause.duration).toBe(2000);
    });
});
