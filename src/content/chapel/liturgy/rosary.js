/**
 * The Rosary — fixed liturgical data (spec §4, non-negotiable #3:
 * fixed forms are fixed).
 *
 * The prayers are the traditional English forms, centuries old and
 * public domain, byte-fixed here: no template, no variation, no
 * probabilistic anything. The twenty mysteries with their fruits are
 * as the user supplied them (2026-07-22). The day mapping is the
 * Church's traditional assignment.
 *
 * Nothing in this module decides; it only states the form.
 */

import { freezeManifest } from '../../atrium/constants.js';

export const ROSARY_PRAYERS = freezeManifest({
  signOfTheCross:
    'In the name of the Father, and of the Son, and of the Holy Spirit. Amen.',

  apostlesCreed:
    'I believe in God, the Father almighty, Creator of heaven and earth, '
    + 'and in Jesus Christ, his only Son, our Lord, who was conceived by the Holy Spirit, '
    + 'born of the Virgin Mary, suffered under Pontius Pilate, was crucified, died and was buried; '
    + 'he descended into hell; on the third day he rose again from the dead; '
    + 'he ascended into heaven, and is seated at the right hand of God the Father almighty; '
    + 'from there he will come to judge the living and the dead. '
    + 'I believe in the Holy Spirit, the holy catholic Church, the communion of saints, '
    + 'the forgiveness of sins, the resurrection of the body, and life everlasting. Amen.',

  ourFather:
    'Our Father, who art in heaven, hallowed be thy name; thy kingdom come; '
    + 'thy will be done on earth as it is in heaven. Give us this day our daily bread; '
    + 'and forgive us our trespasses as we forgive those who trespass against us; '
    + 'and lead us not into temptation, but deliver us from evil. Amen.',

  hailMary:
    'Hail Mary, full of grace, the Lord is with thee; blessed art thou among women, '
    + 'and blessed is the fruit of thy womb, Jesus. '
    + 'Holy Mary, Mother of God, pray for us sinners, now and at the hour of our death. Amen.',

  gloryBe:
    'Glory be to the Father, and to the Son, and to the Holy Spirit. '
    + 'As it was in the beginning, is now, and ever shall be, world without end. Amen.',

  fatimaPrayer:
    'O my Jesus, forgive us our sins, save us from the fires of hell; '
    + 'lead all souls to heaven, especially those in most need of thy mercy. Amen.',

  hailHolyQueen:
    'Hail, holy Queen, Mother of mercy, our life, our sweetness, and our hope. '
    + 'To thee do we cry, poor banished children of Eve. '
    + 'To thee do we send up our sighs, mourning and weeping in this valley of tears. '
    + 'Turn, then, most gracious advocate, thine eyes of mercy toward us, '
    + 'and after this, our exile, show unto us the blessed fruit of thy womb, Jesus. '
    + 'O clement, O loving, O sweet Virgin Mary. '
    + 'Pray for us, O holy Mother of God, that we may be made worthy of the promises of Christ.',

  closingPrayer:
    'O God, whose only begotten Son, by his life, death, and resurrection, '
    + 'has purchased for us the rewards of eternal life: grant, we beseech thee, '
    + 'that meditating upon these mysteries of the most holy Rosary of the Blessed Virgin Mary, '
    + 'we may imitate what they contain and obtain what they promise, '
    + 'through the same Christ our Lord. Amen.'
});

export const MYSTERY_SETS = freezeManifest({
  joyful: {
    id: 'joyful',
    name: 'The Joyful Mysteries',
    days: [1, 6], // Monday, Saturday
    daysLabel: 'Monday & Saturday',
    mysteries: [
      { title: 'The Annunciation of the Lord to Mary', fruit: 'Mary is chosen to be the mother of Jesus.' },
      { title: 'The Visitation of Mary to Elizabeth', fruit: 'Elizabeth recognizes Mary as the mother of our Lord.' },
      { title: 'The Nativity of our Lord Jesus Christ', fruit: 'Jesus is born and laid in a manger.' },
      { title: 'The Presentation of our Lord', fruit: 'Jesus is presented in the Temple of Jerusalem.' },
      { title: 'Finding Jesus in the Temple at age 12', fruit: "Jesus is found discussing God's laws in the temple." }
    ]
  },
  sorrowful: {
    id: 'sorrowful',
    name: 'The Sorrowful Mysteries',
    days: [2, 5], // Tuesday, Friday
    daysLabel: 'Tuesday & Friday',
    mysteries: [
      { title: 'The Agony of Jesus in the Garden', fruit: 'Jesus prays when confronted with the sins of the world.' },
      { title: 'The Scourging at the Pillar', fruit: 'Jesus is whipped before His execution.' },
      { title: 'Jesus is Crowned with Thorns', fruit: 'Jesus is mocked with a painful crown of thorns.' },
      { title: 'Jesus Carries the Cross', fruit: 'Jesus carries the weight of our sins to His crucifixion.' },
      { title: 'The Crucifixion of our Lord', fruit: 'Jesus Christ dies to save all mankind.' }
    ]
  },
  glorious: {
    id: 'glorious',
    name: 'The Glorious Mysteries',
    days: [3, 0], // Wednesday, Sunday
    daysLabel: 'Wednesday & Sunday',
    mysteries: [
      { title: 'The Resurrection of Jesus Christ', fruit: 'Jesus rises triumphant over death.' },
      { title: 'The Ascension of Jesus to Heaven', fruit: 'As Jesus ascends, He gives us a special task.' },
      { title: 'The Descent of the Holy Ghost', fruit: 'At Pentecost the Church is born.' },
      { title: 'The Assumption of Mary into Heaven', fruit: 'The Virgin Mary is gloriously assumed into heaven.' },
      { title: 'Mary is Crowned as Queen of Heaven and Earth', fruit: 'Mary is honored above all creatures.' }
    ]
  },
  luminous: {
    id: 'luminous',
    name: 'The Luminous Mysteries',
    days: [4], // Thursday
    daysLabel: 'Thursday',
    mysteries: [
      { title: 'The Baptism in the Jordan', fruit: 'God proclaims Jesus is His Son.' },
      { title: 'The Wedding at Cana', fruit: 'Jesus performs a surprising miracle at a wedding.' },
      { title: 'The Proclamation of the Kingdom', fruit: 'Jesus calls us to do something important.' },
      { title: 'The Transfiguration', fruit: 'Jesus is gloriously transformed.' },
      { title: 'The Institution of the Eucharist', fruit: 'Jesus shares His Body and Blood for our salvation.' }
    ]
  }
});

/**
 * The Church's traditional day assignment — the same date-sensing
 * instinct as SOL's hours, raised to the calendar.
 * @param {Date} [date]
 * @returns {string} a MYSTERY_SETS id
 */
export function mysterySetForDate(date = new Date()) {
  const day = date.getDay();
  for (const set of Object.values(MYSTERY_SETS)) {
    if (set.days.includes(day)) return set.id;
  }
  return 'glorious'; // unreachable: all seven days are assigned
}

/**
 * Recitation pacing at 1.0× — prayers are SPOKEN forms, not read
 * text (spec: a Hail Mary is ~12–14 seconds; each repetition is one
 * atom-group at fixed duration). The global pace multiplier applies
 * on top.
 */
export const PRAYER_DURATIONS_MS = Object.freeze({
  signOfTheCross: 7000,
  apostlesCreed: 38000,
  ourFather: 22000,
  hailMary: 13000,
  gloryBe: 10000,
  fatimaPrayer: 11000,
  hailHolyQueen: 34000,
  closingPrayer: 24000,
  mysteryAnnouncement: 9000
});
