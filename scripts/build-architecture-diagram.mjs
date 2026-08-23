/**
 * The system design diagram, written by the system it describes.
 *
 * A hand-drawn diagram is a claim nobody re-checks. This one is derived: every
 * non-test module under src/ is read, its relative imports resolved, and the
 * edges aggregated to subsystem level. The result is written into
 * ARCHITECTURE.md between generated markers, and CI fails if the committed
 * diagram is not what src/ produces.
 *
 * Static and dynamic edges are drawn differently because they answer different
 * questions. A static import is in the first load. A subsystem reached only
 * through `import()` is deferred — the same distinction the first-load budget
 * measures.
 *
 * Known limit: a dynamic import whose specifier is a template literal
 * (`import(\`./x/${name}.js\`)`) has no literal path to resolve, so it is not
 * an edge here. Those are content lookups, not structure.
 *
 *   npm run docs:diagram
 */
import { readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, relative, resolve } from 'node:path';

const SRC = 'src';
const DOC = 'docs/specs/ARCHITECTURE.md';
const BEGIN = '<!-- BEGIN GENERATED DIAGRAM: npm run docs:diagram -->';
const END = '<!-- END GENERATED DIAGRAM -->';

// src/test holds the Vitest harness, which is not part of what ships.
const NOT_SHIPPED = new Set(['test']);

// What each subsystem is for. A diagram of bare directory names makes the
// reader open the directory; a caption makes it answer on its own. A subsystem
// with no entry here still appears — it just speaks for itself.
const CAPTIONS = {
    app: 'composition root',
    audio: 'Web Audio, recitation',
    components: 'routed views',
    content: 'texts, imagery, journeys',
    core: 'session, player, router',
    page: 'spatial projection',
    sources: 'text and visual providers',
    visuals: 'procedural generation'
};

/** Every module that ships, which is every .js under src/ that is not a test. */
function modules(dir, out = []) {
    for (const entry of readdirSync(dir).sort()) {
        const full = join(dir, entry);
        if (statSync(full).isDirectory()) modules(full, out);
        else if (entry.endsWith('.js') && !/\.(test|spec)\.js$/.test(entry)) out.push(full);
    }
    return out;
}

/**
 * The subsystem a path belongs to: its first segment under src/, or `app` for
 * the root-level modules that wire the rest together.
 */
function subsystemOf(path) {
    const parts = relative(SRC, path).split('/');
    return parts.length === 1 ? 'app' : parts[0];
}

// `[^;'"]` spans newlines, so a braced multi-line import still matches, and
// stopping at a quote keeps the capture on the specifier.
const STATIC_FROM = /^[ \t]*(?:import|export)\b[^;'"]*?\bfrom\s*['"]([^'"]+)['"]/gm;
const STATIC_BARE = /^[ \t]*import\s*['"]([^'"]+)['"]/gm;
const DYNAMIC = /\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g;

const specifiers = (source, pattern) =>
    [...source.matchAll(pattern)].map(match => match[1]);

/**
 * Resolve a relative specifier to a file on disk. Extensionless and directory
 * specifiers are how the codebase writes some of its imports.
 */
function resolveLocal(fromFile, spec) {
    if (!spec.startsWith('.')) return null;          // an npm package, not ours
    const base = resolve(dirname(fromFile), spec);
    for (const candidate of [base, `${base}.js`, join(base, 'index.js')]) {
        try {
            if (statSync(candidate).isFile()) return relative(process.cwd(), candidate);
        } catch { /* try the next shape */ }
    }
    return null;
}

const files = modules(SRC).filter(file => !NOT_SHIPPED.has(subsystemOf(file)));

const fileCount = new Map();
const edges = new Map();                              // "from→to" -> { static, dynamic }

for (const file of files) {
    const from = subsystemOf(file);
    fileCount.set(from, (fileCount.get(from) || 0) + 1);

    const source = readFileSync(file, 'utf8');
    const links = [
        ...specifiers(source, STATIC_FROM).map(spec => ({ spec, kind: 'static' })),
        ...specifiers(source, STATIC_BARE).map(spec => ({ spec, kind: 'static' })),
        ...specifiers(source, DYNAMIC).map(spec => ({ spec, kind: 'dynamic' }))
    ];

    for (const { spec, kind } of links) {
        const target = resolveLocal(file, spec);
        if (!target) continue;
        const to = subsystemOf(target);
        if (to === from || NOT_SHIPPED.has(to)) continue;  // inside a subsystem is its own business
        const key = `${from}→${to}`;
        const edge = edges.get(key) || { from, to, static: 0, dynamic: 0 };
        edge[kind] += 1;
        edges.set(key, edge);
    }
}

const nodes = [...fileCount.keys()].sort();
const ordered = [...edges.values()].sort((a, b) =>
    a.from.localeCompare(b.from) || a.to.localeCompare(b.to));

const lines = [
    '```mermaid',
    'flowchart LR',
    // <br/> is the only markup Mermaid honours in a label whether or not the
    // renderer allows HTML, and GitHub's does not.
    ...nodes.map(name => {
        const count = fileCount.get(name);
        const label = [name, CAPTIONS[name], `${count} module${count === 1 ? '' : 's'}`]
            .filter(Boolean)
            .join('<br/>');
        return `    ${name}["${label}"]`;
    }),
    '',
    // A subsystem that is only ever reached through import() is deferred, so
    // its edge is dashed. An edge that is static anywhere is a solid edge.
    ...ordered.map(({ from, to, static: statik, dynamic }) => statik > 0
        ? `    ${from} --> |${statik}| ${to}`
        : `    ${from} -.-> |${dynamic} lazy| ${to}`),
    '```',
    '',
    'Solid is a static import and travels in the first load; dashed is reached',
    'only through `import()` and is deferred. The number on an edge is how many',
    'imports it stands for. Generated by `npm run docs:diagram` — edit the',
    'generator, not the diagram.'
];

const doc = readFileSync(DOC, 'utf8');
const begin = doc.indexOf(BEGIN);
const end = doc.indexOf(END);

if (begin === -1 || end === -1) {
    console.error(`✗ ${DOC} carries no generated-diagram markers`);
    console.error(`  Add ${BEGIN} and ${END} where the diagram belongs.`);
    process.exit(1);
}

const rewritten = [
    doc.slice(0, begin + BEGIN.length),
    '\n\n',
    lines.join('\n'),
    '\n\n',
    doc.slice(end)
].join('');

writeFileSync(DOC, rewritten);

const staticEdges = ordered.filter(edge => edge.static > 0).length;
console.log(`✓ ${DOC}: ${nodes.length} subsystems, ${staticEdges} static and ${ordered.length - staticEdges} deferred edges, from ${files.length} modules`);
