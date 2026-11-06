/**
 * The router's context contract (docs/plans/RISE-CHANGES.md, Route): what the router is shown of each pull request,
 * read from its fact card (src/core/changes/facts.js). Pure, so the same cards give the same context. Contributor text
 * in it (title, labels, body) is raw here and quoted by buildRouteRequest. A change to what it shows bumps
 * ROUTE_CONTEXT_VERSION, which is part of the route cache's contract hash, so no route cached under the old context is
 * reused.
 */

export const ROUTE_CONTEXT_VERSION = 1;
export const ROUTE_CONTEXT_FIELDS = Object.freeze(['number', 'title', 'labels', 'areas', 'flags', 'body']);
const BODY = 600;

const summary = card => ({
  number: card.number,
  title: card.title,
  labels: [...card.labels],
  areas: card.areas.map(({ area, files, additions, deletions }) => ({ area, files, additions, deletions })),
  flags: Object.entries(card.flags).filter(([, set]) => set === true).map(([flag]) => flag),
  body: Array.from(card.body).slice(0, BODY).join('')
});

/** The router's view of these fact cards, in the order given. */
export function routeContext(cards) {
  return cards.map(summary);
}
