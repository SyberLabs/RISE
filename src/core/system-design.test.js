/**
 * THE SYSTEM DESIGN DOCUMENT IS A CLAIM ABOUT THIS TREE, SO IT CAN BE WRONG.
 *
 * `docs/specs/ARCHITECTURE.md` had to be rewritten once because it described
 * rooms that no longer existed — a document nobody could trust, which is worse
 * than no document, because a reader spends the trust before discovering the
 * drift. Prose cannot be type-checked, but three things in that file are
 * ordinary facts about the repository and go stale silently:
 *
 *   a path it names          — deleted in some other change
 *   the set of rooms         — one added, or one removed
 *   the dependency count     — the sentence that makes a point of being small
 *
 * So those are checked here. What is NOT checked is whether the reasoning is
 * still true; that is why section 8 records reasons rather than conclusions. A
 * reason that has stopped applying is visible to a reader. A conclusion is not.
 *
 * The room check runs in BOTH directions on purpose. A room deleted and left
 * in the document, and a room added and never written down, are the same defect
 * seen from two sides, and each is silent on its own.
 */
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const DOC = 'docs/specs/ARCHITECTURE.md';
const text = readFileSync(join(ROOT, DOC), 'utf8');

/** Backticked spans only. Prose mentions a room by name; a path is quoted. */
const quoted = [...text.matchAll(/`([^`\n]+)`/gu)].map(match => match[1]);

/**
 * A quoted span that names a file or directory this repository should have.
 * Prose sometimes quotes a shape rather than a path — "a `src/…` path" — so an
 * ellipsis disqualifies a span, as do the characters that mean a span is a
 * command or a glob rather than a name.
 */
const looksLikeRepoPath = (span) =>
    /^(?:src|scripts|docs|e2e|public)\//u.test(span)
    && !/[ ()<>*…]/u.test(span);

describe('the system design document describes this tree', () => {
    it('names only paths that exist', () => {
        const named = [...new Set(quoted.filter(looksLikeRepoPath))];

        // A sweep that found nothing would pass forever. The document is full
        // of paths; if this count collapses, the extraction broke, not the doc.
        expect(named.length, 'no paths were extracted, so this proved nothing')
            .toBeGreaterThan(15);

        const missing = named.filter(path => !existsSync(join(ROOT, path)));
        expect(missing, `${DOC} names paths that are not in the tree`).toEqual([]);
    });

    /**
     * Rooms are the modules a reader can be inside. The helpers that only ever
     * appear within one — a modal, a picker, a panel — are deliberately not
     * required to be named, because the document describes the shape of the
     * system rather than every file in it.
     */
    const NOT_A_ROOM = new Set([
        'Admit.js',              // edition admission dialog, opened from Library
        'NamingModal.js',        // shared naming prompt
        'SourceBrowser.js',      // source picker, embedded in Workshop
        'VisualNavigator.js'     // visual and text controls, embedded in ChamberOrbital
    ]);

    const roomsOnDisk = () => readdirSync(join(ROOT, 'src/components'))
        .filter(entry => entry.endsWith('.js') && !entry.endsWith('.test.js'))
        .filter(entry => !NOT_A_ROOM.has(entry))
        .map(entry => basename(entry, '.js'))
        .sort();

    /**
     * The register in section 5, read the way a person reads it: the component
     * module paths it quotes. Parsing the register rather than the diagram is
     * deliberate — ASCII art is for a reader, and a test that depends on its
     * box drawing breaks when someone improves the picture.
     */
    const roomsInDocument = () => [...new Set(
        quoted
            .filter(span => /^src\/components\/[A-Za-z]+\.js$/u.test(span))
            .map(span => basename(span, '.js'))
            .filter(name => !NOT_A_ROOM.has(`${name}.js`))
    )].sort();

    it('names every room that exists', () => {
        const onDisk = roomsOnDisk();
        expect(onDisk.length, 'no rooms found on disk, so this proved nothing')
            .toBeGreaterThan(5);

        const documented = new Set(roomsInDocument());
        const unmentioned = onDisk.filter(room => !documented.has(room));
        expect(unmentioned, `${DOC} section 5 has no line for these rooms`).toEqual([]);
    });

    it('names no room that has been deleted', () => {
        const documented = roomsInDocument();
        expect(documented.length, 'no rooms were read out of the register')
            .toBeGreaterThan(5);

        const onDisk = new Set(roomsOnDisk());
        const gone = documented.filter(room => !onDisk.has(room));
        expect(gone, `${DOC} lists rooms that are no longer in src/components`)
            .toEqual([]);
    });

    /**
     * The document claims core and visuals never import a component, and said
     * so under the words "enforced by inspection" — which is not enforcement.
     * The claim happened to be true; nothing kept it true. A guard nobody can
     * break is decoration, so here is one that can.
     */
    it('is right that core and visuals never import a component', () => {
        const offenders = [];
        const walk = (dir) => {
            for (const entry of readdirSync(join(ROOT, dir), { withFileTypes: true })) {
                const rel = `${dir}/${entry.name}`;
                if (entry.isDirectory()) { walk(rel); continue; }
                if (!entry.name.endsWith('.js') || entry.name.endsWith('.test.js')) continue;
                const source = readFileSync(join(ROOT, rel), 'utf8');
                // Static and dynamic alike: a lazy import is still a dependency.
                if (/from\s+['"][^'"]*\/components\/|import\(\s*['"][^'"]*\/components\//u.test(source)) {
                    offenders.push(rel);
                }
            }
        };
        walk('src/core');
        walk('src/visuals');
        expect(offenders, `${DOC} §5 says this layer holds; it does not`).toEqual([]);
    });

    it('states the production dependency count that package.json has', () => {
        const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'));
        const production = Object.keys(pkg.dependencies || {});

        // 8.10 makes a point of the number. If a dependency is added, the
        // sentence that argues from its smallness has to be re-argued.
        expect(production.length,
            'production dependencies changed — ARCHITECTURE.md 8.10 argues from this number')
            .toBe(1);
        expect(text, `${DOC} 8.10 should say "one production dependency"`)
            .toMatch(/one production dependency/u);
    });
});

describe('every decision records what it rejected and why', () => {
    const STATUSES = new Set(['settled', 'open', 'deferred', 'reversed']);

    /** Section 8 entries: "### 8.n Title" up to the next heading. */
    const decisions = () => {
        const section = text.slice(
            text.indexOf('## 8. Decisions'),
            text.indexOf('## 9. What this design costs')
        );
        const parts = section.split(/^### /mu).slice(1);
        return parts.map(part => ({
            title: part.slice(0, part.indexOf('\n')).trim(),
            body: part
        }));
    };

    it('has decisions to check', () => {
        expect(decisions().length, 'section 8 has no entries').toBeGreaterThan(10);
    });

    it('states Chosen, Rejected, Why and Status for each', () => {
        const incomplete = [];
        for (const { title, body } of decisions()) {
            for (const field of ['Chosen:', 'Rejected:', 'Why:', 'Status:']) {
                // Rejected is written "Rejected:" or "Rejected so far:" or
                // "Rejected(s):" — match the word, not the exact punctuation.
                const word = field.replace(':', '');
                if (!new RegExp(`\\*\\*${word}[^*]*\\*\\*`, 'u').test(body)) {
                    incomplete.push(`${title} — missing ${word}`);
                }
            }
        }
        expect(incomplete, 'a decision without its alternative is a conclusion, not a decision')
            .toEqual([]);
    });

    it('uses only the statuses the document defines', () => {
        const wrong = [];
        for (const { title, body } of decisions()) {
            const stated = [...body.matchAll(/\*\*Status:\*\*\s*\**([a-z]+)/gu)].map(m => m[1]);
            if (stated.length === 0) { wrong.push(`${title} — no status read`); continue; }
            for (const status of stated) {
                if (!STATUSES.has(status)) wrong.push(`${title} — "${status}" is not a status`);
            }
        }
        expect(wrong, `statuses must be one of ${[...STATUSES].join(', ')}`).toEqual([]);
    });
});
