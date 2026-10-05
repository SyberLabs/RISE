/**
 * Two Composer explanations beside the black-hole one (BLACK_HOLES_CURRENT, src/test/sealed-current.js),
 * each with its own presentation demand, written the way the guide (src/live/adapters/current-guide.js)
 * asks a host model to write one. The first passage is short. There are no Dive notes, because a
 * Composer presentation offers no Dive, and no sources, because a Current carries none. What each instrument is for is in docs/plans/COMPOSER-INSTRUMENTS.md.
 *
 * The facts are plain and checkable. Nothing here is executable.
 */
const ORIGIN = Object.freeze({ kind: 'model', name: 'Scripted answer', provider: 'mock' });

function freeze(value) {
    if (value && typeof value === 'object') {
        Object.values(value).forEach(freeze);
        Object.freeze(value);
    }
    return value;
}

/** Contemplative: mostly still, with genesis where something grows, and nothing that turns. */
export const FOREST_AFTER_FIRE = freeze({
    schema: 'rise.current.v1',
    id: 'forest-after-fire',
    title: 'How a forest returns after fire',
    theme: 'jade',
    origin: { ...ORIGIN },
    segments: [
        { id: 'ash', visual: 'still', text: 'After a forest fire, the ground is not empty.' },
        { id: 'survivors', visual: 'genesis', text: 'Seeds lie in the soil, and many plants keep living roots below the ash. The first green often comes from them.' },
        { id: 'cones', visual: 'still', text: 'Some pine cones are sealed with resin and open only in the heat of a fire. The lodgepole pine is one of them.' },
        { id: 'fireweed', visual: 'genesis', text: 'Within a season or two, quick plants such as fireweed cover the burned ground with colour.' },
        { id: 'succession', visual: 'genesis', text: 'Shrubs and young trees follow over years, and trees that grow well in shade over decades. Ecologists call this sequence succession.' },
        { id: 'slow', visual: 'still', text: 'A forest is less a thing than a process, and a slower one than a human life.' }
    ]
});

/** Dynamic: the attractor carries it, and only the limit it arrives at is still. */
export const WEATHER_CHAOS = freeze({
    schema: 'rise.current.v1',
    id: 'weather-chaos',
    title: 'Why the weather cannot be known for long',
    theme: 'cobalt',
    origin: { ...ORIGIN },
    segments: [
        { id: 'rerun', visual: 'attractor', text: 'In 1961, a forecast changed because of a rounding.' },
        { id: 'lorenz', visual: 'attractor', text: 'Edward Lorenz restarted a weather simulation from numbers he had rounded to three decimal places. Soon the new run looked nothing like the old one.' },
        { id: 'sensitive', visual: 'attractor', text: 'Tiny differences in where the weather starts grow until they swamp the forecast. This is called sensitive dependence on initial conditions.' },
        { id: 'attractor', visual: 'attractor', text: 'In 1963 he published three equations for rising air whose path never repeats, yet never leaves a bounded shape. That shape is now called a strange attractor.' },
        { id: 'limit', visual: 'still', text: 'This is why a detailed forecast loses its skill after about two weeks, however good the instruments.' },
        { id: 'climate', visual: 'attractor', text: 'Climate asks a different question: not where the weather will be on a given day, but the shape of the range it moves within.' }
    ]
});
