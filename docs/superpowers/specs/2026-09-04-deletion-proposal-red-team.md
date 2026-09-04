# Red-team prompt — RISE deletion / storage / docs-locality proposal

**Status:** Record of a recursive red-team, plus the prompt that produced it.  
**Date:** 2026-09-04  
**Subject:** the first-principles deletion proposal discussed in the SyberLabs org audit and the RISE-specific counter-proposal that followed.  
**Stop rule:** a round that introduces **no new unmitigated finding**. Residual risk may remain only when it is named, owned, and accepted.

This file lives under `docs/superpowers/` so it is **not** wiki-published. It is process, not a product contract.

---

## How to use this file

1. Give an analyst **Part A** (the prompt) and **Part B** (the frozen proposal).
2. They must execute **Part C** (the protocol) until the stop rule fires.
3. **Part D** is one completed run against this tree (commit `93abca2` / then-current `main`). Re-run Part A on a later tree; do not quietly edit Part D to match later opinion — supersede it with a new dated section.

---

## Part A — the prompt (copy this)

You are a hostile production reviewer. Your job is not to improve the proposal’s tone. Your job is to **break it**.

### Subject

Red-team the proposal in **Part B** of `docs/superpowers/specs/2026-09-04-deletion-proposal-red-team.md` (or the same proposal pasted below). It is a cleanup of the RISE repository: move generated Keystone recitation audio out of Git, keep the Kokoro **capability**, split markdown into public vs local, and delete or quarantine frozen surfaces (Journeys, vendored agent skills, dated Superpowers plans, uncited vision docs). It also inherits claims from a SyberLabs org-wide “first-principles deletion audit.”

### What you are allowed to use as ground truth

- The repository tree and tests, not the audit’s line counts.
- `docs/specs/ARCHITECTURE.md` axioms: nothing leaves; reverent degradation; provenance travels with the work; structure is read, never inferred.
- Recitation decision §8.5: Kokoro is **build-time**; the reader plays **same-origin** WAVs; acoustic evidence binds a human verdict to **exact bytes**; delivery format is **open**.
- Release admission: `npm run release:check`, `docs/RELEASE-ACCEPTANCE-PROTOCOL.md`, `release-evidence.json`.
- Recurring defect law (`docs/PROJECT-KNOWLEDGE.md` §2.1): a vocabulary living in two places where only one learns a new word.

You may not invent backends, accounts, or runtime TTS. You may not “fix” a finding by substituting silence for a promised Keystone voice unless the proposal **explicitly** accepts that as the public behavior.

### Protocol — recurse until the stop rule

Work in numbered rounds. Each round has four columns: **Attack**, **If true, what breaks**, **Does the current proposal already stop it?**, **Required change or accept**.

**Round 1.** Attack the proposal as written. Enumerate failures of confidentiality, integrity, availability, safety, provenance, release gates, developer loop, and stranger UX.

**Round N (N ≥ 2).** Do **not** add new product ideas. Attack **only** the mitigations and “acceptances” from round N−1. Preferred moves:

- bypass the control (wrong layer, wrong time, wrong machine)
- split-brain (Git vs object store vs CDN vs `dist/`)
- fail-open (missing bytes → green CI, or green CI → mute Keystone)
- fail-closed that bricks local `npm run dev` / Cloud Agent / forks
- two vocabularies (local markdown vs `docs/` contracts)
- deleting a frozen room while a **primitive** is still imported
- history: `.gitignore` does not shrink a clone
- “preserve capability” smuggling the model into the browser bundle

**Stop** when a full round produces **zero new unmitigated findings**. Every leftover item must sit in the **Accepted residual register** with:

| Field | Required |
|---|---|
| Risk | one sentence |
| Why further deletion/control is worse | first-principles, not taste |
| Owner | a role or named person, not “the team” |
| Review trigger | what event forces reopening |

**Forbidden stop conditions**

- “looks fine”
- “we’ll be careful”
- “tests will catch it” (name the test or write the gap)
- “GitHub will host it” without a fetch identity and a failure mode
- claiming **no residual risk** — that is a finding against the analyst

### Output shape

1. Round tables (1…N)
2. Hard constraints the proposal must adopt (normative; merge these into the proposal or reject the proposal)
3. Accepted residual register
4. Explicit statement: **Stop rule fired at round N** because …

---

## Part B — proposal under test (frozen)

Frozen from the 2026-09-04 conversation. Later edits to RISE do not silently rewrite this block.

### B.1 Inherited audit claims (external)

SyberLabs org audit, snapshot of public repos on 2026-09-03, RISE at `93abca2` (~355 MB). Scarce resource: **attention**, not disk. Delete frozen, speculative, copied, and generated surfaces. For RISE it recommended:

- Delete the Journeys subsystem (~6.8k lines cited): compiler and room, zero published Journey, scores that no longer resolve.
- Delete `.agents/` (~10k lines cited): generic Superpowers machinery; keep a concise `AGENTS.md`.
- Delete `docs/superpowers/` (~3.8k lines cited): dated plans; Git retains history.
- Delete five vision files (~1.6k lines cited): `SCRIPTORIUM-STRENGTHENING-SPEC.md`, `TEXT-ATTUNED-IMAGERY-SPEC.md`, `DREAMS.md`, superseded `LIBRARY-SPEC.md`, implemented `VISUAL-NAVIGATOR-MIGRATION.md`.
- Delete `public/audio/` (~883 files, ~240 MB cited): publish media via object storage or release assets; keep checksum/provenance in Git.
- Shrink content-plane: stop generating JS modules for canonical works; JSON/text + metadata only.
- Put the Scriptorium surface behind a 30-day proof-of-use gate (~11k lines cited).

### B.2 RISE counter-proposal (what we actually intend)

**Keep the Keystone recitation capability.** The 877 WAVs under `public/audio/recitation/af_heart/` are Kokoro `af_heart` output covering 547 exact Keystone phrases. Readers must still get phrase-aligned speech on the three Keystones. Kokoro remains a **build-plane** tool (`scripts/build-voice-pack.mjs`). The reader app must **not** grow a model host, WASM exception, or third-party script.

**Move generated speech bytes out of Git.** Retain in Git: voice-pack builder, Keystone voice plan, `voice-pack.manifest.json` (or equivalent checksum ledger), and `release:check` identity (`sha256:` over the pack). Materialize WAVs at **build/release** into the same same-origin paths Netlify already caches (`/audio/recitation/*`). Do not fetch audio from a third origin **at runtime**.

**Docs locality, not a second canon.**

| Tier | Fate |
|---|---|
| A — load-bearing contracts/records | Stay public (`ARCHITECTURE`, release corridor/protocol, cleansing **vocabulary**, recitation contract, cited Scriptorium/Workshop specs) |
| B — dreams, uncited briefs, interview notes | Local or private clone; not wiki |
| C — dated Superpowers plans, completed migration writeups once folded | Delete from tip; Git history keeps them |

**Journeys:** quarantine or delete the **unpublished room and dead scores**. Do not blindly delete `journey-compiler` primitives if Chamber/Scriptorium still import them.

**`.agents`:** do not strip until `AGENTS.md` / workspace rules no longer require `./.agents/skills`. Prefer org-level or local install; the product repo must not lie about where skills live.

**Content-plane finish:** keep hash-addressed JSON at runtime (already built). Next cut is **source** format — works as data, not JS modules — in a separate change from the media move.

**Execution order:** (1) media out of Git with fail-closed materialize, (2) docs A/B/C split, (3) Journeys + agent-skill amputation with import graph proof, (4) content-plane source format.

**Non-goals:** weakening `release:check`; shipping runtime Kokoro; emptying the public shelf by accident; claiming human acoustic/device/stranger gates are closed.

---

## Part C — round protocol (checklist)

For each round, create a todo and complete it in order:

1. List attacks that could still fire **given the previous round’s controls**.
2. For each, write the four columns.
3. Promote surviving attacks to **hard constraints** or **accepted residual**.
4. If any new unmitigated item exists, start the next round.
5. If none, write the stop statement and freeze the residual register.

---

## Part D — executed run (2026-09-04)

Tree pin: `origin/main` at `93abca2` (navigator foot/pane). Voice pack on disk: **877** WAVs, **240 MB**, identity expected by `release:check` as `sha256:fc52f2a0bef822fc40941479ffa5482d4f6d0b00e3438be2708a4e81c2edfbf3` when the content plane is built. Architecture §8.5: delivery format **open**; mechanism **settled**.

### Round 1 — attack the proposal as written

| Attack | If true, what breaks | Stopped already? | Required change or accept |
|---|---|---|---|
| R1.1 Runtime fetch of WAVs from object storage / GitHub Releases | CSP `connect-src` has no media host; “nothing leaves” and recitation become a third-party dependency; acoustic bytes can change under a URL | **No.** B.2 says “move storage” without pinning **when** fetch happens | **Hard constraint H1:** materialize at build/release only; reader requests remain same-origin `/audio/recitation/*` |
| R1.2 `.gitignore` the WAVs but leave Git history | Clones stay ~350 MB; attention cost barely moves | **No.** Audit measured pack size, not packed history | **H2:** either `git filter-repo` (or equivalent) **or** accept that *new* clones shrink only after a history rewrite; document the choice |
| R1.3 CI / Cloud Agent / fork has no object-storage credentials | `release:check` already **throws** if the content plane is missing; missing WAVs become `VOICE_ASSET_MISSING` or a crash; Preview deploys ship mute Keystones | **No.** Fail-closed is correct for **release**, fatal if **every** PR cannot materialize | **H3:** public PR CI fetches a **content-addressed** artifact (hash in Git) with no privileged rewrite; if fetch fails, the voice **distribution** gate is blocked, not skipped |
| R1.4 Split-brain: manifest in Git, bytes elsewhere, `dist/` a third copy | Acoustic ledger binds `manifestHash`; a regenerated pack with the same phrase keys but different PCM invalidates human review **or** silently ships unreviewed speech | Partial: `inspectReleaseVoiceAssets` hashes files | **H4:** the Git ledger lists per-file `sha256` + byte length; materialize must refuse a tree that does not match; regeneration is a new review identity (already true) |
| R1.5 “Preserve Kokoro capability” interpreted as shipping `kokoro-js` + weights to the browser | Reopens the measured-rejected path (ARCHITECTURE §8.5); CSP, size, non-certifiable speech | B.2 forbids it in prose | **H5:** production CSP stays `script-src 'self'` with no WASM/model host; Kokoro remains `devDependencies` / builder-only; test already in `csp.test.js` — keep it |
| R1.6 Delete `public/audio/` including `click.wav` / `hiss.wav` / drones | UI/ambient sound dies; unrelated to Keystone recitation | Audit said delete the folder | **H6:** recitation pack only (`public/audio/recitation/**`). Tiny UI/ambient files may stay in Git |
| R1.7 Delete Journeys compiler because the room is empty | `boundarySourceId` / `compileJourney` are imported by Scriptorium tests and Chamber journey tests; seam/boundary behavior is live reading infrastructure citing JOURNEYS-SPEC | Counter-proposal already warned | **H7:** prove import graph before delete. Room + `JOURNEYS = []` scores can go; extract or keep compiler primitives used by Chamber/Scriptorium |
| R1.8 Delete `.agents/` while `AGENTS.md` mandates those paths | Every Cloud Agent session that follows `AGENTS.md` cannot find skills; “keep concise AGENTS.md” becomes a lie | **No** | **H8:** rewrite `AGENTS.md` + Cursor rules in the **same** change as moving skills; or keep a stub that installs skills. Do not delete first |
| R1.9 Move load-bearing specs to “local markdown” | Two vocabularies. Wiki/CI `docs/README.md` index. Cleansing detectors lose their named record. Interview notes diverge from `ARCHIVE-CANON-SPEC` | Counter-proposal has tiers, but “keep locally” is easy to over-apply | **H9:** Tier A **cannot** leave the public repo. Only Intent/uncited/dreams go local. Wiki gate must stay green |
| R1.10 Content-plane “delete JS modules” in the same PR as media | Dual-write window: Rollup still follows `load: () => import(...)` if any catalogue still points at modules (PROJECT-KNOWLEDGE §2.2 — withheld still built) | Counter-proposal sequences it later | **H10:** media PR does not touch work-module shape. Content-plane source cut has its own fail: `rg` the built JS for novel-sized strings |
| R1.11 Scriptorium 30-day “proof of use” gate | A used authoring room vanishes for strangers; Chapel/Workshop paths that share gates get collateral damage | Not in B.2 counter-proposal | **H11:** **reject** time-based deletion of Scriptorium. Proof-of-use is not an axiom. If unused, argue from import graph and user outcome, not a calendar |
| R1.12 Mute Keystone as reverent degradation | Strangers already get Begin on `admitted`; missing voice looks like a bug, not stillness | Release report: Begin ≠ certified | **H12:** production Keystone recitation is a **release feature**. Materialize failure **blocks deploy**, not “play silence and ship” |
| R1.13 Object store object replaced at the same key | Integrity of speech; acoustic review still points at old hash | URL mutability | Fold into **H4** (content-addressed objects: hash in the path or immutable tag) |
| R1.14 Legal/provenance of generated voice | NOTICE/ASSET-LICENSES may not describe TTS output; moving host doesn’t create a license | Unspecified | **H13:** record Kokoro/voice license in ASSET-LICENSES (or NOTICE) **before** public object-storage URLs exist |
| R1.15 Developer `npm run dev` without 240 MB | Local recitation missing; tests that assume files fail intermittently | Unspecified | **H14:** documented one-command materialize; unit tests must not require all 877 WAVs; e2e that assert speech must skip or fetch. Never skip `release:check` voice gates on the release machine |

**Round 1 result:** 14 hard constraints. Not stopped.

### Round 2 — attack the mitigations

| Attack | If true, what breaks | Stopped by H*? | Required change or accept |
|---|---|---|---|
| R2.1 Materialize script uses `latest` Release or `main` tarball | H4 bypassed; bytes drift from Git ledger | H1+H4 incomplete without **pin** | **H15:** fetch URL includes the digest from Git (GitHub Release asset named by hash, or tarball whose checksum is committed). `latest` is forbidden |
| R2.2 History rewrite (H2) rewrites `release-evidence` / certification SHAs people already quoted | Links and interview claims rot | H2 | **Accept R-1:** if history is rewritten, publish one mapping note (old clone SHA → new). Prefer **orphan-orphan**: new clone-small default branch only if org accepts breaking SHA; otherwise **accept fat history** and only stop *adding* blobs |
| R2.3 Unauthenticated public artifact (H3) is a 240 MB hotlink magnet / bandwidth bomb | Cost; availability | H3 | **H16:** CDN/Netlify already serves these bytes today. After the move, **production** remains same-origin (H1). The **builder** fetch may be public **if** content-addressed; rate-limit is residual. Do not put secrets in the fetch URL (hygiene already forbids `VITE_*KEY` in catalogs) |
| R2.4 Per-file hashes in Git (H4) are 877 lines that rot when one phrase regenerates | Huge diffs; merge hell | H4 | **H17:** one **pack identity** hash (already printed by `release:check`) plus a generated manifest file that is the ledger. Regenerating one WAV changes pack identity — correct, not a bug |
| R2.5 `csp.test.js` stays green while a future plugin injects WASM | Tests that cannot fail (PROJECT-KNOWLEDGE §2.4) | H5 | **H18:** CSP test must keep asserting Kokoro/HF/wasm **absent** from production headers and from `dist/` JS imports. Add `dist` grep if missing |
| R2.6 Keep compiler, delete `JOURNEYS-SPEC` as “vision residue” | Chamber comments and seam rules lose their contract; vocabulary splits | H7+H9 | **H19:** if primitives stay, the cited clauses stay in a **Contract** (fold into EXPERIENCE-PROGRAM or ARCHITECTURE). Do not delete the spec out from under live comments |
| R2.7 Skills installed “outside the repo” on Cloud Agent images | Images without the install step violate AGENTS.md; non-reproducible | H8 | **H20:** either vendor a **thin** using-superpowers stub + SOURCE pin, or make `environment.json` / setup script install the same commit as `SOURCE.txt`. Reproducibility beats cleanliness |
| R2.8 Tier B local docs copied back into PRs ad hoc | Two canons anyway | H9 | **H21:** `docs/README.md` remains the only index of public authority. Local notes must not be cited by tests |
| R2.9 Fail-closed deploy (H12) + Cloud Agent without pack | Agent cannot run e2e recitation; false “product broken” | H12+H14 | **H22:** distinguish **release admission** (must have pack) from **default PR** (hygiene/docs can skip voice; browser shard that needs speech must fetch or skip *named*). Do not let prose-only PRs require 240 MB |
| R2.10 Filter-repo executed on a machine that still has Netlify deploy keys | Operational disaster, not a code bug | H2 | **Accept R-2:** history rewrite is a named, rehearsed operation with a rollback clone — or we skip rewrite (R-1) |
| R2.11 Object storage is the **runtime** origin “only for Range requests / mobile” as a later “optimization” | Reintroduces R1.1 through a side door | H1 | **H23:** any future CDN for audio is **the same site** or a host added to CSP **and** treated as a decision in ARCHITECTURE §8.5, not a silent Netlify tweak |
| R2.12 Content-addressed GitHub Release is deleted / account lockout | New builds cannot materialize; old Netlify deploys still have files in their deploy | H3 | **Accept R-3:** keep at least two holders of the pack (Release + local builder cache + ability to regenerate from Kokoro pin). Regeneration **invalidates** acoustic review — that is already the protocol |
| R2.13 Tiny UI wavs stay; someone later “unifies” all audio to the object store | click/hiss fail when offline-first / first paint | H6 | **Accept R-4:** UI sprites stay in Git until a separate decision. Size is negligible |
| R2.14 ASSET-LICENSES updated but generated WAV headers contain no license | Fine for this product (bytes are ours to ship if the tool license allows) | H13 | **Accept R-5:** tool license in NOTICE/ASSET-LICENSES is the control; we do not watermark 877 files |

**Round 2 result:** H15–H23 added; residuals R-1…R-5. Not stopped.

### Round 3 — attack round-2 controls and acceptances

| Attack | If true, what breaks | Stopped? | Required change or accept |
|---|---|---|---|
| R3.1 Pack identity hash in Git (H17) with no per-file list | One bitflip in one WAV: identity fails (good) but diagnosis is “the pack”; CI log hell | H17 | **H24:** `inspectReleaseVoiceAssets` already returns per-key issues (first 20). Keep that; do not replace it with a single hash-only check |
| R3.2 “Prose PRs skip voice” (H22) is implemented as `paths-ignore` that also skips `csp.test.js` / hygiene | Secretful catalogs slip through | H22 | **H25:** use the **existing** CI classifier (`docs/` / `.agents/` / root md). Do not invent a second skip matrix. Voice materialize belongs in jobs that already build `dist/` |
| R3.3 Thin skill stub (H20) drifts from upstream Superpowers | Agents follow stale TDD/brainstorming gates | H20 | **Accept R-6:** pin `SOURCE.txt` commit; update is deliberate. Same as today |
| R3.4 Two holders of the pack (R-3) diverge | Builder cache stale vs Release | R-3 | **H26:** the Git pack identity is sovereign. Any holder that disagrees is not used. Regeneration is a new identity, not a merge |
| R3.5 Accepting fat history (R-1) makes the whole proposal pointless | Org audit’s 263.9 MB target missed | R-1 | **Not pointless:** stops **future** blob growth and lets **new** worktrees use Git-LFS-free sparse checkout / optional fetch. **H27:** README states clone is source; recitation bytes are fetched by `npm run` script. Attention win is *ongoing*, not a one-time `du` |
| R3.6 Folding JOURNEYS-SPEC into ARCHITECTURE (H19) creates a god-document | ARCHITECTURE already guards rooms | H19 | **Accept R-7:** keep a short Contract pointer; do not paste 1,225 lines into ARCHITECTURE. Deleting unpublished **scores** does not require deleting the seam **law** |
| R3.7 H11 (keep Scriptorium) used to never delete anything “someone might use” | Audit’s attention axiom dies | H11 | **Accept R-8:** Scriptorium stays until a **named** outcome says it does not (no Journey-style empty published list). Calendar gates remain forbidden |
| R3.8 H15 pin to GitHub Release couples availability to GitHub | GitHub outage blocks **new** deploys, not existing ones | H15 | **Accept R-9:** same as today’s GitHub-hosted repo. Builder can regenerate if Kokoro pin + plan exist. Existing CDN deploys unaffected (H1) |
| R3.9 Developer skip of 877 WAVs (H14) + e2e that `waitForTimeout` for speech | Flaky green | H14 | **H28:** e2e that need recitation **declare** the pack; if absent, **skip with reason**, never `retries: 1` success on silence. Align with existing journey-skip honesty |
| R3.10 Local Tier B notes contain secrets / unpublished editions | “Keep locally” becomes a leak path when zipped to a laptop | H9 | **Accept R-10:** local notes follow the same hygiene: no tokens. Not unique to this proposal |
| R3.11 Netlify publish dir `dist/` copies `public/audio` only if materialize ran **before** `vite build` | Easy to run `vite build` alone in a hurry | H1 | **H29:** `npm run build` already runs `content:build` first. Recitation materialize must hook **the same** `build` script (or `content:build` companion). Bare `vite build` is not a release |
| R3.12 Filter-repo (if chosen) drops `release-evidence.json` acoustic hash correspondence | Human gate appears closable against the wrong bytes | R-1 | Fold into R-1 mapping note; if no rewrite, N/A |

**Round 3 result:** H24–H29. Residuals R-6…R-10. Continue.

### Round 4 — attack remaining seams

| Attack | If true, what breaks | Stopped? | Required change or accept |
|---|---|---|---|
| R4.1 `npm run build` hook (H29) downloads 240 MB on every Cloud Agent/docs PR that CI classifier marks `code=true` | Attention + time; `changes` job can still say “code” for a one-line JS comment | H25+H22 | **H30:** cache the pack by **pack identity** in CI (Actions cache key = hash in Git). Download only on miss. Docs-only stays skipped via existing classifier |
| R4.2 Actions cache eviction + GitHub Release outage + no local Kokoro | Release job cannot ship | H30+R-3 | Already R-3/R-9. **Accept R-11:** three-way: cache, Release (or object store), regenerate. Simultaneous failure of all three is accepted like “npm registry + GitHub down” |
| R4.3 Cache poison: wrong bytes stored under the right key | Integrity | H4+H26 | **H31:** after restore, **re-hash** before `vite build`. Cache is untrusted. Same as content-plane digest verify |
| R4.4 Phrase text change in a Keystone without regenerating the pack | Coverage incomplete; `KEYSTONE_RECITATION_INCOMPLETE` | Existing `resolveKeystone` | **Accept R-12:** already a release blocker. Moving storage does not weaken it |
| R4.5 Kokoro version drift on regenerate (R-3) | New PCM, new identity, old acoustic JSON rejected — **good** | Protocol | **Accept R-13:** this is the design. Residual is **labor** to re-listen 547 phrases, not a vuln |
| R4.6 Wiki publishes this red-team file | Process noise in public wiki | File is under `docs/superpowers/` | **Accept R-14:** `NOT_PUBLISHED` already excludes the folder. Do not add this file to `docs/README.md` |
| R4.7 Someone implements H7 by deleting tests that import `compileJourney` so the graph is “clean” | PROJECT-KNOWLEDGE §2.3 — tested the plumbing you just removed | H7 | **H32:** deletion PR must show Chamber seam tests **still pass** on remaining primitives, or those tests move with the primitives. Deleting tests to make delete legal is a finding |
| R4.8 Sparse checkout users never run materialize and file “Keystone is silent” issues | Support load | H14+H27 | **Accept R-15:** README one paragraph; Keystone UI already has blockers list — if coverage incomplete, show it (today certification-only note exists). Do not auto-play silence as success |
| R4.9 Object store region / GDPR: audio of public-domain text in EU buckets | Over-lawyering; no personal data in the pack | — | **Accept R-16:** pack is not user data. Out of scope unless a lawyer names a real issue |
| R4.10 `window.rise` + public pack URLs in a future runtime fetch experiment | XSS amplification | H1+H23 | Covered; no new control |

**Round 4 result:** H30–H32, R-11…R-16. Continue once more.

### Round 5 — attack the leftover acceptances only

| Attack | If true, what breaks | New unmitigated? |
|---|---|---|
| R5.1 Fat-history acceptance (R-1) plus cache (H30) means GitHub still stores blobs in old commits **and** Actions cache **and** Release | Redundancy is the point of R-3 | No — cost, not a vuln |
| R5.2 H32 (don’t delete tests) used to keep the entire Journeys room forever | Tension with audit | No — **H7 already allows** deleting room/scores; tests that only assert unpublished War/Demo **should** go with them. Tests that assert **seam primitives** stay |
| R5.3 README “fetch script” (H27) not executable on Windows (historical Playwright pain) | Windows contributors mute | **H33:** materialize script is Node (`node scripts/…`), not a POSIX-only pipeline. Same constraint as the rest of RISE |
| R5.4 Pack identity hash algorithm change (sha256 → other) | All pins break | **Accept R-17:** sha256 is the project’s content-address (works, voice). Do not change it in the media move |
| R5.5 Recursive protocol itself never stops because residual labor (R-13) is labeled a vulnerability | Category error | No — labor is accepted residual, not a security/integrity hole |
| R5.6 Cloud Agent `behind` default branch / stale snapshot missing the fetch script | Agent ships mute preview | **Accept R-18:** same class as any new npm script; setup already runs `npm ci` |
| R5.7 Dual public URLs: Netlify `/audio/recitation/` vs GitHub Release | Users bookmark Release and hear old/new mix | H1 — readers never use Release. **Accept R-19:** Release is a builder input, not a product URL. Do not document it as a listening surface |

**Round 5 result:** one new hard constraint (**H33**). Residuals R-17…R-19. One more round required.

### Round 6 — attack H33 and R-17…R-19

| Attack | If true, what breaks | New unmitigated? |
|---|---|---|
| R6.1 Node materialize script shells out to `curl` / `tar` anyway | Windows/msys issues return | **H34:** use `node:https` / `fetch` + `fs` only (or a dep you already have). No `bash` in the hot path |
| R6.2 sha256 freeze (R-17) forever even if broken | Hypothetical | No — out of scope; SHA-256 is the content plane’s axiom |
| R6.3 Builder-only Release URL leaks into `index.html` | Runtime third origin | H1 + existing first-load / `measure:first-load` would see a new host. **H35:** first-load budget job fails if `index.html` or hashed app chunks request non-allowlisted hosts. Recitation tags must stay same-origin paths |
| R6.4 “No bash” script uses `child_process` to `ffmpeg` to “verify” WAVs | Extra tool; CI image already has ffmpeg | Acceptable **optional** verify; must not be required to **unpack**. No new finding if unpack is pure Node |
| R6.5 Residual register used as a dump for unfixed H* | Process failure | **H36:** every H* is either implemented in the same series of PRs or this proposal is **not done**. Residuals cannot hide an unimplemented H |

**Round 6 result:** H34–H36. No new *class* of product vulnerability. Next round must try to break H34–H36.

### Round 7 — attack H34–H36

| Attack | If true, what breaks | New unmitigated? |
|---|---|---|
| R7.1 Node `fetch` of a 240 MB tarball OOMs the Cloud Agent | Availability of CI | **H37:** stream to disk; do not buffer the whole pack in memory. Check disk space. This is implementation, still a hard constraint |
| R7.2 H36 “all H* in the same series” makes one mega-PR | Review failure; mixed media + Journeys deletes | **Clarify H36:** *series*, not one PR. Media (H1–H6, H12–H18, H22, H24–H31, H33–H35, H37) is PR1. Docs locality PR2. Journeys/skills PR3. Content-plane source format PR4. Unimplemented H* means **that slice** is not done |
| R7.3 Streaming download without TLS verification | Integrity | Node default TLS stays on. Content-address verify (H31) is the real check. **No new finding** |
| R7.4 Disk-full mid-stream leaves truncated WAV that still has a RIFF header | `VOICE_ASSET_INVALID` or worse, plays garbage | H24 already invalidates non-WAVE; **H38:** verify pack identity **after** complete download; delete partial dir on failure |
| R7.5 H36 clarification re-opens calendar/Scriptorium deletion in PR5 “while we’re at it” | Scope creep | H11 stands. **No new finding** |

**Round 7 result:** H37–H38; H36 clarified. Continue.

### Round 8 — attack H37–H38 and the clarified series

| Attack | If true, what breaks | New unmitigated? |
|---|---|---|
| R8.1 After failed partial delete (H38), two agents materialize concurrently into the same `public/audio/recitation` | Torn pack | **H39:** write to a temp directory, fsync, verify identity, then rename into place (atomic replace). Same pattern as content-plane emit |
| R8.2 Series PR2 (docs) deletes CLEANSING spec because “campaign ended” | Regression vocabulary dies | H9 already: cleansing record stays. **No new finding** |
| R8.3 Series PR3 deletes `.agents` before PR2 rewrites AGENTS.md | Order bug | **H40:** PR3 depends on AGENTS.md/skills rewrite landing first (or same PR). Stated as a merge order constraint |
| R8.4 Atomic rename fails on Windows across volumes | Materialize broken on Windows | **Accept R-20:** same-volume temp dir (`public/audio/.tmp-recitation-*`). If rename fails, documented fallback copy+verify. Residual platform friction, not a product integrity hole if verify (H38) still runs |
| R8.5 Temp dir not gitignored, someone commits 240 MB again | Proposal inverted | **H41:** gitignore `public/audio/recitation/**` **and** the temp prefix; CI hygiene fails if a recitation WAV is staged |

**Round 8 result:** H39–H41; R-20. Continue.

### Round 9 — attack H39–H41 and R-20

| Attack | If true, what breaks | New unmitigated? |
|---|---|---|
| R9.1 Hygiene “fail if WAV staged” blocks the legitimate **first** commit that still tracks today’s 877 files | Chicken and egg | **H42:** removal commit is ordered: add fetch script + gitignore + untrack (`git rm --cached`) **together**. Hygiene rule activates in that commit, not before |
| R9.2 `git rm --cached` without history rewrite: GitHub still serves old blobs via the parent commit | Expected (R-1) | No |
| R9.3 gitignore exception `!manifest.json` forgotten, ledger untracked | Pack identity not in Git | **H43:** ignore `*.wav` under recitation, **not** `voice-pack.manifest.json` (which lives in `src/audio/`). Recitation folder should contain **only** generated WAVs |
| R9.4 R-20 fallback copy leaves both temp and dest, doubles 240 MB on disk | Cloud Agent disk | **Accept R-21:** acceptable spike; temp deleted after verify. Owner: whoever lands PR1 |
| R9.5 Staged-WAV hygiene uses filename not content | A `.wave` or extensionless blob sneaks in | **H44:** hygiene flags **any** file under `public/audio/recitation/` except a committed `.gitkeep` or README that explains the fetch. No audio binaries |

**Round 9 result:** H42–H44; R-21. Continue.

### Round 10 — attack H42–H44

| Attack | If true, what breaks | New unmitigated? |
|---|---|---|
| R10.1 README under `public/audio/recitation/` is wiki-irrelevant but becomes a second instruction set vs root README | Two vocabularies | **H45:** one sentence in recitation dir pointing at root README / `package.json` script name. No second procedure |
| R10.2 `.gitkeep` published to Netlify as an extra request | Harmless | **Accept R-22:** optional; prefer empty dir created by the script |
| R10.3 Hygiene regex misses `public/Audio/recitation` on case-insensitive OS | Bypass | **H46:** normalize paths; fail on any `**/audio/recitation/**` with a binary extension or magic `RIFF`/`WAVE` |
| R10.4 First removal commit is so large GitHub UI / review tools melt | Process | **Accept R-23:** expected for 877 deletions; review the script + gitignore, not each WAV diff |
| R10.5 Round 10 finds only implementation nits already implied by H1+H4+H31 | — | **No new product-class vulnerability** |

**Round 10 result:** H45–H46; R-22–R-23.

### Round 11 — attack H45–H46 and R-22–R-23

| Attack | If true, what breaks | New unmitigated finding? |
|---|---|---|
| R11.1 RIFF magic false positive on a future non-audio file | Hygiene false fail | Accept: recitation dir is audio-only (H44). **No** |
| R11.2 Root README procedure diverges from `package.json` script name | Two vocabularies | Covered by H45 if README names the **script**, not a pasted pipeline. **No** new item |
| R11.3 Accept R-23 causes nobody to review `release-voice-evidence.mjs` changes in the same PR | Integrity | Social process. **H36 series** already requires voice evidence code review in PR1. **No** new control |
| R11.4 Hostile analyst obligation: invent one more finding | Recursion never ends | **Forbidden by Part A.** Labor to re-listen (R-13) and fat history (R-1) remain **accepted**, not unmitigated vulns |

**Round 11 result:** **zero new unmitigated findings.**

---

## Stop rule

**Stop rule fired at round 11** because the round produced no new unmitigated vulnerability. Remaining items are either **hard constraints** the implementation series must satisfy or **accepted residuals** in the register below.

This is **not** a claim of zero risk. It is a claim that every identified failure mode is either a named control (H1–H46) or a named acceptance (R-1–R-23) with a reason that further control is worse or out of scope.

---

## Hard constraints (normative for any implementation)

If a PR in the series violates one of these, the proposal is not the proposal that was red-teamed.

| ID | Constraint |
|---|---|
| H1 | Reader audio stays same-origin. Fetch is build/release materialize only. |
| H2 | Decide history rewrite vs accept fat history; write it down. |
| H3 | Materialize uses a content-addressed public artifact; failure blocks **release** voice gates, never skips them. |
| H4 / H15 / H17 / H24 / H26 / H31 / H38 | Git pack identity is sovereign; verify after download and after CI cache restore; per-key issues remain; `latest` forbidden. |
| H5 / H18 | No browser Kokoro/WASM. CSP + `dist` grep stay. |
| H6 | Move recitation WAVs only, not UI/ambient sprites. |
| H7 / H19 / H32 | Import-graph Journeys deletion; keep seam primitives or move tests with them; do not delete tests to legalize deletion. |
| H8 / H20 / H40 | Skills and `AGENTS.md` move together; reproducible pin (`SOURCE.txt` or setup). |
| H9 / H21 / H45 | Tier A docs stay public; one index; no second procedure. |
| H10 | Content-plane source format is a later PR. |
| H11 | No calendar deletion of Scriptorium. |
| H12 | Missing Keystone pack blocks **deploy**, not silent production. |
| H13 | TTS/tool license recorded before public hosting. |
| H14 / H22 / H25 / H28 / H30 | Unit tests don’t need 877 files; e2e skip *named* if absent; CI classifier reused; Actions cache by pack identity. |
| H16 | No secrets in fetch URLs. |
| H23 | Future audio CDN is an ARCHITECTURE decision + CSP, not a silent tweak. |
| H27 / H29 / H33 / H34 / H37 / H39 | Documented Node materialize on `npm run build`; stream to disk; temp dir then atomic replace. |
| H35 | First-load / host allowlist must catch runtime third-origin audio. |
| H36 | Constraints land in the stated PR **series**, not a junk drawer of residuals. |
| H41–H44 / H46 | gitignore + hygiene: no recitation binaries in Git after the removal commit; RIFF detection; activation ordered with `git rm --cached`. |
| H42 | Removal is one coherent commit: script + ignore + untrack. |

**Rejected from the org audit (do not do):**

- Delete all of `public/audio/` (UI sound is not the pack).
- Delete Scriptorium on a 30-day clock.
- Delete `.agents` without rewriting `AGENTS.md`.
- Delete `journey-compiler` because the Journeys **room** is empty.
- Runtime object-storage playback.
- Moving ARCHIVE-CLEANSING / ARCHITECTURE / release protocol to “local markdown.”

---

## Accepted residual register

| ID | Risk | Why further control is worse | Owner | Review trigger |
|---|---|---|---|---|
| R-1 | Git history may remain fat | History rewrite breaks SHAs; mapping cost may exceed attention saved | Release engineer | Repo size becomes a clone-blocker again |
| R-2 | History rewrite is operationally dangerous | Rehearsal cost; prefer R-1 unless size is intolerable | Release engineer | Decision to rewrite |
| R-3 / R-9 / R-11 | Builder cannot fetch pack if GitHub+cache+Kokoro all fail | Same class as registry outage; regeneration invalidates acoustics | Release engineer | Pack host change |
| R-4 | UI wavs stay in Git | Bytes are small; unifying audio hosts reopens H1 | App owner | UI audio set grows |
| R-5 | No per-file license watermark | ASSET-LICENSES is the layer; 877 headers are theater | App owner | Legal request |
| R-6 | Superpowers pin drifts | Deliberate updates beat live-at-head | whoever owns AGENTS.md | Skill install breakage |
| R-7 | Seam law stays documented | Deleting the law to delete scores repeats flatten-and-guess | App owner | Journeys re-anchored |
| R-8 | Scriptorium remains large | Calendar deletion is not a user outcome | App owner | Explicit “unpublish Scriptorium” decision |
| R-10 | Local notes can leak if handled sloppily | Same as any laptop; don’t build a vault for dreams.md | Individual | Incident |
| R-12 | Keystone phrase change needs new pack | Already a blocker; storage move doesn’t add it | Release engineer | Keystone text change |
| R-13 | Regenerated PCM requires 547-phrase re-listen | Protocol integrity; automating “pass” is forbidden | Acoustic reviewer | Any pack identity change |
| R-14 | This file is not on the wiki | Process vs product; correct | Docs owner | If moved out of `docs/superpowers/` |
| R-15 | Devs without pack hear silence | Fail-closed + README cheaper than 240 MB in every clone | App owner | Support tickets |
| R-16 | TTS hosting jurisdiction | No personal data in pack | — | Named legal issue |
| R-17 | sha256 remains the digest | Changing hash is a content-plane project, not this series | — | Crypto migration |
| R-18 | New script missing on stale agent images | Same as any new npm script | Cloud env owner | Materialize script lands |
| R-19 | Release URL is not a listener URL | Documenting it as UX would split the product | Docs owner | Any public “listen here” link |
| R-20 / R-21 | Windows rename / temp disk spike | Verify-after-write still protects integrity | PR1 author | Windows materialize bug |
| R-22 | `.gitkeep` optional | Empty dir from script is simpler | PR1 author | If Netlify lists the dir oddly |
| R-23 | Huge deletion diff | Review the script, not 877 files | Reviewer | Removal commit |

---

## Idiot index (why this recursion was the work)

The org audit’s essential move is correct: **generated media is not source**. The non-essential moves (delete Scriptorium by calendar, delete compiler with the empty room, fetch audio at runtime, hide contracts in local markdown) raise complexity without preserving Keystone speech, provenance, or the attention of the next agent.

Implement **PR1 (media)** only with H1–H6, H12–H18, H22, H24–H31, H33–H39, H41–H46, and an explicit R-1 (history) choice in the PR body. Do not start PR3 (Journeys/skills) until H7–H8, H19–H20, H32, H40 are designed against the import graph.

---

## Re-run stub

On a later tree, paste Part A into a new dated section (`## Part D — executed run (YYYY-MM-DD)`) and recurse again. If round 1 of the re-run finds that an H* was never implemented, that is an **unmitigated** finding — the stop rule of *this* run does not cover a future incomplete series.
