/**
 * Source-revision dependency audit.
 *
 * This does not search arbitrary JSON heuristically.  It knows the five
 * release consumers that can keep an edition alive and reports the exact path
 * that must be reviewed before a revision moves.
 */

export class SourceDependencyError extends Error {
  constructor(message, report) {
    super(message);
    this.name = 'SourceDependencyError';
    this.code = 'ARCHIVE_SOURCE_DEPENDENCIES';
    this.report = report;
  }
}

const exact = value => typeof value === 'string' && value.trim() ? value.trim() : null;

function sourceIdentity(source) {
  const metadata = source?.metadata || {};
  const provenance = source?.provenance || {};
  const workId = exact(metadata.parentWorkId) || exact(metadata.workId)
    || exact(provenance.workId) || exact(source?.workId);
  const editionId = exact(metadata.editionId) || exact(provenance.editionId)
    || exact(source?.editionId);
  const sourceRevision = exact(metadata.sourceRevision) || exact(provenance.sourceRevision)
    || exact(source?.sourceRevision);
  if (!workId && !editionId) return null;
  return { workId, editionId, sourceRevision };
}

function dependency(kind, consumerId, path, identity, sourceId = null) {
  return Object.freeze({
    kind,
    consumerId: exact(consumerId) || '(unnamed)',
    path,
    ...(sourceId ? { sourceId } : {}),
    ...identity
  });
}

function programDependencies(program, sources, ownerId, ownerKind) {
  if (!program || !Array.isArray(program.tracks)) return [];
  const identities = new Map((sources || []).map(source => [source.id, sourceIdentity(source)]));
  const out = [];
  for (const [trackIndex, track] of program.tracks.entries()) {
    for (const [clipIndex, clip] of (track.clips || []).entries()) {
      for (const sourceId of (clip?.anchor?.sourceIds || [])) {
        const identity = identities.get(sourceId);
        if (!identity) continue;
        out.push(dependency(ownerKind, ownerId,
          `$.experienceProgram.tracks[${trackIndex}].clips[${clipIndex}].anchor`,
          identity, sourceId));
      }
    }
  }
  return out;
}

/** Collect every known reference class into one stable report vocabulary. */
export function collectSourceDependencies({
  workshopProjects = [],
  experiencePrograms = [],
  sourceCatalog = [],
  journeys = [],
  renderJobs = [],
  deepLinks = []
} = {}) {
  const out = [];
  for (const project of workshopProjects) {
    for (const [index, source] of (project?.sources || []).entries()) {
      const identity = sourceIdentity(source);
      if (identity) out.push(dependency('workshop-project', project.id,
        `$.sources[${index}]`, identity, source.id));
    }
    out.push(...programDependencies(project?.experienceProgram, project?.sources,
      project?.id, 'workshop-program'));
  }
  for (const program of experiencePrograms) {
    out.push(...programDependencies(program, sourceCatalog, program?.id, 'experience-program'));
  }
  for (const journey of journeys) {
    for (const [index, passage] of (journey?.passages || []).entries()) {
      const workId = exact(passage?.workId);
      if (workId) out.push(dependency('journey', journey.id,
        `$.passages[${index}]`, { workId, editionId: null, sourceRevision: null }, passage.id));
    }
  }
  for (const job of renderJobs) {
    for (const [index, snapshot] of (job?.sourceSnapshots || []).entries()) {
      const identity = sourceIdentity(snapshot);
      if (identity) out.push(dependency('render-job', job.id,
        `$.sourceSnapshots[${index}]`, identity, snapshot.sourceId));
    }
  }
  for (const [index, link] of deepLinks.entries()) {
    const workId = exact(typeof link === 'string' ? link.split('#')[0] : link?.workId);
    if (workId) out.push(dependency('deep-link', link?.id || `link-${index + 1}`,
      `$[${index}]`, { workId, editionId: null, sourceRevision: null }));
  }
  return Object.freeze(out);
}

function concerns(dependencyRecord, identity) {
  return dependencyRecord.workId === identity.workId
    || (dependencyRecord.editionId && dependencyRecord.editionId === identity.editionId);
}

/** Classify dependents against the exact revision proposed for release. */
export function auditSourceDependencies(identity, consumers = {}) {
  const dependencies = collectSourceDependencies(consumers).filter(item => concerns(item, identity));
  const current = [];
  const blockers = [];
  for (const item of dependencies) {
    if (!item.editionId || !item.sourceRevision) {
      blockers.push(Object.freeze({ ...item, finding: 'unversioned' }));
    } else if (item.editionId !== identity.editionId
      || item.sourceRevision !== identity.sourceRevision) {
      blockers.push(Object.freeze({ ...item, finding: 'stale-revision' }));
    } else {
      current.push(Object.freeze({ ...item, finding: 'current' }));
    }
  }
  return Object.freeze({
    identity: Object.freeze({ ...identity }),
    dependencies: Object.freeze(dependencies),
    current: Object.freeze(current),
    blockers: Object.freeze(blockers),
    safe: blockers.length === 0
  });
}

export function assertSourceDependenciesCurrent(identity, consumers = {}) {
  const report = auditSourceDependencies(identity, consumers);
  if (!report.safe) {
    throw new SourceDependencyError(
      `${identity.workId} has ${report.blockers.length} unversioned or stale dependent reference(s)`,
      report
    );
  }
  return report;
}
