import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { collectMergedPulls } from './collect.js';
import { BODY_CEILING, factCard } from './facts.js';

const REPO = 'SyberLabs/RISE';
const sha = n => String(n).padStart(40, 'a');

/** A collected pull request as normalizePull returns it; `files` are [path, additions, deletions]. */
function pull({ files = [['src/core/a.js', 3, 1]], fileCount = files.length, body = 'Body.', ...rest } = {}) {
  return {
    number: 700,
    title: 'A change',
    body: Array.from(body).slice(0, 4000).join(''),
    fullBody: body,
    url: `https://github.com/${REPO}/pull/700`,
    mergedAt: '2026-10-13T10:00:00Z',
    mergeSha: sha(700),
    labels: ['live'],
    files: files.map(([path]) => path),
    fileStats: files.map(([path, additions, deletions]) => ({ path, additions, deletions })),
    fileCount,
    additions: 10,
    deletions: 2,
    commits: ['First subject'],
    issues: [],
    ...rest
  };
}

const flags = (paths, options) => factCard(pull({ files: paths.map(path => [path, 1, 0]), ...options })).flags;
const areas = paths => factCard(pull({ files: paths.map(path => [path, 1, 0]) })).areas.map(entry => entry.area);

describe('factCard: areas', () => {
  it('is the first directory, or the first two under src/ and scripts/', () => {
    expect(areas(['src/core/changes/collect.js'])).toEqual(['src/core']);
    expect(areas(['scripts/changes/route.js'])).toEqual(['scripts/changes']);
    expect(areas(['docs/plans/RISE-CHANGES.md'])).toEqual(['docs']);
    expect(areas(['worker/index.mjs'])).toEqual(['worker']);
    expect(areas(['.github/workflows/ci.yml'])).toEqual(['.github']);
  });

  it('names a file at the root, or directly under src/ or scripts/, by its directory', () => {
    expect(areas(['package.json'])).toEqual(['.']);
    expect(areas(['src/app.js'])).toEqual(['src']);
    expect(areas(['scripts/ci-hygiene.mjs'])).toEqual(['scripts']);
  });

  it('sums each area’s files and lines, the most changed lines first, then by name', () => {
    const card = factCard(pull({ files: [['docs/a.md', 1, 0], ['src/core/a.js', 30, 5], ['src/core/b.js', 4, 1], ['worker/x.mjs', 1, 0]] }));
    expect(card.areas).toEqual([
      { area: 'src/core', files: 2, additions: 34, deletions: 6 },
      { area: 'docs', files: 1, additions: 1, deletions: 0 },
      { area: 'worker', files: 1, additions: 1, deletions: 0 }
    ]);
  });
});

describe('factCard: flags are path rules', () => {
  it('dependency: package.json and lockfiles at any depth', () => {
    for (const path of ['package.json', 'package-lock.json', 'worker/package.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml']) {
      expect(flags([path]).dependency, path).toBe(true);
    }
    for (const path of ['src/packages.js', 'docs/package.json.md']) expect(flags([path]).dependency, path).toBe(false);
  });

  it('workflow: under .github/workflows/', () => {
    expect(flags(['.github/workflows/ci.yml']).workflow).toBe(true);
    expect(flags(['.github/CODEOWNERS']).workflow).toBe(false);
  });

  it('migration: a migration or migrations directory, or a .sql file', () => {
    for (const path of ['db/migrations/001.js', 'migration/up.js', 'worker/schema.sql']) expect(flags([path]).migration, path).toBe(true);
    for (const path of ['src/migrate.js', 'docs/migrations-guide.md']) expect(flags([path]).migration, path).toBe(false);
  });

  it('config: *.config.*, .env* and wrangler*', () => {
    for (const path of ['vite.config.js', 'vitest.fast.config.js', '.env.example', 'wrangler.production.jsonc', 'worker/wrangler.toml']) {
      expect(flags([path]).config, path).toBe(true);
    }
    for (const path of ['src/config.js', 'src/core/configure.js', 'docs/env.md']) expect(flags([path]).config, path).toBe(false);
  });

  it('docsOnly: every changed file is under docs/, and every changed file was seen', () => {
    expect(flags(['docs/a.md', 'docs/plans/b.md']).docsOnly).toBe(true);
    expect(flags(['docs/a.md', 'README.md']).docsOnly).toBe(false);
    expect(flags(['docs/a.md'], { fileCount: 140 }).docsOnly).toBe(false);
    expect(flags([]).docsOnly).toBe(false);
  });

  it('testsOnly: every changed file is a .test. or .spec. file or under e2e/, and every changed file was seen', () => {
    expect(flags(['src/core/a.test.js', 'e2e/live.spec.js']).testsOnly).toBe(true);
    expect(flags(['src/core/a.test.js', 'src/core/a.js']).testsOnly).toBe(false);
    expect(flags(['src/core/a.test.js'], { fileCount: 101 }).testsOnly).toBe(false);
    expect(flags([]).testsOnly).toBe(false);
  });
});

describe('factCard: the body', () => {
  it('is whole, though the pull request’s body for the v1 composer is cut at 4,000 characters', () => {
    const body = 'x'.repeat(8225);
    const card = factCard(pull({ body }));
    expect(card.body).toBe(body);
    expect(card.bodyCut).toBe(false);
  });

  it('is cut at the ceiling in characters, not UTF-16 units, and says so', () => {
    const body = '𝔵'.repeat(BODY_CEILING + 10);
    const card = factCard(pull({ body }));
    expect(BODY_CEILING).toBe(65536);
    expect(Array.from(card.body)).toHaveLength(BODY_CEILING);
    expect(card.bodyCut).toBe(true);
    const exact = factCard(pull({ body: 'y'.repeat(BODY_CEILING) }));
    expect(exact.bodyCut).toBe(false);
  });
});

describe('factCard: shape', () => {
  it('is the card and nothing else', () => {
    const card = factCard(pull({
      files: [['src/core/a.js', 8, 2], ['package.json', 2, 0]],
      fileCount: 2,
      commits: ['Add a', 'Fix a'],
      issues: [{ number: 12, title: 'An issue' }]
    }));
    expect(card).toEqual({
      number: 700,
      mergeSha: sha(700),
      title: 'A change',
      body: 'Body.',
      bodyCut: false,
      labels: ['live'],
      commits: ['Add a', 'Fix a'],
      files: [{ path: 'src/core/a.js', additions: 8, deletions: 2 }, { path: 'package.json', additions: 2, deletions: 0 }],
      fileCount: 2,
      additions: 10,
      deletions: 2,
      areas: [{ area: 'src/core', files: 1, additions: 8, deletions: 2 }, { area: '.', files: 1, additions: 2, deletions: 0 }],
      flags: { migration: false, config: false, dependency: true, workflow: false, docsOnly: false, testsOnly: false },
      issues: [{ number: 12, title: 'An issue' }]
    });
  });
});

describe('factCard on the recorded week of #652–#671', () => {
  const fixture = readFileSync(resolve(process.cwd(), 'src/core/changes/fixtures/graphql-week.json'), 'utf8');
  const collect = () => collectMergedPulls(async () => fixture, { repo: REPO, from: '2026-10-13T02:00:00Z', to: '2026-10-14T09:00:00Z' });

  it('makes a card for every pull request merged in the period', async () => {
    const pulls = await collect();
    const cards = pulls.map(factCard);
    expect(cards.map(card => card.number).sort((a, b) => a - b)).toEqual(Array.from({ length: 20 }, (_, i) => 652 + i));
    for (const card of cards) {
      expect(card.files.length, `#${card.number}`).toBe(card.fileCount);
      expect(card.areas.reduce((sum, area) => sum + area.files, 0), `#${card.number}`).toBe(card.fileCount);
      expect(card.commits.length, `#${card.number}`).toBeGreaterThan(0);
    }
  });

  it('keeps #655’s “Not verified”, which starts past the v1 cut', async () => {
    const pulls = await collect();
    const p655 = pulls.find(entry => entry.number === 655);
    const card = factCard(p655);
    expect(p655.body).not.toContain('Not verified');
    expect(card.body).toContain('Not verified');
    expect(card.bodyCut).toBe(false);
    expect(card).toMatchObject({ additions: 848, deletions: 37, fileCount: 20 });
  });
});
