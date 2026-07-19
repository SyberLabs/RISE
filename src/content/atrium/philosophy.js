import { ATRIUM_CORPUS_VERSION, ATRIUM_SCHEMA_VERSION, freezeManifest } from './constants.js';
import { PHILOSOPHY_PILOT_JOURNEY_IDS } from './packs/pilot-v1/manifest.js';
import {
  createPhilosophyNodeReview,
  findPhilosophyEdgeReview
} from './editorial-review.js';

const publishableJourneyIds = new Set(PHILOSOPHY_PILOT_JOURNEY_IDS);

const node = (id, label, kind, era, dates, start, end, summary, sourceRefs, themes = []) => {
  const editorialReview = createPhilosophyNodeReview({ id, summary, sourceRefs });
  return {
    id,
    domain: 'philosophy',
    kind,
    label,
    era,
    dates: { display: dates, start, end, precision: 'approximate' },
    summary,
    sourceRefs,
    themes,
    editorialReview,
    status: 'reviewed',
    launchStatus: 'source-review'
  };
};

export const PHILOSOPHY_NODES = Object.freeze([
  node('ph-period-early-greek', 'Early Greek Inquiry', 'period', 'early-greek', 'c. 625–400 BCE', -624, -399, 'A framing period for fragmentary Greek inquiry into nature, order, knowledge, and human life.', ['SEP-PRE'], ['nature', 'being']),
  node('ph-school-milesian', 'Milesian Inquiry', 'school', 'early-greek', 'c. 625–525 BCE', -624, -524, 'Thales, Anaximander, and Anaximenes seek explanatory accounts of nature without a single settled doctrine.', ['SEP-PRE'], ['nature', 'cosmology']),
  node('ph-tradition-pythagorean', 'Early Pythagoreanism', 'tradition', 'early-greek', 'c. 570–400 BCE', -569, -399, 'A difficult early tradition joining disciplined communal life, the soul, harmony, and numerical relations.', ['SEP-PYTH'], ['number', 'soul', 'harmony']),
  node('ph-thinker-xenophanes', 'Xenophanes', 'thinker', 'early-greek', 'c. 570–475 BCE', -569, -474, 'A poet-thinker remembered for criticism of anthropomorphic gods and reflections on the limits of inquiry.', ['SEP-PRE'], ['theology', 'knowledge']),
  node('ph-thinker-heraclitus', 'Heraclitus', 'thinker', 'early-greek', 'c. 540–480 BCE', -539, -479, 'A fragmentary thinker of logos, opposition, transformation, and the difficulty of understanding a common order.', ['SEP-HER'], ['logos', 'change']),
  node('ph-school-eleatic', 'Eleatic Philosophy', 'school', 'early-greek', 'c. 515–430 BCE', -514, -429, 'Parmenides, Zeno, and Melissus press arguments about being, appearance, unity, and motion.', ['SEP-PAR'], ['being', 'argument']),
  node('ph-tradition-pluralists', 'Pluralists', 'tradition', 'early-greek', 'c. 495–428 BCE', -494, -427, 'Empedocles and Anaxagoras preserve enduring constituents while explaining plurality and change.', ['SEP-PRE'], ['nature', 'change']),
  node('ph-school-atomism', 'Early Atomism', 'school', 'early-greek', 'c. 460–370 BCE', -459, -369, 'Leucippus and Democritus explain change through atoms and void while extending inquiry into perception and ethics.', ['SEP-PRE'], ['atoms', 'perception']),
  node('ph-movement-sophistic', 'Sophistic Movement', 'movement', 'classical', 'c. 490–380 BCE', -489, -379, 'Teachers including Protagoras and Gorgias transform argument, rhetoric, education, and disputes about nature and convention.', ['SEP-SOPH'], ['rhetoric', 'convention']),
  node('ph-tradition-socratic', 'Socratic Inquiry', 'tradition', 'classical', 'c. 470–399 BCE', -469, -398, 'Socrates as differently preserved by Plato, Xenophon, Aristophanes, and later schools: examination, ethics, and care of the soul.', ['SEP-SOCR'], ['ethics', 'inquiry']),
  node('ph-school-cynicism', 'Cynicism', 'school', 'classical', 'c. 400 BCE–300 CE', -399, 300, 'A contested Socratic lineage of askesis, frank speech, and the demand to live according to nature rather than convention.', ['SEP-CYN'], ['practice', 'convention']),
  node('ph-school-cyrenaic', 'Cyrenaics', 'school', 'classical', 'c. 400–250 BCE', -399, -249, 'Aristippus and successors investigate pleasure, immediate experience, and practical autonomy.', ['SEP-CYR'], ['pleasure', 'experience']),
  node('ph-school-megarian', 'Megarian & Dialectical Schools', 'school', 'classical', 'c. 400–250 BCE', -399, -249, 'A Socratic inheritance associated with Euclides of Megara and later developments in dialectic and logic.', ['SEP-MEG'], ['logic', 'dialectic']),
  node('ph-thinker-plato', 'Plato', 'thinker', 'classical', '427–347 BCE', -426, -346, 'Dialogues exploring inquiry, Forms, soul, education, politics, cosmology, and the dramatic life of philosophy.', ['SEP-PLATO'], ['forms', 'dialectic', 'politics']),
  node('ph-school-old-academy', 'Old Academy', 'school', 'classical', '387–266 BCE', -386, -265, 'Plato’s early institutional successors, including Speusippus, Xenocrates, and Polemo.', ['SEP-ACADEMY'], ['academy', 'metaphysics']),
  node('ph-thinker-aristotle', 'Aristotle', 'thinker', 'classical', '384–322 BCE', -383, -321, 'A systematic investigator of logic, nature, substance, soul, ethics, politics, and first philosophy.', ['SEP-ARISTOTLE'], ['substance', 'ethics', 'nature']),
  node('ph-school-peripatetic', 'Peripatetic Tradition', 'school', 'classical', 'c. 335 BCE–200 CE', -334, 200, 'Theophrastus and later Aristotelian research and commentary traditions.', ['SEP-ARISTOTLE'], ['commentary', 'research']),
  node('ph-school-epicurean', 'Epicureanism', 'school', 'hellenistic', 'c. 307 BCE–300 CE', -306, 300, 'An atomist philosophy of pleasure, friendship, freedom from disturbance, and release from fear.', ['SEP-EPICURUS'], ['pleasure', 'friendship', 'atoms']),
  node('ph-tradition-early-stoa', 'Early & Middle Stoa', 'tradition', 'hellenistic', 'c. 300–51 BCE', -299, -50, 'Zeno through Posidonius: an integrated practice of logic, physics, ethics, and life according to nature.', ['SEP-STOICISM'], ['logic', 'physics', 'ethics']),
  node('ph-tradition-roman-stoa', 'Roman Stoicism', 'tradition', 'hellenistic', 'c. 1–180 CE', 1, 180, 'Seneca, Musonius Rufus, Epictetus, and Marcus Aurelius emphasize judgment, practice, obligation, and inner freedom.', ['SEP-STOICISM'], ['practice', 'judgment']),
  node('ph-school-pyrrhonism', 'Pyrrhonian Skepticism', 'school', 'hellenistic', 'c. 360 BCE–200 CE', -359, 200, 'An evolving skeptical tradition of continued inquiry, modes of argument, suspension, and tranquility.', ['SEP-SKEPTICISM'], ['skepticism', 'inquiry']),
  node('ph-school-academic-skepticism', 'Academic Skepticism', 'school', 'hellenistic', '266–c. 80 BCE', -265, -79, 'The skeptical phase of Plato’s Academy under Arcesilaus, Carneades, and their successors.', ['SEP-SKEPTICISM'], ['skepticism', 'academy']),
  node('ph-tradition-middle-platonism', 'Middle Platonism', 'tradition', 'imperial', 'c. 80 BCE–250 CE', -79, 250, 'Plural efforts by figures such as Plutarch, Alcinous, and Numenius to recover and systematize Plato.', ['SEP-MIDDLE-PLATONISM'], ['platonism', 'system']),
  node('ph-tradition-neopythagorean', 'Neopythagoreanism', 'tradition', 'imperial', 'c. 1 BCE–200 CE', 0, 200, 'Imperial-period revivals and reconstructions of Pythagorean authority and teaching.', ['SEP-PYTH'], ['number', 'revival']),
  node('ph-thinker-philo', 'Philo of Alexandria', 'thinker', 'imperial', 'c. 20 BCE–50 CE', -19, 50, 'A Jewish scriptural exegete who draws extensively on Platonist and Stoic philosophy.', ['SEP-PHILO'], ['exegesis', 'platonism']),
  node('ph-thinker-plotinus', 'Plotinus', 'thinker', 'late-antique', '204–270 CE', 204, 270, 'A late Platonist of the One, Intellect, Soul, procession, contemplation, and return.', ['SEP-PLOTINUS'], ['the-one', 'soul', 'intellect']),
  node('ph-thinker-porphyry', 'Porphyry', 'thinker', 'late-antique', 'c. 234–305 CE', 234, 305, 'Plotinus’ student and editor, influential in ethics, exegesis, Aristotelian logic, and philosophical transmission.', ['SEP-PLOTINUS'], ['logic', 'transmission']),
  node('ph-tradition-iamblichean', 'Iamblichean Platonism', 'tradition', 'late-antique', 'c. 245–350 CE', 245, 350, 'Iamblichus and his followers expand Platonist hierarchy and defend theurgy as essential to ascent.', ['SEP-IAMBLICHUS'], ['theurgy', 'hierarchy']),
  node('ph-school-athenian-neoplatonism', 'Athenian Neoplatonism', 'school', 'late-antique', 'c. 400–529 CE', 400, 529, 'Plutarch of Athens, Syrianus, Proclus, and Damascius develop systematic late Platonism.', ['SEP-PROCLUS'], ['system', 'commentary']),
  node('ph-school-alexandrian-neoplatonism', 'Alexandrian Neoplatonism', 'school', 'late-antique', 'c. 400–640 CE', 400, 640, 'A commentary tradition spanning Ammonius, Olympiodorus, Philoponus, and major religious change.', ['SEP-NEOPLATONISM'], ['commentary', 'alexandria']),
  node('ph-tradition-patristic-platonism', 'Patristic Platonisms', 'tradition', 'transmission', 'c. 150–500 CE', 150, 500, 'Multiple Christian appropriations, transformations, and criticisms of Platonist concepts rather than a single school.', ['SEP-NEOPLATONISM'], ['christianity', 'platonism']),
  node('ph-thinker-augustine', 'Augustine', 'thinker', 'transmission', '354–430 CE', 354, 430, 'A Christian philosopher of inwardness, memory, time, will, grace, and the transformation of Platonist inheritance.', ['SEP-AUGUSTINE'], ['memory', 'time', 'will']),
  node('ph-thinker-pseudo-dionysius', 'Pseudo-Dionysius', 'thinker', 'transmission', 'late 5th–early 6th c.', 475, 525, 'An apophatic Christian thinker who transforms late Platonist hierarchy and theological language.', ['SEP-DIONYSIUS'], ['apophasis', 'hierarchy']),
  node('ph-thinker-boethius', 'Boethius', 'thinker', 'transmission', 'c. 477–524 CE', 477, 524, 'A Latin transmitter of Greek logic and author of a philosophical meditation on fortune, providence, and freedom.', ['SEP-NEOPLATONISM'], ['logic', 'providence']),
  node('ph-tradition-latin-scholastic', 'Latin Scholastic Reception', 'tradition', 'transmission', 'c. 800–1300 CE', 800, 1300, 'A reception anchor for Augustine, Dionysius, Boethius, and the later recovery of Aristotle—not yet a medieval corpus.', ['SEP-NEOPLATONISM'], ['reception', 'scholasticism'])
]);

const edge = (id, from, to, type, confidence, evidence, citationRefs, note = '') => {
  const candidate = {
    id,
    domain: 'philosophy',
    kind: 'relationship',
    from,
    to,
    type,
    confidence,
    evidence,
    citationRefs,
    note
  };
  const editorialReview = findPhilosophyEdgeReview(candidate);
  return {
    ...candidate,
    ...(editorialReview ? { editorialReview, note: editorialReview.note } : {}),
    status: editorialReview ? 'reviewed' : 'draft'
  };
};

export const PHILOSOPHY_EDGES = Object.freeze([
  edge('edge-eleatic-milesian', 'ph-school-eleatic', 'ph-school-milesian', 'critique', 'contested', 'E3', ['SEP-PRE'], 'A heuristic connection requiring claim-level review.'),
  edge('edge-pythagorean-plato', 'ph-tradition-pythagorean', 'ph-thinker-plato', 'influence', 'medium', 'E2', ['SEP-PYTH', 'SEP-PLATO']),
  edge('edge-xenophanes-eleatic', 'ph-thinker-xenophanes', 'ph-school-eleatic', 'influence', 'contested', 'E3', ['SEP-PRE']),
  edge('edge-heraclitus-plato', 'ph-thinker-heraclitus', 'ph-thinker-plato', 'influence', 'medium', 'E2', ['SEP-HER', 'SEP-PLATO']),
  edge('edge-pluralists-eleatic', 'ph-tradition-pluralists', 'ph-school-eleatic', 'critique', 'high', 'E2', ['SEP-PRE']),
  edge('edge-atomism-eleatic', 'ph-school-atomism', 'ph-school-eleatic', 'critique', 'high', 'E2', ['SEP-PRE']),
  edge('edge-eleatic-plato', 'ph-school-eleatic', 'ph-thinker-plato', 'influence', 'high', 'E2', ['SEP-PAR', 'SEP-PLATO']),
  edge('edge-sophists-socratic', 'ph-movement-sophistic', 'ph-tradition-socratic', 'contemporaneous-dialogue', 'high', 'E1', ['SEP-SOPH', 'SEP-SOCR']),
  edge('edge-plato-sophists', 'ph-thinker-plato', 'ph-movement-sophistic', 'critique', 'high', 'E1', ['SEP-SOPH', 'SEP-PLATO']),
  edge('edge-socratic-plato', 'ph-tradition-socratic', 'ph-thinker-plato', 'influence', 'high', 'E1', ['SEP-SOCR', 'SEP-PLATO']),
  edge('edge-socratic-cynicism', 'ph-tradition-socratic', 'ph-school-cynicism', 'influence', 'medium', 'E2', ['SEP-CYN']),
  edge('edge-socratic-cyrenaics', 'ph-tradition-socratic', 'ph-school-cyrenaic', 'influence', 'high', 'E1', ['SEP-CYR']),
  edge('edge-socratic-megarians', 'ph-tradition-socratic', 'ph-school-megarian', 'influence', 'high', 'E1', ['SEP-MEG']),
  edge('edge-plato-academy', 'ph-thinker-plato', 'ph-school-old-academy', 'institutional-succession', 'high', 'E1', ['SEP-ACADEMY']),
  edge('edge-plato-aristotle-teaching', 'ph-thinker-plato', 'ph-thinker-aristotle', 'teacher-student', 'high', 'E1', ['SEP-ARISTOTLE']),
  edge('edge-aristotle-plato-critique', 'ph-thinker-aristotle', 'ph-thinker-plato', 'critique', 'high', 'E1', ['SEP-ARISTOTLE']),
  edge('edge-aristotle-peripatetic', 'ph-thinker-aristotle', 'ph-school-peripatetic', 'institutional-succession', 'high', 'E1', ['SEP-ARISTOTLE']),
  edge('edge-atomism-epicurean', 'ph-school-atomism', 'ph-school-epicurean', 'revival', 'high', 'E1', ['SEP-EPICURUS']),
  edge('edge-cynicism-stoa', 'ph-school-cynicism', 'ph-tradition-early-stoa', 'influence', 'high', 'E1', ['SEP-STOICISM']),
  edge('edge-heraclitus-stoa', 'ph-thinker-heraclitus', 'ph-tradition-early-stoa', 'influence', 'medium', 'E2', ['SEP-STOICISM']),
  edge('edge-megarian-stoa', 'ph-school-megarian', 'ph-tradition-early-stoa', 'influence', 'medium', 'E2', ['SEP-STOICISM']),
  edge('edge-stoa-roman', 'ph-tradition-early-stoa', 'ph-tradition-roman-stoa', 'transmission', 'high', 'E1', ['SEP-STOICISM']),
  edge('edge-academy-skepticism', 'ph-school-old-academy', 'ph-school-academic-skepticism', 'institutional-succession', 'high', 'E1', ['SEP-ACADEMY']),
  edge('edge-pyrrhonism-academic', 'ph-school-pyrrhonism', 'ph-school-academic-skepticism', 'influence', 'contested', 'E3', ['SEP-SKEPTICISM']),
  edge('edge-academic-stoa', 'ph-school-academic-skepticism', 'ph-tradition-early-stoa', 'critique', 'high', 'E1', ['SEP-SKEPTICISM', 'SEP-STOICISM']),
  edge('edge-epicurean-stoa', 'ph-school-epicurean', 'ph-tradition-early-stoa', 'contemporaneous-dialogue', 'high', 'E1', ['SEP-STOICISM']),
  edge('edge-academy-middle-platonism', 'ph-school-old-academy', 'ph-tradition-middle-platonism', 'transmission', 'medium', 'E2', ['SEP-MIDDLE-PLATONISM']),
  edge('edge-middle-academic-critique', 'ph-tradition-middle-platonism', 'ph-school-academic-skepticism', 'critique', 'medium', 'E2', ['SEP-MIDDLE-PLATONISM']),
  edge('edge-plato-middle-platonism', 'ph-thinker-plato', 'ph-tradition-middle-platonism', 'revival', 'high', 'E1', ['SEP-MIDDLE-PLATONISM']),
  edge('edge-aristotle-middle-platonism', 'ph-thinker-aristotle', 'ph-tradition-middle-platonism', 'synthesis', 'medium', 'E2', ['SEP-MIDDLE-PLATONISM']),
  edge('edge-pythagorean-neopythagorean', 'ph-tradition-pythagorean', 'ph-tradition-neopythagorean', 'revival', 'high', 'E2', ['SEP-PYTH']),
  edge('edge-middle-philo', 'ph-tradition-middle-platonism', 'ph-thinker-philo', 'synthesis', 'high', 'E2', ['SEP-PHILO']),
  edge('edge-stoa-philo', 'ph-tradition-early-stoa', 'ph-thinker-philo', 'synthesis', 'medium', 'E2', ['SEP-PHILO']),
  edge('edge-middle-plotinus', 'ph-tradition-middle-platonism', 'ph-thinker-plotinus', 'transmission', 'high', 'E2', ['SEP-PLOTINUS']),
  edge('edge-plato-plotinus', 'ph-thinker-plato', 'ph-thinker-plotinus', 'revival', 'high', 'E1', ['SEP-PLOTINUS']),
  edge('edge-aristotle-plotinus', 'ph-thinker-aristotle', 'ph-thinker-plotinus', 'synthesis', 'high', 'E1', ['SEP-PLOTINUS']),
  edge('edge-stoa-plotinus', 'ph-tradition-early-stoa', 'ph-thinker-plotinus', 'synthesis', 'medium', 'E1', ['SEP-PLOTINUS']),
  edge('edge-plotinus-porphyry', 'ph-thinker-plotinus', 'ph-thinker-porphyry', 'teacher-student', 'high', 'E1', ['SEP-PLOTINUS']),
  edge('edge-porphyry-iamblichean', 'ph-thinker-porphyry', 'ph-tradition-iamblichean', 'influence', 'high', 'E1', ['SEP-IAMBLICHUS']),
  edge('edge-iamblichean-porphyry-critique', 'ph-tradition-iamblichean', 'ph-thinker-porphyry', 'critique', 'high', 'E1', ['SEP-IAMBLICHUS']),
  edge('edge-iamblichean-athens', 'ph-tradition-iamblichean', 'ph-school-athenian-neoplatonism', 'transmission', 'high', 'E2', ['SEP-IAMBLICHUS', 'SEP-PROCLUS']),
  edge('edge-iamblichean-alexandria', 'ph-tradition-iamblichean', 'ph-school-alexandrian-neoplatonism', 'transmission', 'high', 'E2', ['SEP-NEOPLATONISM']),
  edge('edge-athens-alexandria', 'ph-school-athenian-neoplatonism', 'ph-school-alexandrian-neoplatonism', 'contemporaneous-dialogue', 'high', 'E1', ['SEP-NEOPLATONISM']),
  edge('edge-middle-patristic', 'ph-tradition-middle-platonism', 'ph-tradition-patristic-platonism', 'synthesis', 'medium', 'E2', ['SEP-NEOPLATONISM']),
  edge('edge-philo-patristic', 'ph-thinker-philo', 'ph-tradition-patristic-platonism', 'transmission', 'medium', 'E2', ['SEP-PHILO']),
  edge('edge-plotinus-augustine', 'ph-thinker-plotinus', 'ph-thinker-augustine', 'influence', 'medium', 'E2', ['SEP-AUGUSTINE']),
  edge('edge-porphyry-augustine', 'ph-thinker-porphyry', 'ph-thinker-augustine', 'influence', 'contested', 'E3', ['SEP-AUGUSTINE']),
  edge('edge-patristic-augustine', 'ph-tradition-patristic-platonism', 'ph-thinker-augustine', 'transmission', 'high', 'E1', ['SEP-AUGUSTINE']),
  edge('edge-athens-dionysius', 'ph-school-athenian-neoplatonism', 'ph-thinker-pseudo-dionysius', 'influence', 'high', 'E2', ['SEP-DIONYSIUS', 'SEP-PROCLUS']),
  edge('edge-aristotle-boethius', 'ph-thinker-aristotle', 'ph-thinker-boethius', 'transmission', 'high', 'E1', ['SEP-ARISTOTLE']),
  edge('edge-porphyry-boethius', 'ph-thinker-porphyry', 'ph-thinker-boethius', 'transmission', 'high', 'E1', ['SEP-NEOPLATONISM']),
  edge('edge-augustine-scholastic', 'ph-thinker-augustine', 'ph-tradition-latin-scholastic', 'transmission', 'high', 'E1', ['SEP-AUGUSTINE']),
  edge('edge-dionysius-scholastic', 'ph-thinker-pseudo-dionysius', 'ph-tradition-latin-scholastic', 'transmission', 'high', 'E1', ['SEP-DIONYSIUS']),
  edge('edge-boethius-scholastic', 'ph-thinker-boethius', 'ph-tradition-latin-scholastic', 'transmission', 'high', 'E1', ['SEP-NEOPLATONISM']),
  edge('edge-peripatetic-scholastic', 'ph-school-peripatetic', 'ph-tradition-latin-scholastic', 'revival', 'medium', 'E2', ['SEP-ARISTOTLE'], 'An incomplete bridge until Arabic, Byzantine, and translation-movement corpora exist.')
]);

const journey = (id, title, anchorIds, description, segments, estimatedMinutes) => {
  const publishable = publishableJourneyIds.has(id);
  return {
    id,
    domain: 'philosophy',
    kind: 'journey',
    title,
    anchorIds,
    description,
    segments: segments.map(([passageId, role]) => ({ passageId, role })),
    openRequirements: [],
    estimatedMinutes,
    status: publishable ? 'publishable' : 'blocked',
    ...(publishable ? {} : {
      blockedReason: 'Rights-cleared passage payload is not yet available.'
    })
  };
};

export const PHILOSOPHY_JOURNEYS = Object.freeze([
  journey('seq-ph-archai-being', 'From Origin to Being', ['ph-school-milesian', 'ph-thinker-heraclitus', 'ph-school-eleatic', 'ph-tradition-pluralists'], 'Early accounts of nature encounter the Eleatic demand to think being.', [['pass-anaximander-fragment', 'proposition'], ['pass-heraclitus-logos', 'response'], ['pass-parmenides-being', 'critique'], ['pass-empedocles-roots', 'response'], ['pass-aristotle-first-causes', 'aftermath']], 15),
  journey('seq-ph-socratic-turn', 'The Examined Life', ['ph-movement-sophistic', 'ph-tradition-socratic', 'ph-thinker-plato'], 'Rhetoric, examination, and the possibility of learning.', [['pass-protagoras-measure', 'context'], ['pass-socrates-apology', 'proposition'], ['pass-plato-recollection', 'response']], 12),
  journey('seq-ph-plato-ascent', 'Line, Cave, Return', ['ph-thinker-plato'], 'Knowledge, education, and the obligation to return.', [['pass-plato-divided-line', 'proposition'], ['pass-plato-cave', 'aftermath']], 10),
  journey('seq-ph-plato-aristotle', 'Forms and Substance', ['ph-thinker-plato', 'ph-thinker-aristotle'], 'Two architectures of intelligibility.', [['pass-plato-forms', 'proposition'], ['pass-aristotle-substance', 'response'], ['pass-aristotle-soul', 'aftermath']], 13),
  journey('seq-ph-three-therapies', 'Three Therapies of Judgment', ['ph-school-epicurean', 'ph-tradition-early-stoa', 'ph-school-pyrrhonism'], 'Epicurean, Stoic, and skeptical practices placed in deliberate tension.', [['pass-epicurus-gods-death', 'proposition'], ['pass-epictetus-control', 'response'], ['pass-sextus-skeptical-way', 'critique']], 12),
  journey('seq-ph-stoic-practice', 'The Work of Assent', ['ph-tradition-roman-stoa'], 'Judgment and practice in Roman Stoicism.', [['pass-epictetus-control', 'proposition'], ['pass-seneca-inner-spirit', 'response'], ['pass-marcus-morning', 'aftermath']], 11),
  journey('seq-ph-suspension', 'Continue to Search', ['ph-school-pyrrhonism', 'ph-school-academic-skepticism'], 'The distinct projects grouped under ancient skepticism.', [['pass-sextus-skeptical-way', 'proposition'], ['pass-cicero-academic', 'response']], 10),
  journey('seq-ph-platonism-one', 'Toward the One', ['ph-tradition-middle-platonism', 'ph-thinker-philo', 'ph-thinker-plotinus'], 'Imperial transformations of Platonist metaphysics.', [['pass-plato-cosmos', 'context'], ['pass-philo-creation', 'transmission'], ['pass-plotinus-beauty', 'proposition'], ['pass-plotinus-hypostases', 'aftermath']], 14),
  journey('seq-ph-theurgy-system', 'Reason, Rite, Hierarchy', ['ph-thinker-porphyry', 'ph-tradition-iamblichean', 'ph-school-athenian-neoplatonism'], 'The debate over intellect, ritual, and ascent.', [['pass-porphyry-isagoge', 'context'], ['pass-iamblichus-theurgy', 'response'], ['pass-proclus-propositions', 'aftermath']], 12),
  journey('seq-ph-latin-transmission', 'The Inward and the Eternal', ['ph-thinker-augustine', 'ph-thinker-pseudo-dionysius', 'ph-thinker-boethius'], 'Three channels through which Platonist inheritances enter Latin thought.', [['pass-augustine-platonic-books', 'transmission'], ['pass-dionysius-mystical', 'response'], ['pass-boethius-eternity', 'aftermath']], 14)
]);

export const PHILOSOPHY_RESEARCH_SOURCES = Object.freeze({
  'SEP-PRE': { label: 'SEP: Presocratic Philosophy', href: 'https://plato.stanford.edu/entries/presocratics/' },
  'SEP-XENOPHANES': { label: 'SEP: Xenophanes', href: 'https://plato.stanford.edu/entries/xenophanes/' },
  'SEP-PYTH': { label: 'SEP: Pythagoras', href: 'https://plato.stanford.edu/entries/pythagoras/' },
  'SEP-HER': { label: 'SEP: Heraclitus', href: 'https://plato.stanford.edu/entries/heraclitus/' },
  'SEP-PAR': { label: 'SEP: Parmenides', href: 'https://plato.stanford.edu/entries/parmenides/' },
  'SEP-SOPH': { label: 'SEP: The Sophists', href: 'https://plato.stanford.edu/entries/sophists/' },
  'SEP-SOCR': { label: 'SEP: Socrates', href: 'https://plato.stanford.edu/entries/socrates/' },
  'SEP-PLATO': { label: 'SEP: Plato', href: 'https://plato.stanford.edu/entries/plato/' },
  'SEP-CYN': { label: 'SEP: Ancient Ethical Theory', href: 'https://plato.stanford.edu/entries/ethics-ancient/' },
  'SEP-CYR': { label: 'SEP: The Cyrenaics', href: 'https://plato.stanford.edu/entries/cyrenaics/' },
  'SEP-MEG': { label: 'SEP: Stoicism', href: 'https://plato.stanford.edu/entries/stoicism/' },
  'SEP-ACADEMY': { label: 'SEP: Ancient Skepticism', href: 'https://plato.stanford.edu/entries/skepticism-ancient/' },
  'SEP-ARISTOTLE': { label: 'SEP: Aristotle', href: 'https://plato.stanford.edu/entries/aristotle/' },
  'SEP-EPICURUS': { label: 'SEP: Epicurus', href: 'https://plato.stanford.edu/entries/epicurus/' },
  'SEP-STOICISM': { label: 'SEP: Stoicism', href: 'https://plato.stanford.edu/entries/stoicism/' },
  'SEP-SKEPTICISM': { label: 'SEP: Ancient Skepticism', href: 'https://plato.stanford.edu/entries/skepticism-ancient/' },
  'SEP-PYRRHO': { label: 'SEP: Pyrrho', href: 'https://plato.stanford.edu/entries/pyrrho/' },
  'SEP-MIDDLE-PLATONISM': { label: 'SEP: Plutarch', href: 'https://plato.stanford.edu/archives/fall2025/entries/plutarch/' },
  'SEP-PHILO': { label: 'SEP: Philo of Alexandria', href: 'https://plato.stanford.edu/entries/philo/' },
  'SEP-PLOTINUS': { label: 'SEP: Plotinus', href: 'https://plato.stanford.edu/entries/plotinus/' },
  'SEP-IAMBLICHUS': { label: 'SEP: Iamblichus', href: 'https://plato.stanford.edu/entries/iamblichus/' },
  'SEP-AMMONIUS': { label: 'SEP: Ammonius', href: 'https://plato.stanford.edu/entries/ammonius/' },
  'SEP-PROCLUS': { label: 'SEP: Proclus', href: 'https://plato.stanford.edu/entries/proclus/' },
  'SEP-NEOPLATONISM': { label: 'SEP: Neoplatonism', href: 'https://plato.stanford.edu/archives/sum2022/entries/neoplatonism/' },
  'SEP-AUGUSTINE': { label: 'SEP: Augustine', href: 'https://plato.stanford.edu/entries/augustine/' },
  'SEP-PORPHYRY': { label: 'SEP: Porphyry', href: 'https://plato.stanford.edu/entries/porphyry/' },
  'SEP-DIONYSIUS': { label: 'SEP: Pseudo-Dionysius', href: 'https://plato.stanford.edu/archives/fall2019/entries/pseudo-dionysius-areopagite/' }
});

export const PHILOSOPHY_CORPUS = freezeManifest({
  id: 'atrium-philosophy-ancient-foundations',
  schemaVersion: ATRIUM_SCHEMA_VERSION,
  corpusVersion: ATRIUM_CORPUS_VERSION,
  label: 'Ancient Foundations',
  status: 'draft',
  nodes: PHILOSOPHY_NODES,
  edges: PHILOSOPHY_EDGES,
  journeys: PHILOSOPHY_JOURNEYS,
  researchSources: PHILOSOPHY_RESEARCH_SOURCES
});
