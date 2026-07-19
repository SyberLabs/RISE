import { ATRIUM_CORPUS_VERSION, ATRIUM_SCHEMA_VERSION, freezeManifest } from './constants.js';
import {
  ATRIUM_PASSAGE_AUDITS,
  ATRIUM_SOURCE_AUDITS
} from './packs/pilot-v1/manifest.js';

const source = (
  id,
  domain,
  workTitle,
  author,
  provider,
  canonicalUrl,
  locatorScheme,
  language = 'en',
  originalLanguage = language
) => ({
  id,
  schemaVersion: ATRIUM_SCHEMA_VERSION,
  domain,
  kind: 'source-edition-candidate',
  workTitle,
  author,
  editor: null,
  translator: null,
  editionDate: null,
  language,
  originalLanguage,
  provider,
  canonicalUrl,
  canonicalId: null,
  locatorScheme,
  rights: {
    status: 'review-required',
    jurisdictions: [],
    license: null,
    attribution: null,
    reviewedAt: null
  },
  checksum: null,
  retrievedAt: null,
  status: 'draft'
});

const passage = (id, domain, sourceId, locator, label, editorialPurpose, perspectiveTags = []) => ({
  id,
  schemaVersion: ATRIUM_SCHEMA_VERSION,
  domain,
  kind: 'passage-candidate',
  sourceId,
  locator,
  canonicalLocator: null,
  label,
  editorialPurpose,
  estimatedWords: null,
  perspectiveTags,
  payloadPath: null,
  payloadChecksum: null,
  textVerified: false,
  rightsStatus: 'review-required',
  status: 'draft'
});

const sourceCandidates = [
  source('src-ogl-presocratic-fragments', 'philosophy', 'Presocratic fragment and testimonia collections', 'Multiple ancient authors', 'open-greek-latin', 'https://opengreekandlatin.org/', 'DK / Laks–Most concordance', 'grc', 'grc'),
  source('src-scaife-plato-theaetetus', 'philosophy', 'Theaetetus', 'Plato', 'scaife', 'https://scaife.perseus.org/', 'CTS', 'en', 'grc'),
  source('src-scaife-plato-apology', 'philosophy', 'Apology', 'Plato', 'scaife', 'https://scaife.perseus.org/', 'CTS', 'en', 'grc'),
  source('src-scaife-plato-meno', 'philosophy', 'Meno', 'Plato', 'scaife', 'https://scaife.perseus.org/', 'CTS', 'en', 'grc'),
  source('src-scaife-plato-republic', 'philosophy', 'Republic', 'Plato', 'scaife', 'https://scaife.perseus.org/', 'CTS', 'en', 'grc'),
  source('src-scaife-plato-phaedo', 'philosophy', 'Phaedo', 'Plato', 'scaife', 'https://scaife.perseus.org/', 'CTS', 'en', 'grc'),
  source('src-scaife-plato-timaeus', 'philosophy', 'Timaeus', 'Plato', 'scaife', 'https://scaife.perseus.org/', 'CTS', 'en', 'grc'),
  source('src-scaife-aristotle-metaphysics', 'philosophy', 'Metaphysics', 'Aristotle', 'scaife', 'https://scaife.perseus.org/', 'CTS / Bekker', 'en', 'grc'),
  source('src-scaife-aristotle-ethics', 'philosophy', 'Nicomachean Ethics', 'Aristotle', 'scaife', 'https://scaife.perseus.org/', 'CTS / Bekker', 'en', 'grc'),
  source('src-scaife-aristotle-de-anima', 'philosophy', 'De Anima', 'Aristotle', 'scaife', 'https://scaife.perseus.org/', 'CTS / Bekker', 'en', 'grc'),
  source('src-candidate-diogenes-laertius-x', 'philosophy', 'Lives of Eminent Philosophers, Book X', 'Diogenes Laertius', 'edition-audit', 'https://scaife.perseus.org/', 'book / section', 'en', 'grc'),
  source('src-candidate-epictetus-enchiridion', 'philosophy', 'Enchiridion', 'Epictetus', 'standard-ebooks-or-audited-pd', 'https://standardebooks.org/', 'section', 'en', 'grc'),
  source('src-candidate-seneca-letters', 'philosophy', 'Moral Letters to Lucilius', 'Seneca', 'audited-public-domain', 'https://www.gutenberg.org/', 'letter', 'en', 'lat'),
  source('src-candidate-marcus-meditations', 'philosophy', 'Meditations', 'Marcus Aurelius', 'standard-ebooks-or-audited-pd', 'https://standardebooks.org/', 'book / section', 'en', 'grc'),
  source('src-ogl-sextus-outlines', 'philosophy', 'Outlines of Pyrrhonism', 'Sextus Empiricus', 'open-greek-latin', 'https://opengreekandlatin.org/', 'book / section', 'en', 'grc'),
  source('src-perseus-cicero-academica', 'philosophy', 'Academica', 'Cicero', 'perseus', 'https://www.perseus.tufts.edu/', 'book / section', 'en', 'lat'),
  source('src-ogl-philo-creation', 'philosophy', 'On the Creation', 'Philo of Alexandria', 'open-greek-latin', 'https://opengreekandlatin.org/', 'section', 'en', 'grc'),
  source('src-ogl-plotinus-enneads', 'philosophy', 'Enneads', 'Plotinus', 'open-greek-latin', 'https://opengreekandlatin.org/', 'treatise / section', 'en', 'grc'),
  source('src-ogl-porphyry-life', 'philosophy', 'Life of Plotinus', 'Porphyry', 'open-greek-latin', 'https://opengreekandlatin.org/', 'section', 'en', 'grc'),
  source('src-ogl-porphyry-isagoge', 'philosophy', 'Isagoge', 'Porphyry', 'open-greek-latin', 'https://opengreekandlatin.org/', 'section', 'en', 'grc'),
  source('src-ogl-iamblichus-mysteries', 'philosophy', 'Reply to Porphyry / On the Mysteries', 'Iamblichus', 'open-greek-latin', 'https://opengreekandlatin.org/', 'book / section', 'en', 'grc'),
  source('src-ogl-proclus-elements', 'philosophy', 'Elements of Theology', 'Proclus', 'open-greek-latin', 'https://opengreekandlatin.org/', 'proposition', 'en', 'grc'),
  source('src-candidate-augustine-confessions', 'philosophy', 'Confessions', 'Augustine of Hippo', 'audited-public-domain', 'https://www.gutenberg.org/', 'book / chapter', 'en', 'lat'),
  source('src-candidate-dionysius-mystical', 'philosophy', 'Mystical Theology', 'Pseudo-Dionysius', 'audited-public-domain', 'https://www.gutenberg.org/', 'chapter', 'en', 'grc'),
  source('src-candidate-boethius-consolation', 'philosophy', 'Consolation of Philosophy', 'Boethius', 'standard-ebooks-or-audited-pd', 'https://standardebooks.org/', 'book / prose / meter', 'en', 'lat'),

  source('src-candidate-rousseau-social-contract', 'history', 'The Social Contract', 'Jean-Jacques Rousseau', 'standard-ebooks-or-audited-pd', 'https://standardebooks.org/', 'book / chapter', 'en', 'fra'),
  source('src-uk-stamp-act-1765', 'history', 'Stamp Act 1765', 'Parliament of Great Britain', 'uk-legislation', 'https://www.legislation.gov.uk/', 'statute / clause', 'en', 'en'),
  source('src-candidate-somerset-judgment', 'history', 'Somerset v Stewart judgment and reports', 'Court of King’s Bench', 'legal-edition-audit', 'https://www.oldbaileyonline.org/', 'report / page', 'en', 'en'),
  source('src-candidate-paine-common-sense', 'history', 'Common Sense', 'Thomas Paine', 'standard-ebooks-or-audited-pd', 'https://standardebooks.org/', 'section', 'en', 'en'),
  source('src-nara-us-declaration', 'history', 'Declaration of Independence', 'Continental Congress', 'nara', 'https://www.archives.gov/founding-docs/declaration', 'paragraph', 'en', 'en'),
  source('src-nara-us-constitution', 'history', 'Constitution of the United States', 'Constitutional Convention', 'nara', 'https://www.archives.gov/founding-docs/constitution', 'article / clause', 'en', 'en'),
  source('src-founders-federalist', 'history', 'The Federalist', 'Alexander Hamilton, James Madison, and John Jay', 'founders-online', 'https://founders.archives.gov/', 'essay / paragraph', 'en', 'en'),
  source('src-frda-rights-man', 'history', 'Declaration of the Rights of Man and of the Citizen', 'National Constituent Assembly', 'frda', 'https://frda.stanford.edu/', 'article', 'fra', 'fra'),
  source('src-gallica-rights-woman', 'history', 'Declaration of the Rights of Woman and of the Female Citizen', 'Olympe de Gouges', 'gallica', 'https://gallica.bnf.fr/', 'article', 'fra', 'fra'),
  source('src-candidate-equiano-narrative', 'history', 'The Interesting Narrative', 'Olaudah Equiano', 'standard-ebooks', 'https://standardebooks.org/', 'chapter / paragraph', 'en', 'en'),
  source('src-loc-haiti-constitutions', 'history', 'Les constitutions d’Haïti (1801–1885)', 'Multiple', 'library-of-congress', 'https://www.loc.gov/item/78396819/', 'document / article', 'fra', 'fra'),
  source('src-candidate-haiti-independence', 'history', 'Haitian Declaration of Independence', 'Jean-Jacques Dessalines and generals', 'institutional-edition-audit', 'https://www.loc.gov/', 'document / paragraph', 'fra', 'fra'),
  source('src-uk-slave-trade-act-1807', 'history', 'Slave Trade Act 1807', 'Parliament of the United Kingdom', 'uk-legislation', 'https://www.legislation.gov.uk/', 'statute / clause', 'en', 'en'),
  source('src-us-importation-act-1807', 'history', 'Act Prohibiting Importation of Slaves', 'United States Congress', 'library-of-congress', 'https://www.loc.gov/', 'statute / section', 'en', 'en'),
  source('src-bne-cadiz-constitution', 'history', 'Constitution of Cádiz', 'Cortes of Cádiz', 'bne', 'https://www.bne.es/', 'title / article', 'spa', 'spa'),
  source('src-candidate-venezuela-declaration', 'history', 'Venezuelan Declaration of Independence', 'Venezuelan Congress', 'institutional-edition-audit', 'https://library.brown.edu/create/modernlatinamerica/', 'paragraph', 'spa', 'spa'),
  source('src-candidate-jamaica-letter', 'history', 'Jamaica Letter', 'Simón Bolívar', 'original-language-edition-audit', 'https://library.brown.edu/create/modernlatinamerica/', 'paragraph', 'spa', 'spa'),
  source('src-candidate-angostura-address', 'history', 'Address to the Congress of Angostura', 'Simón Bolívar', 'original-language-edition-audit', 'https://library.brown.edu/create/modernlatinamerica/', 'paragraph', 'spa', 'spa'),
  source('src-loc-monroe-message', 'history', 'Seventh Annual Message to Congress', 'James Monroe', 'library-of-congress', 'https://www.loc.gov/', 'paragraph', 'en', 'en'),
  source('src-uk-slavery-abolition-act-1833', 'history', 'Slavery Abolition Act 1833', 'Parliament of the United Kingdom', 'uk-legislation', 'https://www.legislation.gov.uk/', 'statute / clause', 'en', 'en'),
  source('src-gallica-french-abolition-1848', 'history', 'Decree abolishing slavery in the French colonies', 'French Provisional Government', 'gallica', 'https://gallica.bnf.fr/', 'article', 'fra', 'fra'),
  source('src-candidate-communist-manifesto', 'history', 'Manifesto of the Communist Party', 'Karl Marx and Friedrich Engels', 'standard-ebooks-or-audited-pd', 'https://standardebooks.org/', 'chapter / paragraph', 'en', 'deu'),
  source('src-loc-seneca-declaration', 'history', 'Declaration of Sentiments', 'Seneca Falls Convention', 'library-of-congress', 'https://www.loc.gov/', 'resolution / paragraph', 'en', 'en')
];

const passageCandidates = [
  passage('pass-anaximander-fragment', 'philosophy', 'src-ogl-presocratic-fragments', 'DK 12 B1 / Laks–Most equivalent', 'Anaximander on origin and return', 'Origin, order, and return.', ['fragmentary', 'early-greek']),
  passage('pass-heraclitus-logos', 'philosophy', 'src-ogl-presocratic-fragments', 'selected Logos fragments; DK/current concordance', 'Heraclitus on logos', 'Logos and common order.', ['fragmentary', 'early-greek']),
  passage('pass-parmenides-being', 'philosophy', 'src-ogl-presocratic-fragments', 'fragment B8, selected lines', 'Parmenides on being', 'Being and the limits of coming-to-be.', ['fragmentary', 'early-greek']),
  passage('pass-empedocles-roots', 'philosophy', 'src-ogl-presocratic-fragments', 'selected fragments on roots, Love, and Strife', 'Empedocles on roots and forces', 'A pluralist response to Eleatic argument.', ['fragmentary', 'early-greek']),
  passage('pass-democritus-atoms', 'philosophy', 'src-ogl-presocratic-fragments', 'selected physical fragments and testimonia', 'Democritus on atoms and void', 'Atoms, void, and perception.', ['fragmentary', 'early-greek']),
  passage('pass-protagoras-measure', 'philosophy', 'src-scaife-plato-theaetetus', '151e–160e, selected', 'Protagoras through Plato’s witness', 'Relativism through a critical witness.', ['critical-witness', 'classical']),
  passage('pass-socrates-apology', 'philosophy', 'src-scaife-plato-apology', '20c–23b and 28e–30b', 'Wisdom and the examined life', 'Socratic wisdom, examination, and obligation.', ['dramatic-dialogue', 'classical']),
  passage('pass-plato-recollection', 'philosophy', 'src-scaife-plato-meno', '80d–86c, selected', 'Inquiry and recollection', 'The paradox of inquiry and a proposed response.', ['dramatic-dialogue', 'classical']),
  passage('pass-plato-divided-line', 'philosophy', 'src-scaife-plato-republic', 'VI 507b–511e', 'The divided line', 'Knowledge and intelligibility.', ['classical', 'epistemology']),
  passage('pass-plato-cave', 'philosophy', 'src-scaife-plato-republic', 'VII 514a–521b, selected', 'The cave and the return', 'Education, transformation, and return.', ['classical', 'education']),
  passage('pass-plato-forms', 'philosophy', 'src-scaife-plato-phaedo', '74a–76e', 'Equality, recollection, and Forms', 'A route from equal things to equality itself.', ['classical', 'metaphysics']),
  passage('pass-plato-cosmos', 'philosophy', 'src-scaife-plato-timaeus', '27d–29d', 'Model, becoming, and likely account', 'The epistemic posture of cosmological explanation.', ['classical', 'cosmology']),
  passage('pass-aristotle-first-causes', 'philosophy', 'src-scaife-aristotle-metaphysics', 'I.3, 983a24–984b22, selected', 'Aristotle’s predecessors', 'A retrospective genealogy of first causes.', ['classical', 'historiography']),
  passage('pass-aristotle-substance', 'philosophy', 'src-scaife-aristotle-metaphysics', 'VII.1–3, selected', 'Being and substance', 'Aristotle’s architecture of substance.', ['classical', 'metaphysics']),
  passage('pass-aristotle-human-good', 'philosophy', 'src-scaife-aristotle-ethics', 'I.7, 1097b22–1098a20', 'The human good', 'Function, activity, and flourishing.', ['classical', 'ethics']),
  passage('pass-aristotle-soul', 'philosophy', 'src-scaife-aristotle-de-anima', 'II.1, 412a3–413a10', 'Soul as actuality', 'Form, body, and living actuality.', ['classical', 'psychology']),
  passage('pass-epicurus-gods-death', 'philosophy', 'src-candidate-diogenes-laertius-x', 'Letter to Menoeceus 122–135, selected', 'Gods, death, desire, and pleasure', 'Release from fear and the ordering of desire.', ['hellenistic', 'ethics']),
  passage('pass-epicurus-doctrines', 'philosophy', 'src-candidate-diogenes-laertius-x', 'Principal Doctrines 1–5 and 27–28', 'Freedom from fear and friendship', 'Compact propositions on tranquility and friendship.', ['hellenistic', 'ethics']),
  passage('pass-epictetus-control', 'philosophy', 'src-candidate-epictetus-enchiridion', '1', 'What is up to us', 'The opening distinction structuring Stoic practice.', ['roman-stoic', 'practice']),
  passage('pass-seneca-inner-spirit', 'philosophy', 'src-candidate-seneca-letters', 'Letter 41', 'The inward source of dignity', 'Divinity, reason, and inward dignity.', ['roman-stoic', 'practice']),
  passage('pass-marcus-morning', 'philosophy', 'src-candidate-marcus-meditations', 'II.1', 'The morning meditation', 'Social nature and difficult encounters.', ['roman-stoic', 'practice']),
  passage('pass-sextus-skeptical-way', 'philosophy', 'src-ogl-sextus-outlines', 'I.1–12', 'The skeptical way', 'Inquiry, equipollence, and suspension.', ['hellenistic', 'skepticism']),
  passage('pass-cicero-academic', 'philosophy', 'src-perseus-cicero-academica', 'II, selected', 'Academic arguments about apprehension', 'A distinct skeptical tradition preserved in Latin.', ['roman', 'skepticism']),
  passage('pass-philo-creation', 'philosophy', 'src-ogl-philo-creation', 'selected sections', 'Creation and intelligible model', 'Scriptural exegesis in a Platonist vocabulary.', ['imperial', 'jewish-philosophy']),
  passage('pass-plotinus-beauty', 'philosophy', 'src-ogl-plotinus-enneads', 'I.6, selected', 'Beauty and ascent', 'Beauty as a route toward intelligible reality.', ['late-antique', 'platonism']),
  passage('pass-plotinus-hypostases', 'philosophy', 'src-ogl-plotinus-enneads', 'V.1, selected', 'The primary hypostases', 'The One, Intellect, and Soul.', ['late-antique', 'platonism']),
  passage('pass-porphyry-life-14', 'philosophy', 'src-ogl-porphyry-life', '14', 'Plotinus’s sources and teaching', 'Biographical testimony about a philosophical practice.', ['late-antique', 'testimony']),
  passage('pass-porphyry-isagoge', 'philosophy', 'src-ogl-porphyry-isagoge', 'opening on genera and species', 'Genera and species', 'Logical questions that shape later transmission.', ['late-antique', 'logic']),
  passage('pass-iamblichus-theurgy', 'philosophy', 'src-ogl-iamblichus-mysteries', 'I, selected', 'Reason, ritual, and divine action', 'A defense of theurgy against Porphyrian criticism.', ['late-antique', 'theurgy']),
  passage('pass-proclus-propositions', 'philosophy', 'src-ogl-proclus-elements', 'propositions 1–13, selected', 'Unity and multiplicity', 'A proposition-based architecture of procession.', ['late-antique', 'system']),
  passage('pass-augustine-platonic-books', 'philosophy', 'src-candidate-augustine-confessions', 'VII.9–21, selected', 'The books of the Platonists', 'Augustine’s account of appropriation and difference.', ['christian', 'transmission']),
  passage('pass-augustine-time', 'philosophy', 'src-candidate-augustine-confessions', 'XI.14–28, selected', 'Time, memory, and attention', 'An inward analysis of temporal experience.', ['christian', 'time']),
  passage('pass-dionysius-mystical', 'philosophy', 'src-candidate-dionysius-mystical', 'I', 'Apophatic ascent', 'The movement beyond affirmation and negation.', ['christian', 'apophasis']),
  passage('pass-boethius-eternity', 'philosophy', 'src-candidate-boethius-consolation', 'V, selected', 'Providence, eternity, and freedom', 'A Latin meditation on foreknowledge and freedom.', ['latin', 'transmission']),

  passage('pass-rousseau-association', 'history', 'src-candidate-rousseau-social-contract', 'I.6 and II.1, selected', 'The act of association', 'Popular sovereignty and legitimate association.', ['political-theory', 'europe']),
  passage('pass-stamp-act', 'history', 'src-uk-stamp-act-1765', 'selected operative clauses', 'Imperial taxation in statute', 'The legal machinery behind an Atlantic constitutional crisis.', ['state-record', 'british-atlantic']),
  passage('pass-somerset', 'history', 'src-candidate-somerset-judgment', 'selected judgment or authenticated report', 'Law, slavery, and jurisdiction', 'The reach and limits of the Somerset judgment.', ['legal-record', 'slavery']),
  passage('pass-common-sense', 'history', 'src-candidate-paine-common-sense', 'introduction and selected monarchy/republic sections', 'The case for independence', 'A widely circulated argument for political separation.', ['print', 'revolutionary']),
  passage('pass-us-declaration', 'history', 'src-nara-us-declaration', 'grievances and conclusion', 'Declaration and universal claim', 'Independence, grievance, and political universality.', ['state-record', 'united-states']),
  passage('pass-us-constitution', 'history', 'src-nara-us-constitution', 'Preamble and selected structural clauses', 'Federal design', 'A constitutional architecture read with its exclusions.', ['state-record', 'united-states']),
  passage('pass-federalist-10', 'history', 'src-founders-federalist', 'No. 10, selected', 'Faction and the extended republic', 'An argument for constitutional scale and representation.', ['political-print', 'united-states']),
  passage('pass-rights-man', 'history', 'src-frda-rights-man', 'selected articles', 'Rights and sovereignty', 'A revolutionary declaration of rights and political authority.', ['state-record', 'france']),
  passage('pass-rights-woman', 'history', 'src-gallica-rights-woman', 'selected articles', 'Counterclaim and exclusion', 'A gendered counterclaim written in the declaration form.', ['countervoice', 'france']),
  passage('pass-equiano', 'history', 'src-candidate-equiano-narrative', 'selected authenticated episode', 'Enslavement, commerce, and testimony', 'First-person testimony within abolitionist print culture.', ['counterarchive', 'atlantic']),
  passage('pass-haiti-constitution-1801', 'history', 'src-loc-haiti-constitutions', 'selected articles on freedom, territory, labor, and authority', 'Freedom and constitutional power', 'Emancipation alongside centralized labor and executive power.', ['state-record', 'haiti']),
  passage('pass-haiti-independence-1804', 'history', 'src-candidate-haiti-independence', 'selected paragraphs', 'Independence after slavery and war', 'A declaration following revolutionary emancipation and anticolonial war.', ['state-record', 'haiti']),
  passage('pass-uk-slave-trade-act', 'history', 'src-uk-slave-trade-act-1807', 'selected operative clauses', 'Trade prohibition and enforcement', 'Prohibition of the trade without abolition of colonial slavery.', ['legal-record', 'british-empire']),
  passage('pass-us-importation-act', 'history', 'src-us-importation-act-1807', 'selected sections', 'Importation prohibited, slavery retained', 'A trade prohibition distinguished from emancipation.', ['legal-record', 'united-states']),
  passage('pass-cadiz', 'history', 'src-bne-cadiz-constitution', 'selected articles on nation, sovereignty, and citizenship', 'Imperial constitutionalism', 'Constitutional nationhood across an empire in crisis.', ['state-record', 'spanish-atlantic']),
  passage('pass-venezuela-declaration', 'history', 'src-candidate-venezuela-declaration', 'selected paragraphs', 'Spanish American independence', 'A declaration of sovereignty amid war and social conflict.', ['state-record', 'venezuela']),
  passage('pass-jamaica-letter', 'history', 'src-candidate-jamaica-letter', 'selected original Spanish paragraphs', 'Continental diagnosis and political futures', 'Bolívar’s analysis of colonial inheritance and possible futures.', ['political-letter', 'spanish-america']),
  passage('pass-angostura', 'history', 'src-candidate-angostura-address', 'selected original Spanish paragraphs', 'Republican design and executive power', 'A constitutional address shaped by regional history and strong executive preference.', ['political-speech', 'spanish-america']),
  passage('pass-monroe-message', 'history', 'src-loc-monroe-message', 'relevant paragraphs', 'Hemispheric policy', 'A United States claim about European intervention and the Americas.', ['state-record', 'united-states']),
  passage('pass-slavery-abolition-1833', 'history', 'src-uk-slavery-abolition-act-1833', 'selected clauses', 'Emancipation, apprenticeship, and compensation', 'Abolition legislation read through its delays and beneficiaries.', ['legal-record', 'british-empire']),
  passage('pass-french-abolition-1848', 'history', 'src-gallica-french-abolition-1848', 'selected articles', 'Colonial re-abolition', 'The 1848 decree distinguished from 1794 and Napoleon’s reversal.', ['state-record', 'french-empire']),
  passage('pass-communist-manifesto', 'history', 'src-candidate-communist-manifesto', 'I, selected', 'Class and industrial transformation', 'An interpretation of industrial capitalism and class conflict.', ['political-print', 'europe']),
  passage('pass-seneca-declaration', 'history', 'src-loc-seneca-declaration', 'selected resolutions and declaration paragraphs', 'Rights claim in an inherited form', 'Women’s equality argued through the language of revolutionary declaration.', ['social-movement', 'united-states'])
];

export const ATRIUM_SOURCES = Object.freeze(sourceCandidates.map(candidate => {
  const audit = ATRIUM_SOURCE_AUDITS[candidate.id];
  if (!audit) return candidate;
  return {
    ...candidate,
    ...audit,
    rights: { ...candidate.rights, ...audit.rights }
  };
}));

const auditedSourceRights = new Map(ATRIUM_SOURCES
  .filter(item => item.status === 'publishable')
  .map(item => [item.id, item.rights.status]));

export const ATRIUM_PASSAGES = Object.freeze(passageCandidates.map(candidate => {
  const audit = ATRIUM_PASSAGE_AUDITS[candidate.id];
  return {
    ...candidate,
    ...(auditedSourceRights.has(candidate.sourceId)
      ? { rightsStatus: auditedSourceRights.get(candidate.sourceId) }
      : {}),
    ...(audit || {})
  };
}));

export const ATRIUM_CATALOG = freezeManifest({
  id: 'atrium-source-and-passage-candidates',
  label: 'Atrium source and passage candidates',
  schemaVersion: ATRIUM_SCHEMA_VERSION,
  corpusVersion: ATRIUM_CORPUS_VERSION,
  status: 'draft',
  sources: ATRIUM_SOURCES,
  passages: ATRIUM_PASSAGES
});

export function findAtriumSource(id) {
  return ATRIUM_SOURCES.find(item => item.id === id) || null;
}

export function findAtriumPassage(id) {
  return ATRIUM_PASSAGES.find(item => item.id === id) || null;
}
