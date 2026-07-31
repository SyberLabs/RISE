/**
 * War — the first authored Journey.
 *
 * JOURNEYS-SPEC §2, and its own reference production. The thesis is not
 * a topic:
 *
 *   War descends from an event in the structure of being, into a code
 *   by which mortal people understand themselves, and finally into
 *   machinery that exceeds any participant's understanding.
 *
 * "War in three works" would be a topic. This is an argument, and each
 * movement has to revise the one before it or the sequence is an
 * anthology of mutually affirming quotations (§1.1).
 *
 * WHY THESE PASSAGES
 * ──────────────────
 * Milton's Book VI is the whole war in heaven — declared, fought, and
 * ended by a power that was never in doubt. It establishes war as an
 * event inside an order that contains it.
 *
 * The Iliad's Book VI and Book XXII are chosen as a pair and must stay
 * one movement. Hector at the Scaean gate, holding his son, is the
 * reason his death in XXII costs anything; XXII without VI is a duel,
 * and VI without XXII is a domestic scene. Their roles are `context`
 * and `critique` because the second revises the first rather than
 * illustrating it.
 *
 * Jünger's Guillemont completes the descent. This movement was blocked
 * for exactly one day, on the reading that his chapters are unnumbered
 * and therefore not citable under §1.4 — which was true about ordinals
 * and false about the book. He TITLES his chapters for the places they
 * happened, Orainville through My Last Storm, and the edition prints
 * them in its own contents. A division does not have to be numbered to
 * be source-defined; it has to be the work's, and these are.
 *
 * Guillemont is the Somme chapter, and the one where the perceptible
 * whole disappears: shelling without a visible enemy, survival decided
 * by chance, and an exhilaration the text never takes back. Its role is
 * `transmission` rather than `conclusion` because the Journey has no
 * conclusion — §2.1's terminal condition is an emptied landscape, not a
 * verdict.
 */

/**
 * Passage records. A passage carries a LOCATOR, never a copy of the
 * text — see passages.js. `checksum` is what it resolved to when it was
 * authored; a mismatch at launch is a refusal, not a rounding error.
 */
export const WAR_PASSAGES = Object.freeze([
    {
        id: 'pass-paradise-lost-war-heaven',
        workId: 'paradise-lost',
        division: 'Book VI',
        label: 'The War in Heaven',
        role: 'proposition',
        language: 'en',
        note: 'Raphael\'s account of the third day: the war is ended by a power '
            + 'that was never contesting, only withholding.'
    },
    {
        id: 'pass-iliad-hector-household',
        workId: 'the-iliad',
        division: 'Book VI',
        label: 'Hector and Andromache at the Scaean Gate',
        role: 'context',
        language: 'en',
        note: 'The scene that gives Hector\'s death its cost. Without it, Book '
            + 'XXII is a duel.',
        /**
         * A DISCLOSED ROUTE (§1.4), not the whole book.
         *
         * Book VI entire is 5,431 words and most of it is Glaukos and
         * Diomedes exchanging armour — a magnificent episode about
         * something else. The movement needs one scene: Hector leaving
         * the gate to find his wife, and the household that mourns him
         * while he is still alive.
         *
         * The closing anchor is chosen and not merely convenient. "So
         * bewailed they Hector, while yet he lived" is the whole reason
         * this passage precedes Book XXII: Troy has already begun the
         * funeral, and the second movement only has to arrive.
         */
        excerpt: {
            from: 'So spake Hector of the glancing helm and departed',
            to: 'So bewailed they Hector, while yet he lived',
            note: 'From Hector leaving the gate to the household mourning '
                + 'him while he still lives.'
        }
    },
    {
        id: 'pass-iliad-hector-death',
        workId: 'the-iliad',
        division: 'Book XXII',
        label: 'The Death of Hector',
        role: 'critique',
        language: 'en',
        note: 'Revises Book VI rather than illustrating it: the code that made '
            + 'him intelligible is what kills him.',
        /**
         * The opening anchor IS the movement's counterpressure.
         *
         * "Thus saying Athene in her subtlety led him on" — Hector turns
         * and stands because a god wearing his brother's face told him
         * to. The code that makes him intelligible is the deception that
         * kills him, and the route begins on the line where that
         * happens rather than at the top of the book.
         */
        excerpt: {
            from: 'Thus saying Athene in her subtlety led him on',
            to: 'leaving her vigour and youth',
            note: 'From Athene\'s deception to the moment his soul leaves him.'
        }
    },
    {
        id: 'pass-storm-of-steel-guillemont',
        workId: 'the-storm-of-steel',
        division: 'Guillemont',
        label: 'Guillemont',
        role: 'transmission',
        language: 'en',
        note: 'Jünger\'s Somme. The chapter where the perceptible whole '
            + 'disappears: shelling without visible enemy, survival by chance, '
            + 'and an exhilaration the text never retracts.'
    }
]);

/** The authored manifest (§6.1). */
export const WAR_JOURNEY = Object.freeze({
    schemaVersion: 'rise.journey.v1',
    id: 'journey-war',
    domain: 'literature',
    kind: 'authored-journey',
    title: 'War',
    subtitle: 'Heaven / Glory / Steel',

    thesis: 'War descends from an event in the structure of being, into a code '
        + 'by which mortal people understand themselves, and finally into '
        + 'machinery that exceeds any participant\'s understanding.',
    transformation: 'War as a perceptible and morally total event becomes '
        + 'impossible to believe in.',
    terminalCondition: 'No synthesis. An emptied landscape, and silence.',

    estimatedMinutes: 24,

    // PHRASE, NOT SENTENCE — measured, not preferred.
    //
    // Milton's sentences run ten lines, so sentence mode never reached a
    // period before the 16-word ceiling and `splitLongChunk` windowed
    // them by word count instead: 71.6% of Book VI's atoms ended
    // mid-phrase, on "and", "which", "with". A reader met
    // "darkness in perpetual round Lodge and" / "dislodge by turns, which".
    //
    // Phrase mode alone was worse in the other direction — 27% fragments
    // and 95 stutter runs, "unpursued," alone on a screen. With the
    // chunker's new floor it measures 0.1% fragments, 0.3% dangling
    // tails, no stutter, and a median of seven words, which is a breath.
    chunkMode: 'phrase',
    phraseFloor: true,

    status: 'publishable',
    /**
     * WHAT THIS JOURNEY NAMES AND DOES NOT YET HAVE.
     *
     * All three soundscapes below are unwritten, so War reads in
     * silence. That is the correct degradation — a soundscape that does
     * not exist must not become a different one, and Aurora is not the
     * war in heaven — but it went unnoticed for as long as it did
     * because nothing said so anywhere. It says so here now, and a test
     * asserts that every unregistered soundscape a Journey names is
     * declared in this list.
     *
     * `status` stays `publishable`: the reading itself is whole, and the
     * imagery is scored. Silence is a missing layer, not a broken one.
     */
    openRequirements: Object.freeze([
        'The soundscape war-ordered-field is not composed — Movement I reads in silence.',
        'The soundscape war-mortal-pulse is not composed — Movement II reads in silence.',
        'The soundscape war-pressure-field is not composed — Movement III reads in silence.'
    ]),

    movements: Object.freeze([
        {
            id: 'war-heaven',
            title: 'War in Heaven',
            function: 'establish-metaphysical-order',
            counterpressure: 'Milton\'s rebel artillery is an industrial '
                + 'invention inside a metaphysical war — the poem already '
                + 'contains the thing the third movement claims is new, and '
                + 'refuses to let the descent look tidy.',
            segments: [
                {
                    passageId: 'pass-paradise-lost-war-heaven',
                    role: 'proposition',
                    /**
                     * BOOK VI, FIGURE BY FIGURE.
                     *
                     * `fromLine` is the line of the passage as the
                     * edition prints it, and each figure holds until the
                     * next one begins. They were placed by reading the
                     * resolved text, not estimated: the sword smites at
                     * 251, the foam is mingled at 513, the chariot is
                     * mounted at 712, Chaos roars at 872.
                     *
                     * A figure with no engine is a GAP, declared rather
                     * than filled with a wrong one. It draws nothing of
                     * its own and the movement's family plays there, as
                     * it did everywhere before figures existed. `wanted`
                     * names the engine Book VI is asking for.
                     *
                     * Milton wants ten. Six exist.
                     */
                    figures: [
                        {
                            id: 'heaven-in-order',
                            // Line 0, not 1: the passage opens with its own
                            // running head, and a figure starting after it
                            // leaves the first atoms to the fallback — a
                            // flicker of the wrong engine on the first words
                            // a reader sees.
                            fromLine: 0,
                            engines: ['heaven_in_order'],
                            note: 'Dawn over Heaven\'s champain, Abdiel returned, '
                                + 'the war declared from a throne that was never in '
                                + 'doubt. Order BEFORE the breach — the one state '
                                + 'the whole Journey is measured against, and the '
                                + 'only figure no other movement can supply.'
                        },
                        {
                            id: 'the-hosts-meet',
                            fromLine: 112,
                            engines: [],
                            wanted: 'adamant-array',
                            note: 'Front to front in terrible array; Abdiel strikes '
                                + 'first and the horrid shock joins. Ranked geometry '
                                + 'colliding — not yet fire.'
                        },
                        {
                            id: 'michaels-sword',
                            fromLine: 251,
                            engines: ['flaming_sword'],
                            note: '"Saw where the sword of Michael smote, and felled" '
                                + '— the duel, and the wound that proves an immortal '
                                + 'can be hurt.'
                        },
                        {
                            id: 'the-rebel-night',
                            fromLine: 407,
                            engines: [],
                            wanted: 'council-in-darkness',
                            note: '"Now Night her course began" — the first night in '
                                + 'Heaven, and the council that meets inside it. '
                                + 'Conspiracy, not combat.'
                        },
                        {
                            id: 'the-invention',
                            fromLine: 513,
                            engines: ['sulfur_magma'],
                            note: '"sulphurous and nitrous foam / They found, they '
                                + 'mingled" — the originals of nature dug out of '
                                + 'Heaven\'s own soil and made into a weapon.'
                        },
                        {
                            id: 'the-cannonade',
                            fromLine: 589,
                            engines: [],
                            wanted: 'deep-throated-engines',
                            note: '"disgorging foul / Their devilish glut, chained '
                                + 'thunderbolts and hail / Of iron globes." Milton\'s '
                                + 'artillery — the movement\'s own counterpressure, '
                                + 'and the figure the third movement will answer. '
                                + 'It should not borrow Jünger\'s ballistics: the '
                                + 'Journey\'s argument depends on these being the '
                                + 'same event three hundred years apart, which only '
                                + 'reads if each is drawn in its own book\'s hand.'
                        },
                        {
                            id: 'the-hills-uptorn',
                            fromLine: 664,
                            engines: [],
                            wanted: 'uprooted-mountains',
                            note: '"So hills amid the air encountered hills" — the '
                                + 'loyal answer to the guns. Landscape used as '
                                + 'ammunition; the opposite gesture to the '
                                + 'cannonade and it should not look like it.'
                        },
                        {
                            id: 'the-chariot',
                            fromLine: 712,
                            engines: ['chariot_deity'],
                            note: '"Ascend my chariot, guide the rapid wheels" — '
                                + 'Ezekiel\'s wheels, and Book VI\'s climax. The '
                                + 'power that ends the war was never contesting it.'
                        },
                        {
                            id: 'the-expulsion',
                            fromLine: 857,
                            engines: ['fall_hypercube'],
                            note: 'The crystal wall rolls inward, a spacious gap '
                                + 'disclosed into the wasteful deep, and they throw '
                                + 'themselves headlong from the verge of Heaven.'
                        },
                        {
                            id: 'nine-days-falling',
                            fromLine: 872,
                            engines: ['dark_ocean_chaos'],
                            note: '"Nine days they fell: Confounded Chaos roared" — '
                                + 'the descent through unformed matter that the rest '
                                + 'of the Journey re-enacts in history.'
                        }
                    ]
                }
            ],
            presentation: {
                // PROCEDURAL, like Jünger and for the mirrored reason.
                // Milton's combatants are angels who cannot die, so
                // there are no bodies to depict — his war is geometry
                // and light. The engines are specific to this book:
                // the Chariot of Paternal Deity IS Book VI's climax,
                // Michael's flaming sword its combat, the Fall of the
                // Rebel Angels its ending.
                visual: { kind: 'procedural', collections: ['paradise-lost'] },
                audio: { kind: 'soundscape', soundscapeId: 'war-ordered-field', gain: 0.55, fadeMs: 1200 },
                textStyle: 'monumental'
            },
            transitionOut: {
                id: 'war-heaven-to-hero',
                durationMs: 1600,
                visual: { kind: 'still' },
                audio: { kind: 'silence', fadeMs: 300 }
            }
        },
        {
            id: 'war-hero',
            title: 'The Hero Under Heaven',
            function: 'contract-to-mortal-body',
            counterpressure: 'The gods remain active and the code remains '
                + 'intelligible: Homer does not present heroic meaning as an '
                + 'illusion the next movement will expose.',
            segments: [
                {
                    passageId: 'pass-iliad-hector-household',
                    role: 'context',
                    // SIXTEEN BOOKS PASS HERE. Hector leaves his wife at
                    // the gate; the next thing this Journey shows is his
                    // body in the dust. Three beats of the reading's own
                    // pace is what separates two paragraphs, not what
                    // separates those. Longer than the movement
                    // boundaries around it, because the distance inside
                    // this movement is greater than the distance out of
                    // it — which is the movement's whole claim.
                    transitionOut: {
                        id: 'hector-gate-to-death',
                        durationMs: 3200,
                        visual: { kind: 'still' },
                        audio: { kind: 'silence', fadeMs: 900 }
                    }
                },
                { passageId: 'pass-iliad-hector-death', role: 'critique' }
            ],
            presentation: {
                // Attic vase painting, curated from the Met (see
                // atr-attic-vases). Chosen because it is a CODE for
                // showing bodies rather than a window onto them, which
                // is what this movement claims heroic meaning is.
                visual: { kind: 'sourced', collections: ['atr-attic-vases'] },
                audio: { kind: 'soundscape', soundscapeId: 'war-mortal-pulse', gain: 0.48, fadeMs: 900 },
                textStyle: 'heroic'
            },
            transitionOut: {
                id: 'war-hero-to-steel',
                durationMs: 2400,
                visual: { kind: 'still' },
                audio: { kind: 'silence', fadeMs: 600 }
            }
        },
        {
            id: 'war-steel',
            title: 'Under Steel',
            function: 'remove-the-perceptible-whole',
            counterpressure: 'Jünger\'s exhilaration is real and is not '
                + 'retracted. The movement must not resolve into an anti-war '
                + 'conclusion the text does not reach.',
            segments: [
                { passageId: 'pass-storm-of-steel-guillemont', role: 'transmission' }
            ],
            presentation: {
                // PROCEDURAL, NOT PINNED IMAGERY. The first two movements
                // are accompanied by works someone made about war. The
                // third cannot be: photographs of the Somme are evidence
                // of the thing Junger says stopped being perceptible, and
                // hanging them beside him would settle retrospectively
                // what the chapter refuses to settle. RISE's own storm
                // engines are the honest accompaniment — trench geometry,
                // ballistic vectors, gas diffusion, flare phosphenes —
                // authored rather than found, and depicting no one.
                visual: { kind: 'procedural', collections: ['storm-of-steel'] },
                audio: { kind: 'soundscape', soundscapeId: 'war-pressure-field', gain: 0.4, fadeMs: 700 },
                textStyle: 'documentary'
            },
            transitionOut: {
                id: 'war-coda',
                durationMs: 7000,
                visual: { kind: 'still' },
                audio: { kind: 'silence', fadeMs: 1200 }
            }
        }
    ]),

    recitation: { enabled: true, voiceId: 'am_michael' }
});

/**
 * The movements whose passages exist.
 *
 * All three, now. Kept as a distinct export because a Journey may be
 * authored ahead of its sources again, and the rehearsal path that
 * allowed is worth keeping rather than rediscovering.
 */
export const WAR_BOUND_MOVEMENTS = Object.freeze(
    WAR_JOURNEY.movements.filter(movement => movement.segments.length > 0));
