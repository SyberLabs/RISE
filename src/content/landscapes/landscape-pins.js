/**
 * Landscapes and Earth and sky: the reviewed curation canon.
 *
 * The owner's verdicts by eye, 2026-10-26, on the review page
 * `docs/assets/live/landscape-review.html` over the harvested sheet
 * `sheet-2026-10-26.json`. The owner's own file is kept beside this one
 * (`landscape-decisions.2026-10-26.json`): it records only cuts, so every work
 * of the sheet it does not name is kept. `landscape-pins.test.js` holds this
 * file to it exactly.
 *
 * THIS FILE IS THE DECISION; `landscapes-catalog.generated.json` IS ITS
 * RESULT, built by `scripts/build-landscape-catalog.mjs` from the kept works
 * only, with their rights frozen at the harvest. A sheet is a shortlist and
 * never an approval: nothing reaches a reader unless it is listed under `kept`
 * here, and a harvest never offers a kept or cut work again.
 */

export const REVIEW = Object.freeze({
    by: 'owner, by eye',
    date: '2026-10-26',
    sheet: 'src/content/landscapes/sheet-2026-10-26.json',
    decisions: 'src/content/landscapes/landscape-decisions.2026-10-26.json'
});

export const LANDSCAPES = Object.freeze({
    name: 'Landscapes',
    /** The owner's absolute favourites: a collection's first photograph in a reading is one of these. */
    favourites: Object.freeze([
        'cleveland:144967', // Point Judith, Rhode Island — Martin Johnson Heade
        'cleveland:84371', // The Pink Cloud — Henri-Edmond Cross
    ]),
    /** Kept, 68: every work of the sheet the owner did not cut. */
    kept: Object.freeze([
        'cleveland:109240', // Arkville Landscape — Alexander H. Wyant
        'cleveland:145124', // Rocky Landscape with Hunters — Gaspard Dughet
        'cleveland:140078', // La Cervara, the Roman Campagna — Jean Baptiste Camille Corot
        'cleveland:159482', // Gibbons in a Landscape
        'cleveland:144732', // Storm in the Mountains — Frederic Edwin Church
        'cleveland:169673', // Landscape with Hunters — Jan Wijnants
        'cleveland:148365', // Landscape Near Paris — Georges Michel
        'cleveland:157228', // A Calm Watering Place—Extensive and Boundless Scene with Cattle — Alvan Fisher
        'cleveland:139816', // Wooded and Hilly Landscape — Jacob van Ruisdael
        'cleveland:168366', // Landscape with Rider on White Horse — Jean Achille Benouville
        'cleveland:132930', // Landscape Album in Various Styles: Landscape after Mi Fei — Zha Shibiao
        'cleveland:148215', // Landscape with Haywain — Worthington Whittredge
        'cleveland:137331', // Landscape with a Church by a Torrent — Jacob van Ruisdael
        'cleveland:86109', // Landscape — Kano Motonobu
        'cleveland:150051', // Alpine Landscape: The Handegg, Switzerland — Jean-Léon Gérôme
        'cleveland:143772', // Trees on a Rocky Hillside — Asher B. Durand
        'cleveland:154645', // Mercury and Argus in a Landscape — Dirck van der Lisse
        'cleveland:124078', // Pond at Ville-d'Avray — Jean Baptiste Camille Corot
        'cleveland:149613', // Paintings after Ancient Masters: Daoist and Crane in Autumn Landscape — Chen Hongshou
        'cleveland:172815', // Mount Starr King, Yosemite — Albert Bierstadt
        'cleveland:166506', // Winter Landscape — Jan Griffier
        'cleveland:157104', // The Seine at Bas-Meudon — Johan Barthold Jongkind
        'cleveland:144967', // Point Judith, Rhode Island — Martin Johnson Heade
        'cleveland:147017', // Branch Hill Pond, Hampstead — John Constable
        'cleveland:151882', // The Waterfalls at Tivoli — Claude-Joseph Vernet
        'cleveland:149659', // Landscape — Ishō Tokugan
        'cleveland:146416', // Noah: The Eve of the Deluge — John Linnell
        'cleveland:149142', // Chinese Landscape — Kano Chikanobu
        'cleveland:84371', // The Pink Cloud — Henri-Edmond Cross
        'cleveland:132924', // Landscape Album in Various Styles: Spring Plowing — Zha Shibiao
        'cleveland:110952', // Landscape — George Inness
        'cleveland:154962', // Cader Idris, with the Mawddach River — Richard Wilson
        'cleveland:141168', // Panoramic View of the Alps, Les Dents du Midi — Gustave Courbet
        'cleveland:143477', // An October Day in the White Mountains — John Frederick Kensett
        'cleveland:98043', // Landscape — Jasper F. Cropsey
        'cleveland:618083', // Lions and Fox in a Rugged Landscape — Roelant Savery
        'cleveland:142661', // Landscape with a Peasant and His Flock — Alexander Joseph Daiwaille
        'cleveland:149610', // Paintings after Ancient Masters: Autumn Landscape — Chen Hongshou
        'cleveland:134072', // Sunny Autumn Day — George Inness
        'cleveland:147464', // Castle on a River — Salomon van Ruysdael
        'cleveland:151257', // View of the Gulf of Pozzuoli from Solfatara — Philipp Hackert
        'cleveland:132835', // Album of Seasonal Landscapes, Leaf D (previous leaf 2) — Xiao Yuncong
        'cleveland:144431', // Peasants Crossing a Stream — Jan Siberechts
        'cleveland:359246', // Feige Waterfall (Feigefossen), Lysterfjord, Norway — Johan Christian Clausen Dahl
        'cleveland:132928', // Landscape Album in Various Styles: Traveling in Autumn Mountains — Zha Shibiao
        'cleveland:109242', // Autumn Landscape and Pool — Alexander H. Wyant
        'cleveland:150697', // Travelers by a Lake — Esaias van de Velde
        'cleveland:109239', // A Winter Sky — George Inness
        'cleveland:148363', // Sleeping Peasants near Fields (Parable of the Weeds) — Simon de Vlieger
        'cleveland:150038', // Châteauvieux-sur-Suran — Antoine-Claude Ponthus-Cinier
        'cleveland:132931', // Landscape Album in Various Styles: Pleasure in a Mountain Brook — Zha Shibiao
        'cleveland:157126', // Untitled (Winter Landscape) — William B. Post
        'cleveland:667960', // Untitled (Landscape Scene) — John Burke
        'cleveland:161277', // Landscape with Seated Figure on Stream Bank — Frank Chauvassaignes
        'cleveland:151365', // Rowing Home the Schoof-Stuff — Peter Henry Emerson
        'cleveland:149904', // Winter Landscape — Clarence H. White
        'cleveland:156526', // Switzerland. Grindelwald, Upper Glacier, Source of the Lutschine — Adolphe Braun
        'cleveland:157321', // Untitled (Landscape near Watsonville, California) — Eadweard J. Muybridge
        'cleveland:160071', // River Landscape, Scotland — Captain Horatio Ross
        'cleveland:154698', // Road in the Forest — Eugène Cuvelier
        'cleveland:160917', // Dark Landscape with Hills — Frank Chauvassaignes
        'cleveland:160070', // River Landscape, Scotland — Captain Horatio Ross
        'cleveland:162311', // The Domes, from the Sentinel Domes, Yosemite — Carleton E. Watkins
        'cleveland:153218', // Cantley: Wherries Waiting for the Turn of the Tide — Peter Henry Emerson
        'cleveland:668066', // The Upper Himmalayahs. View on the New Road between India and China. Mt. Pangi with the Sn
        'cleveland:155400', // Valley of the Yosemite, from Rocky Ford — Eadweard J. Muybridge
        'cleveland:155585', // The Miners' Bridge, on the Llugwy, North Wales — Roger Fenton
        'rijks:200473069', // Landschap met een vrouw met parasol
    ]),
    /** Cut, 112: owner, by eye, 2026-10-26. Never re-offered by a harvest. */
    cut: Object.freeze([
        'cleveland:148810', // Haboku (Flung-ink) Landscape — Shūgetsu Tōkan
        'cleveland:129861', // Landscape with Flying Geese — Ma Lin
        'cleveland:137921', // Landscape with a lotus pool, from a Tuti-nama (Tales of a Parrot): Eighth Night
        'cleveland:90136', // Moonlit Landscape
        'cleveland:150932', // Landscape Ink-Play — Fang Congyi
        'cleveland:90249', // Mountain Market, Clear with Rising Mist
        'cleveland:170812', // A Mounted Prince Hunting Lion in a Rocky Landscape — Khem Karan
        'cleveland:152197', // Landscape
        'cleveland:160490', // Tigers and Leopard Frolicking
        'cleveland:314364', // Shiva Seated on a Throne in a Landscape
        'cleveland:130219', // Landscape after Jing Hao and Guan Tong — Li Shizhuo
        'cleveland:160458', // Painting of One Hundred Themes
        'cleveland:137924', // Landscape with a lotus pool, from a Tuti-nama (Tales of a Parrot), Eighth Night — Gujarati
        'cleveland:140322', // Chinese Landscape
        'cleveland:170797', // A prince visiting a holy man in a rocky landscape
        'cleveland:79576', // Chinese Literatus in an Autumn Landscape — Josui Sōen
        'cleveland:173659', // Landscape with Poet Tao Yuanming (365–472 CE)
        'cleveland:170813', // A female figure standing in a landscape holding a four-stringed “khuuchir” and a lotus
        'cleveland:166508', // Woman Sleeping in a Landscape with a Letter — Bernard Gaillot
        'cleveland:145373', // Flowers and Birds in a Spring Landscape — Kano Motonobu
        'cleveland:160946', // Herdboys and Buffalo in Landscapes — Guo Min
        'cleveland:170798', // A Prince Visiting a Holy Man in a Rocky Landscape (recto)
        'cleveland:699644', // A Mountain Stream — Julie H. Beers
        'cleveland:152832', // River Landscape — Min Zhen
        'cleveland:137513', // Habbaza’s sister, who is sent to console her, discovers the disguised Arab in her place, f
        'cleveland:163456', // Harbor of Boston, with the City in the Distance — Fitz Henry Lane
        'cleveland:140344', // Hunters Near Ruins — Jan Baptist Weenix
        'cleveland:170821', // Page from the Panj Ganj (Five Treasures) of Abd al-Rahman Jami (Persian, 1414–1492), with 
        'cleveland:145376', // Flowers and Birds in a Spring Landscape — Kano Motonobu
        'cleveland:132837', // Album of Seasonal Landscapes, Leaf A (previous leaf 4) — Xiao Yuncong
        'cleveland:314473', // Maru Ragini, from a Ragamala (Garland of Melodies)
        'cleveland:126243', // A Storm Behind the Isle of Wight — Julius Caesar Ibbetson
        'cleveland:145375', // Flowers and Birds in a Spring Landscape — Kano Motonobu
        'cleveland:149396', // The Artist in His Room at the Villa Medici, Rome — Léon Cogniet
        'cleveland:152828', // Landscape after Mi Fu — Min Zhen
        'cleveland:170783', // Hunting with falcons in a landscape; verso: Calligraphy of Chaghatai Turkish poems in prai
        'cleveland:145374', // Flowers and Birds in a Spring Landscape — Kano Motonobu
        'cleveland:155865', // Tiger Hunt of Ram Singh II
        'cleveland:153735', // Winter and Summer Flowers — Kaihō Yūshō
        'cleveland:314365', // The Heroine Who Waits Anxiously for Her Absent Lover: Utka Nayika
        'cleveland:141935', // Samuel Williams — Washington Allston
        'cleveland:154002', // Seasonal Landscapes — Kano Hideyori
        'cleveland:137745', // The parrot addresses Khujasta at the beginning of the forty-fourth night, from a Tuti-nama
        'cleveland:79591', // Landscape
        'cleveland:152765', // The Doge's Palace, Venice — Richard Parkes Bonington
        'cleveland:152827', // Landscape in the Manner of Ma Yuan — Min Zhen
        'cleveland:130637', // Rama and Lakshmana Fighting Ravana, from a Dashavatara (Ten Incarnations [of Vishnu]) seri
        'cleveland:125884', // Birds and Flowers — Kano Mitsunobu
        'cleveland:132821', // Princess and attendant in trompe l’oeil window — Aqil Khan
        'cleveland:157013', // Landscape — Henry White
        'cleveland:386333', // Untitled (River, Hong Kong or Macau, China) — William Pryor Floyd
        'cleveland:160072', // River Landscape, Scotland — Captain Horatio Ross
        'cleveland:155374', // Untitled (Landscape)
        'cleveland:154048', // Untitled (The Forest of Fontainebleau) — Constant Alexandre Famin
        'cleveland:153597', // The Bridge of Palalda (near Amelieles-Bains) — Gustave Le Gray
        'cleveland:156527', // East Humboldt Mountains, Utah — Timothy H. O'Sullivan
        'cleveland:164940', // Winter Trees Reflected in a Pond — William Henry Fox Talbot
        'cleveland:313228', // Darjeeling. Kinchinjunga and the Snows from Beechwood Park — Photoglob Co.
        'cleveland:439491', // The Parthenon — Frédéric Boissonnas
        'cleveland:165408', // Mullein in Bloom — Eugène Atget
        'cleveland:439497', // Chemin de fer de Toulouse à Bayonne. Pont de l'Aran (en trois arches de 17m d'ouverture ch
        'cleveland:159606', // Untitled (Landscape with Dog)
        'cleveland:154279', // Bear Lake, LVRR — William H. Rau
        'cleveland:452662', // Vue prise du Couvent des Dominicains, Chalais (Isère), France — Félix Thiollier
        'cleveland:157562', // Study of a Birch Tree, Barbizon — Constant Alexandre Famin
        'cleveland:159639', // Harbour, Swansea, Wales — Alfred Rosling
        'cleveland:386332', // Untitled (Hong Kong, St. John’s Cathedral, from the Parade Ground, H.M. Regiment on Parade
        'cleveland:452654', // View of Ste-Adrese Beach with the Dumont Baths — Gustave Le Gray
        'cleveland:156532', // Hell's Half Acre, Prismatic Springs — Frank Jay Haynes
        'cleveland:322431', // Landscape with Tree and Three Men, India — John Edward Saché
        'cleveland:153145', // Amiens — Édouard Baldus
        'cleveland:92759', // Krishna's Butter Ball, Mahabalipuram — Unidentified Photographer
        'cleveland:159721', // Untitled (Scene of Fontainebleau) — André Giroux
        'cleveland:156107', // Arch in Farmyard, Swansea — Calvert Richard Jones
        'cleveland:159285', // Cathedral Rocks and Reflections, Yosemite — Charles Leander Weed
        'cleveland:157082', // Cinnabar Mountain, Devil Slide — Frank Jay Haynes
        'cleveland:159283', // The Royal Porcelain Factory at Sèvres — Henri-Victor Regnault
        'cleveland:154194', // Scotch Firs, Hawkhurst — Benjamin Brecknell Turner
        'cleveland:157317', // Avenue of the Banian Trees, Seringham, India — Captain Linnaeus Tripe
        'cleveland:157320', // Temple at Naveshera, Kashmir, India — Samuel Bourne
        'cleveland:156103', // Doorway to Sèvres Factory — Louis-Rémy Robert
        'cleveland:157424', // Mount Washington, Massachusetts, July 22, 1890 — Robert Stuart Redfield
        'cleveland:162318', // Hemlock Forest, Lehigh Valley Railroad — William H. Rau
        'rijks:200145132', // Landschap in de omgeving van Den Haag — Stoomsteendrukkerij Senefelder
        'rijks:200344904', // Veldhospitaal en een wasserij aan het front in de Dolomieten
        'rijks:200345064', // Landschap met ruïnes en het aquaduct naar Efeze — Rubellin & Fils
        'rijks:200388717', // Gezicht op het Kolkje, Amsterdam
        'rijks:200413470', // Sneeuwlandschap
        'rijks:200413476', // Sneeuwlandschap
        'rijks:200420178', // Gezicht op de korenmolen de Eendracht, Gouwsluis, Alphen aan de Rijn
        'rijks:200426312', // De Schaapskooi — Alb. Kapteijn
        'rijks:200475670', // Nederlands landschap en boerderij
        'rijks:200478057', // Landschap met op de voorgrond de oliemolen De Virgilius in Oostzaandam
        'rijks:200478077', // Landschap met oliemolen De Sint Willibrordus en huisjes aan het water in Zaandam
        'rijks:200478080', // Landschap met koeien in een weiland in Nederland
        'rijks:200478086', // Landschap met boerderijen en een koe in een weiland
        'rijks:200478265', // Landschap met sawah, voormalig Nederlands-Indië — Onnes Kurkdjian
        'rijks:200478266', // Landschap met sawah, voormalig Nederlands-Indië — Onnes Kurkdjian
        'rijks:200478268', // Landschap in voormalig Nederlands-Indië — Onnes Kurkdjian
        'rijks:200478271', // Landschap met sawah, voormalig Nederlands-Indië — Onnes Kurkdjian
        'rijks:200478272', // Landschap met sawah, voormalig Nederlands-Indië — Onnes Kurkdjian
        'rijks:200478616', // Landschap met de rivier Tjidane en de berg Salak in Buitenzorg
        'rijks:200478617', // Landschap met de rivier Tjidane en de berg Salak in Buitenzorg
        'rijks:200491192', // Gezicht op de haven van Menton met aangemeerde zeilschepen
        'rijks:200491323', // Corsicaanse schapenherder
        'rijks:200491716', // Fins landschap bij een meer — Henry Pauw van Wieldrecht
        'rijks:200492470', // Children Celebrating the Feast of St. Martin, Limburg, Netherlands — Frankl, A. & E., Edua
        'rijks:200492492', // Zestal kinderen spelend met blikken gevuld met brandend turf. St. Maarten in Venlo, Limbur
        'rijks:200493447', // Het gezelschap rust uit op een rots boven een berg in de Harz — Geldolph Adriaan Kessler (
        'rijks:200493457', // Gezicht op een stadje in de Harz — Geldolph Adriaan Kessler (Dolph)
        'rijks:200494364', // Gezicht op een huis met rieten dak, schuur en kale bomen in glooiend landschap
        'rijks:200494454', // Kerk in in bosrijk landschap ("Brokenhand Old Church")
    ])
});

export const EARTH_AND_SKY = Object.freeze({
    name: 'Earth and sky',
    /** The owner's absolute favourites: a collection's first photograph in a reading is one of these. */
    favourites: Object.freeze([
        'nasa:GSFC_20171208_Archive_e002131', // NASA Blue Marble 2007 West
    ]),
    /** Kept, 65: every work of the sheet the owner did not cut. */
    kept: Object.freeze([
        'eso:ann13016a', // The Atacama Large Millimeter/submillimeter Array (ALMA) by night, under the Magellanic Clo
        'eso:potw1222a', // The southern Milky Way above ALMA — European Southern Observatory
        'eso:eso0624b', // APEX at Chajnantor* — European Southern Observatory
        'eso:potw2635a', // A rare snowy day for the world's biggest eye on the sky — European Southern Observatory
        'eso:potw2617a', // The sunset shines on the ELT — European Southern Observatory
        'eso:potw1217a', // The moon and the arc of the Milky Way — European Southern Observatory
        'eso:potw1119a', // Eclipsed moon, striking night sky — European Southern Observatory
        'eso:vlt-brunier-nuit', // The VLT in action* — European Southern Observatory
        'eso:vlt-mw-potw', // Rare 360-degree panorama of the southern sky* — European Southern Observatory
        'eso:ann14045a', // ALMA and the centre of the Milky Way — European Southern Observatory
        'eso:eso1912j', // Total solar eclipse, La Silla Observatory, 2019 — European Southern Observatory
        'eso:eso1912a', // Total solar eclipse, La Silla Observatory, 2019 — European Southern Observatory
        'eso:potw1414a', // Cosmic fireball falling over ALMA — European Southern Observatory
        'eso:potw1322a', // Three planets dance over La Silla — European Southern Observatory
        'eso:potw1252a', // ALMA’s solitude — European Southern Observatory
        'eso:potw1031a', // Exoplanet hunters at La Silla* — European Southern Observatory
        'eso:potw1240a', // Iconic, conical Licancabur watches over Chajnantor — European Southern Observatory
        'eso:potw1226a', // Mars, 2099? — European Southern Observatory
        'eso:potw1225a', // Yepun’s laser and the Magellanic Clouds — European Southern Observatory
        'eso:potw1221a', // Icy penitents by moonlight on Chajnantor — European Southern Observatory
        'eso:eso-paranal-07', // Paranal Observatory and the volcano Llullaillaco* — European Southern Observatory
        'eso:potw2336a', // A golden halo around the ELT — European Southern Observatory
        'eso:yb_vlt_moon_cnn_cc', // Celestial conjunction at Paranal — European Southern Observatory
        'eso:uhd_img4255pc_bt_cc', // Radiance of Milky Way over La Silla — European Southern Observatory
        'eso:potw1241a', // A VISTA before sunset — European Southern Observatory
        'eso:potw1216a', // APEX stands sentry on Chajnantor — European Southern Observatory
        'eso:yb_vlt_milkyway', // Group portrait of the VLT with the galaxy — European Southern Observatory
        'eso:potw2026a', // Memory of the Solar Eclipse Above La Silla — European Southern Observatory
        'eso:potw1504a', // Celestial nomad takes centre stage — European Southern Observatory
        'nasa:STS052-23-022', // Sunrise, Earth Limb
        'nasa:PIA14659', // Long Day Journey into Night
        'nasa:STS067-709-007', // STS-67 sunset and earth limb view
        'nasa:iss072e159172', // The aurora borealis blankets the Earth
        'nasa:GSFC_20171208_Archive_e001788', // Eastern Hemisphere - Blue Marble 2012
        'nasa:iss071e439624', // An orbital sunrise colorfully illuminates the Earth's atmosphere
        'nasa:iss058e005282', // View of the Earth's limb with an aurora
        'nasa:iss042e013697', // Earth Observations — Terry Virts
        'nasa:GSFC_20171208_Archive_e002131', // NASA Blue Marble 2007 West
        'nasa:iss045e013851', // Earth Observation from the International Space Station
        'nasa:s32-72-050', // STS-32 view of the moon setting over the Earth's limb
        'nasa:iss036e027639', // Earth Observation
        'nasa:iss066e146457', // iss066e146457
        'nasa:GSFC_20171208_Archive_e002130', // NASA Blue Marble 2007 East
        'nasa:STS059-50-003', // Night image of New York City as seen from STS-59 Endeavour
        'nasa:ast-27-2339', // Earth's limb and cloud silhouette in Southern Hemisphere
        'nasa:GSFC_20171208_Archive_e001016', // Blue Marble, Eastern Hemisphere March 2014
        'nasa:iss049e007067', // iss049e007067
        'nasa:s66-38275', // Earth's limb at sunrise as seen from the Gemini 9-A spacecraft
        'nasa:iss040e030355', // Earth Observation — Alex Gerst
        'nasa:sl3-130-3130', // View of the southern aurora, luminous bands or streamers of light
        'nasa:GSFC_20171208_Archive_e001386', // Most Amazing High Definition Image of Earth - Blue Marble 2012
        'nasa:iss034e029351', // Earth Observations taken by Expedition 34 crewmember
        'nasa:iss036e016251', // Earth Observation — Karen Nyberg
        'nasa:sl3-130-3131', // View of the southern aurora, luminous bands or streamers of light
        'nasa:jsc2022e046411', // Artemis I artist's concept - earthrise — NASA/Liam Yanulis
        'nasa:PIA18033', // Earth
        'nasa:iss040e117958', // Earth Observation — Alex Gerst
        'nasa:iss034e032412', // Earth Observations taken by Expedition 34 crewmember
        'nasa:iss036e017890', // Earth Observation — Karen Nyberg
        'nasa:iss053e023965', // iss053e023965
        'nasa:as17-152-23272', // Apollo 17, Earthrise over Moon
        'nasa:iss063e054340', // iss063e054340
        'nasa:iss034e032411', // Earth Observations taken by Expedition 34 crewmember
        'nasa:iss036e007463', // Earth Observation — Karen Nyberg
        'nasa:jsc2022e046401', // Artemis I artist's concept - earthrise — NASA/Liam Yanulis
    ]),
    /** Cut, 13: owner, by eye, 2026-10-26. Never re-offered by a harvest. */
    cut: Object.freeze([
        'eso:potw1150a', // ALMA's world at night — European Southern Observatory
        'eso:potw1239a', // A hard day's night ahead — European Southern Observatory
        'eso:2606_Z8_9275-cc', // Inside the dome of ESO’s Extremely Large Telescope — European Southern Observatory
        'eso:vlt-laser-potw', // Early morning on Paranal* — European Southern Observatory
        'eso:potw1115a', // ESO Headquarters at sunset* — European Southern Observatory
        'eso:eso-paranal-51', // Bird’s eye view of the Very Large Telescope* — European Southern Observatory
        'eso:potw1639a', // 1001 stars — European Southern Observatory
        'eso:eso1119c', // The VLT Survey Telescope: the largest telescope in the world designed for visible light sk
        'eso:potw1618a', // Four lasers over Paranal — European Southern Observatory
        'nasa:art002e009280b', // Artemis Era Earthrise — NASA
        'nasa:art002e016299', // Earthrise Captured by Orion
        'nasa:iss040e083604', // Earth Observation — Alex Gerst
        'nasa:ARC-2010-ACD10-0100-004', // ARC-2010-ACD10-0100-004 — Dominic Hart
    ])
});

/** The collections by their bare pool id (`sci-landscapes`, `sci-earth-and-sky`). */
export const LANDSCAPE_COLLECTIONS = Object.freeze({
    landscapes: LANDSCAPES,
    'earth-and-sky': EARTH_AND_SKY
});
