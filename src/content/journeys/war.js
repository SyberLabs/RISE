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
 * Jünger would complete the descent, and cannot yet be cited — see
 * `openRequirements`. The Storm of Steel's ingested edition carries no
 * division scheme this Archive can verify: its chapters are unnumbered,
 * so the Archive offers it in twenty-five readings of even length. Those
 * are OUR measurement, not the work's structure, and §1.4 permits a
 * Journey to cite only "the smallest stable authored or source-defined
 * division that can stand alone". Citing "Reading 7" would be citing
 * ourselves.
 *
 * So this Journey is authored complete and published `blocked`, which is
 * what §2.4's source gate anticipated: "exact chapters and passages
 * selected only after edition collation". Two movements are bound to
 * verified text; the third is written and waiting for its edition.
 * Shipping it as a two-movement Journey would be the more comfortable
 * choice and the wrong one — the argument's whole shape is the descent
 * into machinery, and a version that stops at Hector says something
 * else.
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
    }
]);

/**
 * The authored manifest (§6.1).
 *
 * Movement III is present and unbound. It states what it would do and
 * names no passage, so the compiler refuses it — deliberately. A
 * movement that names no passages is an argument with a missing step,
 * and the compiler is right to say so rather than let the Journey look
 * complete.
 */
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
    status: 'blocked',
    blockedReason: 'The third movement has no citable reading unit.',
    openRequirements: Object.freeze([
        'Collate an edition of The Storm of Steel whose chapters are numbered, '
        + 'or author explicit passage bounds for the Chatto & Windus 1929 '
        + 'setting. The Archive currently divides it into 25 readings of even '
        + 'length, which are a measurement rather than a source-defined '
        + 'division, and JOURNEYS-SPEC 1.4 does not permit citing those.'
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
                { passageId: 'pass-paradise-lost-war-heaven', role: 'proposition' }
            ],
            presentation: {
                visual: { kind: 'sourced', collections: ['journey-war-celestial-geometry'] },
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
                { passageId: 'pass-iliad-hector-household', role: 'context' },
                { passageId: 'pass-iliad-hector-death', role: 'critique' }
            ],
            presentation: {
                visual: { kind: 'sourced', collections: ['journey-war-homeric-bronze'] },
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
            // UNBOUND ON PURPOSE. See openRequirements. The compiler
            // refuses a movement that names no passages, which is the
            // correct behaviour and the reason this Journey is blocked
            // rather than quietly two movements long.
            segments: [],
            presentation: {
                visual: { kind: 'sourced', collections: ['journey-war-trench-ground'] },
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
 * The movements whose passages exist. Used to compile and rehearse the
 * bound part of a blocked Journey without pretending it is publishable.
 */
export const WAR_BOUND_MOVEMENTS = Object.freeze(
    WAR_JOURNEY.movements.filter(movement => movement.segments.length > 0));
