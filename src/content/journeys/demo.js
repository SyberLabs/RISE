/**
 * The Demonstration — a short tour of the procedural range.
 *
 * WHY THIS IS NOT A JOURNEY, AND SAYS SO
 * ──────────────────────────────────────
 * JOURNEYS-SPEC §1.1 is explicit: a Journey is an argument in which each
 * movement revises the one before it, and "several works on a theme"
 * is an anthology rather than an argument. A survey that cycles through
 * every engine we have is precisely an anthology — that is its whole
 * purpose — so publishing it as a Journey would make the word mean
 * nothing, which is the one thing the spec exists to prevent.
 *
 * So `kind` is `demonstration`, the card says what it is, and the
 * figures below make no editorial claim. In *War*, a figure names the
 * line where the poem puts the thing it draws — the sword at 251, the
 * chariot at 712 — and that correspondence is the point. Here the
 * figures are spaced evenly through two short routes so that each
 * engine gets its turn. That is a demo reel, and calling it anything
 * else would cheapen the real mapping next door.
 *
 * WHAT IT IS FOR
 * ──────────────
 * *War* is seventy-five minutes. It should be: it is three works making
 * one argument. But it cannot be what you open in front of somebody who
 * has four minutes, and a reader deciding whether any of this is for
 * them should not have to commit an evening to find out.
 *
 * This runs about eight, uses the same compiler, the same handoff, the
 * same schedulers and the same living field as *War*, and shows every
 * procedural work that exists. Nothing here is a special path. If the
 * Demonstration works, the machinery works.
 */

/**
 * Two routes, disclosed (§1.4). Both are excerpts and both say so.
 */
export const DEMO_PASSAGES = Object.freeze([
    {
        id: 'demo-paradise-lost',
        workId: 'paradise-lost',
        division: 'Book VI',
        label: 'The Chariot, the Fall, and Chaos',
        role: 'proposition',
        language: 'en',
        note: 'Book VI\'s last movement: the Son goes forth, the crystal wall '
            + 'opens, and they fall nine days through Chaos.',
        excerpt: {
            from: 'So spake the Son, and into terrour changed',
            to: 'fear to transgress',
            note: 'The closing ninety lines of Book VI.'
        }
    },
    {
        id: 'demo-storm-of-steel',
        workId: 'the-storm-of-steel',
        division: 'Guillemont',
        label: 'The Hurricane',
        role: 'transmission',
        language: 'en',
        note: 'The Somme bombardment, where the perceptible whole disappears.',
        excerpt: {
            from: 'While this hurricane was raging I went along my platoon front',
            to: 'kept shouting my name to keep my men together',
            note: 'A route through the bombardment.'
        }
    }
]);

export const DEMO_JOURNEY = Object.freeze({
    schemaVersion: 'rise.journey.v1',
    id: 'demo-procedural',
    domain: 'literature',
    // NOT `authored-journey`. See the header.
    kind: 'demonstration',
    title: 'Demonstration',
    subtitle: 'Eight minutes, and every engine we have',

    thesis: 'A short tour of the procedural range: two passages, fourteen '
        + 'engines, and the same machinery a full Journey runs on.',
    transformation: 'You will know within a few minutes whether this is for you.',
    terminalCondition: 'A demonstration, not an argument. War is next door, '
        + 'and it takes seventy-five minutes because it earns them.',

    estimatedMinutes: 8,
    wpm: 200,
    chunkMode: 'phrase',
    phraseFloor: true,
    status: 'publishable',
    openRequirements: Object.freeze([
        'The Demonstration is scored for silence: it names no soundscape, '
        + 'because none of the three War composes are written yet.'
    ]),

    movements: Object.freeze([
        {
            id: 'demo-milton',
            title: 'Milton',
            function: 'survey-paradise-lost-engines',
            counterpressure: 'None claimed. A demonstration makes no argument '
                + 'and this movement does not revise anything.',
            segments: [
                {
                    passageId: 'demo-paradise-lost',
                    role: 'proposition',
                    /**
                     * Evenly spaced across roughly ninety lines, so each
                     * of Milton's six engines holds for about half a
                     * minute. Deliberately NOT the mapping in war.js:
                     * these are turns in a survey, not readings of a
                     * line.
                     */
                    figures: [
                        { id: 'demo-order', fromLine: 0, engines: ['heaven_in_order'] },
                        { id: 'demo-sword', fromLine: 15, engines: ['flaming_sword'] },
                        { id: 'demo-sulfur', fromLine: 30, engines: ['sulfur_magma'] },
                        { id: 'demo-chariot', fromLine: 45, engines: ['chariot_deity'] },
                        { id: 'demo-fall', fromLine: 60, engines: ['fall_hypercube'] },
                        { id: 'demo-chaos', fromLine: 75, engines: ['dark_ocean_chaos'] }
                    ]
                }
            ],
            presentation: {
                visual: { kind: 'procedural', collections: ['paradise-lost'] },
                audio: { kind: 'hold' },
                textStyle: 'monumental'
            },
            transitionOut: {
                id: 'demo-to-steel',
                durationMs: 2000,
                visual: { kind: 'still' },
                audio: { kind: 'silence', fadeMs: 400 }
            }
        },
        {
            id: 'demo-steel',
            title: 'Jünger',
            function: 'survey-storm-of-steel-engines',
            counterpressure: 'None claimed.',
            segments: [
                {
                    passageId: 'demo-storm-of-steel',
                    role: 'transmission',
                    // Eight engines over a prose route. Jünger's chapter
                    // has not been mapped figure by figure the way Book
                    // VI has — that work is specified in
                    // BOOK-VI-PROCEDURAL-WORKS §4 and not done — so
                    // these are turns, not readings.
                    figures: [
                        // Seven, not eight. Mustard Gas (#4) is withheld
                        // in the registry for resolution — see
                        // storm/index.js — so the reel does not show it.
                        // The ASCII trench opens the movement: it is the
                        // most legible of the eight at a glance, which
                        // is what a demonstration wants first.
                        { id: 'demo-ascii', fromLine: 0, engines: ['ascii_soldier'] },
                        { id: 'demo-flow', fromLine: 15, engines: ['flowfield'] },
                        { id: 'demo-spirograph', fromLine: 30, engines: ['spirograph'] },
                        { id: 'demo-flare', fromLine: 45, engines: ['flare_phosphene'] },
                        { id: 'demo-incendiary', fromLine: 61, engines: ['incendiary_blast'] },
                        { id: 'demo-voronoi', fromLine: 76, engines: ['voronoi'] },
                        { id: 'demo-attractor', fromLine: 91, engines: ['attractor'] }
                    ]
                }
            ],
            presentation: {
                visual: { kind: 'procedural', collections: ['storm-of-steel'] },
                audio: { kind: 'hold' },
                textStyle: 'documentary'
            }
        }
    ])
});
