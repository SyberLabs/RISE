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
  'seq-ph-socratic-turn',
  'seq-ph-plato-ascent',
  'seq-ph-plato-aristotle',
  'seq-ph-latin-transmission'
]);

export const HISTORY_PILOT_JOURNEY_IDS = Object.freeze([
  'seq-hist-empire-debt-resistance',
  'seq-hist-declaration-claim',
  'seq-hist-faction-constitution',
  'seq-hist-rights-exclusions'
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
    reason: 'Only the historical Federalist text is packaged; modern Princeton editorial annotations and apparatus are excluded.'
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
  }
]);

export const ATRIUM_PILOT_PACK = freezeManifest({
  id: 'atrium-pilot-v1',
  label: 'Atrium Pilot: Ancient Foundations and Atlantic Revolutions',
  version: '1.0.0',
  schemaVersion: '1.0.0',
  status: 'publishable',
  reviewedAt: '2026-07-17',
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
