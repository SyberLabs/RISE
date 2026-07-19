import { freezeManifest } from './constants.js';

export const ATRIUM_EDITORIAL_REVIEW_VERSION = 'gate-c.1';
export const ATRIUM_EDITORIAL_REVIEW_DATE = '2026-07-17';

const review = (note, citationRefs, details = {}) => freezeManifest({
  version: ATRIUM_EDITORIAL_REVIEW_VERSION,
  stage: 'editorial',
  reviewedOn: ATRIUM_EDITORIAL_REVIEW_DATE,
  specialistSignoff: false,
  note,
  citationRefs: [...citationRefs],
  ...details
});

export const PHILOSOPHY_SURVIVAL_NOTES = freezeManifest({
  'ph-school-milesian': 'Milesian doctrines are reconstructed chiefly through later reports; only one short sentence attributed to Anaximander survives as a direct quotation.',
  'ph-tradition-pythagorean': 'Early Pythagorean evidence is layered with later reconstruction and legend, so doctrines cannot be assigned confidently to Pythagoras himself.',
  'ph-thinker-xenophanes': 'Xenophanes survives in poetic fragments quoted by later authors rather than in a complete work.',
  'ph-thinker-heraclitus': 'Heraclitus’s book is lost; later authors preserve quotations whose original order and context are uncertain.',
  'ph-school-eleatic': 'Parmenides survives through substantial poem fragments, while Zeno and Melissus are known through a mixture of fragments and later reports.',
  'ph-tradition-pluralists': 'The works of Empedocles and Anaxagoras survive incompletely through fragments, papyri, and later testimony.',
  'ph-school-atomism': 'The writings of Leucippus and Democritus are lost; their physical theories are reconstructed from fragments and often polemical testimony.',
  'ph-movement-sophistic': 'Evidence varies sharply by figure and often comes through Platonic or Aristotelian criticism rather than intact sophistic works.',
  'ph-tradition-socratic': 'Socrates wrote nothing; Plato, Xenophon, Aristophanes, and later traditions preserve materially different portraits.',
  'ph-school-cynicism': 'Early Cynic genealogy and many Diogenes anecdotes depend on much later witnesses and remain disputed.',
  'ph-school-cyrenaic': 'Most Cyrenaic positions are reconstructed from later doxography rather than complete writings by the school’s early figures.',
  'ph-school-megarian': 'Megarian and Dialectical doctrines survive mainly in scattered reports about individual arguments and figures.',
  'ph-school-old-academy': 'Most writings of Plato’s immediate successors are lost, leaving later testimony and fragments as the principal evidence.',
  'ph-school-peripatetic': 'The tradition spans extant Aristotelian works, fragmentary successors, and later commentary; it is not a single preserved corpus.',
  'ph-tradition-early-stoa': 'The foundational Stoic treatises are lost and must be reconstructed from later quotations, summaries, and critics.',
  'ph-school-pyrrhonism': 'Pyrrho left no writings; the tradition is mediated through Timon, later revival, and the substantially later works of Sextus Empiricus.',
  'ph-school-academic-skepticism': 'Arcesilaus and Carneades left no philosophical works; their positions are reconstructed through later witnesses including Cicero and Sextus.',
  'ph-tradition-middle-platonism': '“Middle Platonism” is a modern grouping of diverse authors, many of whose works survive only partially.',
  'ph-tradition-neopythagorean': 'Neopythagoreanism is a modern umbrella for varied imperial-period revivals, pseudonymous texts, and reconstructed lineages.',
  'ph-thinker-porphyry': 'Porphyry’s oeuvre survives unevenly: some works are complete, others fragmentary, and his edition shapes the transmitted order of Plotinus.',
  'ph-tradition-iamblichean': 'Iamblichus and his school are represented by surviving works, fragments, later reports, and difficult questions of attribution.',
  'ph-school-athenian-neoplatonism': 'The Athenian school is preserved through an uneven mixture of systematic works, commentaries, biographies, and lost teaching traditions.',
  'ph-school-alexandrian-neoplatonism': 'The Alexandrian label gathers several generations and religious contexts whose works and classroom traditions survive unevenly.'
});

export function createPhilosophyNodeReview({ id, summary, sourceRefs }) {
  const survivalNote = PHILOSOPHY_SURVIVAL_NOTES[id] || null;
  return review(summary, sourceRefs, {
    ...(survivalNote ? { survivalNote, cautions: ['fragmentary-or-mediated-survival'] } : { cautions: [] })
  });
}

const edgeReview = (note, details = {}) => ({ note, ...details });

export const PHILOSOPHY_EDGE_REVIEWS = freezeManifest({
  'edge-pythagorean-plato': edgeReview('Plato engages mathematical harmony, soul migration, and forms of life associated with Pythagorean traditions, but direct lines of borrowing remain difficult to isolate.'),
  'edge-heraclitus-plato': edgeReview('Platonic discussions of flux respond to doctrines associated with Heraclitus, although Plato’s dramatic presentation should not be treated as a neutral report.'),
  'edge-pluralists-eleatic': edgeReview('Empedocles and Anaxagoras preserve enduring constituents while explaining change, a strategy intelligible against Eleatic constraints on coming-to-be.'),
  'edge-atomism-eleatic': edgeReview('Atomists retain ungenerated and imperishable beings while admitting void, plurality, and motion, thereby answering Eleatic arguments with a new ontology.'),
  'edge-eleatic-plato': edgeReview('Plato repeatedly stages Eleatic problems of being, unity, predication, and appearance, especially through the figure of Parmenides.'),
  'edge-sophists-socratic': edgeReview('Sophists and Socrates share an Athenian culture of argument and education, but their aims and methods are presented differently by competing witnesses.'),
  'edge-plato-sophists': edgeReview('Plato’s dialogues criticize sophistic claims about teaching, rhetoric, knowledge, and payment while also preserving much of the surviving evidence about them.'),
  'edge-socratic-plato': edgeReview('Plato makes Socratic examination foundational to his dialogues, while the literary Socrates cannot be identified without remainder with the historical figure.'),
  'edge-socratic-cynicism': edgeReview('Ancient tradition connects Cynic practice to Socratic independence and frank speech, but the Antisthenes-to-Diogenes genealogy is not secure.'),
  'edge-socratic-cyrenaics': edgeReview('Aristippus was remembered as a Socratic associate, and later Cyrenaic ethics developed a distinct account of pleasure and present experience.'),
  'edge-socratic-megarians': edgeReview('Euclides of Megara was remembered among Socrates’s associates; later Megarian and Dialectical work developed along logical paths not reducible to Socrates.'),
  'edge-plato-academy': edgeReview('The Old Academy is Plato’s institutional succession, though Speusippus, Xenocrates, and later heads revised rather than simply repeated his philosophy.'),
  'edge-plato-aristotle-teaching': edgeReview('Aristotle studied in Plato’s Academy for roughly two decades; this biographical relation does not imply doctrinal agreement.'),
  'edge-aristotle-plato-critique': edgeReview('Aristotle develops sustained criticisms of separately existing Forms while retaining and transforming many Platonic questions and distinctions.'),
  'edge-aristotle-peripatetic': edgeReview('The Lyceum and its successors continue Aristotle’s organized inquiry, textual work, and commentary while changing across centuries.'),
  'edge-atomism-epicurean': edgeReview('Epicurean physics adapts Democritean atomism while revising its account of motion, explanation, perception, and ethical consequence.'),
  'edge-cynicism-stoa': edgeReview('Zeno’s study with Crates and the early Stoic emphasis on life according to nature support a Cynic inheritance, later integrated into a systematic philosophy.'),
  'edge-megarian-stoa': edgeReview('Ancient reports connect Zeno and other early Stoics with Megarian and Dialectical teachers; the relation is strongest in the history of logic and argument.'),
  'edge-stoa-roman': edgeReview('Seneca, Epictetus, and Marcus Aurelius inherit the early Stoic system through teaching, summaries, and practice, with different emphases and genres.'),
  'edge-academy-skepticism': edgeReview('Academic Skepticism is an institutional phase of Plato’s Academy beginning with Arcesilaus, not a separate school simply replacing it from outside.'),
  'edge-academic-stoa': edgeReview('Academic arguments target the Stoic cognitive impression and criterion of truth, making the two traditions principal Hellenistic interlocutors.'),
  'edge-epicurean-stoa': edgeReview('Epicureans and Stoics offer rival accounts of nature, providence, pleasure, freedom, and the good within the same Hellenistic field.'),
  'edge-academy-middle-platonism': edgeReview('Imperial Platonists inherit Academy traditions selectively; the proposed continuity is intellectual rather than an unbroken institutional succession.'),
  'edge-middle-academic-critique': edgeReview('Many imperial Platonists define renewed dogmatic readings of Plato partly against the Academy’s skeptical phase.'),
  'edge-plato-middle-platonism': edgeReview('Middle Platonists construct systematic readings of Plato from dialogues and later school traditions; “revival” names this reception, not a single doctrine.'),
  'edge-aristotle-middle-platonism': edgeReview('Imperial Platonists use Aristotelian concepts and texts within Platonist systems, producing selective synthesis as well as criticism.'),
  'edge-pythagorean-neopythagorean': edgeReview('Imperial authors revive Pythagorean authority and practices, often through retrospective or pseudonymous constructions rather than direct institutional continuity.'),
  'edge-middle-philo': edgeReview('Philo’s scriptural exegesis draws on the diverse Platonist vocabulary of his period without making him a member of a single Middle Platonist school.'),
  'edge-stoa-philo': edgeReview('Philo also employs Stoic concepts of reason, nature, and ethics, reworking them within Jewish scriptural interpretation.'),
  'edge-middle-plotinus': edgeReview('Plotinus inherits problems, vocabulary, and exegetical practices from earlier imperial Platonists while reorganizing them into a distinctive metaphysics.'),
  'edge-plato-plotinus': edgeReview('Plotinus presents himself as an interpreter of Plato; “revival” here includes creative, systematic reconstruction rather than simple recovery.'),
  'edge-aristotle-plotinus': edgeReview('Plotinus assumes close knowledge of Aristotle and uses Aristotelian analysis even where he rejects Aristotelian conclusions.'),
  'edge-plotinus-porphyry': edgeReview('Porphyry studied with Plotinus and edited the Enneads, making this both a teacher–student relation and a decisive act of textual transmission.'),
  'edge-porphyry-iamblichean': edgeReview('Iamblichus likely studied with Porphyry and develops positions inherited from him, while sharply rejecting Porphyry on soul and theurgy.'),
  'edge-iamblichean-athens': edgeReview('Iamblichean metaphysics, exegesis, and theurgy shape later Athenian Platonism, although more than a century separates Iamblichus from the mature Athenian school.'),
  'edge-athens-alexandria': edgeReview('Athenian and Alexandrian teaching traditions exchange texts, teachers, and commentary practices; they should not be reduced to a simple center-and-branch model.'),
  'edge-middle-patristic': edgeReview('Christian authors adopt, transform, and contest Platonist concepts across distinct settings; the relation is plural rather than a single synthesis.'),
  'edge-philo-patristic': edgeReview('Philo becomes an important precedent for later Christian scriptural exegesis, though routes of reception differ by author and period.'),
  'edge-plotinus-augustine': edgeReview('Augustine describes reading Latin “books of the Platonists”; Plotinian influence is strong, while the exact translated corpus remains debated.'),
  'edge-patristic-augustine': edgeReview('Augustine writes inside multiple Latin Christian traditions and reshapes Platonist concepts through scripture, doctrine, controversy, and pastoral concerns.'),
  'edge-athens-dionysius': edgeReview('Pseudo-Dionysius adapts late Athenian Neoplatonic structures, especially Proclean hierarchy and causality, into a Christian apophatic corpus.'),
  'edge-aristotle-boethius': edgeReview('Boethius translates and comments on Aristotelian logic, becoming a major Latin conduit for the ancient logical curriculum.'),
  'edge-porphyry-boethius': edgeReview('Boethius’s treatment of Porphyry’s Isagoge transmits the problem of universals and the late antique logical curriculum into Latin learning.'),
  'edge-augustine-scholastic': edgeReview('Augustine remains a major Latin authority on mind, language, time, will, and theology across diverse medieval schools.'),
  'edge-dionysius-scholastic': edgeReview('Latin translations and commentaries give the Dionysian corpus a major role in medieval accounts of hierarchy, causality, and negative theology.'),
  'edge-boethius-scholastic': edgeReview('Boethius supplies Latin logical texts and the Consolation to medieval readers, joining technical curriculum and philosophical theology.'),
  'edge-peripatetic-scholastic': edgeReview('The medieval recovery of Aristotle depends on Greek, Arabic, Byzantine, and Latin translation networks; the edge remains a reception anchor, not a direct leap.')
});

export function findPhilosophyEdgeReview(edge) {
  const prepared = PHILOSOPHY_EDGE_REVIEWS[edge.id];
  if (!prepared) return null;
  return review(prepared.note, edge.citationRefs, {
    cautions: edge.confidence === 'contested' ? ['contested-relationship'] : [],
    ...prepared
  });
}

export function createHistoryEventReview({ summary, sourceRefs, dates }) {
  return review(summary, sourceRefs, {
    dateBasis: `Display precision “${dates.display}” is constrained to the cited research record; numeric coordinates are visualization anchors, not added day precision.`,
    cautions: []
  });
}
