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
