import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const text = readFileSync(resolve(process.cwd(), '.github/workflows/changes-public.yml'), 'utf8');

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

  it('runs the pinned RISE tree, never the caller’s dependencies, and checks the repository out only to publish', () => {
    const digest = text.indexOf('Route, compose and admit the digest');
    const publish = text.indexOf('Check out the data branch');
    const install = text.indexOf('npm ci');
    const caller = text.indexOf('repository: ${{ github.repository }}');
    expect(digest).toBeGreaterThan(install);
    expect(publish).toBeGreaterThan(digest);
    expect(caller).toBeGreaterThan(install);
    expect(text.slice(caller)).not.toMatch(/npm ci/);
    expect(text).toMatch(/repository: SyberLabs\/RISE\n {10}ref: \$\{\{ github\.workflow_sha \}\}\n {10}persist-credentials: false/);
    expect(text).toMatch(/working-directory: rise/);
    const callerCheckout = text.slice(publish);
    expect(callerCheckout).toMatch(/repository: \$\{\{ github\.repository \}\}/);
    expect(callerCheckout).toMatch(/HEAD:refs\/heads\/changes-data/);
    expect(callerCheckout).not.toMatch(/--force|github\.ref|refs\/heads\/main/);
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
