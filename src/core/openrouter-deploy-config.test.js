import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const guard = resolve(root, 'scripts/check-openrouter-config.mjs');

function runGuard(apiKey) {
    const env = { ...process.env };
    if (apiKey === undefined) delete env.OPENROUTER_API_KEY;
    else env.OPENROUTER_API_KEY = apiKey;
    return spawnSync(process.execPath, [guard], { cwd: root, env, encoding: 'utf8' });
}

describe('OpenRouter production deployment guard', () => {
    it.each([['missing', undefined], ['blank', '   ']])('blocks production when the key is %s', (_label, key) => {
        const result = runGuard(key);

        expect(result.status).toBe(1);
        expect(result.stderr).toContain('OPENROUTER_API_KEY');
        expect(result.stderr).toContain('Netlify');
        expect(result.stderr).toContain('Builds');
        expect(result.stderr).toContain('Functions');
        expect(result.stderr).not.toContain('server-secret');
    });

    it('allows a configured key without echoing it', () => {
        const result = runGuard('server-secret');

        expect(result.status).toBe(0);
        expect(result.stdout).not.toContain('server-secret');
        expect(result.stderr).not.toContain('server-secret');
    });

    it('guards production only and leaves the default preview build command unchanged', () => {
        const config = readFileSync(resolve(root, 'netlify.toml'), 'utf8');
        expect(config).toMatch(/\[build\][\s\S]*?command\s*=\s*"npm run build"/);
        expect(config).toMatch(/\[context\.production\][\s\S]*?command\s*=\s*"node scripts\/check-openrouter-config\.mjs && npm run build"/);
    });
});
