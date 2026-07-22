/**
 * The Rosary's Imagistic mapping — ONE pinned work per mystery
 * (spec §4: "each mystery may pin ONE work… shown as a still behind
 * glass for the decade's duration — pinned works, not rotation").
 *
 * Selection 2026-07-22 from the reviewed chapel collections plus a
 * targeted rights-gated harvest for the gaps (Met PD / Cleveland
 * CC0). PENDING the user's contact-sheet pass — swaps welcome; the
 * mapping never searches, only names.
 *
 * Two mysteries have NO pinned work — the Third Luminous (the
 * Proclamation of the Kingdom) and the Third Glorious (Pentecost)
 * found no rights-cleared painting in range. Their decades hold the
 * Marian focal alone: honest absence over a wrong image
 * (non-negotiable #5).
 */

import { freezeManifest } from '../../atrium/constants.js';

/** setId -> [work|null × 5], index = mystery ordinal - 1. */
export const ROSARY_MYSTERY_WORKS = freezeManifest({
  joyful: [
    { source: 'aic', id: 16327 },        // Jean Hey, The Annunciation, 1490–95
    { source: 'cleveland', id: 136192 }, // Dürer, The Visitation, c. 1504
    { source: 'cleveland', id: 135311 }, // Gerard David, The Nativity, c. 1485–90
    { source: 'cleveland', id: 136177 }, // Dürer, The Presentation of Christ in the Temple, c. 1504–05
    { source: 'cleveland', id: 104139 }  // Dürer, Christ Among the Doctors, 1504–05
  ],
  sorrowful: [
    { source: 'met', id: 437371 },       // Raphael, The Agony in the Garden, ca. 1504
    { source: 'met', id: 438466 },       // Master of the Berswordt Altar, The Flagellation, ca. 1400
    { source: 'met', id: 435580 },       // Antonello da Messina, Christ Crowned with Thorns
    { source: 'aic', id: 234781 },       // Sebastiano del Piombo, Christ Carrying the Cross, c. 1515–17
    { source: 'cleveland', id: 112856 }  // Rogier van der Weyden, The Crucifixion with a Carthusian Monk, 1460
  ],
  glorious: [
    { source: 'cleveland', id: 78982 },  // Johann König, The Resurrection of Christ, 1622
    { source: 'cleveland', id: 130151 }, // Dürer, Ascension of Christ, c. 1515
    null,                                 // Pentecost — no rights-cleared work found; the Marian focal holds
    { source: 'cleveland', id: 126986 }, // Rosselli, The Assumption of the Virgin, c. 1495
    { source: 'met', id: 437524 }        // Rubens, The Coronation of the Virgin, ca. 1632–33
  ],
  luminous: [
    { source: 'met', id: 440393 },       // Jacopo Bassano, The Baptism of Christ, ca. 1590
    { source: 'met', id: 436801 },       // Juan de Flandes, The Marriage Feast at Cana, ca. 1497
    null,                                 // Proclamation of the Kingdom — no work found; the focal holds
    { source: 'cleveland', id: 146788 }, // Camillo Procaccini, The Transfiguration, 1587–90
    { source: 'cleveland', id: 106440 }  // Israhel van Meckenem, Supper at Emmaus, c. 1480 (the Eucharist at table)
  ]
});

/** The pinned work for one decade, or null (the focal holds alone). */
export function mysteryWork(setId, decade) {
  const works = ROSARY_MYSTERY_WORKS[setId];
  if (!works || !Number.isInteger(decade) || decade < 1 || decade > 5) return null;
  return works[decade - 1];
}
