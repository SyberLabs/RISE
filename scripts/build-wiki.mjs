/**
 * Build the GitHub wiki from the Markdown already in this repository.
 *
 * The wiki is a published view, never a source. A hand-written wiki is the
 * project's most expensive recurring defect wearing a different hat — a
 * vocabulary living in two places where only one learns a new word — so
 * nothing here is authored. Every page is a file under docs/, plus the README
 * and AGENTS.md, with links rewritten for the wiki's flat namespace.
 *
 * Two things are enforced rather than hoped for:
 *
 *   1. Every published document appears in docs/README.md. A document added
 *      to the tree and not to the index is a document nobody will find, so it
 *      fails the build instead of shipping unlisted.
 *   2. Every internal link resolves. The wiki flattens directories, so a link
 *      that worked in the tree can silently break here; each one is resolved
 *      against a real file before it is rewritten.
 *
 *   node scripts/build-wiki.mjs --out /tmp/rise-wiki
 */
import { readFileSync, writeFileSync, mkdirSync, rmSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, basename, relative, resolve } from 'node:path';

const REPO = 'https://github.com/SyberLabs/RISE';
const ROOT = resolve(dirname(new URL(import.meta.url).pathname), '..');
const INDEX = 'docs/README.md';

/** Repo-relative path → wiki page name. The wiki namespace is flat. */
const PAGES = new Map([
    ['README.md', 'Home'],
    [INDEX, 'Documentation'],
    ['AGENTS.md', 'AGENTS']
]);

/**
 * Working artifacts of the Superpowers workflow — design specs and
 * task-by-task plans addressed to whoever is executing them. They are
 * in-flight process, not documentation a reader came looking for, so they
 * are neither published nor required in the index.
 */
const NOT_PUBLISHED = ['docs/superpowers'];

/** Every .md under docs/, keyed by its repo-relative path. */
function markdownUnder(dir, out = []) {
    if (NOT_PUBLISHED.includes(dir)) return out;
    for (const entry of readdirSync(join(ROOT, dir)).sort()) {
        const path = `${dir}/${entry}`;
        if (statSync(join(ROOT, path)).isDirectory()) markdownUnder(path, out);
        else if (entry.endsWith('.md')) out.push(path);
    }
    return out;
}

for (const path of markdownUnder('docs')) {
    if (!PAGES.has(path)) PAGES.set(path, basename(path, '.md'));
}

const duplicates = [...PAGES.values()].filter((name, i, all) => all.indexOf(name) !== i);
if (duplicates.length) {
    throw new Error(`two documents want the same wiki page: ${[...new Set(duplicates)].join(', ')}\n`
        + 'The wiki namespace is flat. Rename one of them.');
}

// ── Rewrite links for a flat namespace ───────────────────────────────
//
// A page keeps its prose exactly. Only the target of a Markdown link
// changes, and only when it points somewhere inside this repository.
const MARKDOWN_LINK = /\[([^\]]*)\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const problems = [];

function rewriteLinks(body, sourcePath) {
    return body.replace(MARKDOWN_LINK, (whole, text, target) => {
        if (/^(https?:|mailto:|#)/.test(target)) return whole;

        const [rawPath, anchor] = target.split('#');
        if (!rawPath) return whole;

        const repoPath = relative(ROOT, resolve(ROOT, dirname(sourcePath), rawPath));
        const suffix = anchor ? `#${anchor}` : '';

        let onDisk = false;
        try { onDisk = statSync(join(ROOT, repoPath)).isDirectory() ? 'dir' : 'file'; } catch { onDisk = false; }

        if (!onDisk) {
            problems.push(`${sourcePath} links to ${rawPath}, which is not in the tree`);
            return whole;
        }
        // A directory or a non-Markdown file has no wiki page; send the
        // reader to the repository, where the thing actually is.
        if (onDisk === 'dir') return `[${text}](${REPO}/tree/main/${repoPath})`;
        if (!PAGES.has(repoPath)) return `[${text}](${REPO}/blob/main/${repoPath}${suffix})`;

        return `[${text}](${PAGES.get(repoPath)}${suffix})`;
    });
}

// ── The sidebar is the index, in the index's own order ───────────────
//
// Parsed from docs/README.md rather than declared here, so adding a
// document to the index is the only step needed to make it navigable.
function buildSidebar() {
    const lines = readFileSync(join(ROOT, INDEX), 'utf8').split('\n');
    const sidebar = ['### [RISE](Home)', ''];
    const indexed = new Set();
    let heading = null;

    for (const line of lines) {
        const section = line.match(/^## (.+)/);
        if (section) { heading = section[1].trim(); continue; }

        const row = line.match(/^\|\s*\[([^\]]+)\]\(([^)]+)\)/);
        if (!row) continue;

        const repoPath = relative(ROOT, resolve(ROOT, 'docs', row[2].split('#')[0]));
        if (!PAGES.has(repoPath)) continue;

        if (heading) {
            if (sidebar.at(-1) !== '') sidebar.push('');
            sidebar.push(`**${heading}**`, '');
            heading = null;
        }
        sidebar.push(`- [${PAGES.get(repoPath)}](${PAGES.get(repoPath)})`);
        indexed.add(repoPath);
    }

    sidebar.push('', '---', '', `[Documentation index](Documentation) · [Repository](${REPO})`);
    return { sidebar: sidebar.join('\n') + '\n', indexed };
}

const { sidebar, indexed } = buildSidebar();

// Every published document must be findable from the index.
for (const [repoPath, page] of PAGES) {
    if (PAGES.get(repoPath) === 'Home' || repoPath === INDEX || repoPath === 'AGENTS.md') continue;
    if (!indexed.has(repoPath)) {
        problems.push(`${repoPath} is not listed in ${INDEX}, so the wiki would publish "${page}" with no way to reach it`);
    }
}

// ── Write ────────────────────────────────────────────────────────────
const outFlag = process.argv.indexOf('--out');
const outDir = resolve(outFlag === -1 ? join(ROOT, 'build/wiki') : process.argv[outFlag + 1]);

const rendered = [...PAGES].map(([repoPath, page]) => {
    const body = rewriteLinks(readFileSync(join(ROOT, repoPath), 'utf8'), repoPath);
    const source = `\n\n---\n\n*Published from [\`${repoPath}\`](${REPO}/blob/main/${repoPath}). `
        + 'Edits made here are overwritten on the next push to `main`.*\n';
    return [page, body.replace(/\s+$/, '') + source];
});

if (problems.length) {
    console.error(`\n✗ ${problems.length} problem(s):\n`);
    for (const problem of problems) console.error(`  ${problem}`);
    console.error('');
    process.exit(1);
}

rmSync(outDir, { recursive: true, force: true });
mkdirSync(outDir, { recursive: true });
for (const [page, body] of rendered) writeFileSync(join(outDir, `${page}.md`), body);
writeFileSync(join(outDir, '_Sidebar.md'), sidebar);

console.log(`✓ ${rendered.length} wiki pages + sidebar → ${outDir}`);
