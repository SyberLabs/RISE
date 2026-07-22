import { describe, expect, it } from 'vitest';
import { compileLiturgy, liturgyToAtoms, liturgyStepIdFromAtom, liturgyStepState } from './liturgy-runner.js';
import { buildRosaryDefinition, ROSARY_BEAD_COUNT } from '../content/chapel/liturgy/rosary-liturgy.js';
import { ROSARY_PRAYERS, MYSTERY_SETS, mysterySetForDate } from '../content/chapel/liturgy/rosary.js';
import { Atom } from './models.js';

describe('LiturgyRunner (non-negotiable #3: fixed forms are fixed)', () => {
  it('is perfectly deterministic: the same definition compiles identically every time', () => {
    const first = compileLiturgy(buildRosaryDefinition('sorrowful'));
    const second = compileLiturgy(buildRosaryDefinition('sorrowful'));
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('contains no probabilistic machinery — no Math.random anywhere in the module', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    for (const path of ['src/core/liturgy-runner.js', 'src/content/chapel/liturgy/rosary-liturgy.js', 'src/content/chapel/liturgy/rosary.js']) {
      const source = readFileSync(resolve(path), 'utf8');
      // invocations, not the doc comments that prohibit them
      expect(source, path).not.toMatch(/Math\.random\s*\(|new ShuffleBag|\.draw\(/);
    }
  });

  it('expands repetitions with per-repetition bead state', () => {
    const compiled = compileLiturgy({
      id: 'x', title: 'X',
      steps: [{ id: 'hail', text: 'Hail…', durationMs: 1000, repeat: 3, state: { phase: 'p', beadStart: 5 } }]
    });
    expect(compiled.steps.map(step => step.id)).toEqual(['hail-1', 'hail-2', 'hail-3']);
    expect(compiled.steps.map(step => step.state.bead)).toEqual([5, 6, 7]);
    expect(compiled.steps[1].state.repetition).toBe(2);
    expect(compiled.steps[1].state.repeatTotal).toBe(3);
  });

  it('applies the global pace multiplier and refuses malformed steps', () => {
    const definition = { id: 'x', title: 'X', steps: [{ id: 's', text: 'T', durationMs: 10000 }] };
    expect(compileLiturgy(definition, { paceMultiplier: 2 }).steps[0].durationMs).toBe(5000);
    expect(compileLiturgy(definition, { paceMultiplier: 0.5 }).steps[0].durationMs).toBe(20000);
    expect(() => compileLiturgy({ id: 'x', steps: [{ id: 'bad', text: '' , durationMs: 5 }] })).toThrow(/no text/);
    expect(() => compileLiturgy({ id: 'x', steps: [{ id: 'bad', text: 'T' }] })).toThrow(/fixed duration/);
  });

  it('compiles to timing-locked atoms carrying their step ids', () => {
    const compiled = compileLiturgy(buildRosaryDefinition('joyful'));
    const atoms = liturgyToAtoms(compiled, Atom);
    expect(atoms.length).toBe(compiled.steps.length);
    expect(atoms.every(atom => atom.timingLocked)).toBe(true);
    expect(liturgyStepIdFromAtom(atoms[0])).toBe('sign-opening');
    const hail7 = atoms.find(atom => liturgyStepIdFromAtom(atom) === 'decade-2-hail-mary-7');
    expect(hail7).toBeTruthy();
    expect(hail7.duration).toBe(13000);
    expect(liturgyStepState(compiled, 'decade-2-hail-mary-7').bead).toBe(6 + 11 + 1 + 6);
  });
});

describe('The Rosary structure (the count IS the form)', () => {
  it('holds the traditional shape for every mystery set', () => {
    for (const setId of ['joyful', 'sorrowful', 'glorious', 'luminous']) {
      const compiled = compileLiturgy(buildRosaryDefinition(setId));
      const texts = compiled.steps.map(step => step.text);

      // Exactly 53 Hail Marys: 3 opening + 5 × 10
      expect(texts.filter(text => text === ROSARY_PRAYERS.hailMary)).toHaveLength(53);
      // Exactly 6 Our Fathers: 1 opening + 5 decades
      expect(texts.filter(text => text === ROSARY_PRAYERS.ourFather)).toHaveLength(6);
      // Exactly 6 Glory Bes, 5 Fatima prayers, 5 announcements
      expect(texts.filter(text => text === ROSARY_PRAYERS.gloryBe)).toHaveLength(6);
      expect(texts.filter(text => text === ROSARY_PRAYERS.fatimaPrayer)).toHaveLength(5);
      expect(compiled.steps.filter(step => step.state.phase === 'mystery')).toHaveLength(5);
      // The Sign of the Cross opens and closes
      expect(compiled.steps[0].text).toBe(ROSARY_PRAYERS.signOfTheCross);
      expect(compiled.steps[compiled.steps.length - 1].text).toBe(ROSARY_PRAYERS.signOfTheCross);

      // Beads: every decade Hail Mary walks its ten beads exactly once
      const beads = compiled.steps
        .filter(step => step.state.phase === 'decade' && step.text === ROSARY_PRAYERS.hailMary)
        .map(step => step.state.bead);
      expect(new Set(beads).size).toBe(50);
      expect(Math.max(...beads)).toBe(ROSARY_BEAD_COUNT - 1);
    }
  });

  it('runs about the length of a prayed rosary (18–24 minutes at 1.0×)', () => {
    const compiled = compileLiturgy(buildRosaryDefinition('sorrowful'));
    const minutes = compiled.totalDurationMs / 60000;
    expect(minutes).toBeGreaterThan(18);
    expect(minutes).toBeLessThan(24);
  });

  it('each decade announces its mystery with the user-supplied title and fruit', () => {
    const compiled = compileLiturgy(buildRosaryDefinition('luminous'));
    const announcements = compiled.steps.filter(step => step.state.phase === 'mystery');
    expect(announcements[0].text).toContain('The Baptism in the Jordan');
    expect(announcements[0].text).toContain('God proclaims Jesus is His Son.');
    expect(announcements[4].text).toContain('The Institution of the Eucharist');
    expect(announcements[2].state.mystery.ordinal).toBe(3);
    expect(announcements[2].state.mystery.set).toBe('luminous');
  });
});

describe('The day mapping (the calendar chooses, gently)', () => {
  it('maps every day of the week to its traditional set', () => {
    // 2026-07-20 is a Monday
    const monday = new Date(2026, 6, 20);
    const expectations = ['joyful', 'sorrowful', 'glorious', 'luminous', 'sorrowful', 'joyful', 'glorious'];
    for (let offset = 0; offset < 7; offset += 1) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + offset);
      expect(mysterySetForDate(date), date.toDateString()).toBe(expectations[offset]);
    }
  });

  it('every set names its days for the gentle offer', () => {
    for (const set of Object.values(MYSTERY_SETS)) {
      expect(set.daysLabel).toBeTruthy();
      expect(set.mysteries).toHaveLength(5);
    }
  });
});
