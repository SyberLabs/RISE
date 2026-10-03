# RISE Performance Foundation Execution Plan

> **For agentic workers:** Use subagent-driven-development. LUNA medium/high owns implementation; the coordinator owns interfaces, review, integration and live verification.

**Goal:** Progress from the accepted Composer demonstration to a bounded reciprocal Live demonstration using one semantic center.

**Architecture:** Current is an adapter to the durable Experience Program. Live proposals become Experience Events admitted against a commit horizon, then use the existing Session, Player and Chamber. Host adapters do not gain independent runtime semantics.

**Spec:** Human-supplied RISE Roadmap at `C:/Users/MATEO/.codex/attachments/decf636c-e241-47d1-b1e1-ee72a610e3ac/Pasted text.txt`; approved sequence: Gate0 plus transport repair, semantic convergence, small catalog, events with temporal authority, reciprocal Live demo.

## Global Constraints

- Begin from reviewed `04d2b8286d70ebc404e437952b6708bd4c2f9123` in the existing isolated `codex/chatgpt-demo` worktree. Original checkout source is not the implementation target.
- Preserve reader Begin, cancellation, host attribution, schema refusal and no shared inference. Never request or expose credentials.
- One durable score format, one Player/Chamber path. No new renderer execution authority, provider proxy, database, arbitrary generated UI or neural-model download in this slice.
- Public testing of new code requires concrete exact-release authorization. Previous temporary Worker is removed. Local code and read-only host discovery can proceed independently.
- Stop at provider capability uncertainty only for work dependent on that uncertainty; progress on provider-independent foundations.
- Use meaningful failing regressions, narrow commits and task review. Coordinator owns config/workflows/publication. Never silently weaken CI or widen access.

### Task 1: Repair bounded MCP transport

**Files:** inspect/change `worker/mcp-server.mjs`, its tests, `src/live/hosts/mcp-port.js`, its tests, `src/live/host/LiveHost.js`, its tests and `e2e/live-mcp.spec.js`. A shared pure transport-size module under `src/live/hosts/` is allowed where both sides genuinely need it. Do not change authored Experience Program or global Current schema limits.

**Contract:** Set an explicit MCP-only Current serialized UTF-8 payload budget of 65,536 bytes and a complete guest-message UTF-8 budget of 262,144 bytes. The Worker retains its existing request-body cap. This conservatively reserves envelope headroom; it does not promise arbitrary host metadata can fit. Both input-only and result-only delivery must enforce the same Current budget, before holding content at Begin. Over-budget host envelopes or Currents from the actual parent should expose bounded, actionable failure rather than silent waiting. Unknown/untrusted messages remain ignored. Refused content cannot be played, and a corrected valid proposal must recover. Existing valid duplicate input/result plays once.

- [ ] Reproduce the reported accepted-near-limit/silent-drop path before edits.
- [ ] Write and run RED integration regressions for Worker refusal, guest input/result policy, UTF-8/escaped boundaries, failed proposal followed by corrected input, and oversized trusted envelope without stale Begin content.
- [ ] Implement the smallest budget/refusal interface with no global score restriction. Add a guest error subscription only if needed, and dispose it alongside existing lifecycle resources.
- [ ] Run focused Worker/guest/host unit tests and affected browser integration tests. Report exact commands/results and self-review; commit only your files.

### Task 2: Establish Gate 0 evidence and prepare its smallest probe

- [ ] Read current official ChatGPT Voice/plugin/UI documentation and inspect the available real host surface. Distinguish desktop GPT-Live from browser voice.
- [ ] Specify one persistent visual surface and one typed visual mutation operation; no widening of Current or full Live protocol for the probe.
- [ ] Establish observable speech/tool/received/visual-applied/reader-return timestamps, preserving uncertainty where a host does not expose them. Do not fake native voice events or infer interleaving from tool calls alone.
- [ ] Prepare and test the bounded probe through a LUNA implementer after the transport task, then obtain exact-release/permission approval where necessary for the real experiment.
- [ ] Record supported-interleaving, synchronized speech suspension, turn-only behavior, or inconclusive access. Do not select ChatGPT Live based on Composer acceptance.

### Task 3: Converge Current on the existing semantic score

- [ ] Audit canonical program validation/lowering, Session/Player integration, and existing live reducer. Identify the smallest bridge rather than inventing another runtime.
- [ ] Write a short concrete interface brief from the audit: stable source coordinates, provenance, narration, visual mapping, admitted state and supported Current capabilities.
- [ ] Implement Current-to-program convergence with strict refusal and behavior equivalence tests; preserve Dive anchors and source relationships. Review before downstream work.

### Task 4: Expose a small truthful instrument catalog

- [ ] Audit existing renderer/manifest/catalog registries before creating new ones.
- [ ] Choose three already-supported representative instruments and describe only executable parameters, bounds, accessibility and capability requirements.
- [ ] Validate manifests against actual implementation and expose bounded search/describe using the existing catalog where possible. Avoid exhaustive static model prompts and premature SDK stabilization.
- [ ] Demonstrate model-selected supported configuration with refusal of unsupported parameters; review the slice.

### Task 5: Implement events with temporal authority

- [ ] Specify and test the first event reducer against canonical program prefixes: source text, visual selection/parameter change, existing audio selection and pace. Version the proposal protocol explicitly.
- [ ] Define committed history, active bounds and editable future together. Test source offsets, event ordering/idempotency, refused past edits, safe active controls, future changes and cancellation.
- [ ] Reuse existing Session/Player/Chamber execution through an incremental bridge; never recreate a competing score or playback clock.
- [ ] Materialize the minimal completed event fixture into a valid durable program as a convergence test; no Vault/platform expansion.

### Task 6: Prove one reciprocal Live demonstration

- [ ] Select the host from Gate0 evidence. If ChatGPT is turn-only or inconclusive, keep Composer and use an explicitly authorized reader-owned live transport rather than pretending browser TTS proves model interleaving.
- [ ] Run a single concept explanation with one visual change, one parameter change, atmosphere, and a reader interruption/redirection without restarting the experience.
- [ ] Separate scripted deterministic runtime proof from actual-model reciprocity. Record speech-clock capability and limits; browser TTS remains compatibility fallback.
- [ ] Run affected verification, review the final branch and publish only through the existing authorized PR flow. Do not claim the full roadmap or production readiness.
