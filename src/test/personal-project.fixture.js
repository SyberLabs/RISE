import { validateWorkshopProject } from '../core/workshop-project.js';

/** A personal reading as earlier releases kept it. RISE no longer writes new ones; readers still hold them. */
export function personalProject({ title = 'A small clearing', paragraphs = [
  'The morning leaves a little room beside the window. Nothing needs to fill it quickly. A cup waits on the table while the light moves across its rim, and the quiet has no assignment for the day. For a moment, the room is simply a room.',
  'Outside, a branch sketches its patient shape against the sky. It does not ask the wind to explain itself. There is space here for an unfinished thought, for an ordinary breath, for the next small thing to arrive in its own time.'
] } = {}) {
  const id = `personal-${crypto.randomUUID()}`;
  return validateWorkshopProject({
    schema: 'rise.workshop-project.v1', id, title, intent: 'personal-reading',
    sources: [{ id: 'personal-text', name: title, providerId: 'local', type: 'text/plain', data: paragraphs.join('\n\n') }],
    assets: [], experienceProgram: null, paceV2: true,
    defaults: {
      reading: { wpm: 160, chunkMode: 'sentence', curve: 'flat', displayMode: 'focal' },
      visual: { surface: 'off', config: { visualMode: 'off' } },
      audio: { soundscape: 'none', audioPreset: 'silent', selectedSwellId: null },
      projection: 'stream', recitation: { enabled: false }, voiceId: null, render: { profileId: null }
    },
    provenance: {
      kind: 'personal-generated', compositionId: id, parentRevisionId: null,
      writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1', presentationVersion: 'personal-neutral-v1'
    },
    revision: 0, updatedAt: Date.now()
  });
}
