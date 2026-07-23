/**
 * Museum category PINS — cross-institution pool enrichment.
 *
 * A category is a READER INTENT (Old Masters, Landscapes), not an
 * institution: the museum is provenance metadata on the work, never a
 * browsing axis. Each category's pool is the AIC's verified live
 * clauses UNION these pinned works from other institutions, drawn
 * through one ShuffleBag so the variety is real. Provenance shows on
 * every piece (sourceName + attribution from the adapters); it is
 * honored where it is true — on the work — not imposed where it is
 * noise — on the checkbox.
 *
 * CURATION: all pins contact-sheet reviewed (Rijksmuseum harvest
 * 2026-07-22: Rembrandt van Rijn 24, Johannes Vermeer 4, Frans Hals 9, Jan Steen 22, Pieter de Hooch 6, Gerard ter Borch 14, Jacob Isaacksz. van Ruisdael 12, Willem Claesz. Heda 4; Van Gogh 5).
 * Rights: the rijks adapter verifies the Public Domain Mark on each
 * VisualItem at resolution; an unmarked work yields nothing.
 *
 * Future museums (Met pins, Cleveland pins) enter by appending to
 * these arrays — no new UI, ever.
 */

export const MUSEUM_CATEGORY_PINS = Object.freeze({
    "oldmasters": [
        { source: "rijks", id: 200106038 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107928 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107929 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107930 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107931 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107933 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107934 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107935 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107936 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107937 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107941 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107942 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107944 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107945 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107946 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107947 },  // Rembrandt van Rijn
        { source: "rijks", id: 200107952 },  // Rembrandt van Rijn
        { source: "rijks", id: 200109435 },  // Rembrandt van Rijn
        { source: "rijks", id: 200138946 },  // Rembrandt van Rijn
        { source: "rijks", id: 20022176 },  // Rembrandt van Rijn
        { source: "rijks", id: 20026156 },  // Rembrandt van Rijn
        { source: "rijks", id: 20026162 },  // Rembrandt van Rijn
        { source: "rijks", id: 200639587 },  // Rembrandt van Rijn
        { source: "rijks", id: 200642954 },  // Rembrandt van Rijn
        { source: "rijks", id: 200108369 },  // Johannes Vermeer
        { source: "rijks", id: 200108370 },  // Johannes Vermeer
        { source: "rijks", id: 200108371 },  // Johannes Vermeer
        { source: "rijks", id: 200108372 },  // Johannes Vermeer
        { source: "rijks", id: 200109344 },  // Frans Hals
        { source: "rijks", id: 200109345 },  // Frans Hals
        { source: "rijks", id: 200109346 },  // Frans Hals
        { source: "rijks", id: 200109347 },  // Frans Hals
        { source: "rijks", id: 200109348 },  // Frans Hals
        { source: "rijks", id: 200109349 },  // Frans Hals
        { source: "rijks", id: 200109350 },  // Frans Hals
        { source: "rijks", id: 200109374 },  // Frans Hals
        { source: "rijks", id: 20027997 },  // Frans Hals
        { source: "rijks", id: 200107997 },  // Jan Steen
        { source: "rijks", id: 200107998 },  // Jan Steen
        { source: "rijks", id: 200107999 },  // Jan Steen
        { source: "rijks", id: 200108012 },  // Jan Steen
        { source: "rijks", id: 20015865 },  // Jan Steen
        { source: "rijks", id: 20015866 },  // Jan Steen
        { source: "rijks", id: 20015867 },  // Jan Steen
        { source: "rijks", id: 20015868 },  // Jan Steen
        { source: "rijks", id: 20020404 },  // Jan Steen
        { source: "rijks", id: 20020408 },  // Jan Steen
        { source: "rijks", id: 20026347 },  // Jan Steen
        { source: "rijks", id: 20026348 },  // Jan Steen
        { source: "rijks", id: 20026349 },  // Jan Steen
        { source: "rijks", id: 20026350 },  // Jan Steen
        { source: "rijks", id: 20026351 },  // Jan Steen
        { source: "rijks", id: 20026352 },  // Jan Steen
        { source: "rijks", id: 20026353 },  // Jan Steen
        { source: "rijks", id: 20026354 },  // Jan Steen
        { source: "rijks", id: 20026355 },  // Jan Steen
        { source: "rijks", id: 20026358 },  // Jan Steen
        { source: "rijks", id: 2006398 },  // Jan Steen
        { source: "rijks", id: 2006409 },  // Jan Steen
        { source: "rijks", id: 200109389 },  // Pieter de Hooch
        { source: "rijks", id: 200109390 },  // Pieter de Hooch
        { source: "rijks", id: 200109391 },  // Pieter de Hooch
        { source: "rijks", id: 200109392 },  // Pieter de Hooch
        { source: "rijks", id: 20028104 },  // Pieter de Hooch
        { source: "rijks", id: 2003051 },  // Pieter de Hooch
        { source: "rijks", id: 200108271 },  // Gerard ter Borch
        { source: "rijks", id: 200108272 },  // Gerard ter Borch
        { source: "rijks", id: 200108273 },  // Gerard ter Borch
        { source: "rijks", id: 200108274 },  // Gerard ter Borch
        { source: "rijks", id: 200108276 },  // Gerard ter Borch
        { source: "rijks", id: 200108277 },  // Gerard ter Borch
        { source: "rijks", id: 20026690 },  // Gerard ter Borch
        { source: "rijks", id: 20026691 },  // Gerard ter Borch
        { source: "rijks", id: 20026692 },  // Gerard ter Borch
        { source: "rijks", id: 20026693 },  // Gerard ter Borch
        { source: "rijks", id: 20026694 },  // Gerard ter Borch
        { source: "rijks", id: 20026695 },  // Gerard ter Borch
        { source: "rijks", id: 200414512 },  // Gerard ter Borch
        { source: "rijks", id: 2009364 },  // Gerard ter Borch
        { source: "rijks", id: 200107958 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 200107959 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 200108484 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015857 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015858 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015859 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015860 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026228 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026230 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026231 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026232 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026233 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 200109354 },  // Willem Claesz. Heda
        { source: "rijks", id: 20028015 },  // Willem Claesz. Heda
        { source: "rijks", id: 20028016 },  // Willem Claesz. Heda
        { source: "rijks", id: 200471064 },  // Willem Claesz. Heda
    ],
    "landscapes": [
        { source: "rijks", id: 200107958 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 200107959 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 200108484 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015857 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015858 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015859 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20015860 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026228 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026230 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026231 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026232 },  // Jacob Isaacksz. van Ruisdael
        { source: "rijks", id: 20026233 },  // Jacob Isaacksz. van Ruisdael
    ],
    "portraits": [
        { source: "rijks", id: 200109344 },  // Frans Hals
        { source: "rijks", id: 200109345 },  // Frans Hals
        { source: "rijks", id: 200109346 },  // Frans Hals
        { source: "rijks", id: 200109347 },  // Frans Hals
        { source: "rijks", id: 200109348 },  // Frans Hals
        { source: "rijks", id: 200109349 },  // Frans Hals
        { source: "rijks", id: 200109350 },  // Frans Hals
        { source: "rijks", id: 200109374 },  // Frans Hals
        { source: "rijks", id: 20027997 },  // Frans Hals
    ],
    "postimpressionism": [
        { source: "rijks", id: 200109305 },  // Vincent van Gogh
        { source: "rijks", id: 200109794 },  // Vincent van Gogh
        { source: "rijks", id: 200672685 },  // Vincent van Gogh
        { source: "rijks", id: 200672686 },  // Vincent van Gogh
        { source: "rijks", id: 200672687 },  // Vincent van Gogh
    ]
});
