import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { MODERN_READINGS } from '../src/content/modern-readings.js';

const target = new URL('../src/content/modern-readings-manifest.json', import.meta.url);
const manifest = Object.fromEntries(MODERN_READINGS.map(reading => [reading.id, {
  workId: reading.id,
  title: reading.title,
  author: 'RISE',
  editionId: `rise-original:${reading.id}`,
  sourceRevision: `sha256:${createHash('sha256').update(reading.content, 'utf8').digest('hex')}`,
  fitDescription: reading.description,
  decisionCriterion: reading.criterion
}]));
const output = `${JSON.stringify(manifest, null, 2)}\n`;
if (process.argv.includes('--check')) {
  if ((await readFile(target, 'utf8')).replaceAll('\r\n', '\n') !== output) {
    throw new Error('Modern reading manifest is stale.');
  }
} else {
  await writeFile(target, output, 'utf8');
}
