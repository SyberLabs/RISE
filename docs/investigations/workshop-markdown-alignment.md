# Workshop Markdown source alignment failure

## Diagnosis

The reported phrase atom 48 and word atom 242 failures reproduce with the original supplied Markdown text alone. No media loading or runtime clock is needed. The first failing token is the compact table separator `|---|---|---|---|---|`.

Workshop supplies source text and the canonical Experience Program to `compileSession`. The compiler resolves media endpoints, inserts hard cuts, and calls `chunkText`. Display cleanup replaces bars with spaces. Then `compileSourceSpans` calls `alignSourceAtoms` to stamp source coordinates and clip membership before pacing and playback.

The old aligner deleted bars inside each whitespace token. Five displayed `---` tokens were therefore compared with one `---------------` token, producing `SOURCE_SPAN_ATOM_ALIGNMENT`. The durable-save message reports persistence, not successful compilation. This failure is deterministic and precedes audiovisual playback.

## Why this class recurred

Commit `746d9a7` fixed a previous divergence: word chunking drops standalone punctuation while source alignment retained it. Its regressions included standalone bars, but not multiple display fragments inside one raw token. This is another instance of the duplicate vocabulary problem documented in PROJECT-KNOWLEDGE section 2.1.

## Correction and protections

The aligner now splits raw tokens at bars while retaining each original whitespace-token index and each fragment's exact UTF-16 coordinates. Already-cleaned atom content is compared directly. Source text and saved anchors are unchanged; mismatches are still refused.

The source-span contract remains intact: authors store source ranges and quote fingerprints, never atom IDs. Existing checks still refuse edition drift, invalid boundaries, empty playable spans, and conflicting same-track ownership. Images, video, audio beds, and swell events share the corrected coordinate mapping.

Regression coverage includes four chunk modes, compact Markdown headers and rows, exact fragment character/token coordinates, Unicode, and every contiguous selection containing display text in a small table. Integration tests check visual cue selection after compiler recutting. All nine added test cases fail against the original implementation.

For future display-preparation changes, require a chunker-to-source alignment regression in every mode and a scored compilation test. Do not add another independent text cleaner. If transformations eventually require a broader redesign, carry coordinates through chunking instead of accumulating fuzzy alignment repairs. That redesign is not needed for this demonstrated defect.

## Verification and limits

- The final repository run passed 3,185 tests across 289 files; 63 environment- or review-gated cases were skipped.
- The unchanged exported score compiled against the supplied text in word (1,162 atoms), phrase (278), sentence (161), and paragraph (119) modes.
- Replay used stand-in image/video metadata because the JSON contains references rather than private media bytes. It verifies compilation, not media decoding or playback synchronization.
- The production build passed the Workshop selection, Workshop media-persistence, and smoke browser corridors: 10 passed and 3 intentional archive-review cases skipped.
- Transaction regressions cover shared/imported media, failed metadata commits, concurrent tabs, edits during save and launch, near-quota lease publication, back/forward cache restore, deferred deletion, and orphan recovery after transient storage failures.
- Nine alignment regression cases failed against the original code. Final independent review found no remaining actionable P0, P1, or P2 issue in the Workshop paths examined.
- No private text or exported score is included in regression fixtures.
- This is a local fix, not a deployment. A finite matrix cannot prove arbitrary future text transformations safe.
