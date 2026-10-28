/**
 * The teams whose weekly digest RISE plays on its own site: `/changes/<slug>` lists a team's digests and
 * `/changes/<slug>/<id>` plays one. Each is a public repository whose `changes-data` branch the team's own run of the
 * public workflow writes (.github/workflows/changes-public.yml); the Worker reads that branch for a listed slug and for
 * nothing else (worker/changes.mjs). A team is listed only with a brand its company has confirmed
 * (src/core/figures/brands.js), because its name and colors are then shown on RISE's site. Each entry is reviewed in a
 * pull request, as a brand is.
 */
import { BRANDS } from '../figures/brands.js';
import { TEAM_SLUG } from '../jev-demo-path.js';
const REPOSITORY = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/u;

/** slug -> { repo, brand }: none until a company confirms its brand. */
export const LISTED = Object.freeze({});

/** What is wrong with the listed teams; empty when every entry may be played. */
export function listedProblems(teams = LISTED) {
  return Object.entries(teams).flatMap(([slug, team]) => {
    const problems = [];
    if (!TEAM_SLUG.test(slug)) problems.push(`${slug}: a slug is lower-case letters, digits and hyphens, starting with a letter`);
    if (!REPOSITORY.test(team?.repo ?? '') || /^syberlabs\/rise$/iu.test(team.repo)) problems.push(`${slug}: repo must be another team's owner/name`);
    const brand = BRANDS[team?.brand];
    if (!brand) problems.push(`${slug}: brand ${team?.brand} is not in brands.js`);
    else if (brand.confirmed !== true) problems.push(`${slug}: brand ${team.brand} is not confirmed by the company, so RISE does not show it`);
    return problems;
  });
}

/** The listed team at `slug` as { slug, repo, name }, its name the brand's, or null for any other slug. */
export function listedTeam(slug, teams = LISTED) {
  if (typeof slug !== 'string' || !TEAM_SLUG.test(slug) || !Object.hasOwn(teams, slug)) return null;
  const { repo, brand } = teams[slug];
  return { slug, repo, name: BRANDS[brand].brand.name };
}
