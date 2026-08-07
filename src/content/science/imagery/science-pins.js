/**
 * Science imagery — the reviewed curation canon.
 *
 * Contact-sheet verdicts, 2026-08-05, Mateo. Every judgment below was
 * made by a human looking at the image, which is the step no metric
 * replaces (`atr-james-watt` passed every machine check we could devise
 * and still failed on sight).
 *
 * THIS FILE IS THE DECISION; `science-catalog.generated.json` IS ITS
 * RESULT. Runtime code deliberately does not crawl remote catalogs — the
 * Audubon catalog established that boundary and the science sources need
 * it more, because their rights cannot be re-verified at render (see
 * SOURCE-EXPANSION-SPEC §3a, "the API key never leaves the workstation").
 * `scripts/build-science-catalog.mjs` is the controlled refresh.
 *
 * Verdicts are whole collections (or per-work includes), not survivors
 * alone: the retirement ledger records what was refused so later harvests
 * do not re-propose it.
 */

/**
 * ASTRONOMY — reviewed across two passes, 2026-08-05.
 *
 * The first sheet ran at `--limit 60` and so showed 60 of each feed's
 * 100. "The first ESA/Hubble collection in full is beautiful" was
 * therefore a verdict on three fifths of it, and the remaining 95 works
 * across the three sources went to a second sheet. Both passes are
 * folded in here; the spec records the truncation and the fix.
 *
 * TWO SOURCES ARE APPROVED WHOLE AND ONE BY THE PIECE, and the shapes
 * differ because the judgments did. ESA/Hubble and NASA were accepted as
 * collections with named cuts, so they are `all: true` with an exclusion
 * list — expanding them into 173 identical lines would imply 173 separate
 * decisions that were never made. ESO was accepted work by work (54 of
 * 100), because "beautiful but some imagery of ground facilities" is not
 * a verdict a collection can carry.
 */
export const ASTRONOMY = Object.freeze({
    name: 'Astronomy',
    sources: Object.freeze([
        Object.freeze({ source: 'esahubble', all: true }),
        Object.freeze({ source: 'nasa', all: true }),
        /** ESO: 35 kept in the first pass, 19 in the second. */
        Object.freeze({
            source: 'eso',
            include: Object.freeze([
                // First pass — 35 of the 60 shown.
                'eso:eso1322a', 'eso:eso1740a', 'eso:eso1238a', 'eso:eso0934a',
                'eso:eso1131a', 'eso:eso0907a', 'eso:eso0846a', 'eso:eso0202a',
                'eso:eso1625a', 'eso:eso1250a', 'eso:eso1221a', 'eso:eso1208a',
                'eso:eso1119a', 'eso:eso1119b', 'eso:eso1105a', 'eso:eso0949a',
                'eso:eso0925a', 'eso:eso0848a', 'eso:eso9845d', 'eso:eso1723a',
                'eso:eso1027a', 'eso:eso0903a', 'eso:eso0839a', 'eso:eso1031b',
                'eso:eso1137a', 'eso:eso1017a', 'eso:eso0650a', 'eso:eso1006a',
                'eso:eso1422a', 'eso:eso1233a', 'eso:eso0926a', 'eso:eso0755a',
                'eso:eso2008a', 'eso:eso1302a', 'eso:eso1303a',
                // Second pass — 19 of the 40 the first sheet never showed.
                'eso:eso0936a', 'eso:eso0930a', 'eso:eso0840a', 'eso:eso0902c',
                'eso:potw1901a', 'eso:eso1719a', 'eso:eso1520a', 'eso:eso1503a',
                'eso:eso1424a', 'eso:potw1346a', 'eso:eso1236a', 'eso:eso1005a',
                'eso:eso0949b', 'eso:eso0931a', 'eso:eso1532a', 'eso:potw1444a',
                'eso:eso1420a', 'eso:uhd_img_2528_cc', 'eso:eso1412a'
            ])
        })
    ]),

    /**
     * Cut by eye from the two whole-collection sources. Live search cannot
     * be trimmed by omission — it re-serves what you leave out — and
     * although this catalog is static, the exclusions are declared in the
     * same shape as `CATEGORY_EXCLUSIONS` so a future live source inherits
     * the ruling rather than needing it re-made.
     */
    exclude: Object.freeze([
        // First pass.
        'nasa:8911183',
        'nasa:9010026',
        'nasa:0302062',
        'nasa:9127075',
        'nasa:9126282',
        'nasa:9128663',
        'nasa:9504243',
        'nasa:GSFC_20171208_Archive_e002105',
        'nasa:GSFC_20171208_Archive_e001783',
        // Second pass. The first two are not photographs of the sky at
        // all — a mission emblem and a Mars portrait — and the last two
        // are planets, which the reader meets as astronomy of a different
        // register than deep field and nebula.
        'nasa:s72-49079',                       // Apollo 17 mission emblem
        'nasa:GSFC_20171208_Archive_e000333',   // Hubble Takes Mars Portrait
        'esahubble:potw1714a',                  // Alien aurorae on Uranus
        'esahubble:heic1708a'                   // Jupiter's swirling colourful clouds
    ])
});

/**
 * The panel's category list, derived from the verdicts above.
 *
 * Mirrors how `MUSEUM_CATEGORIES` feeds the museum section: the panel
 * reads this rather than carrying its own copy, so a category added here
 * appears in the UI without that file being touched. It deliberately does
 * NOT import the generated catalog — the panel would then carry 111
 * works' metadata in its bundle to render one checkbox.
 *
 * `kind` groups the list the way the museum section groups by manner and
 * subject. One kind today; the split earns its keep when wildlife and
 * Earth arrive and "what am I looking at" stops having one answer.
 */
export const SCIENCE_CATEGORIES = Object.freeze({
    astronomy: Object.freeze({ name: ASTRONOMY.name, kind: 'cosmos' })
});

export const SCIENCE_KIND_LABELS = Object.freeze({
    cosmos: 'The cosmos'
});

/**
 * ESO's shortlist is CLOSED — its 54 approvals now sit in ASTRONOMY above.
 *
 * It was held separately while I believed the 35 first-pass keeps needed
 * a second look, which was a misreading: "the additional 40 would also be
 * subject to review" meant the 40 works `--limit 60` had never shown, not
 * a re-examination of the 35. Both passes are complete, so a shortlist
 * that exists only to say "not yet decided" would now be saying something
 * false — which is exactly the confusion it was created to prevent.
 *
 * The distinction it protected still stands and is worth keeping in
 * words: a shortlist filed as a pin is indistinguishable from an approval
 * a week later, and a collection is a list of works someone looked at and
 * accepted.
 */

/**
 * RETIRED COLLECTIONS — reviewed, refused, and recorded so the refusal
 * survives the next harvest.
 *
 * The Smithsonian probe was worth running and its verdict is that the
 * collection is a SPECIMEN CATALOGUE. Titles are Linnaean binomials,
 * NMNH's holdings are tray photography, and neither belongs behind a
 * reading passage. Nothing here is a fault in the harvester: the rights
 * were clean, the delivery URLs resolved, and the images were simply the
 * wrong thing — which is the only failure a contact sheet can catch.
 *
 * ALL 54 REVIEWED WORKS ARE RETIRED, Cooper Hewitt included, and its
 * inclusion is the deliberate part. Those twelve are a genuinely
 * different register — decorative designs, the art-of tradition rather
 * than the witness-of one — and keeping them would have carried a design
 * museum forward as a remnant of a natural-history harvest. A collection
 * assembled that way is not curated, it is left over. If that register is
 * wanted it gets its own harvest, chosen for what it is.
 */
export const RETIRED = Object.freeze([
    Object.freeze({
        unit: 'NMNH — Vertebrate Zoology (Birds), Botany, Education & Outreach, Mineral Sciences',
        reviewed: 18,
        why: 'low quality entry; specimen photography, not imagery for a reading surface'
    }),
    Object.freeze({
        unit: 'Smithsonian Gardens',
        reviewed: 14,
        why: '14 photographs of flora; retired with the rest of the specimen holdings'
    }),
    Object.freeze({
        unit: 'Cooper Hewitt, Smithsonian Design Museum',
        reviewed: 22,
        distinctWorks: 12,
        why: 'decorative designs — a different register, and one that deserves its own '
            + 'harvest rather than surviving as a remnant of a natural-history one'
    })
]);

/**
 * No live botanical source: live search cannot promise reviewed imagery.
 * A future botanical register needs a reviewable, pinnable collection
 * (illustration / photography), not a query switched back on.
 */
export const BOTANICAL_DEFERRED = Object.freeze({
    why: 'Wikimedia botanical service disconnected — live search admits imagery nobody reviewed',
    wanted: 'a reviewable, pinnable collection of botanical illustration and photography'
});
