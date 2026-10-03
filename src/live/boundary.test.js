/**
 * The live Current is a layer above the sealed one, and it stays a layer.
 *
 * `src/live/` may reach the compiler, the Player and the audio engine, which is
 * how it drives the one runtime. Nothing below it may reach back: the core, the
 * visuals and the rooms do not know a live Current exists, so a Current is the
 * same object whether a person, a file, or a model made it. The first-load
 * bundle never contains it: a host loads it with import().
 */
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { describe, expect, it } from 'vitest';

const SRC = join(import.meta.dirname, '..');
const posix = path => relative(SRC, path).split(sep).join('/');

function files(dir, out = []) {
    for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) files(path, out);
        else if (/\.(js|mjs)$/.test(name) && !/\.test\.(js|mjs)$/.test(name)) out.push(path);
    }
    return out;
}

/** Static imports only: `import ... from 'x'`, `export ... from 'x'`, and bare `import 'x'`. */
function staticImports(source) {
    const found = [];
    for (const match of source.matchAll(/^\s*(?:import|export)\s[^'"`;]*?from\s*['"]([^'"]+)['"]/gmu)) found.push(match[1]);
    for (const match of source.matchAll(/^\s*import\s*['"]([^'"]+)['"]/gmu)) found.push(match[1]);
    return found;
}

const all = files(SRC);

describe('the live layer', () => {
    it('is reached statically from nowhere outside itself', () => {
        const offenders = [];
        for (const file of all) {
            // The conformance harness under src/test exists to test the layer, so it may import it.
            if (posix(file).startsWith('live/') || posix(file).startsWith('test/')) continue;
            for (const target of staticImports(readFileSync(file, 'utf8'))) {
                if (/(^|\/)live\//u.test(target)) offenders.push(`${posix(file)} -> ${target}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('reaches only the core and the audio engine, apart from a host that is named as one', () => {
        const offenders = [];
        for (const file of all) {
            const from = posix(file);
            if (!from.startsWith('live/') || from.startsWith('live/host/')) continue;
            for (const target of staticImports(readFileSync(file, 'utf8'))) {
                if (!target.startsWith('.')) continue;
                const resolved = posix(join(file, '..', target));
                if (resolved.startsWith('live/')) continue;
                if (!/^(core|audio)\//u.test(resolved)) offenders.push(`${from} -> ${target}`);
            }
        }
        expect(offenders).toEqual([]);
    });

    it('keeps every provider out of the page\u2019s own chunk: the host names one statically only for its model\u2019s name', () => {
        // A provider's wire and transport are loaded with import() when that provider is asked for. Anything the
        // host imports statically is in the chunk every /live visit loads, including the default offline one.
        const host = readFileSync(join(SRC, 'live/host/LiveHost.js'), 'utf8');
        expect(staticImports(host).filter(target => /(^|\/)adapters\//u.test(target))).toEqual(['../adapters/gemini-model.js']);
    });

    it('is not imported by the core, whatever it is imported as', () => {
        for (const file of all.filter(item => posix(item).startsWith('core/'))) {
            expect(readFileSync(file, 'utf8'), posix(file)).not.toMatch(/from\s*['"][^'"]*\/live\//u);
        }
    });
});
