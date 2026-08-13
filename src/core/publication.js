/**
 * Publication pipeline — a human decision over a hashed artifact.
 *
 * Rendering does not publish. The agent does not publish. A review item
 * names one package and one metadata set; changing either is a new item.
 * Adapters receive the approved package identity, not the Workshop, and
 * receipts never carry credentials.
 *
 * See AGENT-COMPOSITION-AND-RENDER-SPEC.md §12.
 */

import { looksLikeUri, contentHashOf, parseContentHash } from './render/hash.js';
import { RENDER_MANIFEST_SCHEMA } from './render/environment.js';
import { RENDER_PROFILE_IDS } from './render/limits.js';

export const PUBLICATION_REVIEW_SCHEMA = 'rise.publication-review-item.v1';
export const PUBLICATION_METADATA_SCHEMA = 'rise.publication-metadata.v1';
export const PUBLICATION_APPROVAL_SCHEMA = 'rise.publication-approval.v1';
export const PUBLICATION_RECEIPT_SCHEMA = 'rise.publication-receipt.v1';

export const PUBLICATION_DESTINATION_KINDS = Object.freeze(['social-short', 'archive']);
export const PUBLICATION_THUMBNAILS = Object.freeze(['poster', 'thumbnail']);
export const PUBLICATION_CAPTION_MODES = Object.freeze([
  'sidecar', 'burn-in', 'sidecar-and-burn-in'
]);
export const PUBLICATION_STATUSES = Object.freeze([
  'queued', 'approved', 'rejected', 'scheduled', 'delivered', 'withdrawn', 'failed'
]);

export const PUBLICATION_LIMITS = Object.freeze({
  maxIdLength: 160,
  maxTitleLength: 120,
  maxDescriptionLength: 500,
  maxAccountLength: 160,
  maxUrlLength: 2000
});

const SECRET_KEYS = /^(token|authorization|password|cookie|apiKey|api_key|secret|credential|accessToken|refreshToken)$/i;

const REVIEW_FIELDS = new Set([
  'schema', 'id', 'projectId', 'destinationKind', 'profile', 'artifact',
  'metadata', 'rights', 'status', 'createdAt', 'approvedAt', 'scheduledFor'
]);
const ARTIFACT_FIELDS = new Set([
  'jobId', 'jobHash', 'planHash', 'packageHash', 'outputHashes', 'creditsHash'
]);
const METADATA_FIELDS = new Set([
  'schema', 'title', 'description', 'thumbnail', 'captionsMode'
]);
const APPROVAL_FIELDS = new Set([
  'schema', 'reviewItemId', 'artifactHash', 'decision', 'actor', 'authority',
  'watchedArtifact', 'decidedAt'
]);
const RECEIPT_FIELDS = new Set([
  'schema', 'id', 'reviewItemId', 'destinationId', 'accountIdentity',
  'platformPostId', 'platformUrl', 'artifactHash', 'idempotencyKey',
  'state', 'deliveredAt', 'withdrawnAt'
]);
const RIGHTS_FIELDS = new Set([
  'distributionClass', 'publicationBlocked', 'unresolved'
]);

export class PublicationError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'PublicationError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

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

function digest(value, path) {
  try {
    return parseContentHash(value, path);
  } catch (error) {
    if (error?.code === 'RENDER_HASH_FORMAT') {
      fail('PUBLICATION_HASH', 'Expected a sha256:<64 hex> content hash', path, { value });
    }
    throw error;
  }
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

export function assertNoSecrets(value, path = '$') {
  if (!value || typeof value !== 'object') return value;
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoSecrets(item, `${path}[${index}]`));
    return value;
  }
  for (const [key, item] of Object.entries(value)) {
    if (SECRET_KEYS.test(key)) {
      fail('PUBLICATION_CREDENTIALS',
        'Credentials may not enter a review item, approval, or receipt', `${path}.${key}`);
    }
    if (item && typeof item === 'object') assertNoSecrets(item, `${path}.${key}`);
  }
  return value;
}

export function validatePublicationMetadata(value, path = '$') {
  const source = record(value, path);
  assertNoSecrets(source, path);
  onlyKeys(source, METADATA_FIELDS, path);
  if (source.schema != null && source.schema !== PUBLICATION_METADATA_SCHEMA) {
    fail('PUBLICATION_SCHEMA', `Expected ${PUBLICATION_METADATA_SCHEMA}`, `${path}.schema`);
  }
  const thumbnail = source.thumbnail == null ? 'poster' : source.thumbnail;
  if (!PUBLICATION_THUMBNAILS.includes(thumbnail)) {
    fail('PUBLICATION_THUMBNAIL', 'thumbnail must be poster or thumbnail', `${path}.thumbnail`);
  }
  const title = boundedText(source.title, `${path}.title`, PUBLICATION_LIMITS.maxTitleLength);
  if (!title) fail('PUBLICATION_TEXT', 'A review item needs a title', `${path}.title`);
  const metadata = {
    schema: PUBLICATION_METADATA_SCHEMA,
    title,
    thumbnail
  };
  const description = boundedText(source.description, `${path}.description`,
    PUBLICATION_LIMITS.maxDescriptionLength);
  if (description) metadata.description = description;
  if (source.captionsMode != null) {
    if (!PUBLICATION_CAPTION_MODES.includes(source.captionsMode)) {
      fail('PUBLICATION_CAPTIONS', 'Unknown captionsMode', `${path}.captionsMode`);
    }
    metadata.captionsMode = source.captionsMode;
  }
  return deepFreeze(metadata);
}

function validateRights(value, path) {
  const source = record(value, path);
  onlyKeys(source, RIGHTS_FIELDS, path);
  if (source.distributionClass !== 'private-review' && source.distributionClass !== 'public') {
    fail('PUBLICATION_RIGHTS', 'distributionClass must be private-review or public',
      `${path}.distributionClass`);
  }
  if (typeof source.publicationBlocked !== 'boolean') {
    fail('PUBLICATION_RIGHTS', 'publicationBlocked must be boolean', `${path}.publicationBlocked`);
  }
  const unresolved = Array.isArray(source.unresolved) ? source.unresolved : [];
  return Object.freeze({
    distributionClass: source.distributionClass,
    publicationBlocked: source.publicationBlocked,
    unresolved: Object.freeze(unresolved.map((item, index) => Object.freeze({
      assetId: exactId(item.assetId, `${path}.unresolved[${index}].assetId`)
    })))
  });
}

function validateArtifact(value, path) {
  const source = record(value, path);
  onlyKeys(source, ARTIFACT_FIELDS, path);
  const outputHashes = source.outputHashes && typeof source.outputHashes === 'object'
    ? Object.freeze({ ...source.outputHashes })
    : fail('PUBLICATION_ARTIFACT', 'Artifact outputHashes are required', `${path}.outputHashes`);
  const artifact = {
    jobId: exactId(source.jobId, `${path}.jobId`),
    jobHash: digest(source.jobHash, `${path}.jobHash`),
    planHash: digest(source.planHash, `${path}.planHash`),
    packageHash: digest(source.packageHash, `${path}.packageHash`),
    outputHashes
  };
  if (source.creditsHash != null) artifact.creditsHash = digest(source.creditsHash, `${path}.creditsHash`);
  return Object.freeze(artifact);
}

export function validatePublicationReviewItem(value, path = '$') {
  const source = record(value, path);
  assertNoSecrets(source, path);
  onlyKeys(source, REVIEW_FIELDS, path);
  if (source.schema !== PUBLICATION_REVIEW_SCHEMA) {
    fail('PUBLICATION_SCHEMA', `Expected ${PUBLICATION_REVIEW_SCHEMA}`, `${path}.schema`);
  }
  if (!PUBLICATION_DESTINATION_KINDS.includes(source.destinationKind)) {
    fail('PUBLICATION_DESTINATION',
      `Unknown destination kind: ${String(source.destinationKind)}`, `${path}.destinationKind`);
  }
  if (!RENDER_PROFILE_IDS.includes(source.profile)) {
    fail('PUBLICATION_PROFILE', `Unknown render profile: ${source.profile}`, `${path}.profile`);
  }
  if (!PUBLICATION_STATUSES.includes(source.status)) {
    fail('PUBLICATION_STATUS', `Unknown status: ${String(source.status)}`, `${path}.status`);
  }
  const item = {
    schema: PUBLICATION_REVIEW_SCHEMA,
    id: exactId(source.id, `${path}.id`),
    projectId: exactId(source.projectId, `${path}.projectId`),
    destinationKind: source.destinationKind,
    profile: source.profile,
    artifact: validateArtifact(source.artifact, `${path}.artifact`),
    metadata: validatePublicationMetadata(source.metadata, `${path}.metadata`),
    rights: validateRights(source.rights, `${path}.rights`),
    status: source.status,
    createdAt: boundedText(source.createdAt, `${path}.createdAt`, 40)
      || fail('PUBLICATION_TIME', 'createdAt is required', `${path}.createdAt`)
  };
  if (source.approvedAt) item.approvedAt = source.approvedAt;
  if (source.scheduledFor) item.scheduledFor = source.scheduledFor;
  return deepFreeze(item);
}

export function validatePublicationApproval(value, path = '$') {
  const source = record(value, path);
  assertNoSecrets(source, path);
  onlyKeys(source, APPROVAL_FIELDS, path);
  if (source.schema !== PUBLICATION_APPROVAL_SCHEMA) {
    fail('PUBLICATION_SCHEMA', `Expected ${PUBLICATION_APPROVAL_SCHEMA}`, `${path}.schema`);
  }
  if (source.decision !== 'approve' && source.decision !== 'reject') {
    fail('PUBLICATION_VERDICT', 'decision must be approve or reject', `${path}.decision`);
  }
  if (source.actor !== 'human') {
    fail('PUBLICATION_HUMAN_REQUIRED',
      'Only a human may approve or reject a publication', `${path}.actor`);
  }
  if (source.authority !== 'user') {
    fail('PUBLICATION_HUMAN_REQUIRED',
      'Publication requires user authority', `${path}.authority`);
  }
  if (source.watchedArtifact !== true) {
    fail('PUBLICATION_WATCH_REQUIRED',
      'The reviewer must watch the exact hashed artifact being approved',
      `${path}.watchedArtifact`);
  }
  return deepFreeze({
    schema: PUBLICATION_APPROVAL_SCHEMA,
    reviewItemId: exactId(source.reviewItemId, `${path}.reviewItemId`),
    artifactHash: digest(source.artifactHash, `${path}.artifactHash`),
    decision: source.decision,
    actor: 'human',
    authority: 'user',
    watchedArtifact: true,
    decidedAt: boundedText(source.decidedAt, `${path}.decidedAt`, 40)
      || fail('PUBLICATION_TIME', 'decidedAt is required', `${path}.decidedAt`)
  });
}

export function validatePublicationReceipt(value, path = '$') {
  const source = record(value, path);
  assertNoSecrets(source, path);
  onlyKeys(source, RECEIPT_FIELDS, path);
  if (source.schema !== PUBLICATION_RECEIPT_SCHEMA) {
    fail('PUBLICATION_SCHEMA', `Expected ${PUBLICATION_RECEIPT_SCHEMA}`, `${path}.schema`);
  }
  const receipt = {
    schema: PUBLICATION_RECEIPT_SCHEMA,
    id: exactId(source.id, `${path}.id`),
    reviewItemId: exactId(source.reviewItemId, `${path}.reviewItemId`),
    destinationId: exactId(source.destinationId, `${path}.destinationId`),
    accountIdentity: boundedText(source.accountIdentity, `${path}.accountIdentity`,
      PUBLICATION_LIMITS.maxAccountLength)
      || fail('PUBLICATION_TEXT', 'accountIdentity is required', `${path}.accountIdentity`),
    artifactHash: digest(source.artifactHash, `${path}.artifactHash`),
    idempotencyKey: exactId(source.idempotencyKey, `${path}.idempotencyKey`),
    state: source.state,
    deliveredAt: boundedText(source.deliveredAt, `${path}.deliveredAt`, 40)
      || fail('PUBLICATION_TIME', 'deliveredAt is required', `${path}.deliveredAt`)
  };
  if (!['published', 'partial', 'failed', 'withdrawn'].includes(source.state)) {
    fail('PUBLICATION_STATE', `Unknown receipt state: ${String(source.state)}`, `${path}.state`);
  }
  if (source.state === 'published' && (source.platformPostId == null || source.platformUrl == null)) {
    fail('PUBLICATION_RECEIPT', 'A published receipt records platform id and URL', path);
  }
  if (source.platformPostId != null) {
    receipt.platformPostId = exactId(source.platformPostId, `${path}.platformPostId`);
  }
  const url = boundedText(source.platformUrl, `${path}.platformUrl`, PUBLICATION_LIMITS.maxUrlLength);
  if (url) {
    if (!/^https:\/\//i.test(url)) {
      fail('PUBLICATION_URL', 'platformUrl must be https reacquisition evidence', `${path}.platformUrl`);
    }
    receipt.platformUrl = url;
  }
  if (source.withdrawnAt) receipt.withdrawnAt = source.withdrawnAt;
  return deepFreeze(receipt);
}

export async function packageIdentityHash({ manifest, metadata, thumbnail }) {
  return contentHashOf({
    schema: 'rise.publication-artifact.v1',
    jobHash: manifest.jobHash,
    planHash: manifest.planHash,
    profile: manifest.profile,
    outputHashes: manifest.outputHashes,
    metadata,
    thumbnail
  });
}

function rightsFromPackage(pack) {
  const report = pack?.['rights-report.json'] || {};
  const unresolved = Array.isArray(report.unresolved)
    ? report.unresolved.map(item => ({ assetId: item.assetId }))
    : [];
  return {
    distributionClass: report.distributionClass || 'private-review',
    publicationBlocked: report.publicationBlocked === true
      || (report.distributionClass === 'public' && unresolved.length > 0),
    unresolved
  };
}

export async function enqueuePublicationReview({
  id,
  projectId,
  destinationKind,
  pack,
  metadata,
  now = null
} = {}) {
  const manifest = pack?.['render-manifest.json'];
  if (!manifest || manifest.schema !== RENDER_MANIFEST_SCHEMA) {
    fail('PUBLICATION_PACKAGE', 'A review item needs a render package with a manifest',
      '$.pack');
  }
  const meta = validatePublicationMetadata(metadata);
  const thumbnailName = meta.thumbnail === 'thumbnail' ? 'thumbnail.bmp' : 'poster.bmp';
  if (pack[thumbnailName] == null) {
    fail('PUBLICATION_THUMBNAIL', `Package is missing ${thumbnailName}`, '$.metadata.thumbnail');
  }
  const packageHash = await packageIdentityHash({
    manifest,
    metadata: meta,
    thumbnail: meta.thumbnail
  });
  const item = validatePublicationReviewItem({
    schema: PUBLICATION_REVIEW_SCHEMA,
    id,
    projectId: projectId || manifest.projectId,
    destinationKind,
    profile: manifest.profile,
    artifact: {
      jobId: manifest.jobId,
      jobHash: manifest.jobHash,
      planHash: manifest.planHash,
      packageHash,
      outputHashes: manifest.outputHashes,
      creditsHash: manifest.outputHashes?.credits
    },
    metadata: meta,
    rights: rightsFromPackage(pack),
    status: 'queued',
    createdAt: isoNow(now)
  });
  return item;
}

export function approvePublication({ item, approval }) {
  const review = validatePublicationReviewItem(item);
  const judged = validatePublicationApproval(approval);
  if (judged.reviewItemId !== review.id) {
    fail('PUBLICATION_VERDICT', 'Approval names a different review item', '$.reviewItemId');
  }
  if (judged.artifactHash !== review.artifact.packageHash) {
    fail('PUBLICATION_ARTIFACT',
      'Approval must name the exact hashed artifact under review', '$.artifactHash');
  }
  if (review.status !== 'queued') {
    fail('PUBLICATION_STATUS', `A ${review.status} item cannot be re-approved`, '$.status');
  }
  if (judged.decision === 'reject') {
    return deepFreeze({ ...review, status: 'rejected', approvedAt: judged.decidedAt });
  }
  assertPublicDestinationRights(review);
  return deepFreeze({ ...review, status: 'approved', approvedAt: judged.decidedAt });
}

function assertPublicDestinationRights(review) {
  if (review.destinationKind !== 'social-short') return;
  if (review.rights.distributionClass !== 'public' || review.rights.publicationBlocked) {
    fail('PUBLICATION_RIGHTS_UNRESOLVED',
      'Unresolved rights visibly block public approval', '$.rights');
  }
}

export function schedulePublication({ item, notBefore, now = null }) {
  const review = validatePublicationReviewItem(item);
  if (review.status !== 'approved') {
    fail('PUBLICATION_NOT_APPROVED',
      'Scheduling follows destination approval; it does not replace it', '$.status');
  }
  const when = boundedText(notBefore, '$.notBefore', 40)
    || fail('PUBLICATION_TIME', 'notBefore is required', '$.notBefore');
  const current = isoNow(now);
  if (when <= current) {
    fail('PUBLICATION_SCHEDULE', 'notBefore must be in the future', '$.notBefore');
  }
  return deepFreeze({ ...review, status: 'scheduled', scheduledFor: when });
}

export function createPublicationQueue(items = []) {
  return deepFreeze({
    items: (items || []).map(item => validatePublicationReviewItem(item)),
    receipts: []
  });
}

export async function deliverApproved({
  item,
  adapter,
  idempotencyKey,
  receipts = [],
  now = null
} = {}) {
  const review = validatePublicationReviewItem(item);
  if (review.status === 'scheduled') {
    const current = isoNow(now);
    if (review.scheduledFor && current < review.scheduledFor) {
      fail('PUBLICATION_SCHEDULED',
        'This artifact is approved but not yet due', '$.scheduledFor', {
          scheduledFor: review.scheduledFor
        });
    }
  } else if (review.status !== 'approved') {
    fail('PUBLICATION_NOT_APPROVED',
      'Only an approved artifact may be delivered', '$.status');
  }
  assertPublicDestinationRights(review);
  if (!adapter || typeof adapter.deliver !== 'function') {
    fail('PUBLICATION_ADAPTER', 'Delivery needs a destination adapter', '$.adapter');
  }
  if (adapter.destinationKind && adapter.destinationKind !== review.destinationKind) {
    fail('PUBLICATION_DESTINATION',
      'Adapter destination kind does not match the review item', '$.adapter');
  }
  const key = exactId(idempotencyKey, '$.idempotencyKey');
  const prior = (receipts || []).find(receipt => receipt.idempotencyKey === key);
  if (prior) {
    if (prior.artifactHash !== review.artifact.packageHash) {
      fail('PUBLICATION_IDEMPOTENCY',
        'This idempotency key already delivered a different artifact', '$.idempotencyKey');
    }
    return { item: review, receipt: validatePublicationReceipt(prior), replayed: true };
  }

  let result;
  try {
    result = await adapter.deliver({
      reviewItemId: review.id,
      destinationKind: review.destinationKind,
      artifactHash: review.artifact.packageHash,
      metadata: review.metadata,
      idempotencyKey: key
    });
  } catch (error) {
    if (error instanceof PublicationError) throw error;
    fail('PUBLICATION_DELIVER', 'Destination adapter failed', '$.adapter', {
      reason: error?.message || 'adapter'
    });
  }
  assertNoSecrets(result || {}, '$.adapter');
  const receipt = validatePublicationReceipt({
    schema: PUBLICATION_RECEIPT_SCHEMA,
    id: `receipt-${review.id}`,
    reviewItemId: review.id,
    destinationId: exactId(adapter.id, '$.adapter.id'),
    accountIdentity: result.accountIdentity || adapter.accountIdentity,
    platformPostId: result.platformPostId,
    platformUrl: result.platformUrl,
    artifactHash: review.artifact.packageHash,
    idempotencyKey: key,
    state: result.state || 'published',
    deliveredAt: isoNow(now)
  });
  return {
    item: deepFreeze({ ...review, status: receipt.state === 'published' ? 'delivered' : 'failed' }),
    receipt,
    replayed: false
  };
}

export async function withdrawPublication({
  item,
  receipt,
  adapter,
  now = null
} = {}) {
  const review = validatePublicationReviewItem(item);
  const current = validatePublicationReceipt(receipt);
  if (current.state !== 'published' && current.state !== 'partial') {
    fail('PUBLICATION_STATE', 'Only a published or partial receipt may be withdrawn', '$.receipt.state');
  }
  if (!adapter || typeof adapter.withdraw !== 'function') {
    fail('PUBLICATION_ADAPTER', 'Withdrawal needs a destination adapter', '$.adapter');
  }
  let result;
  try {
    result = await adapter.withdraw({ receipt: current });
  } catch (error) {
    if (error instanceof PublicationError) throw error;
    fail('PUBLICATION_WITHDRAW', 'Destination adapter could not withdraw', '$.adapter', {
      reason: error?.message || 'adapter'
    });
  }
  assertNoSecrets(result || {}, '$.adapter');
  const withdrawn = validatePublicationReceipt({
    ...current,
    state: 'withdrawn',
    withdrawnAt: isoNow(now)
  });
  return {
    item: deepFreeze({ ...review, status: 'withdrawn' }),
    receipt: withdrawn
  };
}
