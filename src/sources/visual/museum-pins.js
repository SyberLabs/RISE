/**
 * Museum category PINS — cross-institution pool enrichment.
 *
 * A category is a READER INTENT (Old Masters, Landscapes), not an
 * institution: the museum is provenance metadata on the work, never a
 * browsing axis. Each category's pool is the AIC's verified live
 * clauses UNION these pinned works from other institutions, drawn
 * through one ShuffleBag so the variety is real. Provenance shows on
 * every piece (sourceName + attribution from the adapters); it is
 * honored where it is true — on the work — not imposed where it is
 * noise — on the checkbox.
 *
 * CURATION: all pins contact-sheet reviewed. Harvests (both
 * 2026-07-22, queries per MUSEUM-ATLAS.md §6):
 * - Rijksmuseum, 120: Rembrandt 24, Vermeer 4, Hals 9, Steen 22,
 *   ter Borch 14, de Hooch 6, Ruisdael 12+12, Heda 4, Van Gogh 5,
 *   Hals portraits 9. Rights: the rijks adapter verifies the Public
 *   Domain Mark on each VisualItem at resolution.
 * - Cleveland, 160: Old Masters 53 (Caravaggio, Velázquez, El Greco,
 *   Rembrandt, Rubens, Poussin…), Impressionism 20, Post-Imp. 10,
 *   Landscapes 39 (incl. East Asian ink landscapes — kept by design:
 *   a different tradition answering the same reader intent),
 *   Portraits 38. Cuts: 2 Mughal portraits (creator's call), Rosa's
 *   Scenes of Witchcraft ×4 + Danaë + Cupid (register), 1 name-trap.
 *   Rights: cc0=1 pre-filter; the cleveland adapter re-verifies
 *   share_license_status === 'CC0' per object at resolution.
 * - Rijksmuseum landscapes, 180 (2026-07-23, the first harvest via
 *   the key-free search at data.rijksmuseum.nl — Atlas §2): the
 *   Golden Age beyond Ruisdael (Van Goyen 11, Salomon van Ruysdael,
 *   Avercamp, Koninck, Cuyp, Hobbema, Both, Potter) and the Hague
 *   School entire (Jacob Maris 29, Mauve 15, Weissenbruch, Willem
 *   Maris, Bilders), plus Romantics (Schelfhout, Koekkoek). All 210
 *   resolved candidates cleared Public Domain at the VisualItem;
 *   cuts were genre scenes, interiors, mythology, and sacred works
 *   (Mary Praying / Praying Monk — sacred imagery stays pinned in
 *   the Chapel, never in default pools). 8 true portraits by the
 *   roster painters transferred to the portraits pool instead.
 *
 * Future museums (Met pins) enter by appending to these arrays —
 * no new UI, ever.
 */

export const MUSEUM_CATEGORY_PINS = Object.freeze({
    "oldmasters": [
        { source: "rijks", id: 200106038 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107928 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107929 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107930 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107931 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107933 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107934 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107935 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107936 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107937 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107941 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107942 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107944 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107945 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107946 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107947 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107952 },  // Rembrandt van Rijn
        { source: "rijks", id: 200109435 },  // Rembrandt van Rijn
        { source: "rijks", id: 200138946 },  // Rembrandt van Rijn
        { source: "rijks", id: 20022176 },  // Rembrandt van Rijn
        { source: "rijks", id: 20026156 },  // Rembrandt van Rijn
        { source: "rijks", id: 20026162 },  // Rembrandt van Rijn
        { source: "rijks", id: 200639587 },  // Rembrandt van Rijn
        { source: "rijks", id: 200642954 },  // Rembrandt van Rijn
        { source: "rijks", id: 200108369 },  // Johannes Vermeer
        { source: "rijks", id: 200108370 },  // Johannes Vermeer
        { source: "rijks", id: 200108371 },  // Johannes Vermeer
        { source: "rijks", id: 200108372 },  // Johannes Vermeer
        { source: "rijks", id: 200109344 },  // Frans Hals
        { source: "rijks", id: 200109345 },  // Frans Hals
        { source: "rijks", id: 200109346 },  // Frans Hals
        { source: "rijks", id: 200109347 },  // Frans Hals
        { source: "rijks", id: 200109348 },  // Frans Hals
        { source: "rijks", id: 200109349 },  // Frans Hals
        { source: "rijks", id: 200109350 },  // Frans Hals
        { source: "rijks", id: 200109374 },  // Frans Hals
        { source: "rijks", id: 20027997 },  // Frans Hals
        { source: "rijks", id: 200107997 },  // Jan Steen
        { source: "rijks", id: 200107998 },  // Jan Steen
        { source: "rijks", id: 200107999 },  // Jan Steen
        { source: "rijks", id: 200108012 },  // Jan Steen
        { source: "rijks", id: 20015865 },  // Jan Steen
        { source: "rijks", id: 20015866 },  // Jan Steen
        { source: "rijks", id: 20015867 },  // Jan Steen
        { source: "rijks", id: 20015868 },  // Jan Steen
        { source: "rijks", id: 20020404 },  // Jan Steen
        { source: "rijks", id: 20020408 },  // Jan Steen
        { source: "rijks", id: 20026347 },  // Jan Steen
        { source: "rijks", id: 20026348 },  // Jan Steen
        { source: "rijks", id: 20026349 },  // Jan Steen
        { source: "rijks", id: 20026350 },  // Jan Steen
        { source: "rijks", id: 20026351 },  // Jan Steen
        { source: "rijks", id: 20026352 },  // Jan Steen
        { source: "rijks", id: 20026353 },  // Jan Steen
        { source: "rijks", id: 20026354 },  // Jan Steen
        { source: "rijks", id: 20026355 },  // Jan Steen
        { source: "rijks", id: 20026358 },  // Jan Steen
        { source: "rijks", id: 2006398 },  // Jan Steen
        { source: "rijks", id: 2006409 },  // Jan Steen
        { source: "rijks", id: 200109389 },  // Pieter de Hooch
        { source: "rijks", id: 200109390 },  // Pieter de Hooch
        { source: "rijks", id: 200109391 },  // Pieter de Hooch
        { source: "rijks", id: 200109392 },  // Pieter de Hooch
        { source: "rijks", id: 20028104 },  // Pieter de Hooch
        { source: "rijks", id: 2003051 },  // Pieter de Hooch
        { source: "rijks", id: 200108271 },  // Gerard ter Borch
        { source: "rijks", id: 200108272 },  // Gerard ter Borch
        { source: "rijks", id: 200108273 },  // Gerard ter Borch
        { source: "rijks", id: 200108274 },  // Gerard ter Borch
        { source: "rijks", id: 200108276 },  // Gerard ter Borch
        { source: "rijks", id: 200108277 },  // Gerard ter Borch
        { source: "rijks", id: 20026690 },  // Gerard ter Borch
        { source: "rijks", id: 20026691 },  // Gerard ter Borch
        { source: "rijks", id: 20026692 },  // Gerard ter Borch
        { source: "rijks", id: 20026693 },  // Gerard ter Borch
        { source: "rijks", id: 20026694 },  // Gerard ter Borch
        { source: "rijks", id: 20026695 },  // Gerard ter Borch
        { source: "rijks", id: 200414512 },  // Gerard ter Borch
        { source: "rijks", id: 2009364 },  // Gerard ter Borch
        { source: "rijks", id: 200107958 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 200107959 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 200108484 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015857 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015858 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015859 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015860 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026228 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026230 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026231 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026232 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026233 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 200109354 },  // Willem Claesz. Heda
        { source: "rijks", id: 20028015 },  // Willem Claesz. Heda
        { source: "rijks", id: 20028016 },  // Willem Claesz. Heda
        { source: "rijks", id: 200471064 },  // Willem Claesz. Heda
        { source: "cleveland", id: 128391 },  // Pieter de Hooch — Portrait of a Family Playing Music
        { source: "cleveland", id: 127571 },  // Lorenzo Lotto — Portrait of a Man, Possibly Girolamo Rosati
        { source: "cleveland", id: 160885 },  // Frans Hals — Portrait of Tieleman Roosterman
        { source: "cleveland", id: 117032 },  // Andrea del Sarto — The Sacrifice of Isaac
        { source: "cleveland", id: 135428 },  // Lucas Cranach — Hunting near Hartenfels Castle
        { source: "cleveland", id: 131819 },  // Anthony van Dyck — A Genoese Lady with Her Child
        { source: "cleveland", id: 150389 },  // Nicolas Poussin — The Holy Family on the Steps
        { source: "cleveland", id: 148758 },  // Caravaggio — The Crucifixion of Saint Andrew
        { source: "cleveland", id: 138359 },  // Willem Kalf — Wineglass and a Bowl of Fruit
        { source: "cleveland", id: 135661 },  // Peter Paul Rubens — Diana and Her Nymphs Departing for the Hunt
        { source: "cleveland", id: 97155 },  // unattributed — Portrait of a Couple
        { source: "cleveland", id: 124089 },  // Rembrandt van Rijn — Portrait of a Woman
        { source: "cleveland", id: 143602 },  // Jacob van Ruisdael — Low Waterfall in a Wooded Landscape with a Dead 
        { source: "cleveland", id: 128842 },  // Georges de La Tour — Saint Peter Repentant
        { source: "cleveland", id: 153603 },  // Maerten van Heemskerck — Portrait of Machtelt Suijs
        { source: "cleveland", id: 145450 },  // Emanuel de Witte — Interior of a Church
        { source: "cleveland", id: 136217 },  // Francisco de Zurbarán — Christ and the Virgin in the House at Nazareth
        { source: "cleveland", id: 145473 },  // Laurent de La Hyre — The Kiss of Peace and Justice
        { source: "cleveland", id: 108541 },  // El Greco — The Holy Family with Mary Magdalen
        { source: "cleveland", id: 145960 },  // Hans Holbein the Younger — Terminus, the Device of Erasmus
        { source: "cleveland", id: 136680 },  // Jusepe de Ribera — Saint Jerome
        { source: "cleveland", id: 125247 },  // Peter Paul Rubens — Portrait of Isabella Brant
        { source: "cleveland", id: 108555 },  // Nicolas Poussin — Nymphs and a Satyr (Amor Vincit Omnia)
        { source: "cleveland", id: 124092 },  // Gerard ter Borch — Portrait of a Woman
        { source: "cleveland", id: 130392 },  // Nicolas Poussin — The Return of the Holy Family to Nazareth
        { source: "cleveland", id: 118679 },  // Jacopo Bassano — Lazarus and the Rich Man
        { source: "cleveland", id: 127572 },  // Paolo Veronese — The Annunciation
        { source: "cleveland", id: 109507 },  // Paolo Veronese — Portrait of Agostino Barbarigo
        { source: "cleveland", id: 141549 },  // Diego Velázquez — Portrait of the Jester Calabazas
        { source: "cleveland", id: 143803 },  // Gerrit van Honthorst — Samson and Delilah
        { source: "cleveland", id: 135875 },  // Philippe de Champaigne — Portrait of King Charles II of England
        { source: "cleveland", id: 122348 },  // Rembrandt van Rijn — A Young Man with a Chain
        { source: "cleveland", id: 136207 },  // Ambrosius Bosschaert — Flowers in a Glass
        { source: "cleveland", id: 122340 },  // Aelbert Cuyp — Travelers in Hilly Countryside
        { source: "cleveland", id: 136509 },  // Abraham van Beyeren — Silver Wine Jug, Ham, and Fruit
        { source: "cleveland", id: 153406 },  // Marco d'Oggiono — Portrait of a Youth as Saint Sebastian
        { source: "cleveland", id: 137195 },  // Claude Lorrain — Rest on the Flight into Egypt
        { source: "cleveland", id: 147020 },  // Valentin de Boulogne — Samson
        { source: "cleveland", id: 122345 },  // Meindert Hobbema — A Cottage in the Woods
        { source: "cleveland", id: 157501 },  // Annibale Carracci — Boy Drinking
        { source: "cleveland", id: 159488 },  // Hendrik van Balen — The Trinity
        { source: "cleveland", id: 143234 },  // Jacob van Ruisdael — Landscape with a Windmill
        { source: "cleveland", id: 121946 },  // Peter Lely — Portrait of Mrs. Leneve
        { source: "cleveland", id: 156420 },  // Gerard de Lairesse — Hermes Ordering Calypso to Release Odysseus
        { source: "cleveland", id: 143644 },  // Bernardo Cavallino — Adoration of the Shepherds
        { source: "cleveland", id: 307326 },  // Carlo Maratti — Portrait of Francesca Gommi Maratti
        { source: "cleveland", id: 127573 },  // Rembrandt van Rijn — A Bearded Man Wearing a Hat
        { source: "cleveland", id: 141929 },  // Bartolomé Esteban Murillo — Laban Searching for His Stolen Household Gods
        { source: "cleveland", id: 152263 },  // Tanzio da Varallo — Portrait of a Man
        { source: "cleveland", id: 140152 },  // Jan Steen — Esther, Ahasuerus, and Haman
        { source: "cleveland", id: 146469 },  // Agnolo Bronzino — Portrait of a Woman
        { source: "cleveland", id: 151517 },  // Peter Paul Rubens — Study for "The Bear Hunt" (for the Alcázar, Madr
        { source: "cleveland", id: 95286 },  // Jan Anthonisz. van Ravesteyn — Portrait of a Woman
    ],
    "landscapes": [
        { source: "rijks", id: 200107958 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 200107959 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 200108484 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015857 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015858 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015859 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015860 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026228 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026230 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026231 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026232 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026233 },  // Jacob Isaacksz. van Ruisdael
        { source: "cleveland", id: 147016 },  // Jan Gossaert — Virgin and Child in a Landscape
        { source: "cleveland", id: 171296 },  // Robert S. Duncanson — Vale of Kashmir
        { source: "cleveland", id: 152006 },  // Thomas Gainsborough — Rocky, Wooded Landscape with a Dell and Weir
        { source: "cleveland", id: 151298 },  // Ferdinand Georg Waldmüller — Prater Landscape
        { source: "cleveland", id: 139454 },  // Sōami — Landscape
        { source: "cleveland", id: 79932 },  // Yi Bul-hae — Landscape with Fishermen
        { source: "cleveland", id: 159501 },  // David Teniers — Landscape with Peasants Dancing
        { source: "cleveland", id: 83635 },  // Jan Verkade — Breton Landscape
        { source: "cleveland", id: 149417 },  // Kan Tenju — Landscape with Gentle Peaks
        { source: "cleveland", id: 141639 },  // Frederic Edwin Church — Twilight in the Wilderness
        { source: "cleveland", id: 149768 },  // Petrus Christus — Saint John the Baptist in a Landscape
        { source: "cleveland", id: 143261 },  // Herri met de Bles — Landscape with Saint John the Baptist
        { source: "cleveland", id: 142642 },  // Kuncan — Spring Landscape
        { source: "cleveland", id: 172785 },  // unattributed — Landscape
        { source: "cleveland", id: 150165 },  // Gion Nankai — Landscape
        { source: "cleveland", id: 132908 },  // Bada Shanren — Landscape after Guo Zhongshu
        { source: "cleveland", id: 159739 },  // Yosa Buson — Snow Landscape
        { source: "cleveland", id: 154086 },  // unattributed — Landscape with Woodcutters Returning Home
        { source: "cleveland", id: 148853 },  // Yi Sumun — Landscape of the Four Seasons
        { source: "cleveland", id: 160948 },  // Guo Min — Herdboys and Buffalo in Landscape
        { source: "cleveland", id: 160947 },  // Guo Min — Herdboys and Buffalo in Landscape
        { source: "cleveland", id: 170784 },  // Abd al-Samad — Hunting with falcons in a landscape (recto)
        { source: "cleveland", id: 172782 },  // unattributed — Landscape with Streams and Mountains
        { source: "cleveland", id: 132016 },  // Wang Yuanqi — Landscape after Ni Zan
        { source: "cleveland", id: 148854 },  // Yi Sumun — Landscape of the Four Seasons
        { source: "cleveland", id: 153339 },  // Yeoseol — Winter Landscape
        { source: "cleveland", id: 97189 },  // Herman van Swanevelt — Landscape with Travelers
        { source: "cleveland", id: 119007 },  // unattributed — Princes hunting in a rocky landscape
        { source: "cleveland", id: 148855 },  // Yi Sumun — Landscape of the Four Seasons
        { source: "cleveland", id: 135483 },  // Salvator Rosa — Ruins in a Rocky Landscape
        { source: "cleveland", id: 144968 },  // Sanford Robinson Gifford — A Home in the Wilderness
        { source: "cleveland", id: 125093 },  // Claude Lorrain — Italian Landscape
        { source: "cleveland", id: 138360 },  // Gillis van Coninxloo — Landscape with Venus and Adonis
        { source: "cleveland", id: 149660 },  // unattributed — Landscape with a Distant Temple
        { source: "cleveland", id: 149606 },  // Chen Hongshou — Paintings after Ancient Masters: Landscape in th
        { source: "cleveland", id: 132926 },  // Zha Shibiao — Landscape Album in Various Styles: The Stream of
        { source: "cleveland", id: 136911 },  // Thomas Cole — View of Florence
        { source: "cleveland", id: 93014 },  // Thomas Cole — View of Schroon Mountain, Essex County, New York
        { source: "cleveland", id: 150701 },  // unattributed — Windy Landscape with Sailboat
        { source: "rijks", id: 200109265 },  // Aelbert Cuyp — River Landscape with Riders
        { source: "rijks", id: 20027732 },  // Aelbert Cuyp — River Landscape with Cows
        { source: "rijks", id: 20027735 },  // Aelbert Cuyp — Mountainous Landscape with the Ruins of a Cast
        { source: "rijks", id: 20015940 },  // Meindert Hobbema — A Watermill
        { source: "rijks", id: 20028045 },  // Meindert Hobbema — A Watermill
        { source: "rijks", id: 200445746 },  // Meindert Hobbema — Wooded Landscape with Merrymakers in a Cart
        { source: "rijks", id: 200109335 },  // Jan Van Goyen — Winter
        { source: "rijks", id: 200109336 },  // Jan Van Goyen — Landscape with Two Oaks
        { source: "rijks", id: 200109337 },  // Jan Van Goyen — Panoramic View of a Wide River
        { source: "rijks", id: 200109338 },  // Jan Van Goyen — Summer
        { source: "rijks", id: 20027960 },  // Jan Van Goyen — View of Arnhem
        { source: "rijks", id: 20027961 },  // Jan Van Goyen — Polder Landscape
        { source: "rijks", id: 20027962 },  // Jan Van Goyen — View of a Town on a River
        { source: "rijks", id: 20027963 },  // Jan Van Goyen — Panoramic View of a River with Low-lying Meado
        { source: "rijks", id: 20027964 },  // Jan Van Goyen — The Valkhof in Nijmegen
        { source: "rijks", id: 20027965 },  // Jan Van Goyen — River View with Sentry Post
        { source: "rijks", id: 20042026 },  // Jan Van Goyen — View of an Imaginary Town across a River, with
        { source: "rijks", id: 20026237 },  // Salomon Van Ruysdael — River View near Deventer
        { source: "rijks", id: 20026238 },  // Salomon Van Ruysdael — View of a village
        { source: "rijks", id: 20026239 },  // Salomon Van Ruysdael — Landscape with Travellers before an Inn
        { source: "rijks", id: 20026240 },  // Salomon Van Ruysdael — Landscape with Travellers before an Inn near a
        { source: "rijks", id: 20026241 },  // Salomon Van Ruysdael — Sailing Vessels on an Inland Body of Water
        { source: "rijks", id: 200108162 },  // Hendrick Avercamp — Ice-Skating in a Village
        { source: "rijks", id: 200108163 },  // Hendrick Avercamp — Winter Landscape with Skaters
        { source: "rijks", id: 200108164 },  // Hendrick Avercamp — Enjoying the Ice
        { source: "rijks", id: 200529588 },  // Hendrick Avercamp — Enjoying the Ice near a Town
        { source: "rijks", id: 200107781 },  // Aert Van Der Neer — Landscape by Moonlight
        { source: "rijks", id: 200107782 },  // Aert Van Der Neer — Winter Landscape near a Town with Bare Trees
        { source: "rijks", id: 20012365 },  // Aert Van Der Neer — Winter Landscape near a Town with Kolf Players
        { source: "rijks", id: 20025809 },  // Aert Van Der Neer — Winter Landscape near a Town with Kolf Players
        { source: "rijks", id: 20025810 },  // Aert Van Der Neer — Landscape by Moonlight
        { source: "rijks", id: 20025811 },  // Aert Van Der Neer — Landscape with an Inn
        { source: "rijks", id: 20029044 },  // Aert Van Der Neer — Wooded Landscape with Hunter/Winter Landscape
        { source: "rijks", id: 200111822 },  // Philips Koninck — River Landscape
        { source: "rijks", id: 20029302 },  // Philips Koninck — Distant View, with Cottages Lining a Road
        { source: "rijks", id: 20029304 },  // Philips Koninck — The Entrance to the Woods
        { source: "rijks", id: 200107888 },  // Paulus Potter — Orpheus charming the beasts
        { source: "rijks", id: 200107889 },  // Paulus Potter — Cows in a meadow near a farm
        { source: "rijks", id: 20026071 },  // Paulus Potter — A spaniel
        { source: "rijks", id: 20026073 },  // Paulus Potter — A herdsman's hut
        { source: "rijks", id: 20026074 },  // Paulus Potter — Four Young Bulls in a Meadow
        { source: "rijks", id: 20026075 },  // Paulus Potter — Two Horses in a Meadow near a Gate
        { source: "rijks", id: 20027075 },  // Paulus Potter — Bear Hunt
        { source: "rijks", id: 200109448 },  // Willem Maris — White Cow
        { source: "rijks", id: 200109449 },  // Willem Maris — Cow beside a Ditch
        { source: "rijks", id: 20027524 },  // Willem Maris — Ducks
        { source: "rijks", id: 20027552 },  // Willem Maris — Koeien
        { source: "rijks", id: 20028276 },  // Willem Maris — Meadow with Cows
        { source: "rijks", id: 20028277 },  // Willem Maris — Cows in a Soggy Meadow
        { source: "rijks", id: 20028278 },  // Willem Maris — Meadow with Cows by the Water
        { source: "rijks", id: 20028279 },  // Willem Maris — Eenden
        { source: "rijks", id: 20028472 },  // Willem Maris — Witte eend met kiekens
        { source: "rijks", id: 20028503 },  // Willem Maris — Koeien aan een plas
        { source: "rijks", id: 20028745 },  // Willem Maris — Weide met koeien
        { source: "rijks", id: 200108991 },  // Jacob Maris — Wooden Bridge across a Canal at Rijswijk
        { source: "rijks", id: 200109444 },  // Jacob Maris — Arrival of the Boats
        { source: "rijks", id: 200109445 },  // Jacob Maris — The Truncated Windmill
        { source: "rijks", id: 20027445 },  // Jacob Maris — Havengezicht
        { source: "rijks", id: 20027557 },  // Jacob Maris — Stadsgezicht
        { source: "rijks", id: 20027558 },  // Jacob Maris — Fishing for Shells
        { source: "rijks", id: 20027559 },  // Jacob Maris — Strand bij avond
        { source: "rijks", id: 20027560 },  // Jacob Maris — Oud buurtje aan het water
        { source: "rijks", id: 20027561 },  // Jacob Maris — Vaart bij maanlicht
        { source: "rijks", id: 20027562 },  // Jacob Maris — De Schreierstoren met de brug over de Gelderse
        { source: "rijks", id: 20027564 },  // Jacob Maris — Landschap met schuit
        { source: "rijks", id: 20027565 },  // Jacob Maris — Houses on the Prins Hendrikkade, Amsterdam, on
        { source: "rijks", id: 20027614 },  // Jacob Maris — De Schreierstoren aan de Buitenkant te Amsterd
        { source: "rijks", id: 20027615 },  // Jacob Maris — A Bleaching Field
        { source: "rijks", id: 20028247 },  // Jacob Maris — Harbor View
        { source: "rijks", id: 20028249 },  // Jacob Maris — Townscape with a Domed Church
        { source: "rijks", id: 20028250 },  // Jacob Maris — Ships in Dull Weather
        { source: "rijks", id: 20028253 },  // Jacob Maris — Cityscape
        { source: "rijks", id: 20028254 },  // Jacob Maris — The Bridge
        { source: "rijks", id: 20028257 },  // Jacob Maris — The Windmill
        { source: "rijks", id: 20028258 },  // Jacob Maris — Towpath
        { source: "rijks", id: 20028259 },  // Jacob Maris — Tired Out (Mother Watched)
        { source: "rijks", id: 20028260 },  // Jacob Maris — A Polder Landscape after a Thunderstorm
        { source: "rijks", id: 20028262 },  // Jacob Maris — Havengezicht
        { source: "rijks", id: 20028263 },  // Jacob Maris — Landschap in de omgeving van Den Haag
        { source: "rijks", id: 20028264 },  // Jacob Maris — Bluff-bowed Fishing Boat on the Beach at Schev
        { source: "rijks", id: 20028268 },  // Jacob Maris — Jaagpad
        { source: "rijks", id: 20028269 },  // Jacob Maris — Dordrecht bij avond
        { source: "rijks", id: 20028470 },  // Jacob Maris — Schepen in de haven van Dordrecht
        { source: "rijks", id: 200109454 },  // Anton Mauve — Morning Ride along the Beach
        { source: "rijks", id: 200109456 },  // Anton Mauve — On the Heath near Laren
        { source: "rijks", id: 200109457 },  // Anton Mauve — The Vegetable Garden
        { source: "rijks", id: 20015958 },  // Anton Mauve — De Torenlaan te Laren
        { source: "rijks", id: 20027381 },  // Anton Mauve — Het in zee brengen van een visserspink
        { source: "rijks", id: 20027446 },  // Anton Mauve — De melkbocht
        { source: "rijks", id: 20027525 },  // Anton Mauve — Paarden bij het hek
        { source: "rijks", id: 20027542 },  // Anton Mauve — Trekvaart
        { source: "rijks", id: 20027553 },  // Anton Mauve — Winter in the Scheveningen Woods
        { source: "rijks", id: 20028284 },  // Anton Mauve — Huisje aan een sloot
        { source: "rijks", id: 20028285 },  // Anton Mauve — Shepherdess with a Flock of Sheep
        { source: "rijks", id: 20028286 },  // Anton Mauve — The Marsh
        { source: "rijks", id: 20028287 },  // Anton Mauve — Huisje aan de zandweg
        { source: "rijks", id: 20028473 },  // Anton Mauve — Lying Cow
        { source: "rijks", id: 20028528 },  // Anton Mauve — Koe
        { source: "rijks", id: 200108394 },  // Johan Hendrik Weissenbruch — Wooded View near Barbizon
        { source: "rijks", id: 200108395 },  // Johan Hendrik Weissenbruch — Summer Day
        { source: "rijks", id: 200108396 },  // Johan Hendrik Weissenbruch — Autumn Landscape
        { source: "rijks", id: 200108397 },  // Johan Hendrik Weissenbruch — Cellar of the Artist’s Home in The Hague
        { source: "rijks", id: 200108398 },  // Johan Hendrik Weissenbruch — The Trekvliet Shipping Canal near Rijswijk, kn
        { source: "rijks", id: 20026933 },  // Johan Hendrik Weissenbruch — Beach Scene
        { source: "rijks", id: 20026935 },  // Johan Hendrik Weissenbruch — Dune landscape
        { source: "rijks", id: 20027556 },  // Johan Hendrik Weissenbruch — The Mill
        { source: "rijks", id: 20027617 },  // Johan Hendrik Weissenbruch — Landschap met boerderij bij een plas
        { source: "rijks", id: 20028570 },  // Johan Hendrik Weissenbruch — Boerenhuis aan een vaart
        { source: "rijks", id: 20027522 },  // Johan Barthold Jongkind — Rotterdam in the Moonlight
        { source: "rijks", id: 20027529 },  // Johan Barthold Jongkind — Windmills near Rotterdam
        { source: "rijks", id: 20028159 },  // Johan Barthold Jongkind — River View in France, possibly near Pontoise
        { source: "rijks", id: 20028160 },  // Johan Barthold Jongkind — Overschie in the Moonlight
        { source: "rijks", id: 20028526 },  // Johan Barthold Jongkind — Houses on a Waterway near Crooswijk
        { source: "rijks", id: 2004267 },  // Johan Barthold Jongkind — Rue Notre-Dame, Paris
        { source: "rijks", id: 200106078 },  // Wouter Johannes Van Troostwijk — The Raampoortje in Amsterdam
        { source: "rijks", id: 200108018 },  // Wouter Johannes Van Troostwijk — A Barn on the Bank of a Stream in Gelderland
        { source: "rijks", id: 20026431 },  // Wouter Johannes Van Troostwijk — Farm Building in Gelderland
        { source: "rijks", id: 200108352 },  // Esaias Van De Velde — The Ferry
        { source: "rijks", id: 20026823 },  // Esaias Van De Velde — The Robbery
        { source: "rijks", id: 20026824 },  // Esaias Van De Velde — An open-air Party
        { source: "rijks", id: 20026825 },  // Esaias Van De Velde — A View in the Dunes
        { source: "rijks", id: 20027972 },  // Esaias Van De Velde — Roman Landscape with Ruins
        { source: "rijks", id: 200108292 },  // Jan Both — Italian Landscape with Mule Driver
        { source: "rijks", id: 200108293 },  // Jan Both — Italian Landscape with a Draughtsman
        { source: "rijks", id: 200108294 },  // Jan Both — Street Scene with Roman Ruins
        { source: "rijks", id: 20026718 },  // Jan Both — Italian Landscape with a View of a Harbour
        { source: "rijks", id: 20026719 },  // Jan Both — Italian Landscape with a River and an Arch Bri
        { source: "rijks", id: 20026720 },  // Jan Both — Farmyard
        { source: "rijks", id: 20026721 },  // Jan Both — Italian Landscape with Ferry
        { source: "rijks", id: 200108602 },  // Everdingen — Swedish Landscape with a Water Mill
        { source: "rijks", id: 20027044 },  // Everdingen — Swedish Landscape with a Waterfall
        { source: "rijks", id: 20027374 },  // Everdingen — Hendrick Trip's Cannon Foundry in Julitabroeck
        { source: "rijks", id: 20027859 },  // Everdingen — Swedish Landscape
        { source: "rijks", id: 200108226 },  // Bilders — Woodland Pond at Sunset
        { source: "rijks", id: 200108227 },  // Bilders — Meadow near Oosterbeek
        { source: "rijks", id: 200108228 },  // Bilders — Jacob van Ruisdael Sketching a Watermill
        { source: "rijks", id: 20026627 },  // Bilders — The Goatherdess
        { source: "rijks", id: 20026628 },  // Bilders — Cows in the Meadow
        { source: "rijks", id: 20026629 },  // Bilders — Cows at a pond
        { source: "rijks", id: 20026630 },  // Bilders — Swiss Landscape
        { source: "rijks", id: 20026631 },  // Bilders — Cows at a Pond
        { source: "rijks", id: 20026632 },  // Bilders — View in the Woods
        { source: "rijks", id: 20026633 },  // Bilders — The Heath near Wolfheze
        { source: "rijks", id: 20026634 },  // Bilders — Landscape with Farmstead
        { source: "rijks", id: 20026635 },  // Bilders — Avenue of Oaks in Late Summer
        { source: "rijks", id: 20062895 },  // Bilders — Bosgezicht bij Wolfheze.
        { source: "rijks", id: 200107977 },  // Schelfhout — Farmyard
        { source: "rijks", id: 200107978 },  // Schelfhout — A Frozen Canal near the River Maas
        { source: "rijks", id: 20026281 },  // Schelfhout — Windmill beside a frozen river
        { source: "rijks", id: 20026282 },  // Schelfhout — Winter Scene on the Ice with Wood Gatherers
        { source: "rijks", id: 20026283 },  // Schelfhout — Landscape with the Ruins of Brederode Castle i
        { source: "rijks", id: 20026284 },  // Schelfhout — Inner Courtyard
        { source: "rijks", id: 20065879 },  // Schelfhout — View of the Dunes with the Ruins of Brederode 
        { source: "rijks", id: 200111819 },  // Koekkoek — View in the Woods
        { source: "rijks", id: 200111820 },  // Koekkoek — Winter landscape
        { source: "rijks", id: 20029299 },  // Koekkoek — Landscape with an Oncoming Rainstorm
        { source: "rijks", id: 20029300 },  // Koekkoek — Italian Landscape
        { source: "rijks", id: 200108402 },  // Wijnants — Hilly Landscape with a Rider on a Country Road
        { source: "rijks", id: 20026965 },  // Wijnants — Landscape with Cattle on a Country Road
        { source: "rijks", id: 20026966 },  // Wijnants — Landscape with a Peddler and Woman Resting
        { source: "rijks", id: 20026967 },  // Wijnants — Landscape with a Rider Watering his Horse
        { source: "rijks", id: 20026968 },  // Wijnants — Landscape with a Man Riding a Donkey
        { source: "rijks", id: 20026969 },  // Wijnants — The Farmhouse
        { source: "rijks", id: 20026970 },  // Wijnants — Landscape with two Hunters
        { source: "rijks", id: 20026971 },  // Wijnants — Dune Landscape with Hunters Resting
        { source: "rijks", id: 20026972 },  // Wijnants — Landscape with a Hunter and other Figures
        { source: "rijks", id: 20015638 },  // Van Der Heyden — Amsterdam City View with Houses on the Herengr
        { source: "rijks", id: 20027572 },  // Van Der Heyden — View in the Woods
        { source: "rijks", id: 20028039 },  // Van Der Heyden — The Stone Bridge
        { source: "rijks", id: 20028040 },  // Van Der Heyden — The Draw Bridge
        { source: "rijks", id: 20028041 },  // Van Der Heyden — The Church of St Severin in Cologne in an Imag
        { source: "rijks", id: 20028517 },  // Van Der Heyden — A Country Home
    ],
    "portraits": [
        { source: "rijks", id: 200109344 },  // Frans Hals
        { source: "rijks", id: 200109345 },  // Frans Hals
        { source: "rijks", id: 200109346 },  // Frans Hals
        { source: "rijks", id: 200109347 },  // Frans Hals
        { source: "rijks", id: 200109348 },  // Frans Hals
        { source: "rijks", id: 200109349 },  // Frans Hals
        { source: "rijks", id: 200109350 },  // Frans Hals
        { source: "rijks", id: 200109374 },  // Frans Hals
        { source: "rijks", id: 20027997 },  // Frans Hals
        { source: "cleveland", id: 102578 },  // William Merritt Chase — Portrait of Dora Wheeler
        { source: "cleveland", id: 124080 },  // Thomas Gainsborough — Portrait of Mary Wise
        { source: "cleveland", id: 145964 },  // Wang Hui — Portrait of An Qi
        { source: "cleveland", id: 160289 },  // John Singer Sargent — Portrait of Lisa Colt Curtis
        { source: "cleveland", id: 143206 },  // Hyacinthe Rigaud — Portrait of Cardinal Guillaume Dubois
        { source: "cleveland", id: 122349 },  // Joshua Reynolds — Portrait of the Ladies Amabel and Mary Jemima Yo
        { source: "cleveland", id: 122158 },  // Corneille de Lyon — Portrait of a Woman
        { source: "cleveland", id: 96263 },  // Thomas Sully — Portrait of Jean Terford David
        { source: "cleveland", id: 125951 },  // Jean-Marc Nattier — Portrait of a Woman
        { source: "cleveland", id: 128394 },  // Amedeo Modigliani — Portrait of a Woman
        { source: "cleveland", id: 139730 },  // unattributed — Portrait of a Man
        { source: "cleveland", id: 155819 },  // Henry Raeburn — Portrait of Hugh Hope
        { source: "cleveland", id: 163350 },  // François LePage — Self-Portrait
        { source: "cleveland", id: 145999 },  // Thomas Gainsborough — Portrait of George Pitt, First Baron Rivers
        { source: "cleveland", id: 148369 },  // Dirck Dircksz. Santvoort — Portrait of Elizabeth Spiegel
        { source: "cleveland", id: 122344 },  // Gainsborough Dupont — Portrait of Mary Anne Jolliffe
        { source: "cleveland", id: 136682 },  // Thomas Lawrence — Portrait of Catherine Grey, Lady Manners
        { source: "cleveland", id: 151007 },  // unattributed — Portrait Study of Seigen
        { source: "cleveland", id: 374816 },  // Chae Yongshin — Portrait of a Government Official
        { source: "cleveland", id: 122341 },  // François Hubert Drouais — Portrait of the Marquise d'Aguirandes
        { source: "cleveland", id: 161268 },  // unattributed — Portrait of an Official
        { source: "cleveland", id: 122346 },  // Thomas Lawrence — Portrait of Charlotte and Sarah Carteret-Hardy
        { source: "cleveland", id: 147447 },  // Cornelis Jonson — Portrait of a Woman, possibly Elizabeth Boothby
        { source: "cleveland", id: 119701 },  // Bartolomeo Veneto — Portrait of a Man
        { source: "cleveland", id: 124990 },  // Agustín Esteve y Marques — Portrait of Juan Maria Osorio
        { source: "cleveland", id: 141328 },  // Antoine-Jean Gros — Portrait of Count Jean-Antoine Chaptal
        { source: "cleveland", id: 170082 },  // Henry Church — Self-Portrait with Five Muses
        { source: "cleveland", id: 169684 },  // Elisabeth Louise Vigée-LeBrun — Portrait of Jean-Baptiste Lemoyne the Younger
        { source: "cleveland", id: 155431 },  // unattributed — Portrait of the Great Master Yeongwoldang Eungji
        { source: "cleveland", id: 122347 },  // Jean-Marc Nattier — Portrait of a Woman as Diana
        { source: "cleveland", id: 130162 },  // Giovanni Domenico Tiepolo — Portrait of a Woman
        { source: "cleveland", id: 137335 },  // Master of the Holy Kinship — Portrait of a Woman
        { source: "cleveland", id: 149029 },  // Horace Vernet — Self-Portrait in Rome
        { source: "cleveland", id: 149943 },  // Watanabe Kazan — Portrait of Ōzora Buzaemon
        { source: "cleveland", id: 123490 },  // Francisco de Goya — Portrait of Don Juan Antonio Cuervo
        { source: "cleveland", id: 125895 },  // Frans Hals — Portrait of a Woman, probably Aeltje Dircksdr. P
        { source: "cleveland", id: 117030 },  // Joseph Paelinck — Self-Portrait
        { source: "cleveland", id: 444535 },  // Frédéric Bazille — Portrait of Renoir
        { source: "rijks", id: 200109207 },  // Aelbert Cuyp — Portrait of a Young Man, possibly Jacob Franck
        { source: "rijks", id: 200111821 },  // Philips Koninck — Joost van den Vondel (1587-1679), Poet
        { source: "rijks", id: 20028261 },  // Jacob Maris — Portrait of Catharina Hendrika Horn, the Artis
        { source: "rijks", id: 20028766 },  // Anton Mauve — Portrait of Pieter Frederik van Os, Painter
        { source: "rijks", id: 200108017 },  // Wouter Johannes Van Troostwijk — Self Portrait
        { source: "rijks", id: 200109280 },  // Everdingen — Willem Jacobsz Baert (1636-84), Burgomaster of
        { source: "rijks", id: 200109281 },  // Everdingen — Portrait of Elisabeth Pietersdr Kessels (1640-
        { source: "rijks", id: 200516039 },  // Everdingen — Woman in a Large Hat
    ],
    "impressionism": [
        { source: "cleveland", id: 135382 },  // Claude Monet — The Red Kerchief
        { source: "cleveland", id: 136510 },  // Claude Monet — Water Lilies (Agapanthus)
        { source: "cleveland", id: 95272 },  // Claude Monet — Gardener's House at Antibes
        { source: "cleveland", id: 130391 },  // Claude Monet — Spring Flowers
        { source: "cleveland", id: 125234 },  // Claude Monet — Low Tide at Pourville, near Dieppe, 1882
        { source: "cleveland", id: 121188 },  // Pierre-Auguste Renoir — Romaine Lacaux
        { source: "cleveland", id: 135480 },  // Pierre-Auguste Renoir — The Apple Seller
        { source: "cleveland", id: 128364 },  // Pierre-Auguste Renoir — Young Woman Arranging Her Earring
        { source: "cleveland", id: 118159 },  // Pierre-Auguste Renoir — Bathers Playing with a Crab
        { source: "cleveland", id: 120286 },  // Pierre-Auguste Renoir — Roses in a Vase
        { source: "cleveland", id: 128392 },  // Camille Pissarro — Edge of the Woods Near L'Hermitage, Pontoise
        { source: "cleveland", id: 155626 },  // Camille Pissarro — The Lock at Pontoise
        { source: "cleveland", id: 74228 },  // Camille Pissarro — Fishmarket
        { source: "cleveland", id: 136760 },  // Alfred Sisley — Saint-Mammès, Loing Canal
        { source: "cleveland", id: 128072 },  // Berthe Morisot — Reading
        { source: "cleveland", id: 125104 },  // Edgar Degas — Frieze of Dancers
        { source: "cleveland", id: 135238 },  // Edgar Degas — Paul Lafond and Alphonse Cherfils Examining a Pa
        { source: "cleveland", id: 135265 },  // Edgar Degas — Stefanina Primicile Carafa, Marchioness of Cicer
        { source: "cleveland", id: 167142 },  // Gustave Caillebotte — Portrait of a Man
        { source: "cleveland", id: 91231 },  // Gustave Caillebotte — Villas at Trouville
    ],
    "postimpressionism": [
        { source: "rijks", id: 200109305 },  // Vincent van Gogh
        { source: "rijks", id: 200109794 },  // Vincent van Gogh
        { source: "rijks", id: 200672685 },  // Vincent van Gogh
        { source: "rijks", id: 200672686 },  // Vincent van Gogh
        { source: "rijks", id: 200672687 },  // Vincent van Gogh
        { source: "cleveland", id: 135299 },  // Vincent van Gogh — Adeline Ravoux
        { source: "cleveland", id: 125249 },  // Vincent van Gogh — The Large Plane Trees (Road Menders at Saint-Rém
        { source: "cleveland", id: 135310 },  // Vincent van Gogh — Two Poplars in the Alpilles near Saint-Rémy
        { source: "cleveland", id: 149410 },  // Paul Gauguin — In the Waves (Dans les Vagues)
        { source: "cleveland", id: 148297 },  // Paul Gauguin — The Large Tree
        { source: "cleveland", id: 123168 },  // Paul Gauguin — The Call
        { source: "cleveland", id: 115405 },  // Paul Cezanne — The Pigeon Tower at Bellevue
        { source: "cleveland", id: 135173 },  // Paul Cezanne — The Brook
        { source: "cleveland", id: 135185 },  // Paul Cezanne — Mount Sainte-Victoire
        { source: "cleveland", id: 135512 },  // Georges Seurat — Study for "Bathers at Asnières"
    ]
});
