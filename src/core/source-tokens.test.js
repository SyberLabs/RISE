/**
 * `source-tokens.js` is a leaf. It exists so `source-span.js` can share the
 * chunker's vocabulary without importing the chunker, which closed the cycle
 * source-span → chunker → models → visual-score-lane → source-span. The day it
 * imports anything under `src/core`, the cycle has a way back in.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');
const LEAF = join(HERE, 'source-tokens.js');

describe('source-tokens.js is a leaf', () => {
    it('imports nothing from src/core', () => {
        const source = readFileSync(LEAF, 'utf8');
        // Static `import … from`, `export … from`, bare `import '…'`, and `import('…')`.
        const specifiers = [...source.matchAll(
            /(?:^[ \t]*(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"])|(?:^[ \t]*import\s*['"]([^'"]+)['"])|(?:\bimport\s*\(\s*['"]([^'"]+)['"]\s*\))/gmu
        )].map(match => match[1] ?? match[2] ?? match[3]);
        const inCore = specifiers.filter(spec =>
            spec.startsWith('.') && relative(ROOT, resolve(HERE, spec)).startsWith('src/core'));
        expect(inCore).toEqual([]);
    });
});
