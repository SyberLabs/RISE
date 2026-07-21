import { ATRIUM_PILOT_INTEGRITY } from './integrity.js';

const REVIEWED_AT = '2026-07-19';
const rights = (status, jurisdictions, license, attribution, evidenceUrl, reviewedAt = REVIEWED_AT) => ({
  status,
  jurisdictions,
  license,
  attribution,
  evidenceUrl,
  reviewedAt
});
const usPublicDomain = (attribution, evidenceUrl, reviewedAt = REVIEWED_AT) => rights(
  'public-domain-confirmed',
  ['US'],
  'Public domain in the United States; independently packaged historical text only',
  attribution,
  evidenceUrl,
  reviewedAt
);
const openLicense = (license, attribution, evidenceUrl, reviewedAt = REVIEWED_AT) => rights(
  'open-license-confirmed',
  ['WORLDWIDE'],
  license,
  attribution,
  evidenceUrl,
  reviewedAt
);
const audited = (passageId, fields, reviewedAt = REVIEWED_AT) => ({
  ...fields,
  kind: 'source-edition-candidate',
  sourcePayloadIds: [passageId],
  acquisitionScope: 'selected-excerpt-unit',
  checksum: ATRIUM_PILOT_INTEGRITY[passageId].checksum,
  retrievedAt: reviewedAt,
  status: 'publishable'
});

export const HISTORY_SOURCE_AUDITS = Object.freeze({
  'src-hansard-apprenticeship-debate-1838': audited('pass-commons-apprenticeship-debate-1838', {
    workTitle: 'Abolition of Negro Apprenticeship',
    author: 'House of Commons; Sir George Strickland and Sir George Grey',
    provider: 'uk-parliament-historic-hansard',
    canonicalUrl: 'https://api.parliament.uk/historic-hansard/commons/1838/mar/29/abolition-of-negro-apprenticesship',
    canonicalId: 'HC-Deb-1838-03-29-vol-42-cc40-108',
    editionDate: '1838-03-29 debate; UK Parliament Historic Hansard digital transcript',
    locatorScheme: 'chamber / date / volume / column / speaker / paragraph',
    rights: openLicense(
      'Open Parliament Licence',
      'Contains Parliamentary information licensed under the Open Parliament Licence; UK Parliament, Historic Hansard, HC Deb 29 March 1838, volume 42, columns 40–108.',
      'https://www.parliament.uk/site-information/copyright/open-parliament-licence/'
    )
  }),
  'src-unb-barbados-apprenticeship-termination-1838': audited('pass-barbados-apprenticeship-termination-1838', {
    workTitle: 'An Act for terminating the Apprenticeship of the Praedial Labourers within this Island, on the first day of August, one thousand eight hundred and thirty eight',
    author: 'Barbados Legislature; Colonial Office abstract certified by C. T. Cunningham and E. M. MacGregor',
    provider: 'unb-laws-enslavement-freedom-transcript',
    canonicalUrl: 'https://slaveryandfreedomlaws.lib.unb.ca/laws/barbados-1838',
    canonicalId: 'unb-laws:barbados-1838:472:co-28-125-58-59',
    editionDate: '1838 act; Colonial Office CO 28/125, pages 58–59; exact assent date not supplied in the digital record',
    locatorScheme: 'archive series / volume / page / clause abstract',
    collationUrls: ['https://slaveryandfreedomlaws.lib.unb.ca/sources/colonial-office-co-28-125-national-archives-kew-uk'],
    rights: openLicense(
      'Creative Commons CC0 1.0 Universal',
      'Laws of Enslavement and Freedom in the Anglo-Atlantic World © 2023 Stefanie Hunt-Kennedy, CC0 1.0; historical Colonial Office abstract only.',
      'https://slaveryandfreedomlaws.lib.unb.ca/laws/barbados-1838'
    )
  }),
  'src-argentina-tucuman-act-1816': audited('pass-tucuman-independence-act-1816', {
    workTitle: 'Acta de la Independencia de las Provincias Unidas en Sud-América',
    author: 'Congress of Tucumán',
    provider: 'argentina-government-transcript',
    canonicalUrl: 'https://www.argentina.gob.ar/sites/default/files/2025/07/acta_de_la_independencia_-_castellano.pdf',
    canonicalId: 'argentina-government:tucuman-act:1816-07-09/19',
    editionDate: '1816-07-09 declaration with 1816-07-19 amendment; current Argentine government transcript',
    locatorScheme: 'document / declaration / amendment',
    collationUrls: ['https://www.educ.ar/recursos/128490/acta-de-la-independencia-de-las-provincias-unidas'],
    rights: usPublicDomain('Congress of Tucumán independence act (9 July 1816) with the 19 July renunciation of all other foreign domination. Modern government layout, captions, and commemorative framing are excluded.', 'https://www.argentina.gob.ar/sites/default/files/2025/07/acta_de_la_independencia_-_castellano.pdf')
  }),
  'src-agn-belgrano-pueyrredon-1816': audited('pass-belgrano-government-unsettled-1816', {
    workTitle: 'Manuel Belgrano to Juan Martín de Pueyrredón',
    author: 'Manuel Belgrano',
    provider: 'argentina-national-archive-document-scan',
    canonicalUrl: 'https://www.argentina.gob.ar/sites/default/files/monarquia_incaica_la_anarquia_y_otros_asuntos_militares_.pdf',
    canonicalId: 'archivo-general-nacion-argentina:documentos-escritos:07-3493',
    editionDate: '1816-07-12 letter; Archivo General de la Nación, Documentos Escritos 07-3493; current Ministry of Interior educational facsimile and transcript',
    locatorScheme: 'archive reference / document date / paragraph',
    rights: usPublicDomain('Manuel Belgrano to Juan Martín de Pueyrredón (12 July 1816), selected continuous substantive paragraphs only. Ministry headings, description, document image, and educational layout are excluded.', 'https://www.argentina.gob.ar/sites/default/files/monarquia_incaica_la_anarquia_y_otros_asuntos_militares_.pdf')
  }),
  'src-argentina-tucuman-order-1816': audited('pass-tucuman-order-decree-1816', {
    workTitle: 'Manifiesto del Congreso a los Pueblos',
    author: 'Congress of Tucumán',
    provider: 'argentina-national-museum-object-and-transcript-collation',
    canonicalUrl: 'https://www.argentina.gob.ar/node/506237',
    canonicalId: 'museo-historico-nacional-argentina:manifiesto-congreso-pueblos:1816-08-01',
    editionDate: '1816-08-01 decree; Museo Histórico Nacional collection object; transcription collated to the historical text',
    locatorScheme: 'document / decree / date',
    collationUrls: ['https://elhistoriador.com.ar/fin-de-la-revolucion-principio-al-orden-manifiesto-del-congreso-de-las-provincias-unidas-de-sud-america-excitando-los-pueblos-a-la-union-y-al-orden/'],
    rights: usPublicDomain('Congress of Tucumán decree of 1 August 1816, complete historical text only. Museum description, object photography, modern transcription wrapper, biography, and navigation are excluded.', 'https://www.argentina.gob.ar/node/506237')
  }),
  'src-mexico-plan-iguala-1821': audited('pass-plan-iguala-1821', {
    workTitle: 'Plan de Iguala',
    author: 'Agustín de Iturbide',
    provider: 'mexico-chamber-inehrm-transcript',
    canonicalUrl: 'https://www.diputados.gob.mx/Asesor-Legislativo/docs/7.Constituciones/Documentos/h.pdf',
    canonicalId: 'camara-diputados-mexico:inehrm:plan-iguala:1821-02-21',
    editionDate: '1821-02-21 document; current Chamber of Deputies / INEHRM institutional transcript',
    locatorScheme: 'preamble / numbered base / date',
    collationUrls: ['https://es.wikisource.org/wiki/Plan_de_Iguala'],
    rights: usPublicDomain('Plan de Iguala, preamble and selected complete numbered bases only. Institutional headers, modern layout, navigation, and any surrounding commentary are excluded.', 'https://www.diputados.gob.mx/Asesor-Legislativo/docs/7.Constituciones/Documentos/h.pdf')
  }),
  'src-inehrm-mexico-independence-act-1821': audited('pass-mexico-independence-act-1821', {
    workTitle: 'Acta de Independencia del Imperio Mexicano',
    author: 'Supreme Provisional Governing Junta of the Mexican Empire',
    provider: 'inehrm-official-transcript',
    canonicalUrl: 'https://inehrm.gob.mx/work/models/Constitucion1917/Resource/263/1/images/Independencia19_2.pdf',
    canonicalId: 'inehrm:independencia19-2:1821-09-28',
    editionDate: '1821-09-28 act; current INEHRM institutional transcript',
    locatorScheme: 'document / paragraph / signature block',
    rights: usPublicDomain('Mexican Imperial Act of Independence, complete substantive declaration only. Institutional headers, modern layout, and the signature list are excluded.', 'https://inehrm.gob.mx/work/models/Constitucion1917/Resource/263/1/images/Independencia19_2.pdf')
  }),
  'src-peru-bicentennial-independence-act-1821': audited('pass-peru-lima-independence-act-1821', {
    workTitle: 'Acta de declaración de la independencia del Perú',
    author: 'Cabildo of Lima',
    provider: 'peru-bicentennial-institutional-transcript',
    canonicalUrl: 'https://bicentenario.gob.pe/15-julio-1821-firma-acta-independencia-peru/',
    canonicalId: 'peru:municipalidad-lima:libro-cabildo-45:1821-07-15',
    editionDate: '1821-07-15 act; Libro de Cabildo 45; current Proyecto Especial Bicentenario transcript',
    locatorScheme: 'municipal book / act / date',
    collationUrls: ['https://www.gob.pe/institucion/cultura/noticias/506461-ministerio-de-cultura-declaran-patrimonio-cultural-de-la-nacion-el-acta-de-declaracion-de-la-independencia-del-peru'],
    rights: usPublicDomain('Cabildo of Lima act of 15 July 1821, complete substantive historical text only. Modern introduction, images, captions, related links, and site furniture are excluded.', 'https://bicentenario.gob.pe/15-julio-1821-firma-acta-independencia-peru/')
  }),
  'src-peru-congress-protector-decree-1821': audited('pass-peru-protector-decree-1821', {
    workTitle: 'Decreto asumiendo el mando supremo político y militar con el título de Protector',
    author: 'José de San Martín',
    provider: 'peru-congress-official-transcript',
    canonicalUrl: 'https://www.congreso.gob.pe/Docs/participacion/museo/congreso/files/mensajes/1822-1840/a-mensaje-1821-3.pdf',
    canonicalId: 'congreso-peru:mensajes:1821-3:1821-08-03',
    editionDate: '1821-08-03 decree; current Congress of Peru transcript',
    locatorScheme: 'document / paragraph / numbered article',
    rights: usPublicDomain('José de San Martín decree of 3 August 1821, selected complete paragraphs and Articles 1 and 7 only. Modern institutional headers, pagination, and layout are excluded.', 'https://www.congreso.gob.pe/Docs/participacion/museo/congreso/files/mensajes/1822-1840/a-mensaje-1821-3.pdf')
  }),
  'src-bndigital-brazil-manifesto-peoples-1822': audited('pass-brazil-manifesto-peoples-1822', {
    workTitle: 'Manifesto do Príncipe Regente aos Povos do Brasil',
    author: 'Pedro, Prince Regent; drafted by Joaquim Gonçalves Ledo',
    provider: 'brazil-national-library-newspaper-scan',
    canonicalUrl: 'https://objdigital.bn.br/acervo_digital/div_periodicos/gazeta_rj/gazeta_rj_1822/gazeta_rj_1822_094_suplemento.pdf',
    canonicalId: 'biblioteca-nacional-brasil:gazeta-rio:1822:94-suplemento:245-248',
    editionDate: '1822-08-01 manifesto; Gazeta do Rio supplement 94, 6 August 1822, pages 245–248; Biblioteca Nacional digital scan',
    locatorScheme: 'newspaper issue / print page / paragraph',
    collationUrls: ['https://digital-dev.bbm.usp.br/items/6110a27e-bb23-4cb4-bb22-3404a648ba57'],
    rights: usPublicDomain('Manifesto to the Peoples of Brazil (1 August 1822), selected complete historical paragraphs only. Newspaper masthead, stamps, layout, watermarks, and all modern catalogue metadata are excluded.', 'https://objdigital.bn.br/acervo_digital/div_periodicos/gazeta_rj/gazeta_rj_1822/gazeta_rj_1822_094_suplemento.pdf')
  }),
  'src-brazil-chamber-council-session-1822': audited('pass-brazil-council-session-1822', {
    workTitle: 'Ata da sessão nº 13 do Conselho de Estado',
    author: 'Council of State; Joaquim Gonçalves Ledo, secretary',
    provider: 'brazil-chamber-archival-exhibition-transcript',
    canonicalUrl: 'https://www2.camara.leg.br/a-camara/visiteacamara/cultura-na-camara/arquivos/dois-de-julho-2014-a-independencia-do-brasil-na-bahia',
    canonicalId: 'camara-deputados-brasil:conselho-estado:sessao-13:1822-09-02',
    editionDate: '1822-09-02 council minute; current Chamber of Deputies archival exhibition transcript',
    locatorScheme: 'session / date / archival extract',
    collationUrls: ['https://www.gov.br/arquivonacional/pt-br/canais_atendimento/imprensa/copy_of_noticias/nota-de-esclarecimento-sobre-documentos-da-independencia-do-brasil'],
    rights: usPublicDomain('Council of State session 13 (2 September 1822), complete exhibited archival extract only. Exhibition interpretation, images, captions, quotations from later scholarship, and layout are excluded.', 'https://www2.camara.leg.br/a-camara/visiteacamara/cultura-na-camara/arquivos/dois-de-julho-2014-a-independencia-do-brasil-na-bahia')
  }),
  'src-cachoeira-adhesion-letter-1822': audited('pass-cachoeira-adhesion-letter-1822', {
    workTitle: 'Câmara de Cachoeira ao Príncipe Regente',
    author: 'Municipal chamber of Cachoeira',
    provider: 'ufba-scan-backed-document-quotation',
    canonicalUrl: 'https://ppgh.ufba.br/sites/ppgh.ufba.br/files/13_entre_adesoes_e_rupturas_projetos_e_identidades_politicas_na_bahia_1808-1824.pdf',
    canonicalId: 'camara-cachoeira:letter-prince-regent:1822-06-28',
    editionDate: '1822-06-28 letter; historical text reproduced from an official 1919–1940 Bahia documentary edition in a UFBA repository scan',
    locatorScheme: 'letter date / quoted document / print edition reference',
    rights: usPublicDomain('Municipal chamber of Cachoeira letter of 28 June 1822, quoted substantive historical paragraphs only. The modern dissertation’s analysis, notes, layout, and all surrounding prose are excluded.', 'https://ppgh.ufba.br/sites/ppgh.ufba.br/files/13_entre_adesoes_e_rupturas_projetos_e_identidades_politicas_na_bahia_1808-1824.pdf')
  }),
  'src-founders-boston-massacre-crown': audited('pass-boston-massacre-crown-evidence', {
    workTitle: 'Anonymous Summary of Crown Evidence: 24–25 October 1770',
    author: 'Unidentified trial reporter; witnesses Ebenezer Hinkley and Peter Cunningham',
    provider: 'founders-online-primary-text-only',
    canonicalUrl: 'https://founders.archives.gov/documents/Adams/05-03-02-0001-0003-0004',
    canonicalId: 'founders-online:Adams/05-03-02-0001-0003-0004',
    editionDate: '1770-10-24/25 trial evidence; Founders Online transcription of PRO CO 5:759, pages 711–720',
    locatorScheme: 'case / evidentiary side / witness / trial date',
    collationUrls: ['https://www.loc.gov/item/02002963/'],
    rights: usPublicDomain('The King v. Preston, anonymous summary of Crown evidence (24–25 October 1770), Hinkley and Cunningham testimony only. Founders Online annotations, source notes, corrections, links, and editorial apparatus are excluded.', 'https://founders.archives.gov/documents/Adams/05-03-02-0001-0003-0004', '2026-07-20')
  }, '2026-07-20'),
  'src-founders-boston-massacre-defense': audited('pass-boston-massacre-defense-evidence', {
    workTitle: 'Anonymous Summary of Defense Evidence: 25–27 October 1770',
    author: 'Unidentified trial reporter; witnesses Newton Prince and James Woodall',
    provider: 'founders-online-primary-text-only',
    canonicalUrl: 'https://founders.archives.gov/documents/Adams/05-03-02-0001-0003-0006',
    canonicalId: 'founders-online:Adams/05-03-02-0001-0003-0006',
    editionDate: '1770-10-25/27 trial evidence; Founders Online transcription of PRO CO 5:759, pages 720–736',
    locatorScheme: 'case / evidentiary side / witness / trial date',
    collationUrls: ['https://www.loc.gov/item/02002963/'],
    rights: usPublicDomain('The King v. Preston, anonymous summary of defense evidence (25–27 October 1770), Prince and Woodall testimony only. Founders Online annotations, source notes, corrections, links, and editorial apparatus are excluded.', 'https://founders.archives.gov/documents/Adams/05-03-02-0001-0003-0006', '2026-07-20')
  }, '2026-07-20'),
  'src-ukna-boston-tea-newspaper-1773': audited('pass-boston-tea-colonial-newspaper-1773', {
    workTitle: 'Massachusetts and Boston Weekly account of the destruction of the tea',
    author: 'Massachusetts and Boston Weekly newspaper',
    provider: 'uk-national-archives-scan-and-transcript',
    canonicalUrl: 'https://www.nationalarchives.gov.uk/education/resources/boston-tea-party/boston-tea-party-source-4/',
    canonicalId: 'uk-national-archives:CO-5/91:boston-tea-party:1773-12-23',
    editionDate: '1773-12-23 newspaper; Colonial Office copy, CO 5/91; current National Archives scan and transcript',
    locatorScheme: 'newspaper date / surviving extract / catalogue reference',
    rights: usPublicDomain('Massachusetts and Boston Weekly account (23 December 1773), complete surviving historical extract only. National Archives introductions, glossary expansions, teaching questions, and site furniture are excluded.', 'https://www.nationalarchives.gov.uk/education/resources/boston-tea-party/boston-tea-party-source-4/', '2026-07-20')
  }, '2026-07-20'),
  'src-ukna-boston-tea-leslie-1773': audited('pass-boston-tea-leslie-letter-1773', {
    workTitle: 'Alexander Leslie to Viscount Barrington',
    author: 'Lieutenant Colonel Alexander Leslie',
    provider: 'uk-national-archives-scan-and-transcript',
    canonicalUrl: 'https://www.nationalarchives.gov.uk/education/resources/boston-tea-party/boston-tea-party-source-3/',
    canonicalId: 'uk-national-archives:WO-40/1:leslie-barrington:1773-12-17',
    editionDate: '1773-12-17 letter; War Office 40/1; current National Archives scan and transcript',
    locatorScheme: 'letter date / paragraph / catalogue reference',
    rights: usPublicDomain('Alexander Leslie to Viscount Barrington (17 December 1773), complete historical letter only. National Archives introductions, glossary expansions, teaching questions, and site furniture are excluded.', 'https://www.nationalarchives.gov.uk/education/resources/boston-tea-party/boston-tea-party-source-3/', '2026-07-20')
  }, '2026-07-20'),
  'src-bailly-maillard-october-days': audited('pass-maillard-womens-march-deposition', {
    workTitle: 'Mémoires de Bailly, volume III: Déposition de Maillard sur les événements du 5 et du 6 octobre',
    author: 'Stanislas-Marie Maillard; published in the papers of Jean-Sylvain Bailly',
    editor: 'Berville and Barrière',
    provider: 'internet-archive-scan-backed',
    canonicalUrl: 'https://archive.org/details/mmoiresdebailly03bail',
    canonicalId: 'internet-archive:mmoiresdebailly03bail:note-b:406-420',
    editionDate: 'testimony from the Châtelet inquiry into 5–6 October 1789; Paris: Baudouin frères, 1822, volume III, pages 406–420',
    locatorScheme: 'volume / note / deposition / print page',
    collationUrls: ['https://books.google.com/books?id=P6d7b_visGsC'],
    rights: usPublicDomain('Stanislas-Marie Maillard, deposition on the events of 5–6 October 1789, selected continuous historical text from Mémoires de Bailly, volume III (1822), pages 407–408. Bailly narrative, later editorial matter, and provider furniture are excluded.', 'https://archive.org/details/mmoiresdebailly03bail', '2026-07-20')
  }, '2026-07-20'),
  'src-arcpa-womens-march-session': audited('pass-assembly-womens-march-1789', {
    workTitle: 'Archives parlementaires, night session of 5 October 1789',
    author: 'National Constituent Assembly; speakers recorded in the parliamentary archive',
    provider: 'persee-archives-parlementaires-scan-backed',
    canonicalUrl: 'https://www.persee.fr/doc/arcpa_0000-0000_1877_num_9_1_5118_t1_0348_0000_24',
    canonicalId: 'persee:arcpa_0000-0000_1877_num_9_1_5118_t1_0348_0000_24',
    editionDate: '1789-10-05 proceedings; Archives parlementaires, Première série, Tome IX (1877), page 348',
    locatorScheme: 'series / volume / session / print page / incident',
    collationUrls: ['https://archives-parlementaires.persee.fr/prt/aa2d9720-1619-4fd3-8357-695dd6ae3154'],
    rights: usPublicDomain('National Constituent Assembly, night session of 5 October 1789, complete historical incident on page 348. Persée and ARCPA metadata, modern headings, and provider furniture are excluded.', 'https://www.persee.fr/doc/arcpa_0000-0000_1877_num_9_1_5118_t1_0348_0000_24', '2026-07-20')
  }, '2026-07-20'),
  'src-candidate-rousseau-social-contract': audited('pass-rousseau-association', {
    workTitle: 'The Social Contract',
    author: 'Jean-Jacques Rousseau',
    translator: 'G. D. H. Cole',
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/46333',
    canonicalId: 'gutenberg:46333',
    editionDate: 'London and Toronto: J. M. Dent & Sons; New York: E. P. Dutton, 1920; Project Gutenberg eBook 46333, updated 2025-07-20',
    locatorScheme: 'book / chapter / paragraph',
    collationUrls: [
      'https://standardebooks.org/ebooks/jean-jacques-rousseau/the-social-contract/g-d-h-cole',
      'https://books.google.com/books?id=exNPAAAAMAAJ'
    ],
    rights: usPublicDomain(
      'Jean-Jacques Rousseau, The Social Contract, translated by G. D. H. Cole (1920), Book I, Chapter VI, selected historical text only. The translator and edition are identified; modern summaries, introductions, notes, and provider furniture are excluded.',
      'https://www.gutenberg.org/ebooks/46333',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-avalon-vermont-constitution-1777': audited('pass-vermont-constitution-1777', {
    workTitle: 'Constitution of Vermont',
    author: 'Vermont General Convention',
    provider: 'yale-law-avalon-historical-transcript',
    canonicalUrl: 'https://avalon.law.yale.edu/18th_century/vt01.asp',
    canonicalId: 'avalon:vermont-constitution:1777-07-08',
    editionDate: '1777-07-08; Yale Law School Avalon Project historical transcription',
    locatorScheme: 'chapter / article / section',
    rights: usPublicDomain(
      'Constitution of Vermont (1777), selected declaration-of-rights articles and freemanship section; historical constitutional text only. Avalon navigation, notes, and page furniture are excluded.',
      'https://avalon.law.yale.edu/18th_century/vt01.asp',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-nara-articles-confederation': audited('pass-articles-confederation-1777', {
    workTitle: 'Articles of Confederation',
    author: 'Continental Congress and the thirteen states',
    provider: 'national-archives-original-and-transcript',
    canonicalUrl: 'https://www.archives.gov/milestone-documents/articles-of-confederation',
    canonicalId: 'nara:rg360:articles-of-confederation:1781-03-01',
    editionDate: 'adopted 1777-11-15; in force 1781-03-01; National Archives transcript of the engrossed original',
    locatorScheme: 'article / engrossed sheet',
    rights: usPublicDomain(
      'Articles of Confederation, Articles I–V, selected complete clauses from the National Archives transcript of the engrossed original; modern explanatory copy and site furniture are excluded.',
      'https://www.archives.gov/milestone-documents/articles-of-confederation',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-nara-bill-rights-1789': audited('pass-us-bill-rights-proposal-1789', {
    workTitle: 'Joint Resolution Proposing Twelve Amendments to the Constitution',
    author: 'United States Congress',
    provider: 'national-archives-original-and-transcript',
    canonicalUrl: 'https://www.archives.gov/milestone-documents/bill-of-rights',
    canonicalId: 'nara:rg11:engrossed-bill-of-rights:1789-09-25',
    editionDate: '1789-09-25 enrolled proposal; National Archives transcript of the engrossed original',
    locatorScheme: 'preamble / proposed article / engrossed original',
    rights: usPublicDomain(
      'Engrossed Bill of Rights (1789), preamble and all twelve proposed articles from the National Archives transcript; modern explanatory copy and site furniture are excluded.',
      'https://www.archives.gov/milestone-documents/bill-of-rights',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-uk-patent-watt-913': audited('pass-watt-steam-principles-1769', {
    workTitle: 'A Method of Lessening the Consumption of Steam and Fuel in Fire Engines',
    author: 'James Watt',
    provider: 'uk-patent-office-official-reprint-scan',
    canonicalUrl: 'https://commons.wikimedia.org/wiki/File:James_Watt_Patent_1769_No_913.pdf',
    canonicalId: 'great-britain-patent:913:1769',
    editionDate: '1769-01-05 patent; specification dated 1769-04-25 and enrolled 1769-04-29; official 1855 reprint',
    locatorScheme: 'principle / reprint page',
    collationUrls: ['https://collection.powerhouse.com.au/object/119115'],
    rights: rights(
      'public-domain-confirmed',
      ['WORLDWIDE'],
      'Public Domain Mark 1.0; historical patent specification and 1855 official reprint',
      'James Watt, British Patent No. 913 (1769), selected specification principles; official reprint by George Edward Eyre and William Spottiswoode (1855). Legal boilerplate and scan furniture are excluded.',
      'https://commons.wikimedia.org/wiki/File:James_Watt_Patent_1769_No_913.pdf',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-baines-cotton-manufacture-1835': audited('pass-arkwright-water-frame-system-1769', {
    workTitle: 'History of the Cotton Manufacture in Great Britain',
    author: 'Edward Baines',
    provider: 'internet-archive-scan-backed',
    canonicalUrl: 'https://archive.org/details/cottonmanufact00bain',
    canonicalId: 'internet-archive:cottonmanufact00bain',
    editionDate: 'London: H. Fisher, R. Fisher, and P. Jackson, 1835',
    locatorScheme: 'chapter / print page / quoted patent element',
    collationUrls: [
      'https://www.nationalarchives.gov.uk/education/resources/georgian-britain-age-modernity/arkwrights-spinning-frame/',
      'https://artsandculture.google.com/asset/richard-arkwright-s-roller-spinning-patent-richard-arkwright/JQEM1h62uI09kQ?hl=en',
      'https://collection.sciencemuseumgroup.org.uk/objects/co44831'
    ],
    rights: usPublicDomain(
      'Edward Baines, History of the Cotton Manufacture in Great Britain (1835), Chapter IX, selected historical text and embedded 1769 patent extract only. Modern catalogue descriptions and provider material are excluded.',
      'https://commons.wikimedia.org/wiki/File:Edward_Baines,_History_of_the_cotton_manufacture,_1835.pdf',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-marsden-cotton-weaving-1895': audited('pass-cartwright-power-loom-iteration-1785', {
    workTitle: 'Cotton Weaving: Its Development, Principles, and Practice',
    author: 'Richard Marsden',
    provider: 'university-of-arizona-weaving-archive-scan',
    canonicalUrl: 'https://www2.cs.arizona.edu/patterns/weaving/books/mr_weave_1.pdf',
    canonicalId: 'university-arizona-weaving-archive:mr_weave_1',
    editionDate: 'London: George Bell & Sons, 1895; two-up digital facsimile',
    locatorScheme: 'chapter / print page / figure',
    collationUrls: [
      'https://www2.cs.arizona.edu/patterns/weaving/books.html',
      'https://collection.sciencemuseumgroup.org.uk/people/ap13666/cartwright-edmund'
    ],
    rights: usPublicDomain(
      'Richard Marsden, Cotton Weaving (1895), Chapter III, print pages 61–63, including the historical patent extract; public-domain historical text only. Archive navigation and modern collection descriptions are excluded.',
      'https://www2.cs.arizona.edu/patterns/weaving/books.html',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-guardian-stockton-darlington-archive-1825': audited('pass-stockton-darlington-opening-1825', {
    workTitle: 'Stockton and Darlington Railway; Opening of the Stockton and Darlington Railway',
    author: 'Stockton and Darlington Railway Company; contemporary newspaper correspondent',
    provider: 'guardian-digital-archive-historical-text',
    canonicalUrl: 'https://www.theguardian.com/uk-news/2025/sep/26/stockton-darlington-railway-first-public-passenger-service-opens-1825',
    canonicalId: 'guardian-archive:stockton-darlington:1825-09-24:1825-10-15',
    editionDate: 'company notice dated 1825-09-24 and opening report dated 1825-10-15; Guardian archive republication, 2025-09-26',
    locatorScheme: 'document date / paragraph',
    collationUrls: [
      'https://collection.sciencemuseumgroup.org.uk/objects/co8104402/formal-opening-of-the-stockton-and-darlington-railway-company',
      'https://historicengland.org.uk/whats-new/research/a-brief-overview-of-the-stockton-and-darlington-railway/'
    ],
    rights: usPublicDomain(
      'Stockton and Darlington Railway company notice (24 September 1825) and contemporary opening report (15 October 1825); independently packaged historical text only. The Guardian’s 2025 headline, introduction, layout, image, links, and other modern material are excluded.',
      'https://www.theguardian.com/uk-news/2025/sep/26/stockton-darlington-railway-first-public-passenger-service-opens-1825',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-loc-lexington-depositions-1775': audited('pass-lexington-provincial-evidence-1775', {
    workTitle: 'Massachusetts Provincial Congress letter to Benjamin Franklin and Lexington deposition of Elijah Saunderson',
    author: 'Massachusetts Provincial Congress; Elijah Saunderson',
    editor: 'Worthington Chauncey Ford',
    provider: 'library-of-congress-scan-backed',
    canonicalUrl: 'https://www.loc.gov/item/05000059/',
    canonicalId: 'lccn:05000059:volume-2',
    editionDate: '1775 documents; Journals of the Continental Congress, volume II (1905), print pages 26–29',
    locatorScheme: 'journal volume / print page / document / deposition',
    collationUrls: [
      'https://tile.loc.gov/storage-services/service/ll/llscd/lljc002/lljc002.pdf',
      'https://www.archives.gov/education/lessons/prequel-to-revolution.html'
    ],
    rights: usPublicDomain(
      'Massachusetts Provincial Congress letter to Benjamin Franklin (26 April 1775) and Elijah Saunderson deposition (25 April 1775), selected historical text from Journals of the Continental Congress, volume II, print pages 26–29. Ford notes and provider furniture are excluded.',
      'https://www.loc.gov/item/05000059/',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-uh-gage-dartmouth-1775': audited('pass-gage-lexington-report-1775', {
    workTitle: 'General Gage to the Earl of Dartmouth',
    author: 'Thomas Gage',
    provider: 'university-of-houston-digital-history-primary-text-only',
    canonicalUrl: 'https://www.digitalhistory.uh.edu/active_learning/explorations/revolution/account5_lexington.cfm',
    canonicalId: 'digital-history:revolution:account5-lexington',
    editionDate: '1775-04-22; University of Houston Digital History transcript',
    locatorScheme: 'document date / paragraph',
    collationUrls: [
      'https://www.archives.gov/education/lessons/prequel-to-revolution.html',
      'https://www.nps.gov/media/video/view.htm?id=A8F5DF06-CBBC-4620-9B8F-06B5D0115963'
    ],
    rights: usPublicDomain(
      'Thomas Gage to the Earl of Dartmouth (22 April 1775), historical report text only. University navigation and teaching material are excluded.',
      'https://www.digitalhistory.uh.edu/active_learning/explorations/revolution/account5_lexington.cfm',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-founders-washington-orders-1775': audited('pass-washington-continental-orders-1775', {
    workTitle: 'General Orders, 4 July 1775',
    author: 'George Washington',
    provider: 'founders-online-primary-text-only',
    canonicalUrl: 'https://founders.archives.gov/documents/Washington/03-01-02-0027',
    canonicalId: 'founders-online:Washington/03-01-02-0027',
    editionDate: '1775-07-04; Founders Online transcription from Varick and contemporary orderly-book copies',
    locatorScheme: 'document date / order paragraph',
    collationUrls: [
      'https://www.loc.gov/resource/mgw3g.001/?sp=5&st=text',
      'https://www.loc.gov/resource/mgw3g.001/?sp=6&st=text'
    ],
    rights: usPublicDomain(
      'George Washington, General Orders (4 July 1775), selected historical orders only. Founders Online editorial introduction, source note, annotations, and navigation are excluded.',
      'https://founders.archives.gov/documents/Washington/03-01-02-0027',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-founders-franco-american-alliance-1778': audited('pass-franco-american-alliance-1778', {
    workTitle: 'The Franco-American Treaty of Alliance',
    author: 'France and the United States of America',
    provider: 'founders-online-primary-text-only',
    canonicalUrl: 'https://founders.archives.gov/documents/Franklin/01-25-02-0476',
    canonicalId: 'founders-online:Franklin/01-25-02-0476',
    editionDate: '1778-02-06; signed bilingual instrument, National Archives',
    locatorScheme: 'article / signed bilingual instrument',
    collationUrls: [
      'https://guides.loc.gov/treaty-of-alliance-with-france',
      'https://tile.loc.gov/storage-services/service/ll/llsl/llsl-vol-8-foreign-treaties/llsl-vol-8-foreign-treaties.pdf'
    ],
    rights: usPublicDomain(
      'Franco-American Treaty of Alliance (6 February 1778), preamble and Articles 1–3, 8, and 11 from the historical English text signed alongside the French text. Modern editorial introduction, annotations, parallel French text, and provider furniture are excluded.',
      'https://founders.archives.gov/documents/Franklin/01-25-02-0476',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-founders-yorktown-capitulation-1781': audited('pass-yorktown-capitulation-1781', {
    workTitle: 'Articles of Capitulation between Washington and Cornwallis',
    author: 'George Washington, Charles Cornwallis, Jean-Baptiste de Rochambeau, Francois Joseph Paul de Grasse, and Thomas Symonds',
    provider: 'founders-online-loc-collated',
    canonicalUrl: 'https://founders.archives.gov/documents/Washington/99-01-02-07199',
    canonicalId: 'founders-online:Washington/99-01-02-07199',
    editionDate: '1781-10-19; early-access Founders Online transcript collated to the Library of Congress Varick copy',
    locatorScheme: 'article / manuscript image',
    collationUrls: [
      'https://www.loc.gov/resource/mgw3e.001/?sp=222&st=image',
      'https://research.colonialwilliamsburg.org/DigitalLibrary/view/index.cfm?doc=Manuscripts%5CM1931_17_0018.xml'
    ],
    rights: usPublicDomain(
      'Articles of Capitulation at Yorktown (19 October 1781), preamble and Articles 1–4, 8, 10, 13, and 14, selected historical text. Founders Online editorial matter and modern repository descriptions are excluded.',
      'https://www.loc.gov/resource/mgw3e.001/?sp=222&st=image',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-founders-franklin-examination': audited('pass-franklin-war-finance-1766', {
    workTitle: 'Examination before the Committee of the Whole of the House of Commons',
    author: 'Benjamin Franklin',
    provider: 'founders-online-primary-text-only',
    canonicalUrl: 'https://founders.archives.gov/documents/Franklin/01-13-02-0035',
    canonicalId: 'founders-online:Franklin/01-13-02-0035',
    editionDate: '1766 Hall and Sellers print; Founders Online digital edition',
    locatorScheme: 'question / answer',
    rights: usPublicDomain(
      'Benjamin Franklin, Examination before the Committee of the Whole of the House of Commons (13 February 1766); historical examination text only. Modern editorial introduction, notes, and annotations are excluded.',
      'https://founders.archives.gov/documents/Franklin/01-13-02-0035',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-yale-treaty-paris-1763': audited('pass-treaty-paris-1763', {
    workTitle: 'The definitive Treaty of Peace and Friendship between Great Britain, France, and Spain',
    author: 'Great Britain, France, Spain, and Portugal',
    provider: 'yale-law-avalon-primary-document',
    canonicalUrl: 'https://avalon.law.yale.edu/18th_century/paris763.asp',
    canonicalId: 'yale-avalon:paris763',
    editionDate: '1763-02-10; Yale Avalon transcript printed from the copy',
    locatorScheme: 'article',
    rights: usPublicDomain(
      'Treaty of Paris (1763), Articles IV, X, and XI selected from the historical treaty text; Yale Avalon navigation and page furniture excluded.',
      'https://avalon.law.yale.edu/18th_century/paris763.asp',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-nara-treaty-paris-1783': audited('pass-treaty-paris-1783', {
    workTitle: 'The Definitive Treaty of Peace 1783',
    author: 'Great Britain and the United States of America',
    provider: 'national-archives-original-and-transcript',
    canonicalUrl: 'https://www.archives.gov/milestone-documents/treaty-of-paris',
    canonicalId: 'nara:RG11-treaty-of-paris-1783',
    editionDate: '1783-09-03; National Archives transcript of signed originals in Record Group 11',
    locatorScheme: 'article / signed original',
    collationUrls: ['https://catalog.archives.gov/id/299805'],
    rights: usPublicDomain(
      'Treaty of Paris (3 September 1783), Articles I, IV, and VI–VIII; historical treaty text from the signed originals in General Records of the United States Government, Record Group 11. Modern National Archives framing is excluded.',
      'https://www.archives.gov/milestone-documents/treaty-of-paris',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-loc-continental-congress-resolves': audited('pass-first-continental-resolves-1774', {
    workTitle: 'Declaration and Resolves of the First Continental Congress',
    author: 'Continental Congress',
    editor: 'Worthington Chauncey Ford',
    provider: 'library-of-congress-scan-backed',
    canonicalUrl: 'https://www.loc.gov/item/05000059/',
    canonicalId: 'lccn:05000059:volume-1',
    editionDate: '1774 proceedings; Journals of the Continental Congress, volume I (1904), pages 63–73',
    locatorScheme: 'journal volume / page / resolution',
    collationUrls: [
      'https://tile.loc.gov/storage-services/service/ll/llscd/lljc001/lljc001.pdf',
      'https://avalon.law.yale.edu/18th_century/resolves.asp'
    ],
    rights: usPublicDomain(
      'Declaration and Resolves of the First Continental Congress (14 October 1774), in Journals of the Continental Congress, volume I (1904), pages 63–73; historical text only. Modern provider material is excluded.',
      'https://www.loc.gov/item/05000059/',
      '2026-07-20'
    )
  }, '2026-07-20'),
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
  'src-wikisource-sieyes-third-estate': audited('pass-sieyes-third-estate', {
    author: 'Emmanuel-Joseph Sieyès',
    provider: 'wikisource-scan-backed',
    canonicalUrl: 'https://fr.wikisource.org/wiki/Qu%E2%80%99est-ce_que_le_tiers_%C3%A9tat_%3F',
    canonicalId: 'wikisource-fr:Qu’est-ce_que_le_tiers_état',
    editionDate: '1789 text; Société de l’Histoire de la Révolution Française edition, 1888, pages 27–29',
    locatorScheme: 'chapter / scan page',
    collationUrls: ['https://commons.wikimedia.org/wiki/File:Siey%C3%A8s-Qu%27est_ce_que_le_tiers_%C3%A9tat-1888.djvu'],
    rights: usPublicDomain(
      'Emmanuel-Joseph Sieyès, Qu’est-ce que le tiers état ? (1789); historical French text collated to the 1888 scan-backed edition.',
      'https://commons.wikimedia.org/wiki/File:Siey%C3%A8s-Qu%27est_ce_que_le_tiers_%C3%A9tat-1888.djvu',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-wikisource-desmoulins-lanterne': audited('pass-desmoulins-lanterne', {
    author: 'Camille Desmoulins',
    provider: 'wikisource-scan-backed',
    canonicalUrl: 'https://fr.wikisource.org/wiki/%C5%92uvres_de_Camille_Desmoulins/Tome_II/Le_Discours_de_la_Lanterne',
    canonicalId: 'wikisource-fr:Oeuvres_de_Camille_Desmoulins/Tome_II/Le_Discours_de_la_Lanterne',
    editionDate: '1789 text; Bibliothèque nationale edition, 1880, volume II, pages 7–62',
    locatorScheme: 'work / paragraph / scan page',
    collationUrls: ['https://commons.wikimedia.org/wiki/File:Oeuvres_de_Camille_Desmoulins_-_Tome_1.djvu'],
    rights: usPublicDomain(
      'Camille Desmoulins, Le Discours de la Lanterne aux Parisiens (1789); historical French text collated to the 1880 scan-backed edition.',
      'https://commons.wikimedia.org/wiki/File:Oeuvres_de_Camille_Desmoulins_-_Tome_1.djvu',
      '2026-07-20'
    )
  }, '2026-07-20'),
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
  'src-legifrance-constitution-year-viii': audited('pass-constitution-year-viii', {
    workTitle: 'Constitution du 22 frimaire an VIII',
    author: 'French Republic',
    provider: 'legifrance-open-data',
    canonicalUrl: 'https://www.legifrance.gouv.fr/jorf/id/JORFTEXT000000571354',
    canonicalId: 'legifrance:JORFTEXT000000571354',
    editionDate: '1799-12-13; initial Légifrance text, collated to Archives nationales AE/I/29/4',
    locatorScheme: 'title / article / proclamation',
    collationUrls: ['https://www.elysee.fr/la-presidence/la-constitution-du-22-frimaire-an-viii-13-decembre-1799'],
    rights: openLicense(
      'Licence Ouverte / Open Licence 2.0',
      'Constitution du 22 frimaire an VIII, Légifrance, JORFTEXT000000571354; selected historical text collated to the Élysée transcript of Archives nationales AE/I/29/4.',
      'https://www.legifrance.gouv.fr/contenu/pied-de-page/open-data-et-api',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-wikisource-code-civil-1804': audited('pass-code-civil-1804', {
    workTitle: 'Code civil des Français',
    author: 'French Republic',
    provider: 'wikisource-scan-backed',
    canonicalUrl: 'https://fr.wikisource.org/wiki/Code_civil_des_Fran%C3%A7ais_1804/Texte_entier',
    canonicalId: 'wikisource-fr:Code_civil_des_Francais_1804',
    editionDate: '1804 original official edition, Imprimerie de la République',
    locatorScheme: 'book / title / article / scan page',
    collationUrls: ['https://fr.wikisource.org/wiki/Livre:Code_civil_des_Fran%C3%A7ais,_1804.djvu'],
    rights: usPublicDomain(
      'Code civil des Français (1804), original official French edition; selected historical text collated to the scan-backed Wikisource transcription.',
      'https://fr.wikisource.org/wiki/Livre:Code_civil_des_Fran%C3%A7ais,_1804.djvu',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-loc-anderson-napoleon-deposition': audited('pass-senate-deposition-napoleon-1814', {
    workTitle: 'The Constitutions and Other Select Documents Illustrative of the History of France, 1789–1901',
    author: 'French Conservative Senate',
    editor: 'Frank Maloy Anderson',
    translator: 'Translation printed in Anderson; individual translator not stated',
    provider: 'library-of-congress-scan-collated',
    canonicalUrl: 'https://www.loc.gov/item/04025396/',
    canonicalId: 'lccn:04025396',
    editionDate: '1814 decree; Anderson edition, 1904, pages 444–446',
    locatorScheme: 'document / date / print page',
    collationUrls: ['https://www.napoleon-series.org/research/government/legislation/c_restoration.html'],
    rights: usPublicDomain(
      'French Conservative Senate, Decree for Deposing Napoleon (3–4 April 1814), English text printed in Frank Maloy Anderson’s 1904 document collection; historical translation only.',
      'https://www.loc.gov/item/04025396/',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-wienbibliothek-vienna-final-act': audited('pass-congress-vienna-final-act-1815', {
    workTitle: 'Acte du Congrès de Vienne du 9 Juin 1815, avec ses annexes',
    author: 'Congress of Vienna plenipotentiaries',
    provider: 'wienbibliothek-official-scan',
    canonicalUrl: 'https://digital.wienbibliothek.at/wbrobv/content/titleinfo/2293309',
    canonicalId: 'urn:nbn:at:AT-WBR-125303',
    editionDate: '1815 official edition, Imprimerie Impériale et Royale, Vienna',
    locatorScheme: 'preamble / article / print page',
    rights: rights(
      'public-domain-confirmed',
      ['WORLDWIDE'],
      'Public Domain Mark 1.0',
      'Acte du Congrès de Vienne du 9 Juin 1815, avec ses annexes. Wienbibliothek im Rathaus, C-1951, urn:nbn:at:AT-WBR-125303.',
      'https://digital.wienbibliothek.at/wbrobv/content/titleinfo/2293309',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-elysee-republic-constitution-1793': audited('pass-republic-constitution-1793', {
    author: 'National Convention',
    provider: 'elysee-primary-document',
    canonicalUrl: 'https://www.elysee.fr/la-presidence/la-constitution-du-24-juin-1793',
    canonicalId: 'archives-nationales:AE-II-3701',
    editionDate: '1792 founding decrees and Constitution of 24 June 1793; Élysée institutional transcript',
    locatorScheme: 'decree / date / article',
    collationUrls: [
      'https://francearchives.gouv.fr/facomponent/82abfae590ecb38704b15efda51ed7436019757a',
      'https://www.assemblee-nationale.fr/dyn/histoire-et-patrimoine/revolution-francaise/la-convention-nationale-et-la-fin-de-la-royaute'
    ],
    rights: usPublicDomain(
      'National Convention founding decrees (1792) and Constitution of 24 June 1793; historical French texts only, with modern page material excluded.',
      'https://www.elysee.fr/la-presidence/la-constitution-du-24-juin-1793',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-gutenberg-robespierre-political-works': audited('pass-robespierre-virtue-terror', {
    author: 'Maximilien Robespierre',
    editor: 'Charles Vellay',
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/29887',
    canonicalId: 'gutenberg:29887',
    editionDate: '1910 Charles Vellay modernized-French edition; Project Gutenberg eBook 29887, updated 2021-01-05',
    locatorScheme: 'speech / date / paragraph',
    collationUrls: ['https://www.assemblee-nationale.fr/dyn/histoire-et-patrimoine/revolution-francaise/la-terreur'],
    rights: usPublicDomain(
      'Maximilien Robespierre, report on the principles of political morality, 18 pluviôse an II (5 February 1794), in Charles Vellay’s 1910 edition; historical speech text only.',
      'https://www.gutenberg.org/ebooks/29887',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-moniteur-thermidor-convention': audited('pass-thermidor-convention', {
    author: 'Gazette nationale ou Le Moniteur universel; National Convention speakers',
    provider: 'internet-archive-scan-backed',
    canonicalUrl: 'https://archive.org/details/reimpressiondela21unse',
    canonicalId: 'internet-archive:reimpressiondela21unse',
    editionDate: '1794 report; Réimpression de l’ancien Moniteur, volume XXI (1842), pages 335–336',
    locatorScheme: 'session / speaker / volume page',
    collationUrls: [
      'https://archives-parlementaires.persee.fr/prt/40a46366-e003-4702-95a3-a268ae417d9a',
      'https://iiif.persee.fr/b0e2cf11-597c-427d-8ac7-68bcc0acf13b/dee0dced-8f32-4f3a-aeb7-5ba3c433625e/res/pdf'
    ],
    rights: usPublicDomain(
      'Gazette nationale ou Le Moniteur universel report of the National Convention proceedings of 9 Thermidor an II, reprinted in 1842; historical report text only. Modern Archives parlementaires material is collation-only.',
      'https://archive.org/details/reimpressiondela21unse',
      '2026-07-20'
    )
  }, '2026-07-20'),
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
  'src-creole-patriote-insurgent-letter': audited('pass-haiti-insurgent-letter-1792', {
    workTitle: 'Lettre originale des chefs des Nègres révoltés',
    author: 'Jean-François Papillon, Georges Biassou, and Charles Bélair',
    provider: 'persee-scan-transcription-collation',
    canonicalUrl: 'https://www.persee.fr/doc/ahrf_0003-4436_1998_num_311_1_2095',
    canonicalId: 'persee:ahrf_0003-4436_1998_num_311_1_2095',
    editionDate: 'July 1792 letter; published in Le Créole Patriote no. 282, 9 February 1793; scan-backed transcription pages 133–135',
    locatorScheme: 'letter / newspaper issue / scan page',
    rights: usPublicDomain(
      'Jean-François Papillon, Georges Biassou, and Charles Bélair, letter of July 1792; historical letter text only. The modern Persée article, notes, and interpretation are excluded.',
      'https://www.persee.fr/doc/ahrf_0003-4436_1998_num_311_1_2095',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-jcb-sonthonax-emancipation': audited('pass-sonthonax-emancipation-1793', {
    workTitle: 'Proclamation au nom de la République',
    author: 'Léger-Félicité Sonthonax',
    provider: 'internet-archive-jcb-scan-backed',
    canonicalUrl: 'https://archive.org/details/proclamationauno00sont',
    canonicalId: 'internet-archive:proclamationauno00sont',
    editionDate: '1793-08-29; Cap-Français, P. Gatineau contemporary six-page broadside, John Carter Brown Library',
    locatorScheme: 'broadside page / article',
    collationUrls: ['https://mjp.univ-perp.fr/constit/ht1793.htm'],
    rights: usPublicDomain(
      'Léger-Félicité Sonthonax, Proclamation au nom de la République (29 August 1793); historical broadside text from the John Carter Brown Library scan.',
      'https://archive.org/details/proclamationauno00sont',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-moniteur-abolition-1794': audited('pass-convention-abolition-1794', {
    workTitle: 'Réimpression de l’ancien Moniteur, Convention nationale, 16 pluviôse an II',
    author: 'Gazette nationale ou Le Moniteur universel; National Convention speakers',
    provider: 'internet-archive-scan-backed',
    canonicalUrl: 'https://archive.org/details/reimpressiondela19unse',
    canonicalId: 'internet-archive:reimpressiondela19unse',
    editionDate: '4 February 1794 proceedings; nineteenth-century Réimpression de l’ancien Moniteur scan',
    locatorScheme: 'session / speaker / volume page',
    collationUrls: [
      'https://www.persee.fr/doc/arcpa_0000-0000_1962_num_84_1_34717_t1_0276_0000_3',
      'https://www.persee.fr/doc/arcpa_0000-0000_1962_num_84_1_34717_t1_0283_0000_9',
      'https://www.persee.fr/doc/arcpa_0000-0000_1962_num_84_1_34717_t1_0284_0000_5',
      'https://catalogue.bnf.fr/ark:/12148/cb311819153'
    ],
    rights: usPublicDomain(
      'Gazette nationale ou Le Moniteur universel report of the National Convention proceedings of 16 pluviôse an II (4 February 1794); historical proceedings and decree only. Modern Archives parlementaires apparatus is collation-only.',
      'https://archive.org/details/reimpressiondela19unse',
      '2026-07-20'
    )
  }, '2026-07-20'),
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
  'src-candidate-venezuela-declaration': audited('pass-venezuela-declaration', {
    author: 'Venezuelan Congress',
    provider: 'wikisource-scan-collation',
    canonicalUrl: 'https://es.wikisource.org/wiki/Acta_de_la_Declaraci%C3%B3n_de_Independencia_de_Venezuela',
    canonicalId: 'wikisource-es:Acta_de_la_Declaración_de_Independencia_de_Venezuela',
    editionDate: '1811-07-05; original Spanish historical transcription',
    locatorScheme: 'document / paragraph',
    rights: usPublicDomain(
      'Acta de la Declaración de Independencia de Venezuela (1811); original Spanish historical text only.',
      'https://es.wikisource.org/wiki/Acta_de_la_Declaraci%C3%B3n_de_Independencia_de_Venezuela'
    )
  }),
  'src-candidate-jamaica-letter': audited('pass-jamaica-letter', {
    author: 'Simón Bolívar',
    provider: 'wikisource-primary-text-collation',
    canonicalUrl: 'https://es.wikisource.org/wiki/Carta_de_Jamaica',
    canonicalId: 'wikisource-es:Carta_de_Jamaica',
    editionDate: '1815-09-06; original Spanish text collated from the Lecuna copy',
    locatorScheme: 'letter / paragraph',
    rights: usPublicDomain(
      'Simón Bolívar, Carta de Jamaica (1815); original Spanish historical text only.',
      'https://es.wikisource.org/wiki/Carta_de_Jamaica'
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
  'src-wikisource-ardouin-haiti-recognition-1825': audited('pass-haiti-recognition-1825', {
    workTitle: 'Études sur l’histoire d’Haïti, tome 9',
    author: 'Beaubrun Ardouin; documents by Charles X and Jean-Pierre Boyer',
    provider: 'wikisource-scan-backed-document-compilation',
    canonicalUrl: 'https://fr.wikisource.org/wiki/%C3%89tudes_sur_l%E2%80%99histoire_d%E2%80%99Ha%C3%AFti/Tome_9/4.7',
    canonicalId: 'wikisource-fr:Etudes_sur_l_histoire_d_Haiti/Tome_9/4.7',
    editionDate: '1825 documents; Ardouin edition, 1853, tome 9, pages 333–391',
    locatorScheme: 'chapter / document / scan page',
    collationUrls: [
      'https://fr.wikisource.org/wiki/Livre:Ardouin_-_%C3%89tude_sur_l%E2%80%99histoire_d%E2%80%99Ha%C3%AFti,_tome_9.djvu',
      'https://memoire-esclavage.org/lordonnance-de-charles-x-sur-lindemnite-dhaiti'
    ],
    rights: usPublicDomain(
      'Charles X, Ordonnance du 17 avril 1825, and Jean-Pierre Boyer, proclamation of 11 July 1825, transcribed in Beaubrun Ardouin, Études sur l’histoire d’Haïti, tome 9 (1853); historical document texts only. Ardouin’s narrative, modern institutional commentary, and provider material are excluded.',
      'https://fr.wikisource.org/wiki/Livre:Ardouin_-_%C3%89tude_sur_l%E2%80%99histoire_d%E2%80%99Ha%C3%AFti,_tome_9.djvu',
      '2026-07-20'
    )
  }, '2026-07-20'),
  'src-candidate-communist-manifesto': audited('pass-communist-manifesto', {
    translator: 'Samuel Moore',
    provider: 'project-gutenberg-scan-backed',
    canonicalUrl: 'https://www.gutenberg.org/ebooks/31193',
    canonicalId: 'gutenberg:31193',
    editionDate: '1888 English edition revised by Friedrich Engels; Project Gutenberg eBook 31193, updated 2021-01-06',
    locatorScheme: 'section / paragraph',
    rights: usPublicDomain(
      'Karl Marx and Friedrich Engels, Manifesto of the Communist Party, translated by Samuel Moore and revised by Friedrich Engels (1888); historical text only.',
      'https://www.gutenberg.org/ebooks/31193'
    )
  }),
  'src-legifrance-french-abolition-1848': audited('pass-french-abolition-1848', {
    provider: 'legifrance-open-data',
    canonicalUrl: 'https://www.legifrance.gouv.fr/loda/id/JORFTEXT000000295898',
    canonicalId: 'legifrance:JORFTEXT000000295898',
    editionDate: '1848-04-27; current Légifrance transcription',
    locatorScheme: 'preamble / article',
    rights: openLicense(
      'Licence Ouverte / Open Licence 2.0',
      'Décret du 27 avril 1848 relatif à l’abolition de l’esclavage dans les colonies et possessions françaises; Légifrance, JORFTEXT000000295898.',
      'https://www.legifrance.gouv.fr/contenu/pied-de-page/open-data-et-api'
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
  }),
  'src-candidate-somerset-judgment': audited('pass-somerset', {
    author: 'Court of King’s Bench; opinion by Lord Mansfield',
    provider: 'university-of-nebraska-oer-scan-collated',
    canonicalUrl: 'https://teachinglegalhistory.unl.edu/s/oer/item/1372',
    canonicalId: 'english-reports:98:499',
    editionDate: '1772-06-22 judgment; Lofft 1 / 98 Eng. Rep. 499 historical report',
    locatorScheme: 'report / speaker / paragraph',
    collationUrls: ['https://www.commonlii.org/int/cases/EngR/1772/57.pdf'],
    rights: usPublicDomain(
      'Somerset v Stewart (1772), Lord Mansfield’s opinion; historical report text only, collated to 98 Eng. Rep. 499.',
      'https://www.commonlii.org/int/cases/EngR/1772/57.pdf'
    )
  }),
  'src-uk-slave-trade-act-1807': audited('pass-uk-slave-trade-act', {
    author: 'Parliament of the United Kingdom',
    provider: 'university-of-nebraska-oer-scan-collated',
    canonicalUrl: 'https://teachinglegalhistory.unl.edu/s/oer/item/1312',
    canonicalId: '47-geo-3-sess-1-c-36',
    editionDate: '1807-03-25; 1807 King’s Printer statute text',
    locatorScheme: 'act / section',
    collationUrls: ['https://www.loc.gov/exhibitions/two-georges/about-this-exhibition/president-and-king/the-international-slave-trade/an-act-for-the-abolition-of-the-slave-trade/'],
    rights: usPublicDomain(
      'An Act for the Abolition of the Slave Trade, 47 Geo. 3 Sess. 1 c. 36 (1807); historical statute text only.',
      'https://www.loc.gov/exhibitions/two-georges/about-this-exhibition/president-and-king/the-international-slave-trade/an-act-for-the-abolition-of-the-slave-trade/'
    )
  }),
  'src-us-importation-act-1807': audited('pass-us-importation-act', {
    author: 'United States Congress',
    provider: 'library-of-congress-statutes-at-large',
    canonicalUrl: 'https://www.loc.gov/resource/llsalvol.llsal_002/?sp=464',
    canonicalId: '2-stat-426-public-law-9-22',
    editionDate: '1807-03-02; United States Statutes at Large, volume 2',
    locatorScheme: 'act / section / scan page',
    collationUrls: ['https://teachinglegalhistory.unl.edu/s/oer/item/1314'],
    rights: usPublicDomain(
      'Act Prohibiting Importation of Slaves, 2 Stat. 426 (1807); federal statute text only. Credit: Library of Congress.',
      'https://www.loc.gov/resource/llsalvol.llsal_002/?sp=464'
    )
  }),
  'src-uk-slavery-abolition-act-1833': audited('pass-slavery-abolition-1833', {
    author: 'Parliament of the United Kingdom',
    provider: 'irish-statute-book-open-data',
    canonicalUrl: 'https://www.irishstatutebook.ie/eli/1833/act/73/enacted/en/html',
    canonicalId: '3-and-4-will-4-c-73',
    editionDate: '1833-08-28; enacted historical text',
    locatorScheme: 'act / section',
    rights: openLicense(
      'Oireachtas (Open Data) PSI Licence incorporating Creative Commons Attribution 4.0 International',
      'Slavery Abolition Act 1833, 3 & 4 Will. 4 c. 73. Source: Irish Statute Book, produced by the Office of the Attorney General.',
      'https://www.irishstatutebook.ie/eli/open-data.html'
    )
  })
});
