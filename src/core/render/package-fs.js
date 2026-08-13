/**
 * Filesystem materialization of a render package. Node-only.
 */

import { mkdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const TEXT_FILES = ['captions.vtt', 'captions.srt', 'captions.json', 'credits.txt'];
const JSON_FILES = ['rights-report.json', 'render-manifest.json', 'diagnostics.json'];
const BINARY_FILES = ['poster.bmp', 'thumbnail.bmp'];

export function writeRenderPackageDir(dir, pack) {
  mkdirSync(dir, { recursive: true });
  for (const name of TEXT_FILES) {
    if (pack[name] != null) writeFileSync(join(dir, name), pack[name], 'utf8');
  }
  for (const name of JSON_FILES) {
    if (pack[name] != null) {
      writeFileSync(join(dir, name), `${JSON.stringify(pack[name], null, 2)}\n`, 'utf8');
    }
  }
  for (const name of BINARY_FILES) {
    if (pack[name] != null) writeFileSync(join(dir, name), Buffer.from(pack[name]));
  }
}

export function readRenderPackageDir(dir) {
  const pack = {};
  for (const name of TEXT_FILES) {
    const path = join(dir, name);
    if (existsSync(path)) pack[name] = readFileSync(path, 'utf8');
  }
  for (const name of JSON_FILES) {
    const path = join(dir, name);
    if (existsSync(path)) pack[name] = JSON.parse(readFileSync(path, 'utf8'));
  }
  for (const name of BINARY_FILES) {
    const path = join(dir, name);
    if (existsSync(path)) pack[name] = new Uint8Array(readFileSync(path));
  }
  return pack;
}
