/**
 * What Book VI's engines are, without the code that draws them.
 *
 * THE ONE PLACE AN ENGINE IS NAMED. This used to be two: an array in
 * index.js carrying `engineClass` references, and a hand-kept copy of the
 * ids, names and categories in work-engines.js, with descriptions that
 * existed nowhere else. The copy existed because importing the array
 * synchronously would pull every generator into the main bundle — a real
 * constraint with the wrong answer. Splitting the metadata out satisfies
 * it without a second vocabulary: index.js zips this with the classes,
 * work-engines.js reads it alone, and there is nothing to keep in sync.
 *
 * PROJECT-KNOWLEDGE §2.1 calls a vocabulary living in two places the
 * single most frequent defect in this codebase. The fix for a vocabulary
 * in two places is one place, not a test comparing the two.
 */

export const PARADISE_LOST_ENGINE_META = Object.freeze([
    // Book VI in its own order: heaven before the breach, then the war.
    {
        id: 'heaven_in_order',
        name: '0. Heaven in Order (The Perpetual Round)',
        category: 'DIMENSIONAL / SPATIAL',
        description: 'Concentric rings and gates of light turning as rigid bodies — everything rotates or translates, nothing scatters, spawns or decays. The ordered state the rest of Book VI is measured against.'
    },
    {
        id: 'fall_hypercube',
        name: '1. Fall of the Rebel Angels (Mandelbrot Abyss)',
        category: 'DIMENSIONAL / SPATIAL',
        description: 'A kaleidoscopic attractor above a falling red region textured with Mandelbrot and Julia sets, the divine bloom melting into the abyss with no horizon between them.'
    },
    {
        id: 'chariot_deity',
        name: '2. Chariot of Paternal Deity (Ezekiel Wheels)',
        category: 'DIMENSIONAL / SPATIAL',
        description: 'Multi-ringed 3D strange attractors, wheel within wheel after Ezekiel, pulsing in sapphire and gold with lightning across them.'
    },
    {
        id: 'flaming_sword',
        name: '3. St. Michael\'s Flaming Sword (3D Inscribed)',
        category: 'DIMENSIONAL / SPATIAL',
        description: 'A shaded 3D sword — winged crossguard, central fuller, tapered double edge — carrying Latin inscriptions along the blade. The most figurative of these surfaces.'
    },
    {
        id: 'sulfur_magma',
        name: '4. Sulfur & Brimstone Magma Network (Voronoi)',
        category: 'DIMENSIONAL / SPATIAL',
        description: 'Branching rivers of magma creeping through cracked basalt crust, deep crimson underglow beneath lava-orange streams. Slow, viscous, and dark rather than bright.'
    },
    {
        id: 'dark_ocean_chaos',
        name: '5. The Dark Ocean of Chaos (Cosmic Flow Fields)',
        category: 'DIMENSIONAL / SPATIAL',
        description: 'Divergence-free curl-noise flow: incompressible streams wandering an unbounded dark field, primordial and directionless. Continuous motion with no figure in it.'
    }
].map(Object.freeze));
