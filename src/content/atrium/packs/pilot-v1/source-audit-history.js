import { ATRIUM_PILOT_INTEGRITY } from './integrity.js';

const REVIEWED_AT = '2026-07-17';
const rights = (status, jurisdictions, license, attribution, evidenceUrl) => ({
  status,
  jurisdictions,
  license,
  attribution,
  evidenceUrl,
  reviewedAt: REVIEWED_AT
});
const usPublicDomain = (attribution, evidenceUrl) => rights(
  'public-domain-confirmed',
  ['US'],
  'Public domain in the United States; independently packaged historical text only',
  attribution,
  evidenceUrl
);
const openLicense = (license, attribution, evidenceUrl) => rights(
  'open-license-confirmed',
  ['WORLDWIDE'],
  license,
  attribution,
  evidenceUrl
);
const audited = (passageId, fields) => ({
  ...fields,
  kind: 'source-edition-candidate',
  sourcePayloadIds: [passageId],
  acquisitionScope: 'selected-excerpt-unit',
  checksum: ATRIUM_PILOT_INTEGRITY[passageId].checksum,
  retrievedAt: REVIEWED_AT,
  status: 'publishable'
});

export const HISTORY_SOURCE_AUDITS = Object.freeze({
  'src-uk-stamp-act-1765': audited('pass-stamp-act', {
    provider: 'uk-parliamentary-archives',
    canonicalUrl: 'https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/parliament-and-empire/collections1/collections1/stamp-act/',
    canonicalId: 'uk-parliamentary-archives:HL/PO/PU/1/1765/5G3n11',
    editionDate: '1765-03-22; UK Parliament digital transcript',
    locatorScheme: 'archive catalogue / act title / clause',
    collationUrls: ['https://avalon.law.yale.edu/18th_century/stamp_act_1765.asp'],
    rights: usPublicDomain(
      'Stamp Act 1765, historical statute text; Parliamentary Archives catalogue HL/PO/PU/1/1765/5G3n11.',
      'https://www.parliament.uk/about/living-heritage/evolutionofparliament/legislativescrutiny/parliament-and-empire/collections1/collections1/stamp-act/'
    )
  }),
  'src-candidate-paine-common-sense': audited('pass-common-sense', {
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/147',
    canonicalId: 'gutenberg:147',
    editionDate: '1776 Bradford edition; Project Gutenberg eBook 147',
    locatorScheme: 'paragraph number / section',
    rights: usPublicDomain(
      'Thomas Paine, Common Sense (1776 Bradford edition); clean excerpt collated to Project Gutenberg eBook 147.',
      'https://www.gutenberg.org/ebooks/147'
    )
  }),
  'src-nara-us-declaration': audited('pass-us-declaration', {
    provider: 'national-archives',
    canonicalUrl: 'https://www.archives.gov/founding-docs/declaration',
    canonicalId: 'nara:declaration-of-independence',
    editionDate: '1776-07-04; National Archives transcript',
    locatorScheme: 'paragraph',
    rights: usPublicDomain(
      'Declaration of Independence transcript; National Archives and Records Administration.',
      'https://www.archives.gov/founding-docs/downloads'
    )
  }),
  'src-nara-us-constitution': audited('pass-us-constitution', {
    provider: 'national-archives',
    canonicalUrl: 'https://www.archives.gov/founding-docs/constitution',
    canonicalId: 'nara:constitution-of-the-united-states',
    editionDate: '1787-09-17; National Archives transcript',
    locatorScheme: 'preamble / article / section / clause',
    rights: usPublicDomain(
      'Constitution of the United States transcript; National Archives and Records Administration.',
      'https://www.archives.gov/founding-docs/downloads'
    )
  }),
  'src-founders-federalist': audited('pass-federalist-10', {
    author: 'James Madison',
    provider: 'founders-online-primary-text-only',
    canonicalUrl: 'https://founders.archives.gov/documents/Madison/01-10-02-0178',
    canonicalId: 'founders-online:Madison/01-10-02-0178',
    editionDate: '1787-11-22; Founders Online digital edition',
    locatorScheme: 'essay / paragraph',
    rights: usPublicDomain(
      'James Madison, The Federalist No. 10; historical document text only. Modern editorial annotations are excluded.',
      'https://founders.archives.gov/documents/Madison/01-10-02-0178'
    )
  }),
  'src-frda-rights-man': audited('pass-rights-man', {
    provider: 'legifrance-open-data',
    canonicalUrl: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000697056',
    canonicalId: 'legifrance:JORFTEXT000000697056',
    editionDate: '1789-08-26; current Légifrance transcription',
    locatorScheme: 'article',
    rights: openLicense(
      'Licence Ouverte / Open Licence 2.0',
      'Déclaration des droits de l’homme et du citoyen, Légifrance, JORFTEXT000000697056.',
      'https://www.legifrance.gouv.fr/contenu/pied-de-page/open-data-et-api'
    )
  }),
  'src-gallica-rights-woman': audited('pass-rights-woman', {
    provider: 'assemblee-nationale-scan-collation',
    canonicalUrl: 'https://www.assemblee-nationale.fr/dyn/histoire-et-patrimoine/revolution-francaise/declaration-des-droits-de-la-femme-et-de-la-citoyenne',
    canonicalId: 'assemblee-nationale:declaration-droits-femme-1791',
    editionDate: '1791-09-05; Assemblée nationale transcription collated to BnF scan',
    locatorScheme: 'article',
    rights: usPublicDomain(
      'Olympe de Gouges, Déclaration des droits de la femme et de la citoyenne (1791); historical text only.',
      'https://www.assemblee-nationale.fr/dyn/histoire-et-patrimoine/revolution-francaise/declaration-des-droits-de-la-femme-et-de-la-citoyenne'
    )
  }),
  'src-candidate-equiano-narrative': audited('pass-equiano', {
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/15399',
    canonicalId: 'gutenberg:15399',
    editionDate: '1789 first edition text; Project Gutenberg eBook 15399',
    locatorScheme: 'chapter / paragraph',
    rights: usPublicDomain(
      'Olaudah Equiano, The Interesting Narrative (1789); clean excerpt collated to Project Gutenberg eBook 15399.',
      'https://www.gutenberg.org/ebooks/15399'
    )
  }),
  'src-loc-haiti-constitutions': audited('pass-haiti-constitution-1801', {
    workTitle: 'Les constitutions d’Haïti (1801–1885)',
    author: 'Haiti; compiled by Louis Joseph Janvier',
    provider: 'library-of-congress',
    canonicalUrl: 'https://www.loc.gov/item/78396819/',
    canonicalId: 'loc:lccn-78396819',
    editionDate: '1886 text; 1977 Fardin reprint digitized by Library of Congress',
    locatorScheme: 'constitution / title / article / scan image',
    rights: usPublicDomain(
      'Les constitutions d’Haïti (1801–1885). Credit: Library of Congress.',
      'https://www.loc.gov/item/78396819/'
    )
  }),
  'src-candidate-haiti-independence': audited('pass-haiti-independence-1804', {
    provider: 'uk-national-archives-scan-backed',
    canonicalUrl: 'https://images.nationalarchives.gov.uk/asset/17180/',
    canonicalId: 'uk-national-archives:MFQ-1/184-4',
    editionDate: '1804-01-01; surviving printed declaration',
    locatorScheme: 'document / paragraph',
    rights: usPublicDomain(
      'Haitian Declaration of Independence (1804), historical text; scan reference MFQ 1/184 (4), The National Archives.',
      'https://images.nationalarchives.gov.uk/asset/17180/'
    )
  }),
  'src-bne-cadiz-constitution': audited('pass-cadiz', {
    provider: 'congreso-de-los-diputados',
    canonicalUrl: 'https://www.congreso.es/constitucion/ficheros/historicas/cons_1812.pdf',
    canonicalId: 'congreso-es:constitucion-1812',
    editionDate: '1812-03-19; Congreso de los Diputados historical PDF',
    locatorScheme: 'title / chapter / article / PDF page',
    rights: usPublicDomain(
      'Constitución Política de la Monarquía Española (1812); Congreso de los Diputados historical reproduction.',
      'https://www.congreso.es/es/web/guest/cem/const1812'
    )
  }),
  'src-candidate-angostura-address': audited('pass-angostura', {
    provider: 'sociedad-bolivariana-scan-collation',
    canonicalUrl: 'https://www.sociedadbolivarianavenezuela.org.ve/wp-content/uploads/2024/10/Discurso-de-Angostura.pdf',
    canonicalId: 'sociedad-bolivariana:discurso-angostura-1819',
    editionDate: '1819-02-15; institutional historical transcription',
    locatorScheme: 'paragraph / PDF page',
    rights: usPublicDomain(
      'Simón Bolívar, Discurso de Angostura (1819); historical Spanish text only.',
      'https://www.sociedadbolivarianavenezuela.org.ve/wp-content/uploads/2024/10/Discurso-de-Angostura.pdf'
    )
  }),
  'src-loc-monroe-message': audited('pass-monroe-message', {
    provider: 'american-presidency-project-primary-text',
    canonicalUrl: 'https://www.presidency.ucsb.edu/documents/seventh-annual-message-1',
    canonicalId: 'american-presidency-project:node-205755',
    editionDate: '1823-12-02; digital transcript',
    locatorScheme: 'paragraph',
    rights: usPublicDomain(
      'James Monroe, Seventh Annual Message (1823); historical message text only.',
      'https://www.presidency.ucsb.edu/documents/seventh-annual-message-1'
    )
  }),
  'src-loc-seneca-declaration': audited('pass-seneca-declaration', {
    author: 'Seneca Falls Convention',
    provider: 'national-park-service',
    canonicalUrl: 'https://www.nps.gov/wori/learn/historyculture/declaration-of-sentiments.htm',
    canonicalId: 'nps:wori-declaration-of-sentiments',
    editionDate: '1848-07-19; National Park Service transcript',
    locatorScheme: 'paragraph / resolution',
    rights: usPublicDomain(
      'Declaration of Sentiments (1848); transcript from Women’s Rights National Historical Park, National Park Service.',
      'https://www.nps.gov/wori/learn/historyculture/declaration-of-sentiments.htm'
    )
  })
});
