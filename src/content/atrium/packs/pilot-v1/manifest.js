import { freezeManifest } from '../../constants.js';
import { ATRIUM_PILOT_INTEGRITY } from './integrity.js';
import {
  ATRIUM_PASSAGE_AUDITS,
  HISTORY_PILOT_PASSAGE_IDS,
  PHILOSOPHY_PILOT_PASSAGE_IDS
} from './passage-audit.js';
import { HISTORY_SOURCE_AUDITS } from './source-audit-history.js';
import { PHILOSOPHY_SOURCE_AUDITS } from './source-audit-philosophy.js';

export const ATRIUM_SOURCE_AUDITS = Object.freeze({
  ...PHILOSOPHY_SOURCE_AUDITS,
  ...HISTORY_SOURCE_AUDITS
});

export const PHILOSOPHY_PILOT_JOURNEY_IDS = Object.freeze([
  'seq-ph-three-therapies',
  'seq-ph-suspension',
  'seq-ph-archai-being',
  'seq-ph-socratic-turn',
  'seq-ph-plato-ascent',
  'seq-ph-plato-aristotle',
  'seq-ph-platonism-one',
  'seq-ph-stoic-practice',
  'seq-ph-theurgy-system',
  'seq-ph-latin-transmission'
]);

export const HISTORY_PILOT_JOURNEY_IDS = Object.freeze([
  'seq-hist-1848-unfinished',
  'seq-hist-empire-debt-resistance',
  'seq-hist-declaration-claim',
  'seq-hist-faction-constitution',
  'seq-hist-association-confederation-amendment',
  'seq-hist-crowd-testimony-publicity',
  'seq-hist-rights-exclusions',
  'seq-hist-france-1789-1794',
  'seq-hist-revolution-settlement-1789-1815',
  'seq-hist-haiti-freedom-state',
  'seq-hist-abolition-law-limit',
  'seq-hist-spanish-america',
  'seq-hist-hemisphere-doctrine',
  'seq-hist-treaties-atlantic-order',
  'seq-hist-machines-patents-production',
  'seq-hist-war-independence',
  'seq-hist-independence-many-models'
]);

export const ATRIUM_PILOT_EXCLUSIONS = freezeManifest([
  {
    id: 'exclude-mit-classics-as-canonical-edition',
    scope: 'source',
    decision: 'excluded',
    reason: 'The page carries useful text but does not supply the edition and reuse metadata required by this pack. The 1908 Ross scan-backed edition is used instead.'
  },
  {
    id: 'exclude-project-gutenberg-wrapper',
    scope: 'payload',
    decision: 'excluded',
    reason: 'Project Gutenberg license, credits, editorial introductions, and trademark language are not part of any runtime excerpt.'
  },
  {
    id: 'exclude-founders-online-annotations',
    scope: 'payload',
    decision: 'excluded',
    reason: 'Only identified historical document text is packaged from Founders Online; modern Princeton and University of Virginia Press introductions, annotations, source notes, and apparatus are excluded.'
  },
  {
    id: 'exclude-uk-national-archives-teaching-wrapper',
    scope: 'payload',
    decision: 'excluded',
    reason: 'The Boston Tea Party payloads contain only the identified 1773 newspaper extract and Leslie letter. Modern introductions, glossary expansions, teaching prompts, images, captions, and navigation are excluded.'
  },
  {
    id: 'exclude-maillard-as-transparent-womens-voice',
    scope: 'editorial',
    decision: 'excluded',
    reason: 'Maillard is retained as a named male mediator giving a self-exculpatory deposition, not relabeled as direct testimony by the women or treated as an omniscient account of the march.'
  },
  {
    id: 'exclude-modern-de-gouges-editions',
    scope: 'source',
    decision: 'excluded',
    reason: 'Modern edited and translated editions remain protected. The original French historical text is collated to institutional sources.'
  },
  {
    id: 'exclude-silent-modern-translation',
    scope: 'editorial',
    decision: 'excluded',
    reason: 'French and Spanish primary texts remain in their audited original language. No uncredited or generated English translation enters the pack.'
  },
  {
    id: 'exclude-provider-wide-rights-inference',
    scope: 'rights',
    decision: 'excluded',
    reason: 'No provider is treated as blanket-cleared. Rights evidence is recorded per selected edition or institutional transcript.'
  },
  {
    id: 'exclude-modern-layout-and-commentary',
    scope: 'payload',
    decision: 'excluded',
    reason: 'Contemporary PDF layout, introductions, footnotes, commentary, and annotations are never copied into the runtime text.'
  },
  {
    id: 'exclude-guardian-2025-wrapper',
    scope: 'payload',
    decision: 'excluded',
    reason: 'Only the two identified 1825 historical records are packaged. The Guardian’s 2025 headline, introduction, image, links, layout, and editorial wrapper are excluded.'
  },
  {
    id: 'exclude-napoleon-series-wrapper',
    scope: 'payload',
    decision: 'excluded',
    reason: 'The Napoleon Series page is used only to collate the historical Anderson translation; its modern introduction, navigation, and editorial framing are excluded.'
  },
  {
    id: 'exclude-arcpa-editorial-apparatus',
    scope: 'payload',
    decision: 'excluded',
    reason: 'The Thermidor payload contains only the historical Convention proceedings; modern Archives parlementaires headings, citations, witness variants, footnotes, and editorial apparatus are excluded.'
  },
  {
    id: 'exclude-misattributed-sonthonax-wdl-14722',
    scope: 'source',
    decision: 'excluded',
    reason: 'The scan commonly described as Sonthonax’s 29 August emancipation proclamation is a different May 1793 measure on marriage and manumission. The contemporary John Carter Brown Library broadside is used instead.'
  }
]);

export const ATRIUM_PILOT_PACK = freezeManifest({
  id: 'atrium-pilot-v1',
  label: 'Atrium Pilot: Ancient Foundations and Atlantic Revolutions',
  version: '1.16.0',
  schemaVersion: '1.1.0',
  status: 'publishable',
  reviewedAt: '2026-07-20',
  rightsJurisdiction: 'US',
  rightsNotice: 'US-oriented editorial review for this release artifact; not a global legal conclusion.',
  acquisitionScope: 'selected excerpt units, not complete provider editions',
  philosophy: {
    passageIds: PHILOSOPHY_PILOT_PASSAGE_IDS,
    journeyIds: PHILOSOPHY_PILOT_JOURNEY_IDS
  },
  history: {
    passageIds: HISTORY_PILOT_PASSAGE_IDS,
    journeyIds: HISTORY_PILOT_JOURNEY_IDS
  },
  sourceIds: Object.keys(ATRIUM_SOURCE_AUDITS),
  payloadIds: Object.keys(ATRIUM_PASSAGE_AUDITS),
  exclusions: ATRIUM_PILOT_EXCLUSIONS
});

export {
  ATRIUM_PASSAGE_AUDITS,
  ATRIUM_PILOT_INTEGRITY,
  HISTORY_PILOT_PASSAGE_IDS,
  PHILOSOPHY_PILOT_PASSAGE_IDS
};
