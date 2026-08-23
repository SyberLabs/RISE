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
        const auditRuns = ciWorkflow.match(/^\s*run:\s+npm run security:audit.*$/gm)
            ?.map(line => line.trim()) ?? [];
        expect(auditRuns).toEqual(['run: npm run security:audit']);
        expect(ciWorkflow).not.toMatch(/--omit(?:=|\s+)dev\b/);
    });

    it('executes the Kokoro and Sharp compatibility probe in CI', () => {
        expect(packageJson.scripts['security:compat'])
            .toBe('node scripts/verify-security-dependencies.mjs');
        const compatibilityRuns = ciWorkflow
            .match(/^\s*run:\s+npm run security:compat\s*$/gm)
            ?.map(line => line.trim()) ?? [];
        expect(compatibilityRuns).toEqual(['run: npm run security:compat']);
    });
});
