/**
 * The Chapel corpus manifest — the Catholic Bible in 73 books.
 *
 * Translation: Douay-Rheims, Challoner revision (public domain;
 * Challoner d. 1781). Source: Project Gutenberg #1581, ingested once
 * by scripts/chapel-ingest.mjs. Translation identity is provenance:
 * every surface that shows this text names it.
 *
 * Each checksum is SHA-256 over the book's exact payload string — the
 * same integrity discipline the Atrium applies. The payload modules in
 * ./books/ are generated and must never be hand-edited; a checksum
 * mismatch at load time means the text is not the text.
 *
 * The reading stream carries VERSES ONLY. Challoner's annotations and
 * the book introductions are commentary, deliberately excluded — they
 * belong to a future study surface, not the rhythm stream.
 *
 * Total corpus: 73 books, 5,014,514 characters.
 */

export const CHAPEL_TRANSLATION = Object.freeze({
  id: 'douay-rheims-challoner',
  name: 'Douay-Rheims',
  edition: 'Challoner revision',
  language: 'English',
  rights: 'PUBLIC_DOMAIN',
  source: 'Project Gutenberg #1581',
  sourceUrl: 'https://www.gutenberg.org/ebooks/1581'
});

/** Liturgical groupings, in canonical order — the browse structure. */
export const CHAPEL_GROUPINGS = Object.freeze([
  { id: 'pentateuch', name: 'The Pentateuch', testament: 'ot' },
  { id: 'historical', name: 'Historical Books', testament: 'ot' },
  { id: 'wisdom', name: 'Wisdom Books', testament: 'ot' },
  { id: 'prophets', name: 'The Prophets', testament: 'ot' },
  { id: 'gospels', name: 'The Holy Gospels', testament: 'nt' },
  { id: 'acts', name: 'Acts of the Apostles', testament: 'nt' },
  { id: 'pauline', name: 'Pauline Epistles', testament: 'nt' },
  { id: 'catholic-epistles', name: 'Catholic Epistles', testament: 'nt' },
  { id: 'apocalypse', name: 'The Apocalypse', testament: 'nt' }
]);

export const CHAPEL_BOOKS = Object.freeze([
  {"id":"genesis","name":"Genesis","testament":"ot","grouping":"pentateuch","chapters":50,"verses":1530,"charCount":203787,"checksum":"d5d9a43bb5520a52a87ed1d40ca017e70952f5bb0cdb24b834262e8ee3a430fa","constName":"BOOK_GENESIS"},
  {"id":"exodus","name":"Exodus","testament":"ot","grouping":"pentateuch","chapters":40,"verses":1211,"charCount":171324,"checksum":"bd1f339a648ee3f46e8d93c656a441117590f0ee1e7fdd26b70f70eb0d5f5c15","constName":"BOOK_EXODUS"},
  {"id":"leviticus","name":"Leviticus","testament":"ot","grouping":"pentateuch","chapters":27,"verses":858,"charCount":121951,"checksum":"ad50052d67b8301f68a8af08ede51ccab7c7f8e67167fcc343830bfc7fb14a98","constName":"BOOK_LEVITICUS"},
  {"id":"numbers","name":"Numbers","testament":"ot","grouping":"pentateuch","chapters":36,"verses":1288,"charCount":170701,"checksum":"1fe1bd4f6268381ab731243bc3301955edfe1739b8404b2cb5b07b86dff5a6d7","constName":"BOOK_NUMBERS"},
  {"id":"deuteronomy","name":"Deuteronomy","testament":"ot","grouping":"pentateuch","chapters":34,"verses":959,"charCount":149170,"checksum":"2f332cffd4f48103f1210ee7fd12cf8bccb39eed0bd2a18857418591999e5b67","constName":"BOOK_DEUTERONOMY"},
  {"id":"josue","name":"Josue","testament":"ot","grouping":"historical","chapters":24,"verses":658,"charCount":100647,"checksum":"79baf0e72b204bfbb50db4f2292530b81862eab1324244bda44daa4061a52aa5","constName":"BOOK_JOSUE"},
  {"id":"judges","name":"Judges","testament":"ot","grouping":"historical","chapters":21,"verses":618,"charCount":103696,"checksum":"b49618ca17dcc3c7998b56acbba3ee8addda7dff17ec81a1207360e7b4923056","constName":"BOOK_JUDGES"},
  {"id":"ruth","name":"Ruth","testament":"ot","grouping":"historical","chapters":4,"verses":85,"charCount":14094,"checksum":"6fe2ca3e94ab463b28a0d6af803e0f5de2622410bed5a30ed45e88e89f66d361","constName":"BOOK_RUTH"},
  {"id":"kings-1","name":"1 Kings (1 Samuel)","testament":"ot","grouping":"historical","chapters":31,"verses":811,"charCount":138555,"checksum":"48bcc2e19c1c0f6b0d86e98377ce18bb0a705cacfc6dea3878c688ba3d29a5da","constName":"BOOK_KINGS_1"},
  {"id":"kings-2","name":"2 Kings (2 Samuel)","testament":"ot","grouping":"historical","chapters":24,"verses":694,"charCount":113059,"checksum":"c4f0c17e8a72e2917c6b09063761c8e58a018c7f6d14d90d9039531a7e0de3ba","constName":"BOOK_KINGS_2"},
  {"id":"kings-3","name":"3 Kings","testament":"ot","grouping":"historical","chapters":22,"verses":817,"charCount":134252,"checksum":"714e186ac8c4e7b6ed4d0c913936c0d676814f6481bcc3a7f1c5390617edce81","constName":"BOOK_KINGS_3"},
  {"id":"kings-4","name":"4 Kings","testament":"ot","grouping":"historical","chapters":25,"verses":719,"charCount":127321,"checksum":"c686e84f0fd4f4ac492a64ddd60710222bee34499746414184d909696a536cdf","constName":"BOOK_KINGS_4"},
  {"id":"paralipomenon-1","name":"1 Paralipomenon","testament":"ot","grouping":"historical","chapters":29,"verses":940,"charCount":117000,"checksum":"85cad96ffcdeff8e770cd17722f90838f3f2d796206c2e58fef00bc2bfec6463","constName":"BOOK_PARALIPOMENON_1"},
  {"id":"paralipomenon-2","name":"2 Paralipomenon","testament":"ot","grouping":"historical","chapters":36,"verses":822,"charCount":145129,"checksum":"8518b073473f33c916c5076ba8dd9b423e0f101db569b1d9301c17186dc38c8a","constName":"BOOK_PARALIPOMENON_2"},
  {"id":"esdras-1","name":"1 Esdras","testament":"ot","grouping":"historical","chapters":10,"verses":280,"charCount":42424,"checksum":"7266804163f178d8180fca7e098daa1838b53bea85e07f15e1b259e4db5e5540","constName":"BOOK_ESDRAS_1"},
  {"id":"nehemias","name":"Nehemias (2 Esdras)","testament":"ot","grouping":"historical","chapters":13,"verses":404,"charCount":60159,"checksum":"612dd8366cde91623f89e907ca73ea01934e733039b3c31576fde2d16bb38ac9","constName":"BOOK_NEHEMIAS"},
  {"id":"tobias","name":"Tobias","testament":"ot","grouping":"historical","chapters":14,"verses":298,"charCount":38962,"checksum":"843754b7f437d4a5e1e5db32c6bf030a31fd4e690df5bd0083e681df3e71bfb0","constName":"BOOK_TOBIAS"},
  {"id":"judith","name":"Judith","testament":"ot","grouping":"historical","chapters":16,"verses":345,"charCount":53545,"checksum":"171ea9a7519a3919210ce7b59131da08f4476eb05dea6afeb4722447b80aebb0","constName":"BOOK_JUDITH"},
  {"id":"esther","name":"Esther","testament":"ot","grouping":"historical","chapters":16,"verses":275,"charCount":49242,"checksum":"676d49bfa3e987372409a9655d7aef22ae2108d9dca156132359bbb506d6f49e","constName":"BOOK_ESTHER"},
  {"id":"machabees-1","name":"1 Machabees","testament":"ot","grouping":"historical","chapters":16,"verses":929,"charCount":134237,"checksum":"f67a9b884479399f86f4c12c851cb3cf949e9d916c6568ed9cc3fc619143faec","constName":"BOOK_MACHABEES_1"},
  {"id":"machabees-2","name":"2 Machabees","testament":"ot","grouping":"historical","chapters":15,"verses":558,"charCount":94931,"checksum":"98848150103f466ee8b1cfdb676e6fef1ae762e54213e3af68924e17d0a231c1","constName":"BOOK_MACHABEES_2"},
  {"id":"job","name":"Job","testament":"ot","grouping":"wisdom","chapters":42,"verses":1070,"charCount":107636,"checksum":"b6cc8b5582083b744a777cbdb0750a5579a174022595872d5a0a891bc68aec5f","constName":"BOOK_JOB"},
  {"id":"psalms","name":"Psalms","testament":"ot","grouping":"wisdom","chapters":150,"verses":2510,"charCount":256916,"checksum":"c32861451e276ca98a4656f2bb25eb4ca885457e750b640621e0236a6345a572","constName":"BOOK_PSALMS"},
  {"id":"proverbs","name":"Proverbs","testament":"ot","grouping":"wisdom","chapters":31,"verses":916,"charCount":92413,"checksum":"1ab98782e77d6e035e1455ace128e35b70f372f58a8dc45c0affb1c1240b63cb","constName":"BOOK_PROVERBS"},
  {"id":"ecclesiastes","name":"Ecclesiastes","testament":"ot","grouping":"wisdom","chapters":12,"verses":222,"charCount":30675,"checksum":"8f4fb0fcf0ca5747b77cead08c6133300ac263f6dd3fe98ea1548df45d5d0b18","constName":"BOOK_ECCLESIASTES"},
  {"id":"canticles","name":"Canticle of Canticles","testament":"ot","grouping":"wisdom","chapters":8,"verses":116,"charCount":14677,"checksum":"35c0b5709d62806edbe3cd03f978bdf7da8a3a012577ac58db819a38dec47dbe","constName":"BOOK_CANTICLES"},
  {"id":"wisdom","name":"Wisdom","testament":"ot","grouping":"wisdom","chapters":19,"verses":439,"charCount":61937,"checksum":"15e0610d7c5def0f27ba4eae0d3d5ca63124f850433d5bc741c13431e9916f07","constName":"BOOK_WISDOM"},
  {"id":"ecclesiasticus","name":"Ecclesiasticus","testament":"ot","grouping":"wisdom","chapters":51,"verses":1591,"charCount":178000,"checksum":"215c129a5b6d21e60add4a0ae0203089cf8f0fa51bf344d73bc45f8e58348027","constName":"BOOK_ECCLESIASTICUS"},
  {"id":"isaias","name":"Isaias","testament":"ot","grouping":"prophets","chapters":66,"verses":1292,"charCount":207751,"checksum":"a7b90074eaa0187daa2a195ec41b359b0889160965e449a252122bf3ea6e5dee","constName":"BOOK_ISAIAS"},
  {"id":"jeremias","name":"Jeremias","testament":"ot","grouping":"prophets","chapters":52,"verses":1363,"charCount":238123,"checksum":"df2f60b22b4a2ad99037855434a6df326047e2ed5f55b8efca739bb9672a2066","constName":"BOOK_JEREMIAS"},
  {"id":"lamentations","name":"Lamentations","testament":"ot","grouping":"prophets","chapters":5,"verses":154,"charCount":20708,"checksum":"1f18edb8344fcc1aa909a6f1d08020594abf27f29ba31cb886bf98feb1e05317","constName":"BOOK_LAMENTATIONS"},
  {"id":"baruch","name":"Baruch","testament":"ot","grouping":"prophets","chapters":6,"verses":213,"charCount":29316,"checksum":"60d085974930c0137e06f8fc0f699b9fdc772583797effc952cbcdbddb3e4e7c","constName":"BOOK_BARUCH"},
  {"id":"ezechiel","name":"Ezechiel","testament":"ot","grouping":"prophets","chapters":48,"verses":1272,"charCount":219023,"checksum":"fb4c16631e574046d0d41a05a0b5480e240731e7b98e4eedf86b70d29fe2cd81","constName":"BOOK_EZECHIEL"},
  {"id":"daniel","name":"Daniel","testament":"ot","grouping":"prophets","chapters":14,"verses":531,"charCount":88229,"checksum":"22641e8a7d46178579a36d7a74f88bdb9e83fe23612ba9c3ad046add94e3c427","constName":"BOOK_DANIEL"},
  {"id":"osee","name":"Osee","testament":"ot","grouping":"prophets","chapters":14,"verses":198,"charCount":29660,"checksum":"2540180495f796c6c521853e33094a645742ed281c74cb2583e700d5662877b5","constName":"BOOK_OSEE"},
  {"id":"joel","name":"Joel","testament":"ot","grouping":"prophets","chapters":3,"verses":73,"charCount":11673,"checksum":"50dee7af53c3a414279425ce6a91be4fafc9067efc03c5d912ff219b78e7b37d","constName":"BOOK_JOEL"},
  {"id":"amos","name":"Amos","testament":"ot","grouping":"prophets","chapters":9,"verses":146,"charCount":22998,"checksum":"98e77c785f58a01f844c9c22579775bade7fb1f5e813dcbbcfbd016eb8c887e2","constName":"BOOK_AMOS"},
  {"id":"abdias","name":"Abdias","testament":"ot","grouping":"prophets","chapters":1,"verses":21,"charCount":3674,"checksum":"54c6b8511ab911517e013264653fe015dffa45022c8efb99ff3054483e5d6034","constName":"BOOK_ABDIAS"},
  {"id":"jonas","name":"Jonas","testament":"ot","grouping":"prophets","chapters":4,"verses":48,"charCount":7036,"checksum":"5d58f766b953adde4f4d6e90436cf742ad2cf20d18fa045f12434f3867273c3a","constName":"BOOK_JONAS"},
  {"id":"micheas","name":"Micheas","testament":"ot","grouping":"prophets","chapters":7,"verses":104,"charCount":17446,"checksum":"f6906839caed35a693a0e3c07222f3ff183aeb84e5d2453d3d232ca97b69f6fe","constName":"BOOK_MICHEAS"},
  {"id":"nahum","name":"Nahum","testament":"ot","grouping":"prophets","chapters":3,"verses":47,"charCount":7468,"checksum":"6227e326bd0818ceaa537d6164278dd6fc8d4d565fef4931cc89dca305fc8580","constName":"BOOK_NAHUM"},
  {"id":"habacuc","name":"Habacuc","testament":"ot","grouping":"prophets","chapters":3,"verses":56,"charCount":8538,"checksum":"8fed89e09fd02c0d3b16286f2e0dea10900b9790cbd4b1988839b125fb7268b0","constName":"BOOK_HABACUC"},
  {"id":"sophonias","name":"Sophonias","testament":"ot","grouping":"prophets","chapters":3,"verses":53,"charCount":9259,"checksum":"d7afb5705c5a6dd822a560baa8f3346c2150a6a13cd85b232b43047c0481c640","constName":"BOOK_SOPHONIAS"},
  {"id":"aggeus","name":"Aggeus","testament":"ot","grouping":"prophets","chapters":2,"verses":38,"charCount":6247,"checksum":"16ece6ec8482ba2385a7d44a2fe538f0ffc28567e0f788823c6223111ddb588f","constName":"BOOK_AGGEUS"},
  {"id":"zacharias","name":"Zacharias","testament":"ot","grouping":"prophets","chapters":14,"verses":211,"charCount":34911,"checksum":"b922b7665f3db23baf51d26b16406a0b106739c5050c57c35349152f821eff0b","constName":"BOOK_ZACHARIAS"},
  {"id":"malachias","name":"Malachias","testament":"ot","grouping":"prophets","chapters":4,"verses":55,"charCount":9536,"checksum":"32df8d420ef3458529186925d978b7f61a2d54ca99a0ec687dc65949c2b5ce5d","constName":"BOOK_MALACHIAS"},
  {"id":"matthew","name":"Matthew","testament":"nt","grouping":"gospels","chapters":28,"verses":1070,"charCount":132693,"checksum":"78adb0fec7cb07d3939548f658b2774fa15d7939eab9bfcc4f5bdfc2f1b4e565","constName":"BOOK_MATTHEW"},
  {"id":"mark","name":"Mark","testament":"nt","grouping":"gospels","chapters":16,"verses":677,"charCount":84161,"checksum":"bae530ccf51a5bfa432f2eac38fbcc05e152c63003bd4d9d46215114fd30eea8","constName":"BOOK_MARK"},
  {"id":"luke","name":"Luke","testament":"nt","grouping":"gospels","chapters":24,"verses":1151,"charCount":143494,"checksum":"cdfc8ed3c7199b616af6f5721e9c3584c0ae919609f7eaf5e810c1ae3b9e52ba","constName":"BOOK_LUKE"},
  {"id":"john","name":"John","testament":"nt","grouping":"gospels","chapters":21,"verses":879,"charCount":106647,"checksum":"6e783f2e96c83e279b62b3488ec6cc2b2a56b960b84ffd1c0a12e80cf9225723","constName":"BOOK_JOHN"},
  {"id":"acts","name":"Acts of the Apostles","testament":"nt","grouping":"acts","chapters":28,"verses":1004,"charCount":138601,"checksum":"3d7cf461d73745321ab757f95a1feb588eb86dc72d624b9975d0bb6b0e395906","constName":"BOOK_ACTS"},
  {"id":"romans","name":"Romans","testament":"nt","grouping":"pauline","chapters":16,"verses":433,"charCount":54031,"checksum":"365e6e6b4a913d13c2104244cd47cb1465740456cb9c0e66b166bfe9eae736aa","constName":"BOOK_ROMANS"},
  {"id":"corinthians-1","name":"1 Corinthians","testament":"nt","grouping":"pauline","chapters":16,"verses":437,"charCount":52971,"checksum":"64d3af0b896f00793fbe35063f445ad5ea206be8639a8218a94a73fd83d12f43","constName":"BOOK_CORINTHIANS_1"},
  {"id":"corinthians-2","name":"2 Corinthians","testament":"nt","grouping":"pauline","chapters":13,"verses":255,"charCount":33939,"checksum":"971be0dc938f23f10b2c7b42d01366e280eddffdc0c4bface824ae76b9252977","constName":"BOOK_CORINTHIANS_2"},
  {"id":"galatians","name":"Galatians","testament":"nt","grouping":"pauline","chapters":6,"verses":149,"charCount":17444,"checksum":"9bc72b891f809282823615a9c0f87cf9dc212575e187510254b0c80112d0c1e0","constName":"BOOK_GALATIANS"},
  {"id":"ephesians","name":"Ephesians","testament":"nt","grouping":"pauline","chapters":6,"verses":155,"charCount":17719,"checksum":"992394f17ff0871f2b69bf81b6a7a35e86f93f79da6f88fc775f657ec2eed93e","constName":"BOOK_EPHESIANS"},
  {"id":"philippians","name":"Philippians","testament":"nt","grouping":"pauline","chapters":4,"verses":104,"charCount":12524,"checksum":"6374093cd54a20ce8f49118006f732a8fbe2cdb5570ec7ca02ff6b0598ed538e","constName":"BOOK_PHILIPPIANS"},
  {"id":"colossians","name":"Colossians","testament":"nt","grouping":"pauline","chapters":4,"verses":95,"charCount":11617,"checksum":"f22b4b984898126f80b1f88829f2135f50b13ad37197ba1b60c802c27ad54d5b","constName":"BOOK_COLOSSIANS"},
  {"id":"thessalonians-1","name":"1 Thessalonians","testament":"nt","grouping":"pauline","chapters":5,"verses":88,"charCount":10607,"checksum":"2d087e885b8c62563860952f04ec150d3476b6a6270af8f36ae74da3e62c2beb","constName":"BOOK_THESSALONIANS_1"},
  {"id":"thessalonians-2","name":"2 Thessalonians","testament":"nt","grouping":"pauline","chapters":3,"verses":46,"charCount":5787,"checksum":"9d65013c1793c668c65cbe4fb15b196c3e52cd2f8143083cbf21bc009247b80e","constName":"BOOK_THESSALONIANS_2"},
  {"id":"timothy-1","name":"1 Timothy","testament":"nt","grouping":"pauline","chapters":6,"verses":113,"charCount":13543,"checksum":"2fdf2385c9ed16eacdcab37fb53b73c92bee143740e0707bb76a8e2b751a81fc","constName":"BOOK_TIMOTHY_1"},
  {"id":"timothy-2","name":"2 Timothy","testament":"nt","grouping":"pauline","chapters":4,"verses":83,"charCount":9711,"checksum":"1bf781f58684aabab581fc2e147a374f4a92fc245284024e6a21a33fc28cccf8","constName":"BOOK_TIMOTHY_2"},
  {"id":"titus","name":"Titus","testament":"nt","grouping":"pauline","chapters":3,"verses":46,"charCount":5520,"checksum":"01a1075da1a818416854423bf7649fb26e877ac45fe62a2e6a96b2f479633cfd","constName":"BOOK_TITUS"},
  {"id":"philemon","name":"Philemon","testament":"nt","grouping":"pauline","chapters":1,"verses":25,"charCount":2622,"checksum":"2428f29ddd93ef4b6c341064b8f525e4223b3e1439b4e9eec3e75707fa0df427","constName":"BOOK_PHILEMON"},
  {"id":"hebrews","name":"Hebrews","testament":"nt","grouping":"pauline","chapters":13,"verses":303,"charCount":39527,"checksum":"ae7c249075d487bef335483bc3e6c2f331f8e3449eb0f3b2d6f7dd24e23a0204","constName":"BOOK_HEBREWS"},
  {"id":"james","name":"James","testament":"nt","grouping":"catholic-epistles","chapters":5,"verses":108,"charCount":13246,"checksum":"eb3777c2c2912598f9234494f47be5851afa89c8d6cb70795ad2391c8052eb58","constName":"BOOK_JAMES"},
  {"id":"peter-1","name":"1 Peter","testament":"nt","grouping":"catholic-epistles","chapters":5,"verses":105,"charCount":14154,"checksum":"24434b05d38ca936a82408162700bdcd11e787c046fc1ed61bde2aefefe1797b","constName":"BOOK_PETER_1"},
  {"id":"peter-2","name":"2 Peter","testament":"nt","grouping":"catholic-epistles","chapters":3,"verses":61,"charCount":9130,"checksum":"1e642e88acb3385bc0b70fbd302f5f756a67186575bc9e7adcfc65cf82babb25","constName":"BOOK_PETER_2"},
  {"id":"john-1","name":"1 John","testament":"nt","grouping":"catholic-epistles","chapters":5,"verses":105,"charCount":13595,"checksum":"44fd6ec23b0b94c20a806f48dc220a8c838058d2423ceffa64a372c939d3881f","constName":"BOOK_JOHN_1"},
  {"id":"john-2","name":"2 John","testament":"nt","grouping":"catholic-epistles","chapters":1,"verses":13,"charCount":1689,"checksum":"f8f0af87eaf07703525c3279218f465f7572e76cfc20490f5059a73770172575","constName":"BOOK_JOHN_2"},
  {"id":"john-3","name":"3 John","testament":"nt","grouping":"catholic-epistles","chapters":1,"verses":14,"charCount":1831,"checksum":"78df42cb69db084626d808da58594bf73c1201ecd1abb622049c1f6e30b06d10","constName":"BOOK_JOHN_3"},
  {"id":"jude","name":"Jude","testament":"nt","grouping":"catholic-epistles","chapters":1,"verses":25,"charCount":3848,"checksum":"10f57d879046e6e08f2aae5d7df80e7382fb74dedc34167dd40f01a843f1824f","constName":"BOOK_JUDE"},
  {"id":"apocalypse","name":"Apocalypse","testament":"nt","grouping":"apocalypse","chapters":22,"verses":405,"charCount":65827,"checksum":"894ae24ea390e96b9e9cf4b370aca37c552dcba8fd24efc8003b6e840465a896","constName":"BOOK_APOCALYPSE"}
].map(Object.freeze));

export function findChapelBook(id) {
  return CHAPEL_BOOKS.find(book => book.id === id) || null;
}

export function chapelBooksInGrouping(groupingId) {
  return CHAPEL_BOOKS.filter(book => book.grouping === groupingId);
}
