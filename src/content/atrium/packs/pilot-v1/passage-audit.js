import { ATRIUM_PILOT_INTEGRITY } from './integrity.js';

const openLicensed = new Set(['pass-rights-man']);
const passage = (id, canonicalLocator) => ({
  canonicalLocator,
  estimatedWords: ATRIUM_PILOT_INTEGRITY[id].words,
  payloadPath: './packs/pilot-v1/payloads.js#' + id,
  payloadChecksum: ATRIUM_PILOT_INTEGRITY[id].checksum,
  textVerified: true,
  normalization: 'Whitespace and quotation marks normalized; historical spelling retained; provider notes and page furniture removed.',
  rightsStatus: openLicensed.has(id) ? 'open-license-confirmed' : 'public-domain-confirmed',
  status: 'publishable'
});

export const ATRIUM_PASSAGE_AUDITS = Object.freeze({
  'pass-anaximander-fragment': passage('pass-anaximander-fragment', 'Burnet, Early Greek Philosophy, §13; Phys. Op. fr. 2 (R. P. 16)'),
  'pass-protagoras-measure': passage('pass-protagoras-measure', 'Plato, Theaetetus 152a–b'),
  'pass-socrates-apology': passage('pass-socrates-apology', 'Plato, Apology 38a'),
  'pass-plato-recollection': passage('pass-plato-recollection', 'Plato, Meno 80d–81d'),
  'pass-plato-divided-line': passage('pass-plato-divided-line', 'Plato, Republic VI 509d–511e'),
  'pass-plato-cave': passage('pass-plato-cave', 'Plato, Republic VII 514a–515d'),
  'pass-plato-forms': passage('pass-plato-forms', 'Plato, Phaedo 74a–75c'),
  'pass-aristotle-substance': passage('pass-aristotle-substance', 'Aristotle, Metaphysics VII.3, 1028b33–1029a30'),
  'pass-aristotle-soul': passage('pass-aristotle-soul', 'Aristotle, De Anima II.1, 412a3–412b9'),
  'pass-epictetus-control': passage('pass-epictetus-control', 'Epictetus, Encheiridion 1'),
  'pass-augustine-platonic-books': passage('pass-augustine-platonic-books', 'Augustine, Confessions VII.9.13–14'),
  'pass-dionysius-mystical': passage('pass-dionysius-mystical', 'Pseudo-Dionysius, Mystical Theology I.1'),
  'pass-boethius-eternity': passage('pass-boethius-eternity', 'Boethius, Consolation V, prose 6'),
  'pass-stamp-act': passage('pass-stamp-act', 'Stamp Act 1765, preamble and section I newspaper and pamphlet duties'),
  'pass-common-sense': passage('pass-common-sense', 'Paine, Common Sense, Introduction, paragraphs 4–5'),
  'pass-us-declaration': passage('pass-us-declaration', 'Declaration of Independence, opening principles and concluding declaration'),
  'pass-rights-man': passage('pass-rights-man', 'Déclaration des droits de l’homme et du citoyen, Articles 1–3'),
  'pass-haiti-independence-1804': passage('pass-haiti-independence-1804', 'Acte de l’Indépendance d’Haïti, opening act and oath, 1 January 1804'),
  'pass-seneca-declaration': passage('pass-seneca-declaration', 'Declaration of Sentiments, opening two paragraphs'),
  'pass-us-constitution': passage('pass-us-constitution', 'United States Constitution, Preamble and Article I, §1'),
  'pass-federalist-10': passage('pass-federalist-10', 'The Federalist No. 10, paragraphs 1, 4–8'),
  'pass-cadiz': passage('pass-cadiz', 'Constitución de Cádiz, Title I, Chapter I, Articles 1–4'),
  'pass-angostura': passage('pass-angostura', 'Discurso de Angostura, institutional PDF pp. 93–94'),
  'pass-rights-woman': passage('pass-rights-woman', 'Déclaration des droits de la femme et de la citoyenne, Articles I–III'),
  'pass-equiano': passage('pass-equiano', 'Equiano, Interesting Narrative, Chapter II, arrival at the coast'),
  'pass-haiti-constitution-1801': passage('pass-haiti-constitution-1801', 'Constitution de Saint-Domingue (1801), Title II, Articles 3–5'),
  'pass-monroe-message': passage('pass-monroe-message', 'Monroe, Seventh Annual Message, colonization and intervention paragraphs')
});

export const PHILOSOPHY_PILOT_PASSAGE_IDS = Object.freeze([
  'pass-anaximander-fragment',
  'pass-protagoras-measure',
  'pass-socrates-apology',
  'pass-plato-recollection',
  'pass-plato-divided-line',
  'pass-plato-cave',
  'pass-plato-forms',
  'pass-aristotle-substance',
  'pass-aristotle-soul',
  'pass-epictetus-control',
  'pass-augustine-platonic-books',
  'pass-dionysius-mystical',
  'pass-boethius-eternity'
]);

export const HISTORY_PILOT_PASSAGE_IDS = Object.freeze([
  'pass-stamp-act',
  'pass-common-sense',
  'pass-us-declaration',
  'pass-rights-man',
  'pass-haiti-independence-1804',
  'pass-seneca-declaration',
  'pass-us-constitution',
  'pass-federalist-10',
  'pass-cadiz',
  'pass-angostura',
  'pass-rights-woman',
  'pass-equiano',
  'pass-haiti-constitution-1801',
  'pass-monroe-message'
]);
