import { describe, expect, it } from 'vitest';
import {
  AGENT_OPERATION_SET_SCHEMA,
  AgentOperationError,
  applyAgentOperationSet,
  cancelAgentRun,
  createAgentOperationHistory,
  createAgentRun,
  previewAgentOperationSet,
  recordAgentOperationSet,
  redoAgentOperationSet,
  rejectAgentOperation,
  undoAgentOperationSet,
  validateAgentOperationSet
} from './agent-operations.js';
import { emptyWorkshopProject } from './workshop-project.js';
import { exportCuratorContext } from './curator-context.js';
import { contentHashOf } from './render/hash.js';
import { admitRenderJob, pinnedRendererForProfile } from './render/job.js';
import { preflightRenderJob, PREFLIGHT_VERDICTS } from './render/preflight.js';
import { RENDER_JOB_SCHEMA } from './render/environment.js';
import { buildSequenceMapGroups } from '../components/workshop/sequence-map.js';

const SOURCE_ID = 'source-anna';
const SOURCE_TEXT = [
  'Happy families are all alike; every unhappy family is unhappy in its own way.',
  "Everything was in confusion in the Oblonskys' house."
].join(' ');

function opSet(operations, overrides = {}) {
  return {
    schema: AGENT_OPERATION_SET_SCHEMA,
    id: 'ops-memory-1',
    projectId: 'project-memory',
    baseRevision: 0,
    generationId: 'run-1',
    intent: 'Build quietly, then open into color.',
    operations,
    ...overrides
  };
}

function composeOps() {
  return opSet([
    { op: 'add-source', id: 'op-source', sourceId: SOURCE_ID },
    {
      op: 'assign-visual',
      id: 'op-visual',
      assignmentId: 'visual-klee',
      sourceId: SOURCE_ID,
      assetId: 'procedural:klee',
      fromCharacter: 0,
      toCharacter: 40
    },
    {
      op: 'assign-audio',
      id: 'op-audio',
      assignmentId: 'bed-aurora',
      sourceId: SOURCE_ID,
      assetId: 'soundscape:aurora',
      fromCharacter: 0,
      toCharacter: SOURCE_TEXT.length
    },
    {
      op: 'set-pace',
      id: 'op-pace',
      assignmentId: 'pace-1',
      sourceId: SOURCE_ID,
      cue: { wpm: 150, chunkMode: 'phrase' }
    },
    { op: 'set-render-profile', id: 'op-profile', profileId: 'social-portrait-1080' },
    { op: 'request-compile', id: 'op-compile' }
  ]);
}

describe('rise.agent-operation-set.v1', () => {
  it('validates a closed vocabulary and refuses unknown ops or URI identities', () => {
    const set = validateAgentOperationSet(opSet([
      { op: 'set-atmosphere', id: 'op-atm', soundscape: 'aurora' }
    ]));
    expect(Object.isFrozen(set)).toBe(true);
    expect(set.operations[0].op).toBe('set-atmosphere');
    expect(() => validateAgentOperationSet(opSet([
      { op: 'invent-laser', id: 'op-x' }
    ]))).toThrow(expect.objectContaining({ code: 'AGENT_OP_UNKNOWN' }));
    expect(() => validateAgentOperationSet(opSet([
      { op: 'add-source', id: 'op-s', sourceId: 'https://example.com/walden' }
    ]))).toThrow(expect.objectContaining({ code: 'AGENT_OP_URI' }));
  });

  it('applies a transactional revision and maps onto Workshop command names', () => {
    const project = emptyWorkshopProject({ id: 'project-memory' });
    const result = applyAgentOperationSet({
      project,
      operationSet: composeOps(),
      resolvedSources: {
        [SOURCE_ID]: { id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }
      }
    });
    expect(result.project.revision).toBe(1);
    expect(result.project.sources[0].id).toBe(SOURCE_ID);
    expect(result.project.experienceProgram.tracks.some(track => track.kind === 'visual')).toBe(true);
    expect(result.project.defaults.render.profileId).toBe('social-portrait-1080');
    expect(result.inspection.map(item => item.status)).toEqual([
      'applied', 'applied', 'applied', 'applied', 'applied', 'requested'
    ]);
    expect(result.historyCommand.workshopCommands.map(item => item.type))
      .toContain('assign');
    expect(result.historyCommand.before).toEqual(project);
    expect(result.requests[0].op).toBe('request-compile');
  });

  it('refuses a stale revision and a cancelled generation without mutating the project', () => {
    const project = emptyWorkshopProject({ id: 'project-memory' });
    expect(() => applyAgentOperationSet({
      project,
      operationSet: opSet([
        { op: 'set-atmosphere', id: 'op-atm', soundscape: 'aurora' }
      ], { baseRevision: 4 })
    })).toThrow(expect.objectContaining({ code: 'AGENT_OP_STALE_REVISION' }));

    const run = cancelAgentRun(createAgentRun({ generationId: 'run-1' }));
    expect(() => applyAgentOperationSet({
      project,
      operationSet: opSet([
        { op: 'set-atmosphere', id: 'op-atm', soundscape: 'aurora' }
      ]),
      run
    })).toThrow(expect.objectContaining({ code: 'AGENT_OP_CANCELLED' }));
    expect(project.revision).toBe(0);
  });

  it('leaves request-asset pending and will not ship a transition the Workshop cannot author', () => {
    const project = emptyWorkshopProject({ id: 'project-memory' });
    const pending = applyAgentOperationSet({
      project,
      operationSet: opSet([
        { op: 'set-atmosphere', id: 'op-atm', soundscape: 'aurora' },
        {
          op: 'request-asset',
          id: 'op-req',
          requestId: 'rain-window',
          kind: 'image',
          query: 'rain on a railway window'
        }
      ])
    });
    expect(pending.inspection.find(item => item.op === 'request-asset').status).toBe('pending');
    expect(pending.project.revision).toBe(1);

    expect(() => applyAgentOperationSet({
      project,
      operationSet: opSet([
        { op: 'create-transition', id: 'op-t', transitionId: 't1', fromMovementId: 'm1' }
      ])
    })).toThrow(expect.objectContaining({ code: 'AGENT_OP_NO_WORKSHOP_EQUIVALENT' }));
  });

  it('rejects one operation without corrupting the rest of the proposal', () => {
    const trimmed = rejectAgentOperation({
      operationSet: composeOps(),
      operationId: 'op-audio'
    });
    expect(trimmed.operations.map(item => item.id)).not.toContain('op-audio');
    expect(trimmed.operations.map(item => item.id)).toContain('op-visual');
  });

  it('records the accepted set on the same undo/redo stack a human command would use', () => {
    const project = emptyWorkshopProject({ id: 'project-memory' });
    const applied = applyAgentOperationSet({
      project,
      operationSet: opSet([
        { op: 'set-atmosphere', id: 'op-atm', soundscape: 'aurora' }
      ]),
      resolvedSources: {}
    });
    let history = recordAgentOperationSet(createAgentOperationHistory(), applied.historyCommand);
    const undone = undoAgentOperationSet(history);
    expect(undone.command.before.revision).toBe(0);
    expect(undone.command.after.defaults.audio.soundscape).toBe('aurora');
    const redone = redoAgentOperationSet(undone.history);
    expect(redone.command.after.revision).toBe(1);
  });

  it('shows proposed clips on the sequence map in reading order', () => {
    const applied = applyAgentOperationSet({
      project: emptyWorkshopProject({ id: 'project-memory' }),
      operationSet: composeOps(),
      resolvedSources: {
        [SOURCE_ID]: { id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }
      }
    });
    const groups = buildSequenceMapGroups({
      sources: applied.project.sources,
      visualAssignments: applied.proposedVisual,
      audioAssignments: applied.proposedAudio,
      proposedIds: new Set(['visual-klee', 'bed-aurora'])
    });
    expect(groups[0].entries[0].status).toBe('proposed');
    expect(groups[0].entries[0].visual.id).toBe('visual-klee');
  });

  it('walks intent → proposal → Workshop revision → render preflight', async () => {
    const context = exportCuratorContext({
      id: 'ctx-ops',
      sources: [],
      includeLibrary: false
    });
    const project = emptyWorkshopProject({ id: 'project-memory', title: 'Memory' });
    const preview = previewAgentOperationSet({
      project,
      operationSet: composeOps(),
      context,
      resolvedSources: {
        [SOURCE_ID]: { id: SOURCE_ID, name: 'Anna', data: SOURCE_TEXT }
      }
    });
    expect(preview.project.revision).toBe(1);

    const program = preview.project.experienceProgram;
    const programHash = await contentHashOf(program);
    const sourceHash = await contentHashOf(SOURCE_TEXT);
    const { job } = await admitRenderJob({
      schema: RENDER_JOB_SCHEMA,
      id: 'render-ops-1',
      projectId: preview.project.id,
      projectRevision: preview.project.revision,
      programHash,
      sourceSnapshots: [{ sourceId: SOURCE_ID, contentHash: sourceHash, editionId: 'edition-1' }],
      assetSnapshots: [],
      profile: preview.project.defaults.render.profileId,
      viewport: { width: 1080, height: 1920, pixelRatio: 1 },
      frameRate: { numerator: 30, denominator: 1 },
      durationMs: 4000,
      seed: 'project-memory:1',
      renderer: pinnedRendererForProfile('social-portrait-1080'),
      policies: {
        unsupportedCue: 'refuse',
        missingAsset: 'refuse',
        reducedMotion: false,
        includeCredits: true,
        distributionClass: 'private-review'
      }
    });
    const report = await preflightRenderJob({
      job,
      program,
      inventory: {
        sources: [{
          sourceId: SOURCE_ID,
          contentHash: sourceHash,
          editionId: 'edition-1',
          byteLength: SOURCE_TEXT.length,
          characterCount: SOURCE_TEXT.length
        }],
        assets: []
      }
    });
    expect(report.verdict).toBe(PREFLIGHT_VERDICTS.RENDERABLE);
  });
});
