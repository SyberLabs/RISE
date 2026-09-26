# Journey editorial validation

Status: draft source audit; runtime validation is pending.

## Scope and boundary

This validation concerns the unpublished `Heaven and Household` draft only. The Journey card list remains empty, and a draft status must continue to make `createJourneyHandoff` refuse launch. The archive is serving prepared candidate editions under the current `RELEASE_SERVES_UNCERTIFIED` decision, but neither work has a certification record: `src/content/archive/certifications.json` is empty. That is distinct from resolving a draft against the exact bytes in the repository.

## Source identity checked

The committed release inventory identifies the two candidate editions as:

| Work | Edition identity | Revision | Current certification |
| --- | --- | --- | --- |
| *Paradise Lost* | `standard-ebooks:john-milton/paradise-lost` | `sha256:e1f747c0f0e2d1b13433f6b2f51c9be28e53fe496c0ebb11904b8ef0c26c467e` | Candidate; no matching certification record |
| *The Iliad* | `standard-ebooks:homer/the-iliad_william-cullen-bryant` | `sha256:0695d06ded3af9669b8f314f1ae76e8186b1d67e81b6a726992a8c5ed88cf143` | Candidate; no matching certification record |

These identities were read from `src/content/archive/release-inventory.json`; `src/content/archive/certifications.json` currently contains `{}`. `RELEASE_SERVES_UNCERTIFIED` is `true`, so the default reader-facing archive includes these candidates. A certified-only archive selection would currently contain no works. Do not describe candidate status as certification.

The source report and authored passage records are tracked separately in [sources.md](sources.md). Resolution must demonstrate that each locator and excerpt maps to the intended material in these exact editions; a work ID or compiler result alone does not establish that.

## Checks completed so far

- Read the Journey handoff and compiler paths. Handoff resolves passages, checks supplied expected checksums, compiles again with text-derived passage metrics, and carries source edition, revision, and checksum into provenance.
- Read archive certification and release selection code. The underlying works are present in the admitted archive; candidate text is available on the default reader path, while the certified-only set is empty.
- Read the authored Journey's new test file. It currently describes real passage resolution, checksum pinning, compiler source membership, and refusal to launch a draft.

## Checks not yet run

The manifest file is not present yet, so its locators, quotations, exact resolved words, pinned hashes, edition assertions, and draft status cannot be verified. No test command has been run. Once the manifest lands, the bounded validation is the new Journey test only; it should prove:

1. Both passages resolve against the committed archive bytes with the stated edition identities and exact excerpt bounds.
2. Each resolved excerpt checksum matches the authored pin; changing the expected checksum makes handoff refuse for drift.
3. The compiler and handoff preserve source order and both movement/source identities, including the authored boundary between the movements.
4. The `draft` manifest remains unlaunchable through the public handoff function.

This note records inspection only until those checks actually run. No claim of playback, archive certification, or publication follows from compiler structure or hash matching alone.
