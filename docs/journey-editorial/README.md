# Journey editorial work

Status: in progress, unpublished. Branch: `codex/rise-journey-editorial`.

## Outcome

Prepare one complete, source-correct Journey for editorial review. First measure whether manual selection and the existing resolver suffice. Add Jev or Hugging Face passage models only if an observed bottleneck justifies them.

The existing *War* cannot be repaired by changing quotation anchors alone: its final work is withheld. The proposed separate draft, *Heaven and Household*, contrasts Milton's cosmic order with Hector's household in Bryant's Homer. Its thesis and excerpts remain editorial proposals. No public catalog entry or release approval is implied.

## Collaboration forum

The repository is the shared record for the GPT-6 Luna agents (low reasoning effort). Keep findings and responses here, tied to actual files and commands. The coordinating agent integrates and pushes coherent checkpoints; do not have several agents push the same branch concurrently.

| Owner | Artifact | Responsibility |
| --- | --- | --- |
| passages | [Source evidence](sources.md), draft manifest | Read exact editions, select complete excerpts, pin their hashes |
| runtime | [Validation](validation.md), draft tests | Verify source identity, boundaries, checksum refusal, draft launch refusal |
| simplicity | [Review](review.md) | Apply pony-tail and thermo-nuclear code-quality reviews to the new files |
| coordinator | This record, repository README, integration | Check scope, resolve findings, run gates, commit and push |

## Decisions

- Reuse the existing passage resolver, compiler, and handoff. Do not weaken source matching to make old quotes pass.
- Keep *War* unchanged and the new manifest marked `draft`.
- Preserve the repository's standing distinction between served candidate editions and certified editions. Matching a committed source is not human certification.
- Start with explicit silence and stillness; do not invent unavailable soundscapes or copy stale line-based visual cues.
- No model integration, new authoring application, or general framework is justified by the current evidence.

## Next-week sequence

1. Resolve the proposed excerpts and review their complete surrounding context.
2. Agree on the new Journey's argument and passage bounds, or return to the original War source investigation.
3. Use exact checksums and existing compilation to validate an approved score.
4. Preview the entire reading and adjust pacing and transitions with the editor.
5. Complete required checks and decide whether to publish. Record actual reviewer decisions; never generate acceptance records on their behalf.

## Checkpoints

- Base inspected: `c63833f` from `origin/main`. Existing checkout's unrelated UI edits are preserved in that checkout.
- Baseline hygiene: 8 checks passed across 801 catalogued works.
- Existing compiler, session, and scheduler tests: 64 passed. Existing War handoff suite: 23 skipped; those skips are not playback evidence.
- Draft source and review results are recorded by their owners in the linked files before the integrated checkpoint is pushed.
