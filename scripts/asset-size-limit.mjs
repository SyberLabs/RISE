/**
 * Cloudflare refuses to deploy a static asset over 25 MiB. `vite.config.js`
 * fails the build that would produce one, so the pull request finds out
 * instead of the deploy.
 */

import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

export const MAX_ASSET_BYTES = 25 * 1024 ** 2;

export function oversizedFiles(dir) {
  return readdirSync(dir, { recursive: true, withFileTypes: true })
    .filter(entry => entry.isFile())
    .map(entry => join(entry.parentPath, entry.name))
    .filter(path => statSync(path).size > MAX_ASSET_BYTES);
}
