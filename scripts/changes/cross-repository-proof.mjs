import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import { test } from 'node:test';

const root = process.cwd();
const workflowPath = '.github/workflows/changes-public.yml';
const fixture = readFileSync(resolve(root, 'scripts/changes/fixtures/cross-repository-caller.yml'), 'utf8');
const pinned = fixture.match(/uses: SyberLabs\/RISE\/\.github\/workflows\/changes-public\.yml@([a-f0-9]{40})/)[1];
const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// This is an offline contract test, not a GitHub Actions interpreter. It evaluates
// the two source-identity expressions at issue using GitHub's documented contexts,
// performs real git checkouts, then runs the pinned source's actual digest gate.
test('checks out the pinned RISE source for a distinct caller and reaches the public gate without effects', async () => {
  mkdirSync(resolve(root, 'node_modules/.cache'), { recursive: true });
  const dir = mkdtempSync(resolve(root, 'node_modules/.cache/changes-caller-'));
  try {
    const caller = join(dir, 'caller');
    const rise = join(dir, 'rise');
    mkdirSync(caller);
    git(caller, 'init');
    writeFileSync(join(caller, 'package.json'), '{"scripts":{"install":"exit 99"}}');
    git(caller, 'add', 'package.json');
    git(caller, '-c', 'user.name=Acceptance fixture', '-c', 'user.email=acceptance@invalid.example', 'commit', '-m', 'Distinct caller');
    const callerSha = git(caller, 'rev-parse', 'HEAD');
    assert.notEqual(callerSha, pinned);
    assert.throws(() => git(root, 'cat-file', '-e', `${callerSha}^{commit}`));
    const context = { github: { repository: 'fixture/public-caller', workflow_sha: callerSha }, job: { workflow_sha: pinned } };
    const source = git(root, 'show', `${pinned}:${workflowPath}`);
    const checkout = source.match(/repository: SyberLabs\/RISE\r?\n\s+ref: \$\{\{ (\w+)\.workflow_sha \}\}/);
    assert.ok(checkout);
    assert.match(readFileSync(join(root, workflowPath), 'utf8'), /ref: \$\{\{ job\.workflow_sha \}\}/);
    const sourceSha = context[checkout[1]].workflow_sha;
    git(dir, 'clone', '--shared', '--no-checkout', root, rise);
    // The broken caller identity cannot be checked out in RISE.
    assert.throws(() => git(rise, 'checkout', '--detach', context.github.workflow_sha));
    git(rise, 'checkout', '--detach', sourceSha);
    assert.equal(git(rise, 'rev-parse', 'HEAD'), pinned);
    assert.equal(readFileSync(join(rise, workflowPath), 'utf8').replace(/\r\n/g, '\n').trim(), source.replace(/\r\n/g, '\n'));
    assert.match(fixture, /dry_run: true/);
    const { runDigest } = await import(pathToFileURL(join(rise, 'scripts/changes/run-digest.js')).href);
    const calls = [];
    const ask = () => { throw new Error('A model must never be called by this proof'); };
    const repo = context.github.repository;
    const options = { repo, ask, figures: 'kit', now: new Date('2026-10-26T12:00:00Z'), log: () => {} };
    await assert.rejects(runDigest({ ...options, gh: async args => {
      calls.push(args);
      assert.deepEqual(args, ['api', '--method', 'GET', `repos/${repo}`]);
      return JSON.stringify({ full_name: repo, private: true, visibility: 'private' });
    } }), /The repository is not public, so the run stops before reading it/);
    assert.equal(calls.length, 1);
    calls.length = 0;
    const result = await runDigest({ ...options, gh: async args => {
      calls.push(args);
      if (calls.length === 1) return JSON.stringify({ full_name: repo, private: false, visibility: 'public' });
      if (calls.length === 2) throw new Error('HTTP 404');
      assert.deepEqual(args.slice(0, 2), ['api', 'graphql']);
      assert.ok(args.includes('owner=fixture'));
      assert.ok(args.includes('name=public-caller'));
      return JSON.stringify({ data: { repository: { pullRequests: { nodes: [], pageInfo: { hasNextPage: false } } } } });
    } });
    assert.equal(calls.length, 3);
    assert.deepEqual(result, { written: false, reason: 'No pull request was merged into main in the period' });
    assert.equal(git(caller, 'status', '--porcelain'), '');
    console.log(`Pinned RISE ${pinned}: distinct caller checkout rejected; RISE checkout verified; private gate refused; public gate reached; zero model/publish/issue calls.`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});
