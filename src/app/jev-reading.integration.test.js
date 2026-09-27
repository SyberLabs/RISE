import { expect, it } from 'vitest';
import releaseInventory from '../content/archive/release-inventory.json' with { type: 'json' };
import { resolveJevReading } from './jev-reading.js';
import { compileSession } from '../core/session-compiler.js';

it('opens an existing playable division for every released book and section choice', async () => {
  for (const released of Object.values(releaseInventory)) {
    for (const section of ['first', 'shortest', 'longest']) {
      const input = await resolveJevReading({
        workId: released.workId,
        editionId: released.editionId,
        sourceRevision: released.sourceRevision,
        config: {
          section, wpm: 200, curve: 'flat', chunkMode: 'phrase',
          audio: 'silent', visualMode: 'off', projection: 'stream', revealMode: 'instant'
        }
      });
      const session = compileSession({ ...input, title: input.textSource });
      expect(session.atoms.length, `${released.workId}:${section}`).toBeGreaterThan(0);
      expect(input.text).toBeTruthy();
    }
  }
});
