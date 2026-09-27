import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = (name) => readFileSync(
    resolve(import.meta.dirname, `../../.github/workflows/${name}.yml`),
    'utf8'
);

describe('CI and release policy', () => {
    it('keeps one fast required check on pull requests and main', () => {
        const ci = workflow('ci');
        expect(ci).toContain('pull_request:');
        expect(ci).toContain('branches: [main]');
        expect(ci).toContain('name: CI');
        expect(ci).toContain('npm run build');
        expect(ci).toContain('actions/upload-artifact@v4');
        expect(ci).not.toContain('npm run test:e2e');
    });

    it('runs full coverage on main without holding the release workflow', () => {
        const full = workflow('full-validation');
        expect(full).toContain('branches: [main]');
        expect(full).toContain('npm run test:run');
        expect(full).toContain('npm run scriptorium:ci');
        expect(full).toContain('npm run test:e2e -- --shard=${{ matrix.shard }}/4');
        expect(workflow('rise-cloudflare')).toContain('workflows: [CI]');
    });

    it('deploys the exact tested artifact from the triggering CI run', () => {
        const release = workflow('rise-cloudflare');
        expect(release).toContain('run-id: ${{ github.event.workflow_run.id }}');
        expect(release).toContain('github-token: ${{ github.token }}');
        expect(release).toContain('sha256sum -c release.tar.gz.sha256');
        expect(release).not.toContain('\n  build:');
    });
});
