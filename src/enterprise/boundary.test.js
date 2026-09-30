/**
 * EnterpRise is a sibling of the reader. The import graph has to stay that
 * way: the rail must not pull Chamber into a briefing, and the reader must
 * not pull the briefing into first load.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const ENTERPRISE = join(ROOT, 'src/enterprise');

function javascriptFiles(dir, out = []) {
    for (const entry of readdirSync(dir)) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) javascriptFiles(full, out);
        else if (entry.endsWith('.js') && !entry.endsWith('.test.js')) out.push(full);
    }
    return out;
}

// The on-device models run in their own workers; these are the only packages
// any enterprise module may import, and only there.
const PACKAGE_IMPORTS = new Map([
    [join(ENTERPRISE, 'kev-worker.js'), new Set([
        'onnxruntime-web/jspi',
        'onnxruntime-web/ort-wasm-simd-threaded.jspi.wasm?url',
        '@ai-ecoverse/kev.js',
        '@huggingface/tokenizers'
    ])],
    [join(ENTERPRISE, 'embed-worker.js'), new Set(['onnxruntime-web/wasm', '@huggingface/tokenizers'])]
]);

describe('enterprise stays beside the reader', () => {
    it('imports only its own modules', () => {
        const files = javascriptFiles(ENTERPRISE);
        expect(files.length).toBeGreaterThan(5);
        const outward = [];
        for (const file of files) {
            const source = readFileSync(file, 'utf8');
            const specs = [...source.matchAll(/from\s+['"]([^'"]+)['"]/g)].map(match => match[1]);
            for (const spec of specs) {
                if (!spec.startsWith('./') && !PACKAGE_IMPORTS.get(file)?.has(spec)) outward.push(`${file} → ${spec}`);
            }
        }
        expect(outward).toEqual([]);
    });

    it('is not imported by the reader', () => {
        const offenders = [];
        const walk = (dir) => {
            for (const entry of readdirSync(dir)) {
                const full = join(dir, entry);
                if (entry === 'enterprise' && dir.endsWith(`${join('src')}`)) continue;
                if (statSync(full).isDirectory()) {
                    if (entry === 'node_modules') continue;
                    walk(full);
                    continue;
                }
                if (!entry.endsWith('.js') && !entry.endsWith('.mjs')) continue;
                const source = readFileSync(full, 'utf8');
                if (/enterprise\//u.test(source)) offenders.push(full);
            }
        };
        walk(join(ROOT, 'src'));
        walk(join(ROOT, 'worker'));
        expect(offenders).toEqual([]);
    });
});
