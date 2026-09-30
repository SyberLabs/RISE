/**
 * Cloudflare refuses to deploy a static asset over 25 MiB, so the build
 * refuses to emit one.
 */

import { mkdirSync, mkdtempSync, rmSync, truncateSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { MAX_ASSET_BYTES, oversizedFiles } from '../../scripts/asset-size-limit.mjs';

let dir;

afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
    dir = null;
});

describe('static asset size limit', () => {
    it('is Cloudflare\'s 25 MiB', () => {
        expect(MAX_ASSET_BYTES).toBe(26_214_400);
    });

    it('names every file over the limit, however deep', () => {
        dir = mkdtempSync(join(tmpdir(), 'rise-assets-'));
        mkdirSync(join(dir, 'assets'));
        writeFileSync(join(dir, 'index.html'), '<!doctype html>');
        writeFileSync(join(dir, 'assets', 'at-limit.bin'), '');
        truncateSync(join(dir, 'assets', 'at-limit.bin'), MAX_ASSET_BYTES);
        writeFileSync(join(dir, 'assets', 'over.bin'), '');
        truncateSync(join(dir, 'assets', 'over.bin'), MAX_ASSET_BYTES + 1);
        expect(oversizedFiles(dir)).toEqual([join(dir, 'assets', 'over.bin')]);
    });
});
