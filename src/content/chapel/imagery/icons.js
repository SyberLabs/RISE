/**
 * The Chapel's pinned icons — the sacred images the icon focal and the
 * Rosary display.
 *
 * Every entry is a specific work chosen by a human (curated 2026-07-22,
 * contact-sheet reviewed), pinned by source id, rights-verified with a
 * STATED public-domain declaration — never inferred from silence.
 * Spec non-negotiable #4: sacred imagery is pinned, never searched.
 *
 * The two Commons works carry the file's own SHA-1 as captured at
 * curation, so a silent upstream file replacement is detectable. The
 * Princeton work resolves through the museum's IIIF service by object
 * number.
 *
 * Reverent degradation (#5): if an image fails to load, the focal
 * falls back to stillness — never to a different image.
 */

import { freezeManifest } from '../../atrium/constants.js';

export const CHAPEL_ICONS = freezeManifest({
  'icon-pantocrator-sinai': {
    name: 'Christ Pantocrator',
    role: 'pantocrator',
    origin: 'Saint Catherine’s Monastery, Sinai',
    date: '6th century',
    medium: 'Encaustic on panel',
    source: 'commons',
    sourceId: 'File:Spas_vsederzhitel_sinay.jpg',
    // Direct file URL + a bounded render for the focal
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/4/4a/Spas_vsederzhitel_sinay.jpg/1280px-Spas_vsederzhitel_sinay.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Spas_vsederzhitel_sinay.jpg',
    rights: 'PUBLIC_DOMAIN',
    rightsBasis: 'Commons extmetadata: License pd, Copyrighted False (verified 2026-07-22)',
    fileSha1: '90498ad88f3e1b9a37ac2f542de3b9359aa7169e',
    attribution: 'Christ Pantocrator, 6th century, Saint Catherine’s Monastery, Sinai — Wikimedia Commons, public domain'
  },

  'icon-pantocrator-russian': {
    name: 'Christ Pantocrator',
    role: 'pantocrator',
    origin: 'Russian',
    date: '19th century',
    medium: 'Paint on wood panel',
    source: 'princeton',
    sourceId: 'y1960-34',
    objectId: 28321,
    image: 'https://media.artmuseum.princeton.edu/iiif/3/collection/y1960-34/full/1200,/0/default.jpg',
    sourceUrl: 'https://artmuseum.princeton.edu/art/collections/objects/28321',
    rights: 'PUBLIC_DOMAIN',
    rightsBasis: 'Museum page states Public Domain with free-download invitation (verified 2026-07-22)',
    attribution: 'Russian, Christ Pantocrator, 19th century. Gift of Dr. Fred B. Rogers, Class of 1947 (y1960-34) — Princeton University Art Museum, public domain'
  },

  'icon-good-shepherd': {
    name: 'The Good Shepherd',
    role: 'christ',
    origin: 'Bernhard Plockhorst',
    date: '19th century',
    medium: 'Oil on canvas',
    source: 'commons',
    sourceId: 'File:Bernhard_Plockhorst_-_Good_Shephard.jpg',
    image: 'https://upload.wikimedia.org/wikipedia/commons/a/a7/Bernhard_Plockhorst_-_Good_Shephard.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Bernhard_Plockhorst_-_Good_Shephard.jpg',
    rights: 'PUBLIC_DOMAIN',
    rightsBasis: 'Commons extmetadata: License Public domain, Copyrighted False; Plockhorst d. 1907 (verified 2026-07-22)',
    fileSha1: '95a8b2416d9ee9771968d062d88b0071f7b3e924',
    attribution: 'Bernhard Plockhorst, The Good Shepherd, 19th century — Wikimedia Commons, public domain'
  },

  'icon-pantocrator-iconmuseum': {
    name: 'Christ Pantocrator',
    role: 'pantocrator',
    origin: 'Russian',
    date: 'Late 19th century',
    medium: 'Oil on wood',
    source: 'iconmuseum',
    sourceId: 'R2017.4',
    image: 'https://www.iconmuseum.org/wp-content/uploads/2026/03/R2017_4-Lord-Almighty-main-scaled.jpg',
    sourceUrl: 'https://www.iconmuseum.org/collection/christ-pantocrator-12/',
    rights: 'PERMISSION',
    rightsBasis: 'Written permission from the Registrar, 2026-07-22 — see docs/icon-museum-permission.txt; required citation honored in the attribution line',
    attribution: 'Christ Pantocrator, Russian, late 19th century (R2017.4) — Icon Museum and Study Center, Clinton MA'
  },

  // ── The Icon Museum and Study Center, Clinton MA ──
  // Eight further works under the Registrar's written grant of
  // 2026-07-22 (docs/icon-museum-permission.txt), the required
  // citation honored in every attribution line. NOT pinned:
  // Lambardos' Archangel Michael (L2025.01.5) — the L accession
  // marks a LOAN, and a lender's rights are not the museum's to
  // grant; held pending explicit confirmation from the Registrar.

  'icon-christ-in-majesty': {
    name: 'Christ in Majesty',
    role: 'christ',
    origin: 'Russian',
    date: 'Late 16th century',
    medium: 'Egg tempera on wood',
    source: 'iconmuseum',
    sourceId: 'R2009.8',
    image: 'https://www.iconmuseum.org/wp-content/uploads/2023/12/R2009_8--scaled.webp',
    sourceUrl: 'https://www.iconmuseum.org/collection/christ-in-majesty/',
    rights: 'PERMISSION',
    rightsBasis: 'Written permission from the Registrar, 2026-07-22 — see docs/icon-museum-permission.txt',
    attribution: 'Christ in Majesty, Russian, late 16th century (R2009.8) — Icon Museum and Study Center, Clinton MA'
  },

  'icon-christ-enthroned': {
    name: 'Christ Enthroned',
    role: 'christ',
    origin: 'Russian',
    date: 'Mid-19th century',
    medium: 'Egg tempera on wood',
    source: 'iconmuseum',
    sourceId: 'R2000.16',
    image: 'https://www.iconmuseum.org/wp-content/uploads/2023/09/R2000_16-scaled.webp',
    sourceUrl: 'https://www.iconmuseum.org/collection/christ-enthroned/',
    rights: 'PERMISSION',
    rightsBasis: 'Written permission from the Registrar, 2026-07-22 — see docs/icon-museum-permission.txt',
    attribution: 'Christ Enthroned, Russian, mid-19th century (R2000.16) — Icon Museum and Study Center, Clinton MA'
  },

  'icon-christ-enthroned-gold': {
    name: 'Christ Enthroned',
    role: 'christ',
    origin: 'Russian',
    date: '19th century',
    medium: 'Egg tempera on wood, gold leaf',
    source: 'iconmuseum',
    sourceId: 'R2017.6.092',
    image: 'https://www.iconmuseum.org/wp-content/uploads/2026/03/R2017_6_092-Christ-Enthroned-main.jpg',
    sourceUrl: 'https://www.iconmuseum.org/collection/christ-enthroned-3/',
    rights: 'PERMISSION',
    rightsBasis: 'Written permission from the Registrar, 2026-07-22 — see docs/icon-museum-permission.txt',
    attribution: 'Christ Enthroned, Russian, 19th century (R2017.6.092) — Icon Museum and Study Center, Clinton MA'
  },

  'icon-transfiguration': {
    name: 'The Transfiguration of Christ',
    role: 'christ',
    origin: 'Russian',
    date: 'Late 19th century',
    medium: 'Egg tempera on wood',
    source: 'iconmuseum',
    sourceId: 'R2005.29',
    image: 'https://www.iconmuseum.org/wp-content/uploads/2025/03/R2005_29-Transfiguration-scaled.jpg',
    sourceUrl: 'https://www.iconmuseum.org/collection/the-transfiguration-of-christ-4/',
    rights: 'PERMISSION',
    rightsBasis: 'Written permission from the Registrar, 2026-07-22 — see docs/icon-museum-permission.txt',
    attribution: 'The Transfiguration of Christ, Russian, late 19th century (R2005.29) — Icon Museum and Study Center, Clinton MA'
  },

  'icon-transfiguration-basma': {
    name: 'The Transfiguration of Christ',
    role: 'christ',
    origin: 'Russian',
    date: '17th century',
    medium: 'Egg tempera on wood, gold leaf, metal basma',
    source: 'iconmuseum',
    sourceId: 'R2014.3.9',
    image: 'https://www.iconmuseum.org/wp-content/uploads/2026/02/R2014_3_9-Transfiguration-scaled.jpg',
    sourceUrl: 'https://www.iconmuseum.org/collection/the-transfiguration-of-christ-6/',
    rights: 'PERMISSION',
    rightsBasis: 'Written permission from the Registrar, 2026-07-22 — see docs/icon-museum-permission.txt',
    attribution: 'The Transfiguration of Christ, Russian, 17th century (R2014.3.9) — Icon Museum and Study Center, Clinton MA'
  },

  'icon-ascension': {
    name: 'The Ascension of Christ',
    role: 'christ',
    origin: 'Russian',
    date: 'Early 17th century',
    medium: 'Egg tempera on wood',
    source: 'iconmuseum',
    sourceId: 'R2007.38',
    image: 'https://www.iconmuseum.org/wp-content/uploads/2025/01/R2007_38-scaled.jpg',
    sourceUrl: 'https://www.iconmuseum.org/collection/the-ascension-of-christ/',
    rights: 'PERMISSION',
    rightsBasis: 'Written permission from the Registrar, 2026-07-22 — see docs/icon-museum-permission.txt',
    attribution: 'The Ascension of Christ, Russian, early 17th century (R2007.38) — Icon Museum and Study Center, Clinton MA'
  },

  'icon-mother-of-god-nursing': {
    name: 'The Mother of God Nursing the Christ Child',
    role: 'marian',
    origin: 'Russian',
    date: 'Mid-18th century',
    medium: 'Egg tempera on wood',
    source: 'iconmuseum',
    sourceId: 'R1998.25',
    image: 'https://www.iconmuseum.org/wp-content/uploads/2025/02/R1998_25--scaled.jpg',
    sourceUrl: 'https://www.iconmuseum.org/collection/the-mother-of-god-nursing-the-christ-child-2/',
    rights: 'PERMISSION',
    rightsBasis: 'Written permission from the Registrar, 2026-07-22 — see docs/icon-museum-permission.txt',
    attribution: 'The Mother of God Nursing the Christ Child, Russian, mid-18th century (R1998.25) — Icon Museum and Study Center, Clinton MA'
  },

  'icon-archangel-gabriel': {
    name: 'Archangel Gabriel',
    role: 'angel',
    origin: 'Russian',
    date: 'Early 19th century',
    medium: 'Egg tempera on wood, gold leaf',
    source: 'iconmuseum',
    sourceId: 'R2019.4.2',
    image: 'https://www.iconmuseum.org/wp-content/uploads/2026/03/R2019_4_2-main.jpg',
    sourceUrl: 'https://www.iconmuseum.org/collection/archangel-gabriel-2/',
    rights: 'PERMISSION',
    rightsBasis: 'Written permission from the Registrar, 2026-07-22 — see docs/icon-museum-permission.txt',
    attribution: 'Archangel Gabriel, Russian, early 19th century (R2019.4.2) — Icon Museum and Study Center, Clinton MA'
  },

  'icon-archangel-michael': {
    name: 'The Archangel Michael',
    role: 'angel',
    origin: 'Pyotr Zabolotsky',
    date: '1857',
    medium: 'Oil',
    source: 'commons',
    sourceId: 'File:Arhistratig Mihail (Zabolotsky).jpg',
    image: 'https://upload.wikimedia.org/wikipedia/commons/e/e1/Arhistratig_Mihail_%28Zabolotsky%29.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Arhistratig_Mihail_(Zabolotsky).jpg',
    rights: 'PUBLIC_DOMAIN',
    rightsBasis: 'Commons extmetadata: Public domain, Copyrighted False; Zabolotsky d. 1866 (verified 2026-07-22)',
    fileSha1: '6bebfbf6beba0781bdb9889a2b7a2f4cefed1d63',
    attribution: 'Pyotr Zabolotsky, The Archangel Michael, 1857 — Wikimedia Commons, public domain'
  },

  'icon-salus-populi-romani': {
    name: 'Salus Populi Romani',
    role: 'marian',
    origin: 'Basilica di Santa Maria Maggiore, Rome',
    date: 'Byzantine, traditionally attributed; photographed after the 2018 restoration',
    medium: 'Tempera on cedar panel',
    source: 'commons',
    sourceId: 'File:Salus Populi Romani after restoration.jpg',
    image: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Salus_Populi_Romani_after_restoration.jpg/1280px-Salus_Populi_Romani_after_restoration.jpg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Salus_Populi_Romani_after_restoration.jpg',
    rights: 'PUBLIC_DOMAIN',
    rightsBasis: 'Commons extmetadata: License Public domain, Copyrighted False (verified 2026-07-22)',
    fileSha1: '4a13c62f9f68e8cd009e7d42d324d4af298cf867',
    attribution: 'Salus Populi Romani, Basilica di Santa Maria Maggiore, Rome — Wikimedia Commons, public domain'
  }
});

export function findChapelIcon(id) {
  return Object.hasOwn(CHAPEL_ICONS, id) ? CHAPEL_ICONS[id] : null;
}

/** The default icons per role — the Sinai Pantocrator is canonical. */
export const CHAPEL_ICON_DEFAULTS = Object.freeze({
  pantocrator: 'icon-pantocrator-sinai',
  marian: 'icon-salus-populi-romani'
});
