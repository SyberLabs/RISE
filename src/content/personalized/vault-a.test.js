import { describe, expect, it, vi } from 'vitest';
import { VAULT_A_SEQUENCES, VAULT_A_ARCHETYPE } from './vault-a.js';
import { compileSession } from '../../core/session-compiler.js';
import { MUSEUM_CATEGORIES } from '../../sources/visual/museum.js';
import { Vault } from '../../components/Vault.js';

/**
 * A vault presented to an author as a reading of HER OWN WORK carries a
 * standard ordinary curation does not: every passage must be traceable
 * to a real publication. These tests are the mechanical half of that
 * promise — they cannot verify the words are hers, but they can refuse
 * a sequence that does not even claim a source.
 */

// Papers verified against OpenAlex author A5035014734 and their
// open-access copies of record. A sequence may only cite one of these.
const VERIFIED_SOURCES = new Set([
  'Algorithmic Songwriting with ALYSIA',
  'The Humble Creative Machine',
  'SOVIA: Sonification of Visual Interactive Art',
  'Interactive Augmented Reality for Dance'
]);

describe('Vault A provenance', () => {
  it('every sequence cites a verified Ackerman paper', () => {
    for (const seq of VAULT_A_SEQUENCES) {
      expect(seq.source, `${seq.id} has no source block`).toBeDefined();
      expect(VERIFIED_SOURCES, `${seq.id} cites an unverified paper`)
        .toContain(seq.source.title);
      expect(seq.source.authors).toMatch(/Ackerman/);
      expect(seq.source.venue).toBeTruthy();
      expect(Number.isInteger(seq.source.year)).toBe(true);
    }
  });

  it('the archetype lists exactly the sequences that exist', () => {
    const ids = VAULT_A_SEQUENCES.map(s => s.id);
    expect([...VAULT_A_ARCHETYPE.sequences].sort()).toEqual([...ids].sort());
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('Vault A sensory design', () => {
  it('alternates two soundscapes evenly, with pure tones resting', () => {
    // A soundscape is a finished mix — exclusive beds
    const counts = { 'faded-signal': 0, aurora: 0 };
    for (const seq of VAULT_A_SEQUENCES) {
      expect(counts, `${seq.id} uses an unexpected soundscape`)
        .toHaveProperty(seq.soundscape);
      counts[seq.soundscape]++;
      expect(seq.audioPreset, seq.id).toBe('silent');
    }
    // Half and half — the suite breathes between two rooms
    expect(counts['faded-signal']).toBe(VAULT_A_SEQUENCES.length / 2);
    expect(counts.aurora).toBe(VAULT_A_SEQUENCES.length / 2);
    expect(VAULT_A_ARCHETYPE.config.audioPreset).toBe('silent');
  });

  it('reads in Phrase chunking throughout — her stated preference', () => {
    for (const seq of VAULT_A_SEQUENCES) {
      expect(seq.chunkMode, seq.id).toBe('phrase');
    }
    expect(VAULT_A_ARCHETYPE.config.chunkMode).toBe('phrase');
  });

  it('gives every sequence a distinct visual identity', () => {
    // The vault should read as a suite, not a repetition
    const signatures = VAULT_A_SEQUENCES.map(seq => {
      const v = seq.visualConfig;
      if (v.visualMode !== 'interlocution') return v.visualMode;
      const il = v.interlocution;
      return [
        'interlocution',
        [...(il.procedural || [])].sort().join('+'),
        [...(il.sourced || [])].sort().join('+'),
        il.presentation || 'full-frame'
      ].join(':');
    });
    expect(new Set(signatures).size).toBe(VAULT_A_SEQUENCES.length);

    // The spec calls for these surfaces specifically
    const modes = VAULT_A_SEQUENCES.map(s => s.visualConfig.visualMode);
    expect(modes).toContain('genesis');
    expect(modes).toContain('attractor');

    const behindStream = VAULT_A_SEQUENCES.filter(
      s => s.visualConfig.interlocution?.presentation === 'behind-stream'
    );
    expect(behindStream.length).toBeGreaterThanOrEqual(3);
    // Behind-stream imagery needs dwell time to register beneath the text
    for (const seq of behindStream) {
      expect(seq.visualConfig.interlocution.duration, seq.id)
        .toBeGreaterThanOrEqual(1000);
      expect(seq.visualConfig.interlocution.streamGlass, seq.id).toBe(true);
    }
  });

  it('references only collection ids the providers actually define', () => {
    // A silently-dropped category would leave a Blend with no imagery
    for (const seq of VAULT_A_SEQUENCES) {
      for (const id of seq.visualConfig.interlocution?.sourced || []) {
        expect(id.startsWith('aic-'), `${seq.id}: ${id}`).toBe(true);
        expect(MUSEUM_CATEGORIES, `${seq.id} cites unknown collection ${id}`)
          .toHaveProperty(id.slice(4));
      }
    }
  });
});

describe('Vault A launch path', () => {
  it('forwards each sequence its own pace, chunking, soundscape, and visuals', () => {
    // The archetype is the house style; the sequence is the specific
    // room. A merge that drops the sequence's own fields would silently
    // give every reading the same identity.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onLaunchArchetype = vi.fn();
    const vault = new Vault(container, {
      personalizedVault: 'vault-a',
      onLaunchArchetype
    });

    for (const seq of VAULT_A_SEQUENCES) {
      onLaunchArchetype.mockClear();
      vault.launchPersonalizedSequence(seq.id);

      expect(onLaunchArchetype, seq.id).toHaveBeenCalledTimes(1);
      const { config } = onLaunchArchetype.mock.calls[0][0];
      expect(config.wpm, seq.id).toBe(seq.wpm);
      expect(config.curve, seq.id).toBe(seq.curve);
      expect(config.chunkMode, seq.id).toBe('phrase');
      expect(config.soundscape, seq.id).toBe(seq.soundscape);
      expect(config.audioPreset, seq.id).toBe('silent');
      expect(config.visualConfig, seq.id).toEqual(seq.visualConfig);
    }

    vault.destroy?.();
    container.remove();
  });

  it('lets a sequence override the archetype rather than inherit it', () => {
    // Guards the merge itself: with identical archetype and sequence
    // values, the assertions above would pass even if the sequence's
    // fields were dropped entirely. Here they deliberately differ.
    const container = document.createElement('div');
    document.body.appendChild(container);
    const onLaunchArchetype = vi.fn();
    const vault = new Vault(container, {
      personalizedVault: 'vault-a',
      onLaunchArchetype
    });

    const [first] = VAULT_A_SEQUENCES;
    vault.personalizedVault = {
      ...vault.personalizedVault,
      archetype: {
        ...VAULT_A_ARCHETYPE,
        config: {
          ...VAULT_A_ARCHETYPE.config,
          wpm: 111,
          chunkMode: 'word',
          soundscape: 'none',
          visualConfig: { visualMode: 'off' }
        }
      },
      sequences: [{
        ...first,
        chunkMode: 'phrase',
        soundscape: 'aurora',
        wpm: 275,
        visualConfig: { visualMode: 'genesis', genesis: { preset: 'random' } }
      }]
    };

    vault.launchPersonalizedSequence(first.id);
    const { config } = onLaunchArchetype.mock.calls[0][0];
    expect(config.chunkMode).toBe('phrase');
    expect(config.soundscape).toBe('aurora');
    expect(config.wpm).toBe(275);
    expect(config.visualConfig.visualMode).toBe('genesis');

    vault.destroy?.();
    container.remove();
  });
});

describe('Vault A compiles to playable sessions', () => {
  it('every sequence compiles, with its own pace and visuals preserved', () => {
    for (const seq of VAULT_A_SEQUENCES) {
      const session = compileSession({
        ...VAULT_A_ARCHETYPE.config,
        wpm: seq.wpm,
        curve: seq.curve,
        audioPreset: seq.audioPreset,
        soundscape: seq.soundscape,
        visualConfig: seq.visualConfig,
        text: seq.content,
        title: seq.name
      });

      expect(session.atoms.length, seq.id).toBeGreaterThan(50);
      expect(session.totalDuration, seq.id).toBeGreaterThan(30_000);
      expect(session.visualConfig.visualMode).toBe(seq.visualConfig.visualMode);
    }
  });

  it('builds phrase atoms from the authored | boundaries', () => {
    // Phrase mode is only worth choosing if the atoms are the breaths
    // the text authored. A phrase atom should never be a single word
    // (word mode) nor swallow a whole paragraph (sentence mode).
    for (const seq of VAULT_A_SEQUENCES) {
      const session = compileSession({
        ...VAULT_A_ARCHETYPE.config,
        wpm: seq.wpm,
        curve: seq.curve,
        chunkMode: seq.chunkMode,
        text: seq.content,
        title: seq.name
      });

      const textAtoms = session.atoms.filter(a => a.content.trim().length > 0);
      const words = textAtoms.map(a => a.content.trim().split(/\s+/).length);
      const mean = words.reduce((a, b) => a + b, 0) / words.length;

      expect(mean, `${seq.id} mean phrase length`).toBeGreaterThan(2.5);
      expect(mean, `${seq.id} mean phrase length`).toBeLessThan(12);

      // Every atom stays inside a comfortable reading beat
      const longest = Math.max(...textAtoms.map(a => a.duration));
      expect(longest, `${seq.id} longest atom`).toBeLessThan(4000);
    }
  });

  it('preserves authored [PAUSE] and [HOLD] markers as timed atoms', () => {
    // The markers set the reading's breath; they must survive chunking
    const withMarkers = VAULT_A_SEQUENCES.filter(s => /\[(PAUSE|HOLD)\]/.test(s.content));
    expect(withMarkers.length).toBe(VAULT_A_SEQUENCES.length);

    for (const seq of withMarkers) {
      const session = compileSession({
        ...VAULT_A_ARCHETYPE.config,
        wpm: seq.wpm,
        text: seq.content,
        title: seq.name
      });
      const markers = session.atoms.filter(
        a => a.tags?.includes('PAUSE') || a.tags?.includes('HOLD')
      );
      expect(markers.length, seq.id).toBeGreaterThan(0);
      for (const marker of markers) {
        expect(marker.timingLocked, seq.id).toBe(true);
      }
    }
  });
});

describe('Vault A living text', () => {
  it('lets every reading carry the passage\'s own temperature', async () => {
    // Her prose swings 0.50–0.99 in valence across each piece, so the
    // hue shift reads as movement through an argument rather than a
    // constant tint. Intensity is held below full for academic prose:
    // the text should breathe, not glow.
    for (const seq of VAULT_A_SEQUENCES) {
      expect(seq.visualConfig.livingText, seq.id).toBeDefined();
      expect(seq.visualConfig.livingText.enabled, seq.id).toBe(true);
      expect(seq.visualConfig.livingText.intensity).toBeGreaterThan(0);
      expect(seq.visualConfig.livingText.intensity).toBeLessThanOrEqual(0.8);
    }
  });
});
