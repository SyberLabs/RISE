import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = name => readFileSync(resolve(process.cwd(), `.github/workflows/${name}`), 'utf8').replace(/\r\n/g, '\n');
const text = read('changes-public.yml');

/** One step's text, from its `- name:` line to the next step. */
const step = (workflow, name) => {
  const start = workflow.indexOf(`- name: ${name}\n`);
  const end = workflow.indexOf('\n      - ', start + 1);
  return start < 0 ? '' : workflow.slice(start, end < 0 ? undefined : end);
};

describe.each(['changes-digest.yml', 'changes-public.yml'])('the route cache in %s', name => {
  const workflow = read(name);

  it('checks the data branch out read-only, keeping no credential, before the run, and only when it exists', () => {
    const cache = step(workflow, 'Check out the route cache');
    expect(cache).toMatch(/if: steps\.branch\.outputs\.exists == 'true'\n/);
    expect(cache).toMatch(/ref: changes-data\n {10}path: changes-cache\n {10}persist-credentials: false\n?$/);
    expect(cache).not.toMatch(/token|secrets/);
    expect(workflow.indexOf('- name: Find the data branch')).toBeLessThan(workflow.indexOf('- name: Check out the route cache'));
    expect(workflow.indexOf('- name: Check out the route cache')).toBeLessThan(workflow.indexOf('- name: Route, compose and admit the digest'));
    expect(step(workflow, 'Find the data branch')).not.toMatch(/\n {8}if:/);
  });

  it('passes the checkout to the run as --cache, and commits only the new route files beside the digest', () => {
    expect(step(workflow, 'Route, compose and admit the digest'))
      .toContain('if [ -d "$GITHUB_WORKSPACE/changes-cache" ]; then args+=(--cache "$GITHUB_WORKSPACE/changes-cache"); fi');
    const commit = step(workflow, 'Commit the digest to changes-data');
    expect(commit).toContain('cp "$RUNNER_TEMP/changes/cache/routes/"*.json cache/routes/\n            git add cache/routes\n');
    // The digest, the index, and the route directory tested then copied: nothing else leaves the out directory.
    expect(commit.match(/\$RUNNER_TEMP\/changes\//g)).toHaveLength(4);
    expect(step(workflow, 'Check out the data branch')).toMatch(/if: steps\.digest\.outputs\.written == 'true' && !inputs\.dry_run/);
  });
});

describe('the public Changes workflow', () => {
  it('is called by a repository and is not dispatched, nor run on a pull request', () => {
    expect(text).toMatch(/^on:\n {2}workflow_call:\n/m);
    expect(text).not.toMatch(/workflow_dispatch|pull_request|schedule|push:/);
    expect(text).not.toMatch(/secrets:\s*inherit/);
  });

  it('takes the model credential as a secret and the repository only from GitHub', () => {
    expect(text).toMatch(/model_token:\n {8}required: true/);
    expect(text).not.toMatch(/^\s+repo:/m);
    expect(text).toMatch(/--repo "\$GITHUB_REPOSITORY"/);
    expect(text).toMatch(/--figures kit/);
    expect(text).not.toMatch(/inputs\.repo/);
  });

  it('runs the pinned RISE tree, never the caller’s dependencies, and checks the repository out only after the install, to read the route cache and to publish', () => {
    const digest = text.indexOf('Route, compose and admit the digest');
    const publish = text.indexOf('Check out the data branch');
    const install = text.indexOf('npm ci');
    const caller = text.indexOf('repository: ${{ github.repository }}');
    expect(digest).toBeGreaterThan(install);
    expect(publish).toBeGreaterThan(digest);
    expect(caller).toBeGreaterThan(install);
    expect(text.slice(caller)).not.toMatch(/npm ci/);
    expect(text).toMatch(/repository: SyberLabs\/RISE\n {10}ref: \$\{\{ job\.workflow_sha \}\}\n {10}persist-credentials: false/);
    expect(text).toMatch(/working-directory: rise/);
    const callerCheckout = text.slice(publish);
    expect(callerCheckout).toMatch(/repository: \$\{\{ github\.repository \}\}/);
    expect(callerCheckout).toMatch(/HEAD:refs\/heads\/changes-data/);
    expect(callerCheckout).not.toMatch(/--force|github\.ref|refs\/heads\/main/);
  });

  it('checks RISE out at its own workflow commit, never the caller’s', () => {
    // A called workflow's github context belongs to the caller, so github.workflow_sha names the caller's commit,
    // which does not exist in RISE: every cross-repository caller would fail before the public gate.
    // job.workflow_sha is the commit of the workflow file that defines this job, which is RISE's.
    expect(text).not.toMatch(/\$\{\{ github\.workflow_(sha|ref) \}\}/);
    expect(text.match(/ref: \$\{\{ job\.workflow_sha \}\}/g)).toHaveLength(1);
  });

  it('keeps the model credential out of the publish steps', () => {
    const digest = text.indexOf('Route, compose and admit the digest');
    const after = text.slice(digest);
    const tokenAt = after.indexOf('CLAUDE_CODE_OAUTH_TOKEN');
    const nextStep = after.indexOf('\n      - ', tokenAt);
    expect(tokenAt).toBeGreaterThan(0);
    expect(after.slice(nextStep)).not.toMatch(/CLAUDE_CODE_OAUTH_TOKEN|model_token/);
  });
});
