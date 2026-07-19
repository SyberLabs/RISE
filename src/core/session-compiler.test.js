import { describe, expect, it } from 'vitest';
import {
  compileSession,
  estimateCompiledDuration,
  normalizeProvenance,
  normalizeSessionConfig,
  normalizeVisualConfig,
  SESSION_LIMITS
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
