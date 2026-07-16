import { describe, expect, it } from 'vitest';
import { compileSession, estimateCompiledDuration, normalizeSessionConfig, normalizeVisualConfig } from './session-compiler.js';

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
      interlocution: { frequency: 1, duration: 200, kleePreset: 'random' }
    });
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
