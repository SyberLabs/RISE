import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const ROOT = resolve(import.meta.dirname, '../..');
const packageJson = JSON.parse(readFileSync(resolve(ROOT, 'package.json'), 'utf8'));
const ciWorkflow = readFileSync(resolve(ROOT, '.github/workflows/ci.yml'), 'utf8');

describe('dependency security policy', () => {
    it('defines one full-tree high-severity audit command', () => {
        expect(packageJson.scripts['security:audit'])
            .toBe('npm audit --audit-level=high');
    });

    it('runs that command in CI without excluding development tools', () => {
        expect(ciWorkflow.match(/npm run security:audit/g)).toHaveLength(1);
        expect(ciWorkflow).not.toMatch(/--omit(?:=|\s+)dev\b/);
    });

    it('executes the Kokoro and Sharp compatibility probe in CI', () => {
        expect(packageJson.scripts['security:compat'])
            .toBe('node scripts/verify-security-dependencies.mjs');
        expect(ciWorkflow.match(/npm run security:compat/g)).toHaveLength(1);
    });
});
