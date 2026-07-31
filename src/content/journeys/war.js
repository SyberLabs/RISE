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
            + 'XXII is a duel.'
    },
    {
        id: 'pass-iliad-hector-death',
        workId: 'the-iliad',
        division: 'Book XXII',
        label: 'The Death of Hector',
        role: 'critique',
        language: 'en',
        note: 'Revises Book VI rather than illustrating it: the code that made '
            + 'him intelligible is what kills him.'
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
    status: 'publishable',
    openRequirements: Object.freeze([]),

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
                { passageId: 'pass-paradise-lost-war-heaven', role: 'proposition' }
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
