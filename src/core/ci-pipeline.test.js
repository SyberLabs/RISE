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

describe('the browser matrix reports its four names even when it does not run Playwright', () => {
    it('does not skip the job when the change is prose', () => {
        // A skipped matrix job reports the unexpanded name
        // "Browser matrix ${{ matrix.shard }}/4". A ruleset that requires
        // "Browser matrix 1/4" then waits forever, which is how a
        // one-line diagram pull request becomes unmergeable.
        const header = job('e2e-full').split(/\r?\n    steps:/)[0];
        expect(header).not.toMatch(/outputs\.code/);
    });

    it('names each shard, and only plays Playwright when code moved', () => {
        const e2eFull = job('e2e-full');
        expect(e2eFull).toContain('name: Browser matrix ${{ matrix.shard }}/4');
        expect(e2eFull).toContain('npm run test:e2e -- --shard=${{ matrix.shard }}/4');
        expect(e2eFull).toMatch(/if:\s*needs\.changes\.outputs\.code != 'false'/);
    });
});
