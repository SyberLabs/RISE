/**
 * Atrium curated collections — pinned works.
 *
 * Each entry is an explicit list of specific artworks chosen for a
 * subject, pinned by museum object id. This replaces keyword-matched
 * Wikimedia categories, which are filing rather than curation: see
 * ATRIUM-IMAGERY-SPEC.md for the audit that established the difference.
 *
 * CURATION RULE: every work below was rendered on a contact sheet and
 * reviewed by a human before being pinned (spec §7 step 3). The comment
 * beside each id names the work so a future reader can verify the pin
 * without an API call, and so a silent upstream change is detectable.
 *
 * Works deliberately NOT included, as examples of what the review step
 * catches and no metric would:
 *   - "Mlle. Cicero" — a cigarette-card actress, not the orator
 *   - "Winslow Homer", "Homer Schiff Saint-Gaudens" — people named Homer
 *   - Aristotle and Phyllis — a medieval romance motif, not the
 *     philosopher's thought
 *   - Faustina the Younger — Marcus Aurelius's wife, filed under his name
 *   - Coins, medals, and denarii — legible in a vitrine, illegible as a
 *     fullscreen reading surface
 *   - Four near-identical states of one Pietro Testa etching — the
 *     rotation needs variety, not the same plate four times
 *   - "The Reds of the Midi" — a 1896 book poster, wrong register
 *   - "The Fall of the Bastille" — printed cotton furnishing fabric
 *   - Wyon's James Watt — a gold medal, same vitrine problem as coins
 *   - "J. B. Rousseau" — Jean-Baptiste, a different man entirely
 *   - Watt cigarette cards and an unrelated New York ironworks
 */

import { freezeManifest } from '../manifest.js';

export const ATRIUM_PINNED_COLLECTIONS = freezeManifest({
    'atr-plato': {
        name: 'Plato',
        works: [
            { source: 'met', id: 399895 },  // Pietro Testa, Plato's Symposium, 1648
            { source: 'met', id: 387849 },  // Lucas Vorsterman I, The bust of Plato in a niche, ca. 1620
            { source: 'met', id: 446564 },  // Alexander Visits the Sage Plato in his Mountain Cave, 1597–98
            { source: 'met', id: 11385 }    // John La Farge, Socrates and His Friends Discuss The Republic, 1903
        ]
    },

    'atr-socrates': {
        name: 'Socrates',
        works: [
            { source: 'met', id: 436105 },  // Jacques Louis David, The Death of Socrates, 1787
            { source: 'met', id: 426600 },  // David, The Death of Socrates (study), ca. 1782
            { source: 'met', id: 679783 },  // David, The Death of Socrates (study), ca. 1786
            { source: 'met', id: 700444 },  // Pierre Peyron, The Death of Socrates, 1790
            { source: 'met', id: 706004 },  // Jean-Baptiste Wicar, Death of Socrates, ca. 1782–92
            { source: 'met', id: 343539 },  // Dandré-Bardon, The Death of Socrates, ca. 1749
            { source: 'met', id: 338979 },  // Bernard Vaillant, Socrates Looking in a Mirror, 17th c.
            { source: 'met', id: 334860 }   // Anonymous German, Death of Socrates, 19th c.
        ]
    },

    'atr-aristotle': {
        name: 'Aristotle',
        works: [
            { source: 'met', id: 437394 },  // Rembrandt, Aristotle with a Bust of Homer, 1653
            { source: 'met', id: 370768 }   // Aristotle, from Speculum Romanae Magnificentiae, 1553
        ]
    },

    'atr-marcus-aurelius': {
        name: 'Marcus Aurelius',
        works: [
            { source: 'met', id: 195735 },  // Marcus Aurelius (bronze), late 16th c.
            { source: 'met', id: 198276 },  // Marcus Aurelius, late 16th–early 17th c.
            { source: 'met', id: 747513 },  // Delacroix, Marcus Aurelius Surrounded by Horsemen, ca. 1822–26
            { source: 'met', id: 459379 },  // Hubert Robert, Equestrian Statue of Marcus Aurelius, 1757
            { source: 'met', id: 459383 },  // Hubert Robert, View of the Campidoglio, 1762
            { source: 'met', id: 343595 },  // Marco Dente, Equestrian Statue of Marcus Aurelius, 1515–27
            { source: 'met', id: 693774 },  // Nicolas Beatrizet, The Triumph of Marcus Aurelius, 1550
            { source: 'met', id: 693776 },  // Beatrizet, Equestrian Statue on the Capitoline, 1548
            { source: 'met', id: 336109 },  // Jan Goeree, View of the Column of Marcus Aurelius, before 1704
            { source: 'met', id: 629068 }   // Marcus Aurelius on Horseback, 17th c.
        ]
    },

    'atr-stoicism': {
        name: 'Stoicism',
        works: [
            { source: 'met', id: 370513 },  // Pierre Peyron, The Death of Seneca, ca. 1773
            { source: 'met', id: 343606 },  // Jean Guillaume Moitte, The Death of Seneca, ca. 1770–90
            { source: 'met', id: 195735 },  // Marcus Aurelius (bronze), late 16th c.
            { source: 'met', id: 747513 }   // Delacroix, Marcus Aurelius Surrounded by Horsemen
        ]
    },

    'atr-cicero': {
        name: 'Cicero',
        works: [
            { source: 'met', id: 392484 },  // James Sayers, Cicero in Catilinam, 1785
            { source: 'met', id: 376931 },  // Bartolozzi, Demosthenes, Cicero and William Pitt, 1750–1815
            { source: 'met', id: 198623 },  // Giuseppe Girometti, Cicero, early 19th c.
            { source: 'met', id: 198615 }   // Niccolò Cerbara, Cicero, ca. 1810–20
        ]
    },

    'atr-diogenes': {
        name: 'Diogenes',
        works: [
            { source: 'met', id: 650907 },  // Ribera, Diogenes, bust-length with lantern, 1750–69
            { source: 'met', id: 363471 },  // Castiglione, Diogenes in search of an honest man, ca. 1645–47
            { source: 'met', id: 251181 },  // Marble statue of Diogenes (Roman)
            { source: 'met', id: 366705 },  // Caraglio, Diogenes, ca. 1527
            { source: 'met', id: 354611 },  // Ugo da Carpi, Diogenes seated before his barrel, ca. 1527–30
            { source: 'met', id: 357255 },  // Caraglio, Diogenes seated with his barrel, ca. 1526–27
            { source: 'met', id: 436048 },  // Gaspar de Crayer, Alexander and Diogenes
            { source: 'met', id: 812706 },  // Alexander the Great meeting Diogenes, ca. 1580–1640
            { source: 'met', id: 344405 },  // Diogenes Throwing His Cup to the Ground, 17th c.
            { source: 'met', id: 771325 }   // Quirin Mark, Diogenes and Alexander, 1784
        ]
    },

    'atr-demosthenes': {
        name: 'Demosthenes',
        works: [
            { source: 'met', id: 257882 },  // Marble head of Demosthenes, 2nd c. CE
            { source: 'met', id: 370833 },  // Janinet, The Last Moments of Demosthenes, 1791
            { source: 'met', id: 356270 }   // Classical Frieze with Head of Demosthenes, 18th c.
        ]
    },

    // ── History ──
    // Drawn across both institutions: the Met holds the portrait prints
    // and Cleveland the revolutionary scenes, so these collections are
    // the first that could not be built from one museum alone.

    'atr-french-revolution': {
        name: 'The French Revolution',
        works: [
            { source: 'cleveland', id: 172514 }, // Thévenin, The Storming of the Bastille, 1790
            { source: 'met', id: 384288 },       // Thévenin, Storming of the Bastille (Met impression), 1790
            { source: 'cleveland', id: 166682 }, // Jean-François Millet, Liberty, 1848–49
            { source: 'cleveland', id: 165398 }  // Lepère, The Festival of 14 July, 1880
        ]
    },

    'atr-bastille': {
        name: 'The Bastille',
        works: [
            { source: 'cleveland', id: 172514 }, // Thévenin, The Storming of the Bastille, 1790
            { source: 'met', id: 384288 },       // Thévenin, Storming of the Bastille, 1790
            { source: 'cleveland', id: 165398 }  // Lepère, The Festival of 14 July, 1880
        ]
    },

    'atr-rousseau': {
        name: 'Jean-Jacques Rousseau',
        works: [
            { source: 'met', id: 190711 },  // Houdon, Jean Jacques Rousseau (bust), late 18th c.
            { source: 'met', id: 639443 },  // Pierre Michel Alix, Jean-Jacques Rousseau, 1791
            { source: 'met', id: 423063 },  // Saint-Aubin, Portrait of Rousseau, 1777
            { source: 'met', id: 422905 },  // Saint-Aubin, Portrait of Rousseau, 1801
            { source: 'met', id: 424594 }   // Simonet, vignette from the 1774 Émile, 1778
        ]
    },

    /**
     * Attic vase painting, for the Journey "War" (JOURNEYS-SPEC §2).
     *
     * Movement II contracts war to the mortal body: Hector at the
     * Scaean gate, then Hector dead. Its counterpressure is that the
     * heroic code "remains intelligible" — Homer does not present it as
     * an illusion the next movement exposes.
     *
     * Vase painting argues that in its form. It is a CODE for showing
     * bodies: flat, frontal, figures on a ground-line, refusing the
     * illusionistic depth that would make a scene feel like a window
     * onto a fact. It schematises rather than naturalises, and it was
     * made by the people the poem was sung to.
     *
     * Neoclassical painting was considered and rejected for the
     * opposite reason. David and his kind read Hector's death as
     * already-interpreted tragedy, which settles in advance what Homer
     * leaves open — the same error a photograph of the Somme would make
     * beside Jünger.
     *
     * Curated 2026-07-30 from a contact sheet of the Met's Greek and
     * Roman department (28,110 ids; scripts/met-harvest.mjs). Rights
     * verified per object at `isPublicDomain`; all eighteen cleared,
     * all are Greek, Attic, classification Vases.
     */
    'atr-attic-vases': {
        name: 'Attic Vase Painting',
        works: [
            { source: 'met', id: 258464 },  // Princeton Group, Terracotta neck-amphora (jar), ca. 540–530 BCE
            { source: 'met', id: 254871 },  // Group E, Terracotta amphora (jar), ca. 550 BCE
            { source: 'met', id: 254869 },  // Group E, Terracotta amphora (jar), ca. 540 BCE
            { source: 'met', id: 254865 },  // Bateman Group, Terracotta amphora (jar), ca. 530 BCE
            { source: 'met', id: 254864 },  // Kittos Group, Terracotta Panathenaic prize amphora, ca. 366/365 BCE
            { source: 'met', id: 254168 },  // Thorvaldsen Group, Terracotta kylix (drinking cup), ca. 500 BCE
            { source: 'met', id: 248299 },  // Mannerist Group, Terracotta column-krater, ca. 460 BCE
            { source: 'met', id: 254906 },  // Group of Polygnotos, Terracotta calyx-krater, ca. 440–430 BCE
            { source: 'met', id: 247229 },  // Michigan Class, Terracotta lekythos (oil flask), late 6th c. BCE
            { source: 'met', id: 254911 },  // Group of Polygnotos, Terracotta stamnos (jar), ca. 440 BCE
            { source: 'met', id: 255154 },  // Andokides, Terracotta amphora (jar), ca. 530 BCE
            { source: 'met', id: 246931 },  // C Painter, Terracotta kylix: Siana cup, ca. 575 BCE
            { source: 'met', id: 247326 },  // Greek, Attic, Terracotta standlet, ca. 520–500 BCE
            { source: 'met', id: 247958 },  // Eucharides Painter, Terracotta amphora (jar), ca. 490 BCE
            { source: 'met', id: 247236 },  // Rycroft Painter, Terracotta amphora (jar), ca. 510 BCE
            { source: 'met', id: 254345 },  // Antimenes Painter, Terracotta amphora (jar), ca. 510 BCE
            { source: 'met', id: 247915 },  // Washing Painter, Terracotta lebes gamikos, ca. 430–420 BCE
            { source: 'met', id: 251104 }   // Greek, Attic, Terracotta oinochoe: chous (jug), ca. 400 BCE
        ]
    }

});

/**
 * NOT PINNED: James Watt / the industrial subjects.
 *
 * Deliberately absent, and the reason is worth recording because it
 * marks the boundary of this whole approach.
 *
 * Watt's passage is about MECHANISM — the separate condenser, the
 * governor, the linkage that converts reciprocating motion to rotary.
 * Open collections hold portraits OF HIM: a Turner mezzotint of a
 * seated gentleman, a gold medal, cigarette cards. That is a picture of
 * a man who invented something, not the thing he invented. No amount of
 * better searching closes that gap, because the imagery a reader wants
 * here was never collected as art.
 *
 * This is a generation problem wearing a curation problem's clothes.
 * The right surface is a procedural engine drawing blueprint plates —
 * gears, sectional cutaways, pressure curves — which would sit far
 * closer to the text than any museum portrait. Tracked as future work;
 * until it exists, the Watt sequence falls back to the general pool,
 * which is honest, rather than to a portrait that only looks relevant.
 */

/** Pinned collection ids stay `atr-` namespaced, like their predecessors. */
export function findPinnedCollection(id) {
    return ATRIUM_PINNED_COLLECTIONS[id] || null;
}

export function hasPinnedCollection(id) {
    return Object.hasOwn(ATRIUM_PINNED_COLLECTIONS, id);
}
