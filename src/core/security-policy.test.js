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
        expect(ciWorkflow).toContain('run: npm run security:audit');
        expect(ciWorkflow).not.toContain('npm audit --omit=dev');
    });
});
