import { describe, expect, it } from 'vitest';
import { STARTER_SEQUENCES } from './starters.js';
import { compileSession } from '../core/session-compiler.js';
import {
  VISUAL_PRESENCE_MIN_MS,
  VISUAL_PRESENCE_MAX_MS
} from '../core/visual-presence.js';

/**
 * Shipped presets — starters and Vault archetypes — are authored values
 * that no migration touches. When the temporal contract was made honest,
 * SAVED user preferences were scaled by 1.4375 to preserve their feel;
 * these hardcoded presets were missed, and every one had been playing
 * ~44% slower than its author intended for months.
 *
 * Nothing in the app can detect that on its own: an unmigrated preset is
 * a perfectly valid config that simply reads wrong. These tests are the
 * standing check that the two stay in step.
 */

// The archetypes live inside Vault.js as a module-private array, so the
// file is read as source. That is deliberate: parsing what actually
// ships beats exporting internals purely to make a test convenient.
async function archetypeSource() {
  const { readFileSync } = await import('node:fs');
  const { resolve } = await import('node:path');
  const source = readFileSync(resolve('src/components/Vault.js'), 'utf8');
  const start = source.indexOf('const ARCHETYPES = [');
  const end = source.indexOf('\n];', start);
  expect(start, 'ARCHETYPES array not found').toBeGreaterThan(-1);
  return source.slice(start, end);
}

describe('Shipped presets honor the temporal contract', () => {
  it('gives every starter a pace inside the app\'s own range', () => {
    // A WPM outside the orbital's clamp would be silently rewritten the
    // moment a reader touched the control.
    //
    // Note what this test CANNOT do: an unmigrated pace is undetectable
    // from the number alone, because 220 is a perfectly plausible thing
    // to author. The real invariant is delivered DURATION, checked
    // below — that is what the migration was protecting.
    for (const seq of STARTER_SEQUENCES) {
      expect(seq.wpm, `${seq.id} has no wpm`).toBeGreaterThan(0);
      expect(seq.wpm, `${seq.id} below the app floor`).toBeGreaterThanOrEqual(100);
      expect(seq.wpm, `${seq.id} exceeds the app ceiling`).toBeLessThanOrEqual(500);
    }
  });

  it('holds the affirmations to the intimate pace they were written for', () => {
    // These are the sequences the migration mattered most for: short,
    // slow, deliberate. Unmigrated they ran 80–112s, which turns a
    // 60-word affirmation into a slog. The durations here are the
    // authored intent, and a future preset change that drifts far from
    // them is a regression rather than a decision.
    const expected = {
      'presence-affirmations': [40, 75],
      'night-work-affirmations': [55, 95],
      'creator-affirmations': [30, 70],
      'threshold-affirmations': [25, 65]
    };
    for (const [id, [min, max]] of Object.entries(expected)) {
      const seq = STARTER_SEQUENCES.find(s => s.id === id);
      expect(seq, `${id} missing from starters`).toBeDefined();
      const session = compileSession({
        wpm: seq.wpm, curve: seq.curve, text: seq.content, title: seq.name
      });
      const seconds = Math.round(session.totalDuration / 1000);
      expect(seconds, `${id} runs ${seconds}s`).toBeGreaterThanOrEqual(min);
      expect(seconds, `${id} runs ${seconds}s`).toBeLessThanOrEqual(max);
    }
  });

  it('gives every archetype a pace inside the app\'s own range', async () => {
    const block = await archetypeSource();
    const wpms = [...block.matchAll(/wpm: (\d+)/g)].map(m => Number(m[1]));
    expect(wpms.length, 'no archetype paces found').toBeGreaterThan(0);
    for (const wpm of wpms) {
      expect(wpm).toBeGreaterThanOrEqual(100);
      expect(wpm).toBeLessThanOrEqual(500);
    }
    // The orbital clamps saved prefs to this range; a preset outside it
    // would be silently rewritten the moment a reader touched it.
  });

  it('never pins an archetype presence to the bare minimum', async () => {
    // 150ms is the FLOOR, not a default — it was the default when these
    // were written, and four archetypes were still sitting on it. A
    // preset should express a choice, not an obsolete constant.
    const block = await archetypeSource();
    const literals = [...block.matchAll(/duration: (\d+)/g)].map(m => Number(m[1]));
    for (const duration of literals) {
      expect(duration, 'presence pinned to the floor').toBeGreaterThan(VISUAL_PRESENCE_MIN_MS);
      expect(duration).toBeLessThanOrEqual(VISUAL_PRESENCE_MAX_MS);
    }
  });

  it('every starter still compiles to a playable session', () => {
    for (const seq of STARTER_SEQUENCES) {
      const session = compileSession({
        wpm: seq.wpm,
        curve: seq.curve,
        chunkMode: seq.chunkMode,
        text: seq.content,
        title: seq.name
      });
      expect(session.atoms.length, seq.id).toBeGreaterThan(10);
      expect(session.totalDuration, seq.id).toBeGreaterThan(5_000);
    }
  });

  it('keeps every starter within a plausible reading length', () => {
    // A sequence that runs several minutes past its neighbours is
    // usually a pacing mistake rather than an authored intent.
    for (const seq of STARTER_SEQUENCES) {
      const session = compileSession({
        wpm: seq.wpm, curve: seq.curve, text: seq.content, title: seq.name
      });
      const seconds = session.totalDuration / 1000;
      expect(seconds, `${seq.id} runs ${Math.round(seconds)}s`).toBeLessThan(240);
    }
  });
});
