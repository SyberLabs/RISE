import { describe, it, expect } from 'vitest';
import { createPersonalProject, importPersonalProject, personalSession, serializePersonalProject } from './personal-project.js';

export const piece = { title: 'A small clearing', paragraphs: [
  'The morning leaves a little room beside the window. Nothing needs to fill it quickly. A cup waits on the table while the light moves across its rim, and the quiet has no assignment for the day. For a moment, the room is simply a room.',
  'Outside, a branch sketches its patient shape against the sky. It does not ask the wind to explain itself. There is space here for an unfinished thought, for an ordinary breath, for the next small thing to arrive in its own time.'
], writerModel: 'qwen/qwen3.5-9b', promptVersion: 'personal-v1' };

describe('personal projects', () => {
  it('round trips exact text and title with safe executable defaults', () => {
    const p = createPersonalProject(piece);
    expect(importPersonalProject(serializePersonalProject(p)).project).toEqual(p);
    const s = personalSession(p);
    expect(s.sources[0].data).toBe(piece.paragraphs.join('\n\n'));
    expect(s).toMatchObject({ wpm: 160, curve: 'flat', chunkMode: 'sentence', soundscape: 'none', audioPreset: 'silent', recitation: { enabled: false } });
  });
  it('preserves the parent and creates distinct revisions without raw input metadata', () => {
    const parent = createPersonalProject(piece);
    const child = createPersonalProject({ ...piece, thought: 'SECRET', instruction: 'SECRET' }, parent);
    expect(child.id).not.toBe(parent.id);
    expect(child.provenance.compositionId).toBe(parent.provenance.compositionId);
    expect(child.provenance.parentRevisionId).toBe(parent.id);
    expect(child.revision).toBe(parent.revision + 1);
    expect(JSON.stringify(child)).not.toContain('SECRET');
  });
  it('rejects oversized input before parsing and unsafe fields before normalization', () => {
    expect(() => importPersonalProject(' '.repeat(65537))).toThrow(/64 KiB/);
    for (const change of [p => p.authority = true, p => p.assets.push({uri:'https://evil.test'}), p => p.sources[0].providerId = 'remote', p => p.defaults.recitation.enabled = true, p => p.provenance.thought = 'secret', p => p.experienceProgram = {}, p => p.defaults.visual.config.url = 'https://evil.test']) {
      const p = JSON.parse(serializePersonalProject(createPersonalProject(piece)));
      change(p);
      expect(() => importPersonalProject(JSON.stringify(p))).toThrow();
    }
    expect(() => importPersonalProject('{"__proto__":{}}')).toThrow();
  });
  it('preserves text on unknown presentation version and gives a neutral fallback notice', () => {
    const p = JSON.parse(serializePersonalProject(createPersonalProject(piece)));
    p.provenance.presentationVersion = 'future-2';
    const result = importPersonalProject(JSON.stringify(p));
    expect(result.project.sources[0].data).toBe(p.sources[0].data);
    expect(result.notice).toMatch(/neutral/i);
  });
});
