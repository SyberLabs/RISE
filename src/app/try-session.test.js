import { describe, expect, it } from 'vitest';
import voicePackManifest from '../audio/voice-pack.manifest.json' with { type: 'json' };
import { DEFAULT_VOICE_ID } from '../audio/voice-pack-key.js';
import { Voice } from '../audio/voice.js';
import { keystoneManifest, resolveKeystone } from '../content/keystones.js';
import { READING_LIMITS } from '../core/reading-limits.js';
import { compileSession } from '../core/session-compiler.js';
import {
  TRY_SAMPLE,
  TRY_TEXT_MAX_CHARS,
  trySampleSession,
  tryTextProblem,
  tryTextSession
} from './try-session.js';

const voice = () => new Voice({ voiceId: DEFAULT_VOICE_ID, manifest: voicePackManifest });

describe('the /try/ sample', () => {
  it('is a verbatim excerpt of the Metamorphoses edition the Keystone reads', async () => {
    const { sessionInput } = await resolveKeystone('metamorphoses', { allowIncomplete: true });
    expect(sessionInput.text).toContain(TRY_SAMPLE.text);
    expect(keystoneManifest('metamorphoses').author).toBe(TRY_SAMPLE.author);
  });

  it('is spoken by the release voice pack, phrase for phrase, with no provider', () => {
    const session = compileSession(trySampleSession());
    expect(voice().coverage(session.atoms)).toMatchObject({ complete: true, missing: 0 });
    expect(session.recitation.enabled).toBe(true);
    expect(session.origin).toMatchObject({ view: 'try', kind: 'sample' });
  });

  it('lasts about a minute, spoken or read silently', () => {
    const session = compileSession(trySampleSession());
    const entries = voicePackManifest.voices[DEFAULT_VOICE_ID].entries;
    const durations = new Map(Object.values(entries).map(entry => [entry.text.normalize('NFKC'), entry.durationMs]));
    const spokenMs = session.atoms.reduce((sum, atom) => sum + (durations.get(String(atom.content || '').normalize('NFKC')) || 0), 0);
    expect(spokenMs / 1000).toBeGreaterThan(45);
    expect(spokenMs / 1000).toBeLessThan(65);
    const silent = compileSession(trySampleSession({ sound: false }));
    expect(silent.totalDuration / 1000).toBeGreaterThan(35);
    expect(silent.totalDuration / 1000).toBeLessThan(65);
  });

  it('with sound off has no voice and no bed', () => {
    const session = compileSession(trySampleSession({ sound: false }));
    expect(session.recitation.enabled).toBe(false);
    expect(session.soundscape === 'none' || !session.soundscape).toBe(true);
  });
});

describe('the visitor\'s own text', () => {
  it('reads in the sample\'s look without a voice', () => {
    const session = compileSession(tryTextSession({ text: 'A line of my own.\n\nAnd another.', run: 2 }));
    expect(session.atoms.some(atom => atom.content?.includes('my own'))).toBe(true);
    expect(session.recitation.enabled).toBe(false);
    expect(session.visualConfig).toMatchObject({ visualMode: 'interlocution', interlocution: { procedural: ['ostensoria'] } });
    expect(session.origin).toEqual({ view: 'try', kind: 'text', run: 2 });
  });

  it('refuses empty or oversized text rather than trimming it', () => {
    expect(tryTextProblem('   ')).toMatch(/Add a few words/);
    expect(tryTextProblem('x'.repeat(TRY_TEXT_MAX_CHARS))).toBeNull();
    expect(tryTextProblem('x'.repeat(TRY_TEXT_MAX_CHARS + 1))).toMatch(/5,000/);
    expect(() => tryTextSession({ text: 'x'.repeat(TRY_TEXT_MAX_CHARS + 1) })).toThrow();
  });

  it('compiles at the limit, whatever its shape, well inside the reader\'s own ceilings', () => {
    expect(TRY_TEXT_MAX_CHARS).toBeLessThan(READING_LIMITS.maxTextCharacters);
    // The densest a text can be: one-letter words, one per paragraph.
    const dense = 'a\n\n'.repeat(Math.floor(TRY_TEXT_MAX_CHARS / 3));
    for (const text of [dense, 'word '.repeat(TRY_TEXT_MAX_CHARS / 5)]) {
      const session = compileSession(tryTextSession({ text }));
      expect(session.atoms.length).toBeGreaterThan(0);
      expect(session.atoms.length).toBeLessThan(READING_LIMITS.maxAtoms);
    }
  });
});
