// @vitest-environment node
/**
 * The strings the scrub tests use are built when the test runs.
 * A scan of source must not find one contiguous literal of that shape.
 */
import { createHash } from 'node:crypto';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { fakeGoogleApiKey } from './fake-google-key.js';

const ROOT = fileURLToPath(new URL('../..', import.meta.url));
const sha = text => createHash('sha256').update(text).digest('hex');
const KEY_LITERAL = new RegExp(['AI', 'za', 'Sy', '[0-9A-Za-z_-]{20,}'].join(''));
const ROOTS = ['e2e', 'src', 'worker', 'scripts', 'tools', 'docs', '.github'];

const TEXT = /\.(js|mjs|md|yml|yaml|html|json)$/u;

/** Source a fixture could be committed in. Book corpora under a `content` directory are omitted. */
function sourceFiles(dir, out = []) {
    let entries;
    try { entries = readdirSync(dir); } catch { return out; }
    for (const entry of entries) {
        if (entry === 'node_modules' || entry === 'dist' || entry === 'content' || entry === '.git') continue;
        const full = join(dir, entry);
        let info;
        try { info = statSync(full); } catch { continue; }
        if (info.isDirectory()) sourceFiles(full, out);
        else if (TEXT.test(entry)) out.push(full);
    }
    return out;
}

function filesIn(dir) {
    return readdirSync(dir).flatMap(entry => {
        const full = join(dir, entry);
        return statSync(full).isFile() && TEXT.test(entry) ? [full] : [];
    });
}

describe('fakeGoogleApiKey', () => {
    it('builds the same Google-shaped fakes the scrub tests already use', () => {
        const ordinary = fakeGoogleApiKey();
        const host = fakeGoogleApiKey(`D-test-key-${'0'.repeat(22)}`);
        const other = fakeGoogleApiKey('OTHERKEYOTHERKEYOTHERKEYOTHERKEY1');
        expect(ordinary).toMatch(/^AIza[0-9A-Za-z_-]{20,}$/u);
        expect(host).toMatch(/^AIza[0-9A-Za-z_-]{35}$/u);
        expect(other).toMatch(/^AIza[0-9A-Za-z_-]{35}$/u);
        expect(sha(ordinary)).toBe('84fb43b211597a2657c6545958c617bcef746dd79a851b78d31f94ceebfb9505');
        expect(sha(host)).toBe('7adadcc8fc506fa5803dcccb178c8cc09626a39da26f6c5a7fc4899a4669125e');
        expect(sha(other)).toBe('8c473172477a8dda322793d209de71eda99ee4d1f1214d406f4b6a396e8adbbf');
    });

    it('leaves no contiguous Google-shaped literal in committed source', () => {
        const files = [...filesIn(ROOT), ...ROOTS.flatMap(root => sourceFiles(join(ROOT, root)))];
        expect(files.some(file => file.endsWith(`${join('src', 'test', 'fake-google-key.js')}`))).toBe(true);
        expect(files.some(file => file.endsWith(`${join('src', 'live', 'adapters', 'gemini-fetch.test.js')}`))).toBe(true);
        const hits = files.filter(file => KEY_LITERAL.test(readFileSync(file, 'utf8')));
        expect(hits.map(file => file.slice(ROOT.length + 1))).toEqual([]);
    });
});
