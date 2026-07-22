/**
 * The Rosary as a liturgy definition — the traditional structure
 * (spec §4) built from the fixed data in rosary.js:
 *
 *   Sign of the Cross → Apostles' Creed → Our Father → 3 Hail Marys
 *   → Glory Be → five decades, each:
 *       Mystery announcement (with its fruit)
 *       Our Father
 *       10 Hail Marys
 *       Glory Be · Fatima Prayer
 *   → Hail Holy Queen → closing prayer → Sign of the Cross
 *
 * Bead numbering walks the physical rosary: the crucifix (0), the
 * five introductory beads (1–5: Our Father on 1, Hail Marys on 2–4,
 * Glory Be on 5), then each decade's Our Father bead followed by its
 * ten Hail Mary beads. 59 beads in all; the strand draws exactly
 * this numbering.
 */

import {
  ROSARY_PRAYERS,
  MYSTERY_SETS,
  PRAYER_DURATIONS_MS
} from './rosary.js';

const P = ROSARY_PRAYERS;
const D = PRAYER_DURATIONS_MS;

/** Total beads: crucifix + 5 intro + 5 × (1 + 10). */
export const ROSARY_BEAD_COUNT = 1 + 5 + 5 * 11;

/**
 * Build the liturgy definition for one mystery set.
 * @param {string} setId - a MYSTERY_SETS id
 * @returns {Object} a definition for compileLiturgy
 */
export function buildRosaryDefinition(setId) {
  const set = MYSTERY_SETS[setId];
  if (!set) throw new RangeError(`Unknown mystery set: ${String(setId)}`);

  const steps = [
    { id: 'sign-opening', text: P.signOfTheCross, durationMs: D.signOfTheCross, state: { phase: 'opening', bead: 0 } },
    { id: 'creed', text: P.apostlesCreed, durationMs: D.apostlesCreed, state: { phase: 'opening', bead: 0 } },
    { id: 'opening-our-father', text: P.ourFather, durationMs: D.ourFather, state: { phase: 'opening', bead: 1 } },
    { id: 'opening-hail-mary', text: P.hailMary, durationMs: D.hailMary, repeat: 3, state: { phase: 'opening', beadStart: 2 } },
    { id: 'opening-glory-be', text: P.gloryBe, durationMs: D.gloryBe, state: { phase: 'opening', bead: 5 } }
  ];

  set.mysteries.forEach((mystery, index) => {
    const decade = index + 1;
    // Decade N's Our Father bead: 6 + (N-1)*11; Hail Marys follow.
    const decadeBeadBase = 6 + (decade - 1) * 11;
    const mysteryState = { decade, mystery: { ...mystery, ordinal: decade, set: set.id } };

    steps.push(
      {
        id: `decade-${decade}-announce`,
        text: `The ${ordinal(decade)} ${set.name.replace('The ', '').replace(' Mysteries', '')} Mystery: ${mystery.title}. ${mystery.fruit}`,
        durationMs: D.mysteryAnnouncement,
        state: { ...mysteryState, phase: 'mystery', bead: decadeBeadBase }
      },
      {
        id: `decade-${decade}-our-father`,
        text: P.ourFather,
        durationMs: D.ourFather,
        state: { ...mysteryState, phase: 'decade', bead: decadeBeadBase }
      },
      {
        id: `decade-${decade}-hail-mary`,
        text: P.hailMary,
        durationMs: D.hailMary,
        repeat: 10,
        state: { ...mysteryState, phase: 'decade', beadStart: decadeBeadBase + 1 }
      },
      {
        id: `decade-${decade}-glory-be`,
        text: P.gloryBe,
        durationMs: D.gloryBe,
        state: { ...mysteryState, phase: 'decade', bead: decadeBeadBase + 10 }
      },
      {
        id: `decade-${decade}-fatima`,
        text: P.fatimaPrayer,
        durationMs: D.fatimaPrayer,
        state: { ...mysteryState, phase: 'decade', bead: decadeBeadBase + 10 }
      }
    );
  });

  steps.push(
    { id: 'hail-holy-queen', text: P.hailHolyQueen, durationMs: D.hailHolyQueen, state: { phase: 'closing', bead: 0 } },
    { id: 'closing-prayer', text: P.closingPrayer, durationMs: D.closingPrayer, state: { phase: 'closing', bead: 0 } },
    { id: 'sign-closing', text: P.signOfTheCross, durationMs: D.signOfTheCross, state: { phase: 'closing', bead: 0 } }
  );

  return {
    id: `rosary-${set.id}`,
    title: `The Holy Rosary — ${set.name}`,
    steps
  };
}

function ordinal(n) {
  return ['First', 'Second', 'Third', 'Fourth', 'Fifth'][n - 1] || `${n}th`;
}
