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
 * - Rijksmuseum quartet (2026-07-23): four NEW categories — Flowers
 *   (52: Bosschaert, Van Huysum, Rachel Ruysch + bloemstilleven
 *   sheets), Ships (69: the Van de Veldes, zeeslagen, VOC tiles, the
 *   Ship of State allegory), Animals (37: natural-history sheets
 *   incl. the Meerkats, Hondecoeter's birds), Knights (71: heraldic
 *   sheets incl. Brandes/Hirschman, armor, tournaments). First
 *   categories to embrace works on paper and ceramic alongside
 *   paintings. Reviewed on the interactive cull sheet (105 cuts by
 *   the creator's hand); 4 works added by direct request.
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
    ],
    "flowers": [
        { source: "rijks", id: 200148925 },  // Floral Still Life
        { source: "rijks", id: 200152947 },  // Bloemstilleven
        { source: "rijks", id: 200178277 },  // Vruchten- en bloemstilleven
        { source: "rijks", id: 200185616 },  // Bloemstilleven
        { source: "rijks", id: 200185617 },  // Bloemstilleven met insect
        { source: "rijks", id: 200187866 },  // Bloemstilleven in landschap
        { source: "rijks", id: 200256404 },  // Bloemstilleven in een vaas
        { source: "rijks", id: 200256405 },  // Bloemstilleven in een vaas
        { source: "rijks", id: 200276416 },  // Bloemstilleven op een marmeren blad
        { source: "rijks", id: 200283814 },  // Bloemstilleven met rozen en anemonen
        { source: "rijks", id: 200283816 },  // Bloemstilleven met klaprozen en anemonen
        { source: "rijks", id: 200293287 },  // Bloemstilleven met aronskelken
        { source: "rijks", id: 200352366 },  // Bloemstilleven met taxus, roos, anjer en fuchsia
        { source: "rijks", id: 200352367 },  // Bloemstilleven van veldbloemen
        { source: "rijks", id: 200352368 },  // Bloemstilleven
        { source: "rijks", id: 200352519 },  // Bloemstilleven met chrysanten
        { source: "rijks", id: 20038690 },  // Tegeltableau met bloemstilleven
        { source: "rijks", id: 200407900 },  // Bloemstilleven met pioenrozen
        { source: "rijks", id: 200407902 },  // Bloemstilleven met irissen
        { source: "rijks", id: 200408214 },  // Bloemstilleven
        { source: "rijks", id: 200408416 },  // Bloemstilleven
        { source: "rijks", id: 200416192 },  // Bloemstilleven met stokroos
        { source: "rijks", id: 200467650 },  // Floral Still Life
        { source: "rijks", id: 200470979 },  // Bloemstilleven met campanula
        { source: "rijks", id: 200470981 },  // Bloemstilleven met fuchsia
        { source: "rijks", id: 200105307 },  // Stilleven met een schaal vruchten en een vaas met bl
        { source: "rijks", id: 200108147 },  // Still Life with Fruits and Flowers
        { source: "rijks", id: 200108148 },  // Still Life with Flowers
        { source: "rijks", id: 200108224 },  // Still Life with Flowers
        { source: "rijks", id: 200108261 },  // Still Life with Flowers
        { source: "rijks", id: 200108291 },  // Still Life with Flowers in a Wan-Li Vase
        { source: "rijks", id: 200108444 },  // Still Life with Flowers
        { source: "rijks", id: 200108485 },  // Still Life with Flowers in a Glass Vase
        { source: "rijks", id: 200108670 },  // Still Life with Flowers, Fruit and Birds
        { source: "rijks", id: 200108674 },  // Still Life with Flowers in a Greek Vase: Allegory of
        { source: "rijks", id: 200108741 },  // Still Life with Flowers
        { source: "rijks", id: 200109397 },  // Still Life with Flowers and Fruit
        { source: "rijks", id: 200109798 },  // Still Life with Flowers
        { source: "rijks", id: 200109818 },  // Still Life with Flowers
        { source: "rijks", id: 200110737 },  // Still Life with Flowers
        { source: "rijks", id: 20013287 },  // Still Life with Flowers in a Glass
        { source: "rijks", id: 20025767 },  // Still Life with Flowers and Fruit
        { source: "rijks", id: 20025946 },  // Still Life with Flowers
        { source: "rijks", id: 20026022 },  // Still Life with Fish, Sea Food and Flowers
        { source: "rijks", id: 20026235 },  // Still Life with Flowers
        { source: "rijks", id: 20026435 },  // Still Life with Flowers
        { source: "rijks", id: 20027070 },  // Still Life with Flowers and a Watch
        { source: "rijks", id: 20027080 },  // Still Life with Flowers
        { source: "rijks", id: 20027188 },  // Still Life with Flowers and Fruit
        { source: "rijks", id: 20027055 },  // Still Life with Fruit
        { source: "rijks", id: 20029078 },  // Still Life with Flowers and Fruit
        { source: "rijks", id: 20027537 },  // Still Life with Flowers on a Marble Tabletop
        { source: "aic", id: 27992 },  // A Sunday on La Grande Jatte — 1884
        { source: "aic", id: 16568 },  // Water Lilies
        { source: "aic", id: 14655 },  // Two Sisters (On the Terrace)
        { source: "aic", id: 144969 },  // The Interior of the Palm House on the Pfaueninsel Ne
        { source: "aic", id: 100829 },  // Magnolias on Light Blue Velvet Cloth
        { source: "aic", id: 109926 },  // Landscape: Window Overlooking the Woods
        { source: "aic", id: 87045 },  // Still Life with Geranium
        { source: "aic", id: 111610 },  // The Garden of Palazzo Contarini dal Zaffo
        { source: "aic", id: 87088 },  // Water Lily Pond
        { source: "aic", id: 138 },  // Flower Girl in Holland
        { source: "aic", id: 14586 },  // The Poet's Garden
        { source: "aic", id: 81539 },  // On the Bank of the Seine, Bennecourt
        { source: "aic", id: 16554 },  // The Artist's House at Argenteuil
        { source: "aic", id: 4783 },  // Poppy Field (Giverny)
        { source: "aic", id: 66042 },  // Trompe-l'Oeil Still Life with a Flower Garland and a
        { source: "aic", id: 97933 },  // Water Lily Pond
        { source: "aic", id: 4887 },  // Irises
        { source: "aic", id: 16617 },  // Chrysanthemums
        { source: "aic", id: 18951 },  // Yellow Dancers (In the Wings)
        { source: "aic", id: 14561 },  // The Vase of Tulips
        { source: "aic", id: 81566 },  // The Sacred Grove, Beloved of the Arts and the Muses
        { source: "aic", id: 14647 },  // Young Woman Sewing
        { source: "aic", id: 153798 },  // Woman in a Garden
        { source: "aic", id: 75507 },  // Still Life: Corner of a Table
        { source: "aic", id: 94126 },  // Still Life with Monkey, Fruits, and Flowers
        { source: "aic", id: 107938 },  // Fête champêtre (Pastoral Gathering)
        { source: "aic", id: 111059 },  // Flowers and Fruit in a Porcelain Bowl
        { source: "aic", id: 110982 },  // Still Life with Flowers
        { source: "aic", id: 160229 },  // Pergola with Oranges
        { source: "aic", id: 39479 },  // Springtime and Love
        { source: "aic", id: 64029 },  // Bouquet of Flowers in an Earthenware Vase
        { source: "aic", id: 94240 },  // Flowers: Poppies and Daisies
        { source: "aic", id: 72180 },  // Still Life with Flowers
        { source: "aic", id: 20534 },  // Roses in a Bowl
        { source: "aic", id: 41375 },  // Flowers
        { source: "aic", id: 8610 },  // Flowers in a Vase
        { source: "aic", id: 11142 },  // Vase of Flowers
        { source: "aic", id: 264716 },  // Bouquet of Flowers and Fruit with Blue Ribbon
        { source: "aic", id: 265263 },  // Still Life with Grapes and Flowers
    ],
    "ships": [
        { source: "rijks", id: 200108354 },  // The Battle of the Downs against the Spanish Armada, 
        { source: "rijks", id: 200108355 },  // The Battle of Terheide
        { source: "rijks", id: 200108357 },  // "Sea Battle between Cornelis Tromp on the ""Gouden L
        { source: "rijks", id: 200108514 },  // Captured English Ships after the Four Days’ Battle
        { source: "rijks", id: 200108619 },  // Episode from the Four Days' Battle, 11-14 June 1666,
        { source: "rijks", id: 200108749 },  // The Battle of Dunkirk
        { source: "rijks", id: 200108750 },  // The Battle of Livorno (Leghorn)
        { source: "rijks", id: 200110522 },  // "Council of War aboard ""The Seven Provinces"", the 
        { source: "rijks", id: 200116984 },  // Zeeslag tussen een Nederlandse en een Engelse vloot
        { source: "rijks", id: 200117122 },  // Zeeslag
        { source: "rijks", id: 200121125 },  // Bewoners van Sunda eilanden en zeeslag
        { source: "rijks", id: 200121528 },  // Zeeslag
        { source: "rijks", id: 200121541 },  // Navium Variae Figurae
        { source: "rijks", id: 200122201 },  // Zeeslagen tijdens de Tweede Engelse Oorlog
        { source: "rijks", id: 200122202 },  // Zeeslag
        { source: "rijks", id: 200128642 },  // de Roemrijke Overwinning van den franschen Admiraal 
        { source: "rijks", id: 200128823 },  // Nieuwe Scheeps Batalien
        { source: "rijks", id: 200128824 },  // Nieuwe Scheeps Batalien
        { source: "rijks", id: 200128825 },  // Nieuwe Scheeps Batalien
        { source: "rijks", id: 200128826 },  // Nieuwe Scheeps Batalien
        { source: "rijks", id: 200128827 },  // Nieuwe Scheeps Batalien
        { source: "rijks", id: 200128828 },  // Nieuwe Scheeps Batalien
        { source: "rijks", id: 200128829 },  // Zeeslag
        { source: "rijks", id: 200128830 },  // Nieuwe Scheeps Batalien
        { source: "rijks", id: 200128831 },  // Nieuwe Scheeps Batalien
        { source: "rijks", id: 200128832 },  // Nieuwe Scheeps Batalien
        { source: "rijks", id: 200128833 },  // Zeeslag
        { source: "rijks", id: 200128834 },  // Zeeslag met een zinkend schip
        { source: "rijks", id: 200128835 },  // Na de zeeslag
        { source: "rijks", id: 200101455 },  // Dit is het schip de Goude Leeuw / Een kiel / die in 
        { source: "rijks", id: 20010368 },  // Gezicht op het schip "Jupiter" liggende voor de werf
        { source: "rijks", id: 200105977 },  // Schouwburg van den Oorlog, Beginnende van Koning Kar
        { source: "rijks", id: 200108356 },  // Episode from the Battle between the Dutch and Swedis
        { source: "rijks", id: 200108358 },  // The Capture of the Royal Prince
        { source: "rijks", id: 200108359 },  // A Ship on the High Seas Caught by a Squall, Known as
        { source: "rijks", id: 200108360 },  // The Cannon Shot
        { source: "rijks", id: 200144900 },  // Zeeslag voor een kust
        { source: "rijks", id: 200144903 },  // Twee roeiboten bij een zeilschip voor anker in een b
        { source: "rijks", id: 200144910 },  // Zeegezicht met enkele schepen
        { source: "rijks", id: 200144911 },  // Zeegezicht met enkele schepen in kalm water bij de k
        { source: "rijks", id: 200144913 },  // Zeegezicht met enkele schepen op de rede liggend
        { source: "rijks", id: 200144915 },  // Enkele schepen in stil water
        { source: "rijks", id: 200144916 },  // het overseyllen vande oorlog schepen van 't vlie (..
        { source: "rijks", id: 200144917 },  // Het opbrengen van veroverde Engelse schepen
        { source: "rijks", id: 200144918 },  // Twee roeiboten varen in de richting van een koopvaar
        { source: "rijks", id: 200144919 },  // Vissershaven
        { source: "rijks", id: 200144920 },  // Zeegezicht met een roeiboot bij een fregat
        { source: "rijks", id: 200144922 },  // Een naar rechts zeilend schip
        { source: "rijks", id: 200144923 },  // Voor anker liggende schepen
        { source: "rijks", id: 200144924 },  // Portret van de voorsteven van een Engels schip (de E
        { source: "rijks", id: 200144925 },  // Groot zeilschip van opzij gezien
        { source: "rijks", id: 200144929 },  // Twee kleine vaartuigen
        { source: "rijks", id: 200144931 },  // Zeeslag
        { source: "rijks", id: 200117136 },  // Driemaster van de Amsterdamse Admiraliteit
        { source: "rijks", id: 200117960 },  // Driemaster met volle zeilen
        { source: "rijks", id: 200139519 },  // Gezicht op het IJ met een driemaster en zeilschepen
        { source: "rijks", id: 200142950 },  // Driemaster op de rede van een rotsachtige kust
        { source: "rijks", id: 200163899 },  // Driemaster
        { source: "rijks", id: 200187176 },  // Driemaster wordt gelost
        { source: "rijks", id: 200194404 },  // Driemaster
        { source: "rijks", id: 200198926 },  // Diverse schepen op het water
        { source: "rijks", id: 200198963 },  // Driemaster met vlag
        { source: "rijks", id: 200198964 },  // Driemaster met vlag en een roeiboot
        { source: "rijks", id: 200198965 },  // Verschillende schepen serie C
        { source: "rijks", id: 200198966 },  // Driemaster met de wind in de zeilen
        { source: "rijks", id: 200198968 },  // Driemaster met sloep
        { source: "rijks", id: 200198970 },  // Verschillende schepen serie C
        { source: "rijks", id: 200198978 },  // Verschillende schepen serie E
        { source: "rijks", id: 200413509 },  // Het Schip van Staat, 1620
        { source: "rijks", id: 200447566 },  // Die bewaffnete Neutralitaets Flotte der Nordischen M
        { source: "rijks", id: 200447533 },  // Walvisvangst voor Groenland
        { source: "rijks", id: 20027254 },  // Storm in the Strait of Dover
        { source: "rijks", id: 20026301 },  // Ships in a Turbulent Sea
        { source: "rijks", id: 20028207 },  // Ships off the Coast
        { source: "rijks", id: 200444687 },  // Zeegezicht met schepen en boten in de wind
        { source: "rijks", id: 20026920 },  // Dutch Ships Ramming Spanish Galleys off the English 
        { source: "rijks", id: 20027312 },  // Episode from the Four Days' Naval Battle (11-14 June
        { source: "rijks", id: 20038739 },  // Tegeltableau met schip, met op de vlaggen VOC A
        { source: "aic", id: 14598 },  // The Beach at Sainte-Adresse
        { source: "aic", id: 25865 },  // The Herring Net
        { source: "aic", id: 4796 },  // Fishing Boats with Hucksters Bargaining for Fish
        { source: "aic", id: 76279 },  // Yang Pu Moving His Family
        { source: "aic", id: 111610 },  // The Garden of Palazzo Contarini dal Zaffo
        { source: "aic", id: 24645 },  // Under the Wave off Kanagawa (Kanagawa oki nami ura),
        { source: "aic", id: 14620 },  // Cliff Walk at Pourville
        { source: "aic", id: 109314 },  // Fishing in Spring, the Pont de Clichy (Asnières)
        { source: "aic", id: 889 },  // Barks Fleeing Before the Storm
        { source: "aic", id: 20535 },  // Étretat: The Beach and the Falaise d'Amont
        { source: "aic", id: 59927 },  // Boats on the Beach at Étretat
        { source: "aic", id: 14630 },  // Venice, Palazzo Dario
        { source: "aic", id: 152747 },  // York Harbor, Coast of Maine
        { source: "aic", id: 81535 },  // Sea View, Calm Weather (Vue de mer, temps calme)
        { source: "aic", id: 495 },  // Coast Scene
        { source: "aic", id: 81501 },  // Dante's Bark
        { source: "aic", id: 30361 },  // Entrance to the Port of Honfleur
        { source: "aic", id: 16343 },  // Fishing Boats in a Calm
        { source: "aic", id: 16370 },  // Fishing Boats off an Estuary
        { source: "aic", id: 58984 },  // Landscape along the Seine with the Institut de Franc
        { source: "aic", id: 111632 },  // Douarnenez in Sunshine
        { source: "aic", id: 57854 },  // Shipwreck
        { source: "aic", id: 40507 },  // Christ in the Storm
        { source: "aic", id: 111630 },  // The Church of Overschie
        { source: "aic", id: 28853 },  // River Boat
        { source: "aic", id: 47601 },  // The Battle of Pharsalus and the Death of Pompey
        { source: "aic", id: 20597 },  // Capriccio: The Lagoon
        { source: "aic", id: 57191 },  // On the Nile
        { source: "aic", id: 100353 },  // Fête de Saint Marc, Venise
        { source: "aic", id: 86297 },  // Two Boats in a Storm
        { source: "aic", id: 20542 },  // View on the Seine, Paris
        { source: "aic", id: 244013 },  // Shipwreck near a Rocky Coast
        { source: "aic", id: 40021 },  // Perilous Journey
        { source: "aic", id: 111728 },  // The Dutch Whaling Fleet
        { source: "aic", id: 209910 },  // Beached Fishing Boats
    ],
    "animals": [
        { source: "rijks", id: 200105196 },  // Vogel bij een nest jongen
        { source: "rijks", id: 200105207 },  // Grauwe Klovenier bij haar nest met jongen
        { source: "rijks", id: 200105221 },  // Vogel
        { source: "rijks", id: 200105222 },  // Vogel op nest
        { source: "rijks", id: 200105223 },  // Vogel op boomstam
        { source: "rijks", id: 200105440 },  // Vogel in veld
        { source: "rijks", id: 200105441 },  // Vogel op heide
        { source: "rijks", id: 200105443 },  // Vogel bij nest met kuikens in boom
        { source: "rijks", id: 200106300 },  // Landschap met vogel op boomstronk
        { source: "rijks", id: 200109517 },  // Muzikanten op de rug van een grote vogel
        { source: "rijks", id: 200110578 },  // Drie schetsen van een vogel
        { source: "rijks", id: 200101046 },  // Studies van vogels
        { source: "rijks", id: 200105183 },  // Twee jonge vogels op een nest (vogels)
        { source: "rijks", id: 200105185 },  // Twee vinken (boekvinken, botvinken of charlottes) op
        { source: "rijks", id: 200105186 },  // Löffelente mit kaum ausgefallenen Jungen auf der Ins
        { source: "rijks", id: 200105187 },  // Junge Rothschenkel im Nest
        { source: "rijks", id: 200105219 },  // Vink bij nest met jongen (vogels)
        { source: "rijks", id: 200105220 },  // Tortelduif op het nest bij hare jongen
        { source: "rijks", id: 200105229 },  // Wielewaal bij een nest met jongen (vogels, nesten)
        { source: "rijks", id: 200101316 },  // Alfabet met dieren
        { source: "rijks", id: 200101317 },  // Dieren A.B.C. / histoire naturelle alphabetique
        { source: "rijks", id: 200101318 },  // Dieren A.B.C. / histoire naturelle alphabetique
        { source: "rijks", id: 200101338 },  // Kluchtige gestalten en dieren / Scènes grotesques
        { source: "rijks", id: 200101339 },  // Kluchtige gesteltenissen en dieren / Postures comiqu
        { source: "rijks", id: 200101340 },  // Kluchtige gestalten en dieren / Scènes grotesques
        { source: "rijks", id: 200101494 },  // Dieren en planten
        { source: "rijks", id: 200101495 },  // Dieren en planten
        { source: "rijks", id: 200101496 },  // Dieren en planten
        { source: "rijks", id: 200101574 },  // Dieren en planten
        { source: "rijks", id: 200101575 },  // Dieren en planten
        { source: "rijks", id: 200101576 },  // Dieren en planten
        { source: "rijks", id: 200101577 },  // Dieren en planten
        { source: "rijks", id: 200101591 },  // Dieren
        { source: "rijks", id: 200101763 },  // Vier wetenschappelijke voorstellingen van dieren
        { source: "rijks", id: 200105161 },  // Kinder Gänse und Enten bij eenen Bauernhof
        { source: "rijks", id: 200475259 },  // Suricata suricatta (Meerkats)
        { source: "rijks", id: 200475260 },  // Suricata suricatta (Meerkats)
        { source: "rijks", id: 200138949 },  // Orpheus Enchanting the Birds and Animals with his Ly
        { source: "rijks", id: 200122502 },  // Rhinocerus
        { source: "rijks", id: 200393895 },  // Onbekend dier
        { source: "rijks", id: 200565589 },  // Elefante. / Elephant. / Eléphant. / Olifant
        { source: "rijks", id: 200475464 },  // Syncerus caffer caffer (Cape buffalo)
        { source: "rijks", id: 200475432 },  // Tragelaphus strepsiceros (Greater kudu)
        { source: "rijks", id: 200475406 },  // lcelaphus buselaphus caama (Hartebeest)
        { source: "rijks", id: 20027858 },  // Lioness Resting
        { source: "rijks", id: 200118670 },  // Wit paard
        { source: "rijks", id: 200565591 },  // Girafa. / Giraffe. / Girafe
        { source: "rijks", id: 200565685 },  // Ours polaire / Polar bear / Eisbär / Orso bianco. / 
        { source: "rijks", id: 200473964 },  // Japanse kraanvogel op tak van pijnboom
        { source: "rijks", id: 200413519 },  // Brullende tijger
        { source: "rijks", id: 200567271 },  // Amphibien
        { source: "rijks", id: 200598325 },  // Series of Prints with Flowers and Animals in a Lands
        { source: "rijks", id: 200598326 },  // Series of Prints with Flowers and Animals in a Lands
        { source: "rijks", id: 200598327 },  // Series of Prints with Flowers and Animals in a Lands
        { source: "rijks", id: 200598328 },  // Series of Prints with Flowers and Animals in a Lands
        { source: "rijks", id: 200598329 },  // Series of Prints with Flowers and Animals in a Lands
        { source: "rijks", id: 200598330 },  // Series of Prints with Flowers and Animals in a Lands
        { source: "rijks", id: 200567226 },  // Dieren uit vreemde landen
        { source: "rijks", id: 200138192 },  // Verschillende dieren
        { source: "rijks", id: 200475518 },  // Equus zebra (Mountain zebra)
        { source: "rijks", id: 200577452 },  // De zebra
        { source: "rijks", id: 200527523 },  // Paard uit Denemarken (Danus)
        { source: "rijks", id: 200691295 },  // Egyptian mongoose (Herpestes ichneumon)
        { source: "rijks", id: 200567265 },  // Wilde dieren
        { source: "aic", id: 146953 },  // Two Cows and a Young Bull beside a Fence in a Meadow
        { source: "aic", id: 210511 },  // A Monumental Portrait of a Monkey
        { source: "aic", id: 898 },  // Unfinished Study of Sheep
        { source: "aic", id: 883 },  // Wounded Lioness
        { source: "aic", id: 884 },  // Tiger Resting
        { source: "aic", id: 81505 },  // Lion Hunt
        { source: "aic", id: 897 },  // Pasture in Normandy
        { source: "aic", id: 882 },  // Study of Pigs
        { source: "aic", id: 39542 },  // Cattle at Rest on a Hillside in the Alps
        { source: "aic", id: 4776 },  // The Keeper of the Flock
    ],
    "knights": [
        { source: "rijks", id: 200105288 },  // De ridder en de hond
        { source: "rijks", id: 200105409 },  // Zittende middeleeuwse ridder in harnas
        { source: "rijks", id: 200109501 },  // Dode ridder (Orlando?) wordt door vrouw en geniï weg
        { source: "rijks", id: 200110301 },  // Christelijke Ridder
        { source: "rijks", id: 200110633 },  // Shield of Edward IV (1442-83), King of England, in h
        { source: "rijks", id: 200110634 },  // Shield of Jacob of Luxemburg (after 1441-88), Lord o
        { source: "rijks", id: 200118103 },  // De roeping van een Christelijke Ridder
        { source: "rijks", id: 200119905 },  // Ridder met wijn en brood
        { source: "rijks", id: 200120848 },  // Dodendans
        { source: "rijks", id: 200121187 },  // De ridder en de Dood
        { source: "rijks", id: 200121217 },  // De ridder en de Dood
        { source: "rijks", id: 200122330 },  // Knight, Death, and the Devil
        { source: "rijks", id: 200122331 },  // Ridder, Dood en Duivel
        { source: "rijks", id: 200124421 },  // Vrouw met ridder te paard
        { source: "rijks", id: 200124430 },  // Ridder te paard
        { source: "rijks", id: 200126573 },  // "De vier excellensten der older regenten"
        { source: "rijks", id: 200131671 },  // Stierenvechten
        { source: "rijks", id: 20013525 },  // König-Ludwigs Album
        { source: "rijks", id: 200137156 },  // Kopieën naar Holbeins Dodendans
        { source: "rijks", id: 200138229 },  // Ridder naast een wapenschild
        { source: "rijks", id: 200138230 },  // Ridder naast een wapenschild
        { source: "rijks", id: 200141666 },  // Ridder van de Orde van de Kousenband
        { source: "rijks", id: 200142028 },  // Ontwerpen voor het vijfde deel van Histoire de l'adm
        { source: "rijks", id: 20010793 },  // Ridders en ruiters
        { source: "rijks", id: 200113855 },  // Gevecht tussen ridders en reuzen
        { source: "rijks", id: 20011689 },  // Costumes zu Festaufzügen und Bällen
        { source: "rijks", id: 200119515 },  // Portret van Jean Parisot de La Valette, Grootmeester
        { source: "rijks", id: 200120806 },  // Duits toernooi met twee edelmannen als ridders te pa
        { source: "rijks", id: 200120807 },  // Duits toernooi met twee edelmannen als ridders te pa
        { source: "rijks", id: 200122523 },  // Freydal
        { source: "rijks", id: 200124222 },  // Rinaldo en Armida als liefdespaar aangetroffen bij e
        { source: "rijks", id: 200124423 },  // Gevecht tussen twee ridders te paard
        { source: "rijks", id: 200124424 },  // Gevecht tussen twee ridders te paard
        { source: "rijks", id: 200124432 },  // Vrouw en ridders te paard
        { source: "rijks", id: 200126535 },  // Filips de Goede, Karel de Stoute en twee ridders
        { source: "rijks", id: 200138184 },  // Drie ridders te paard
        { source: "rijks", id: 200149737 },  // Zes voorstellingen van edellieden, ridders en ruiter
        { source: "rijks", id: 200156032 },  // Twee vechtende ridders te paard
        { source: "rijks", id: 200164486 },  // Optocht van ridders van de Orde van de Saint-Esprit 
        { source: "rijks", id: 200169392 },  // Vignet met een vergadering van ridders van de Saint-
        { source: "rijks", id: 200177768 },  // Ridders vechten in de grafkelder van een kerk
        { source: "rijks", id: 200191651 },  // Ridders in gevecht
        { source: "rijks", id: 200191655 },  // Ridders in gevecht
        { source: "rijks", id: 200114438 },  // Op de rug liggende krijgsman in harnas, met gevouwen
        { source: "rijks", id: 200119412 },  // Ornament met harnas
        { source: "rijks", id: 200126337 },  // Portret van Hendrik II van Frankrijk in harnas te pa
        { source: "rijks", id: 200133090 },  // Ruiterportret van Frederick Schomberg in harnas
        { source: "rijks", id: 200135526 },  // Buste van een soldaat in een harnas
        { source: "rijks", id: 200136963 },  // Twee rechters van Israël in harnas
        { source: "rijks", id: 200158047 },  // Portret van Karel II, koning van Spanje, staande in 
        { source: "rijks", id: 200164544 },  // Piekdrager in harnas, gekleed volgens de mode van ca
        { source: "rijks", id: 200164657 },  // Diverse ontwerpen
        { source: "rijks", id: 200167102 },  // Duitse ruiter in zwart harnas
        { source: "rijks", id: 200167103 },  // Duitse ruiter in harnas
        { source: "rijks", id: 200175964 },  // Portret van Jan I van Brabant in harnas
        { source: "rijks", id: 200179825 },  // Man in harnas met wapenschild
        { source: "rijks", id: 200188715 },  // Astolfe d'Angleterre chez Atlas de Carène
        { source: "rijks", id: 200201367 },  // Ferdinand IV van Oostenrijk
        { source: "rijks", id: 200119197 },  // Het toernooi
        { source: "rijks", id: 200121029 },  // Toernooi van het keurvorstelijk hof van Saksen met w
        { source: "rijks", id: 200121030 },  // Toernooi in Wittenberg van het keurvorstelijk hof va
        { source: "rijks", id: 200121031 },  // Toernooi in Wittenberg van het keurvorstelijk hof va
        { source: "rijks", id: 200121032 },  // Toernooi op het marktplein in Wittenberg
        { source: "rijks", id: 200129381 },  // Het toernooi in de feestzaal
        { source: "rijks", id: 200171650 },  // Don Quichot na afloop van een toernooi
        { source: "rijks", id: 200258464 },  // Zwarte Ridder schiet Wilfred van Ivanhoe te hulp tij
        { source: "rijks", id: 200263925 },  // Febraro
        { source: "rijks", id: 200263938 },  // De twaalf maanden (deel 1)
        { source: "rijks", id: 200302793 },  // Graaf Floris IV tijdens het toernooi in Corbie
        { source: "rijks", id: 200302797 },  // Graaf Floris IV tijdens het toernooi in Corbie
        { source: "rijks", id: 200309419 },  // Ridders met de familiewapens van Brandes en Hirschma
        { source: "aic", id: 15468 },  // Saint George and the Dragon
        { source: "aic", id: 105466 },  // The Battle between the Gods and the Giants
        { source: "aic", id: 110663 },  // The Combat of the Giaour and Hassan
        { source: "aic", id: 19336 },  // The Resurrection
        { source: "aic", id: 149778 },  // Allegory of Peace and War
        { source: "aic", id: 867 },  // The Guardhouse
        { source: "aic", id: 15716 },  // Saint Christopher Meets Satan; Saint Christopher bef
        { source: "aic", id: 885 },  // A Mounted Officer
        { source: "aic", id: 67362 },  // Saint Martin and the Beggar
        { source: "aic", id: 152851 },  // Sketch for The Revolt of Cairo
        { source: "aic", id: 16495 },  // Rinaldo and the Magus of Ascalon
        { source: "aic", id: 16492 },  // Armida Abandoned by Rinaldo
        { source: "aic", id: 16485 },  // Rinaldo and Armida in Her Garden
        { source: "aic", id: 59956 },  // The Wedding of Peleus and Thetis
        { source: "aic", id: 100060 },  // Alexander at the Tomb of Cyrus the Great
        { source: "aic", id: 93394 },  // Battle Scene
        { source: "aic", id: 111618 },  // The Battle of Zama
        { source: "aic", id: 4089 },  // Venus and Mars with Cupid and the Three Graces in a 
        { source: "aic", id: 12891 },  // Theodosius Repulsed from the Church by Saint Ambrose
        { source: "aic", id: 16166 },  // Salome Asking Herod for the Head of Saint John the B
        { source: "aic", id: 33249 },  // The Continence of Scipio
        { source: "aic", id: 110527 },  // Landscape with Tournament and Hunters
        { source: "aic", id: 111609 },  // Emperor Heraclius Denied Entry into Jerusalem
        { source: "aic", id: 16246 },  // The Continence of Scipio
        { source: "aic", id: 111418 },  // Panthea, Cyrus, and Araspas
        { source: "aic", id: 44829 },  // Polycrates' Crucifixion
        { source: "aic", id: 58702 },  // The Dream of Paris
        { source: "aic", id: 44826 },  // Polycrates and the Fisherman
        { source: "aic", id: 31173 },  // Resurrection of Christ
        { source: "aic", id: 59989 },  // Sketch for "Oath on the Rütli" (recto), Female Figur
        { source: "aic", id: 28173 },  // The Resurrection
        { source: "aic", id: 111608 },  // Emperor Heraclius Slays the King of Persia
        { source: "aic", id: 15406 },  // Don Quixote and the Windmills
        { source: "aic", id: 28143 },  // Architectural Landscape with Belisarius Receiving Al
        { source: "aic", id: 47601 },  // The Battle of Pharsalus and the Death of Pompey
        { source: "aic", id: 60867 },  // General Juan Prim (1814-1870)
        { source: "aic", id: 57652 },  // Queen Philippa at the Battle of Neville's Cross
        { source: "aic", id: 88404 },  // Warrior Saint
        { source: "aic", id: 36495 },  // Liberation of Saint Peter from Prison
        { source: "aic", id: 13208 },  // Saracens and Crusaders
        { source: "aic", id: 15260 },  // The Judgement of Zaleucus
        { source: "aic", id: 93737 },  // Landscape with Figures
        { source: "aic", id: 111660 },  // Saint Sebastian
        { source: "aic", id: 48776 },  // Man in Armour
        { source: "aic", id: 100356 },  // The Apotheosis of the Hero
        { source: "aic", id: 39528 },  // The Out-Post
        { source: "aic", id: 14565 },  // Don Quixote in the Mountains
        { source: "aic", id: 46076 },  // Portrait of a Man
        { source: "aic", id: 100357 },  // David Slaying Goliath
        { source: "aic", id: 111726 },  // Mon Ancien Regiment
    ]
});

// Works excluded from LIVE-SEARCH categories by contact-sheet audit
// (the creator's hand on every card). Live results cannot be cut by
// omission — search re-serves them — so exclusions bake into the
// query as must_not id terms. This object shares the pin file so the
// Curia owns ONE machine-writable curation canon.
export const CATEGORY_EXCLUSIONS = Object.freeze({
    "impressionism": [154121, 31816, 110798],
    "postimpressionism": [191564],
    "landscapes": [16571, 19339, 28849, 16488, 234781, 15716, 883, 884, 13487, 110242, 39560, 111649, 67362, 16496],
    "portraits": [25865, 28860]
});
