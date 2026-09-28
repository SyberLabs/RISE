/**
 * Model hosts and WebAssembly compilation are admitted for the on-device Kev
 * worker script only. Every page, the reader included, keeps the site policy.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = join(import.meta.dirname, '..', '..');
const text = readFileSync(join(ROOT, 'public/_headers'), 'utf8');

function rules() {
    const out = new Map();
    let path = null;
    for (const line of text.split('\n')) {
        if (!line.trim() || line.trimStart().startsWith('#')) continue;
        if (!/^\s/u.test(line)) {
            path = line.trim();
            out.set(path, []);
        } else {
            out.get(path).push(line.trim());
        }
    }
    return out;
}

const policyOf = (lines) => lines.find(line => line.startsWith('Content-Security-Policy:')) ?? '';

describe('site headers', () => {
    it('keep model hosts and WebAssembly out of the site policy', () => {
        const site = policyOf(rules().get('/*'));
        expect(site).toContain("script-src 'self';");
        expect(site).not.toContain('wasm-unsafe-eval');
        expect(site).not.toMatch(/huggingface|hf\.co|jsdelivr/u);
    });

    it('admit them for the Kev worker script alone', () => {
        const all = rules();
        const relaxed = [...all].filter(([, lines]) => /wasm-unsafe-eval|huggingface/u.test(policyOf(lines)));
        expect(relaxed.map(([path]) => path)).toEqual(['/assets/kev-worker-*']);
        const [, lines] = relaxed[0];
        expect(lines[0]).toBe('! Content-Security-Policy');
        const policy = policyOf(lines);
        expect(policy).toContain("default-src 'none'");
        expect(policy).toContain("script-src 'self' 'wasm-unsafe-eval'");
        expect(policy).not.toContain("'unsafe-eval'");
        expect(policy).not.toMatch(/script-src[^;]*https:/u);
    });
});
