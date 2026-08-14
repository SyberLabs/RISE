/**
 * Policy-bounded publication automation.
 *
 * A channel policy may authorize retries and scheduled delivery of an
 * already-approved artifact. It cannot approve a new artifact, waive
 * rights, hold destination secrets, or survive an emergency stop.
 * Credentials live only as opaque vault references; they never enter
 * the project, program, render job, or receipt.
 *
 * See AGENT-COMPOSITION-AND-RENDER-SPEC.md §12.3 and Stage E.
 */

import { looksLikeUri } from './render/hash.js';
import { RENDER_PROFILE_IDS } from './render/limits.js';
import {
  PUBLICATION_DESTINATION_KINDS,
  PUBLICATION_LIMITS,
  PublicationError,
  assertNoSecrets,
  deliverApproved
} from './publication.js';

export const CHANNEL_POLICY_SCHEMA = 'rise.channel-policy.v1';
export const CREDENTIAL_CUSTODY_SCHEMA = 'rise.credential-custody.v1';
export const PUBLICATION_AUDIT_SCHEMA = 'rise.publication-audit-event.v1';

export const POLICY_ESCALATIONS = Object.freeze([
  'unresolved-rights',
  'private-review',
  'missing-captions',
  'missing-credits'
]);

export const AUDIT_ACTIONS = Object.freeze([
  'adopt-policy',
  'emergency-stop',
  'clear-stop',
  'deliver',
  'withdraw',
  'escalate',
  'refuse',
  'rights-withdrawal'
]);

const POLICY_FIELDS = new Set([
  'schema', 'id', 'destinationKind', 'accountIdentity', 'profiles',
  'editorial', 'frequency', 'cost', 'moderation', 'rights',
  'accountable', 'emergencyStop', 'adoptedAt', 'adoptedBy'
]);
const EDITORIAL_FIELDS = new Set(['requireCaptions', 'requireCredits']);
const FREQUENCY_FIELDS = new Set(['maxDeliveriesPerDay', 'minIntervalMs']);
const COST_FIELDS = new Set(['maxCentsPerDay']);
const MODERATION_FIELDS = new Set(['escalateOn']);
const RIGHTS_POLICY_FIELDS = new Set(['requireResolved', 'renewOnWithdrawal']);
const ACTOR_FIELDS = new Set(['actor', 'authority', 'name']);
const CUSTODY_FIELDS = new Set([
  'schema', 'id', 'destinationId', 'accountIdentity', 'secretRef'
]);
const AUDIT_FIELDS = new Set([
  'schema', 'id', 'at', 'actor', 'authority', 'action', 'policyId',
  'reviewItemId', 'receiptId', 'artifactHash', 'reason', 'costCents'
]);
const SECRET_REF = /^[a-z][a-z0-9-]*:[a-z0-9][a-z0-9-]*$/i;
const DAY_MS = 24 * 60 * 60 * 1000;

const fail = (code, message, path, details) => {
  throw new PublicationError(code, message, path, details);
};

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    fail('PUBLICATION_OBJECT', 'Expected an object', path);
  }
  return value;
}

function onlyKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      fail('PUBLICATION_UNKNOWN_FIELD', `Unknown field: ${key}`, `${path}.${key}`);
    }
  }
}

function exactId(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    fail('PUBLICATION_ID', 'Expected a non-empty, trimmed id', path);
  }
  if (value.length > PUBLICATION_LIMITS.maxIdLength) {
    fail('PUBLICATION_ID', `Ids may not exceed ${PUBLICATION_LIMITS.maxIdLength} characters`, path);
  }
  if (looksLikeUri(value)) {
    fail('PUBLICATION_URI', 'Publication identities may not be URIs', path, { value });
  }
  return value;
}

function boundedText(value, path, max) {
  if (value == null) return null;
  if (typeof value !== 'string') fail('PUBLICATION_TEXT', 'Expected a string', path);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) {
    fail('PUBLICATION_TEXT', `Text may not exceed ${max} characters`, path);
  }
  return text;
}

function isoNow(now) {
  if (typeof now === 'function') return now();
  if (typeof now === 'string') return now;
  return new Date().toISOString();
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  if (ArrayBuffer.isView(value) || value instanceof ArrayBuffer) return value;
  Object.freeze(value);
  for (const item of Object.values(value)) deepFreeze(item);
  return value;
}

function integerAtLeast(value, path, min) {
  if (!Number.isInteger(value) || value < min) {
    fail('PUBLICATION_POLICY', `Expected an integer ≥ ${min}`, path);
  }
  return value;
}

function requireHuman(source, path, message) {
  if (source.actor !== 'human') {
    fail('PUBLICATION_POLICY_HUMAN_REQUIRED', message, `${path}.actor`);
  }
  if (source.authority !== 'user') {
    fail('PUBLICATION_POLICY_HUMAN_REQUIRED', message, `${path}.authority`);
  }
}

function validateActor(value, path, { human = false, requireName = false } = {}) {
  const source = record(value, path);
  onlyKeys(source, ACTOR_FIELDS, path);
  if (human) requireHuman(source, path, 'A person must adopt and remain accountable for a channel');
  else if (source.actor === 'agent') {
    fail('PUBLICATION_POLICY_HUMAN_REQUIRED',
      'The agent cannot operate a publication channel', `${path}.actor`);
  } else if (source.actor !== 'human' && source.actor !== 'host') {
    fail('PUBLICATION_POLICY', 'actor must be human or host', `${path}.actor`);
  }
  if (source.authority !== 'user' && source.authority !== 'host') {
    fail('PUBLICATION_POLICY', 'authority must be user or host', `${path}.authority`);
  }
  if (source.actor === 'human' && source.authority !== 'user') {
    fail('PUBLICATION_POLICY_HUMAN_REQUIRED',
      'A human actor requires user authority', `${path}.authority`);
  }
  const actor = { actor: source.actor, authority: source.authority };
  const name = boundedText(source.name, `${path}.name`, PUBLICATION_LIMITS.maxAccountLength);
  if (requireName && !name) {
    fail('PUBLICATION_ACCOUNTABLE', 'Accountable publication names a person', `${path}.name`);
  }
  if (name) actor.name = name;
  return Object.freeze(actor);
}

function validateEditorial(value, path) {
  const source = record(value, path);
  onlyKeys(source, EDITORIAL_FIELDS, path);
  return Object.freeze({
    requireCaptions: source.requireCaptions !== false,
    requireCredits: source.requireCredits !== false
  });
}

function validateFrequency(value, path) {
  const source = record(value, path);
  onlyKeys(source, FREQUENCY_FIELDS, path);
  return Object.freeze({
    maxDeliveriesPerDay: integerAtLeast(source.maxDeliveriesPerDay, `${path}.maxDeliveriesPerDay`, 1),
    minIntervalMs: integerAtLeast(source.minIntervalMs, `${path}.minIntervalMs`, 0)
  });
}

function validateCost(value, path) {
  const source = record(value, path);
  onlyKeys(source, COST_FIELDS, path);
  return Object.freeze({
    maxCentsPerDay: integerAtLeast(source.maxCentsPerDay, `${path}.maxCentsPerDay`, 0)
  });
}

function validateModeration(value, path) {
  const source = record(value, path);
  onlyKeys(source, MODERATION_FIELDS, path);
  const escalateOn = Array.isArray(source.escalateOn) ? source.escalateOn : [];
  for (const [index, flag] of escalateOn.entries()) {
    if (!POLICY_ESCALATIONS.includes(flag)) {
      fail('PUBLICATION_POLICY', `Unknown escalation: ${String(flag)}`, `${path}.escalateOn[${index}]`);
    }
  }
  return Object.freeze({ escalateOn: Object.freeze([...escalateOn]) });
}

function validateRightsPolicy(value, path) {
  const source = record(value, path);
  onlyKeys(source, RIGHTS_POLICY_FIELDS, path);
  return Object.freeze({
    requireResolved: source.requireResolved !== false,
    renewOnWithdrawal: source.renewOnWithdrawal !== false
  });
}

export function validateChannelPolicy(value, path = '$') {
  const source = record(value, path);
  assertNoSecrets(source, path);
  onlyKeys(source, POLICY_FIELDS, path);
  if (source.schema !== CHANNEL_POLICY_SCHEMA) {
    fail('PUBLICATION_SCHEMA', `Expected ${CHANNEL_POLICY_SCHEMA}`, `${path}.schema`);
  }
  if (!PUBLICATION_DESTINATION_KINDS.includes(source.destinationKind)) {
    fail('PUBLICATION_DESTINATION',
      `Unknown destination kind: ${String(source.destinationKind)}`, `${path}.destinationKind`);
  }
  if (!Array.isArray(source.profiles) || !source.profiles.length) {
    fail('PUBLICATION_POLICY', 'A channel policy names at least one render profile', `${path}.profiles`);
  }
  for (const [index, profile] of source.profiles.entries()) {
    if (!RENDER_PROFILE_IDS.includes(profile)) {
      fail('PUBLICATION_PROFILE', `Unknown render profile: ${profile}`, `${path}.profiles[${index}]`);
    }
  }
  if (typeof source.emergencyStop !== 'boolean') {
    fail('PUBLICATION_POLICY', 'emergencyStop must be boolean', `${path}.emergencyStop`);
  }
  const policy = {
    schema: CHANNEL_POLICY_SCHEMA,
    id: exactId(source.id, `${path}.id`),
    destinationKind: source.destinationKind,
    accountIdentity: boundedText(source.accountIdentity, `${path}.accountIdentity`,
      PUBLICATION_LIMITS.maxAccountLength)
      || fail('PUBLICATION_TEXT', 'accountIdentity is required', `${path}.accountIdentity`),
    profiles: Object.freeze([...source.profiles]),
    editorial: validateEditorial(source.editorial || { requireCaptions: true, requireCredits: true },
      `${path}.editorial`),
    frequency: validateFrequency(source.frequency, `${path}.frequency`),
    cost: validateCost(source.cost, `${path}.cost`),
    moderation: validateModeration(source.moderation || { escalateOn: [] }, `${path}.moderation`),
    rights: validateRightsPolicy(source.rights || {}, `${path}.rights`),
    accountable: validateActor(source.accountable, `${path}.accountable`, {
      human: true,
      requireName: true
    }),
    emergencyStop: source.emergencyStop,
    adoptedAt: boundedText(source.adoptedAt, `${path}.adoptedAt`, 40)
      || fail('PUBLICATION_TIME', 'adoptedAt is required', `${path}.adoptedAt`),
    adoptedBy: validateActor(source.adoptedBy, `${path}.adoptedBy`, { human: true })
  };
  return deepFreeze(policy);
}

export function adoptChannelPolicy({ policy, actor, now = null } = {}) {
  const adoptedBy = validateActor(actor, '$.actor', { human: true });
  return validateChannelPolicy({
    ...policy,
    emergencyStop: policy?.emergencyStop === true,
    adoptedAt: isoNow(now),
    adoptedBy
  });
}

export function validateCredentialCustody(value, path = '$') {
  const source = record(value, path);
  assertNoSecrets(source, path);
  onlyKeys(source, CUSTODY_FIELDS, path);
  if (source.schema !== CREDENTIAL_CUSTODY_SCHEMA) {
    fail('PUBLICATION_SCHEMA', `Expected ${CREDENTIAL_CUSTODY_SCHEMA}`, `${path}.schema`);
  }
  const secretRef = exactId(source.secretRef, `${path}.secretRef`);
  if (!SECRET_REF.test(secretRef) || looksLikeUri(secretRef)) {
    fail('PUBLICATION_CUSTODY',
      'Credentials stay in a vault handle such as vault:mock-social', `${path}.secretRef`);
  }
  return deepFreeze({
    schema: CREDENTIAL_CUSTODY_SCHEMA,
    id: exactId(source.id, `${path}.id`),
    destinationId: exactId(source.destinationId, `${path}.destinationId`),
    accountIdentity: boundedText(source.accountIdentity, `${path}.accountIdentity`,
      PUBLICATION_LIMITS.maxAccountLength)
      || fail('PUBLICATION_TEXT', 'accountIdentity is required', `${path}.accountIdentity`),
    secretRef
  });
}

export function validatePublicationAuditEvent(value, path = '$') {
  const source = record(value, path);
  assertNoSecrets(source, path);
  onlyKeys(source, AUDIT_FIELDS, path);
  if (source.schema !== PUBLICATION_AUDIT_SCHEMA) {
    fail('PUBLICATION_SCHEMA', `Expected ${PUBLICATION_AUDIT_SCHEMA}`, `${path}.schema`);
  }
  if (!AUDIT_ACTIONS.includes(source.action)) {
    fail('PUBLICATION_POLICY', `Unknown audit action: ${String(source.action)}`, `${path}.action`);
  }
  if (source.actor === 'agent') {
    fail('PUBLICATION_POLICY_HUMAN_REQUIRED',
      'The agent cannot write the publication audit', `${path}.actor`);
  }
  const event = {
    schema: PUBLICATION_AUDIT_SCHEMA,
    id: exactId(source.id, `${path}.id`),
    at: boundedText(source.at, `${path}.at`, 40)
      || fail('PUBLICATION_TIME', 'at is required', `${path}.at`),
    actor: source.actor === 'host' ? 'host' : 'human',
    authority: source.authority === 'host' ? 'host' : 'user',
    action: source.action,
    policyId: exactId(source.policyId, `${path}.policyId`)
  };
  if (source.reviewItemId) event.reviewItemId = exactId(source.reviewItemId, `${path}.reviewItemId`);
  if (source.receiptId) event.receiptId = exactId(source.receiptId, `${path}.receiptId`);
  if (source.artifactHash) event.artifactHash = source.artifactHash;
  const reason = boundedText(source.reason, `${path}.reason`, 500);
  if (reason) event.reason = reason;
  if (source.costCents != null) {
    event.costCents = integerAtLeast(source.costCents, `${path}.costCents`, 0);
  }
  return deepFreeze(event);
}

export function createPublicationLedger({ events = [], rightsWithdrawals = [] } = {}) {
  return deepFreeze({
    events: events.map(item => validatePublicationAuditEvent(item)),
    rightsWithdrawals: (rightsWithdrawals || []).map((item, index) => Object.freeze({
      projectId: exactId(item.projectId, `$.rightsWithdrawals[${index}].projectId`),
      assetId: exactId(item.assetId, `$.rightsWithdrawals[${index}].assetId`),
      at: boundedText(item.at, `$.rightsWithdrawals[${index}].at`, 40)
        || fail('PUBLICATION_TIME', 'at is required', `$.rightsWithdrawals[${index}].at`)
    }))
  });
}

function appendAudit(ledger, event) {
  const current = ledger || createPublicationLedger();
  return deepFreeze({
    events: [...current.events, validatePublicationAuditEvent(event)],
    rightsWithdrawals: current.rightsWithdrawals
  });
}

function nextAuditId(ledger) {
  return `audit-${(ledger?.events?.length || 0) + 1}`;
}

export function recordRightsWithdrawal({
  ledger,
  projectId,
  assetId,
  policyId,
  now = null
} = {}) {
  const current = ledger || createPublicationLedger();
  const at = isoNow(now);
  const channelId = exactId(policyId, '$.policyId');
  return deepFreeze({
    events: [...current.events, validatePublicationAuditEvent({
      schema: PUBLICATION_AUDIT_SCHEMA,
      id: nextAuditId(current),
      at,
      actor: 'host',
      authority: 'host',
      action: 'rights-withdrawal',
      policyId: channelId,
      reason: `Rights withdrawn for ${assetId}`
    })],
    rightsWithdrawals: Object.freeze([
      ...current.rightsWithdrawals,
      Object.freeze({
        projectId: exactId(projectId, '$.projectId'),
        assetId: exactId(assetId, '$.assetId'),
        at
      })
    ])
  });
}

export function engageEmergencyStop({ policy, actor, reason, now = null, ledger = null } = {}) {
  const judged = validateActor(actor, '$.actor');
  const current = validateChannelPolicy(policy);
  const at = isoNow(now);
  const stopped = validateChannelPolicy({ ...current, emergencyStop: true });
  return {
    policy: stopped,
    ledger: appendAudit(ledger, {
      schema: PUBLICATION_AUDIT_SCHEMA,
      id: nextAuditId(ledger),
      at,
      actor: judged.actor,
      authority: judged.authority,
      action: 'emergency-stop',
      policyId: current.id,
      reason: boundedText(reason, '$.reason', 500) || 'Emergency stop'
    })
  };
}

export function clearEmergencyStop({ policy, actor, now = null, ledger = null } = {}) {
  const judged = validateActor(actor, '$.actor', { human: true });
  const current = validateChannelPolicy(policy);
  const at = isoNow(now);
  const cleared = validateChannelPolicy({ ...current, emergencyStop: false });
  return {
    policy: cleared,
    ledger: appendAudit(ledger, {
      schema: PUBLICATION_AUDIT_SCHEMA,
      id: nextAuditId(ledger),
      at,
      actor: judged.actor,
      authority: judged.authority,
      action: 'clear-stop',
      policyId: current.id,
      reason: 'Emergency stop cleared'
    })
  };
}

function dayWindow(now) {
  return new Date(Date.parse(now) - DAY_MS).toISOString();
}

function deliveriesToday(ledger, policy, now) {
  const since = dayWindow(now);
  return (ledger?.events || []).filter(event =>
    event.action === 'deliver'
    && event.policyId === policy.id
    && event.at >= since
    && event.at <= now);
}

function lastDeliveryAt(ledger, policy) {
  const events = (ledger?.events || []).filter(event =>
    event.action === 'deliver' && event.policyId === policy.id);
  return events.length ? events[events.length - 1].at : null;
}

function centsToday(ledger, policy, now) {
  return deliveriesToday(ledger, policy, now)
    .reduce((sum, event) => sum + (event.costCents || 0), 0);
}

function escalationReason(item, policy) {
  const flags = policy.moderation.escalateOn;
  if (flags.includes('unresolved-rights')
    && (item.rights.publicationBlocked || item.rights.unresolved.length)) {
    return 'unresolved-rights';
  }
  if (flags.includes('private-review') && item.rights.distributionClass !== 'public') {
    return 'private-review';
  }
  if (flags.includes('missing-captions') && !item.metadata.captionsMode) {
    return 'missing-captions';
  }
  if (flags.includes('missing-credits') && !item.artifact.creditsHash) {
    return 'missing-credits';
  }
  return null;
}

export function assertAutomationAllowed({
  policy,
  item,
  custody,
  ledger = null,
  now = null
} = {}) {
  const channel = validateChannelPolicy(policy);
  const held = validateCredentialCustody(custody);
  const current = isoNow(now);
  if (channel.emergencyStop) {
    fail('PUBLICATION_EMERGENCY_STOP',
      'This channel is under emergency stop', '$.policy.emergencyStop');
  }
  if (item.status !== 'approved' && item.status !== 'scheduled') {
    fail('PUBLICATION_NOT_APPROVED',
      'A channel policy cannot approve an artifact', '$.item.status');
  }
  if (held.destinationId && item && channel.accountIdentity !== held.accountIdentity) {
    fail('PUBLICATION_CUSTODY',
      'Custody account identity does not match the channel', '$.custody.accountIdentity');
  }
  if (item.destinationKind !== channel.destinationKind) {
    fail('PUBLICATION_DESTINATION',
      'Channel policy destination kind does not match the review item', '$.policy.destinationKind');
  }
  if (!channel.profiles.includes(item.profile)) {
    fail('PUBLICATION_POLICY_PROFILE',
      `Profile ${item.profile} is not allowed on this channel`, '$.item.profile');
  }
  if (channel.editorial.requireCaptions && !item.metadata.captionsMode) {
    fail('PUBLICATION_ESCALATE', 'This channel requires captions metadata', '$.metadata.captionsMode');
  }
  if (channel.editorial.requireCredits && !item.artifact.creditsHash) {
    fail('PUBLICATION_ESCALATE', 'This channel requires a credits hash', '$.artifact.creditsHash');
  }
  if (channel.rights.requireResolved
    && (item.rights.publicationBlocked || item.rights.distributionClass !== 'public')) {
    fail('PUBLICATION_RIGHTS_UNRESOLVED',
      'Unresolved rights visibly block public approval', '$.rights');
  }
  if (channel.rights.renewOnWithdrawal) {
    const withdrawn = (ledger?.rightsWithdrawals || []).find(entry =>
      entry.projectId === item.projectId
      && item.approvedAt
      && entry.at > item.approvedAt);
    if (withdrawn) {
      fail('PUBLICATION_RIGHTS_WITHDRAWN',
        'Rights changed after approval; a person must review the artifact again',
        '$.rights', { assetId: withdrawn.assetId });
    }
  }
  const reason = escalationReason(item, channel);
  if (reason) {
    fail('PUBLICATION_ESCALATE',
      `This artifact needs human moderation (${reason})`, '$.moderation', { reason });
  }
  const prior = deliveriesToday(ledger, channel, current);
  if (prior.length >= channel.frequency.maxDeliveriesPerDay) {
    fail('PUBLICATION_FREQUENCY',
      'This channel has reached its daily delivery ceiling', '$.frequency.maxDeliveriesPerDay', {
        count: prior.length,
        max: channel.frequency.maxDeliveriesPerDay
      });
  }
  const previous = lastDeliveryAt(ledger, channel);
  if (previous && channel.frequency.minIntervalMs > 0) {
    const elapsed = Date.parse(current) - Date.parse(previous);
    if (elapsed < channel.frequency.minIntervalMs) {
      fail('PUBLICATION_FREQUENCY',
        'This channel has not reached its minimum interval', '$.frequency.minIntervalMs', {
          elapsed,
          minIntervalMs: channel.frequency.minIntervalMs
        });
    }
  }
  return { policy: channel, custody: held };
}

export async function deliverUnderPolicy({
  item,
  adapter,
  policy,
  custody,
  ledger = null,
  idempotencyKey,
  receipts = [],
  costCents = 0,
  now = null,
  actor = { actor: 'host', authority: 'host' }
} = {}) {
  const judged = validateActor(actor, '$.actor');
  const current = isoNow(now);
  const prior = (receipts || []).find(receipt => receipt.idempotencyKey === idempotencyKey);
  if (prior && item?.artifact?.packageHash && prior.artifactHash === item.artifact.packageHash) {
    const replayed = await deliverApproved({
      item,
      adapter,
      idempotencyKey,
      receipts,
      now: current
    });
    return {
      ...replayed,
      policy: validateChannelPolicy(policy),
      ledger: ledger || createPublicationLedger()
    };
  }
  const allowed = assertAutomationAllowed({ policy, item, custody, ledger, now: current });
  if (allowed.custody.destinationId !== adapter.id) {
    fail('PUBLICATION_CUSTODY',
      'Custody destination does not match the adapter', '$.custody.destinationId');
  }
  const spent = centsToday(ledger, allowed.policy, current);
  if (spent + integerAtLeast(costCents, '$.costCents', 0) > allowed.policy.cost.maxCentsPerDay) {
    fail('PUBLICATION_COST',
      'This channel has reached its daily cost ceiling', '$.cost.maxCentsPerDay');
  }
  const delivered = await deliverApproved({
    item,
    adapter,
    idempotencyKey,
    receipts,
    now: current
  });
  if (delivered.replayed) {
    return { ...delivered, policy: allowed.policy, ledger: ledger || createPublicationLedger() };
  }
  const next = appendAudit(ledger, {
    schema: PUBLICATION_AUDIT_SCHEMA,
    id: nextAuditId(ledger),
    at: current,
    actor: judged.actor,
    authority: judged.authority,
    action: 'deliver',
    policyId: allowed.policy.id,
    reviewItemId: item.id,
    receiptId: delivered.receipt.id,
    artifactHash: delivered.receipt.artifactHash,
    costCents,
    reason: `Accountable: ${allowed.policy.accountable.name}`
  });
  assertNoSecrets(delivered.receipt);
  if (JSON.stringify(delivered.receipt).includes(allowed.custody.secretRef)) {
    fail('PUBLICATION_CREDENTIALS',
      'Vault handles may not enter a publication receipt', '$.receipt');
  }
  return { ...delivered, policy: allowed.policy, ledger: next };
}
