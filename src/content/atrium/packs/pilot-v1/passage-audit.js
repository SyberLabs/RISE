import { ATRIUM_PILOT_INTEGRITY } from './integrity.js';

const openLicensed = new Set(['pass-rights-man', 'pass-constitution-year-viii', 'pass-french-abolition-1848', 'pass-slavery-abolition-1833', 'pass-commons-apprenticeship-debate-1838', 'pass-barbados-apprenticeship-termination-1838']);
const passage = (id, canonicalLocator) => ({
  canonicalLocator,
  estimatedWords: ATRIUM_PILOT_INTEGRITY[id].words,
  payloadPath: './packs/pilot-v1/payloads.js#' + id,
  payloadChecksum: ATRIUM_PILOT_INTEGRITY[id].checksum,
  textVerified: true,
  normalization: 'Whitespace and quotation marks normalized; historical spelling retained; provider notes, apparatus, and page furniture removed.',
  rightsStatus: openLicensed.has(id) ? 'open-license-confirmed' : 'public-domain-confirmed',
  status: 'publishable'
});

export const ATRIUM_PASSAGE_AUDITS = Object.freeze({
  'pass-commons-apprenticeship-debate-1838': {
    ...passage('pass-commons-apprenticeship-debate-1838', 'HC Deb 29 March 1838, volume 42, columns 41–47 and 66–67; Strickland motion and selected argument with Grey response'),
    normalization: 'Speaker labels and selected complete argument units retained; whitespace, quotation marks, capitalization, and punctuation normalized. Column markers, links, navigation, and provider furniture are excluded. Strickland’s case and Grey’s opposing “compact” argument remain separately attributed.'
  },
  'pass-barbados-apprenticeship-termination-1838': {
    ...passage('pass-barbados-apprenticeship-termination-1838', 'Colonial Office CO 28/125, pages 58–59, Barbados termination-act abstract, title and Clauses 1–3 selected'),
    normalization: 'The title and complete substantive abstracts of Clauses 1–2 are retained; Clause 3 is retained only through the legible support obligation. “Novr” is expanded to “November,” capitalization and punctuation are normalized, and the illegible penalty, later provisos, certifications, pagination, and provider furniture are excluded.'
  },
  'pass-tucuman-independence-act-1816': {
    ...passage('pass-tucuman-independence-act-1816', 'Congress of Tucumán, 9 July 1816 act with the 19 July phrase “y de toda otra dominación extranjera” incorporated'),
    normalization: 'Whitespace, capitalization, punctuation, and accents normalized across Argentine government transcripts; the 19 July amendment is incorporated and disclosed. Signatures, commemorative headings, modern captions, and layout are excluded.'
  },
  'pass-belgrano-government-unsettled-1816': {
    ...passage('pass-belgrano-government-unsettled-1816', 'Archivo General de la Nación Argentina, Documentos Escritos 07-3493, Belgrano to Pueyrredón, 12 July 1816, selected continuous substantive paragraphs'),
    normalization: 'Selected continuous paragraphs begin with Belgrano’s diagnosis after the declaration and end with the army’s material dependence. Expanded abbreviations, whitespace, accents, and obvious transcript punctuation normalized against the facsimile; ministry headings, description, appointment preface, later demand for governing rules, and closing are excluded.'
  },
  'pass-tucuman-order-decree-1816': {
    ...passage('pass-tucuman-order-decree-1816', 'Congress of Tucumán, Manifiesto del Congreso a los Pueblos, decree of 1 August 1816, complete'),
    normalization: 'Complete decree retained; whitespace, capitalization, punctuation, and accents normalized. Museum description, image captions, modern biographical material, and provider furniture are excluded.'
  },
  'pass-plan-iguala-1821': {
    ...passage('pass-plan-iguala-1821', 'Plan de Iguala, 21 February 1821, preamble and selected complete bases 1–5, 8–9, 11–14, 16, 20, and 23'),
    normalization: 'The institutional transcript’s “rama ea igual” is corrected to the scan-supported “rama es igual.” Selected numbered bases retain their original numbers so omissions remain visible; whitespace, accents, and punctuation normalized; institutional headers and modern layout excluded.'
  },
  'pass-mexico-independence-act-1821': {
    ...passage('pass-mexico-independence-act-1821', 'Acta de Independencia del Imperio Mexicano, 28 September 1821, complete substantive declaration'),
    normalization: 'Complete substantive declaration retained; whitespace and punctuation normalized; historical “setiembre” and “inenagenables” retained. INEHRM headers, pagination, and the signature list are excluded.'
  },
  'pass-peru-lima-independence-act-1821': {
    ...passage('pass-peru-lima-independence-act-1821', 'Cabildo of Lima, act of 15 July 1821, complete substantive text, Libro de Cabildo 45'),
    normalization: 'Complete substantive act retained; whitespace and punctuation normalized. The abbreviated signature notice is retained as transmitted; modern introduction, images, captions, and site furniture are excluded.'
  },
  'pass-peru-protector-decree-1821': {
    ...passage('pass-peru-protector-decree-1821', 'José de San Martín, decree of 3 August 1821, selected complete paragraphs and Articles 1 and 7'),
    normalization: 'Complete selected paragraphs and numbered articles retained; omitted ministerial appointments remain visible through original article numbers. Whitespace, punctuation, and accents normalized; Congress headers, pagination, and layout excluded.'
  },
  'pass-brazil-manifesto-peoples-1822': {
    ...passage('pass-brazil-manifesto-peoples-1822', 'Gazeta do Rio, supplement 94 (6 August 1822), print pages 247–248, Manifesto of 1 August, selected complete paragraphs'),
    normalization: 'Selected complete paragraphs manually transcribed and visually collated to the Biblioteca Nacional scan. Typography, capitalization, accents, and punctuation are normalized for legibility while Portuguese wording is retained; masthead, stamps, line-break hyphenation, layout, and omitted paragraphs are excluded.'
  },
  'pass-brazil-council-session-1822': {
    ...passage('pass-brazil-council-session-1822', 'Council of State, session 13, 2 September 1822, complete archival extract exhibited by the Chamber of Deputies'),
    normalization: 'Complete exhibited minute extract retained; quotation marks, whitespace, capitalization, and punctuation normalized. Modern exhibition captions, interpretation, images, and layout are excluded.'
  },
  'pass-cachoeira-adhesion-letter-1822': {
    ...passage('pass-cachoeira-adhesion-letter-1822', 'Municipal chamber of Cachoeira to the Prince Regent, 28 June 1822, quoted substantive paragraphs'),
    normalization: 'Quoted historical paragraphs retained; obvious modern scan OCR spacing, accents, punctuation, and “hora” corrected to contextually certain “honra.” Modern dissertation analysis, footnotes, sic markers, and layout are excluded.'
  },
  'pass-epicurus-gods-death': passage('pass-epicurus-gods-death', 'Diogenes Laertius X.122-130, Letter to Menoeceus, selected'),
  'pass-sextus-skeptical-way': passage('pass-sextus-skeptical-way', 'Sextus Empiricus, Pyrrhonic Sketches I.1-15, selected'),
  'pass-cicero-academic': passage('pass-cicero-academic', 'Cicero, Academic Questions II.3, selected'),
  'pass-communist-manifesto': passage('pass-communist-manifesto', 'Marx and Engels, Manifesto of the Communist Party, Part I, opening historical argument'),
  'pass-rousseau-association': passage('pass-rousseau-association', 'Rousseau, The Social Contract, trans. G. D. H. Cole (1920), Book I, Chapter VI, selected'),
  'pass-vermont-constitution-1777': passage('pass-vermont-constitution-1777', 'Constitution of Vermont (1777), Chapter I, Articles I, III, VI, and VIII; Chapter II, Section VI'),
  'pass-articles-confederation-1777': passage('pass-articles-confederation-1777', 'Articles of Confederation, adopted 15 November 1777, Articles I–V, selected complete clauses'),
  'pass-us-bill-rights-proposal-1789': passage('pass-us-bill-rights-proposal-1789', 'Engrossed Bill of Rights, 25 September 1789, preamble and proposed Articles I–XII'),
  'pass-boston-massacre-crown-evidence': {
    ...passage('pass-boston-massacre-crown-evidence', 'The King v. Preston, anonymous summary of Crown evidence, 24–25 October 1770; Ebenezer Hinkley and Peter Cunningham testimony'),
    normalization: 'Witness headings and paragraph boundaries retained; whitespace, apostrophes, and obvious transcript spacing normalized; historical spelling and uncertainty retained. Founders Online notes, links, cross-references, corrections, and modern editorial apparatus excluded.'
  },
  'pass-boston-massacre-defense-evidence': {
    ...passage('pass-boston-massacre-defense-evidence', 'The King v. Preston, anonymous summary of defense evidence, 25–27 October 1770; Newton Prince and James Woodall testimony'),
    normalization: 'Witness headings and paragraph boundaries retained; whitespace, apostrophes, and obvious transcript spacing normalized; historical racial description, spelling, and uncertainty retained. Founders Online notes, links, cross-references, and modern editorial apparatus excluded.'
  },
  'pass-boston-tea-colonial-newspaper-1773': {
    ...passage('pass-boston-tea-colonial-newspaper-1773', 'Massachusetts and Boston Weekly, 23 December 1773, complete surviving extract, Colonial Office 5/91'),
    normalization: 'The institutional transcript’s damaged interval is explicitly marked. Bracketed vocabulary glosses, modern expansions, teaching questions, punctuation artifacts, and provider furniture are excluded; historical spelling and the newspaper’s political framing are retained.'
  },
  'pass-boston-tea-leslie-letter-1773': {
    ...passage('pass-boston-tea-leslie-letter-1773', 'Alexander Leslie to Viscount Barrington, 17 December 1773, complete letter, War Office 40/1'),
    normalization: 'Paragraphs and signature retained; whitespace and punctuation normalized; modern bracketed expansions, glossary notes, teaching questions, and provider furniture excluded; historical spelling retained.'
  },
  'pass-maillard-womens-march-deposition': {
    ...passage('pass-maillard-womens-march-deposition', 'Mémoires de Bailly, volume III (1822), Note B, Maillard deposition on 5–6 October, print pages 407–408, selected continuous paragraphs'),
    normalization: 'Whitespace, apostrophes, punctuation, accents, and line-break hyphenation normalized against the scan-backed OCR; the obvious OCR reading “méditaient” is corrected to “méritaient.” Maillard’s third-person deposition form and self-exculpatory claims are retained; Bailly’s surrounding narrative and scan furniture are excluded.'
  },
  'pass-assembly-womens-march-1789': {
    ...passage('pass-assembly-womens-march-1789', 'Archives parlementaires, Première série, Tome IX, night session of 5 October 1789, print page 348, complete incident'),
    normalization: 'Speaker labels and complete incident retained; whitespace, punctuation, accents, and line-break hyphenation normalized; Persée metadata, modern headings, navigation, and provider furniture excluded.'
  },
  'pass-french-abolition-1848': passage('pass-french-abolition-1848', 'Decret du 27 avril 1848, preamble and Articles 1-9'),
  'pass-somerset': passage('pass-somerset', 'Somerset v Stewart, Lofft 1 / 98 Eng. Rep. 499, Lord Mansfield’s final opinion'),
  'pass-uk-slave-trade-act': passage('pass-uk-slave-trade-act', 'Slave Trade Act 1807, 47 Geo. 3 Sess. 1 c. 36, sections I–II'),
  'pass-us-importation-act': passage('pass-us-importation-act', 'Act Prohibiting Importation of Slaves, 2 Stat. 426, sections 1–4'),
  'pass-slavery-abolition-1833': passage('pass-slavery-abolition-1833', 'Slavery Abolition Act 1833, 3 & 4 Will. 4 c. 73, sections I–II and XXIV preamble'),
  'pass-anaximander-fragment': passage('pass-anaximander-fragment', 'Burnet, Early Greek Philosophy, §§13–14; testimonia and explanatory context'),
  'pass-heraclitus-logos': passage('pass-heraclitus-logos', 'Burnet, Early Greek Philosophy, §65; selected fragments 1–22'),
  'pass-parmenides-being': passage('pass-parmenides-being', 'Burnet, Early Greek Philosophy, §84; fragments 4–8'),
  'pass-empedocles-roots': passage('pass-empedocles-roots', 'Burnet, Early Greek Philosophy, §106; selected fragments 6–17'),
  'pass-democritus-atoms': passage('pass-democritus-atoms', 'Burnet, Early Greek Philosophy, §§173–175; Aristotle and Theophrastus testimonia'),
  'pass-protagoras-measure': passage('pass-protagoras-measure', 'Plato, Theaetetus 152a–153d'),
  'pass-socrates-apology': passage('pass-socrates-apology', 'Plato, Apology 38a–39b'),
  'pass-plato-recollection': passage('pass-plato-recollection', 'Plato, Meno 80d–81d'),
  'pass-plato-divided-line': passage('pass-plato-divided-line', 'Plato, Republic VI 509d–511e'),
  'pass-plato-cave': passage('pass-plato-cave', 'Plato, Republic VII 514a–515d'),
  'pass-plato-forms': passage('pass-plato-forms', 'Plato, Phaedo 74a–75c'),
  'pass-plato-cosmos': passage('pass-plato-cosmos', 'Plato, Timaeus 27d–29d'),
  'pass-aristotle-first-causes': passage('pass-aristotle-first-causes', 'Aristotle, Metaphysics I.3, 983a24–984b22'),
  'pass-aristotle-human-good': passage('pass-aristotle-human-good', 'Aristotle, Nicomachean Ethics I.7, 1097b22–1098a20'),
  'pass-aristotle-substance': passage('pass-aristotle-substance', 'Aristotle, Metaphysics VII.3, 1028b33–1029a30'),
  'pass-aristotle-soul': passage('pass-aristotle-soul', 'Aristotle, De Anima II.1, 412a3–412b9'),
  'pass-epictetus-control': passage('pass-epictetus-control', 'Epictetus, Encheiridion 1–2'),
  'pass-seneca-inner-spirit': passage('pass-seneca-inner-spirit', 'Seneca, Moral Letters 41.1–5'),
  'pass-marcus-morning': passage('pass-marcus-morning', 'Marcus Aurelius, Meditations II.1–5'),
  'pass-philo-creation': passage('pass-philo-creation', 'Philo, On the Creation 16–22'),
  'pass-plotinus-beauty': passage('pass-plotinus-beauty', 'Plotinus, Ennead I.6.5, selected'),
  'pass-plotinus-hypostases': passage('pass-plotinus-hypostases', 'Plotinus, Ennead V.1.10–11'),
  'pass-porphyry-isagoge': passage('pass-porphyry-isagoge', 'Porphyry, Isagoge I and II, opening definition of genus, selected'),
  'pass-iamblichus-theurgy': passage('pass-iamblichus-theurgy', 'Iamblichus, On the Mysteries I.11, opening, and I.12'),
  'pass-proclus-propositions': passage('pass-proclus-propositions', 'Proclus, Elements of Theology, Propositions 1–4'),
  'pass-augustine-platonic-books': passage('pass-augustine-platonic-books', 'Augustine, Confessions VII.9.13–14'),
  'pass-dionysius-mystical': passage('pass-dionysius-mystical', 'Pseudo-Dionysius, Mystical Theology I.1–3'),
  'pass-boethius-eternity': passage('pass-boethius-eternity', 'Boethius, Consolation V, prose 6, opening argument'),
  'pass-franklin-war-finance-1766': {
    ...passage('pass-franklin-war-finance-1766', 'Franklin, Examination before the Committee of the Whole of the House of Commons, questions 2–4, 14–16, and 27–28'),
    normalization: 'Question numbers, editorial footnotes, and modern Founders Online apparatus excluded; whitespace and paragraph boundaries normalized; historical spelling, capitalization, and quantitative claims retained.'
  },
  'pass-watt-steam-principles-1769': {
    ...passage('pass-watt-steam-principles-1769', 'James Watt, British Patent No. 913, specification, selected Principles I–IV and VI–VII; official 1855 reprint pages 2–3'),
    normalization: 'The selected-principles heading identifies the omission of the long fifth claim. Whitespace, punctuation, capitalization, and obvious 1855 spelling variants normalized for legibility; technical wording retained; grant boilerplate, signatures, enrolment formula, marginal line numbers, and scan furniture excluded.'
  },
  'pass-arkwright-water-frame-system-1769': {
    ...passage('pass-arkwright-water-frame-system-1769', 'Edward Baines, History of the Cotton Manufacture in Great Britain (1835), Chapter IX, print pages 147 and 151–154, selected complete paragraphs and embedded patent extract'),
    normalization: 'Non-contiguous selection is disclosed by the canonical locator. Whitespace, capitalization, punctuation, line-break hyphenation, component lettering, and obvious typographic variants normalized; Baines’s argument and the quoted patent wording retained; biography, notes, plate furniture, and unrelated intervening narrative excluded.'
  },
  'pass-cartwright-power-loom-iteration-1785': {
    ...passage('pass-cartwright-power-loom-iteration-1785', 'Richard Marsden, Cotton Weaving (1895), Chapter III, print pages 61–63, selected'),
    normalization: 'Whitespace, paragraph boundaries, punctuation, component lettering, and line-break hyphenation normalized; Marsden’s critical language and the quoted 1785 specification retained; figure artwork, running heads, and scan furniture excluded.'
  },
  'pass-stockton-darlington-opening-1825': {
    ...passage('pass-stockton-darlington-opening-1825', 'Stockton and Darlington Railway company notice, 24 September 1825, and opening report, 15 October 1825, selected complete paragraphs'),
    normalization: 'Historical document headings and paragraph boundaries retained; whitespace, punctuation, ampersands, and obvious transcription errors normalized, including Witton Park and the duplicated article before coals; later ceremonial detail, Guardian headline, introduction, links, image, layout, and modern wrapper excluded.'
  },
  'pass-lexington-provincial-evidence-1775': {
    ...passage('pass-lexington-provincial-evidence-1775', 'Journals of the Continental Congress, volume II, print pages 26–29; Massachusetts Provincial Congress letter of 26 April 1775 and Elijah Saunderson deposition of 25 April 1775, selected'),
    normalization: 'Document headings supplied from the identified records; whitespace, paragraph boundaries, capitalization, and line-break hyphenation normalized; historical spelling and claims retained; Ford editorial notes, oath formula, signatures, running heads, and scan furniture excluded. The paired source unit preserves the Congress’s stated circulation purpose alongside the deposition.'
  },
  'pass-gage-lexington-report-1775': {
    ...passage('pass-gage-lexington-report-1775', 'Thomas Gage to the Earl of Dartmouth, 22 April 1775, opening two substantive paragraphs'),
    normalization: 'Heading and date supplied from the identified letter; whitespace, paragraph boundaries, punctuation, and rank hyphenation normalized; historical wording retained; the closing commendation, casualty-return notice, University of Houston navigation, and teaching wrapper excluded.'
  },
  'pass-washington-continental-orders-1775': {
    ...passage('pass-washington-continental-orders-1775', 'George Washington, General Orders, 4 July 1775, selected complete orders on stores, Continental service, discipline, sanitation, smallpox, firing, and intelligence'),
    normalization: 'Whitespace, paragraph boundaries, supplied bracket letters, abbreviations, and dash punctuation normalized for legibility; historical spelling retained; appointments, funeral arrangements, furlough limits, court-martial business, after-orders, Founders Online annotations, and editorial apparatus excluded.'
  },
  'pass-franco-american-alliance-1778': {
    ...passage('pass-franco-american-alliance-1778', 'Franco-American Treaty of Alliance, 6 February 1778, preamble and Articles 1–3, 8, and 11, historical English text'),
    normalization: 'State enumeration and plenipotentiary formula abridged in the preamble; article headings and paragraph boundaries regularized; historical English spelling retained; parallel French text, Articles 4–7, 9–10, 12–13, the separate secret act, signatures, and all modern Founders Online editorial material excluded.'
  },
  'pass-yorktown-capitulation-1781': {
    ...passage('pass-yorktown-capitulation-1781', 'Articles of Capitulation at Yorktown, 19 October 1781, preamble and Articles 1–4, 8, 10, 13, and 14, selected'),
    normalization: 'Honorifics in the preamble shortened; article labels, party names, punctuation, and grant responses regularized against the Founders Online transcript and Library of Congress Varick copy; historical wording retained. Articles 5–7, 9, and 11–12, modern editorial annotations, and repository furniture excluded.'
  },
  'pass-treaty-paris-1763': {
    ...passage('pass-treaty-paris-1763', 'Treaty of Paris (1763), Articles IV, X, and XI, selected'),
    normalization: 'Whitespace and paragraph boundaries normalized; article numbering and historical spelling retained; Yale Avalon navigation and page furniture excluded.'
  },
  'pass-treaty-paris-1783': {
    ...passage('pass-treaty-paris-1783', 'Treaty of Paris (1783), Articles I, IV, VI–VIII'),
    normalization: 'Whitespace, headings, paragraph boundaries, and obvious transcript spacing normalized; National Archives capitalization and historical wording retained; modern introduction, annotations, navigation, and image furniture excluded.'
  },
  'pass-stamp-act': passage('pass-stamp-act', 'Stamp Act 1765, preamble and opening duties through section I'),
  'pass-first-continental-resolves-1774': {
    ...passage('pass-first-continental-resolves-1774', 'Journals of the Continental Congress, volume I, 14 October 1774, pages 63–69; opening grievance and Resolves 1 and 4, selected'),
    normalization: 'Whitespace, paragraph boundaries, and heading capitalization normalized; historical spelling retained; Ford editorial footnotes and modern provider furniture excluded.'
  },
  'pass-common-sense': passage('pass-common-sense', 'Paine, Common Sense, introduction and opening discussion of government'),
  'pass-us-declaration': passage('pass-us-declaration', 'Declaration of Independence, opening through the early grievance catalogue'),
  'pass-rights-man': passage('pass-rights-man', 'Déclaration des droits de l’homme et du citoyen, preamble and Articles 1–10'),
  'pass-constitution-year-viii': {
    ...passage('pass-constitution-year-viii', 'Constitution du 22 frimaire an VIII, Articles 25, 28, 34, 41–42, and Consuls’ proclamation of 24 frimaire, selected'),
    normalization: 'Whitespace, headings, capitalization, apostrophes, and paragraph boundaries normalized; historical wording retained; Élysée navigation, captions, and modern page material excluded.'
  },
  'pass-code-civil-1804': {
    ...passage('pass-code-civil-1804', 'Code civil des Français (1804), Articles 2, 7–8, 212–217, 371–374, 544–545, and 1134–1135'),
    normalization: 'Whitespace, headings, capitalization, and paragraph boundaries normalized; original French spelling retained; Wikisource navigation, transclusion furniture, and modern page material excluded.'
  },
  'pass-senate-deposition-napoleon-1814': {
    ...passage('pass-senate-deposition-napoleon-1814', 'French Conservative Senate, Decree for Deposing Napoleon, 3–4 April 1814, selected; Anderson (1904), pages 444–446'),
    normalization: 'Whitespace and paragraph boundaries normalized; Anderson’s historical English translation retained; modern Napoleon Series framing and page furniture excluded.'
  },
  'pass-congress-vienna-final-act-1815': {
    ...passage('pass-congress-vienna-final-act-1815', 'Final Act of the Congress of Vienna, 9 June 1815, preamble and Articles I, CVIII–CIX, selected'),
    normalization: 'Whitespace, headings, apostrophes, and obvious OCR errors normalized against the official scan; historical French spelling retained; plenipotentiary titulature and provider furniture excluded.'
  },
  'pass-haiti-independence-1804': passage('pass-haiti-independence-1804', 'Acte de l’Indépendance d’Haïti, act, oath, and opening address, 1 January 1804'),
  'pass-haiti-recognition-1825': {
    ...passage('pass-haiti-recognition-1825', 'Charles X, Ordonnance du 17 avril 1825, preamble and Articles 1–3; Jean-Pierre Boyer, proclamation of 11 July 1825, selected complete paragraphs'),
    normalization: 'Whitespace, headings, article labels, apostrophes, and paragraph boundaries normalized; Ardouin’s historical French spelling retained; narrative commentary, notes, ceremonial speeches, navigation, and scan furniture excluded.'
  },
  'pass-seneca-declaration': passage('pass-seneca-declaration', 'Declaration of Sentiments, opening principles and initial grievance catalogue'),
  'pass-us-constitution': passage('pass-us-constitution', 'United States Constitution, Preamble, Article I, and opening of Article II'),
  'pass-federalist-10': passage('pass-federalist-10', 'The Federalist No. 10, opening analysis of faction'),
  'pass-sieyes-third-estate': passage('pass-sieyes-third-estate', 'Sieyès, Qu’est-ce que le tiers état ?, opening plan and Chapter I through the public functions, 1888 edition pages 27–29'),
  'pass-desmoulins-lanterne': passage('pass-desmoulins-lanterne', 'Desmoulins, Le Discours de la Lanterne, passage beginning “Tu as cru…” through the Charles IX question'),
  'pass-cadiz': passage('pass-cadiz', 'Constitución de Cádiz, Title I and Title II through Article 15'),
  'pass-venezuela-declaration': passage('pass-venezuela-declaration', 'Acta de la Declaración de Independencia de Venezuela, opening declaration and causes'),
  'pass-jamaica-letter': passage('pass-jamaica-letter', 'Bolívar, Carta de Jamaica, opening diagnosis of Spanish American independence'),
  'pass-angostura': passage('pass-angostura', 'Discurso de Angostura, opening transfer of authority'),
  'pass-rights-woman': passage('pass-rights-woman', 'Déclaration des droits de la femme et de la citoyenne, preamble and Articles I–X'),
  'pass-republic-constitution-1793': passage('pass-republic-constitution-1793', 'Founding decrees of 21–25 September 1792; Constitution of 24 June 1793, Declaration preamble and Articles 1–4, 9, 25, 28–29, 31, 33–35'),
  'pass-robespierre-virtue-terror': {
    ...passage('pass-robespierre-virtue-terror', 'Robespierre, report on political morality, 18 pluviôse an II (5 February 1794), selected'),
    normalization: 'Whitespace and quotation marks normalized; Project Gutenberg emphasis and wrapper removed; the obvious OCR accent error in “têtes” corrected against institutional collation.'
  },
  'pass-thermidor-convention': {
    ...passage('pass-thermidor-convention', 'Réimpression de l’ancien Moniteur, 9 thermidor an II (27 July 1794), volume XXI, pages 335–336, selected'),
    normalization: 'Whitespace, speaker labels, quotation marks, line-break hyphenation, and obvious OCR accents normalized; modern Archives parlementaires headings, citations, witness brackets, notes, and apparatus excluded.'
  },
  'pass-equiano': passage('pass-equiano', 'Equiano, Interesting Narrative, Chapter II, arrival at the coast and entry into the hold'),
  'pass-haiti-insurgent-letter-1792': {
    ...passage('pass-haiti-insurgent-letter-1792', 'Letter of Jean-François, Biassou, and Bélair, July 1792, selected; Le Créole Patriote no. 282; transcription pages 133–135'),
    normalization: 'Whitespace, paragraph boundaries, quotation marks, accents, and line-break hyphenation normalized; the letter’s historical grammar and spelling retained; modern article text, notes, and interpretation excluded.'
  },
  'pass-sonthonax-emancipation-1793': {
    ...passage('pass-sonthonax-emancipation-1793', 'Sonthonax, Proclamation au nom de la République, 29 August 1793, preamble and Articles II, IX, XI, XII, XXVII, and XXXIII'),
    normalization: 'Whitespace, paragraph boundaries, long-s typography, ampersands, punctuation, and line-break hyphenation normalized for legibility; no wording added; scan furniture removed.'
  },
  'pass-convention-abolition-1794': {
    ...passage('pass-convention-abolition-1794', 'Réimpression de l’ancien Moniteur, Convention proceedings of 16 pluviôse an II (4 February 1794), debate and decree, selected'),
    normalization: 'Whitespace, speaker labels, capitalization, punctuation, line-break hyphenation, and obvious OCR accents normalized; modern Archives parlementaires headings, citations, notes, and apparatus excluded.'
  },
  'pass-haiti-constitution-1801': passage('pass-haiti-constitution-1801', 'Constitution de Saint-Domingue (1801), Titles I–IV, Articles 1–16'),
  'pass-monroe-message': passage('pass-monroe-message', 'Monroe, Seventh Annual Message, non-colonization and intervention passages')
});

export const PHILOSOPHY_PILOT_PASSAGE_IDS = Object.freeze([
  'pass-epicurus-gods-death',
  'pass-sextus-skeptical-way',
  'pass-cicero-academic',
  'pass-anaximander-fragment',
  'pass-heraclitus-logos',
  'pass-parmenides-being',
  'pass-empedocles-roots',
  'pass-democritus-atoms',
  'pass-protagoras-measure',
  'pass-socrates-apology',
  'pass-plato-recollection',
  'pass-plato-divided-line',
  'pass-plato-cave',
  'pass-plato-forms',
  'pass-plato-cosmos',
  'pass-aristotle-first-causes',
  'pass-aristotle-human-good',
  'pass-aristotle-substance',
  'pass-aristotle-soul',
  'pass-epictetus-control',
  'pass-seneca-inner-spirit',
  'pass-marcus-morning',
  'pass-philo-creation',
  'pass-plotinus-beauty',
  'pass-plotinus-hypostases',
  'pass-porphyry-isagoge',
  'pass-iamblichus-theurgy',
  'pass-proclus-propositions',
  'pass-augustine-platonic-books',
  'pass-dionysius-mystical',
  'pass-boethius-eternity'
]);

export const HISTORY_PILOT_PASSAGE_IDS = Object.freeze([
  'pass-boston-massacre-crown-evidence',
  'pass-boston-massacre-defense-evidence',
  'pass-boston-tea-colonial-newspaper-1773',
  'pass-boston-tea-leslie-letter-1773',
  'pass-maillard-womens-march-deposition',
  'pass-assembly-womens-march-1789',
  'pass-rousseau-association',
  'pass-vermont-constitution-1777',
  'pass-articles-confederation-1777',
  'pass-us-bill-rights-proposal-1789',
  'pass-communist-manifesto',
  'pass-french-abolition-1848',
  'pass-franklin-war-finance-1766',
  'pass-watt-steam-principles-1769',
  'pass-arkwright-water-frame-system-1769',
  'pass-cartwright-power-loom-iteration-1785',
  'pass-stockton-darlington-opening-1825',
  'pass-lexington-provincial-evidence-1775',
  'pass-gage-lexington-report-1775',
  'pass-washington-continental-orders-1775',
  'pass-franco-american-alliance-1778',
  'pass-yorktown-capitulation-1781',
  'pass-treaty-paris-1763',
  'pass-treaty-paris-1783',
  'pass-stamp-act',
  'pass-first-continental-resolves-1774',
  'pass-common-sense',
  'pass-us-declaration',
  'pass-rights-man',
  'pass-constitution-year-viii',
  'pass-code-civil-1804',
  'pass-senate-deposition-napoleon-1814',
  'pass-congress-vienna-final-act-1815',
  'pass-haiti-independence-1804',
  'pass-haiti-recognition-1825',
  'pass-seneca-declaration',
  'pass-us-constitution',
  'pass-federalist-10',
  'pass-sieyes-third-estate',
  'pass-desmoulins-lanterne',
  'pass-cadiz',
  'pass-venezuela-declaration',
  'pass-jamaica-letter',
  'pass-angostura',
  'pass-rights-woman',
  'pass-republic-constitution-1793',
  'pass-robespierre-virtue-terror',
  'pass-thermidor-convention',
  'pass-equiano',
  'pass-haiti-insurgent-letter-1792',
  'pass-sonthonax-emancipation-1793',
  'pass-convention-abolition-1794',
  'pass-haiti-constitution-1801',
  'pass-monroe-message',
  'pass-somerset',
  'pass-uk-slave-trade-act',
  'pass-us-importation-act',
  'pass-slavery-abolition-1833',
  'pass-tucuman-independence-act-1816',
  'pass-belgrano-government-unsettled-1816',
  'pass-tucuman-order-decree-1816',
  'pass-plan-iguala-1821',
  'pass-mexico-independence-act-1821',
  'pass-peru-lima-independence-act-1821',
  'pass-peru-protector-decree-1821',
  'pass-brazil-manifesto-peoples-1822',
  'pass-brazil-council-session-1822',
  'pass-cachoeira-adhesion-letter-1822',
  'pass-commons-apprenticeship-debate-1838',
  'pass-barbados-apprenticeship-termination-1838'
]);
