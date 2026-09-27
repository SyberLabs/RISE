import { describe, expect, it } from 'vitest';
import { Scriptorium } from './Scriptorium.js';

describe('Scriptorium home handoff', () => {
  it('carries home intent, length, and reader settings into the admitted project', () => {
    const room = new Scriptorium(document.createElement('div'), {
      initialIntent: 'Read about resilience',
      initialTargetWords: 2000,
      readingPreferences: {
        wpm: 260, curve: 'wave', chunkMode: 'phrase',
        audioPreset: 'focus', soundscape: 'none', visualMode: 'focals'
      }
    });
    expect(room.intent).toBe('Read about resilience');
    expect(room.targetWords).toBe(2000);
    expect(room.session.wpm).toBe(260);

    const project = {
      defaults: {
        reading: { wpm: 200, curve: 'flat', chunkMode: 'word' },
        audio: { audioPreset: 'silent', soundscape: 'none' },
        visual: { surface: 'off', config: { visualMode: 'off' } }
      }
    };
    const chosen = room.withReadingPreferences(project);
    expect(chosen.defaults.reading).toMatchObject({ wpm: 260, curve: 'wave', chunkMode: 'phrase' });
    expect(chosen.defaults.audio).toMatchObject({ audioPreset: 'focus', soundscape: 'none' });
    expect(chosen.defaults.visual).toMatchObject({ surface: 'focal', config: { visualMode: 'focals' } });
    expect(project.defaults.reading.wpm).toBe(200);
  });
});
