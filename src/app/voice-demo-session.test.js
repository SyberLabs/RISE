import { expect, it } from 'vitest';
import { voiceDemoSession, VOICE_DEMO_SAMPLE } from './voice-demo-session.js';
import { compileSession } from '../core/session-compiler.js';
import { isReadersOwn } from './chamber-session-factory.js';

it('compiles editable own text with an explicit ElevenLabs request and continuous visuals', () => {
  const input = voiceDemoSession({ text: VOICE_DEMO_SAMPLE, voice: 'river', look: 'prism' });
  const session = compileSession(input);
  expect(session.atoms.some(atom => typeof atom.content === 'string' && atom.content.includes('light'))).toBe(true);
  expect(isReadersOwn(session)).toBe(true);
  expect(session.origin).toMatchObject({ view: 'voice-demo', requireElevenLabs: true, voice: 'river' });
  expect(session.visualConfig).toMatchObject({ visualMode: 'interlocution', interlocution: { presentation: 'continuous', procedural: ['fractal'] } });
  expect(session.recitation.enabled).toBe(false);
});

it('refuses empty or oversized demos rather than silently trimming reader text', () => {
  expect(() => voiceDemoSession({ text: '  ', voice: 'default' })).toThrow();
  expect(() => voiceDemoSession({ text: 'word '.repeat(2500), voice: 'default' })).toThrow();
});
