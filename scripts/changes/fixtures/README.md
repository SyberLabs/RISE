# Cross-repository source proof

The acceptance fixture pins the workflow fixed by #745 at
`a2dad66c44381c455a8b1050273c32327d152649`.

From a checkout of this PR with locked dependencies installed:

```sh
# Only needed when the local clone does not contain the pinned workflow commit:
git fetch origin a2dad66c44381c455a8b1050273c32327d152649
node scripts/changes/cross-repository-proof.mjs
npx vitest run scripts/changes/public-workflow.test.js scripts/changes/run-digest.test.js src/core/changes/repository.test.js
```

The offline proof creates a distinct caller commit with an install script that
must never execute. It evaluates the defining workflow's checkout expression
using documented caller/job identities, performs a real RISE checkout, confirms
its HEAD, and invokes that tree's actual `runDigest`. A private record stops at
the public gate before any content read; a public empty-period fixture passes
the gate and returns without writing. All GitHub data is injected, model access
throws, and no publish/issue command is executed. This does not execute the
GitHub Actions expression engine, the checkout action, or the workflow shell.

For GitHub-hosted confirmation, the exact remaining approval is: authorize adding
`cross-repository-caller.yml` as `.github/workflows/changes-acceptance.yml` in one
named **private, disposable fixture repository**, and manually dispatch it once.
That repository must permit the declared workflow permissions. No real model
credential is needed: the literal token is deliberately unusable. Do not run
this hosted fixture in a public repository: dry-run suppresses publication but
does not suppress model calls if that repository has eligible changes.

Expected hosted evidence: the setup log checks out `SyberLabs/RISE` at the pinned
SHA (not the private caller's SHA), then `Route, compose and admit the digest`
fails with `The repository is not public, so the run stops before reading it`.
The intended result is that refusal, not a green digest job. Confirm no
`changes-data` push, label creation, or notification issue step ran. Record the
run URL, caller SHA, RISE SHA, and gate log. Do not install or dispatch this
external caller without its owner's authorization.

GitHub's official semantics and own-checkout example:
https://docs.github.com/en/actions/reference/workflows-and-actions/contexts#example-usage-of-job-context-workflow-identity
