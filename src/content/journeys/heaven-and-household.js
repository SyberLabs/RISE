/**
 * Heaven and Household — an editorial draft, not a catalogued Journey.
 *
 * Two short, source-bound passages move from a divine victory achieved by
 * violence to Andromache's fear of what war will take from her household. The
 * relation is juxtaposed, not an assertion that Milton and Bryant say the same.
 */
export const HEAVEN_HOUSEHOLD_PASSAGES = Object.freeze([
    {
        id: 'heaven-household-milton-fall',
        workId: 'paradise-lost',
        division: 'Book VI',
        label: 'The Son drives the rebel host from Heaven',
        role: 'proposition',
        language: 'en',
        note: 'Disclosed route from the Son driving the rebels through their fall.',
        excerpt: {
            from: 'He on his impious foes right onward drove',
            to: 'Unquenchable, the house of woe and pain.',
            note: 'From the Son driving the rebel host to Hell receiving them.'
        }
    },
    {
        id: 'heaven-household-bryant-hector',
        workId: 'the-iliad',
        division: 'Book VI: Interviews Between Glaucus and Diomed, and Hector and Andromache',
        label: 'Hector and Andromache at the Scaean Gate',
        role: 'context',
        language: 'en',
        note: 'Andromache recalls her lost family and fears Hector’s death; Hector answers with his duty to fight and fear of her captivity.',
        excerpt: {
            from: 'Too brave! Thy valor yet will cause thy death.',
            to: 'I hear thy cries as thou art borne away!',
            note: 'From Andromache’s opening warning through Hector’s complete reply about her foreseen captivity.'
        }
    }
]);

export const HEAVEN_HOUSEHOLD_CHECKSUMS = Object.freeze({
    'heaven-household-milton-fall': '48673a215f0d1763359b327bbeeb344f96cab3264bb4059f601ea75edfd12713',
    'heaven-household-bryant-hector': '15f5cc1f77ce283b8e7f6d7224786dffb9a96a32c820b1a00961efc3a7849942'
});

export const HEAVEN_HOUSEHOLD_JOURNEY = Object.freeze({
    schemaVersion: 'rise.journey.v1',
    id: 'journey-heaven-and-household-draft',
    domain: 'literature',
    kind: 'authored-journey',
    title: 'Heaven and Household',
    subtitle: 'War in Heaven / Hector at the gate',
    thesis: 'Milton’s war ends by divine command; in Bryant’s Iliad, Andromache recalls her lost family while Hector chooses duty despite foreseeing Troy’s fall and her captivity.',
    transformation: 'War moves from a divinely settled defeat to mortal fear and attachment without resolving their difference.',
    terminalCondition: 'Hector wishes to die before hearing Andromache led away captive; his duty and his attachment remain unreconciled.',
    estimatedMinutes: 5,
    wpm: 200,
    chunkMode: 'phrase',
    phraseFloor: true,
    status: 'draft',
    openRequirements: Object.freeze([
        'Editorial review and approval are required before this draft can be launched.'
    ]),
    movements: Object.freeze([
        {
            id: 'heaven-household-order',
            title: 'A War Ended from Above',
            function: 'show-cosmic-war-as-settled-by-divine-force',
            counterpressure: 'The Son’s expulsion restores hierarchy through violence; the rebels’ nine-day fall and eternal punishment keep the victory from reading as effortless harmony.',
            segments: [{ passageId: 'heaven-household-milton-fall', role: 'proposition' }],
            presentation: {
                visual: { kind: 'still' },
                audio: { kind: 'silence' },
                textStyle: 'monumental'
            },
            transitionOut: {
                id: 'heaven-household-to-hector',
                durationMs: 4200,
                visual: { kind: 'still' },
                audio: { kind: 'silence', fadeMs: 900 }
            }
        },
        {
            id: 'heaven-household-mortal-cost',
            title: 'Hector and Andromache at the Scaean Gate',
            function: 'show-wars-cost-to-a-mortal-household',
            counterpressure: 'Hector’s resolve to fight persists beside Andromache’s plea to stay; his love for her does not undo the duty he believes he owes Troy.',
            segments: [{ passageId: 'heaven-household-bryant-hector', role: 'context' }],
            presentation: {
                visual: { kind: 'still' },
                audio: { kind: 'silence' },
                textStyle: 'heroic'
            }
        }
    ])
});
