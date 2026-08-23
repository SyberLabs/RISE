/**
 * A citation is a claim, and a claim nobody can check is a label offered as
 * evidence — the failure this codebase names more often than any other.
 *
 * Five modules cite the Scriptorium spec by section: Scriptorium.js,
 * Workshop.js, curator-context.js, curator-prompt.js, scriptorium-resolve.js.
 * They gave no path, and the file they meant is not where a reader looks:
 * `docs/specs/SCRIPTORIUM-SPEC.md` has never existed, and
 * `git log --all` on it returns nothing. The document is in `docs/vision/`,
 * and every §N those comments name is a real heading in it — which nobody
 * could have known without opening both.
 *
 * So the path is written out, and this reads the citations back out of the
 * source and looks each section up. A comment that cites §12b fails here.
 */
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { EXTENT_OVERSHOOT_LIMIT } from './library-extent.js';
import { MAX_SAFE_TARGET_WORDS } from './reading-limits.js';

const ROOT = process.cwd();
const SPEC = 'docs/vision/SCRIPTORIUM-SPEC.md';

const CITING_FILES = Object.freeze([
    'src/components/Scriptorium.js',
    'src/components/Workshop.js',
    'src/core/curator-context.js',
    'src/core/curator-prompt.js',
    'src/core/scriptorium-resolve.js',
    // The headless sequence and the second entrance onto it. Both cite the
    // spec, so both are held to citing a section that exists — §13 was written
    // in the same pass, because the exit-status mapping a red team scripts
    // against cannot live only in a comment.
    'src/core/scriptorium-session.js',
    'src/core/scriptorium-cli.js',
    // A reader's own text became a source the room composes from, so the
    // record that makes it one is held to citing the section that states
    // the law it obeys — §7a, written in the same pass for the same reason
    // §10c was: the rule was obeyed in five files and stated in none.
    'src/core/local-works.js'
]);

const read = (path) => readFileSync(join(ROOT, path), 'utf8');

/**
 * Files citing the strengthening brief — FOUND, not listed.
 *
 * The list above is written by hand and has to be remembered; this one cannot
 * be forgotten, because a file added tomorrow that names the brief is swept up
 * by having named it. The list above stays hand-written only because it is the
 * older arrangement and rewriting it is not this pass's work.
 */
const CITING_BRIEF = readdirSync(join(ROOT, 'src'), { recursive: true })
    .map(entry => join('src', String(entry)))
    .filter(path => path.endsWith('.js'))
    // The sweep cannot be its own subject: naming the string it searches for
    // makes this file match it, and the match is the search, not a citation.
    .filter(path => !path.endsWith('scriptorium-spec.test.js'))
    .filter(path => read(path).includes('SCRIPTORIUM-STRENGTHENING-SPEC'))
    .sort();

/** `## 10. Blocked on` and `### 10c. Part of a work` alike. */
function headings(markdown) {
    const found = new Set();
    for (const match of markdown.matchAll(/^#{2,4}\s+(\d+[a-z]?)\.\s/gmu)) {
        found.add(match[1]);
    }
    return found;
}

/** Every `SCRIPTORIUM-SPEC.md §N` in a file, with the path it was given. */
function citations(source) {
    return [...source.matchAll(/(\S*SCRIPTORIUM-SPEC(?:\.md)?)\s*(?:§(\d+[a-z]?))?/gu)]
        .map(match => ({ path: match[1], section: match[2] || null }));
}

describe('every spec citation in the room resolves', () => {
    const spec = read(SPEC);
    const sections = headings(spec);

    it('finds the document the comments name', () => {
        expect(spec.length).toBeGreaterThan(1_000);
        expect(sections.size).toBeGreaterThan(8);
    });

    for (const file of CITING_FILES) {
        it(`${file} cites sections that exist, by a path that exists`, () => {
            const cited = citations(read(file));
            expect(cited.length, `${file} no longer cites the spec`).toBeGreaterThan(0);
            for (const { path, section } of cited) {
                expect(path, `${file} cites the spec without a path`).toContain(SPEC);
                if (section === null) continue;
                expect(sections.has(section),
                    `${file} cites §${section}, which is not a heading in ${SPEC}`).toBe(true);
            }
        });
    }

    it('states the laws this room is now built on', () => {
        // The sections the code points at have to say something, not merely
        // exist: §10c was written in this pass because the extent grammar was
        // being cited in five places and stated in none.
        for (const section of ['1', '5', '7', '9', '10b', '10c']) {
            expect(sections.has(section), `§${section}`).toBe(true);
        }
        expect(spec).toMatch(/extentReadingBound/u);
        expect(spec).toMatch(/division-index\.json/u);
    });

    /**
     * A NEGATION IS WORTH ITS REACH, and this one had none.
     *
     * The rule is that `division-words.json` may be remembered but never
     * described as a thing this build still writes — it was folded back into
     * the one index precisely because two artifacts of one pass can disagree.
     *
     * What stood here was `not.toMatch(/division-words\.json[^`]*is written/u)`.
     * The filename appears inside a code span, so the character immediately
     * after it is a backtick, and a negated class that excludes backticks
     * cannot get past it. The pattern could not have matched any wording the
     * spec might carry — it passed on an empty document and on a document that
     * said the file is written twice.
     */
    const STALE_ARTIFACT_CLAIM =
        /division-words\.json`?[^.]{0,160}?\b(?:is|are)\s+(?:written|generated|produced)\b/u;

    it('does not claim the sibling word file is still written', () => {
        // The failing input, constructed: if the spec ever says this, the
        // pattern has to see it.
        expect('`division-words.json` is written by a second script')
            .toMatch(STALE_ARTIFACT_CLAIM);
        expect('The per-division counts in `division-words.json` are generated separately.')
            .toMatch(STALE_ARTIFACT_CLAIM);
        // And the past tense the spec actually uses is not a claim.
        expect('lived briefly in a sibling `division-words.json`, written by a second script.')
            .not.toMatch(STALE_ARTIFACT_CLAIM);

        expect(spec).not.toMatch(STALE_ARTIFACT_CLAIM);
    });
});

/**
 * A NUMBER STATED IN PROSE IS A LABEL, NOT EVIDENCE.
 *
 * Everything above checks that the sections the code cites exist. None of it
 * could see that §10c said `MAX_SAFE_TARGET_WORDS` is 114,285 while the code
 * computed 104,529 — the figure was kept from the old 1.05 atoms-per-word ratio
 * and never re-read. That is the one number the slider and the gate both stand
 * on, in the document a red team is told to script against.
 *
 * So each figure is READ BACK OUT OF THE SENTENCE THAT STATES IT and compared
 * to the thing it describes. The direction matters: the test does not restate
 * the number, it parses the spec. A spec edited to a wrong figure fails, and a
 * constant changed without the spec fails too — which is the only arrangement
 * in which a disagreement can be discovered.
 */
describe('the numbers the spec states are the numbers the code computes', () => {
    const spec = read(SPEC);
    /** Markdown wraps, so a claim can be split across a line break. */
    const flat = spec.replace(/\s+/gu, ' ');

    /** One capture group, and it must be the only match in the document. */
    function theOnlyFigure(pattern, what) {
        const found = [...flat.matchAll(pattern)].map(match => match[1]);
        expect(found.length,
            `${what}: expected exactly one statement of it in ${SPEC}, found ${found.length}. `
            + 'A figure stated twice is a figure that can disagree with itself.').toBe(1);
        return found[0];
    }

    it('states MAX_SAFE_TARGET_WORDS as the code computes it', () => {
        const stated = theOnlyFigure(
            /`MAX_SAFE_TARGET_WORDS` \(reading-limits\.js\) is \*\*([\d,]+)\*\*/gu,
            'MAX_SAFE_TARGET_WORDS'
        );
        expect(
            Number(stated.replaceAll(',', '')),
            `§10c states ${stated}; reading-limits.js computes `
            + `${MAX_SAFE_TARGET_WORDS.toLocaleString()}. The slider's travel and the gate's `
            + 'atom-ceiling refusal are both this constant, so the document is wrong, not it.'
        ).toBe(MAX_SAFE_TARGET_WORDS);
        // And the stale value is gone rather than merely unstated.
        expect(spec).not.toMatch(/114,285/u);
    });

    it('states the overshoot multiple as library-extent.js exports it', () => {
        const stated = theOnlyFigure(
            /`EXTENT_OVERSHOOT_LIMIT` is \*\*([\d.]+)\*\*/gu,
            'EXTENT_OVERSHOOT_LIMIT'
        );
        expect(Number(stated)).toBe(EXTENT_OVERSHOOT_LIMIT);
        // The fold-in that exported the constant left a literal here, in the
        // document the export existed to keep honest. `1.6 ×` is the shape it
        // took; the arithmetic worked example (320 words) is allowed to stay,
        // because it is a consequence rather than a second copy of the rule.
        expect(spec).not.toMatch(/1\.6\s*×\s*(?:the ask|what)/u);
    });

    /**
     * TWO MEASUREMENTS OF ONE FILE, because that is what the disagreement was.
     *
     * §7 said 40 and 54 KiB, the builder's comments said 49 and 50, and the
     * sizes a reader pays are neither: the committed artifact is pretty-printed
     * and a bundler embeds the parsed JSON. Rounded DOWN to the KiB, so the
     * stated figure is never larger than the file — the direction a size claim
     * can be wrong in and still sound reassuring.
     */
    const INDEX_SIZES = Object.freeze([
        { what: 'served', file: 'src/content/archive/division-index.json' },
        { what: 'withheld', file: 'src/content/archive/division-index.withheld.json' }
    ]);

    /** Canonical LF bytes as committed, and as a bundler embeds it. Rounded down. */
    const measureIndex = (file) => ({
        onDisk: Math.floor(Buffer.byteLength(read(file).replaceAll('\r\n', '\n')) / 1024),
        embedded: Math.floor(Buffer.byteLength(JSON.stringify(JSON.parse(read(file)))) / 1024)
    });

    for (const { what, file } of INDEX_SIZES) {
        it(`states the ${what} division index at the size it is`, () => {
            const measured = measureIndex(file);
            const bullet = flat.slice(flat.indexOf(file), flat.indexOf(file) + 200);
            expect(bullet, `${SPEC} §7 no longer names ${file}`).toContain(file);
            const stated = [...bullet.matchAll(
                /\*\*(\d+) KiB on disk, (\d+) KiB embedded\.\*\*/gu)];
            expect(stated.length, `§7 does not state both sizes for ${file}`).toBe(1);
            expect(
                { onDisk: Number(stated[0][1]), embedded: Number(stated[0][2]) },
                `§7 states ${stated[0][1]} KiB on disk and ${stated[0][2]} KiB embedded for `
                + `${file}; it measures ${measured.onDisk} and ${measured.embedded}.`
            ).toEqual(measured);
        });
    }

    it('leaves no KiB claim about the indexes unaccounted for', () => {
        // The builder said 49 KiB in one comment and 50 in another, about
        // quantities neither named. Every KiB figure in the two documents that
        // carry these claims has to be one of the four measurements, or it is a
        // fifth number nobody re-measures.
        const measured = new Set(INDEX_SIZES
            .flatMap(({ file }) => Object.values(measureIndex(file)))
            .map(String));
        expect(measured.size).toBeGreaterThan(1);
        for (const file of [SPEC, 'scripts/build-division-index.mjs']) {
            const figures = [...read(file).matchAll(/(\d+)\s*KiB/gu)].map(match => match[1]);
            expect(figures.length, `${file} states no catalogue size`).toBeGreaterThan(0);
            for (const figure of figures) {
                expect(measured.has(figure),
                    `${file} claims ${figure} KiB, which is neither index's size on disk `
                    + `(${[...measured].join(', ')} are)`
                ).toBe(true);
            }
        }
    });
});

/**
 * THE SAME LAW, ON THE SECOND DOCUMENT.
 *
 * Everything above holds SCRIPTORIUM-SPEC.md's citations to a path and a real
 * heading, because a citation nobody can check is a label offered as evidence.
 * Then the strengthening brief arrived and six files came to cite IT — §2.4,
 * §5, §9.1 — and every one of them named it without a path, which is the
 * precise failure the block above was written to end. A rule that reaches one
 * document and not its sibling was never a rule; it was a fix.
 *
 * The heading grammar differs and that is not incidental. This document
 * numbers `## 5. The partition` and `### 5.5 Default names` — a period after
 * the integer, none after the dotted pair — so the pattern above (`\d+[a-z]?`
 * followed by a period) matches `5` and cannot see `5.5` at all. Reusing it
 * would have passed every citation in this file by finding no sections to
 * disagree with.
 */
describe('every strengthening-brief citation resolves', () => {
    const BRIEF = 'docs/vision/SCRIPTORIUM-STRENGTHENING-SPEC.md';
    const brief = read(BRIEF);

    /** `## 5. Title` and `### 5.5 Title` alike. */
    const briefSections = new Set(
        [...brief.matchAll(/^#{2,4}\s+(\d+(?:\.\d+)?)\.?\s/gmu)].map(match => match[1])
    );

    const briefCitations = source => [...source.matchAll(
        /(\S*SCRIPTORIUM-STRENGTHENING-SPEC(?:\.md)?)\s*(?:§(\d+(?:\.\d+)?))?/gu
    )].map(match => ({ path: match[1], section: match[2] || null }));

    it('reads both heading depths, or it checks nothing', () => {
        // A sweep that found only the top-level headings would pass every
        // subsection citation below it without ever looking one up.
        expect(briefSections.has('5')).toBe(true);
        expect(briefSections.has('5.5')).toBe(true);
        expect(briefSections.has('2.4')).toBe(true);
        expect(briefSections.size).toBeGreaterThan(20);
    });

    it('names every file that cites the brief', () => {
        // Discovered rather than listed: a file added tomorrow is held to the
        // same rule without anyone remembering to add it here.
        expect(CITING_BRIEF.length).toBeGreaterThanOrEqual(6);
    });

    for (const file of CITING_BRIEF) {
        it(`${file} cites the brief by a path, at a section that exists`, () => {
            for (const { path, section } of briefCitations(read(file))) {
                expect(path, `${file} cites the brief without a path`).toContain(BRIEF);
                if (section === null) continue;
                expect(briefSections.has(section),
                    `${file} cites §${section}, which is not a heading in ${BRIEF}`).toBe(true);
            }
        });
    }

    it('still records the one place the code departs from it', () => {
        // §9.1 deletes "Local Files -> immediate Chamber". It is kept, as a
        // second button. A brief whose deletion list silently regained that
        // line would describe a build that does not exist.
        expect(brief).toMatch(/Reversed 2026-08-21/u);
        expect(brief).toMatch(/imported-/u);
    });
});
