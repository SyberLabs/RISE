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
 * WHY WHOLE-COLLECTION VERDICTS ARE RECORDED, NOT JUST SURVIVORS. A pin
 * list says what was kept. It cannot say what was looked at and refused,
 * and that is the more expensive knowledge — without it a later harvest
 * re-proposes the same rejected works and the review is paid for twice.
 * The retirement ledger below is therefore part of the canon, not a
 * comment about it.
 */

/**
 * ASTRONOMY — ESA/Hubble entire, supplemented by NASA.
 *
 * The reviewer's words: "the first ESA/Hubble collection in full is
 * beautiful". A whole-collection approval is unusual and is recorded as
 * one rather than expanded into sixty identical lines that would imply
 * sixty separate judgments.
 */
export const ASTRONOMY = Object.freeze({
    name: 'Astronomy',
    sources: Object.freeze([
        Object.freeze({ source: 'esahubble', all: true }),
        Object.freeze({ source: 'nasa', all: true })
    ]),

    /**
     * Cut from NASA by eye. Live search cannot be trimmed by omission —
     * it re-serves what you leave out — and although this catalog is
     * static, the exclusions are declared in the same shape as
     * `CATEGORY_EXCLUSIONS` so a future live source inherits the ruling
     * rather than needing it re-made.
     */
    exclude: Object.freeze([
        'nasa:8911183',
        'nasa:9010026',
        'nasa:0302062',
        'nasa:9127075',
        'nasa:9126282',
        'nasa:9128663',
        'nasa:9504243',
        'nasa:GSFC_20171208_Archive_e002105',
        'nasa:GSFC_20171208_Archive_e001783'
    ])
});

/**
 * ESO — SHORTLISTED, NOT PINNED. 35 kept from 60 reviewed.
 *
 * "ESO is beautiful but has some imagery of ground facilities and such,
 * thus the additional 35 would also be subject to review." A telescope
 * dome is a fine photograph and the wrong thing to meet mid-passage; the
 * first pass removed the obvious cases and the survivors have not yet had
 * the second look.
 *
 * They are held here rather than in ASTRONOMY deliberately. A shortlist
 * filed as a pin is indistinguishable from an approval a week later, and
 * this is precisely the distinction the curation-only rule exists to
 * keep: a collection is a list of works someone looked at and accepted.
 */
export const ESO_SHORTLIST = Object.freeze([
    'eso:eso1322a', 'eso:eso1740a', 'eso:eso1238a', 'eso:eso0934a', 'eso:eso1131a',
    'eso:eso0907a', 'eso:eso0846a', 'eso:eso0202a', 'eso:eso1625a', 'eso:eso1250a',
    'eso:eso1221a', 'eso:eso1208a', 'eso:eso1119a', 'eso:eso1119b', 'eso:eso1105a',
    'eso:eso0949a', 'eso:eso0925a', 'eso:eso0848a', 'eso:eso9845d', 'eso:eso1723a',
    'eso:eso1027a', 'eso:eso0903a', 'eso:eso0839a', 'eso:eso1031b', 'eso:eso1137a',
    'eso:eso1017a', 'eso:eso0650a', 'eso:eso1006a', 'eso:eso1422a', 'eso:eso1233a',
    'eso:eso0926a', 'eso:eso0755a', 'eso:eso2008a', 'eso:eso1302a', 'eso:eso1303a'
]);

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
 * WHY THERE IS NO LIVE BOTANICAL SOURCE, and why one is not simply
 * switched back on.
 *
 * A Wikimedia botanical service existed once and was DISCONNECTED: its
 * live-search style introduced a stochastic chance of inappropriate
 * imagery. That is the founding case for curation-only — the failure was
 * not a bad query but the impossibility of a good one, because a query
 * cannot promise what it has not seen.
 *
 * So a future botanical register is a QUALITY problem, not an access
 * problem. The bar is a source whose holdings can be reviewed and pinned
 * whole: botanical illustration and photography of a register worth
 * meeting mid-passage. Cooper Hewitt's design drawings are the nearest
 * thing this harvest turned up.
 */
export const BOTANICAL_DEFERRED = Object.freeze({
    why: 'Wikimedia botanical service disconnected — live search admits imagery nobody reviewed',
    wanted: 'a reviewable, pinnable collection of botanical illustration and photography'
});
