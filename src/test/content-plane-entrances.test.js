/**
 * Every Node entrance to the corpus installs the transport, or is named here.
 *
 * A work is fetched from `/content/...` and verified against the digest that
 * address names. A browser resolves it against its origin; a Node process has
 * none, so `fetch` rejects the URL outright. `installContentPlaneFetch()` is
 * the seam — and five scripts had never called it, which is how a text-quality
 * audit came to print "15 appear clean" after failing to read a single work.
 *
 * THAT IS THE SHAPE WORTH GUARDING. Not the crash — the crash announces
 * itself. The one that reports a clean bill of health on nothing.
 *
 * A static check, so it costs nothing and runs everywhere. It reads imports
 * rather than behaviour, which means a script reaching the corpus through some
 * path this does not name would slip past; the sweep below is asserted to be
 * wide enough that such a script would have to be written deliberately.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

const SCRIPTS = resolve(process.cwd(), 'scripts');
const INSTALLER = 'content-plane-fetch.mjs';

/** Modules that read a work's bytes, rather than its metadata. */
const READERS = [
  'content/archive/index.js',
  'content/keystones.js',
  'core/content-store.js'
];

/**
 * A script that never reaches the corpus at run time.
 *
 * `scriptorium-ci.mjs` spawns `scriptorium.mjs`, which installs it in the
 * child process where the reading actually happens.
 */
const EXEMPT = new Set(['scriptorium-ci.mjs']);

const entrances = readdirSync(SCRIPTS)
  .filter(name => name.endsWith('.mjs'))
  .map(name => ({ name, source: readFileSync(join(SCRIPTS, name), 'utf8') }))
  .filter(({ source }) => READERS.some(reader => source.includes(reader)));

describe('Node entrances to the content plane', () => {
  it('finds the entrances at all', () => {
    // A sweep that matched nothing would pass every assertion below it while
    // checking no script whatsoever.
    expect(entrances.length).toBeGreaterThanOrEqual(5);
    expect(entrances.map(entry => entry.name)).toContain('check-release-readiness.mjs');
  });

  it('installs the transport in every one of them', () => {
    const missing = entrances
      .filter(({ name }) => !EXEMPT.has(name))
      .filter(({ source }) => !source.includes(INSTALLER))
      .map(({ name }) => name);
    expect(missing).toEqual([]);
  });

  it('does the reading in the script, never in one of its imports', () => {
    // A script cannot set anything up ahead of its own imports: ESM evaluates
    // every one of them before the first line of the body. So an import that
    // reads the corpus while it loads runs before the transport exists, and
    // `release-voice-evidence.mjs` did exactly that — a static import of a
    // module whose top-level await compiled every keystone session.
    const lib = readdirSync(join(SCRIPTS, 'lib'))
      .filter(name => name.endsWith('.mjs'))
      .map(name => ({ name, source: readFileSync(join(SCRIPTS, 'lib', name), 'utf8') }));

    for (const { name, source } of lib) {
      const staticVoicePlan = /^import\s+[^;]*from\s+'\.\.\/voice-packs\//mu.test(source);
      expect(staticVoicePlan, `${name} imports a voice pack statically`).toBe(false);
    }
  });
});
