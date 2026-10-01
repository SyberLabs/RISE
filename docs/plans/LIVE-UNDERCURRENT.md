# The undercurrent

Step 1 of the Dive redesign. A Dive stops being a detour that vanishes on Surface and becomes a **saved thing hanging off one place in the reading**. Not built beyond what is listed under "What is built"; nothing here has been tried with a real provider or a real voice.

## Why
Three things were unclear to a reader: what a second Dive does, where they forked from, and where the answer went once they surfaced. All three are one missing idea: the reading has a spine (the main Current), and a Dive belongs to a point on it.

## Model
```
Main reading:  ─ ─ ●(Dive 1) ─ ─ ─ ●(Dive 2) ─ ─ ▶
                      │               │
Undercurrent:     question 1       question 1
                  question 2       (answer)
                  (follow-ups)
```
- **Flat.** A Dive has one anchor (a segment and a character in the main Current, plus a short quote of the words there). Dives are never nested.
- **Follow-ups join the same Dive.** Asking inside a Dive adds a turn to that Dive's entry, at the same anchor. It does not open a second Dive.
- **Kept.** Each turn keeps the reader's question, the model's answer as far as it got, and how it ended: `answered`, `cut-short` (a follow-up or Surface came first), or `failed`. The entry survives Surface, the end of the reading, and Stop.
- **Answers are the model's words**, shown as text only (`textContent`), labelled as written when asked.

## Where it lives
- `src/live/undercurrent.js`: the store. Pure data, bounded (50 Dives, 20 turns each, 20,000 characters of answer per turn), no timers. Everything handed out is a frozen copy.
- `src/live/runtime.js`: opens an entry when a Dive begins, adds a turn for a follow-up, and keeps each turn's answer in step with the side Current. `runtime.undercurrent()` reads it; `snapshot().dive` says which Dive the reader is in (`null` outside one) and whether a turn is still opening.
- `src/live/host/undercurrent.js` and `controls.js`: the **breadcrumb**, the **fork markers** in the transcript, and the **Undercurrent panel**. They draw words; they keep no time and no state of their own.

## Behaviour
- **Dive from the main reading:** as before (the reading and voice are held, #359), plus an entry.
- **Ask inside a Dive:** a follow-up. The previous side Current is closed (its answer is kept as far as it got), a new one opens at the same anchor, and the reading you left stays held where it was. Refused only while a turn is still *opening*, so two questions cannot open at once.
- **Surface:** returns to the anchor, as before. The entry stays.
- **A Dive that cannot open** leaves no entry if it was the first turn; a follow-up that cannot open is kept, marked `failed`, and you are still in the Dive and can ask again or Surface.
- **Breadcrumb**, while in a Dive: where you are, and the quote Surface returns to.
- **Markers:** in the transcript, under the passage a Dive was taken from, one line per Dive, which opens that Dive in the panel.
- **Panel:** every Dive, in order, always reachable (during the reading, in a Dive, after it ends).

## What a follow-up does not do yet
The provider is **not** told what was asked and answered earlier in the same Dive. A follow-up such as "why?" is answered from the passage alone. Passing earlier turns to the provider changes the open request that every adapter validates and builds prompts from, and puts earlier model text into the next prompt; that needs its own review and is the next piece, not part of this one.

## Persistence
The Live reading itself is not saved anywhere (nothing in `src/live` writes to storage), so an undercurrent that outlived the page would hang off a reading that is gone. It therefore lives as long as the run. `runtime.undercurrent()` returns plain, serialisable data, so saving it later with a reading is a small step.

## Not decided here
Reading a Dive's answer aloud (step 2: off by default). Diagrams (step 3).
