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

describe.each(['changes-digest.yml', 'changes-public.yml'])('the run’s artifact and published files in %s', name => {
  const workflow = readFileSync(resolve(process.cwd(), '.github/workflows', name), 'utf8').replace(/\r\n/g, '\n');
  const step = title => {
    const start = workflow.indexOf(`- name: ${title}`);
    const end = workflow.indexOf('\n      - ', start + 1);
    return workflow.slice(start, end === -1 ? undefined : end);
  };

  it('uploads run.json and rejected.json, and nothing else, after the digest step even when it fails', () => {
    const upload = step("Keep the run's evidence as an artifact");
    expect(workflow.indexOf('Keep the run')).toBeGreaterThan(workflow.indexOf('Route, compose and admit the digest'));
    expect(upload).toMatch(/if: always\(\)/);
    // A failed upload (an artifact name a caller's workflow already used) never skips the commit and the issue.
    expect(upload).toMatch(/continue-on-error: true/);
    expect(upload).toMatch(/uses: actions\/upload-artifact@[0-9a-f]{40} # v\d+\.\d+\.\d+\n/);
    expect(upload.match(/^ {12}\S.*$/gm)).toEqual(['            ${{ runner.temp }}/changes/run.json', '            ${{ runner.temp }}/changes/rejected.json']);
    expect(upload).toMatch(/retention-days: 90/);
    expect(upload).not.toMatch(/CLAUDE_CODE_OAUTH_TOKEN|model_token|GH_TOKEN/);
  });

  it('commits only the digest and the index to changes-data, never rejected.json', () => {
    const commit = step('Commit the digest to changes-data');
    expect(commit).toMatch(/cp "\$RUNNER_TEMP\/changes\/\$ID\.json" "\$RUNNER_TEMP\/changes\/index\.json" \.\n/);
    expect(commit).toMatch(/git add README\.md index\.json "\$ID\.json"\n/);
    expect(commit).not.toMatch(/rejected|run\.json/);
  });
});

describe('the replay workflow', () => {
  const replay = read('changes-replay.yml');
  const digest = read('changes-digest.yml');
  const run = step(replay, 'Replay twice with one cache, the second pass without a model call for a cached pull request');

  it('is dispatched by hand only, never on a pull request, a schedule, a push or a call', () => {
    expect(replay).toMatch(/^on:\n {2}workflow_dispatch:\n\n/m);
    expect(replay).not.toMatch(/pull_request|schedule|push:|workflow_call/);
  });

  it('may only read the repository', () => {
    expect(replay).toMatch(/^permissions:\n {2}contents: read\n {2}pull-requests: read\n\n/m);
    expect(digest).toMatch(/^ {2}pull-requests: read\n/m);
    expect(replay).not.toMatch(/: write/);
  });

  it('installs Node and the Claude Code CLI exactly as the digest does, with the same pinned actions', () => {
    const uses = workflow => workflow.match(/uses: actions\/(?:checkout|setup-node)@[0-9a-f]{40} # v\d+/g);
    expect(uses(replay)).toEqual([...new Set(uses(digest))]);
    expect(replay).toContain('node-version: 22.23.3\n');
    const lines = workflow => step(workflow, 'Install the Claude Code CLI').split('\n').filter(line => line.trim() && !line.trim().startsWith('#'));
    expect(lines(replay)).toEqual(lines(digest));
    expect(lines(replay)).toHaveLength(4);
    expect(replay).toContain('persist-credentials: false');
  });

  it('gives the model token and the GitHub token to the replay step alone, from the secret and github.token', () => {
    expect(run).toContain('GH_TOKEN: ${{ github.token }}\n');
    expect(run).toContain('CLAUDE_CODE_OAUTH_TOKEN: ${{ secrets.CLAUDE_CODE_OAUTH_TOKEN }}\n');
    expect(replay.replace(run, '')).not.toMatch(/GH_TOKEN|CLAUDE_CODE_OAUTH_TOKEN|secrets\./);
  });

  it('replays twice with one cache directory and fails when the second pass called the model for a pull request the first cached', () => {
    const passes = run.match(/node scripts\/changes\/replay\.mjs --periods builtin --cache "\$root\/cache" --out "\$root\/(first|second)"/g);
    expect(passes).toEqual([
      'node scripts/changes/replay.mjs --periods builtin --cache "$root/cache" --out "$root/first"',
      'node scripts/changes/replay.mjs --periods builtin --cache "$root/cache" --out "$root/second"'
    ]);
    expect(run).toMatch(/set -euo pipefail\n/);
    expect(run).toContain('recalls=$(jq -r \'.cachedReCalls\' "$root/second/report.json")\n');
    expect(run).toMatch(/if \[ "\$recalls" != '0' \]; then\n[^\n]*::error::[^\n]*\n {12}exit 1\n/);
    expect(run).toContain('jq -r \'.uncachedRetries\' "$root/second/report.json"');
    // The one gate is the cached re-calls: a retry of a pull request the first pass could not cache never fails the job.
    expect(run.match(/^ {10}if /gm)).toEqual(['          if ']);
  });

  it('uploads both reports, even after a failure, for 30 days, with the pinned upload action', () => {
    const upload = step(replay, 'Keep both replay reports as an artifact');
    expect(upload).toMatch(/if: always\(\)\n/);
    expect(upload).toContain('uses: actions/upload-artifact@cf430e030ddbb5b0abf93d22962f4752f3646cd9 # v7.0.2\n');
    expect(upload.match(/^ {12}\S.*$/gm)).toEqual(['            ${{ runner.temp }}/replay/first', '            ${{ runner.temp }}/replay/second']);
    expect(upload).toMatch(/retention-days: 30/);
  });
});
