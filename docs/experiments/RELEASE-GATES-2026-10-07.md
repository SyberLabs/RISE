# Reader release gates, reconciled — 2026-10-07

RDR-010. The fail-closed release report (`npm run release:check`, `scripts/check-release-readiness.mjs`) run on exact `main` `8ef95ec9`, and the human gate records read against it. Nothing here weakens a gate; it says where each one stands. The owner has deferred witnesses until the product is provisionally ready, so the human gates are expected to be open.

## How it was run

A worktree at `8ef95ec9`, Node 22.23.2, ffmpeg 8.1.2. The run needs the content plane and the recitation audio present, as AGENTS.md says: `npm run content:build`, `npm run audio:hydrate` (restored from `rise/audio-assets-opus` at `1373a337`), then `npm run build` so the built distribution is compared with the restored source. Before hydration the same report counted 1,941 voice issues; before the rebuild it counted the distribution as incomplete. Both were the checkout, not the release.

## The report, verbatim

```
[PASS] RELEASE_NODE_SUPPORTED: Node 22.23.2 satisfies the pinned release toolchain.
[BLOCKED] RELEASE_CANONICAL_SHELF_SIZE: The public shelf has 0 certified works; release requires 10–15.
[BLOCKED] RELEASE_KEYSTONE_MEDITATIONS: Meditations is not release-admissible.
  - KEYSTONE_SOURCE_UNCERTIFIED: The exact source edition awaits human certification.
[BLOCKED] RELEASE_KEYSTONE_METAMORPHOSES: Metamorphoses is not release-admissible.
  - KEYSTONE_SOURCE_UNCERTIFIED: The exact source edition awaits human certification.
[BLOCKED] RELEASE_KEYSTONE_TINTERN: Tintern Abbey is not release-admissible.
  - KEYSTONE_SOURCE_UNCERTIFIED: The exact source edition awaits human certification.
[PASS] RELEASE_FFMPEG_AVAILABLE: ffmpeg version 8.1.2-full_build-www.gyan.dev
[BLOCKED] RELEASE_VOICE_ASSETS_INVALID: 779 source voice-pack integrity issue(s) must be resolved.
[PASS] RELEASE_VOICE_DISTRIBUTION_COMPLETE: The built distribution contains byte-identical copies of all 877 voice assets.
[HUMAN] RELEASE_ACOUSTIC_ACCEPTANCE: Review all 285 exact Keystone phrases with release:prepare-acoustic-review, resolve every defect, and record evidence.
[HUMAN] RELEASE_REAL_DEVICE_CERTIFICATION: Witnessed real-device evidence remains for: iphone-safari, android-chrome, desktop-chrome, desktop-safari, desktop-firefox.
[HUMAN] RELEASE_STRANGER_TESTING: Record at least three witnessed, unprompted corridor tests in release-evidence.json.
Result: 3 pass, 5 blocked, 3 human gates.
```

The 779 voice issues are all one kind, `VOICE_REVIEW_ENTRY_MISSING` (Meditations first): phrases with no acoustic-review entry. They are the acoustic gate seen from the asset side, not damaged audio; the built copies are byte-identical.

## The human gate records

| Record | State at `8ef95ec9` | What closes it ([protocol](../RELEASE-ACCEPTANCE-PROTOCOL.md)) |
|---|---|---|
| `src/content/archive/certifications.json` | 0 certifications | §1: certify 10–15 exact editions, the three keystones among them |
| Acoustic review (`release-evidence.json` `acousticReview`) | none | §2: listen to all 285 keystone phrases, resolve defects, record the reviewer |
| `release-evidence.json` `realDevices` | none of the five devices | §3: witnessed runs on iPhone Safari, Android Chrome, desktop Chrome, Safari, Firefox |
| `release-evidence.json` `strangerTesting` | 0 tests | at least three witnessed, unprompted corridor tests |

## What this means

The machine side of the Reader release passes on this candidate. Every remaining blocker is a human gate: certification, listening, devices and strangers. They belong in the final witness pass the owner has asked for, together with LIVE-004, RDR-007, RDR-008 and RDR-009, run on one exact release.
