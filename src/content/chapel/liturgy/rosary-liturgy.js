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
 * Bead numbering walks the physical rosary. A five-decade rosary has
 * FIFTY-NINE beads:
 *
 *   pendant   4    one Our Father bead, three Hail Mary beads
 *   loop     55    five decades of (one Our Father + ten Hail Marys)
 *
 * The crucifix and the centrepiece medal are parts of the rosary but
 * they are not beads, and neither is counted. The Glory Be has no bead
 * of its own — it is prayed on the centrepiece, between the pendant and
 * the loop.
 *
 * Positions here therefore run 0–59: the crucifix at 0 (a position, not
 * a bead), the pendant at 1–4, and decade N's Our Father at 5+(N−1)×11
 * with its ten Hail Marys following. The centrepiece is position −1,
 * matching the strand. Highest bead: 59. Count of beads: 59.
 *
 * This was wrong until now — the module allocated a sixth pendant
 * position to the Glory Be, so `ROSARY_BEAD_COUNT` evaluated to 61 two
 * lines under a comment stating 59, and `rosary-strand.js` drew sixty
 * beads. The count IS the form; on the one subsystem whose whole thesis
 * is fidelity to a physical object, the object's most basic fact was
 * wrong in the renderer a reader looks at.
 */

import {
  ROSARY_PRAYERS,
  MYSTERY_SETS,
  PRAYER_DURATIONS_MS
} from './rosary.js';

const P = ROSARY_PRAYERS;
const D = PRAYER_DURATIONS_MS;

/**
 * Beads on a five-decade rosary: 4 on the pendant + 5 × (1 + 10) on the
 * loop. The crucifix and the centrepiece are not beads and are not in
 * this number. It is also the highest bead position, because position 0
 * is the crucifix.
 */
export const ROSARY_BEAD_COUNT = 4 + 5 * 11;

/** The centrepiece medal. A position on the strand, not a bead. */
export const ROSARY_CENTREPIECE = -1;

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
    // On the centrepiece, not on a bead of its own. This is the whole
    // correction: the sixth pendant position never existed.
    { id: 'opening-glory-be', text: P.gloryBe, durationMs: D.gloryBe, state: { phase: 'opening', bead: ROSARY_CENTREPIECE } }
  ];

  set.mysteries.forEach((mystery, index) => {
    const decade = index + 1;
    // Decade N's Our Father bead: 5 + (N-1)*11; its ten Hail Marys
    // follow. Decade 5 ends on bead 59, the last bead of the loop.
    const decadeBeadBase = 5 + (decade - 1) * 11;
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
