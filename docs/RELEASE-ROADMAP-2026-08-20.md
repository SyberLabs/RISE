# RISE release corridor — execution ledger

**Authority:** Release Roadmap v2, 2026-08-20
**Rule:** a green build is necessary, never sufficient. Editorial, media, device,
and comprehension gates fail closed.

## Current state

| Corridor | State | Repository evidence / next gate |
|---|---|---|
| Canonical Shelf | In progress | The 15 exact Standard Ebooks candidates are pinned, and all 15 pass the automated text audit. Certification dossiers are generated without fabricating human verdicts. Public shelf remains empty until 10–15 human certifications are recorded. |
| Textual form | In progress | Structured editions preserve human division labels and verse line breaks; provider exposes named poems/chapters. Explicit stanza/line coordinate objects remain post-launch substrate work unless a Keystone defect requires them. |
| Source consumers | Implemented | Library, Scriptorium context, and Workshop Archive provider share the certification-gated release projection. Development/browser review requires an explicit review environment. |
| Ordinary reading | Implemented | Living Text defaults on, Chamber Page opens elongated, and exact-edition Continue/Next Division carries reader-owned configuration. |
| Interface semantics | Implemented | Gallery / Background Flash / Foreground Flash labels; tone-specific controls are hierarchical. `Gateway` remains pending acoustic judgment. |
| Progressive Reveal | Implemented | `revealMode` is independent of Recitation; all four voice/reveal combinations compile; reduced motion reveals instantly. |
| Keystones | In progress | The editorial set is locked to the complete “Tintern Abbey,” *Meditations* Book II, and *Metamorphoses* Book XIII · “Story of Polyxena and Hecuba.” Exact manifests, stable `/keystone/*` routes, cold reload, browser Back/Forward correspondence, and complete phrase-aligned voice coverage for all 665 phrases are implemented. The byte-bound acoustic review is prepared; listening acceptance and source certification remain human gates. Tintern uses the existing pinned `aic-landscapes` collection. |
| Mobile-safe | Browser verified; device evidence required | The complete 88-case browser matrix is green (72 pass, 16 deliberate deferrals). Responsive Keystone threshold, Workshop touch selection, and Page geometry pass in emulation. Real-device matrix remains a witnessed release gate; Workshop is desktop-full/mobile-safe, not phone-equivalent. |
| Render/distribution | In progress | Workspace-local FFmpeg resolution, real H.264 kernel tests, and a reproducible portrait/representative/landscape Chamber proof matrix are implemented. All three final-scale packages verify with no degradation or unresolved rights. The production build now proves byte-identical inclusion of all 877 same-origin voice assets; Keystone-specific render packages wait on source certification. |
| Release hardening | Machine corridor green; human gates open | `npm run release:check` is the repository admission report. Unit (2,119 pass / 58 skip), production build, browser (72 pass / 16 deliberate skip), render proofs, 877 source WAVs, and all 877 byte-identical distribution copies are green. Certification, acoustic decisions, witnessed devices, and stranger results still fail closed. The human procedure is `docs/RELEASE-ACCEPTANCE-PROTOCOL.md`. |
| Public debut | Blocked | Landing threshold exists, but public launch buttons remain disabled until the exact source, visual, voice, and human gates pass. |

## Deliberate deferrals

- broad Gutenberg rehabilitation and physical source deletion;
- illustrated-book / Focal reconstruction;
- additional Journeys, scientific papers, Solarium, RISE Chain;
- full autonomous publishing and social delivery;
- full Atrium mobile redesign;
- Page-mode lowering beyond the bounded, release-critical fixes already made.

## Release commands

```text
npm run test:run
npm run build
npm run test:e2e
npm run verify:render -- <render-package-dir>
npm run release:prepare-certification
npm run release:prepare-acoustic-review
npm run release:record-acoustic-review -- --input <downloaded-json>
npm run release:voice:plan
npm run release:render:proof -- --ffmpeg <absolute-ffmpeg-path>
npm run release:check
```

`release:check` is expected to exit nonzero while any machine-verifiable or
declared human gate remains open. Do not weaken the command to obtain green;
close the named evidence gap.

The first Windows render-environment proof uses FFmpeg 9.0.1
(`ffmpeg.exe` SHA-256
`72A489ECCD008C2EC2C0A5856C5C75BC3D8BBFA90166C4566865C246445E6AA3`).
The binary is intentionally not committed. Set `RISE_FFMPEG_PATH` or pass
`--ffmpeg`; the render adapter must not depend on an undocumented machine
`PATH`. The release-proof command defaults to final scale. Use `--scale 0.1`
only for a bounded smoke proof, never as final distribution evidence.

Human results belong in `release-evidence.json`. Acoustic evidence is admitted
only when its exported identity matches the exact current WAV bytes and it
contains a passing decision for every expected Keystone phrase. A device record is admitted
only with the required browser-family id, `passed: true`, a reviewer, and a
completion timestamp. Stranger testing requires at least three participants,
all three corridor outcomes, a reviewer, and a completion timestamp. These are
witness attestations, not values the automated suite may generate.

## Immediate order of execution

1. Conduct and record 10–15 exact-edition human certifications, including all
   three Keystone sources. The *Metamorphoses* review must explicitly adjudicate
   the inherited synopsis wording “when she if metamorphosed into a bitch” in
   Book XIII; any approved correction must create a new source revision and
   invalidate/regenerate the affected voice and acoustic evidence.
2. Complete the 665-phrase acoustic review and import its exact decision ledger
   for `sha256:41845f375b47faedc2fe8509286dbf00e9913b05a07d9dba577ccacaed328f21`.
3. Run the witnessed real-device matrix, then stranger testing. The complete
   automated browser matrix is already green.
4. Admit the public debut only when the release checker and witnessed gates
   agree.

## Completed in this tranche

- Confirmed the release shelf already contains 15 exact candidate editions;
  no shelf-expansion work was invented.
- Corrected the Keystone landscape identity to the existing admitted
  `aic-landscapes` collection.
- Locked the release selections to *Meditations* Book II, *Metamorphoses*
  Book XIII · “Story of Polyxena and Hecuba,” and the complete “Tintern Abbey.”
- Built and checkpointed complete exact-atom voice coverage: 267 Meditations,
  237 Metamorphoses, and 161 Tintern Abbey phrases.
- Added binary asset treatment, source/build byte-integrity admission, and a
  665-phrase review surface whose human decision ledger is bound to the exact
  voice bytes and invalidated by regeneration.
- Added explicit FFmpeg resolution, a pinned local environment record, real
  H.264 tests, and three verified final-scale Chamber proof packages (portrait
  opening, 12-second representative portrait, and landscape opening).
- Insulated the headless Chamber stage from repository writes and corrected
  excerpt sidecars to record encoded—not parent-plan—duration and frame count.
- Replaced Playwright's orphan-prone Windows shell server chain with a Vite
  lifecycle owned by global setup/teardown, then ran the complete matrix to
  72 passes, 16 explicit deferrals, and zero failures.
- Rebased stale browser fixtures onto the 15-work candidate shelf without
  weakening release gates: Middlemarch now exercises chapter authoring,
  Oedipus Rex exercises direct Scriptorium admission, and offline Gallery
  verification accepts only a complete reveal or the designed transparent
  absence state.
