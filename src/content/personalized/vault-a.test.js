import { describe, expect, it } from 'vitest';
import { VAULT_A_SEQUENCES, VAULT_A_ARCHETYPE } from './vault-a.js';
import { compileSession } from '../../core/session-compiler.js';
import { MUSEUM_CATEGORIES } from '../../sources/visual/museum.js';

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
  it('runs Faded Signal throughout, with pure tones resting', () => {
    // A soundscape is a finished mix — exclusive beds
    for (const seq of VAULT_A_SEQUENCES) {
      expect(seq.soundscape, seq.id).toBe('faded-signal');
      expect(seq.audioPreset, seq.id).toBe('silent');
    }
    expect(VAULT_A_ARCHETYPE.config.soundscape).toBe('faded-signal');
    expect(VAULT_A_ARCHETYPE.config.audioPreset).toBe('silent');
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
