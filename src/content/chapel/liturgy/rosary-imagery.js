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
 * ALL TWENTY mysteries now carry a pinned work. The two absences the
 * harvest left (Pentecost, the Proclamation) were both closed by user
 * finds on 2026-07-22 — a CC BY-SA Pentecost icon and Carl Bloch's
 * Sermon on the Mount. The null slot remains a legal shape: a mystery
 * without a work holds the focal alone (non-negotiable #5).
 *
 * Pin shapes: museum pins ({source, id}) resolve live through the
 * imagery service; `source: 'commons'` pins carry their data baked
 * (verified license, direct URL, file SHA-1) like the Chapel icons —
 * Commons files have no per-object museum API worth calling at
 * prayer time.
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
    {
      // Pentecost — the Descent of the Holy Spirit upon the Apostles
      // and Mary, tongues of flame above their heads. User find,
      // 2026-07-22. Photo © Хомелка, CC BY-SA 3.0 (attribution
      // required and honored); Commons file SHA-1 pinned.
      source: 'commons',
      id: 'File:Абраз "Сашэсце Святога Духа".JPG',
      title: 'The Descent of the Holy Spirit',
      artist: 'Icon; photograph by Хомелка',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/6f/%D0%90%D0%B1%D1%80%D0%B0%D0%B7_%22%D0%A1%D0%B0%D1%88%D1%8D%D1%81%D1%86%D0%B5_%D0%A1%D0%B2%D1%8F%D1%82%D0%BE%D0%B3%D0%B0_%D0%94%D1%83%D1%85%D0%B0%22.JPG/1280px-%D0%90%D0%B1%D1%80%D0%B0%D0%B7_%22%D0%A1%D0%B0%D1%88%D1%8D%D1%81%D1%86%D0%B5_%D0%A1%D0%B2%D1%8F%D1%82%D0%BE%D0%B3%D0%B0_%D0%94%D1%83%D1%85%D0%B0%22.JPG',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:%D0%90%D0%B1%D1%80%D0%B0%D0%B7_%22%D0%A1%D0%B0%D1%88%D1%8D%D1%81%D1%86%D0%B5_%D0%A1%D0%B2%D1%8F%D1%82%D0%BE%D0%B3%D0%B0_%D0%94%D1%83%D1%85%D0%B0%22.JPG',
      license: 'CC-BY-SA-3.0',
      licenseBasis: 'Commons extmetadata: CC BY-SA 3.0, AttributionRequired true (verified 2026-07-22)',
      fileSha1: 'f2f933840ff650072b518a4d525edd467b6a73f1',
      attribution: 'The Descent of the Holy Spirit (icon) — photograph © Хомелка, CC BY-SA 3.0, via Wikimedia Commons'
    },
    { source: 'cleveland', id: 126986 }, // Rosselli, The Assumption of the Virgin, c. 1495
    { source: 'met', id: 437524 }        // Rubens, The Coronation of the Virgin, ca. 1632–33
  ],
  luminous: [
    { source: 'met', id: 440393 },       // Jacopo Bassano, The Baptism of Christ, ca. 1590
    { source: 'met', id: 436801 },       // Juan de Flandes, The Marriage Feast at Cana, ca. 1497
    {
      // The Proclamation of the Kingdom — the last absence, closed by
      // the user 2026-07-22: Carl Bloch's Sermon on the Mount (1877,
      // Bloch d. 1890). Commons states Public Domain; file SHA-1
      // pinned.
      source: 'commons',
      id: 'File:Bloch-SermonOnTheMount.jpg',
      title: 'The Sermon on the Mount',
      artist: 'Carl Bloch',
      imageUrl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Bloch-SermonOnTheMount.jpg/1280px-Bloch-SermonOnTheMount.jpg',
      sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bloch-SermonOnTheMount.jpg',
      license: 'PUBLIC_DOMAIN',
      licenseBasis: 'Commons extmetadata: Public domain, Copyrighted False; Bloch d. 1890 (verified 2026-07-22)',
      fileSha1: 'b4c59d84ba5d1867b38a931acc42b1652639aa61',
      attribution: 'Carl Bloch, The Sermon on the Mount, 1877 — Wikimedia Commons, public domain'
    },
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
