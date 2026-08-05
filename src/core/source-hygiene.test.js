/**
 * A guard against defects that are invisible in every tool used to look
 * for them.
 *
 * THIS COST TWO SESSIONS. A word-boundary in the paginator's chapter
 * regex was written to disk as a literal BACKSPACE (U+0008) rather than
 * the two characters backslash-b, so `/^(chapter|...)<BS>/` quietly
 * demanded a control character after the word and never matched. The
 * function was instrumented, its inputs confirmed correct, and it still
 * returned false — because the byte does not render in an editor, in a
 * diff, or in a file dump. Reasoning could not reach it; only char codes
 * could.
 *
 * The lesson generalises past that one byte: a control character in
 * source is never intentional here, and a class of bug nobody can SEE is
 * worth one cheap sweep on every run.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, relative } from 'node:path';

// The runner's working directory is the project root; `import.meta.url`
// is not a file URL under Vite's transform.
const ROOT = process.cwd();
const SKIP_DIRS = new Set(['node_modules', '.git', 'dist', 'coverage', 'test-results', 'playwright-report']);
const SOURCE = /\.(js|mjs|cjs|jsx|ts|css|html)$/;

/** Tab, newline and carriage return are the only control characters a
 *  source file has any business containing. */
const ALLOWED = new Set([9, 10, 13]);

function sourceFiles(dir, out = []) {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.') || SKIP_DIRS.has(entry.name)) continue;
        const path = join(dir, entry.name);
        if (entry.isDirectory()) sourceFiles(path, out);
        else if (SOURCE.test(entry.name)) out.push(path);
    }
    return out;
}

describe('source hygiene', () => {
    it('sources are free of control characters', () => {
        const offences = [];
        for (const path of sourceFiles(ROOT)) {
            const text = readFileSync(path, 'utf8');
            for (let i = 0; i < text.length; i++) {
                const code = text.charCodeAt(i);
                if (code >= 32 || ALLOWED.has(code)) continue;
                // Report where a human can find it: the line, and the
                // codepoint, since the character itself will not print.
                const line = text.slice(0, i).split('\n').length;
                offences.push(
                    `${relative(ROOT, path)}:${line} — U+${code.toString(16).padStart(4, '0').toUpperCase()}`
                );
            }
        }
        expect(offences, offences.join('\n')).toEqual([]);
    });

    it('finds a control character when one is present', () => {
        // The guard above is only worth having if it can fail. Proven
        // against the exact byte that caused the paginator fault rather
        // than trusted.
        const poisoned = `const re = /^(chapter)${String.fromCharCode(8)}/i;`;
        const found = [...poisoned].some(ch => {
            const code = ch.charCodeAt(0);
            return code < 32 && !ALLOWED.has(code);
        });
        expect(found).toBe(true);
    });
});
