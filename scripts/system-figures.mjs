#!/usr/bin/env node
/**
 * Draws the system kind's reference cases (src/core/figures/fixtures/systems.js) onto a contact sheet.
 *
 *   npm run figures:systems                 writes out/system-figures/index.html and every figure it shows
 *   npm run figures:systems -- --out <dir>  writes them to <dir>
 *   npm run figures:systems -- --goldens    rewrites the goldens in src/core/figures/fixtures instead
 *
 * Needs no model, network or browser to draw; open index.html in a browser to watch the animations.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { SYSTEM_CASES } from '../src/core/figures/fixtures/systems.js';
import { systemSheet } from '../src/core/figures/system-sheet.js';

const args = process.argv.slice(2);
const goldens = args.includes('--goldens');
const at = args.indexOf('--out');
const out = resolve(goldens ? 'src/core/figures/fixtures' : at >= 0 ? args[at + 1] : 'out/system-figures');

mkdirSync(out, { recursive: true });
let written = 0;
for (const [file, content] of systemSheet(SYSTEM_CASES)) {
  if (goldens && !file.endsWith('.svg')) continue;
  writeFileSync(join(out, file), content);
  written += 1;
}
console.log(`Wrote ${written} files to ${out}${goldens ? '' : `; open ${join(out, 'index.html')}`}`);
