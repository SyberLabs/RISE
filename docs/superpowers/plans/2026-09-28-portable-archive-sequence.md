# Portable Archive Sequence Implementation Plan

> **For agentic workers:** execute this plan task by task with failing tests before production changes. This task stays with one implementer because the transfer contract and Vault door share state.

**Goal:** A saved authored sequence using only built-in Archive text and built-in audiovisual capabilities can be exported, inspected, accepted, and played in another browser without an account.

**Architecture:** One `rise.portable-sequence.v1` envelope wraps the existing Experience Program v1. A small core module re-derives Archive work identity and rights, resolves exact extents, checks source text equality at export, admits the program through the existing context gate, and creates a proposed Workshop project at import. Vault owns file selection, visible review, explicit acceptance, local save, and download. No source body or media bytes enter the file.

**Tech Stack:** Vite vanilla JavaScript, Vitest, Playwright, Web Crypto, existing Archive/Scriptorium/Workshop modules.

**Spec:** MasterMind `docs/RISE_PRODUCT_LOOP_2026-09-28.md` at merge `92c93d0066fab0c785c1ada0988946473e18717a`.

## Global constraints

- `SyberLabs/RISE` main baseline `8f65333e9188c6c69399af3ae63b8c268e2861da`.
- No extra model provider, account, server, external asset, local text/media export, program schema, or editor.
- Import always becomes `proposed`; no portable claim grants approval.
- Reject missing or changed Archive source identity, unsupported rights/cues, corrupted or oversized input, and duplicate local import. Never substitute source text.
- Store only on a separate explicit accept gesture. File selection and inspection must not mutate Vault.
- UI must say the creator credit is declared and the Archive rights basis is United States specific.

---

### Task 1: Portable contract and exact source admission

**Files:** create `src/core/portable-sequence.js` and `src/core/portable-sequence.test.js`.

**Interfaces:** `exportPortableSequence(project, { creatorCredit }) -> Promise<string>` returns JSON; `inspectPortableSequence(text) -> Promise<{ id, title, creatorCredit, sources, project }>` returns an unpersisted proposed Workshop project. Both throw `PortableSequenceError` with a stable code and actionable message.

- [ ] Write a fixture with an Archive extent, movement, built-in procedural visual and soundscape, then write failing round-trip and rejection tests. The test must assert no `source.data` or prompt text in the exported JSON and that imported authority is `proposed`.
- [ ] Run `vitest run src/core/portable-sequence.test.js`; confirm failure because the contract is absent.
- [ ] Implement the minimum versioned envelope using `validateExperienceProgram`, `programSourceIds`, `exportCuratorContext`, `importExperienceProgram`, `resolveProgramLibrarySources`, `assertResolvedProgramQuotations`, `releaseArchiveMetadata`, and `contentHashOf`.
- [ ] Run focused tests and add failing cases for source edition/revision mismatch, altered source data at export, local source/media, personal/remote capability, unknown field, malformed/oversized JSON, and duplicate identity.
- [ ] Implement each refusal and run focused tests green. Use exact Archive `sourceRevision` (derived from input digests), not a caller-supplied version label.

### Task 2: Vault export and import door

**Files:** modify `src/components/Vault.js` and `src/components/Library.css`; create `src/components/Vault.portable.test.js`.

**Interfaces:** core contract from Task 1. Vault keeps `pendingPortable` only in memory until the reader presses **Keep in this browser**. `MemoryCore.saveWorkshopBlueprintAsync` is the sole persistent write.

- [ ] Write failing DOM tests for export action on eligible saved score, ineligible score refusal, file inspection without save, cancellation, explicit accept, duplicate import, and safe text display.
- [ ] Run focused Vault test and confirm missing actions fail.
- [ ] Add a small Custom-section import file control, review panel, explicit keep/cancel actions, and an export action on eligible authored cards. Use existing `downloadJsonFile` and Vault's event delegation.
- [ ] Run focused tests green and inspect keyboard focus and narrow layout.

### Task 3: Real browser and release

**Files:** create `e2e/portable-sequence.spec.js`; update `docs/specs/ARCHITECTURE.md` only if a new boundary needs documenting.

- [ ] Write an end-to-end test that creates or seeds a real saved authored program in browser A, exports it, imports in clean browser B, reviews and accepts it, then opens Workshop preview and Chamber play. Include tampered revision and reduced-motion cases where observable.
- [ ] Run the browser test, inspect actual visual frames and listen to audio where possible. Report limits explicitly; never infer quality from a timer or nonzero samples.
- [ ] Run focused unit tests, full required repository gates, check the generated architecture diagram, commit, open PR, satisfy protections, merge, deploy using existing path, and verify live behavior.
