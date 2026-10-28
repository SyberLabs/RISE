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
  }),
  /** Written from their README; a sample on our side only until Windmill confirms the brand. */
  'windmill-labs/windmill': Object.freeze({
    product: Object.freeze({
      name: 'Windmill',
      about: 'Windmill is an open source, self hostable platform that turns scripts into workflows, apps and AI agents.',
      users: 'people who build with Windmill',
      themes: 'the editor and flows, workers and the runtime, apps, AI and agents, the CLI and integrations'
    }),
    brand: 'windmill'
  }),
  /** Written from their README; a sample on our side only until Hatchet confirms the brand. */
  'hatchet-dev/hatchet': Object.freeze({
    product: Object.freeze({
      name: 'Hatchet',
      about: 'Hatchet is an orchestration engine for background tasks, AI agents and durable workflows.',
      users: 'people who run their work on Hatchet',
      themes: 'the engine and workers, the SDKs, the dashboard, durable workflows, infrastructure'
    }),
    brand: 'hatchet'
  }),
  /** Written from their README; a sample on our side only until Fission AI confirms the brand. */
  'fission-ai/openspec': Object.freeze({
    product: Object.freeze({
      name: 'OpenSpec',
      about: 'OpenSpec is an open source spec framework that keeps specs and change proposals in the repo before a coding agent writes code.',
      users: 'people who work with OpenSpec',
      themes: 'the CLI and its commands, specs and change proposals, agent integrations, the docs'
    }),
    brand: 'openspec'
  })
});

/** The repository's customer record, or null for RISE itself and any repository not listed. */
export function customerFor(repo) {
  return CUSTOMERS[String(repo).toLowerCase()] ?? null;
}
