import { describe, expect, it } from 'vitest';
import { isVoiceNote, voiceLine } from './voice-trace.js';

describe('the voice trace', () => {
  it('keeps the entries that concern the voice and leaves the rest', () => {
    for (const type of ['speech.start', 'speech.end', 'voice.degraded', 'voice.held', 'voice.released', 'voice.failed', 'hold', 'interrupt', 'run.failed', 'run.finished', 'seek', 'replay', 'pace', 'voice.recovered']) {
      expect(isVoiceNote(type), type).toBe(true);
    }
    for (const type of ['start', 'connection.lost', 'branch.open', 'scene.failed', '', undefined]) {
      expect(isVoiceNote(type), String(type)).toBe(false);
    }
  });

  it('reads as one line with the time in seconds and every field', () => {
    expect(voiceLine({ at: 12345, type: 'voice.held', role: 'main', segmentId: 'beat-3', resumeAt: 17, restarts: true }))
      .toBe('t=12.345s voice.held role=main segmentId=beat-3 resumeAt=17 restarts=true');
    expect(voiceLine({ at: 0, type: 'voice.degraded', role: 'main', reason: 'voice-did-not-start' }))
      .toBe('t=0.000s voice.degraded role=main reason=voice-did-not-start');
  });
});
