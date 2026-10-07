/**
 * The drift guard for today's poem recitations: the index may only name pool
 * poems from the served edition, and (when the audio is hydrated) every pack
 * must be the bytes its name says and cover exactly the lines a recited day
 * reads. If the chunker changes, this fails, and the fix is a re-cut from the
 * cached renders (npm run poem:recite -- --render …), which costs nothing.
 */
import { createHash } from 'node:crypto';
import { existsSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import INDEX from './poem-recitation.json' with { type: 'json' };
import { Voice } from './voice.js';
import { recitationPackUrl } from './voice-pack-key.js';
import { resolveJevReading } from '../app/jev-reading.js';
import { splitWords } from '../core/recitation.js';
import { compileSession } from '../core/session-compiler.js';
import { jevReleasedEdition } from '../core/jev-describe.js';
import { todayPool } from '../core/today-poem.js';
import { todayDecision } from '../core/today-reading.js';

const PUBLIC = join(process.cwd(), 'public');
const entries = Object.entries(INDEX.poems);
const hydrated = INDEX.voiceId && existsSync(join(PUBLIC, 'audio', 'recitation', INDEX.voiceId));

describe('today\'s poem recitations', () => {
  it('names only pool poems, from the edition this release serves, by valid pack addresses', () => {
    expect(INDEX.schema).toBe('rise.poem-recitation.v1');
    const pool = new Set(todayPool().map(p => `${p.workId}:${p.entryId}`));
    for (const [key, { sourceRevision, pack }] of entries) {
      expect(pool.has(key), key).toBe(true);
      expect(sourceRevision, key).toBe(jevReleasedEdition(key.split(':')[0]).sourceRevision);
      expect(recitationPackUrl(pack), key).toBe(pack);
      expect(pack.startsWith(`/audio/recitation/${INDEX.voiceId}/`), key).toBe(true);
    }
    if (entries.length) expect(INDEX.provider?.name).toBe('ElevenLabs');
  });

  it.skipIf(!hydrated)('covers every line a recited day reads, with one onset per word (needs npm run audio:hydrate)', async () => {
    const pool = new Map(todayPool().map(p => [`${p.workId}:${p.entryId}`, p]));
    for (const [key, { pack }] of entries) {
      const bytes = readFileSync(join(PUBLIC, pack));
      expect(createHash('sha256').update(bytes).digest('hex').slice(0, 16), key).toBe(pack.split('/').pop().slice(0, 16));
      const manifest = JSON.parse(bytes.toString('utf8'));
      const item = pool.get(key);
      const input = await resolveJevReading(todayDecision({ ...item, seed: 'recitation' }),
        { entryId: item.entryId, label: item.label });
      const atoms = compileSession(input).atoms;
      const voice = new Voice({ voiceId: INDEX.voiceId, manifest });
      expect(voice.coverage(atoms).complete, `${key} lines changed since it was cut`).toBe(true);
      for (const entry of Object.values(manifest.voices[INDEX.voiceId].entries)) {
        expect(entry.onsetsMs, `${key} ${entry.text}`).toHaveLength(splitWords(entry.text).length);
        expect(statSync(join(PUBLIC, entry.asset)).size, entry.asset).toBeGreaterThan(0);
      }
    }
  }, 120_000);
});
