# The Gallery look follows its text with museum works

RDR-023 part 2, 2026-10-07. Mateo asked for the mood wording to be drafted and built, then reviewed in the pull request. Everything below is that draft. Each line is one string in `src/core/passage-visuals/treatments.js`, so a change to the wording is a one-line edit.

## What a Gallery reading draws

Follow text keeps a reading in one family (R6). Part 1 held flame readings to flames. Before this change, a Gallery reading that followed its text also drew flames, which put it in another family.

Now the family is worked out from the reading's configuration:

- **`gallery`:** the Gallery look's Turrell shelf, or a shelf made only of museum and science collections (`aic-…`, `sci-…`).
- **`flame`:** everything else, as before. That covers Living Flame, an empty shelf, and other engines.

A Gallery reading follows its text with one museum collection per passage, chosen by the passage's mood.

## The mood lines

| Mood | Collection | Line |
|---|---|---|
| Calm, or no clear signal | Landscapes (`aic-landscapes`) | Land, sea and sky with figures small or absent: calm, openness, distance, rest, reflection. |
| Ordinary, and joy | Monet & the Impressionists (`aic-impressionism`) | Light and weather in loose, bright brushwork: ordinary life, pleasure, the passing moment, release. |
| Agitation, conflict | Van Gogh & Post-Impressionists (`aic-postimpressionism`) | Saturated colour and emphatic structure: agitation, conflict, longing, a mind under strain. |
| Grief, the solemn | Old Masters (`aic-oldmasters`) | Weighty, formal painting on dark grounds: grief, gravity, faith, myth, the solemn and the tragic. |

The moods are the same five that local direction already reads for flames, from the conductor's valence and arousal. The intensity band works as before.

## What it does not do

- **Jev.** A Gallery reading follows its text locally and never sends it to Jev. Jev's request schema (`score-protocol.js`) offers flames only, and Kev on a reader's computer validates that schema. Offering museum works to Jev means a schema bump, which would break Kev until it updates. When that happens, Jev can also choose the subject collections (Ships, Knights, Portraits, Flowers, Animals, Astronomy), which need the text read rather than a mood measured.
- **Colour.** Museum works keep their own colours. The reading's colour theme still holds the page, the type and the chrome.
- **Credits.** Every work keeps its label and credit as the cortex draws them today (the credit rulings are unchanged).
- **Offline.** If a collection can't load, the scene that was showing holds, and for the Gallery look that is Turrell light. Nothing breaks.

## For review

1. The four lines above.
2. The mood mapping. In particular, "ordinary" and "joy" both draw the Impressionists, at different intensities.
3. Whether Flowers (tenderness) should take calm-and-positive passages from Landscapes.
