/**
 * What Under Steel's engines are, without the code that draws them.
 *
 * THE ONE PLACE AN ENGINE IS NAMED. See paradise_lost/engines.meta.js for
 * why the metadata is separate from the classes: index.js zips this with
 * them, work-engines.js reads it alone, and a name cannot drift because
 * there is only one of it.
 *
 * The numbering gap at 4 is deliberate and is documented at the import
 * block in index.js: Mustard Gas Turing Patterns is withheld, not deleted.
 * It is absent here for the same reason it is absent there — an entry
 * without a class would be a promise nothing can keep.
 */

export const STORM_OF_STEEL_ENGINE_META = Object.freeze([
    {
        id: 'voronoi',
        name: '1. Voronoi Trench Network',
        category: 'GEOMETRIC / STRUCTURAL',
        description: 'Space divided into cell-like trench perimeters — mud fractures, barbed wire and shell craters as a hard tessellation. Angular and graphic.'
    },
    {
        id: 'flowfield',
        name: '2. Steel Shrapnel Flow Field',
        category: 'ORGANIC / NATURAL',
        description: 'Thousands of high-velocity particles following curl-noise vectors: tracer sparks, ricochets and iron dust drawn across open ground. Fast and directional.'
    },
    {
        id: 'attractor',
        name: '3. Drumfire Strange Attractor',
        category: 'DIMENSIONAL / SPATIAL',
        description: 'Lorenz, Clifford, De Jong and Aizawa attractors traced as fine continuous line — sustained drumfire as mathematics rather than as picture.'
    },
    {
        id: 'flare_phosphene',
        name: '5. Magnesium Flare & Phosphenes',
        category: 'PERCEPTUAL / PHENOMENOLOGICAL',
        description: 'A magnesium star-shell hanging over the parapet, with the lattices, spirals and tunnels the eye makes under that light. Blinding centre, afterimage at the edges.'
    },
    {
        id: 'spirograph',
        name: '6. Ballistic Trajectory Spirograph',
        category: 'GEOMETRIC / STRUCTURAL',
        description: 'Lissajous and harmonograph arcs plotting shell flight paths and counter-battery geometry. Thin, precise, almost diagrammatic.'
    },
    {
        id: 'incendiary_blast',
        name: '7. Incendiary Shell Blast',
        category: 'DIMENSIONAL / SPATIAL',
        description: 'A lit 3D terrain heightfield deformed in real time by impacts — craters with raised ejecta rims, molten cores, shrapnel streaks and smoke. The heaviest and most three-dimensional of the set.'
    },
    {
        id: 'ascii_soldier',
        name: '8. ASCII Trench & Soldier Art',
        category: 'SYMBOLIC / NOTATIONAL',
        description: 'A front-line soldier and the wire, trees and sandbags around him, drawn entirely from ASCII and Unicode characters. Typographic; reads as text before it reads as picture.'
    }
].map(Object.freeze));
