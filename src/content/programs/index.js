/**
 * The sequences the house has minted, and the only slugs `/p/` answers for.
 *
 * A minted program is a file in this repository, reviewed in a pull request
 * and published by a deploy. THAT IS THE WHOLE GATE, and it is the same one
 * a Journey passes. Nothing here is fetched from anywhere a reader can
 * write to.
 *
 * THIS REGISTER IS THE ALLOWLIST. A slug that is not in it has no asset
 * path, so no address bar can name a file — the route never builds a path
 * out of what it was given, it looks one up.
 *
 * WHAT A MINT IS NOT. A minted program still arrives through
 * `parseExperienceProgramJson` and still lands `authority: proposed`, like
 * any other import. There is deliberately no trusted doorway: `published`
 * is what RISE's own Journeys claim, and a second way to claim it is
 * exactly the laundering `normalizeImportedProgram` refuses. Being in the
 * repository earns a short URL, not a different authority.
 */

import { PROGRAM_ROUTE_PREFIX, programPath } from '../../core/program-paths.js';

export { PROGRAM_ROUTE_PREFIX, programPath };

export const HOUSE_PROGRAMS = Object.freeze([
    Object.freeze({
        slug: 'the-uncarved-block',
        title: 'The Uncarved Block',
        // Shown where a reader is told what they are about to open, and
        // printed beside the code when one is minted.
        summary: 'Four chapters of the Tao Te Ching, on emptiness and return.',
        asset: '/programs/the-uncarved-block.json'
    })
]);

export function houseProgram(slug) {
    return HOUSE_PROGRAMS.find(item => item.slug === slug) || null;
}
