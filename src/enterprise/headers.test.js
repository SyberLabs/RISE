/**
 * Model hosts and WebAssembly compilation are admitted for the on-device Kev
 * worker script only, and only by the Cloudflare Worker that serves it. The
 * static header file, which every host reads, grants them to nothing.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const text = readFileSync(join(ROOT, 'public/_headers'), 'utf8');

describe('static site headers', () => {
    it('grant model hosts and WebAssembly to no path', () => {
        expect(text).not.toMatch(/wasm-unsafe-eval|huggingface|hf\.co|jsdelivr/u);
        // blob: is the page's own scene modules (src/core/csp.test.js says why); nothing remote, no eval.
        expect(text).toContain("script-src 'self' blob:;");
    });

    it('use only syntax every static host accepts', () => {
        expect(text.split('\n').filter(line => line.trim().startsWith('!'))).toEqual([]);
    });
});
