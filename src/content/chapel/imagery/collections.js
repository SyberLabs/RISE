/**
 * The Chapel's pinned collections — sacred imagery for Scripture
 * reading, the Rosary's mysteries, and (stage 6) the Stations.
 *
 * CURATION: every work below was rendered on a contact sheet and
 * reviewed by a human (2026-07-22, nativity re-reviewed same day) before being pinned. All rights
 * verified at pin time with STATED declarations: Met isPublicDomain,
 * Cleveland/AIC CC0, Rijksmuseum Public Domain Mark/CC0 on the
 * VisualItem. The comment beside each id names the work so a silent
 * upstream change is detectable without an API call.
 *
 * Works deliberately CUT in review, as examples of what the human
 * step catches and no filter would:
 *   - Caravaggio's Crucifixion of SAINT ANDREW and a Berlinghiero
 *     St. Andrew panel — a different cross, a different martyrdom,
 *     both titles honestly containing "Crucifixion"
 *   - Balthasar and Caspar single-king fragments of a dismembered
 *     Adoration altarpiece — halves of a subject, not the subject
 *   - A Pisan portrait medal filed under "Resurrection" (its reverse)
 *   - Nativity re-review: five limestone fragments of a dismembered
 *     Adoration group, a tabernacle house altar, a rock-crystal
 *     intaglio, an in-situ apse fresco, an enamel plaque, a bronze
 *     relief, and the family of Zebedee wearing an Annunciation
 *     search result
 *
 * SCOPING (spec §5): these collections are Chapel-exclusive. They
 * never appear in the browsable Collections panel, and the cortex
 * routes chapel-* ids with NO Wikimedia fallback — a collection that
 * cannot resolve yields stillness, never a wrong image.
 */

import { freezeManifest } from '../../atrium/constants.js';

export const CHAPEL_PINNED_COLLECTIONS = freezeManifest({
    'chapel-crucifixion': {
        name: 'The Crucifixion',
        works: [
            { source: 'cleveland', id: 112856 },  // The Crucifixion with a Carthusian Monk — Rogier van der Weyden (Flemish, c. — 1460
            { source: 'cleveland', id: 97136 },  // The Crucifixion — Andrea da Firenze (Italian, 1379) — c. 1360s
            { source: 'cleveland', id: 97181 },  // Preparation for the Crucifixion — unknown — early 1600s
            { source: 'cleveland', id: 119698 },  // The Crucifixion — Matteo di Giovanni (Italian, c. 14 — 1470s
            { source: 'cleveland', id: 136864 },  // Portable Triptych Icon: The Crucifixion — unknown — 1600s
            { source: 'cleveland', id: 97147 },  // The Crucifixion — Sodoma (Italian, 1477–1549) — 16th century
            { source: 'cleveland', id: 141220 },  // Calvary with a Carthusian Monk — Jean de Beaumetz (French, c. 1335– — 1389–95
            { source: 'cleveland', id: 127664 },  // Crucifixion — unknown — 1800s
            { source: 'met', id: 436282 },  // The Crucifixion; The Last Judgment — Jan van Eyck — ca. 1436–38
            { source: 'met', id: 436098 },  // The Crucifixion — Gerard David — ca. 1495
            { source: 'cleveland', id: 133841 },  // Crucifixion with the Two Thieves — unknown — 1450–1500
            { source: 'cleveland', id: 125553 },  // The Crucifixion with Four Angels — Martin Schongauer (German, c. 1450 — c. 1475
            { source: 'cleveland', id: 423576 },  // Leaf from a Missal: The Crucifixion (recto) — unknown — c. 1330–40
            { source: 'cleveland', id: 169738 },  // Leaf from a Psalter: The Crucifixion — unknown — c. 1300–1330
            { source: 'aic', id: 80084 },  // The Crucifixion — Francisco de Zurbarán (Spanish, 15 — 1627
            { source: 'aic', id: 111622 },  // The Crucifixion — Carlo Crivelli (Italian, about 143 — c. 1487
            { source: 'aic', id: 52560 },  // Corpus of Christ, from the Altarpiece of the Crucifixion — Jacques de Baerze (Netherlandish,  — 1391–99
            { source: 'rijks', id: 200107790 },  // The Crucifixion — unknown — [SK-A-4008]
            { source: 'rijks', id: 200108795 },  // Triptych with the Crucifixion — unknown — [SK-A-1408]
            { source: 'rijks', id: 200109201 },  // The Crucifixion — unknown — [SK-A-1967]
            { source: 'rijks', id: 200109300 },  // The Crucifixion — unknown — [SK-A-3401]
            { source: 'rijks', id: 200109301 },  // The Crucifixion — unknown — [SK-A-4000]
            { source: 'rijks', id: 200109302 },  // The Crucifixion with Mary, John, Mary Magdalene, St Longin — unknown — [SK-C-1596]
            { source: 'rijks', id: 200109461 },  // Christus aan het kruis — unknown — [SK-A-2212]
            { source: 'rijks', id: 200110529 },  // Christus aan het kruis met Maria en Johannes — unknown — [SK-A-4461]
        ]
    },

    'chapel-passion': {
        name: 'The Passion',
        works: [
            { source: 'cleveland', id: 94846 },  // Pietà — unknown — late 1500s
            { source: 'cleveland', id: 102535 },  // Ecce Homo — Albrecht Dürer (German, 1471–1528) — 1515
            { source: 'cleveland', id: 115456 },  // Ecce Homo (Behold the Man) — Antonio Abondio (Italian, 1538–159 — c. 1600
            { source: 'cleveland', id: 164752 },  // Ecce Homo. Christ Presented to the People — Rembrandt van Rijn (Dutch, 1606–16 — 1655
            { source: 'cleveland', id: 104612 },  // The Passion: Ecce Homo — Martin Schongauer (German, c. 1450 — c. 1480
            { source: 'cleveland', id: 105865 },  // The Passion: Ecce Homo — Hieronymus Wierix (Flemish, 1553–1 — before 1619
            { source: 'cleveland', id: 105645 },  // The Round Passion: Ecce Homo — Lucas van Leyden (Netherlandish, 1 — 1509
            { source: 'cleveland', id: 105669 },  // The Passion: Ecce Homo — Hendrick Goltzius (Dutch, 1558–161 — 1597
            { source: 'cleveland', id: 169323 },  // Ecce Homo — Giuseppe Scolari (Italian) — late 1500s-early 1600s
            { source: 'cleveland', id: 148132 },  // Passion Set: Ecce Homo — Zacharias Dolendo (Dutch, 1561–160 — 1596–98
            { source: 'cleveland', id: 113339 },  // The Fall and Redemption of Man: Ecce Homo — Albrecht Altdorfer (German, c. 148 — c. 1515
            { source: 'met', id: 472158 },  // The Agony in the Garden — unknown — ca. 1390
            { source: 'met', id: 437371 },  // The Agony in the Garden — Raphael (Raffaello Sanzio or Santi — ca. 1504
            { source: 'met', id: 442488 },  // The Agony in the Garden — Nicolas Poussin — 1626–27
            { source: 'met', id: 469915 },  // Roundel with Agony in the Garden — unknown — ca. 1515
            { source: 'met', id: 470907 },  // The Agony in the Garden and The Betrayal (from Scenes from — unknown — early 16th century
            { source: 'met', id: 210779 },  // The Agony in the Garden (one of seven) — Jean II Pénicaud — mid-16th century
            { source: 'met', id: 191609 },  // The Agony in the Garden — Massimiliano Soldani — early 18th century
            { source: 'met', id: 400653 },  // Agony in the Garden — Benoit Thiboust — 1680–1719
            { source: 'met', id: 400629 },  // Agony in the Garden — Robert van Audenaerde — 1680–1743
            { source: 'met', id: 391235 },  // Agony in the Garden — Albrecht Dürer — 1515
            { source: 'met', id: 370807 },  // Agony in the Garden — Caspar Strauss — 1600–1633
            { source: 'met', id: 391237 },  // Agony in the Garden — Albrecht Dürer — 1515
            { source: 'met', id: 388411 },  // Agony in the Garden — Albrecht Dürer — 1497–1500
            { source: 'met', id: 391236 },  // Agony in the Garden — Albrecht Dürer — 1515
            { source: 'met', id: 336475 },  // Agony in the Garden — Anonymous, Spanish, School of Sevi — 17th century
            { source: 'met', id: 459233 },  // Agony in the Garden — German — ca. 1500
            { source: 'met', id: 359960 },  // Agony in the Garden — Albrecht Dürer — 1515
            { source: 'met', id: 387723 },  // The Agony in the Garden — Albrecht Dürer — n.d.
            { source: 'met', id: 392062 },  // The Agony in the Garden — Rembrandt (Rembrandt van Rijn) — ca. 1652
            { source: 'met', id: 392064 },  // The Agony in the Garden — Rembrandt (Rembrandt van Rijn) — ca. 1652
            { source: 'met', id: 392063 },  // The Agony in the Garden — Rembrandt (Rembrandt van Rijn) — ca. 1652
            { source: 'met', id: 336227 },  // The Agony in the Garden — Anonymous, Italian, 17th or 18th c — 1600–1800
            { source: 'met', id: 340214 },  // The Agony in the Garden — Anonymous, Italian, 16th century — 16th century
            { source: 'met', id: 336527 },  // The Agony in the Garden — Eugène Delacroix — 1823–24
            { source: 'met', id: 747560 },  // The Agony in the Garden — Eugène Delacroix — ca. 1849
            { source: 'met', id: 773272 },  // The Agony in the Garden, from 'Iconographia' — Melchior Küsel — 1670
            { source: 'aic', id: 234781 },  // Christ Carrying the Cross — Sebastiano del Piombo (Italian, c. — c. 1515–17
            { source: 'rijks', id: 200109204 },  // Bewening van Christus — unknown — [SK-A-856]
            { source: 'rijks', id: 200110538 },  // Memorial Triptych, formerly called the Gertz Memorial Trip — unknown — [SK-A-4488]
            { source: 'rijks', id: 20027001 },  // De bewening van Christus — unknown — [SK-A-783]
            { source: 'rijks', id: 20027487 },  // Triptych with the Lamentation — unknown — [SK-A-2123]
            { source: 'rijks', id: 20027682 },  // De bewening van Christus — unknown — [SK-A-4219]
            { source: 'rijks', id: 20027683 },  // Drieluik met de bewening van Christus — unknown — [SK-A-2392]
            { source: 'rijks', id: 20027969 },  // The Lamentation — unknown — [SK-C-522]
            { source: 'rijks', id: 20028309 },  // Maria en Johannes wenend bij het lichaam van Christus — unknown — [SK-A-3325]
            { source: 'rijks', id: 20027041 },  // The Descent from the Cross — unknown — [SK-A-75]
            { source: 'rijks', id: 2004499 },  // The Descent from the Cross — unknown — [SK-A-2311]
        ]
    },

    'chapel-nativity': {
        name: 'The Nativity',
        works: [
            { source: 'cleveland', id: 135311 },  // The Nativity — Gerard David (Netherlandish, 1450/ — c. 1485–90
            { source: 'cleveland', id: 130980 },  // The Annunciation and The Nativity — Jaume Ferrer the Younger (Spanish, — c. 1457
            { source: 'cleveland', id: 130982 },  // The Nativity — Jaume Ferrer the Younger (Spanish, — c. 1457
            { source: 'cleveland', id: 115394 },  // Adoration of the Magi — Konrad Laib (German) — early 1440s
            { source: 'cleveland', id: 97171 },  // Adoration of the Shepherds — Hans Leonhard Schäufelein (German) — c. 1510
            { source: 'cleveland', id: 122223 },  // The Adoration of the Magi — Giovanni di Paolo (Italian, c. 140 — 1440–45
            { source: 'cleveland', id: 128389 },  // The Adoration of the Magi — Geertgen tot Sint Jans (Netherland — 1480s
            { source: 'cleveland', id: 120995 },  // Triptych with the Adoration of the Magi — unknown — c. 1424
            { source: 'cleveland', id: 134620 },  // Adoration of the Magi — Titian (Italian, c. 1488–1576) — 1500s
            { source: 'cleveland', id: 144303 },  // Adoration of the Magi — Guido Reni (Italian, 1575–1642) — 1642
            { source: 'cleveland', id: 120996 },  // The Adoration of the Magi — unknown — c. 1424
            { source: 'met', id: 436984 },  // The Adoration of the Magi — Quinten Massys — 1526
            { source: 'met', id: 436966 },  // The Adoration of the Shepherds — Andrea Mantegna — shortly after 1450
            { source: 'met', id: 436570 },  // The Adoration of the Shepherds — El Greco (Domenikos Theotokopoulos — ca. 1605–10
            { source: 'met', id: 470600 },  // The Adoration of the Shepherds — Bartolo di Fredi — 1374
            { source: 'met', id: 436803 },  // The Adoration of the Magi — Joos van Wassenhove — 1472–74
            { source: 'met', id: 436504 },  // The Adoration of the Magi — Giotto di Bondone — possibly ca. 1320
            { source: 'met', id: 458956 },  // The Adoration of the Magi — Bartolo di Fredi — ca. 1390
            { source: 'met', id: 459208 },  // Adoration of the Shepherds — Francesco di Marco Marmitta da Par — ca. 1500
            { source: 'met', id: 472155 },  // Adoration of the Magi from Seven Scenes from the Life of C — unknown — ca. 1390
            { source: 'met', id: 469959 },  // Adoration of the Magi from Seven Scenes from the Life of C — unknown — ca. 1390
            { source: 'met', id: 437789 },  // The Adoration of the Magi — Giovanni Battista Tiepolo — late 1750s
            { source: 'met', id: 437231 },  // The Adoration of the Shepherds — L'Ortolano (Giovanni Battista Benv — late 1520s
            { source: 'met', id: 436104 },  // The Adoration of the Magi — Gerard David — ca. 1520
            { source: 'met', id: 769294 },  // The Adoration of the Shepherds — Girolamo da Carpi (Girolamo Sellar — ca. 1535–40
            { source: 'met', id: 436509 },  // The Adoration of the Magi — Giovanni di Paolo (Giovanni di Pao — ca. 1460
            { source: 'met', id: 435724 },  // The Adoration of the Magi — Hieronymus Bosch — ca. 1475
            { source: 'met', id: 436571 },  // The Adoration of the Shepherds — El Greco (Domenikos Theotokopoulos — ca. 1612–14
            { source: 'met', id: 459133 },  // The Adoration of the Magi — Italian, Neapolitan Follower of Gi — ca. 1340–43
            { source: 'aic', id: 16327 },  // The Annunciation — Jean Hey (Master of Moulins; Nethe — 1490–95
            { source: 'aic', id: 80530 },  // Virgin and Child with an Angel — Sandro Botticelli (Italian, 1444/4 — 1475–85
            { source: 'aic', id: 184371 },  // The Nativity — Fra Bartolommeo (Baccio della Port — 1504–7
            { source: 'rijks', id: 200106080 },  // The Adoration of the Magi — unknown — [SK-A-5082]
            { source: 'rijks', id: 200107773 },  // The Adoration of the Magi — unknown — [SK-A-671]
            { source: 'rijks', id: 200107955 },  // The Adoration of the Christ Child — unknown — [SK-A-3419]
            { source: 'rijks', id: 200108122 },  // The Adoration of the Magi — unknown — [SK-C-1458]
            { source: 'rijks', id: 200108423 },  // The Adoration of the Shepherds — unknown — [SK-A-74]
            { source: 'rijks', id: 200109187 },  // The Adoration of the Shepherds — unknown — [SK-A-789]
            { source: 'rijks', id: 200108947 },  // Annunciation to the Shepherds — unknown — [SK-A-2304]
            { source: 'rijks', id: 200109730 },  // Triptych with Virgin and Child with Saints (center), male  — unknown — [SK-A-3141]
            { source: 'rijks', id: 20025780 },  // The Annunciation — unknown — [SK-A-4704]
            { source: 'rijks', id: 20025782 },  // Annunciation to the Virgin — unknown — [SK-A-282]
            { source: 'rijks', id: 20025868 },  // The Annunciation — unknown — [SK-A-2592]
            { source: 'rijks', id: 20026246 },  // The Annunciation to the Shepherds — unknown — [SK-A-801]
            { source: 'rijks', id: 20026408 },  // Angel from the Annunciation to the Virgin — unknown — [SK-A-3986]
        ]
    },

    'chapel-resurrection': {
        name: 'The Resurrection',
        works: [
            { source: 'cleveland', id: 78982 },  // The Resurrection of Christ — Johann König (German, 1586–1642) — 1622
            { source: 'cleveland', id: 159717 },  // The Resurrection of Christ — Philip Galle (Flemish, 1537–1612) — c. 1562
            { source: 'cleveland', id: 111407 },  // The Resurrection, from an Altar Frontal — unknown — 1375–1400
            { source: 'cleveland', id: 130151 },  // Ascension of Christ — Albrecht Dürer (German, 1471–1528) — c. 1515
            { source: 'cleveland', id: 124809 },  // The Resurrection of Christ — John La Farge (American, 1835–1910 — c. 1902
            { source: 'cleveland', id: 131367 },  // Leaf from a Gradual: Historiated Initial R: The Resurrecti — unknown — mid-1300s
            { source: 'cleveland', id: 108390 },  // The Resurrection — Albrecht Dürer (German, 1471–1528) — 1510
            { source: 'cleveland', id: 423574 },  // Leaf from a Gradual: Historiated Initial R: The Resurrecti — unknown — mid-1300s
            { source: 'cleveland', id: 134264 },  // Christ Appearing to the Magdalen — Martin Schongauer (German, c. 1450 — 1480–90
            { source: 'cleveland', id: 107738 },  // Resurrection of Christ — unknown — 1400s
            { source: 'cleveland', id: 136863 },  // Portable Triptych Icon: The Resurrection and Anastasis — unknown — 1600s
            { source: 'cleveland', id: 106440 },  // Supper at Emmaus — Israhel van Meckenem (German, c. 1 — c. 1480
            { source: 'cleveland', id: 112231 },  // Antiphonary: Initial A, Resurrection — Girolamo da Cremona (Italian) — c. 1470–80
            { source: 'cleveland', id: 133419 },  // Leaf from a Gradual: Initial (R) with the Three Marys at t — unknown — c. 1270–1300
            { source: 'cleveland', id: 108557 },  // Descent into Limbo — Giovanni Antonio da Brescia (Itali — c. 1490–1500
            { source: 'cleveland', id: 146788 },  // The Transfiguration — Camillo Procaccini (Italian, 1546– — 1587–90
            { source: 'cleveland', id: 164726 },  // Missale: Fol. 192v: Resurrection of Christ — Bartolommeo Caporali (Italian, c.  — 1469
            { source: 'met', id: 469858 },  // Diptych with Scenes of the Annunciation, Nativity, Crucifi — unknown — 1300–1325
            { source: 'met', id: 210781 },  // The Resurrection (one of seven) — Jean II Pénicaud — mid-16th century
            { source: 'met', id: 633752 },  // Resurrection of Christ — Ugo da Carpi — ca. 1520–27
            { source: 'met', id: 747592 },  // The Resurrection of Lazarus — Jan Lievens — 1620–74
            { source: 'met', id: 193237 },  // Christ of the Resurrection — unknown — early 16th century
            { source: 'met', id: 380385 },  // Resurrection of Christ — Anonymous, Netherlandish, 16th cen — late 16th–early 17th century
            { source: 'met', id: 730792 },  // The Resurrection of Christ — Lodovico Mattioli — ca. 1700–40
            { source: 'met', id: 335676 },  // Resurrection of Lazarus — Salvatore Castiglione — 1645
            { source: 'met', id: 195380 },  // Resurrection of Christ — Moderno (Galeazzo Mondella) — late 15th–early 16th century
            { source: 'met', id: 429010 },  // Resurrection of Christ — Albrecht Altdorfer — 1512
            { source: 'met', id: 399628 },  // Resurrection of Christ — Melchior Meier — 1577
            { source: 'met', id: 340381 },  // The Resurrection of Christ — Anonymous, Italian, Roman-Bolognes — 17th century
            { source: 'met', id: 207529 },  // The Resurrection of Christ — unknown — 17th century
            { source: 'met', id: 364383 },  // Resurrection of the Dead (lower left section of the Last J — Niccolò della Casa — 1548
            { source: 'met', id: 437569 },  // The Resurrection of Christ and the Harrowing of Hell — Russian Painter
            { source: 'met', id: 437564 },  // The Resurrection of Christ and the Harrowing of Hell — Russian Painter
            { source: 'met', id: 389422 },  // Design for a Title Page - Angel of the Resurrection — Anonymous, Italian, 17th century — 17th century
            { source: 'met', id: 817522 },  // The Resurrection of Christ, with soldiers awakening before — Martino Rota — 1565–83
            { source: 'met', id: 388531 },  // The Feast of the Resurrection in Piazza Navona, Rome, 1650 — Dominique Barrière — ca. 1650
            { source: 'met', id: 340679 },  // Design for a Frescoed Altarpiece of The Resurrection — Maso da San Friano (Tommaso Manzuo — ca. 1560–71
            { source: 'met', id: 399338 },  // The Resurrection of Lazarus (La Resurrection de Lazare), s — Jacques Callot — 1635
            { source: 'met', id: 383739 },  // Allegory of the Salvation of Mankind from "Allegory of the — Hieronymus (Jerome) Wierix — ca. 1586
            { source: 'met', id: 385682 },  // The Nativity with Scenes of The Annunciation, The Adoratio — Abraham Bosse — 1620–76
            { source: 'met', id: 399401 },  // Altar with the Resurrection of Christ, plate 2 from "Nouve — Jean Le Pautre — ca. 1640–82
            { source: 'met', id: 464135 },  // Diptych Leaf with the Resurrection and the Coronation of t — unknown — 1340–1360
            { source: 'met', id: 205702 },  // The Resurrection of the Dead and the Last Judgment (revers — Bertoldo di Giovanni — ca. 1468–69
            { source: 'rijks', id: 200109462 },  // De opstanding van Christus — unknown — [SK-A-2130]
            { source: 'rijks', id: 20027684 },  // Fragment with the Transfiguration of Christ (Resurrection) — unknown — [SK-A-2596]
            { source: 'rijks', id: 20028298 },  // Panel of an Altarpiece with Circumcision of Christ, on ver — unknown — [SK-A-1308]
        ]
    },

    'chapel-prophets': {
        name: 'The Prophets',
        works: [
            { source: 'met', id: 374030 },  // Belshazzar's Feast — Jan Muller — ca. 1598
            { source: 'cleveland', id: 155978 },  // Elijah in the Wilderness Fed by Ravens — Jan Saenredam (Dutch, 1565–1607) — 1604
            { source: 'cleveland', id: 128378 },  // Elijah and the Widow of Zarephath — unknown — c. 1525
            { source: 'cleveland', id: 155979 },  // Elisha and Elijah's Chariot of Fire — Jan Saenredam (Dutch, 1565–1607) — 1604
            { source: 'cleveland', id: 163656 },  // A raven brings food to Elijah (folio 72 recto), from a Mir — unknown — 1602–4
            { source: 'cleveland', id: 150444 },  // Elijah Ascends to Heaven — Augustin Hirschvogel (German, 1503 — 1547
            { source: 'cleveland', id: 108967 },  // Chapel of Elijah on Mount Horeb — David Roberts (Scottish, 1796–1864 — 1839
            { source: 'cleveland', id: 108185 },  // Der Schatzbehalter: The Return of Tobias to Tobit; The Arr — Michael Wolgemut (German, 1434–151 — 1491
            { source: 'cleveland', id: 103861 },  // Six large upright landscapes with scenes from the Old Test — Anthonie Waterloo (Dutch, 1609/10– — 1640–90
            { source: 'cleveland', id: 124000 },  // Six large upright landscapes with scenes from the Old Test — Anthonie Waterloo (Dutch, 1609/10– — 1640–90
            { source: 'cleveland', id: 674083 },  // Jonah Cast Out by the Whale onto the Shore of Nineveh — Maarten van Heemskerck (Dutch, 149 — 1566
            { source: 'cleveland', id: 151455 },  // Plate Depicting Jonah — unknown — late 1500s
            { source: 'rijks', id: 20026270 },  // Elijah fed by the ravens — unknown — [SK-A-1297]
            { source: 'rijks', id: 20027715 },  // De hemelvaart van Elia — unknown — [SK-A-1617]
            { source: 'rijks', id: 20028755 },  // The Prophet Elijah Awakened in the Desert by an Angel — unknown — [SK-A-4129]
            { source: 'rijks', id: 200107946 },  // Jeremiah Lamenting the Destruction of Jerusalem — unknown — [SK-A-3276]
            { source: 'rijks', id: 20026737 },  // Pashur Smiting Jeremiah in the Temple — unknown — [SK-A-845]
            { source: 'rijks', id: 200109660 },  // The Old Prophet meets the Man of God — unknown — [SK-A-2814]
            { source: 'aic', id: 97438 },  // The Prophet Elijah Arriving at the House of the Widow of S — Jan Saenredam (Dutch, 1565-1607) — 1604
            { source: 'aic', id: 268710 },  // Prophet Elijah with the Widow Zarephath — Jan Saenredam (Dutch, 1565–1607) — 1604
            { source: 'aic', id: 268632 },  // Prophet Elijah with the Widow of Zarephath — Jan Saenredam (Dutch, 1565–1607) — 1604
            { source: 'aic', id: 44 },  // The Prophet Amos — Attributed to Baccio Baldini — c. 1470
            { source: 'aic', id: 18472 },  // The Ascent of the Prophet to Heaven, Page from the Khamsa  — Iran — Safavid dynasty (1501–1722), c
            { source: 'aic', id: 4217 },  // Prophet Haggai — Attributed to Baccio Baldini — c. 1470
            { source: 'aic', id: 4214 },  // The Prophet Moses — Attributed to Baccio Baldini — c. 1470
            { source: 'aic', id: 40725 },  // The Prophet Jeremiah — Nicolas Beatrizet (French, 1515-af — 1547
            { source: 'aic', id: 95603 },  // The Prophet Jeremiah — Giorgio Ghisi (Italian, 1520-1582) — early 1570s
            { source: 'aic', id: 71543 },  // Prophet in a Historiated Initial "O" from a Gradual — Don Silvestro dei Gherarducci — 1392/99
            { source: 'aic', id: 135441 },  // The Prophet Joel — Giorgio Ghisi (Italian, 1520-1582) — c. 1570
            { source: 'aic', id: 82386 },  // Seated Prophet or Evangelist Writing — Giuseppe Porta, called Giuseppe Sa — n.d.
            { source: 'aic', id: 111858 },  // The Prophet Amos — Attributed to Francesco Rosselli — 1480/90
            { source: 'aic', id: 54880 },  // Standing Prophet or Apostle — After Pellegrino Tibaldi (Italian, — 1545/50
            { source: 'aic', id: 85758 },  // Standing Prophet with a Book and Scroll — Taddeo Zuccaro — 1562/66
            { source: 'aic', id: 82451 },  // Jonah Cast Up by the Whale — After Jacopo Robusti, called Tinto — 17th century
            { source: 'aic', id: 26709 },  // Jonah Outside Ninevah (recto); Habakkuk Carrying Bread to  — Hans Holbein, the younger — n.d.
            { source: 'aic', id: 268121 },  // The Prophet Jonah, from Landscapes with Biblical Subjects  — Johannes van Doetecum (Netherlandi — c. 1562
            { source: 'aic', id: 229142 },  // Daniel in the Lion's Den, from Landscapes with Old and New — Adriaen Collaert (Flemish, c. 1560 — 1584
        ]
    },

    'chapel-patriarchs': {
        name: 'The Patriarchs',
        works: [
            { source: 'met', id: 437180 },  // The Rebuke of Adam and Eve — Charles Joseph Natoire — 1740
            { source: 'met', id: 435823 },  // Adam; Eve — Giuliano di Piero di Simone Bugiar — ca. 1520
            { source: 'cleveland', id: 117032 },  // The Sacrifice of Isaac — Andrea del Sarto (Italian, 1486–15 — c. 1527
            { source: 'cleveland', id: 124129 },  // Footed Dish Depicting Abraham and Isaac — Ludovico and Angelo Picchi — c. 1545–63
            { source: 'cleveland', id: 129802 },  // The Sacrifice of Isaac — Francesco Guardi (Italian, 1712–17 — 1750s
            { source: 'cleveland', id: 144592 },  // Abraham Going to Sacrifice Isaac — Lucas van Leyden (Netherlandish, 1 — 1517–19
            { source: 'cleveland', id: 129801 },  // The Sacrifice of Isaac, Tobias and the Angel, The Angels A — Francesco Guardi (Italian, 1712–17 — 1750s
            { source: 'cleveland', id: 144255 },  // The Oath of Abraham’s Servant — Giovanni Benedetto Castiglione (It — c. 1650–59
            { source: 'cleveland', id: 120295 },  // Abraham and Isaac — Rembrandt van Rijn (Dutch, 1606–16 — 1645
            { source: 'cleveland', id: 146416 },  // Noah: The Eve of the Deluge — John Linnell (British, 1792–1882) — 1848
            { source: 'cleveland', id: 157088 },  // Noah and the Animals Entering the Ark — Giovanni Benedetto Castiglione (It — 1650–55
            { source: 'cleveland', id: 150046 },  // Expulsion of Adam and Eve — John Faed (Scottish, 1820–1902) — 1880s
            { source: 'cleveland', id: 329314 },  // Abraham Casting Out Hagar and Ishmael — Pieter de Grebber (Dutch, 1590–166 — c. 1630s–50s
            { source: 'cleveland', id: 108794 },  // Abraham Casting out Hagar and Ishmael — Rembrandt van Rijn (Dutch, 1606–16 — 1637
            { source: 'cleveland', id: 133161 },  // Tile Plaque: Abraham Expelling Hagar — De Bloempot Factory (Dutch) — c. 1770
            { source: 'cleveland', id: 169928 },  // Egypt and Nubia, Volume II: Hagar Setsilis — Louis Haghe (British, 1806–1885) — 1847
            { source: 'cleveland', id: 123995 },  // Six large upright landscapes with scenes from the Old Test — Anthonie Waterloo (Dutch, 1609/10– — 1640–90
            { source: 'cleveland', id: 123996 },  // Six large upright landscapes with scenes from the Old Test — Anthonie Waterloo (Dutch, 1609/10– — 1640–90
            { source: 'cleveland', id: 168972 },  // Liber Veritatis: No. 133, A Landscape, with Cattle, and th — Richard Earlom (British, 1743–1822 — 1776
            { source: 'cleveland', id: 103865 },  // Six large upright landscapes with scenes from the Old Test — Anthonie Waterloo (Dutch, 1609/10– — 1640–90
            { source: 'cleveland', id: 103867 },  // Six large upright landscapes with scenes from the Old Test — Anthonie Waterloo (Dutch, 1609/10– — 1640–90
            { source: 'rijks', id: 200108023 },  // Pharaoh's Daughter Discovers Moses in the Rush Basket — unknown — [SK-A-4673]
            { source: 'rijks', id: 200108253 },  // Farao's dochter vindt Mozes in het biezen mandje — unknown — [SK-A-1575]
            { source: 'rijks', id: 20026686 },  // Pharaoh's Daughter Discovers Moses in the Rush Basket — unknown — [SK-A-852]
            { source: 'rijks', id: 20027019 },  // Farao's dochter vindt Mozes in het biezen mandje — unknown — [SK-A-4184]
            { source: 'rijks', id: 20027417 },  // Moses Choosing the seventy Elders — unknown — [SK-A-1783]
            { source: 'rijks', id: 20027826 },  // Farao's dochter vindt Mozes in het biezen mandje — unknown — [SK-A-1572]
            { source: 'rijks', id: 20027895 },  // Mozes met de tafelen der wet — unknown — [SK-A-4828]
            { source: 'rijks', id: 20028290 },  // Moses and the Tablets of the Law, the Curse of the Withere — unknown — [SK-A-3409]
            { source: 'rijks', id: 20028972 },  // Moses showing the Tables of the Law with the Ten Commandme — unknown — [SK-A-4487]
            { source: 'rijks', id: 200384576 },  // Finding of Moses — unknown — [BK-NM-1010-241]
            { source: 'rijks', id: 200108748 },  // Het offer van Abraham — unknown — [SK-A-1359]
            { source: 'rijks', id: 20026562 },  // The Exodus from Egypt — unknown — [SK-A-3377]
            { source: 'rijks', id: 200107761 },  // De ontmoeting van Jacob en Rachel — unknown — [SK-A-1485]
            { source: 'rijks', id: 200108228 },  // Jacob van Ruisdael, een watermolen schetsend — unknown — [SK-A-4865]
            { source: 'rijks', id: 200108301 },  // Jacob Wrestling with the Angel — unknown — [SK-A-1724]
            { source: 'rijks', id: 200108381 },  // Jozef legt de bakker en de schenker hun dromen uit — unknown — [SK-A-451]
            { source: 'rijks', id: 20026162 },  // Jozef vertelt zijn dromen — unknown — [SK-A-3477]
            { source: 'rijks', id: 20026405 },  // De ontmoeting van Maria en Elisabeth in aanwezigheid van d — unknown — [SK-A-3955]
            { source: 'rijks', id: 20027740 },  // Joseph Interpreting the Dreams of the Baker and the Butler — unknown — [SK-A-773]
            { source: 'rijks', id: 20027874 },  // Het huwelijk van Maria met Jozef — unknown — [SK-A-109]
            { source: 'rijks', id: 20025861 },  // Noah's Ark — unknown — [SK-A-2624]
            { source: 'rijks', id: 200318048 },  // God roept Adam en Eva ter verantwoording — unknown — [SK-A-4918]
            { source: 'rijks', id: 20027726 },  // Hagar and Ishmael in the Wilderness — unknown — [SK-A-4035]
            { source: 'aic', id: 55033 },  // Moses — after Michelangelo Buonarroti — 1700s
            { source: 'aic', id: 85032 },  // Finding of Moses — After Giovanni Francesco Penni (It — 1518/19
            { source: 'aic', id: 95634 },  // Left Hand of Moses — After Michelangelo Buonarroti — 1725/30
            { source: 'aic', id: 96746 },  // Moses — Franco-Flemish — 1460-1470
            { source: 'aic', id: 77426 },  // Moses and Aaron — Sebald Beham — 1526
            { source: 'aic', id: 48706 },  // Moses — Circle of Bernardino Gatti, called — n.d.
            { source: 'aic', id: 11782 },  // Praying Saint (Moses?) with Christ in a Historiated Initia — Italian (probably Rimini) — c. 1300
            { source: 'aic', id: 96149 },  // Moses Striking the Rock — Attributed to Luca Giordano (Itali — n.d.
            { source: 'aic', id: 118022 },  // Moses and the Burning Bush, from Illustrations of the Bibl — John Martin — 1833
            { source: 'aic', id: 25311 },  // Tazza with Moses Striking Water from the Rock — Jean de Court (French, active c. 1 — 1570–75
            { source: 'aic', id: 25407 },  // Plate with Moses Striking the Rock — Italian; Urbino — c. 1545
            { source: 'aic', id: 31238 },  // Dressing Box Depicting the Finding of Moses and Scenes fro — England — Third quarter of the 17th cent
            { source: 'aic', id: 7572 },  // Jacob Wrestling with the Angel — Francesco Merano — n.d.
            { source: 'aic', id: 74 },  // Three Oriental Figures (Jacob and Laban?) — Rembrandt van Rijn — 1641
            { source: 'aic', id: 218914 },  // Jacob and Esau — Jacob Jordaens — c. 1655
            { source: 'aic', id: 87633 },  // Jacob's Farewell to Benjamin — Follower of Rembrandt van Rijn (Du — c. 1655
            { source: 'aic', id: 51498 },  // Adam and Eve — Albrecht Dürer — 1504
            { source: 'aic', id: 70019 },  // Adam and Eve — Rembrandt van Rijn — 1638
            { source: 'aic', id: 101077 },  // Adam and Eve in Paradise — Francesco Solimena (Italian, 1657– — c. 1700
            { source: 'aic', id: 80764 },  // Adam and Eve — Sebald Beham (German, 1500-1550) — 1543
            { source: 'aic', id: 19956 },  // The "Adam and Eve," Old Chelsea — James McNeill Whistler — 1878
            { source: 'aic', id: 17308 },  // Adam and Eve — Edvard Munch — 1915
            { source: 'aic', id: 4385 },  // Marriage of Adam and Eve — Jean Duvet — 1540/55
            { source: 'aic', id: 95600 },  // Adam and Eve at Work, from The Story of Adam and Eve — Heinrich Aldegrever — 1540
            { source: 'aic', id: 102227 },  // The Expulsion of Adam and Eve from Paradise — Benjamin West (American, active En — 1791, retouched 1803
            { source: 'aic', id: 31321 },  // Picture Depicting Adam and Eve (Needlework) — England — 17th century
            { source: 'aic', id: 4355 },  // Adam and Eve with Infants Cain and Abel — Cristofano Robetta — c. 1500
            { source: 'aic', id: 155943 },  // Adam and Eve (The Fall of Man) — Lucas van Leyden — c. 1514
            { source: 'aic', id: 4358 },  // Adam and Eve with the Infants Cain and Abel — Cristofano Robetta — c. 1500
            { source: 'aic', id: 180722 },  // Adam and Eve in Paradise — figures by Francesco Bartolozzi (I — n.d.
            { source: 'aic', id: 74832 },  // Jug with Adam and Eve — Attributed to Paul Preuning, (Germ — c. 1550
            { source: 'aic', id: 99526 },  // Adam and Eve and the Expulsion from Paradise — Cornelis Cort — 1564
            { source: 'aic', id: 22220 },  // Adam and Eve Driven out of Paradise — Hans Holbein, the younger — n.d.
            { source: 'aic', id: 119972 },  // Pendant with Adam and Eve — Austrian, Vienna — 18th/19th century
            { source: 'aic', id: 85274 },  // Saint Matthew with Adam and Eve and the Tree of Jesse — Marten de Vos — c. 1590/1600
            { source: 'aic', id: 108921 },  // The Creation of Eve, plate one from Adam and Eve — Heinrich Aldegrever — 1540
            { source: 'rijks', id: 200107934 },  // Isaac and Rebecca, Known as ‘The Jewish Bride’ — unknown — [SK-C-216]
            { source: 'rijks', id: 200108254 },  // Abraham Entertaining the Three Angels — unknown — [SK-A-1577]
            { source: 'rijks', id: 20027011 },  // Abraham with the three Angels — unknown — [SK-A-3436]
        ]
    },
});

export function findChapelCollection(id) {
    return Object.hasOwn(CHAPEL_PINNED_COLLECTIONS, id)
        ? CHAPEL_PINNED_COLLECTIONS[id]
        : null;
}

export function hasChapelCollection(id) {
    return Object.hasOwn(CHAPEL_PINNED_COLLECTIONS, id);
}
