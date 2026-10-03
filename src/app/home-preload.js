/**
 * Fetch what Home plays at the same time as the Portal's own code.
 *
 * The Portal asks for these itself, but one at a time: its chunk loads, it
 * renders, it asks for today's poem, and only once the poem is here does it
 * ask for the stream and the stage that play it. On a phone network each of
 * those asks is a round trip of half a second or more before a word moves.
 * Asking for all of them while the Portal is still on the wire pays that
 * round trip once. The Portal's later imports then resolve from the module
 * map; nothing about what it does with them changes.
 *
 * Every specifier here must be one the Portal still imports;
 * home-preload.test.js holds the two together, so a module the Portal stops
 * using cannot keep being fetched on every visit.
 */
export function preloadHome() {
  // A failure is the Portal's to report when it makes the same request.
  return Promise.all([
    import('../core/today-poem.js'),
    import('../core/today-reading.js'),
    import('../content/archive/today-openings.json'),
    import('../components/reading-backdrop.js'),
    import('../components/reading-stream.js')
  ]).catch(() => {});
}
