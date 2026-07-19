# Phase 2 — Make the Safety Promises True

**Steering:** Fable 5 (architecture, review, commit authority)
**Implementation:** 5.6 sol (author of the original red-team audit)
**Status:** Ready to implement. Phases 1 and 3 of the repair sequence are
landed and verified; this document first amends the audit's findings to
reflect that, then scopes Phase 2 precisely.

---

## A. Amendments to your red-team findings

Your audit was verified claim-by-claim before repair began. Every P1 was
confirmed, including empirical reproduction of the duplicate-connective
split. The following findings are now **resolved — do not re-fix**:

### Resolved by commit `fd181b0` (temporal contract, Phase 1)
- **Finding 1 (nominal ≠ delivered WPM).** The 1.4375× always-on
  complexity/weight multiplication is gone; `Atom.duration` as authored
  by the chunker is the reading contract. Semantic texture survives as
  **opt-in, zero-mean** modulation bounded [0.8, 1.2] (`semanticTexture`
  config on PacingEngine, default off; neutral 0.5/0.5 atoms map to
  exactly 1.0). Punctuation is **additive terminal time** (old multiplier
  minus one, once per chunk) — word-mode feel mathematically unchanged.
  Word-length texture rescaled to ~zero-mean.
- **Finding 2 (split duplication / long atoms).** Noncapturing lookbehind;
  over-long chunks in all multi-word modes subdivide (connectives, then
  near-equal windows ≤16 words) before any ceiling. Token-conservation
  and six effective-WPM invariants pin this in
  `session-compiler.test.js` ("Temporal contract: effective WPM
  invariants"). *Deferred from your recommendation:* full
  `Intl.Segmenter` sentence segmentation with abbreviation policy —
  scheduled for a later phase, not Phase 2.
- **Product decision (steering):** delivered *feel* is preserved.
  Persisted WPMs migrate ×1.4375 once (idempotent `paceV2` flag in
  orbital prefs and Workshop blueprints); 61 content WPM values and all
  runtime defaults (220 → 320) were scaled by the same map. Do not
  "correct" these numbers back.

### Resolved by commit `2a43163` (clocks, Phase 3)
- **Finding 4 (delayed-paint race).** All presentation anchors
  (`startedAt/coveredAt/exitAt/targetAt`) are set on the **commit
  frame**; cover is declared by `transitionend` primarily, with a
  fallback requiring both elapsed time and verifiably opaque computed
  style. **Semantics change you should know:** cancellation before any
  frame committed now reports `presentedDurationMs: 0` (nothing was
  visible — the old value polluted the duty ledger).
- **Finding 5 (clocks / O(N) progress).** One monotonic reading clock
  (performance.now accumulator, advances only while `playing`);
  `visibilitychange` auto-pauses and auto-resumes only its own pause;
  `calculateRemainingTime()` is O(1) via prefix sums.
- **Test-choreography rule established:** any test driving presentation
  frames must advance its clock as it drains frames. Frozen-clock drain
  loops now livelock by design (the honest clock never reaches
  `targetAt`). Three of your-era tests were rewritten under this rule.

### Re-ranked (steering decisions)
- **Aggregate compile budget** (your "important secondary" list) is
  **pulled forward into Phase 2** — it is user-protective, same category
  as the safety controls.
- **TTS adapter** (Finding 3) is Phase 4, unchanged — but note Phase 2
  builds the synchronous-cancel primitives the adapter will consume.
- **Consent binding + panel-cancel emission** join Phase 2 (safety
  cluster). The rest of your secondary list (EMA bandwidth, confidence
  gating, audio-curve alignment, Vault durations, boundary-ownership
  design, honest flash-rate UI) is Phase 5.

---

## B. Phase 2 scope — seven objectives

The unifying rule: **every path that expresses "stop showing me
visuals" cancels the active presentation synchronously and prevents the
next one.** `visualCortex.cancelPresentation(reason)` already exists and
is the only sanctioned kill mechanism — plumb to it, do not invent a
second one.

### 1. The promised in-session control (P1-6)
`index.html:70` promises "Rhythmic visuals can be disabled at any time
during the session." Make it true:
- Add a **Visuals** toggle to the chamber controls
  (`Chamber.js` control group, currently play/volume/time/exit).
- On disable: `cancelPresentation('user-disabled')` synchronously +
  suppress all further rhythmic flashes for this session. Re-enabling
  during the same session is allowed (consent was already granted) and
  requires no new warning.
- **Scope:** rhythmic (interlocution) flashes only. Genesis, attractor,
  and focals are persistent modes chosen outside that warning — leave
  them alone.
- Session-scoped state: does NOT write to saved orbital prefs.
- The control (and the whole `.chamber-controls` bar) must be reachable
  **above** the visual overlay: overlay is `z-index: 9999`; controls go
  above it. Verify hover/reveal behavior still works during a flash.
- Wiring guidance: `player.setInterlocutionHandler(handlerFn, cancelFn)`
  already accepts a cancel function (player.js:360) and `player.stop()`
  already invokes it. Chamber sets the handler at Chamber.js:340 —
  confirm the cancelFn is wired from the app layer and reuse that path.

### 2. Pause cancels the active visual
In `Player.pause()`: when `wasInterlocuting`, invoke
`this.interlocutionCancelHandler?.('paused')` so pausing during a flash
hides it immediately. Note the cascade this creates: the Phase-3
`visibilitychange` auto-pause will now also cancel an in-flight flash
when the tab hides — that is intended; state it in a test.

### 3. Photosensitivity Mode cancels live
`app.js` (~line 976, `applySettings`): toggling
`photosensitivity-mode` ON must synchronously call
`visualCortex.cancelPresentation('photosensitivity')`. The class already
blocks *future* flashes; it must also kill the *current* one.

### 4. The exit modal must be visible
`.exit-overlay` (`premium-additions.css` ~528) sits below the cortex
overlay (9999), so Escape during a flash opens an invisible modal.
Raise it above both the overlay and the controls bar. Establish an
explicit z-order comment where the values are defined:
`cortex overlay (9999) < chamber controls < exit overlay`.
Additionally: opening the exit confirmation already pauses the player —
with objective 2 in place, verify that opening it during a flash cancels
the flash (cascade, not new code).

### 5. App-level Reduced Motion is honored by the cortex
`_presentRenderedVisual` checks only the OS media query. The app also
sets a root class (`reduced-motion`, app.js:970) from user settings.
The cortex transition decision must honor
`document.documentElement.classList.contains('reduced-motion')` OR the
media query. (Under reduced motion, presence keeps its full duration
with instant enter/exit — that contract already exists and is tested.)

### 6. Honest safety copy
- `index.html` warning: keep the disable-anytime promise (objective 1
  makes it true). Review the surrounding copy: remove or soften any
  wording implying medical validation of the duty ceiling / flash gate.
  Describe them as engineering limits designed to reduce risk — not as
  a medical safeguard. Do not weaken the warnings themselves.
- `VisualInterlocutionPanel.js` (~194): cancelling the safety warning
  flips the panel's internal mode to Off but does not emit that change
  to its owner — emit it, so the orbital's status line and persisted
  config agree with reality.

### 7. Aggregate compile budget
`session-compiler.js` (`SESSION_LIMITS`): per-source limits exist but
64 × 2M chars = 128M is compilable. Add aggregate budgets:
- `maxTotalChars: 2_000_000` (aggregate across sources)
- `maxAtoms: 120_000` (post-chunk count)
Exceeding either throws a `TypeError` with a clear, user-presentable
message; Workshop and orbital launch paths surface it as a toast rather
than an unhandled rejection. `estimateCompiledDuration` must respect the
same budget (never compile what playback would refuse).

---

## C. Guardrails — do not touch

- **Chunker/pacing temporal contract** (Phase 1) — no changes to
  durations, punctuation weights, subdivision, or migration values.
- **Presentation anchor machinery** (Phase 3) — you may *call*
  `cancelPresentation`; do not re-anchor, re-time, or restructure it.
  The only permitted edit inside `_presentRenderedVisual` is the
  reduced-motion class check (objective 5).
- **Player reading clock** — objective 2 adds one cancel call in
  `pause()`; nothing else in the clock changes.
- **Photosensitivity hard-stop ordering** in `cortex.flash()` (class
  check → consent → rate gate) is inviolable.
- TTS paths: out of scope entirely (Phase 4).
- Do not add dependencies. Do not renumber or rewrite existing tests
  except where a test encodes behavior this phase deliberately changes —
  and say so in the summary when you do.

## D. Acceptance criteria and handoff

1. Every objective has at least one new unit test; objective 1 or 2
   should also gain one Playwright flow (harness: `npm run test:e2e`,
   pattern in `e2e/smoke.spec.js` — seed via `boot()`, ground truth via
   `window.rise`).
2. `npm run test:run` fully green (baseline: 454 across 36 files, plus
   yours), `npm run build` clean, `npx playwright test` all flows green.
3. **Leave the work uncommitted.** Steering reviews the diff, verifies
   claims independently, and commits. Provide a summary listing: files
   touched, tests added, any existing test whose expectations changed
   and why, and anything you discovered outside this scope (report it —
   do not fix it).
4. LF/CRLF warnings from git on Windows are ambient noise — ignore.
