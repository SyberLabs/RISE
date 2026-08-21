import { describe, expect, it } from 'vitest';
import {
  assertSourceDependenciesCurrent,
  auditSourceDependencies,
  SourceDependencyError
} from './source-dependencies.js';

const IDENTITY = Object.freeze({
  workId: 'literary-meditations',
  editionId: 'standard-ebooks:marcus-aurelius/meditations/george-long',
  sourceRevision: `sha256:${'a'.repeat(64)}`
});

function source(revision = IDENTITY.sourceRevision) {
  return {
    id: 'meditations#1',
    data: 'From my grandfather Verus',
    metadata: { ...IDENTITY, sourceRevision: revision }
  };
}

function program() {
  return {
    id: 'program-1',
    tracks: [{ kind: 'movement', clips: [{
      id: 'movement-1', anchor: { sourceIds: ['meditations#1'] }
    }] }]
  };
}

describe('source dependency audit', () => {
  it('accepts exact Workshop and render snapshots', () => {
    const report = auditSourceDependencies(IDENTITY, {
      workshopProjects: [{ id: 'project-1', sources: [source()], experienceProgram: program() }],
      renderJobs: [{ id: 'render-1', sourceSnapshots: [{
        sourceId: 'meditations#1', ...IDENTITY
      }] }]
    });
    expect(report.safe).toBe(true);
    expect(report.current.map(item => item.kind)).toEqual([
      'workshop-project', 'workshop-program', 'render-job'
    ]);
  });

  it('refuses stale and unversioned consumers with their exact paths', () => {
    const report = auditSourceDependencies(IDENTITY, {
      workshopProjects: [{ id: 'old-project', sources: [source(`sha256:${'b'.repeat(64)}`)] }],
      journeys: [{ id: 'war', passages: [{ id: 'marcus', workId: IDENTITY.workId }] }],
      deepLinks: ['literary-meditations#1']
    });
    expect(report.safe).toBe(false);
    expect(report.blockers.map(item => item.finding)).toEqual([
      'stale-revision', 'unversioned', 'unversioned'
    ]);
    expect(() => assertSourceDependenciesCurrent(IDENTITY, {
      journeys: [{ id: 'war', passages: [{ workId: IDENTITY.workId }] }]
    })).toThrow(SourceDependencyError);
  });
});
