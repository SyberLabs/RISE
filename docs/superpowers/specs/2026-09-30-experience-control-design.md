# Experience control: the first governed runtime loop

Status: approved for implementation in chat on 30 September 2026.

## Purpose and requirements

RISE's reader needs to change a running experience without losing the words or their place. A provider model will need the same operation through a plugin. The renderer needs sole authority over frames and safe transitions. These needs justify a small provider-independent control boundary in the existing live runtime.

The first deliverable is a scoped subset of VISION section 7: an Attractor reading, the phrase **more vibrant**, and a first visible brightness change within 1,000 ms of a submitted local command. Composition may already be complete. Playback must continue through the adjustment. The full voice-demo claim also needs a real-recognizer measurement from the end of the spoken phrase; that measurement is deferred until a real device is available and cannot be replaced by typed or fake-recognizer evidence.

Brightness is an experiment in what feels more vibrant, not a proven perceptual equivalence. Real speech-recognition latency and perceived quality must be reported separately from deterministic control latency.

## What is removed from this first scope

Do not build a general scene language, widget system, dynamic renderer registration, public SDK, provider-native audio adapter, observation upload, or new provider transport. Do not widen the sealed composition protocol to permit late state.set events. Do not create a second Player, runtime, scheduler, or persistent event store.

Discovery, commands, and receipts are internal contracts exercised by the local reader first. Future provider adapters can consume the same boundary after its behavior is demonstrated. This document does not claim that a provider model can operate it yet.

## Existing foundations

Base: origin/main at 64c046a (merged PR 362).

- src/live/runtime.js owns active main/side runs, one Player per run, a bounded journal, and the narration governor.
- src/live/state-visuals.js maps passage-authored state to Attractor intensity in the readable range 0.4 through 0.75.
- src/visuals/attractor.js has setIntensity; its renderer range is broader than the reader-safe range.
- src/visuals/visual-field-director.js owns active field lifecycle and transitions.
- src/components/Chamber.js mounts the actual Attractor and adopts the existing live Player.
- src/live/host/controls.js supplies typed questions and a Speak control that currently holds narration before recognition.
- src/live/capabilities.js provides canvas and reduced-motion negotiation.

## Contract and ownership

The live runtime gains discovery and control operations independent of the composition stream. The renderer/host reports actual active capability; a manifest alone is insufficient evidence that it is mounted.

Discovery returns an immutable description of the currently controllable surface. Initially this is Attractor with one numeric intensity parameter: minimum 0.4, maximum 0.75, default 0.65, readable over text, canvas required. The manifest lives beside the trusted renderer and is tested against its accepted parameter and the live readable bounds. A device with no canvas, an unsupported active surface, or no presented run exposes no adjustable surface.

The command shape is a closed data object: { surface: 'attractor', parameter: 'intensity', value: number }. Reject unknown fields, unknown names, non-finite values, and executable data. Finite values outside the readable range are clamped; the receipt distinguishes requested and effective targets. Transition duration is a RISE policy, not a caller parameter.

The runtime selects the visible run itself. Controls work during main playback, an explicitly held main reading, and side playback in a Dive, including after composition completes. Starting, ended, failed, and stopped runs refuse controls. A refusal neither pauses playback nor opens a provider request.

Extend the existing runtime-to-Player-to-Chamber ownership path with a small active-field control seam. VisualFieldDirector validates that its active record is still current and delegates to that record's control method; the mounted Attractor record performs the bounded intensity update without remounting. Its transition cancellation shares the record's existing destroy lifecycle and generation ownership. The current scalar setter and director do not already provide interpolation; that is new work. Only the mounted renderer can confirm availability and acceptance. Do not resolve acceptance merely because an event was emitted or a manifest was found.

Discovery is advisory until delivery: if presentation is pending, the visible run changed, the Chamber was destroyed, page mode removed the field, or playback ended between discovery and delivery, return a refusal. Recheck run and field identity at delivery. A command must never be accepted for an orphaned renderer.

## Receipts and local observation

A control returns a receipt containing status (accepted or refused), a stable reason code for refusal, the addressed surface and parameter, and requested/effective target values when accepted. Accepted means the renderer has scheduled the transition; it does not claim the target is already visible.

Use the existing bounded in-memory runtime journal for accepted/refused controls. Keep renderer transition state available for deterministic tests and truthful local inspection. Do not introduce persistent storage or send reader actions to a provider in this slice. Full observation subscriptions and cross-provider replay remain later work.

## Temporal semantics

During normal playback the renderer interpolates intensity over 320 ms using its own animation timing. A held field applies the target in one repaint without advancing its held simulation; this avoids scheduling a new animation while the reading is held. The first painted change must occur within 1,000 ms of local submission in the supported browser test. Duration is deliberately shorter than the latency budget; a target scheduled exactly at the deadline is insufficient.

A repeated command retargets from the current effective intensity toward the next bounded target. The newest target replaces the previous target; transitions do not queue. The phrase increases the current target by 0.1, capped at 0.75. At the cap it returns a truthful no-change acceptance.

The adjustment is local to the active passage/field lifetime. A successor authored cue replaces it; it does not rewrite composed content or modify future passages. Dive, Surface, field replacement, and Stop cancel the departing field's transition. A late callback cannot affect a successor field.

Reduced-motion mode must preserve the renderer's existing stillness policy: apply brightness in one repaint, without the 320 ms tween or advancing the field simulation. If the renderer cannot support that honestly, it exposes no control and gives a visible refusal. Do not create a crossfade by remounting the Attractor for a parameter change.

Narration remains the authority for reading position. Control delivery never calls pause, play, restart, replay, extend, or voice enqueue. Rendering uses its own frame timing without becoming a second reading clock.

## Reader interaction

Provide a separately labelled typed visual command and submit action in the existing live controls, usable without speech or a provider. Match only the normalized closed phrase more vibrant, allowing capitalization, spacing, terminal punctuation, and an optional please. Unknown input stays visible and produces an explanation; it is never guessed into a visual action or silently sent as a Dive.

Retain the existing Speak behavior for questions and interruption. If speech recognition is available, add a dedicated visual-listening action that deliberately leaves narration running. It applies only the closed visual grammar; unsupported or misheard words stay visible. Reuse the existing recognizer and its privacy explanation. Only one listening mode may own it at once. Cancellation and recognition failure leave playback untouched.

The speech path is best-effort because device recognition may hear narration. Browser tests may use a fake recognizer but must identify that limitation. Typed input provides the deterministic demo and latency baseline.

Report actual outcomes accessibly in the existing status/error presentation. Do not tell the reader a visual changed if the host refused it or the target was already at its limit.

## Validation and acceptance

- Closed grammar accepts the intended phrase and rejects negation, extra instructions, lookalikes, and arbitrary executable text.
- Manifest validation and control parsing reject unknown fields and unsupported surfaces; numeric bounds are verified at the renderer boundary.
- Runtime tests apply controls after composition completion while playback remains live; the same Player and voice remain active and no adapter request is opened. Delivery refuses when presentation is pending or the run/field disappears after discovery, including playback completion, Chamber destruction, and page-mode departure.
- Temporal tests verify interpolation, rapid retargeting, limit behavior, field replacement, reduced-motion behavior, and cleanup after Stop/Dive/Surface.
- Controls tests verify typed delivery, non-holding visual speech, preserved existing question speech, failure visibility, and cancellation.
- A real browser test drives the actual live host, Player, Chamber, and Attractor with the deterministic provider. It verifies painted output changes within 1,000 ms, the renderer instance remains mounted, and playback advances across the adjustment. Dataset values alone are not visual evidence.
- Existing live protocol/reducer, runtime, controls, renderer lifecycle, and system-design tests remain passing. Run the repository's required CI checks before proposing integration.

## Completion claims and remaining work

The result may be called a local governed control loop when discovery, validated delivery, truthful receipts, smooth rendering, and uninterrupted playback have run successfully. It cannot be called full Stage 1/2, a cross-provider plugin, a perceptually validated more-vibrant experience, or verified real-microphone operation on fake-device evidence.

Next work can expand the catalog and expose this proven boundary through existing provider/MCP adapters. Consented upward observation follows separately; it does not arrive as an incidental analytics channel.
