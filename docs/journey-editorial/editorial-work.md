# Journey editorial work

Status: source-bound draft prepared, unpublished. Branch: `codex/rise-journey-editorial`. Discussion: [draft PR #174](https://github.com/SyberLabs/RISE/pull/174).

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
- Integrated local validation: 77 focused tests passed across the draft, compiler, scheduler, session, and architecture contracts. Production build, hygiene, Kokoro/Sharp compatibility, and first-load budget passed (58.4 KB Brotli against 64 KB).
- Review caught a Bryant excerpt ending at a comma before the next clause. The author shortened it to Hector's complete reply and recomputed its checksum rather than editing the source punctuation.
- The draft has two source-bound movements with explicit stillness and silence. No model calls or extra runtime dependencies were needed. This is a demonstrated implementation path, not a measured claim of time savings.
- Editorial approval and full browser playback remain outstanding. Source certification has not been performed. The standing candidate-serving policy is unchanged.
