import { describe, expect, it } from 'vitest';
import { LISTED, listedProblems, listedTeam } from './listed.js';
import { BRANDS } from '../figures/brands.js';

describe('the teams RISE lists', () => {
  it('lists only teams it may show: a slug, another team\'s repository and a confirmed brand', () => {
    expect(listedProblems(LISTED)).toEqual([]);
  });

  it('refuses a brand its company has not confirmed, so GitHits is not listed yet', () => {
    expect(BRANDS.githits.confirmed).toBe(false);
    expect(listedProblems({ githits: { repo: 'githits/githits', brand: 'githits' } })).toEqual([
      'githits: brand githits is not confirmed by the company, so RISE does not show it'
    ]);
  });

  it.each([
    ['a slug that reads as a digest id', { '2026-10-13': { repo: 'a/b', brand: 'githits' } }, /slug/u],
    ['an upper-case slug', { Acme: { repo: 'a/b', brand: 'githits' } }, /slug/u],
    ['RISE itself', { rise: { repo: 'SyberLabs/RISE', brand: 'githits' } }, /another team/u],
    ['a repository that is not owner/name', { acme: { repo: 'https://github.com/a/b', brand: 'githits' } }, /another team/u],
    ['a brand brands.js does not hold', { acme: { repo: 'a/b', brand: 'nobody' } }, /not in brands\.js/u]
  ])('refuses %s', (_, teams, problem) => {
    expect(listedProblems(teams).join('; ')).toMatch(problem);
  });

  it('finds a listed team by its slug, named by its brand, and nothing else', () => {
    const teams = { acme: { repo: 'acme-labs/widgets', brand: 'githits' } };
    expect(listedTeam('acme', teams)).toEqual({ slug: 'acme', repo: 'acme-labs/widgets', name: 'GitHits' });
    for (const slug of ['other', 'constructor', '__proto__', 'Acme', '', null]) expect(listedTeam(slug, teams)).toBeNull();
  });
});
