# Journey editorial validation

Status: focused draft validation passed; the draft remains unpublished and unapproved.

## Scope and boundary

This validation concerns the unpublished `Heaven and Household` draft only. The Journey card list remains empty, and a draft status must continue to make `createJourneyHandoff` refuse launch. The archive is serving prepared candidate editions under the current `RELEASE_SERVES_UNCERTIFIED` decision, but neither work has a certification record: `src/content/archive/certifications.json` is empty. That is distinct from resolving a draft against the exact bytes in the repository.

## Source identity checked

The committed release inventory identifies the two candidate editions as:

| Work | Edition identity | Revision | Current certification |
| --- | --- | --- | --- |
| *Paradise Lost* | `standard-ebooks:john-milton/paradise-lost` | `sha256:e1f747c0f0e2d1b13433f6b2f51c9be28e53fe496c0ebb11904b8ef0c26c467e` | Candidate; no matching certification record |
| *The Iliad* | `standard-ebooks:homer/the-iliad_william-cullen-bryant` | `sha256:0695d06ded3af9669b8f314f1ae76e8186b1d67e81b6a726992a8c5ed88cf143` | Candidate; no matching certification record |

These identities were read from `src/content/archive/release-inventory.json`; `src/content/archive/certifications.json` currently contains `{}`. `RELEASE_SERVES_UNCERTIFIED` is `true`, so the default reader-facing archive includes these candidates. A certified-only archive selection would currently contain no works. Do not describe candidate status as certification.

The source report and authored passage records are tracked separately in [sources.md](sources.md). The committed-content resolver confirms each locator against these editions. Milton's excerpt begins at a sentence start and ends at a period. The Bryant route begins with Andromache's speech and closes Hector's reply at “I hear thy cries as thou art borne away!” The following lines begin a new beat in which he embraces his son and leaves; the selected excerpt therefore does not end at the earlier comma boundary.

## Checks completed so far

- Read the Journey handoff and compiler paths. Handoff resolves passages, checks supplied expected checksums, compiles again with text-derived passage metrics, and carries source edition, revision, and checksum into provenance.
- Read archive certification and release selection code. The underlying works are present in the admitted archive; candidate text is available on the default reader path, while the certified-only set is empty.
- Ran the focused test file with `node_modules/.bin/vitest.cmd run src/content/journeys/heaven-and-household.test.js`: 1 file and all 5 tests passed. It confirms both current excerpts resolve, their authored SHA-256 pins match, the source edition IDs and revisions match the archive inventory, both sources survive compilation, the movement boundary survives handoff and session compilation, drift is refused, and the actual `draft` manifest is unlaunchable.
- Read the full Bryant excerpt in its surrounding source context and checked the current source packet at [sources.md](sources.md).
- The parent ran the focused draft test alongside `system-design`, Journey compiler, scheduler, and Journey session tests: 77 tests passed in total. The parent also reported a successful production build, first-load size of 58.4 KB Brotli against a 64 KB budget, and successful `security:compat` check. The 77-test combined run was repeated after the final manifest wording changes. Build and first-load checks cover the unchanged public app; this draft is not imported by its catalog.

## Checks not yet run

The tests exercise source resolution, compilation, handoff, and the canonical session timeline. They do not exercise Chamber playback, browser interaction, or human editorial approval. No browser or live playback test has been run. The manifest is not in the Journey catalog, and this validation makes no publication or certification claim.

No claim of playback, archive certification, or publication follows from compiler structure or hash matching alone.
