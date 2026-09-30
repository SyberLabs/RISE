# Recipient variation implementation plan

**Owner:** RISE. **Goal:** A recipient can derive a new local title/pace version of an imported portable score, keep the original unchanged, and carry the child to another browser with a bounded parent reference.

**Question and deletion:** Workshop already edits title and reading pace. Do not add an editor, account, feed, remote store, or second score schema. Its proposed score bypasses score recompilation, so do not imply this slice edits visual/audio cues or grants the parent creator's approval.

1. Extend the existing `rise.portable-sequence.v1` envelope with optional `{ parent: { id } }`. Preserve the old ID algorithm when parent is absent. For a child, derive ID from parent, score, source refs, title, and reading pace. Validate parent shape and bounded ID, and import as proposed with an unverified structural parent reference. Verify existing files still round-trip, malformed parents refuse, and children with different pace have distinct IDs.
2. Add `Vary as new` to imported Vault cards. Open the same Workshop surface as an unsaved draft whose provenance names the parent portable ID and carries no creator credit. Saving must create a distinct local ID with `createOnly`; leaving without saving must not write a Vault card. Keep Preview/Edit wording truthful. Verify original project equality before and after child save and cancellation.
3. Show the parent reference and unverified relationship on local cards and import review. Export the child through the existing portable action. Verify clean-browser parent/title/pace/authority/credit round-trip and duplicate refusal. Run focused tests, browser transfer, architecture/build gates, exact-head review, PR and protected release; verify live artifact and visual workflow. Audible quality remains a separate observation.

**Rollback:** Revert the new PR. Existing imported parent cards and v1 files remain available; child files with the optional parent field require the new reader.
