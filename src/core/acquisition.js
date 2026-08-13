/**
 * Acquisition gateway — the only doorway external or generated media may
 * use to become a project asset.
 *
 *   request → inspect → fetch/generate → validate → hash → rights/provenance
 *           → human verdict → rise.project-asset.v1
 *
 * Candidates are not assets. The Experience Program cannot trigger this
 * service. The agent cannot admit. Bytes are returned to the caller; this
 * module never writes IndexedDB.
 */

import { RIGHTS as ATRIUM_RIGHTS } from '../content/atrium/imagery/works.js';
import { READING_LIMITS } from './reading-limits.js';
import { looksLikeUri, contentHashOfBytes, parseContentHash } from './render/hash.js';
import { RENDER_LIMITS, RENDER_RIGHTS_STATUSES } from './render/limits.js';
import {
  PROJECT_ASSET_SCHEMA,
  PROJECT_ASSET_ORIGINS,
  validateProjectAsset
} from './render/project-asset.js';

export const ACQUISITION_REQUEST_SCHEMA = 'rise.acquisition-request.v1';
export const ACQUISITION_CANDIDATE_SCHEMA = 'rise.acquisition-candidate.v1';
export const ACQUISITION_VERDICT_SCHEMA = 'rise.acquisition-verdict.v1';

export const ACQUISITION_KINDS = Object.freeze([
  'image', 'video', 'audio', 'font', 'document'
]);
export const ACQUISITION_SOURCE_PREFERENCES = Object.freeze([
  'public-domain', 'project-media', 'generated'
]);
export const ACQUISITION_RELATIONSHIPS = Object.freeze([
  'archive', 'project-only', 'temporary-private'
]);
export const ACQUISITION_DEFERRED_KINDS = Object.freeze(['video', 'audio']);

export const ACQUISITION_ALLOWED_HOSTS = Object.freeze([
  'api.artic.edu',
  'www.artic.edu'
]);

export const ACQUISITION_LIMITS = Object.freeze({
  maxIdLength: 160,
  maxQueryLength: 400,
  maxPurposeLength: 200,
  maxAvoidItems: 8,
  maxAvoidLength: 80,
  maxCandidates: 8,
  maxTitleLength: 240,
  maxDescriptionLength: 300,
  maxCreditLength: 500,
  maxTextCharacters: READING_LIMITS.maxTextCharacters
});

const REQUEST_FIELDS = new Set([
  'schema', 'id', 'projectId', 'kind', 'purpose', 'query', 'sourcePreference',
  'constraints', 'proposedAnchor', 'objectId', 'workId', 'relationship'
]);
const CONSTRAINT_FIELDS = new Set(['orientation', 'motion', 'maxDurationMs', 'avoid']);
const ANCHOR_FIELDS = new Set(['sourceId', 'fromCharacter', 'toCharacter', 'quoteStart', 'quoteEnd']);
const CANDIDATE_FIELDS = new Set([
  'schema', 'id', 'requestId', 'kind', 'origin', 'provider', 'objectId', 'imageId',
  'workId', 'relationship', 'title', 'creator', 'credit', 'description',
  'sourceUrl', 'expectedMime', 'rights', 'inspect', 'fetched', 'warnings'
]);
const CANDIDATE_RIGHTS_FIELDS = new Set([
  'status', 'license', 'credit', 'evidence', 'distributionAllowed'
]);
const FETCHED_FIELDS = new Set(['contentHash', 'byteLength', 'mimeType']);
const INSPECT_FIELDS = new Set([
  'apparatus', 'gibberish', 'furniture', 'symbols', 'score', 'sampleChars',
  'lines', 'encodingChanged'
]);
const VERDICT_FIELDS = new Set([
  'schema', 'candidateId', 'decision', 'actor', 'authority', 'decidedAt'
]);

const IMAGE_MIME = /^image\/(jpeg|jpg|png|webp|gif)$/i;
const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47];

export class AcquisitionError extends Error {
  constructor(code, message, path = '$', details = {}) {
    super(`${message} (${path})`);
    this.name = 'AcquisitionError';
    this.code = code;
    this.path = path;
    this.details = details;
  }
}

export const failAcquisition = (code, message, path, details) => {
  throw new AcquisitionError(code, message, path, details);
};

function asBytes(value) {
  if (value instanceof Uint8Array) return value;
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
  }
  return null;
}

function record(value, path) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    failAcquisition('ACQUISITION_OBJECT', 'Expected an object', path);
  }
  return value;
}

function onlyKeys(value, allowed, path) {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) {
      failAcquisition('ACQUISITION_UNKNOWN_FIELD', `Unknown field: ${key}`, `${path}.${key}`);
    }
  }
}

function exactId(value, path) {
  if (typeof value !== 'string' || !value || value !== value.trim()) {
    failAcquisition('ACQUISITION_ID', 'Expected a non-empty, trimmed id', path);
  }
  if (value.length > ACQUISITION_LIMITS.maxIdLength) {
    failAcquisition('ACQUISITION_ID', `Ids may not exceed ${ACQUISITION_LIMITS.maxIdLength} characters`, path);
  }
  if (looksLikeUri(value)) {
    failAcquisition('ACQUISITION_URI', 'Acquisition identities may not be URIs', path, { value });
  }
  return value;
}

function boundedText(value, path, max) {
  if (value == null) return null;
  if (typeof value !== 'string') failAcquisition('ACQUISITION_TEXT', 'Expected a string', path);
  const text = value.trim();
  if (!text) return null;
  if (text.length > max) {
    failAcquisition('ACQUISITION_TEXT', `Text may not exceed ${max} characters`, path);
  }
  return text;
}

function optionalInteger(value, path, min = 0) {
  if (value == null) return null;
  if (!Number.isInteger(value) || value < min) {
    failAcquisition('ACQUISITION_INTEGER', `Expected an integer ≥ ${min}`, path);
  }
  return value;
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

function untrustedDescription(value, path) {
  const text = boundedText(value, path, ACQUISITION_LIMITS.maxDescriptionLength);
  if (!text) return null;
  return text.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').slice(0, ACQUISITION_LIMITS.maxDescriptionLength);
}

function byteCeiling(kind) {
  if (kind === 'video') return RENDER_LIMITS.maxVideoFileBytes;
  if (kind === 'audio') return RENDER_LIMITS.maxAudioFileBytes;
  if (kind === 'document') return ACQUISITION_LIMITS.maxTextCharacters;
  return RENDER_LIMITS.maxImageFileBytes;
}

function defaultPreferences(kind) {
  if (kind === 'image') return Object.freeze(['public-domain']);
  if (kind === 'document') return Object.freeze(['project-media']);
  return Object.freeze([]);
}

function validateAnchor(value, path) {
  if (value == null) return null;
  const source = record(value, path);
  onlyKeys(source, ANCHOR_FIELDS, path);
  const fromCharacter = optionalInteger(source.fromCharacter, `${path}.fromCharacter`);
  const toCharacter = optionalInteger(source.toCharacter, `${path}.toCharacter`);
  if ((fromCharacter == null) !== (toCharacter == null)) {
    failAcquisition('ACQUISITION_ANCHOR', 'fromCharacter and toCharacter must be paired', path);
  }
  const quoteStart = boundedText(source.quoteStart, `${path}.quoteStart`, 500);
  const quoteEnd = boundedText(source.quoteEnd, `${path}.quoteEnd`, 500);
  if ((quoteStart == null) !== (quoteEnd == null)) {
    failAcquisition('ACQUISITION_ANCHOR', 'quoteStart and quoteEnd must be paired', path);
  }
  const anchor = {};
  if (source.sourceId != null) anchor.sourceId = exactId(source.sourceId, `${path}.sourceId`);
  if (fromCharacter != null) {
    anchor.fromCharacter = fromCharacter;
    anchor.toCharacter = toCharacter;
  }
  if (quoteStart) {
    anchor.quoteStart = quoteStart;
    anchor.quoteEnd = quoteEnd;
  }
  return Object.freeze(anchor);
}

function validateConstraints(value, path) {
  if (value == null) return null;
  const source = record(value, path);
  onlyKeys(source, CONSTRAINT_FIELDS, path);
  const constraints = {};
  const orientation = boundedText(source.orientation, `${path}.orientation`, 40);
  if (orientation) {
    if (!['portrait', 'landscape', 'square'].includes(orientation)) {
      failAcquisition('ACQUISITION_CONSTRAINT', `Unknown orientation: ${orientation}`,
        `${path}.orientation`);
    }
    constraints.orientation = orientation;
  }
  const motion = boundedText(source.motion, `${path}.motion`, 40);
  if (motion) {
    if (!['still', 'motion'].includes(motion)) {
      failAcquisition('ACQUISITION_CONSTRAINT', `Unknown motion: ${motion}`, `${path}.motion`);
    }
    constraints.motion = motion;
  }
  const maxDurationMs = optionalInteger(source.maxDurationMs, `${path}.maxDurationMs`, 1);
  if (maxDurationMs != null) constraints.maxDurationMs = maxDurationMs;
  if (source.avoid != null) {
    if (!Array.isArray(source.avoid) || source.avoid.length > ACQUISITION_LIMITS.maxAvoidItems) {
      failAcquisition('ACQUISITION_CONSTRAINT',
        `avoid accepts at most ${ACQUISITION_LIMITS.maxAvoidItems} strings`, `${path}.avoid`);
    }
    constraints.avoid = Object.freeze(source.avoid.map((item, index) =>
      boundedText(item, `${path}.avoid[${index}]`, ACQUISITION_LIMITS.maxAvoidLength)
        || failAcquisition('ACQUISITION_TEXT', 'avoid items must be non-empty', `${path}.avoid[${index}]`)));
  }
  return Object.keys(constraints).length ? Object.freeze(constraints) : null;
}

export function validateAcquisitionRequest(value, path = '$') {
  const source = record(value, path);
  onlyKeys(source, REQUEST_FIELDS, path);
  if (source.schema !== ACQUISITION_REQUEST_SCHEMA) {
    failAcquisition('ACQUISITION_SCHEMA', `Expected ${ACQUISITION_REQUEST_SCHEMA}`, `${path}.schema`);
  }
  if (!ACQUISITION_KINDS.includes(source.kind)) {
    failAcquisition('ACQUISITION_KIND', `Unknown asset kind: ${String(source.kind)}`, `${path}.kind`);
  }
  const request = {
    schema: ACQUISITION_REQUEST_SCHEMA,
    id: exactId(source.id, `${path}.id`),
    kind: source.kind,
    query: boundedText(source.query, `${path}.query`, ACQUISITION_LIMITS.maxQueryLength)
      || failAcquisition('ACQUISITION_TEXT', 'An acquisition request needs a query', `${path}.query`)
  };
  if (source.projectId != null) request.projectId = exactId(source.projectId, `${path}.projectId`);
  const purpose = boundedText(source.purpose, `${path}.purpose`, ACQUISITION_LIMITS.maxPurposeLength);
  if (purpose) request.purpose = purpose;
  if (source.sourcePreference != null) {
    if (!Array.isArray(source.sourcePreference) || !source.sourcePreference.length) {
      failAcquisition('ACQUISITION_PREFERENCE', 'sourcePreference must be a non-empty array',
        `${path}.sourcePreference`);
    }
    request.sourcePreference = Object.freeze(source.sourcePreference.map((item, index) => {
      if (!ACQUISITION_SOURCE_PREFERENCES.includes(item)) {
        failAcquisition('ACQUISITION_PREFERENCE', `Unknown source preference: ${String(item)}`,
          `${path}.sourcePreference[${index}]`);
      }
      return item;
    }));
  } else {
    request.sourcePreference = defaultPreferences(source.kind);
  }
  const constraints = validateConstraints(source.constraints, `${path}.constraints`);
  if (constraints) request.constraints = constraints;
  const proposedAnchor = validateAnchor(source.proposedAnchor, `${path}.proposedAnchor`);
  if (proposedAnchor) request.proposedAnchor = proposedAnchor;
  if (source.objectId != null) request.objectId = exactId(source.objectId, `${path}.objectId`);
  if (source.workId != null) request.workId = exactId(source.workId, `${path}.workId`);
  if (source.relationship != null) {
    if (!ACQUISITION_RELATIONSHIPS.includes(source.relationship)) {
      failAcquisition('ACQUISITION_RELATIONSHIP',
        `Unknown relationship: ${String(source.relationship)}`, `${path}.relationship`);
    }
    request.relationship = source.relationship;
  }
  return deepFreeze(request);
}

function validateCandidateRights(value, path) {
  const source = record(value, path);
  onlyKeys(source, CANDIDATE_RIGHTS_FIELDS, path);
  if (!RENDER_RIGHTS_STATUSES.includes(source.status)) {
    failAcquisition('ACQUISITION_RIGHTS', `Unknown rights status: ${String(source.status)}`,
      `${path}.status`);
  }
  if (typeof source.distributionAllowed !== 'boolean') {
    failAcquisition('ACQUISITION_RIGHTS', 'rights.distributionAllowed must be boolean',
      `${path}.distributionAllowed`);
  }
  const rights = {
    status: source.status,
    distributionAllowed: source.distributionAllowed
  };
  const license = boundedText(source.license, `${path}.license`, 120);
  if (license) rights.license = license;
  const credit = boundedText(source.credit, `${path}.credit`, ACQUISITION_LIMITS.maxCreditLength);
  if (credit) rights.credit = credit;
  const evidence = boundedText(source.evidence, `${path}.evidence`, 500);
  if (evidence) rights.evidence = evidence;
  return Object.freeze(rights);
}

function validateFetched(value, path) {
  if (value == null) return null;
  const source = record(value, path);
  onlyKeys(source, FETCHED_FIELDS, path);
  if (!Number.isInteger(source.byteLength) || source.byteLength < 0) {
    failAcquisition('ACQUISITION_SIZE', 'byteLength must be a non-negative integer',
      `${path}.byteLength`);
  }
  return Object.freeze({
    contentHash: parseContentHash(source.contentHash, `${path}.contentHash`),
    byteLength: source.byteLength,
    mimeType: boundedText(source.mimeType, `${path}.mimeType`, 80)
      || failAcquisition('ACQUISITION_MIME', 'Fetched MIME is required', `${path}.mimeType`)
  });
}

export function validateAcquisitionCandidate(value, path = '$') {
  const source = record(value, path);
  onlyKeys(source, CANDIDATE_FIELDS, path);
  if (source.schema !== ACQUISITION_CANDIDATE_SCHEMA) {
    failAcquisition('ACQUISITION_SCHEMA', `Expected ${ACQUISITION_CANDIDATE_SCHEMA}`,
      `${path}.schema`);
  }
  if (!ACQUISITION_KINDS.includes(source.kind)) {
    failAcquisition('ACQUISITION_KIND', `Unknown asset kind: ${String(source.kind)}`, `${path}.kind`);
  }
  if (!PROJECT_ASSET_ORIGINS.includes(source.origin)) {
    failAcquisition('ACQUISITION_ORIGIN', `Unknown origin: ${String(source.origin)}`,
      `${path}.origin`);
  }
  const candidate = {
    schema: ACQUISITION_CANDIDATE_SCHEMA,
    id: exactId(source.id, `${path}.id`),
    requestId: exactId(source.requestId, `${path}.requestId`),
    kind: source.kind,
    origin: source.origin,
    provider: boundedText(source.provider, `${path}.provider`, 160)
      || failAcquisition('ACQUISITION_TEXT', 'A candidate needs a provider', `${path}.provider`),
    rights: validateCandidateRights(source.rights, `${path}.rights`)
  };
  if (source.objectId != null) candidate.objectId = exactId(source.objectId, `${path}.objectId`);
  if (source.imageId != null) candidate.imageId = exactId(source.imageId, `${path}.imageId`);
  if (source.workId != null) candidate.workId = exactId(source.workId, `${path}.workId`);
  if (source.relationship != null) {
    if (!ACQUISITION_RELATIONSHIPS.includes(source.relationship)) {
      failAcquisition('ACQUISITION_RELATIONSHIP',
        `Unknown relationship: ${String(source.relationship)}`, `${path}.relationship`);
    }
    candidate.relationship = source.relationship;
  }
  const title = boundedText(source.title, `${path}.title`, ACQUISITION_LIMITS.maxTitleLength);
  if (title) candidate.title = title;
  const creator = boundedText(source.creator, `${path}.creator`, 200);
  if (creator) candidate.creator = creator;
  const credit = boundedText(source.credit, `${path}.credit`, ACQUISITION_LIMITS.maxCreditLength);
  if (credit) candidate.credit = credit;
  const description = untrustedDescription(source.description, `${path}.description`);
  if (description) candidate.description = description;
  const sourceUrl = boundedText(source.sourceUrl, `${path}.sourceUrl`, 2000);
  if (sourceUrl) {
    if (!/^https:\/\//i.test(sourceUrl)) {
      failAcquisition('ACQUISITION_SOURCE_URL',
        'Remote provenance URLs must be https reacquisition evidence', `${path}.sourceUrl`);
    }
    candidate.sourceUrl = sourceUrl;
  }
  const expectedMime = boundedText(source.expectedMime, `${path}.expectedMime`, 80);
  if (expectedMime) candidate.expectedMime = expectedMime;
  if (source.inspect && typeof source.inspect === 'object') {
    onlyKeys(source.inspect, INSPECT_FIELDS, `${path}.inspect`);
    candidate.inspect = Object.freeze({ ...source.inspect });
  }
  const fetched = validateFetched(source.fetched, `${path}.fetched`);
  if (fetched) candidate.fetched = fetched;
  if (Array.isArray(source.warnings) && source.warnings.length) {
    candidate.warnings = Object.freeze(source.warnings.map((item, index) =>
      boundedText(item, `${path}.warnings[${index}]`, 80)
        || failAcquisition('ACQUISITION_TEXT', 'Empty warning', `${path}.warnings[${index}]`)));
  }
  return deepFreeze(candidate);
}

export function validateAcquisitionVerdict(value, path = '$') {
  const source = record(value, path);
  onlyKeys(source, VERDICT_FIELDS, path);
  if (source.schema !== ACQUISITION_VERDICT_SCHEMA) {
    failAcquisition('ACQUISITION_SCHEMA', `Expected ${ACQUISITION_VERDICT_SCHEMA}`, `${path}.schema`);
  }
  if (source.decision !== 'admit' && source.decision !== 'reject') {
    failAcquisition('ACQUISITION_VERDICT', 'decision must be admit or reject', `${path}.decision`);
  }
  if (source.actor !== 'human') {
    failAcquisition('ACQUISITION_HUMAN_REQUIRED',
      'Only a human may admit or reject an acquisition candidate', `${path}.actor`);
  }
  if (source.authority !== 'user') {
    failAcquisition('ACQUISITION_HUMAN_REQUIRED',
      'Acquisition verdicts require user authority', `${path}.authority`);
  }
  return deepFreeze({
    schema: ACQUISITION_VERDICT_SCHEMA,
    candidateId: exactId(source.candidateId, `${path}.candidateId`),
    decision: source.decision,
    actor: 'human',
    authority: 'user',
    decidedAt: boundedText(source.decidedAt, `${path}.decidedAt`, 40)
      || failAcquisition('ACQUISITION_TIME', 'decidedAt is required', `${path}.decidedAt`)
  });
}

export function parseAicObjectId(value) {
  if (value == null) return null;
  const match = String(value).trim().match(/^(?:aic:)?(\d+)$/i);
  return match ? match[1] : null;
}

export function parseArchiveWorkId(value) {
  if (value == null) return null;
  const text = String(value).trim();
  const prefixed = text.match(/^archive:([a-z0-9][a-z0-9-]{0,158})$/i);
  if (prefixed) return prefixed[1].toLowerCase();
  if (/^[a-z0-9][a-z0-9-]{0,158}$/.test(text)) return text;
  return null;
}

export function assertHttpsAllowlisted(urlString, path = '$.url') {
  let url;
  try {
    url = new URL(urlString);
  } catch {
    failAcquisition('ACQUISITION_URL', 'Expected an absolute https URL', path);
  }
  if (url.protocol !== 'https:') {
    failAcquisition('ACQUISITION_SCHEME', 'Acquisition fetch is https only', path, {
      protocol: url.protocol
    });
  }
  if (url.username || url.password) {
    failAcquisition('ACQUISITION_CREDENTIALS',
      'Credentials may not enter an acquisition request', path);
  }
  if (!ACQUISITION_ALLOWED_HOSTS.includes(url.hostname)) {
    failAcquisition('ACQUISITION_HOST', `Host ${url.hostname} is not allowlisted`, path, {
      host: url.hostname
    });
  }
  return url;
}

function looksLikeHtml(bytes) {
  let index = 0;
  if (bytes.length >= 3 && bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf) index = 3;
  while (index < bytes.length && (bytes[index] === 0x20 || bytes[index] === 0x09
    || bytes[index] === 0x0a || bytes[index] === 0x0d)) {
    index += 1;
  }
  return bytes[index] === 0x3c;
}

function magicMatches(bytes, signature) {
  if (bytes.length < signature.length) return false;
  return signature.every((byte, index) => bytes[index] === byte);
}

function mimeAgrees(kind, contentType, bytes) {
  if (kind === 'image') {
    if (!IMAGE_MIME.test(contentType) || /svg/i.test(contentType)) return false;
    if (looksLikeHtml(bytes)) return false;
    if (/jpeg|jpg/i.test(contentType)) return magicMatches(bytes, JPEG_MAGIC);
    if (/png/i.test(contentType)) return magicMatches(bytes, PNG_MAGIC);
    if (/gif/i.test(contentType)) {
      return bytes.length >= 4 && bytes[0] === 0x47 && bytes[1] === 0x49
        && bytes[2] === 0x46 && bytes[3] === 0x38;
    }
    if (/webp/i.test(contentType)) {
      return bytes.length >= 12
        && bytes[0] === 0x52 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x46
        && bytes[8] === 0x57 && bytes[9] === 0x45 && bytes[10] === 0x42 && bytes[11] === 0x50;
    }
    return false;
  }
  if (kind === 'document') {
    return contentType === 'text/plain' || contentType === 'application/json';
  }
  return false;
}

export async function fetchAllowlisted(urlString, {
  fetchImpl,
  kind = 'image',
  maxBytes = RENDER_LIMITS.maxImageFileBytes
} = {}) {
  const url = assertHttpsAllowlisted(urlString);
  const doFetch = fetchImpl || globalThis.fetch;
  if (typeof doFetch !== 'function') {
    failAcquisition('ACQUISITION_FETCH', 'No fetch implementation is available', '$.url');
  }
  let response;
  try {
    response = await doFetch(url.href, {
      redirect: 'manual',
      headers: {
        Accept: kind === 'image'
          ? 'image/jpeg,image/png,image/webp,image/gif'
          : 'text/plain'
      }
    });
  } catch (error) {
    failAcquisition('ACQUISITION_FETCH', 'Provider request failed', '$.url', {
      reason: error?.message || 'network'
    });
  }
  const status = response?.status;
  if (status === 301 || status === 302 || status === 303 || status === 307 || status === 308
    || response?.type === 'opaqueredirect') {
    failAcquisition('ACQUISITION_REDIRECT', 'Redirects are refused before durable storage',
      '$.url', { status });
  }
  if (!response || response.ok === false) {
    failAcquisition('ACQUISITION_FETCH', `Provider responded ${status || 'without a body'}`,
      '$.url', { status });
  }
  const contentType = String(response.headers?.get?.('content-type') || '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!contentType || contentType.includes('html') || contentType === 'application/xhtml+xml') {
    failAcquisition('ACQUISITION_HTML', 'Fetched HTML is not treated as media', '$.mimeType', {
      contentType
    });
  }
  const declared = response.headers?.get?.('content-length');
  if (declared && Number(declared) > maxBytes) {
    failAcquisition('ACQUISITION_SIZE', 'Response exceeds the byte ceiling before read',
      '$.byteLength', { byteLength: Number(declared), max: maxBytes });
  }
  const buffer = await response.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  if (bytes.byteLength > maxBytes) {
    failAcquisition('ACQUISITION_SIZE', 'Response exceeds the byte ceiling', '$.byteLength', {
      byteLength: bytes.byteLength,
      max: maxBytes
    });
  }
  if (!mimeAgrees(kind, contentType, bytes)) {
    failAcquisition('ACQUISITION_MIME', 'MIME disagrees with the admitted kind', '$.mimeType', {
      contentType,
      kind
    });
  }
  return { bytes, mimeType: contentType === 'image/jpg' ? 'image/jpeg' : contentType };
}

export function rightsFromAtrium(work) {
  if (work?.rights === ATRIUM_RIGHTS.CC0 || work?.rights === ATRIUM_RIGHTS.PUBLIC_DOMAIN) {
    return Object.freeze({
      status: 'verified',
      distributionAllowed: true,
      license: work.rights === ATRIUM_RIGHTS.CC0 ? 'CC0' : 'public-domain',
      credit: [work.artist, work.title, work.sourceName].filter(Boolean).join(' — '),
      evidence: work.sourceUrl || 'institution public-domain declaration'
    });
  }
  return Object.freeze({
    status: 'unknown',
    distributionAllowed: false
  });
}

export function unknownRights() {
  return Object.freeze({
    status: 'unknown',
    distributionAllowed: false
  });
}

export function generationConsentGranted(consent) {
  return !!(consent && consent.generation === true && consent.costAcknowledged === true);
}

function assertNotDeferred(kind, path = '$.kind') {
  if (ACQUISITION_DEFERRED_KINDS.includes(kind)) {
    failAcquisition('ACQUISITION_KIND_DEFERRED',
      `Acquisition of ${kind} waits on media-specific checks that do not exist yet`, path, {
        kind
      });
  }
}

function selectProviders(providers, request) {
  const list = Array.isArray(providers) ? providers : [];
  const wanted = new Set(request.sourcePreference);
  return list.filter((provider) => {
    if (!provider || typeof provider.inspect !== 'function') return false;
    if (Array.isArray(provider.kinds) && !provider.kinds.includes(request.kind)) return false;
    if (Array.isArray(provider.preferences)
      && !provider.preferences.some(item => wanted.has(item))) {
      return false;
    }
    return true;
  });
}

export async function inspectAcquisition(requestValue, options = {}) {
  const request = validateAcquisitionRequest(requestValue);
  assertNotDeferred(request.kind);
  const providers = options.providers;
  if (!Array.isArray(providers) || !providers.length) {
    failAcquisition('ACQUISITION_PROVIDERS', 'Acquisition needs an explicit provider list', '$');
  }
  if (request.sourcePreference.includes('generated')
    && !generationConsentGranted(options.consent)
    && request.sourcePreference.every(item => item === 'generated')) {
    failAcquisition('ACQUISITION_CONSENT_REQUIRED',
      'Generated acquisition needs explicit consent and a cost acknowledgement', '$.consent');
  }
  const selected = selectProviders(providers, request);
  const candidates = [];
  for (const provider of selected) {
    let found = [];
    try {
      found = await provider.inspect(request, options);
    } catch (error) {
      if (error instanceof AcquisitionError) throw error;
      break;
    }
    if (!Array.isArray(found) || !found.length) continue;
    for (const item of found) {
      const candidate = validateAcquisitionCandidate(item);
      if (candidate.requestId !== request.id) {
        failAcquisition('ACQUISITION_REQUEST', 'Candidate requestId must match the request',
          '$.requestId');
      }
      if (candidate.kind !== request.kind) continue;
      if (candidate.origin === 'remote-acquisition' && candidate.rights.status !== 'verified') {
        continue;
      }
      if (candidate.origin === 'remote-acquisition' && candidate.rights.distributionAllowed !== true) {
        continue;
      }
      candidates.push(candidate);
      if (candidates.length >= ACQUISITION_LIMITS.maxCandidates) {
        return Object.freeze(candidates.slice());
      }
    }
  }
  return Object.freeze(candidates);
}

export async function fetchAcquisitionCandidate(candidateValue, requestValue, options = {}) {
  const request = validateAcquisitionRequest(requestValue);
  const candidate = validateAcquisitionCandidate(candidateValue);
  assertNotDeferred(candidate.kind);
  if (candidate.requestId !== request.id) {
    failAcquisition('ACQUISITION_REQUEST', 'Fetch candidate does not belong to this request',
      '$.requestId');
  }
  if (candidate.origin === 'generated' && !generationConsentGranted(options.consent)) {
    failAcquisition('ACQUISITION_CONSENT_REQUIRED',
      'Generated acquisition needs explicit consent and a cost acknowledgement', '$.consent');
  }
  const providers = options.providers || [];
  const provider = providers.find(item => item && item.id === candidate.provider);
  if (!provider || typeof provider.fetch !== 'function') {
    failAcquisition('ACQUISITION_PROVIDER', `No fetch adapter for provider ${candidate.provider}`,
      '$.provider');
  }
  let payload;
  try {
    payload = await provider.fetch(candidate, request, options);
  } catch (error) {
    if (error instanceof AcquisitionError) throw error;
    failAcquisition('ACQUISITION_FETCH', 'Provider fetch failed', '$.provider', {
      reason: error?.message || 'provider'
    });
  }
  const bytes = asBytes(payload?.bytes);
  if (!bytes) {
    failAcquisition('ACQUISITION_BYTES', 'Fetch produced no media bytes', '$.bytes');
  }
  const mimeType = String(payload.mimeType || candidate.expectedMime || '').trim();
  const max = byteCeiling(candidate.kind);
  if (bytes.byteLength > max) {
    failAcquisition('ACQUISITION_SIZE', 'Fetched bytes exceed the kind ceiling', '$.byteLength', {
      byteLength: bytes.byteLength,
      max
    });
  }
  if (candidate.kind === 'image' && !mimeAgrees('image', mimeType, bytes)) {
    failAcquisition('ACQUISITION_MIME', 'Fetched bytes are not an admitted image', '$.mimeType', {
      mimeType
    });
  }
  const contentHash = await contentHashOfBytes(bytes);
  const fetched = {
    schema: ACQUISITION_CANDIDATE_SCHEMA,
    ...candidate,
    expectedMime: mimeType,
    fetched: {
      contentHash,
      byteLength: bytes.byteLength,
      mimeType
    }
  };
  if (payload.promptDigest) fetched.promptDigest = payload.promptDigest;
  if (payload.generator) fetched.generator = payload.generator;
  if (payload.safetyResult) fetched.safetyResult = payload.safetyResult;
  if (payload.inputs) fetched.inputs = payload.inputs;
  return {
    candidate: validateAcquisitionCandidate({
      schema: ACQUISITION_CANDIDATE_SCHEMA,
      id: fetched.id,
      requestId: fetched.requestId,
      kind: fetched.kind,
      origin: fetched.origin,
      provider: fetched.provider,
      objectId: fetched.objectId,
      imageId: fetched.imageId,
      workId: fetched.workId,
      relationship: fetched.relationship,
      title: fetched.title,
      creator: fetched.creator,
      credit: fetched.credit,
      description: fetched.description,
      sourceUrl: fetched.sourceUrl,
      expectedMime: fetched.expectedMime,
      rights: fetched.rights,
      inspect: fetched.inspect,
      fetched: fetched.fetched,
      warnings: fetched.warnings
    }),
    bytes,
    mimeType,
    promptDigest: payload.promptDigest || null,
    generator: payload.generator || null,
    safetyResult: payload.safetyResult || null,
    inputs: payload.inputs || null,
    createdAt: payload.createdAt || isoNow(options.now)
  };
}

export async function admitAcquisitionCandidate({
  candidate,
  bytes,
  mimeType,
  verdict,
  projectId,
  assetId,
  promptDigest = null,
  generator = null,
  safetyResult = null,
  inputs = null,
  createdAt = null,
  now = null
} = {}) {
  const judged = validateAcquisitionVerdict(verdict);
  const record = validateAcquisitionCandidate(candidate);
  if (judged.candidateId !== record.id) {
    failAcquisition('ACQUISITION_VERDICT', 'Verdict names a different candidate',
      '$.candidateId');
  }
  if (judged.decision === 'reject') {
    return deepFreeze({ status: 'rejected', candidate: record, verdict: judged });
  }
  if (!record.fetched) {
    failAcquisition('ACQUISITION_BYTES', 'A candidate cannot be admitted before it is fetched',
      '$.fetched');
  }
  const view = asBytes(bytes);
  if (!view) failAcquisition('ACQUISITION_BYTES', 'Admitted bytes are required', '$.bytes');
  const hash = await contentHashOfBytes(view);
  if (hash !== record.fetched.contentHash) {
    failAcquisition('ACQUISITION_HASH_MISMATCH',
      'Admitted bytes do not match the fetched content hash', '$.contentHash');
  }
  if (view.byteLength !== record.fetched.byteLength) {
    failAcquisition('ACQUISITION_SIZE', 'Admitted size does not match the fetch', '$.byteLength');
  }
  const admittedMime = String(mimeType || record.fetched.mimeType).trim();
  if (admittedMime !== record.fetched.mimeType) {
    failAcquisition('ACQUISITION_MIME', 'Admitted MIME does not match the fetch', '$.mimeType');
  }
  const acquiredAt = isoNow(now);
  const provenance = {
    origin: record.origin,
    acquiredAt
  };
  if (record.sourceUrl) provenance.sourceUrl = record.sourceUrl;
  if (record.provider) provenance.provider = record.provider;
  if (record.creator) provenance.creator = record.creator;
  if (createdAt) provenance.createdAt = createdAt;
  if (record.origin === 'generated') {
    provenance.createdAt = createdAt || acquiredAt;
    if (generator) provenance.generator = generator;
    if (promptDigest) provenance.promptDigest = promptDigest;
    if (safetyResult) provenance.safetyResult = safetyResult;
    if (Array.isArray(inputs) && inputs.length) provenance.inputs = inputs;
  }
  const rights = record.origin === 'generated'
    ? unknownRights()
    : { ...record.rights };
  if (record.origin === 'generated' && rights.status === 'verified') {
    failAcquisition('ACQUISITION_RIGHTS',
      'Generated status is not a rights classification', '$.rights');
  }
  const kind = record.kind;
  const asset = validateProjectAsset({
    schema: PROJECT_ASSET_SCHEMA,
    id: exactId(assetId, '$.assetId'),
    projectId: exactId(projectId || record.requestId, '$.projectId'),
    kind,
    mimeType: admittedMime,
    byteLength: view.byteLength,
    contentHash: hash,
    storage: {
      kind: kind === 'document' ? 'inline' : 'workshop-idb',
      recordId: exactId(assetId, '$.assetId')
    },
    provenance,
    rights,
    transformations: []
  });
  return deepFreeze({
    status: 'admitted',
    asset,
    bytes: view,
    candidate: record,
    verdict: judged
  });
}

export function acquisitionRequestFromAgentOp(op, { projectId } = {}) {
  if (!op || op.op !== 'request-asset') {
    failAcquisition('ACQUISITION_REQUEST', 'Expected a request-asset operation', '$.op');
  }
  const request = {
    schema: ACQUISITION_REQUEST_SCHEMA,
    id: op.requestId,
    kind: op.kind,
    purpose: 'agent-request',
    query: op.query,
    sourcePreference: op.kind === 'document'
      ? ['project-media']
      : ['public-domain']
  };
  if (projectId) request.projectId = projectId;
  if (op.anchor) request.proposedAnchor = { ...op.anchor };
  const objectId = parseAicObjectId(op.query);
  if (objectId) request.objectId = objectId;
  const workId = parseArchiveWorkId(op.query);
  if (op.kind === 'document' && workId) {
    request.workId = workId;
    request.relationship = 'archive';
  }
  return validateAcquisitionRequest(request);
}

export async function inspectRequestAsset(op, options = {}) {
  const request = acquisitionRequestFromAgentOp(op, { projectId: options.projectId });
  const candidates = await inspectAcquisition(request, options);
  return { request, candidates };
}
