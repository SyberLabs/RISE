# ADR 0001 — Affective-semantic layer

Date: 2026-09-29
Status: accepted for a first inspectable version; the learned encoder is not accepted

## Context

RISE composes text, pace, image, type, and sound. A later composer needs to compare candidate experiences. A general-purpose generative model asked "is this good?" cannot show its work, and it would sit on the wrong side of the rule that reader material stays local. A sentiment label, or a rule that blue means sad, throws away the distinction between a measured rendering parameter and an inference about meaning.

## Decision

Add `src/affect` as a library the reading runtime does not import.

The shared object is Experience State version 1. Twelve continuous axes are the primary space: valence, arousal, dominance, tension, intimacy, warmth, uncertainty, expansiveness, perceptual density, motion energy, solemnity, novelty. Each value carries a source (`measured`, `inferred`, `derived`, `prior`, `absent`) and a confidence. A missing axis is omitted or null. It is not stored as zero. Auxiliary emotion probabilities are allowed and are marked auxiliary. They are not the state.

Text is encoded by a negation and intensifier window over a small lexicon, then a linear readout. The coefficients are written in source. They were not fitted. Confidence is capped at 0.7. A bag-of-words lexical VAD is kept as a weak baseline so the window can be shown to do something the bag does not: "I am not happy" changes sign only in the window encoder.

Non-text channels do not get a network when RISE already knows the parameter. Palette swatches become hue, saturation, and luminance. Warmth is the colorimetric temperature of that hue, and only when saturation is high enough for the hue to be stable. Valence is not set from color. Words per minute are stored as measured; their placement on arousal is a prior centered at 220 WPM, inside the legal pace window of 50 to 1000. Audio accepts tempo, loudness, spectral density, rhythmic activity, brightness, and dynamics. Brightness stays a measurement.

The evaluator returns alignment, coherence, contrast, continuity, sensory load, conflict, intentional tension, and uncertainty, plus alignment per modality. Contrast is not failure. It is scored as intentional tension when the intent says so. A fused alignment can hide one loud channel, so the per-modality figure is part of the result. `evaluateCandidate` clones the candidate, checks it was not mutated, and returns proposals separately from observations, scores, and interpretations.

Trajectories are word windows, pacing-curve samples, and shape labels (escalation, release, contrast, suspension, climax) computed from the series.

Pairwise judgments are frozen on write. Bradley–Terry scores are a separate object, per question, so prompts are not pooled. The fit script exits without writing weights until 24 judgments are marked human.

ONNX export is a Gemm of the same matrix. WebGPU is not required.

## Consequences

Manual configuration keeps working, because nothing in the player calls this module. The first-load graph does not gain the layer. The architecture diagram gains an `affect` node because the adapters read palette and pace definitions from `src/core`.

What is production-ready: the schema, the flag, the immutable judgment log, the evaluator's refusal to mutate a candidate, and graceful absence when a modality or encoder is missing.

What is a prior, not a finding: every coefficient that maps a feature onto an axis, including pace to arousal and hue to warmth.

What was run offline, and is not part of the player: PERT-EmoPair and Reward-EmoPair scored the 24 passages on CPU; a frozen MiniLM-L6 linear probe was fit to the mapped PERT scores and failed leave-one-out on valence; a local Qwen2.5-1.5B teacher answered the existing HTTP hook because no hosted API credential was present. A music-emotion network was not run. Human pairwise judgments were not collected, so the window readout is still unfitted.

## Rejected

A read-time generative judge. A discrete emotion classifier as the primary space. Copying published benchmark numbers onto RISE passages. Training on labels written in order to have labels. Making WebGPU mandatory for a few hundred parameters.
