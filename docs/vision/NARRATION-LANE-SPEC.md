# Narration lane

**Lane contract for Experience Program voice. Written 2026-08-13.**

Companion: [`AGENT-COMPOSITION-AND-RENDER-SPEC.md`](./AGENT-COMPOSITION-AND-RENDER-SPEC.md) §9.8,
[`RECITATION-SPEC.md`](./RECITATION-SPEC.md),
[`EXPERIENCE-PROGRAM-SPEC.md`](./EXPERIENCE-PROGRAM-SPEC.md) §4.

Status: **in force for Phase 6.** Recitation remains a Chamber presentation.
This contract is the score.

---

## 0. Decision

Narration is a first-class Experience Program track. It is not an audio bed,
not a swell, and not a reading-pace cue.

> **A spoken clip names a voice and a source span. It may duck the bed.
> It may not assign, replace, or silence atmosphere or swells. It may not
> rewrite the source in order to be spoken.**

Chamber recitation (`RECITATION-SPEC`) is how a live reading *presents*
spoken text. This lane is how a composition *scores* it. The Chamber may
perform a narration track; it does not author one by toggling speech on.

---

## 1. Authority

| concern | owner | narration may |
|---|---|---|
| source text | source / Archive | read; never rewrite |
| atmosphere / bed | audio track + project defaults | duck, when authored |
| swell | swell track | not touch |
| reading pace | reading track / session WPM | not steal; voice may subdivide its own span |
| spoken identity | this track | assign a voice asset or library voice id |
| captions | source coordinates | align timing; keep the same characters |

Absence of a narration clip is silence in this lane, not a held bed and
not the project soundscape. There is no narration fallback that could
quietly become atmosphere.

---

## 2. Cue

```js
{
  kind: "spoken",
  voiceId: "af_heart",          // library pack, optional if voiceAssetId is set
  voiceAssetId: "asset-voice-1", // admitted project audio, optional if voiceId is set
  duck: {                       // optional; default is no duck
    target: "bed",              // the only legal target
    floor: 0.18,
    downMs: 150,
    upMs: 600
  },
  words: [                      // optional word clock inside the clip span
    { text: "Happy", fromCharacter: 0, toCharacter: 5, durationMs: 280 }
  ],
  pronunciations: [             // review table; never edits the source
    { source: "Cholmondeley", spoken: "CHUM-lee" }
  ]
}
```

Rules:

- `kind` is only `spoken`. `hold`, `silence`, `soundscape`, `tone`, and
  `swell` are audio/swell kinds and refuse here.
- At least one of `voiceId` or `voiceAssetId` is required. Neither may be
  a URI. A `soundscape:` or `swell:` id is not a voice.
- `duck.target` is `bed` or the cue refuses. Floor is in `[0, 1]`.
- Ducking is authored. Enabling speech does not duck by ambient policy.
  That matches Recitation §5: automatic ducking is not a presentation
  consequence; a scored clip may still request a bed duck.
- `pronunciations[].source` must occur in the spanned text.
  `spoken` is what a synthesizer or pack lookup may say. Captions and
  the Experience Program keep `source`.
- `words` stay inside the clip's source span. They do not move the
  reading track. If present they subdivide the clip's compiled window;
  they do not extend it.

---

## 3. Voice admission

Spoken audio enters through the acquisition gateway as kind `voice`,
not as a generic bed.

- MIME: `audio/wav`, `audio/mpeg`
- duration is required before admit
- hash, rights, and human verdict are the same gate as any project asset
- generic `audio` and `video` kinds remain deferred
- a library `voiceId` names a pack already in the product; it is not a
  network fetch
- generated speech needs the same consent/cost acknowledgement as
  generated images, and does not become verified rights

The Experience Program still names durable ids, never blob URLs.

---

## 4. Timing and captions

Session compile remains the atom clock for the reading. Narration occupies
the presentation window of its source span.

When `words` are present, captions may follow those windows. Every caption
still carries `sourceId` and character offsets from the score. Captions are
never OCR and never the pronunciation's `spoken` form.

When the voice is the clock for Chamber recitation, that remains a
presentation rule (`RECITATION-SPEC` §1). Export does not invent a second
atom timeline.

---

## 5. Render and mix

The render plan carries `narrationRuns` beside `audioRuns`. The offline
mixer:

- keeps mixing the bed from the audio track
- multiplies bed gain by the authored duck while a spoken clip is active
- never applies that duck to swells
- mixes the spoken layer on its own path, outside named musical gains

Unsupported: treating a missing voice as a soundscape, substituting a
different voice, or omitting a required spoken clip.

---

## 6. Editing

Humans and agents assign, replace, and erase spoken clips through the
same span vocabulary as visual and audio. Those operations:

- compile onto a `narration` track
- do not write `defaults.audio`
- do not create swell or soundscape cues
- enter the same undo history as other Workshop commands

A person can inspect and undo every spoken assignment. An agent cannot
gain a voice-only power the score cannot already hold.
