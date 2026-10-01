# Addressable visual catalog: first admission slice

Status: approved by the reader's “proceed” on 1 October 2026. This is the next stage after PR #364, based on its verified commit `450341fb`. It does not claim that all of VISION.md Stage 1 is complete.

## Objective and requirements

Give a reader and a model an honest, searchable description of the procedural library, then demonstrate a live reading opening with a choice admitted from that catalog. Keep the existing Current, Player, Chamber and renderer ownership.

The reader needs recognizable descriptions and a working choice. The model needs stable names and bounded data. Contributors need a test tying each advertised ability to its renderer. A source module is not a catalog surface: use the nine entries of `LISTED_PROCEDURAL_PATTERNS`, not the count of files in `src/visuals`.

Delete speculative SDK registration, provider-specific discovery transports, guessed memory budgets, and blanket protocol expansion from this slice. No model-generated code, new inference, interaction uploads or second playback pipeline.

## Findings that govern the design

- `src/core/visual-registry.js` already owns eight procedural patterns plus Attractor and their descriptions.
- `src/core/rise-current.js` accepts `still`, `attractor` and `genesis`. It lowers imagery to persistent field cues. `src/live/protocol.js` shares that closed vocabulary.
- `Chamber.mountVisualFieldCue` mounts particular fields; a registry ID is not automatically one of those fields. Genesis uses the Klee field, so the Klee mapping must be explicit and tested.
- The specimen path in `src/core/render/chamber-stage.js` supports the nine registry entries. Specimen support is different from admission to a running reading.
- `VisualNavigator` supplies taxonomy and specimen boundaries. `VisualLab` is a Living Flame editor; it is not a generic catalog.
- Attractor intensity has a verified mutable contract. Klee presets and Harmonograph climates have existing enum choices. Other external parameter and performance claims require separate verification.

## Alternatives

1. **Recommended: catalog with verified admission.** Describe the nine registered surfaces, distinguish specimens from live choices, and admit only mappings whose live rendering is proven. A reader can inspect the whole library without being offered a broken live choice.
2. **Admit all nine immediately.** Requires renderer adapters and lifecycle coverage for the currently unmapped surfaces. Larger first change, with more transition and performance risks.
3. **Expose provider tools first.** Reaches the existing Attractor loop sooner, but leaves providers with a compiled-in vocabulary and postpones the catalog foundation. This is a valid alternative if provider integration is the immediate priority.

## Catalog and trust boundary

Keep immutable metadata and pure filtering in core. Reuse registry identity and descriptions rather than making another independent list. Renderer imports stay lazy and outside metadata; core must not depend on the live layer.

Each entry states its ID, name, description, tags, actual capability requirements, verified parameter descriptions, and whether it supports a specimen, a live opening, and a mutable live control. These are separate claims. Missing capability information fails closed for live admission. The no-imagery `still` behavior remains the capability floor.

Do not pretend that a parameter accepted by a generator is already addressable through Current data. Parameters without an admitted delivery path are described as fixed or renderer-owned. Only the existing Attractor intensity control is advertised as mutable in this slice. Performance cost is explicitly unmeasured until a reproducible measurement exists; no fabricated frame, memory or worker budget.

Filtering uses a supplied capability record and bounded text search over catalog metadata. It executes no model input. Unsupported or unknown IDs are refused as data at admission; they cannot silently mount nothing.

## Reader experience and live admission

Add a small, lazy-loaded searchable catalog view using the existing taxonomy and specimen support. Cards show why a choice is unavailable and distinguish a specimen preview from a live reading. Do not expand the Living Flame editor or change the existing reader selector's behavior merely to fit catalog cards.

For the first admission demonstration, prove Attractor and the Klee-to-Genesis mapping through the existing Chamber path. Keep the three existing Current names compatible. A trusted catalog admission mapping produces the existing validated Current representation; do not widen the visual enum to every registry ID as a shortcut. Start with fixed authored defaults and the existing Attractor mutable intensity contract. Other entries remain searchable specimens until their live adapter is implemented and verified in a later slice.

A deterministic sample opens through the same live host/runtime/Player used today. No provider credential is required and no alternative catalog playback engine is created. On a device without the required drawing capability, the sample remains a readable no-imagery experience with an explicit explanation.

## Verification and completion

1. Catalog identities/descriptions match the registry; immutable contracts and unknown-input refusal are checked.
2. Tests distinguish specimen, live admission and mutable-control claims. Parameter defaults and bounds match the relevant renderer or existing contract.
3. Capability filtering and the text-only floor are exercised with supported and unavailable drawing environments.
4. A real-browser test searches, chooses an admitted surface, opens a Current and proves the expected mounted renderer paints while narration advances. Metadata or a receipt alone is insufficient.
5. Existing sealed/streaming Current validation, renderer lifetime, Dive/Surface, and control behavior remain covered. Required CI and browser gate run; the first-load budget must hold.

Acceptance is this first catalog/admission slice, not completion of every visual adapter or Stage 1. Real provider-host operation, real microphone timing, perceptual suitability and per-surface performance costs remain explicitly unverified.

## Review decision

Approve the catalog-with-verified-admission approach, or choose provider tools first. Implementation planning and LUNA implementation follow approval of this design. The catalog work is isolated in its own managed worktree; PR #364 is unchanged and remains open.
