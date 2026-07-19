import { ATRIUM_PILOT_INTEGRITY } from './integrity.js';

const REVIEWED_AT = '2026-07-17';
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
  'src-ogl-presocratic-fragments': audited(['pass-anaximander-fragment'], {
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
    rights: pgRights('John Burnet', 'Early Greek Philosophy, second edition', '67097')
  }),
  'src-scaife-plato-theaetetus': audited(['pass-protagoras-measure'], {
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
  'src-scaife-aristotle-metaphysics': audited(['pass-aristotle-substance'], {
    translator: 'W. D. Ross',
    editionDate: '1908',
    provider: 'wikisource-scan-backed',
    canonicalUrl: 'https://en.wikisource.org/wiki/Metaphysics_(Aristotle)',
    canonicalId: 'wikisource:Metaphysics_(Aristotle):Ross-1908',
    locatorScheme: 'book / chapter / Bekker',
    rights: usPublicDomain(
      'Aristotle, Metaphysics, translated by W. D. Ross (1908); scan-backed clean excerpt.',
      'https://en.wikisource.org/wiki/Metaphysics_(Aristotle)'
    )
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
