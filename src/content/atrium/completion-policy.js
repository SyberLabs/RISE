import { freezeManifest } from './constants.js';

const REVIEWED_ON = '2026-07-20';

const policy = (disposition, rationale, revisitTrigger = null) => ({
  disposition,
  rationale,
  reviewedOn: REVIEWED_ON,
  revisitTrigger
});

// Decisions from the corpus-completion audit. Records not named here are already
// launch-covered and inherit the default launch-required policy below.
export const AUDITED_COMPLETION_POLICIES = freezeManifest({
  'ph-period-early-greek': policy(
    'alignment-repair',
    'The existing From Origin to Being journey already represents this framing period; coverage belongs on that journey rather than on a duplicate point.'
  ),
  'ph-tradition-pythagorean': policy(
    'launch-required',
    'This current-corpus tradition can sustain a mediated-testimony experience once its late witnesses and fragmentary early evidence receive specialist framing.'
  ),
  'ph-thinker-xenophanes': policy(
    'launch-required',
    'A fragment-and-witness experience is required after edition and fragment-number concordance review.'
  ),
  'ph-school-cynicism': policy(
    'launch-required',
    'This Socratic successor requires a launch that identifies anecdotal doxography as mediated testimony rather than direct biography.'
  ),
  'ph-school-cyrenaic': policy(
    'launch-required',
    'This Socratic successor requires a launch that distinguishes later reconstruction from a surviving school treatise.'
  ),
  'ph-school-megarian': policy(
    'launch-required',
    'This Socratic successor requires a source-bounded launch with argument-level attribution across scattered reports.'
  ),
  'ph-school-old-academy': policy(
    'launch-required',
    'The early Academy requires a launch that separates institutional succession from claims of doctrinal unity.'
  ),
  'ph-tradition-neopythagorean': policy(
    'launch-required',
    'The imperial revival requires a launch that does not project late-antique reconstruction backward onto early Pythagoreanism.'
  ),
  'ph-school-alexandrian-neoplatonism': policy(
    'context-only',
    'The heterogeneous Alexandrian commentary tradition remains a reviewed map context until it can be represented across generational and religious differences.',
    'Reopen when reusable editions and translations can support a multi-voice Alexandrian commentary journey.'
  ),
  'ph-tradition-patristic-platonism': policy(
    'alignment-repair',
    'The existing Latin transmission journey already contains distinct Christian transformations through Augustine and Pseudo-Dionysius.'
  ),
  'ph-tradition-latin-scholastic': policy(
    'context-only',
    'This reception horizon exceeds the Ancient Foundations pilot and should not imply a medieval corpus that does not yet exist.',
    'Reopen with a medieval expansion that includes Arabic, Byzantine, and translation-movement bridges.'
  ),
  'hist-social-contract': policy(
    'launch-required',
    'Rousseau belongs in the present revolutionary corpus and has a credible public-domain acquisition route.'
  ),
  'hist-boston-massacre': policy(
    'launch-required',
    'The event requires an evidence-centered launch pairing advocacy narrative with trial or prosecution testimony.'
  ),
  'hist-boston-tea-party': policy(
    'launch-required',
    'The event requires contemporaneous colonial and British witnesses rather than a launch built only from retrospective patriotic memory.'
  ),
  'hist-vermont-constitution': policy(
    'launch-required',
    'The constitution requires a launch that preserves the qualifications surrounding its freedom language.'
  ),
  'hist-articles-confederation': policy(
    'launch-required',
    'The instrument requires a launch centered on its own federal design rather than only its later reputation for failure.'
  ),
  'hist-womens-march': policy(
    'launch-required',
    'The march requires authenticated contemporary records that disclose institutional mediation of the participants voices.'
  ),
  'hist-us-bill-rights': policy(
    'launch-required',
    'The record requires a launch that distinguishes the twelve proposed amendments of 1789 from the ten ratified in 1791.'
  ),
  'hist-mexican-insurgency': policy(
    'evidence-bound',
    'No authoritative verbatim transcript of Hidalgo\'s Grito survives, so Atrium must not manufacture the obvious launch text.',
    'Reopen as an evidence-aware How We Know experience when later Hidalgo decrees and contemporary official responses are jointly audited.'
  ),
  'hist-argentina-independence': policy(
    'launch-required',
    'The short Tucuman act requires authenticated congressional context to sustain an honest launch.'
  ),
  'hist-mexico-independence': policy(
    'launch-required',
    'The independence record requires sources that distinguish military entry, constitutional settlement, guarantees, and sovereignty.'
  ),
  'hist-peru-independence': policy(
    'launch-required',
    'The Lima declaration requires records that preserve the continuing war and incomplete territorial control.'
  ),
  'hist-brazil-independence': policy(
    'launch-required',
    'Brazilian independence requires a process-based launch rather than reduction to a single declaration or cry.'
  ),
  'hist-british-emancipation': policy(
    'launch-required',
    'The end of apprenticeship requires parliamentary and colonial implementation evidence before it can close the abolition sequence honestly.'
  )
});

const DEFAULT_COMPLETION_POLICY = freezeManifest(policy(
  'launch-required',
  'This record belongs to the current corpus and its cleared point or curated journey must remain launchable.'
));

export function createCompletionPolicy(recordId) {
  const completion = AUDITED_COMPLETION_POLICIES[recordId] || DEFAULT_COMPLETION_POLICY;
  return { ...completion };
}
