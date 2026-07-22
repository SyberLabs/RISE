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
