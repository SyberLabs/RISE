/**
 * Archive certification is evidence tied to one exact edition revision.
 *
 * A place on the intended canon is not certification.  The release boundary
 * asks this module whether a complete human-reviewed record exists for the
 * bytes currently registered.  Changing any upstream file digest changes the
 * revision and automatically withdraws the old certification.
 */

import RELEASE_INVENTORY from './release-inventory.json' with { type: 'json' };
import CERTIFICATION_RECORDS from './certifications.json' with { type: 'json' };

export const ARCHIVE_CERTIFICATION_SCHEMA = 'rise.archive-certification.v1';

/**
 * Human-approved records live here.  Deliberately empty until the comparison
 * reports and their dispositions have actually been reviewed.
 */
export const ARCHIVE_CERTIFICATIONS = Object.freeze(CERTIFICATION_RECORDS);

function exact(value) {
  return typeof value === 'string' && value.trim() ? value.trim() : null;
}

function sourceFileDigest(entry) {
  const match = String(entry ?? '').match(/\s([0-9a-f]{64})$/u);
  return match?.[1] || null;
}

function standardEbooksSlug(meta) {
  const url = exact(meta?.source?.url);
  if (!url) return null;
  try {
    const path = new URL(url).pathname.replace(/^\/ebooks\//u, '').replace(/^\/+|\/+$/gu, '');
    return path || null;
  } catch {
    return null;
  }
}

/** Exact, reproducible identity for the edition bytes held by RISE. */
export function archiveEditionIdentity(meta) {
  const workId = exact(meta?.id);
  const inventory = workId ? RELEASE_INVENTORY[workId] : null;
  const source = meta?.source || inventory?.source;
  const slug = standardEbooksSlug({ source });
  const files = Array.isArray(source?.files) ? source.files : [];
  const digests = files.map(sourceFileDigest).filter(Boolean).sort();
  if (!workId || !slug || digests.length !== files.length || digests.length === 0) {
    return null;
  }
  return Object.freeze({
    workId,
    editionId: exact(meta?.editionId) || exact(inventory?.editionId) || `standard-ebooks:${slug}`,
    sourceRevision: exact(meta?.sourceRevision) || exact(inventory?.sourceRevision)
      // Compatibility for an external review record not yet in the generated
      // inventory. Admitted shelf records always use the compact SHA-256.
      || `sha256-set:${digests.join('.')}`
  });
}

function completeCertification(record) {
  return record
    && record.schema === ARCHIVE_CERTIFICATION_SCHEMA
    && exact(record.workId)
    && exact(record.editionId)
    && exact(record.sourceRevision)
    && exact(record.editionChoice?.kind)
    && exact(record.editionChoice?.rationale)
    && exact(record.comparison?.reference)
    && exact(record.comparison?.completedAt)
    && record.comparison?.structural === true
    && record.comparison?.token === true
    && exact(record.dispositions?.reviewer)
    && exact(record.dispositions?.completedAt)
    && Number.isInteger(record.dispositions?.count)
    && record.dispositions.count >= 0
    && exact(record.detectors?.registryRevision)
    && record.detectors?.allZero === true
    && exact(record.certifiedAt);
}

/** A record certifies only the exact bytes it was reviewed against. */
export function certificationFor(meta) {
  const identity = archiveEditionIdentity(meta);
  if (!identity) return null;
  const record = ARCHIVE_CERTIFICATIONS[identity.workId];
  if (!completeCertification(record)) return null;
  if (record.editionId !== identity.editionId
    || record.sourceRevision !== identity.sourceRevision) return null;
  return record;
}

export function isArchiveEditionCertified(meta) {
  return certificationFor(meta) !== null;
}

export const CERTIFIED_IDS = Object.freeze(new Set(
  Object.values(ARCHIVE_CERTIFICATIONS)
    .filter(completeCertification)
    .map(record => record.workId)
));

/** Attach release identity without mutating generated ingest metadata. */
export function withArchiveReleaseIdentity(meta) {
  const identity = archiveEditionIdentity(meta);
  if (!identity) return Object.freeze({ ...meta, certificationStatus: 'invalid' });
  const certification = certificationFor(meta);
  return Object.freeze({
    ...meta,
    ...identity,
    certificationStatus: certification ? 'certified' : 'candidate',
    ...(certification ? { certification } : {})
  });
}
