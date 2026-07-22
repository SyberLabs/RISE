/**
 * The Chapel's chant registry — recorded sacred music.
 *
 * Chant COMPOSITIONS are ancient; chant RECORDINGS are not (spec §3).
 * Every entry below carries a verified license: either the performer's
 * own grant (Commons "Own work" uploads, where the uploader IS the
 * performer and the license is theirs to give) or an explicit CC0
 * release with a named performer and source chain. No recording
 * without established rights — silence is acceptable; infringement
 * is not.
 *
 * DELIBERATELY HELD (AWAITING, not pinned): two long Byzantine hymn
 * recordings on Commons tagged CC0 but credited "Unknown author" from
 * an archive.org rip — an uploader's license tag on a recording they
 * may not own is the silence-is-not-permission shape, whatever the
 * tag says. They enter if provenance firms up.
 *
 * CC-BY / CC-BY-SA notes: we PLAY recordings with attribution
 * displayed (the registry's attribution line is surfaced wherever the
 * chant is offered and playing); we do not modify or redistribute
 * them, so share-alike obligations are not triggered.
 *
 * All entries verified on Commons 2026-07-22 (extmetadata license +
 * artist fields).
 */

import { freezeManifest } from '../atrium/constants.js';

export const CHANT_FAMILIES = Object.freeze({
  gregorian: 'Gregorian',
  znamenny: 'Znamenny'
});

export const CHAPEL_CHANTS = freezeManifest([
  // ── Gregorian ──
  {
    id: 'chant-veni-sancte-spiritus',
    title: 'Veni Sancte Spiritus',
    form: 'Sequence of Pentecost',
    family: 'gregorian',
    performer: 'Membeth',
    license: 'PUBLIC_DOMAIN',
    licenseBasis: 'Commons: Public domain, Copyrighted False, Own work (verified 2026-07-22)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/96/Veni.sancte.spiritus.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Veni.sancte.spiritus.ogg',
    duration: 157,
    attribution: 'Veni Sancte Spiritus, Gregorian chant — performed by Membeth, public domain (Wikimedia Commons)'
  },
  {
    id: 'chant-rorate-caeli',
    title: 'Rorate Caeli',
    form: 'Advent prose',
    family: 'gregorian',
    performer: 'Inritter',
    license: 'CC-BY-SA-4.0',
    licenseBasis: 'Commons: CC BY-SA 4.0, Own work (verified 2026-07-22)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/f/f8/Rorate_Caeli_~_Gregorian_Chant.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Rorate_Caeli_~_Gregorian_Chant.ogg',
    duration: 142,
    attribution: 'Rorate Caeli, Gregorian chant — performed by Inritter, CC BY-SA 4.0 (Wikimedia Commons)'
  },
  {
    id: 'chant-kyrie-orbis-factor',
    title: 'Kyrie Eleison (Orbis Factor)',
    form: 'Ordinary — Kyrie, Mass XI',
    family: 'gregorian',
    performer: 'Commons contributor (own work)',
    license: 'CC-BY-SA-3.0',
    licenseBasis: 'Commons: CC BY-SA 3.0 (verified 2026-07-22)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7d/Kyrie_Eleison_Orbis_Factor.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Kyrie_Eleison_Orbis_Factor.ogg',
    duration: 14,
    attribution: 'Kyrie Eleison (Orbis Factor), Gregorian chant — CC BY-SA 3.0 (Wikimedia Commons)'
  },
  {
    id: 'chant-tantum-ergo',
    title: 'Tantum Ergo',
    form: 'Office hymn (Pange Lingua, final strophes)',
    family: 'gregorian',
    performer: 'Commons contributor (own work)',
    license: 'CC-BY-SA-3.0',
    licenseBasis: 'Commons: CC BY-SA 3.0 (verified 2026-07-22)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/7/7f/Tantum_Ergo_I_Gregorian.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Tantum_Ergo_I_Gregorian.ogg',
    duration: 75,
    attribution: 'Tantum Ergo, Gregorian chant — CC BY-SA 3.0 (Wikimedia Commons)'
  },
  {
    id: 'chant-procedamus-in-pace',
    title: 'Procedamus in Pace · Cum Angelis · Psalm 24',
    form: 'Processional with psalmody',
    family: 'gregorian',
    performer: 'Commons contributor (own work)',
    license: 'CC-BY-SA-3.0',
    licenseBasis: 'Commons: CC BY-SA 3.0 (verified 2026-07-22)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/d/d2/Gregorian_chant_-_Procedamus_in_pace_-_Cum_angelis_-_Psalm_24_%2823%29_%28German-Polish_accent%29.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:Gregorian_chant_-_Procedamus_in_pace_-_Cum_angelis_-_Psalm_24_(23)_(German-Polish_accent).ogg',
    duration: 132,
    attribution: 'Procedamus in Pace, Gregorian chant — CC BY-SA 3.0 (Wikimedia Commons)'
  },

  // ── Znamenny (Old Russian chant, Moscow Patriarchate choir) ──
  {
    id: 'chant-carju-nebesnyj',
    title: 'Carju Nebesnyj (O Heavenly King)',
    form: 'Znamenny raspev',
    family: 'znamenny',
    performer: '“Old Russian Chant” choir of the Moscow Patriarchate',
    license: 'CC0',
    licenseBasis: 'Commons: CC0, named performer with source chain (verified 2026-07-22)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/9/98/02_Carju_Nebesnyj_znamennyj_raspev_grind_Moscow_Patriarchal_Choir.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:02_Carju_Nebesnyj_znamennyj_raspev_grind_Moscow_Patriarchal_Choir.ogg',
    duration: 101,
    attribution: 'O Heavenly King, Znamenny chant — “Old Russian Chant” choir of the Moscow Patriarchate, CC0 (Wikimedia Commons)'
  },
  {
    id: 'chant-bogorodice-devo',
    title: 'Bogorodice Devo (Rejoice, O Virgin)',
    form: 'Znamenny raspev',
    family: 'znamenny',
    performer: '“Old Russian Chant” choir of the Moscow Patriarchate',
    license: 'CC0',
    licenseBasis: 'Commons: CC0, named performer with source chain (verified 2026-07-22)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/6/64/04_Bogorodice_Devo_radujsja_znamennyj_raspev_grind_Moscow_Patriarchal_Choir.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:04_Bogorodice_Devo_radujsja_znamennyj_raspev_grind_Moscow_Patriarchal_Choir.ogg',
    duration: 88,
    attribution: 'Rejoice, O Virgin, Znamenny chant — “Old Russian Chant” choir of the Moscow Patriarchate, CC0 (Wikimedia Commons)'
  },
  {
    id: 'chant-se-zhenih',
    title: 'Se Zhenih Grjadet (Behold, the Bridegroom Comes)',
    form: 'Znamenny raspev',
    family: 'znamenny',
    performer: '“Old Russian Chant” choir of the Moscow Patriarchate',
    license: 'CC0',
    licenseBasis: 'Commons: CC0, named performer with source chain (verified 2026-07-22)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/0/03/05_Se_Zhenih_grjadet_v_polunowi_znamennyj_raspev_grind_Moscow_Patriarchal_Choir.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:05_Se_Zhenih_grjadet_v_polunowi_znamennyj_raspev_grind_Moscow_Patriarchal_Choir.ogg',
    duration: 119,
    attribution: 'Behold, the Bridegroom Comes, Znamenny chant — “Old Russian Chant” choir of the Moscow Patriarchate, CC0 (Wikimedia Commons)'
  },
  {
    id: 'chant-da-molchit',
    title: 'Da Molchit Vsjaka Plot (Let All Mortal Flesh Keep Silence)',
    form: 'Znamenny raspev',
    family: 'znamenny',
    performer: '“Old Russian Chant” choir of the Moscow Patriarchate',
    license: 'CC0',
    licenseBasis: 'Commons: CC0, named performer with source chain (verified 2026-07-22)',
    url: 'https://upload.wikimedia.org/wikipedia/commons/a/a8/07_Da_molchit_vsjaka_plot_chelovecha_znamennyj_raspev_grind_Moscow_Patriarchal_Choir.ogg',
    sourceUrl: 'https://commons.wikimedia.org/wiki/File:07_Da_molchit_vsjaka_plot_chelovecha_znamennyj_raspev_grind_Moscow_Patriarchal_Choir.ogg',
    duration: 391,
    attribution: 'Let All Mortal Flesh Keep Silence, Znamenny chant — “Old Russian Chant” choir of the Moscow Patriarchate, CC0 (Wikimedia Commons)'
  }
]);

export function findChant(id) {
  return CHAPEL_CHANTS.find(chant => chant.id === id) || null;
}

export function chantsInFamily(family) {
  return CHAPEL_CHANTS.filter(chant => chant.family === family);
}

/**
 * A family's tracks as one playback program, in registry order — the
 * bed plays the family through, then rests in a long silence gap and
 * begins again (spec: a chant that visibly "restarts" breaks the
 * room; a slow liturgical alternation does not).
 */
export function chantProgram(family) {
  const tracks = chantsInFamily(family);
  return tracks.length ? tracks : null;
}
