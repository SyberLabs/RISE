# Recipient passage remix implementation plan

**Owner:** RISE. **Goal:** A recipient of an imported portable score can change one passage's built-in visual and soundscape, preview it, cancel or keep it as a new child, and carry that child to another browser with its parent reference, source bounds and their own credit.

**Question and deletion:** `Vary as new` (2026-09-28) changed only title and pace. The Workshop never recompiles a `proposed` program (`prepareSessionPayload`), so its lane editor looked editable for imported scores and changed nothing that played or was saved. Do not add a timeline editor, a new cue vocabulary, a schema version, media upload, accounts or a remote store. Replace the inert editor for proposed scores; do not make it work.

1. `remixablePassages(program)` lists each procedural visual clip that shares its exact anchor with a soundscape clip. `remixPassage(program, id, { collection, soundscapeId })` swaps those two cues and returns the result of the same `portableProgram` + `importExperienceProgram(context)` gates an import uses. Anchors, sources and other cues are untouched, the input is not mutated, the sound keeps its gain and fade, an unchanged choice returns the same program. Child identity already hashes the program, so a changed child gets a new ID.
2. For a proposed score the Workshop score surface shows a Remix panel. On a variation: passage, visual (built-in procedural patterns) and soundscape pickers, Reset to original, and Keep as new child (disabled until the program differs from the parent). On an opened import: lineage and `Vary as new`. The phone Scene Stack steps aside for proposed scores.
3. Credit: the child carries no creator credit until the remix author enters one at export; the panel names the parent and its declared credit as unverified.
4. Verify: unit tests for the operation and the Workshop flow; a browser spec that imports the quiet example, remixes passage 1, previews, cancels, keeps, exports, imports in a clean context and observes the changed soundscape and visual; phone and reduced-motion check. Audible quality needs a human listening check.

**Rollback:** Revert the PR. Exported children remain valid `rise.portable-sequence.v1` files; any build that reads the optional `parent` field (#291 onward) imports them, because the format did not change.
