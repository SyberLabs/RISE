import { describe, expect, it } from 'vitest';
import { EXPERIENCE_PROGRAM_SCHEMA } from '../experience-program.js';
import {
  DEFAULT_RENDER_PROFILE_ID,
  EXPORT_MP4_PATH,
  KERNEL_REQUEST_SCHEMA,
  buildKernelRequest,
  kernelRequestFromWorkshopPayload,
  renderCliCommand,
  sourcesForKernel
} from './kernel-request.js';

const program = {
  schema: EXPERIENCE_PROGRAM_SCHEMA,
  id: 'score-1',
  authority: 'user',
  editable: true,
  tracks: [{
    id: 'movements',
    kind: 'movement',
    clips: [{ id: 'm1', anchor: { sourceIds: ['src-1'] }, data: { index: 0, title: 'One' } }]
  }]
};

describe('kernel request hopper', () => {
  it('builds rise.kernel-request.v1 with the social portrait default', () => {
    const request = buildKernelRequest({
      program,
      sources: [{ id: 'src-1', name: 'Anna', data: 'Happy families are all alike.' }]
    });
    expect(request.schema).toBe(KERNEL_REQUEST_SCHEMA);
    expect(request.profileId).toBe(DEFAULT_RENDER_PROFILE_ID);
    expect(request.sources[0]).toMatchObject({ id: 'src-1', data: 'Happy families are all alike.' });
    expect(request).not.toHaveProperty('outputPath');
  });

  it('reads Workshop payload sources and session input', () => {
    const request = kernelRequestFromWorkshopPayload({
      experienceProgram: program,
      experienceProgramId: 'workshop-draft',
      sources: [{ id: 'src-1', name: 'Anna', data: 'Happy families are all alike.' }],
      wpm: 150,
      chunkMode: 'phrase',
      curve: 'flat'
    }, { painter: 'chamber' });
    expect(request.schema).toBe(KERNEL_REQUEST_SCHEMA);
    expect(request.projectId).toBe('workshop-draft');
    expect(request.painter).toBe('chamber');
    expect(request.sessionInput).toMatchObject({ wpm: 150, chunkMode: 'phrase', curve: 'flat' });
  });

  it('returns null when the Workshop has no score', () => {
    expect(kernelRequestFromWorkshopPayload({ sources: [] })).toBeNull();
  });

  it('accepts a source map', () => {
    expect(sourcesForKernel({ 'src-1': { data: 'Hello' } })).toEqual([
      { id: 'src-1', name: 'src-1', data: 'Hello' }
    ]);
  });

  it('names the CLI for a downloaded kernel request', () => {
    expect(EXPORT_MP4_PATH).toBe('/__rise/export-mp4');
    expect(renderCliCommand('score-1.kernel-request.json'))
      .toBe('npm run render:mp4 -- score-1.kernel-request.json');
  });
});
