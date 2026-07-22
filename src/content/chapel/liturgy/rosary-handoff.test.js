import { describe, expect, it } from 'vitest';
import { createRosaryHandoff } from './rosary-handoff.js';
import { ROSARY_MYSTERY_WORKS, mysteryWork } from './rosary-imagery.js';

describe('The Rosary handoff', () => {
  it('builds a complete playable session: timing-locked atoms, Marian focal, silence', () => {
    const { session, liturgy } = createRosaryHandoff('sorrowful');

    expect(session.atoms.length).toBe(liturgy.steps.length);
    expect(session.atoms.every(atom => atom.timingLocked)).toBe(true);
    expect(session.totalDuration).toBe(liturgy.totalDurationMs);
    expect(session.title).toContain('Sorrowful');

    // The Marian icon holds the focal by default (spec §4)
    expect(session.visualConfig).toMatchObject({
      visualMode: 'focals',
      focals: { type: 'icon', iconId: 'icon-salus-populi-romani' }
    });
    // Fixed devotions default to silence (spec §3)
    expect(session.soundscape).toBe('none');
    // The Chamber's strand reads this
    expect(session.visualConfig.liturgy).toEqual({
      kind: 'rosary', mysterySet: 'sorrowful', mode: 'plain'
    });
    expect(session.provenance.kind).toBe('chapel-liturgy');
    expect(session.origin.view).toBe('chapel');
  });

  it("honors the reader's chosen icon over the Marian default", () => {
    const { session } = createRosaryHandoff('joyful', { iconId: 'icon-pantocrator-sinai' });
    expect(session.visualConfig.focals.iconId).toBe('icon-pantocrator-sinai');
    // an unpinned icon falls back to the Marian
    const fallback = createRosaryHandoff('joyful', { iconId: 'icon-of-nowhere' });
    expect(fallback.session.visualConfig.focals.iconId).toBe('icon-salus-populi-romani');
  });

  it('carries the mode and applies the global pace multiplier', () => {
    const { session } = createRosaryHandoff('glorious', { mode: 'imagistic', paceMultiplier: 2 });
    expect(session.visualConfig.liturgy.mode).toBe('imagistic');
    const base = createRosaryHandoff('glorious');
    // 2× pace halves every fixed duration (± per-step rounding)
    expect(session.totalDuration).toBeGreaterThan(base.session.totalDuration * 0.48);
    expect(session.totalDuration).toBeLessThan(base.session.totalDuration * 0.52);
  });

  it('refuses an unknown mystery set', () => {
    expect(() => createRosaryHandoff('doleful')).toThrow(/Unknown mystery set/);
  });
});

describe('The Imagistic mapping (one pinned work per mystery, or honest absence)', () => {
  it('maps all four sets with exactly five slots each, works or null', () => {
    for (const [setId, works] of Object.entries(ROSARY_MYSTERY_WORKS)) {
      expect(works, setId).toHaveLength(5);
      for (const work of works) {
        if (work === null) continue;
        expect(['met', 'cleveland', 'aic', 'rijks']).toContain(work.source);
        expect(work.id).toBeTruthy();
      }
    }
    // The two honest absences: Pentecost and the Proclamation
    expect(mysteryWork('glorious', 3)).toBeNull();
    expect(mysteryWork('luminous', 3)).toBeNull();
    // And the anchors hold
    expect(mysteryWork('joyful', 1)).toEqual({ source: 'aic', id: 16327 });
    expect(mysteryWork('sorrowful', 5)).toEqual({ source: 'cleveland', id: 112856 });
    expect(mysteryWork('nowhere', 1)).toBeNull();
    expect(mysteryWork('joyful', 9)).toBeNull();
  });
});
