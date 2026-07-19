export const ATRIUM_SPECIALIST_REVIEW_SCHEMA_VERSION = 'gate-c.specialist.1';

export const SPECIALIST_REVIEW_STATUSES = Object.freeze([
  'awaiting-specialist',
  'in-review',
  'decided'
]);

export const SPECIALIST_REVIEW_OUTCOMES = Object.freeze([
  'approved',
  'changes-requested',
  'rejected'
]);

export const SPECIALIST_REVIEW_DISPOSITIONS = Object.freeze([
  'retain',
  'revise',
  'remove'
]);
