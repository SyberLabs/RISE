import { ATRIUM_PILOT_INTEGRITY } from './integrity.js';

const REVIEWED_AT = '2026-07-19';
const usPublicDomain = (attribution, evidenceUrl) => ({
  status: 'public-domain-confirmed',
  jurisdictions: ['US'],
  license: 'Public domain in the United States; independently packaged clean excerpt',
  attribution,
  evidenceUrl,
  reviewedAt: REVIEWED_AT
});
const audited = (passageIds, fields) => ({
  ...fields,
  kind: 'source-edition-candidate',
  sourcePayloadIds: passageIds,
  acquisitionScope: 'selected-excerpt-unit',
  checksum: passageIds.length === 1 ? ATRIUM_PILOT_INTEGRITY[passageIds[0]].checksum : fields.checksum,
  retrievedAt: REVIEWED_AT,
  status: 'publishable'
});
const pgRights = (author, title, ebook) => usPublicDomain(
  author + ', ' + title + '; clean excerpt collated to Project Gutenberg eBook ' + ebook + '.',
  'https://www.gutenberg.org/ebooks/' + ebook
);

export const PHILOSOPHY_SOURCE_AUDITS = Object.freeze({
  'src-ogl-presocratic-fragments': audited([
    'pass-anaximander-fragment',
    'pass-heraclitus-logos',
    'pass-parmenides-being',
    'pass-empedocles-roots',
    'pass-democritus-atoms'
  ], {
    workTitle: 'Early Greek Philosophy, second edition',
    author: 'John Burnet',
    translator: 'John Burnet',
    editionDate: '1908; Project Gutenberg eBook 67097 released 2021-11-03',
    language: 'en',
    originalLanguage: 'grc',
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/67097',
    canonicalId: 'gutenberg:67097',
    locatorScheme: 'chapter / section / source citation',
    checksum: 'sha256:cfbfad0360fd01213acedd27d04371d116b945a4bf2f969e4493c33ee67d6bb1',
    rights: pgRights('John Burnet', 'Early Greek Philosophy, second edition', '67097')
  }),
  'src-scaife-plato-theaetetus': audited(['pass-protagoras-measure'], {
    chunkProfile: 'dialogue',
    translator: 'Benjamin Jowett',
    editionDate: 'Project Gutenberg eBook 1726, updated 2017-01-28',
    provider: 'project-gutenberg',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/1726',
    canonicalId: 'gutenberg:1726',
    locatorScheme: 'Stephanus',
    rights: pgRights('Plato, translated by Benjamin Jowett', 'Theaetetus', '1726')
  }),
  'src-scaife-plato-apology': audited(['pass-socrates-apology'], {
    translator: 'Benjamin Jowett',
    editionDate: 'Project Gutenberg eBook 1656, updated 2020-10-04',
    provider: 'project-gutenberg',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/1656',
    canonicalId: 'gutenberg:1656',
    locatorScheme: 'Stephanus',
    rights: pgRights('Plato, translated by Benjamin Jowett', 'Apology', '1656')
  }),
  'src-scaife-plato-meno': audited(['pass-plato-recollection'], {
    chunkProfile: 'dialogue',
    translator: 'Benjamin Jowett',
    editionDate: 'Project Gutenberg eBook 1643, updated 2013-01-16',
    provider: 'project-gutenberg',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/1643',
    canonicalId: 'gutenberg:1643',
    locatorScheme: 'Stephanus',
    rights: pgRights('Plato, translated by Benjamin Jowett', 'Meno', '1643')
  }),
  'src-scaife-plato-republic': audited(['pass-plato-divided-line', 'pass-plato-cave'], {
    translator: 'Benjamin Jowett',
    editionDate: '1888 third edition with 1908 Stephanus numbering; eBook updated 2026-04-01',
    provider: 'project-gutenberg-scan-collation',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/55201',
    canonicalId: 'gutenberg:55201',
    locatorScheme: 'book / Stephanus',
    checksum: 'sha256:c7691d9862c21f59cc27ad4616b63203aad71d0d35a56cd5867789125eec954e',
    rights: pgRights('Plato, translated by Benjamin Jowett', 'The Republic of Plato, third edition', '55201')
  }),
  'src-scaife-plato-phaedo': audited(['pass-plato-forms'], {
    translator: 'Benjamin Jowett',
    editionDate: 'Project Gutenberg eBook 1658, updated 2013-01-16',
    provider: 'project-gutenberg',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/1658',
    canonicalId: 'gutenberg:1658',
    locatorScheme: 'Stephanus',
    rights: pgRights('Plato, translated by Benjamin Jowett', 'Phaedo', '1658')
  }),
  'src-scaife-plato-timaeus': audited(['pass-plato-cosmos'], {
    chunkProfile: 'dialogue',
    translator: 'Benjamin Jowett',
    editionDate: 'Project Gutenberg eBook 1572, updated 2021-04-25',
    provider: 'project-gutenberg',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/1572',
    canonicalId: 'gutenberg:1572',
    locatorScheme: 'Stephanus',
    rights: pgRights('Plato, translated by Benjamin Jowett', 'Timaeus', '1572')
  }),
  'src-scaife-aristotle-metaphysics': audited(['pass-aristotle-first-causes', 'pass-aristotle-substance'], {
    translator: 'W. D. Ross',
    editionDate: '1908',
    provider: 'wikisource-scan-backed',
    canonicalUrl: 'https://en.wikisource.org/wiki/Metaphysics_(Aristotle)',
    canonicalId: 'wikisource:Metaphysics_(Aristotle):Ross-1908',
    locatorScheme: 'book / chapter / Bekker',
    checksum: 'sha256:17cd9eaae627c24362943ee04111414f06f2b28cd228d25b6eaca66f7528fb27',
    rights: usPublicDomain(
      'Aristotle, Metaphysics, translated by W. D. Ross (1908); scan-backed clean excerpt.',
      'https://en.wikisource.org/wiki/Metaphysics_(Aristotle)'
    )
  }),
  'src-scaife-aristotle-ethics': audited(['pass-aristotle-human-good'], {
    workTitle: 'The Nicomachean Ethics of Aristotle',
    translator: 'D. P. Chase',
    editionDate: '1847 edition; Project Gutenberg eBook 8438 updated 2021-03-27',
    provider: 'project-gutenberg-scan-collated',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/8438',
    canonicalId: 'gutenberg:8438:chase-1847',
    locatorScheme: 'book / chapter / Bekker',
    rights: pgRights('Aristotle, translated by D. P. Chase', 'The Nicomachean Ethics of Aristotle', '8438')
  }),
  'src-scaife-aristotle-de-anima': audited(['pass-aristotle-soul'], {
    workTitle: 'Aristotle’s Psychology: A Treatise on the Principle of Life',
    translator: 'Edwin Wallace',
    editionDate: '1882',
    provider: 'internet-archive-scan-backed',
    canonicalUrl: 'https://archive.org/details/peripsychesarist00arisuoft',
    canonicalId: 'internet-archive:peripsychesarist00arisuoft',
    locatorScheme: 'book / chapter / Bekker',
    rights: usPublicDomain(
      'Aristotle, Aristotle’s Psychology, translated by Edwin Wallace (1882); clean excerpt.',
      'https://en.wikisource.org/wiki/Aristotle%27s_Psychology'
    )
  }),
  'src-candidate-epictetus-enchiridion': audited(['pass-epictetus-control'], {
    workTitle: 'A Selection from the Discourses of Epictetus with the Encheiridion',
    translator: 'George Long',
    editionDate: '1877; Project Gutenberg eBook 10661',
    provider: 'project-gutenberg',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/10661',
    canonicalId: 'gutenberg:10661',
    locatorScheme: 'Encheiridion section',
    rights: pgRights('Epictetus, translated by George Long', 'Encheiridion', '10661')
  }),
  'src-candidate-seneca-letters': audited(['pass-seneca-inner-spirit'], {
    workTitle: 'Moral Letters to Lucilius, Volume I',
    translator: 'Richard Mott Gummere',
    editionDate: 'Loeb Classical Library volume I, 1917; first printed 1918',
    provider: 'wikisource-scan-backed',
    canonicalUrl: 'https://en.wikisource.org/wiki/Moral_letters_to_Lucilius/Letter_41',
    canonicalId: 'wikisource:Moral_letters_to_Lucilius/Letter_41:Gummere',
    locatorScheme: 'letter / numbered section',
    rights: usPublicDomain(
      'Seneca, Moral Letters to Lucilius, translated by Richard Mott Gummere; Letter 41.1–5 from the scan-backed public-domain edition.',
      'https://en.wikisource.org/wiki/Moral_letters_to_Lucilius'
    )
  }),
  'src-candidate-marcus-meditations': audited(['pass-marcus-morning'], {
    workTitle: 'Thoughts of Marcus Aurelius Antoninus',
    translator: 'George Long',
    editionDate: 'George Long translation first published 1862; Project Gutenberg eBook 15877 updated 2020-12-14',
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/15877',
    canonicalId: 'gutenberg:15877:long',
    locatorScheme: 'book / numbered section',
    rights: pgRights('Marcus Aurelius, translated by George Long', 'Thoughts of Marcus Aurelius Antoninus', '15877')
  }),
  'src-candidate-diogenes-laertius-x': audited(['pass-epicurus-gods-death'], {
    workTitle: 'The Lives and Opinions of Eminent Philosophers',
    translator: 'Charles Duke Yonge',
    editionDate: '1915 Bell reprint; Project Gutenberg eBook 57342, updated 2023-10-04',
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/57342',
    canonicalId: 'gutenberg:57342',
    locatorScheme: 'book / numbered section',
    rights: pgRights('Diogenes Laertius, translated by Charles Duke Yonge', 'The Lives and Opinions of Eminent Philosophers', '57342')
  }),
  'src-ogl-sextus-outlines': audited(['pass-sextus-skeptical-way'], {
    workTitle: 'Sextus Empiricus and Greek Scepticism: First Book of the Pyrrhonic Sketches',
    translator: 'Mary Mills Patrick',
    editionDate: '1899; Project Gutenberg eBook 17556',
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/17556',
    canonicalId: 'gutenberg:17556',
    locatorScheme: 'book / chapter / section',
    rights: pgRights('Sextus Empiricus, translated by Mary Mills Patrick', 'First Book of the Pyrrhonic Sketches', '17556')
  }),
  'src-perseus-cicero-academica': audited(['pass-cicero-academic'], {
    workTitle: 'The Academic Questions',
    translator: 'Charles Duke Yonge',
    editionDate: '1875 George Bell edition; Project Gutenberg eBook 29247, updated 2020-06-20',
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/29247',
    canonicalId: 'gutenberg:29247',
    locatorScheme: 'book / numbered section',
    rights: pgRights('Cicero, translated by Charles Duke Yonge', 'The Academic Questions', '29247')
  }),
  'src-ogl-philo-creation': audited(['pass-philo-creation'], {
    workTitle: 'On the Creation of the World',
    translator: 'Charles Duke Yonge',
    editionDate: '1854 translation; Open Greek and Latin public-domain edition',
    provider: 'open-greek-and-latin-collated',
    canonicalUrl: 'https://atlas.perseus.tufts.edu/library/urn:cts:greekLit:tlg0018.tlg001.1st1K-eng1/',
    canonicalId: 'cts:greekLit:tlg0018.tlg001.1st1K-eng1',
    locatorScheme: 'section',
    rights: usPublicDomain(
      'Philo of Alexandria, On the Creation of the World, translated by Charles Duke Yonge (1854); selected excerpt collated to the public-domain edition.',
      'https://opengreekandlatin.github.io/philo-dev/'
    )
  }),
  'src-ogl-plotinus-enneads': audited(['pass-plotinus-beauty', 'pass-plotinus-hypostases'], {
    workTitle: 'Plotinos: Complete Works, Volume I',
    translator: 'Kenneth Sylvan Guthrie',
    editionDate: '1918; Project Gutenberg eBook 42930 updated 2024-10-23',
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/42930',
    canonicalId: 'gutenberg:42930:guthrie-1918',
    locatorScheme: 'Ennead / treatise / section',
    checksum: 'sha256:903c9917f4aac886efaf2f2af7d2248c123355e02ea2b0e98859ffc4c873bc02',
    rights: pgRights('Plotinus, translated by Kenneth Sylvan Guthrie', 'Plotinos: Complete Works, Volume I', '42930')
  }),
  'src-ogl-porphyry-isagoge': audited(['pass-porphyry-isagoge'], {
    workTitle: 'Introduction, or Isagoge, to the Logical Categories of Aristotle',
    translator: 'Octavius Freire Owen',
    editionDate: '1853, Volume II, pages 609–633',
    provider: 'tertullian-historical-transcription',
    canonicalUrl: 'https://www.tertullian.org/fathers/porphyry_isagogue_02_translation.htm',
    canonicalId: 'tertullian:porphyry-isagoge:owen-1853',
    locatorScheme: 'chapter / print page',
    rights: usPublicDomain(
      'Porphyry, Isagoge, translated by Octavius Freire Owen (1853); historical text only, with transcription apparatus excluded.',
      'https://www.tertullian.org/fathers/porphyry_isagogue_02_translation.htm'
    )
  }),
  'src-ogl-iamblichus-mysteries': audited(['pass-iamblichus-theurgy'], {
    workTitle: 'Iamblichus on the Mysteries of the Egyptians, Chaldeans, and Assyrians',
    translator: 'Thomas Taylor',
    editionDate: '1895 London edition; Project Gutenberg eBook 72815 released 2024-01-29',
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/72815',
    canonicalId: 'gutenberg:72815:taylor-1895',
    locatorScheme: 'book / chapter',
    rights: pgRights('Iamblichus, translated by Thomas Taylor', 'On the Mysteries of the Egyptians, Chaldeans, and Assyrians', '72815')
  }),
  'src-ogl-proclus-elements': audited(['pass-proclus-propositions'], {
    workTitle: 'Elements of Theology',
    translator: 'Thomas Taylor',
    editionDate: '1816 London edition',
    provider: 'internet-archive-scan-backed',
    canonicalUrl: 'https://archive.org/details/thomastaylor/page/n805',
    canonicalId: 'internet-archive:thomastaylor:elements-of-theology',
    locatorScheme: 'proposition / print page',
    rights: usPublicDomain(
      'Proclus, Elements of Theology, translated by Thomas Taylor (1816); excerpt collated to the public-domain scan.',
      'https://archive.org/details/thomastaylor/page/n805'
    )
  }),
  'src-candidate-augustine-confessions': audited(['pass-augustine-platonic-books'], {
    translator: 'Edward Bouverie Pusey',
    editionDate: 'Project Gutenberg eBook 3296, posted 2001-03-19',
    provider: 'project-gutenberg',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/3296',
    canonicalId: 'gutenberg:3296',
    locatorScheme: 'book / chapter',
    rights: pgRights('Augustine, translated by Edward Bouverie Pusey', 'Confessions', '3296')
  }),
  'src-candidate-dionysius-mystical': audited(['pass-dionysius-mystical'], {
    workTitle: 'The Works of Dionysius the Areopagite, Volume I',
    translator: 'John Parker',
    editionDate: '1897',
    provider: 'internet-archive-scan-backed',
    canonicalUrl: 'https://archive.org/details/theworksofdionys00dionuoft',
    canonicalId: 'internet-archive:theworksofdionys00dionuoft',
    locatorScheme: 'work / chapter / section',
    rights: usPublicDomain(
      'Pseudo-Dionysius, Mystical Theology, translated by John Parker (1897); clean excerpt collated to scan.',
      'https://openlibrary.org/books/OL7168527M/The_works_of_Dionysius_the_Areopagite'
    )
  }),
  'src-candidate-boethius-consolation': audited(['pass-boethius-eternity'], {
    translator: 'H. R. James',
    editionDate: '1897; Project Gutenberg eBook 14328 updated 2024-10-28',
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/14328',
    canonicalId: 'gutenberg:14328',
    locatorScheme: 'book / prose / print page',
    rights: pgRights('Boethius, translated by H. R. James', 'The Consolation of Philosophy', '14328')
  })
});
