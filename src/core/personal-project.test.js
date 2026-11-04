import { describe, it, expect } from 'vitest';
import { personalSession, serializePersonalProject } from './personal-project.js';
import { personalProject } from '../test/personal-project.fixture.js';

const stored = p => JSON.parse(serializePersonalProject(p));

describe('personal projects', () => {
  it('round trips exact text and title with safe executable defaults', () => {
    const p = personalProject();
    expect(stored(p)).toEqual(JSON.parse(JSON.stringify(p)));
    const s = personalSession(p);
    expect(s.sources[0].data).toBe(p.sources[0].data);
    expect(s).toMatchObject({ wpm: 160, curve: 'flat', chunkMode: 'sentence', soundscape: 'none', audioPreset: 'silent', recitation: { enabled: false } });
  });
  it('rejects unsafe fields before normalization', () => {
    for (const change of [p => p.authority = true, p => p.assets.push({uri:'https://evil.test'}), p => p.sources[0].providerId = 'remote', p => p.defaults.recitation.enabled = true, p => p.provenance.thought = 'secret', p => p.experienceProgram = {}, p => p.defaults.visual.config.url = 'https://evil.test']) {
      const p = stored(personalProject());
      change(p);
      expect(() => personalSession(p)).toThrow();
    }
  });
  it('preserves text on unknown presentation version and falls back to neutral presentation', () => {
    const p = stored(personalProject());
    p.provenance.presentationVersion = 'future-2';
    p.defaults.audio.soundscape = 'soft-rain';
    p.defaults.reading.wpm = 200;
    const s = personalSession(p);
    expect(s.sources[0].data).toBe(p.sources[0].data);
    expect(s.soundscape).toBe('none');
    expect(s.wpm).toBe(160);
  });
  it('rejects active or unsafe settings even on an unknown presentation version', () => {
    for (const defaults of [null, [], { remote: 'https://evil.example' }, { program: 'code' }, { recitation: { enabled: true } }]) {
      const p = stored(personalProject()); p.provenance.presentationVersion = 'future'; p.defaults = defaults;
      expect(() => personalSession(p)).toThrow();
    }
  });
  it('preserves single line breaks through project export', () => {
    const p = personalProject({ paragraphs: personalProject().sources[0].data.split('\n\n').map(text => text.replace('. ', '.\n')) });
    expect(stored(p).sources[0].data).toBe(p.sources[0].data);
  });
});
