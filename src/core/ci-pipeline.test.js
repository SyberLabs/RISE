import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const workflow = readFileSync(
    resolve(import.meta.dirname, '../../.github/workflows/ci.yml'),
    'utf8'
);

function job(name) {
    const start = workflow.indexOf(`\n  ${name}:`);
    expect(start, `${name} job missing`).toBeGreaterThan(-1);
    const rest = workflow.slice(start + 1);
    const next = rest.search(/\r?\n  [a-z][\w-]*:/);
    return rest.slice(0, next === -1 ? undefined : next);
}

describe('the browser matrix runs after merge', () => {
    it('skips browser shards on pull requests and prose changes', () => {
        const header = job('e2e-full').split(/\r?\n    steps:/)[0];
        expect(header).toContain("if: needs.changes.outputs.code == 'true' && github.event_name != 'pull_request'");
    });

    it('names each shard and runs Playwright', () => {
        const e2eFull = job('e2e-full');
        expect(e2eFull).toContain('name: Browser matrix ${{ matrix.shard }}/4');
        expect(e2eFull).toContain('run: npm run test:e2e -- --shard=${{ matrix.shard }}/4');
    });
});
