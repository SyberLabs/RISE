/**
 * Fact cards (docs/plans/RISE-CHANGES.md, Fact cards): what GitHub states about
 * one collected pull request, computed by code with no model. The card keeps the
 * whole body (up to LIMITS.fullBody, cut by collect) for the model stages only;
 * nothing on it is written to a published file. Contributor text on it (body, commit subjects, issue titles) is raw
 * data, quoted where a prompt is built.
 */

/**
 * Bumped whenever a rule here changes a field the router or the claims stage reads (scripts/changes/route-context.js,
 * claims-context.js): it is part of both caches' contract hashes, so nothing judged on the old facts is reused.
 */
export const FACTS_VERSION = 1;

const DEPENDENCY_FILES = new Set([
  'package.json', 'package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lock', 'bun.lockb',
  'go.mod', 'go.sum', 'Cargo.toml', 'Cargo.lock', 'poetry.lock', 'pyproject.toml', 'requirements.txt', 'Pipfile.lock',
  'Gemfile', 'Gemfile.lock', 'composer.json', 'composer.lock'
]);
const TWO_LEVEL_ROOTS = new Set(['src', 'scripts']);

const basename = path => path.slice(path.lastIndexOf('/') + 1);

/** A directory, never a file: the first, or the first two under src/ and scripts/; `.` is the root. */
function areaOf(path) {
  const directories = path.split('/').slice(0, -1);
  if (directories.length === 0) return '.';
  return TWO_LEVEL_ROOTS.has(directories[0]) && directories.length > 1 ? `${directories[0]}/${directories[1]}` : directories[0];
}

const PATH_RULES = {
  migration: path => /(^|\/)migrations?\//.test(path) || /\.sql$/i.test(path),
  config: path => /\.config\./.test(basename(path)) || basename(path).startsWith('.env') || basename(path).startsWith('wrangler'),
  dependency: path => DEPENDENCY_FILES.has(basename(path)),
  workflow: path => path.startsWith('.github/workflows/')
};
const isDoc = path => path.startsWith('docs/');
const isTest = path => /\.(test|spec)\.[^/]+$/.test(path) || path.startsWith('e2e/');

function areasOf(files) {
  const areas = new Map();
  for (const file of files) {
    const name = areaOf(file.path);
    const area = areas.get(name) ?? { area: name, files: 0, additions: 0, deletions: 0 };
    area.files += 1;
    area.additions += file.additions;
    area.deletions += file.deletions;
    areas.set(name, area);
  }
  const changed = area => area.additions + area.deletions;
  return [...areas.values()].sort((a, b) => changed(b) - changed(a) || (a.area < b.area ? -1 : 1));
}

/** The only-flags need every changed file: a pull request with more files than were listed is never docs or tests only. */
function flagsOf(paths, fileCount) {
  const complete = paths.length > 0 && paths.length === fileCount;
  return {
    ...Object.fromEntries(Object.entries(PATH_RULES).map(([flag, rule]) => [flag, paths.some(rule)])),
    docsOnly: complete && paths.every(isDoc),
    testsOnly: complete && paths.every(isTest)
  };
}

/** One collected pull request (collect.js normalizePull) as its fact card. */
export function factCard(pull) {
  const files = pull.fileStats.map(({ path, additions, deletions }) => ({ path, additions, deletions }));
  return {
    number: pull.number,
    mergeSha: pull.mergeSha,
    title: pull.title,
    body: pull.fullBody,
    bodyCut: pull.bodyCut,
    labels: [...pull.labels],
    commits: [...pull.commits],
    files,
    fileCount: pull.fileCount,
    additions: pull.additions,
    deletions: pull.deletions,
    areas: areasOf(files),
    flags: flagsOf(files.map(file => file.path), pull.fileCount),
    issues: pull.issues.map(({ number, title }) => ({ number, title }))
  };
}
