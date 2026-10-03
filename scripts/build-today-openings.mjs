/**
 * The first line, title and poet of every division in today's poem's works,
 * so Home can show today's poem without downloading a whole work.
 *
 *   node scripts/build-today-openings.mjs
 *
 * Divisions come from the same `divideSections` call the reader makes, so an
 * opening's index is the division id the Today view opens. Re-run after any
 * ingest; src/core/today-openings.test.js asserts the file still agrees.
 */
import { writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { divideSections } from '../src/content/archive/divisions.js';
import { releaseArchiveMetadata } from '../src/content/archive/index.js';
import { TODAY_WORKS } from '../src/core/today-poem.js';

const OUT = new URL('../src/content/archive/today-openings.json', import.meta.url);

export async function buildTodayOpenings() {
  const meta = releaseArchiveMetadata();
  const works = {};
  const openings = {};
  for (const workId of TODAY_WORKS) {
    const { title, author } = meta.find(item => item.id === workId);
    const module = await import(`../src/content/archive/works/${workId}.js`);
    const sections = Object.values(module).find(Array.isArray);
    works[workId] = { title, author };
    openings[workId] = divideSections(sections, { declared: true }).entries
      .map(entry => entry.content.split('\n').find(line => line.trim())?.trim() ?? '');
  }
  return { works, openings };
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const data = await buildTodayOpenings();
  writeFileSync(OUT, `${JSON.stringify(data, null, 2)}\n`);
  const count = Object.values(data.openings).reduce((sum, lines) => sum + lines.length, 0);
  console.log(`✓ ${OUT.pathname.split('/').slice(-4).join('/')}: ${count} openings`);
}
