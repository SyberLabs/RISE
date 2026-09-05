# RISE Release Report

**Status:** Record  
**Date:** 2026-08-31  
**Commit audited:** `e333b2d` (`main` — *fix(navigator): a phone gets one pane, bounded by its screen*)  
**Auditor role:** Production engineering system-wide sweep  
**Authority this report does not replace:** `docs/RELEASE-ROADMAP-2026-08-20.md`, `docs/RELEASE-ACCEPTANCE-PROTOCOL.md`, `npm run release:check`

---

## 1. Verdict

**RISE is not ready for public release debut.**

It is ready to continue as a **technical preview / invite-gated review build**: the machine corridor for voice integrity, security hygiene, first-load budget, and recent CI on `main` is green. The product’s own release checker refuses admission with **4 blocked** and **3 human** gates. Public sharing that implies “the Library editions are certified,” “Keystones are release-ready,” or “Clear all personal data clears everything” would overclaim.

| Audience | Share? | Condition |
|---|---|---|
| Collaborators / invitees who know gates are open | Yes | Keep BetaGate / honest “Admitted, not certified” copy |
| Press / strangers / unrestricted public debut | No | Close every gate in §3–§4 first |
| Open-source code drop (Apache-2.0 application) | Conditional | Fix privacy erase inventory before advertising it; keep NOTICE/ASSET-LICENSES with the tree |

**One sentence for decision-makers:** The engine works; the evidence ledger does not.

---

## 2. Method

This sweep treated the repository’s own release definition as ground truth, then asked whether the tree, the live gates, and the documentation tell the same story.

1. Read the release contracts (`RELEASE-ROADMAP`, `RELEASE-ACCEPTANCE-PROTOCOL`, `ARCHITECTURE.md`, `release-evidence.json`).
2. Ran machine gates on this checkout after `npm ci` and `npm run build`.
3. Audited security headers, CSP, dependency advisories, XSS/sanitization, and personal-data export/erase.
4. Audited architecture and state: session compile path, Player lifecycle, router/persistence, multi-tab, feature flags.
5. Searched for glitches: skips, silent catches, recent fix themes, README/code mismatches.
6. Applied the Master Reference Checklist (§11): what to question, delete, or simplify before anything else is built.

**Not done in this sweep (and not claimed):** full ~2,800-unit run wall-clock, full Playwright matrix (~500s), real-device listening, stranger corridor, or human edition certification. Those are named gates below; inventing their outcomes would violate the acceptance protocol.

---

## 3. Machine corridor — measured on this checkout

### 3.1 `npm run release:check` (after `content:build` + `build`)

```text
[PASS] RELEASE_NODE_SUPPORTED
[BLOCKED] RELEASE_CANONICAL_SHELF_SIZE — 0 certified works (requires 10–15)
[BLOCKED] RELEASE_KEYSTONE_MEDITATIONS — KEYSTONE_SOURCE_UNCERTIFIED
[BLOCKED] RELEASE_KEYSTONE_METAMORPHOSES — KEYSTONE_SOURCE_UNCERTIFIED
[BLOCKED] RELEASE_KEYSTONE_TINTERN — KEYSTONE_SOURCE_UNCERTIFIED
[PASS] RELEASE_FFMPEG_AVAILABLE
[PASS] RELEASE_VOICE_ASSETS_COMPLETE — 877 WAVs, 547 phrases,
       identity sha256:fc52f2a0bef822fc40941479ffa5482d4f6d0b00e3438be2708a4e81c2edfbf3
[PASS] RELEASE_VOICE_DISTRIBUTION_COMPLETE — dist byte-identical to source
[HUMAN] RELEASE_ACOUSTIC_ACCEPTANCE
[HUMAN] RELEASE_REAL_DEVICE_CERTIFICATION — all five families missing
[HUMAN] RELEASE_STRANGER_TESTING

Result: 4 pass, 4 blocked, 3 human gates. ready = false.
```

**Prerequisite bug / footgun:** `release:check` throws `ContentStoreError` if `public/content/` is missing (content plane not built). That is not a soft “blocked” finding — the admission script crashes. Always run `npm run content:build` (or `npm run build`) first. Prefer making the checker emit a blocked finding instead of throwing.

### 3.2 Security and hygiene

| Gate | Result |
|---|---|
| `node scripts/ci-hygiene.mjs` | Clean (8 checks across 801 catalogued works) |
| `npm run security:audit` (`--audit-level=high`) | **0 vulnerabilities** |
| `npm run security:compat` | Kokoro/Sharp compatibility verified |
| `npm audit` after `npm ci` | 0 vulnerabilities |

### 3.3 First-load budget

`npm run measure:first-load` after production build:

| Metric | Value | Budget |
|---|---|---|
| Shell total (brotli) | **60.2 KB** / 3 requests | 64.0 KB |
| To Portal paint | 65.9 KB / 5 requests | (informational) |

### 3.4 Targeted unit sample

`system-design`, `security-policy`, `user-data`, `csp`, `app.safety`: **5 files, 36 tests, all passed.**

### 3.5 CI on `main`

Latest push CI for `e333b2d` completed **success** (~5m23s). Recent `main` history is a dense stream of release-candidate layout/navigator/fit fixes — the machine suite is currently green; residual UX risk remains in those surfaces (§6).

### 3.6 Content plane

`npm run content:build`: **15 works** (10.00 MB) + **73 Chapel books** (4.78 MB); 80 withheld with reasons; revision `99bc1aa65a4e1701`. All 15 archive works report `certificationStatus: "candidate"`. `src/content/archive/certifications.json` is `{}`.

---

## 4. Human gates — empty or stale

From `release-evidence.json` (`rise.release-evidence.v1`):

| Gate | Required | Present |
|---|---|---|
| Exact-edition certifications | 10–15 records in `certifications.json` | **0** |
| Acoustic review | 547 phrase passes bound to current manifest hash | `reviewedPhraseCount: 0`; stale `phraseCount: 665` (Book XIII-era) |
| Real devices | iPhone Safari, Android Chrome, desktop Chrome/Safari/Firefox | `realDevices: []` |
| Stranger corridor | ≥3 unprompted participants, all three outcomes | `participantCount: 0` |

The acceptance protocol is correct: **do not fabricate these**. Until they exist, `release:check` must stay red.

---

## 5. Policy mismatches that look like product bugs

These are the most important findings for public messaging. The roadmap and the runtime disagree.

### 5.1 Uncertified shelf is served in production — **blocker vs stated policy**

```359:363:src/content/archive/index.js
export const RELEASE_SERVES_UNCERTIFIED = true;

function serveCandidates() {
    return RELEASE_SERVES_UNCERTIFIED || archiveReviewEnabled();
}
```

Roadmap: *“Public shelf remains empty until 10–15 human certifications are recorded.”*  
Code (Mateo, 2026-08-21, intentional): serve all 15 candidates so the room is not empty.  
Architecture §8.21 records this as an **open / temporary** decision.

**Public-share impact:** Readers meet prepared editions labeled as candidates, not certified works. That is honest only if launch copy says so. Calling the shelf “canonical / certified” is false.

### 5.2 Keystone Begin launches without certification — **blocker vs stated policy**

All three Keystone manifests set `admitted: true`. `resolveKeystone` sets `ready: false` while `KEYSTONE_SOURCE_UNCERTIFIED` remains, but `admitted` stays true when that is the only blocker. UI:

```61:83:src/components/Keystones.js
      const canLaunch = result?.ready || result?.admitted
        || (this.reviewMode && result?.reviewable);
      ...
            ${result?.ready || result?.admitted ? 'Begin' : canLaunch ? 'Review without missing media' : 'Not yet admitted'}
```

Roadmap: *“public launch buttons remain disabled until the exact source, visual, voice, and human gates pass.”*  
Runtime: Begin is enabled for editorially admitted, uncertified Keystones, with a note that certification remains open.

**Public-share impact:** Try RISE → Begin works today. That is fine for preview; it is not “release certified.”

### 5.3 `release-evidence.json` phrase count is stale

Acoustic block still says `phraseCount: 665` while the checker expects **547** and hash `sha256:fc52f2a0…`. Any imported ledger for the old Book XIII identity must be rejected; regenerate review materials from the current voice pack.

---

## 6. Glitches, intermittent behavior, and residual defect risk

### 6.1 Deliberate deferrals (not bugs — but stranger-facing gaps)

| Item | State |
|---|---|
| Journeys | `JOURNEYS = []`; README honest; ~16 e2e skips + unit `describe.skip` suites on ice |
| Gutenberg rehabilitation / Focal / Solarium / RISE Chain | Explicitly deferred in roadmap |
| Workshop on phone | Desktop-full / mobile-safe, not phone-equivalent |
| Cold reload | Most rooms have no URL; reload returns to Portal (§8.12 open) |

Strangers will experience empty Journeys and lost place on reload as unfinished product unless copy frames them.

### 6.2 Designed degradation that can look broken

Reverent degradation is enforced: missing image/sound → stillness; museum 429 → cooldown; missing recitation phrase → silent continue; flash consent declined → visuals off. These are correct per axioms, but production logs will show `[voice]`, visual-cortex, fractal cache, and Wikimedia warnings. Monitor them; do not “fix” by substituting content.

### 6.3 Timing / flake surface in browser suite

- ~108 `waitForTimeout` calls across e2e (heavy in mobile/portal/recitation).
- Playwright `retries: 1` globally — intermittent failures can hide once.
- Live CSP check (`e2e/csp-live.spec.js`) is opt-in (`RISE_LIVE=1`); default CI does not prove production headers.
- Recent commits (fit mask, navigator phone pane, specimen overflow, atrium orphans, Begin visibility) show **hot layout surfaces**. Machine green after #111 does not mean stranger-device polish is closed — that is why the real-device gate exists.

### 6.4 Player teardown gap — **high (lifecycle)**

`Player.destroy()` exists and removes the `visibilitychange` listener, but Chamber/`app.js` onExit typically `stop()` and null the reference without `destroy()`. Risk: orphaned listeners across repeated Chamber entries in a long session. Not observed as a CI failure; treat as a pre-launch hardening item.

### 6.5 Silent catch density in audio teardown

`src/audio/engine.js` uses many empty `catch` blocks around oscillator/stop teardown (Audio API noise). Acceptable for stop paths; do not spread the pattern to user-facing failure surfaces.

### 6.6 No `.only` left in tree

Clean. Skip markers are intentional (~21 across e2e/src for withdrawn journeys and tool-gated tests).

---

## 7. Security and vulnerability assessment

### 7.1 Strengths (release-positive)

- **No backend** — no account DB, no session server, no upload of reader text to a RISE host.
- CSP: `script-src 'self'`; `object-src 'none'`; `frame-ancestors 'none'`; no third-party JS.
- Dev-only Vite plugins (Curia apply, Export-MP4) use `apply: 'serve'` — do not ship.
- Source maps off in production; hygiene blocks secretful catalog URLs and `VITE_*KEY/TOKEN/SECRET/PASSWORD`.
- Widespread `escapeHtml` / `safeUrl`; Phase 2 photosensitivity / reading limits landed.
- npm high/critical advisory count: **0**.

### 7.2 Findings

| Sev | Finding | Release impact |
|---|---|---|
| **Critical (trust)** | `LocalWorks` (`rise-local-works` IndexedDB) is **not** in `exportUserData` / `clearUserData` | Settings claims “Clear all personal RISE data” and lists loaded text; admitted local works survive. Violates the inventory contract in `ARCHITECTURE.md` |
| **High** | Other personal keys omitted from erase: Via/Rosarium prefs, Chapel icon/mode, beta session, stance-note seen | Residue after “clear all” |
| **High (surface)** | CSP still grants `https://corsproxy.io` while no caller remains | Delete before lock; Architecture already marks it for removal |
| **Medium** | `window.rise = new App()` in production; large service-locator surface | Amplifies any future XSS; retire or gate |
| **Medium** | BetaGate hardcoded invite map + personalized names in client JS | Soft PII / not an auth boundary (documented); strip personal invites before wide public |
| **Medium** | Broad `img-src https:` + `style-src 'unsafe-inline'` | Intentional tradeoffs; document for threat model |
| **Low** | No in-repo HSTS/COOP; Guide link missing `rel="noopener"` | Harden headers / one link |

**Classic exploit class (remote RCE, shipped secrets, eval XSS):** none found that block sharing the static build. **Privacy completeness does.**

---

## 8. Architecture and state management

### 8.1 What is sound

| Claim | Assessment |
|---|---|
| Client-only topology | Holds. Privacy is absence of egress, not a policy flag. |
| Content-addressed corpus | Holds. Hash is URL; verify on read; books out of JS bundle. |
| Session compiler for ordinary readings | Holds for Library / Workshop / Orbital / Keystones / producer. |
| Player clock design | Strong: reading vs wall time, visibility pause, playback epoch for interlocution. |
| Reverent degradation | Enforced in ContentStore (throw, no substitute) and visual/audio absence paths. |
| Living architecture doc | Guarded by `system-design.test.js` (paths, rooms, deps, §8 vocabulary). |
| First-load discipline | Within brotli budget after content-plane cut. |

### 8.2 Risks and overclaims

| Issue | Severity | Notes |
|---|---|---|
| `app.js` as composition root **and** chamber-session orchestrator (~1,670 lines) | High maintainability | Cross-cutting glue concentration; every reading-path change touches one file |
| “Session compiler is the only way in” | Doc overclaim | Chapel liturgy (Rosarium/Via) uses `compileLiturgy` — intentional second path |
| Multi-tab last-write-wins on localStorage / workshop JSON | High for personal data | No BroadcastChannel / locks; acceptable cost of no backend if documented |
| Journals unbounded; settings unversioned | Medium | Corrupt JSON → defaults (good); growth/quota UX weak |
| Global images as data-URLs in localStorage | Medium | Cap 20; still quota-sensitive |
| `RELEASE_SERVES_UNCERTIFIED` | Policy | See §5.1 |
| system-design tests do not enforce user-data inventory completeness | Gap | Contract exists in prose; LocalWorks proves it is currently false |

### 8.3 Idiot index (release process)

The essential work for debut is: certify editions, listen to 547 phrases, witness five device families, watch three strangers, flip the uncertified flag, fix erase inventory.  

Around that sits a large, high-quality machine: voice byte identity, content digests, CSP, diagram generation, browser matrix. That machine is earning its keep **only if human gates stay fail-closed**. Weakening `release:check` to go green would raise the idiot index sharply — do not do it.

---

## 9. Documentation assessment

### 9.1 Strengths

- Clear Contract / Record / Intent taxonomy in `docs/README.md`.
- Release corridor and human protocol are explicit and fail-closed.
- `ARCHITECTURE.md` decision register with Chosen / Rejected / Why / Status.
- `PROJECT-KNOWLEDGE.md` defect patterns are unusually useful for production work.
- NOTICE + ASSET-LICENSES separate software license from corpus/visual rights.

### 9.2 Defects / drift

| Issue | Severity |
|---|---|
| `docs/ENGINEERING.md` claims *“First certified work: Meditations (see certifications.json)”* while the file is `{}` | **High** — false public/hiring claim |
| Roadmap “public shelf empty / Begin disabled” vs `RELEASE_SERVES_UNCERTIFIED` + Keystone `admitted` | **High** — see §5 |
| Acoustic evidence schema still carries 665-phrase stub | Medium — confuses operators |
| §8.12 URL/cold-reload still **open** while README demo path assumes stable place | Medium UX expectation |
| Vision specs correctly marked Intent/on-ice for Journeys | Good — keep |

### 9.3 What documentation should say for any public share before gates close

Use language like: *technical preview; archive editions are candidates pending human certification; Keystones are editorially admitted; Journeys are unpublished; personal data stays in the browser — and erase must be fixed before claiming completeness.*

---

## 10. Public-sharing readiness matrix

| Dimension | Ready? | Evidence |
|---|---|---|
| Build / deploy as static SPA | Yes | Vite build green; Netlify headers present |
| Dependency / secret hygiene | Yes | Audit 0; hygiene clean |
| First-load performance gate | Yes | 60.2 < 64 KB br |
| Voice asset integrity (machine) | Yes | 877 WAVs; dist identical |
| Edition certification | **No** | 0 of 10–15 |
| Acoustic acceptance | **No** | 0 reviewed; evidence stale |
| Real-device matrix | **No** | Empty ledger |
| Stranger comprehension | **No** | Empty ledger |
| Fail-closed public shelf | **No** | Flag true; candidates served |
| Privacy erase/export honesty | **No** | LocalWorks gap |
| Journeys as marketed feature | N/A (withheld) | Correctly empty |
| Security exploit blockers | Pass with caveats | Fix erase + drop corsproxy |
| Docs accuracy for outsiders | **No** | ENGINEERING certification claim |

**Overall readiness for unrestricted public debut: not ready.**  
**Overall readiness for supervised technical preview: yes, with honest labeling.**

---

## 11. Master Reference Checklist (applied)

- **First principles:** Public debut requires certified sources and witnessed experience, not a green CI badge. The axioms (nothing leaves, reverent degradation, provenance, structure read not inferred) still hold; the erase inventory currently lies about “nothing left.”
- **Algorithm:** Do not optimize launch marketing or automate stranger testing. Delete: corsproxy CSP grant; false ENGINEERING certification sentence; production overclaim that Begin = certified. Then simplify Keystone launch policy to one rule (`ready` only for public, or rewrite the roadmap). Accelerate certification/acoustic work on the cleaned contract. Automate last.
- **Machine:** The release checker and content plane are the right machine. Keep fail-closed. Fix checker crash when content plane missing. Extend tests so a personal store outside `user-data.js` fails CI.
- **Communication:** Bad news is above — blocked and human gates are not optional. Shortest path to debut is the protocol order already written.
- **Ownership:** One name per gate already exists in the protocol (reviewer fields). Keep it; do not let scripts invent reviewers.
- **Semantic tree:** Trunk = axioms + release:check + certifications. Leaves = fit-mask polish. Do not let leaf polish substitute for trunk gates.
- **Usefulness + delight:** Shipping uncertified editions as “release” damages trust more than delaying. Fix erase before inviting strangers to store their own texts.

---

## 12. Ordered closeout (do these; nothing else until they move)

1. **Certify 10–15 exact editions**, including three Keystone sources → `certifications.json`.
2. Set `RELEASE_SERVES_UNCERTIFIED = false` the same day certifications land.
3. Align Keystone UI with policy: either require `ready` for public Begin, or rewrite the roadmap to admit editorial launch explicitly.
4. Complete acoustic review for **547** phrases / hash `sha256:fc52f2a0…`; record via `release:record-acoustic-review`.
5. Witness five device families; record stranger corridor (≥3).
6. **Fix `user-data` inventory:** export + clear `LocalWorks`; include remaining personal keys or stop claiming “all personal data”; add a regression test.
7. Delete CSP `corsproxy.io`; correct `ENGINEERING.md` certification claim; refresh `release-evidence.json` stub counts.
8. Hardening (can parallel after 6): Player `destroy()` on Chamber exit; consider gating `window.rise`; strip personalized beta invites for wide release.
9. Only then: `npm run test:run && npm run build && npm run test:e2e && npm run release:check` must report **zero blocked and zero human**.

Until step 9 is green for real, treat any public URL as a **preview**, not a debut.

---

## 13. Appendix — commands run

```text
npm ci                          # 0 vulnerabilities
npm run content:build           # 15 works + 73 chapel books
npm run build                   # success
npm run release:check           # 4 pass / 4 blocked / 3 human
node scripts/ci-hygiene.mjs     # clean
npm run security:audit          # 0
npm run security:compat         # ok
npm run measure:first-load      # 60.2 KB br / 64 budget
npx vitest run src/core/system-design.test.js \
  src/core/security-policy.test.js src/core/user-data.test.js \
  src/core/csp.test.js src/app.safety.test.js
# → 36 passed
```

Tree tip: `e333b2d` on `main`. CI push run for that commit: success.
