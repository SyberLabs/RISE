import { describe, expect, it } from 'vitest';
import {
  compileSession,
  estimateCompiledDuration,
  normalizeProvenance,
  normalizeSessionConfig,
  normalizeVisualConfig
} from './session-compiler.js';

describe('session compiler', () => {
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
      title: 'Atrium fixture',
      sources: [{
        id: 'pass-plato-cave',
        name: 'Plato, Republic — Cave',
        data: 'A verified packaged passage.',
        provenance: {
          kind: 'atrium-passage',
          sourceId: 'src-plato-republic',
          canonicalLocator: 'Republic 514a–517a',
          passageId: 'pass-plato-cave'
        }
      }],
      origin: { view: 'atrium', data: { domain: 'philosophy', selectedId: 'ph-thinker-plato' } },
      provenance: { kind: 'atrium-journey', journeyId: 'seq-ph-plato-ascent' }
    });

    expect(session.sources[0].provenance).toMatchObject({
      sourceId: 'src-plato-republic',
      passageId: 'pass-plato-cave'
    });
    expect(session.atoms.filter(atom => atom.content).every(atom => atom.sourceId === 'pass-plato-cave')).toBe(true);
    expect(session.origin).toMatchObject({ view: 'atrium', data: { selectedId: 'ph-thinker-plato' } });
    expect(session.provenance).toEqual({ kind: 'atrium-journey', journeyId: 'seq-ph-plato-ascent' });
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

  it('normalizes the orthogonal render language without changing source selection', () => {
    const ascii = normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: { renderLanguage: 'ascii', procedural: ['klee'], sourced: [] }
    });
    const invalid = normalizeVisualConfig({
      visualMode: 'interlocution',
      interlocution: { renderLanguage: 'ansi', procedural: ['klee'], sourced: [] }
    });

    expect(ascii.interlocution.renderLanguage).toBe('ascii');
    expect(ascii.interlocution.procedural).toEqual(['klee']);
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
});
