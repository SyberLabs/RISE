export const ATRIUM_SCHEMA_VERSION = '1.0.0';
export const ATRIUM_CORPUS_VERSION = '0.3.1';
export const ATRIUM_PACK_JURISDICTION = 'US';

export function freezeManifest(value) {
  if (!value || typeof value !== 'object') return value;
  Object.values(value).forEach(freezeManifest);
  return Object.isFrozen(value) ? value : Object.freeze(value);
}

export const RECORD_STATUSES = Object.freeze([
  'draft',
  'reviewed',
  'rights-cleared',
  'publishable',
  'deprecated',
  'blocked'
]);

export const PHILOSOPHY_ERAS = Object.freeze([
  { id: 'early-greek', label: 'Early Greek Inquiry', order: 0 },
  { id: 'classical', label: 'The Classical Turn', order: 1 },
  { id: 'hellenistic', label: 'Hellenistic Schools', order: 2 },
  { id: 'imperial', label: 'Imperial Platonisms', order: 3 },
  { id: 'late-antique', label: 'Late Antique Platonisms', order: 4 },
  { id: 'transmission', label: 'Christian & Latin Transmission', order: 5 }
]);

export const PHILOSOPHY_NODE_KINDS = Object.freeze([
  'thinker',
  'school',
  'tradition',
  'movement',
  'period'
]);

export const RELATIONSHIP_TYPES = Object.freeze([
  'influence',
  'critique',
  'synthesis',
  'transmission',
  'revival',
  'institutional-succession',
  'teacher-student',
  'contemporaneous-dialogue'
]);

export const RELATIONSHIP_CONFIDENCE = Object.freeze(['high', 'medium', 'contested']);
export const EVIDENCE_LEVELS = Object.freeze(['E1', 'E2', 'E3']);
export const LAUNCH_STATUSES = Object.freeze(['source-review', 'ready']);
export const RIGHTS_STATUSES = Object.freeze([
  'public-domain-confirmed',
  'open-license-confirmed',
  'permission-confirmed',
  'link-only',
  'review-required',
  'restricted'
]);
export const PACKABLE_RIGHTS = Object.freeze([
  'public-domain-confirmed',
  'open-license-confirmed',
  'permission-confirmed'
]);
export const SHA256_CHECKSUM_PATTERN = /^sha256:[a-f0-9]{64}$/i;
export const JOURNEY_SEGMENT_ROLES = Object.freeze([
  'context',
  'proposition',
  'response',
  'critique',
  'countervoice',
  'transmission',
  'aftermath'
]);

export const HISTORY_LANES = Object.freeze([
  { id: 'war-empire', label: 'War & Empire', order: 0 },
  { id: 'politics-constitution', label: 'Politics & Constitutions', order: 1 },
  { id: 'ideas-publication', label: 'Ideas & Publications', order: 2 },
  { id: 'slavery-emancipation', label: 'Slavery & Emancipation', order: 3 },
  { id: 'social-movement', label: 'Social Movements', order: 4 },
  { id: 'economic-technology', label: 'Economy & Technology', order: 5 }
]);

export const HISTORY_RANGE = Object.freeze({ start: 1750, end: 1850 });
