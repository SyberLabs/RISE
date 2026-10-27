/**
 * The products RISE writes a digest for, keyed by repository (lower case): how the router and composer name the
 * product and its users, and the brand its figures are drawn in (src/core/figures/brands.js). A repository not listed
 * here is written about as RISE and drawn in RISE's theme. Each record is reviewed in a pull request, as a brand is.
 */
export const RISE_PRODUCT = Object.freeze({
  name: 'RISE',
  about: 'RISE is a reading app: it speaks a text aloud and shows it with visuals.',
  users: 'people who read with RISE',
  themes: 'the reader, RISE Live, the connector, visuals, infrastructure'
});

export const CUSTOMERS = Object.freeze({
  /** Written from their README; a sample on our side only until OpenStatus confirms the brand. */
  'openstatushq/openstatus': Object.freeze({
    product: Object.freeze({
      name: 'openstatus',
      about: 'openstatus is an open source status page and uptime monitoring service, hosted or self hosted.',
      users: 'people who use openstatus',
      themes: 'status pages, monitoring and the checker, the dashboard, the website, infrastructure'
    }),
    brand: 'openstatus'
  })
});

/** The repository's customer record, or null for RISE itself and any repository not listed. */
export function customerFor(repo) {
  return CUSTOMERS[String(repo).toLowerCase()] ?? null;
}
